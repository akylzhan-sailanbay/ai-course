// Funnel state transitions shared by the website, the bot and (later) payment webhooks.
// Every step stamps a *_at column once, so reports are simple COUNTs and replays are harmless.

import { course, type Lang } from '../config/course';
import type { DB } from '../db/index';
import {
  getLead,
  getLeadByRefCode,
  getLeadByTgUser,
  getLeadByToken,
  getOtherLeadByPhone,
  getRecentLeadByAnon,
  insertLead,
  markOnce,
  updateLead,
  type Lead,
  type LeadPatch,
} from '../db/leads';
import type { Attribution, Touch } from '../lib/attribution';
import { newRefCode, newToken } from '../lib/ids';
import { qualify, type Answers } from '../lib/scoring';
import { track } from './analytics';
import type { AppContext } from './context';
import { priceNow } from './offer';

const iso = (ctx: AppContext) => ctx.clock().toISOString();

function touchColumns(first?: Touch, last?: Touch): LeadPatch {
  return {
    src: first?.source ?? null,
    med: first?.medium ?? null,
    cmp: first?.campaign ?? null,
    cnt: first?.content ?? null,
    trm: first?.term ?? null,
    click_id: first?.clickId ?? last?.clickId ?? null,
    referrer: first?.referrer ?? null,
    landing: first?.landing ?? null,
    last_src: last?.source ?? first?.source ?? null,
    last_med: last?.medium ?? first?.medium ?? null,
    last_cmp: last?.campaign ?? first?.campaign ?? null,
  };
}

function referrerId(db: DB, refCode: string | null | undefined): number | null {
  if (!refCode) return null;
  return getLeadByRefCode(db, refCode.toLowerCase())?.id ?? null;
}

// ── Web ───────────────────────────────────────────────────────────────────────────────────────

export interface WebLeadInput {
  name: string;
  phone: string;
  lang: Lang;
  anonId: string | null;
  attribution?: Attribution;
  refCode?: string | null;
}

export async function createWebLead(ctx: AppContext, input: WebLeadInput): Promise<{ lead: Lead; duplicateOf?: Lead }> {
  const now = iso(ctx);
  const weekAgo = new Date(ctx.clock().getTime() - 7 * 86_400_000).toISOString();
  const existing = input.anonId ? getRecentLeadByAnon(ctx.db, input.anonId, weekAgo) : undefined;

  let lead: Lead;
  if (existing) {
    lead = updateLead(ctx.db, existing.id, { name: input.name, phone: input.phone, lang: input.lang }, now);
  } else {
    const refBy = referrerId(ctx.db, input.refCode);
    lead = insertLead(
      ctx.db,
      {
        token: newToken(),
        channel: 'web',
        cohort: course.cohort.id,
        lang: input.lang,
        name: input.name,
        phone: input.phone,
        anon_id: input.anonId,
        referred_by: refBy,
        ...touchColumns(input.attribution?.first, input.attribution?.last),
      },
      now,
    );
  }
  const duplicateOf = getOtherLeadByPhone(ctx.db, input.phone, lead.id);
  track(ctx, 'lead_created', { lead, props: { repeat: Boolean(existing), duplicate: Boolean(duplicateOf) } });
  if (!existing) await ctx.admin.leadEvent('lead', lead, { duplicateOf });
  return { lead, duplicateOf };
}

export async function submitApplication(ctx: AppContext, lead: Lead, answers: Answers): Promise<Lead> {
  const now = iso(ctx);
  const { tier, score } = qualify(answers);
  let updated = updateLead(ctx.db, lead.id, { ...answers, tier, score, cohort: lead.cohort ?? course.cohort.id }, now);
  const firstTime = markOnce(ctx.db, lead.id, 'applied_at', now);
  if (tier === 'hot') markOnce(ctx.db, lead.id, 'qualified_at', now);
  updated = getLead(ctx.db, lead.id)!;
  track(ctx, 'application_submitted', { lead: updated, props: { tier, score, ...answers } });
  if (tier === 'hot') track(ctx, 'qualified', { lead: updated, props: { score } });
  if (firstTime) await ctx.admin.leadEvent('application', updated);
  return updated;
}

/** Student says "I want the next cohort after all" from the waitlist screen. */
export function upgradeToHot(ctx: AppContext, lead: Lead): Lead {
  const now = iso(ctx);
  updateLead(ctx.db, lead.id, { tier: 'hot', timing: 'now' }, now);
  if (markOnce(ctx.db, lead.id, 'qualified_at', now)) track(ctx, 'qualified', { lead, props: { upgraded: true } });
  return getLead(ctx.db, lead.id)!;
}

// ── Telegram ──────────────────────────────────────────────────────────────────────────────────

export interface TgUser {
  id: number;
  chatId: number;
  username?: string;
  firstName?: string;
  languageCode?: string;
}

function tgColumns(u: TgUser): LeadPatch {
  return { tg_user_id: u.id, tg_chat_id: u.chatId, tg_username: u.username ?? null, tg_first_name: u.firstName ?? null };
}

export function langFromTelegram(code?: string): Lang {
  return code?.toLowerCase().startsWith('kk') ? 'kk' : 'ru';
}

/** Finds or creates the lead for a Telegram user who opened the bot directly (not via the site). */
export function upsertBotLead(ctx: AppContext, u: TgUser, opts: { touch?: Touch | null; refCode?: string | null } = {}): { lead: Lead; created: boolean } {
  const now = iso(ctx);
  const existing = getLeadByTgUser(ctx.db, u.id);
  if (existing) {
    const patch: LeadPatch = { tg_chat_id: u.chatId, tg_username: u.username ?? null, tg_first_name: u.firstName ?? null };
    if (existing.blocked_at) patch.blocked_at = null;
    if (opts.touch?.source) Object.assign(patch, { last_src: opts.touch.source, last_med: opts.touch.medium ?? null, last_cmp: opts.touch.campaign ?? null });
    return { lead: updateLead(ctx.db, existing.id, patch, now), created: false };
  }
  const lead = insertLead(
    ctx.db,
    {
      token: newToken(),
      channel: 'bot',
      cohort: course.cohort.id,
      lang: langFromTelegram(u.languageCode),
      name: u.firstName ?? null,
      referred_by: referrerId(ctx.db, opts.refCode),
      ...touchColumns(opts.touch ?? { source: 'telegram', medium: 'telegram_bot' }),
      ...tgColumns(u),
    },
    now,
  );
  markOnce(ctx.db, lead.id, 'tg_linked_at', now);
  track(ctx, 'bot_started', { lead });
  return { lead: getLead(ctx.db, lead.id)!, created: true };
}

/**
 * Binds the website lead behind a deep-link token to this Telegram user.
 * A token can bind to one Telegram account only; if this user already had a bot-only lead,
 * the two records are merged so the person is counted once.
 */
export async function bindWebLead(ctx: AppContext, token: string, u: TgUser): Promise<Lead | null> {
  const now = iso(ctx);
  const web = getLeadByToken(ctx.db, token);
  if (!web) return null;
  if (web.tg_user_id !== null && web.tg_user_id !== u.id) return null; // someone else's token
  if (web.tg_user_id === u.id) return web; // re-opened the same link

  let target: Lead;
  const own = getLeadByTgUser(ctx.db, u.id);
  if (own && own.id !== web.id) {
    target = mergeLeads(ctx.db, own, web, now);
  } else {
    target = updateLead(ctx.db, web.id, tgColumns(u), now);
  }
  if (markOnce(ctx.db, target.id, 'tg_linked_at', now)) {
    target = getLead(ctx.db, target.id)!;
    track(ctx, 'tg_linked', { lead: target });
    await ctx.admin.leadEvent('tg_linked', target);
  }
  return getLead(ctx.db, target.id)!;
}

const TIMESTAMPS = [
  'quiz_started_at', 'applied_at', 'qualified_at', 'tg_linked_at', 'payment_requested_at', 'invoice_sent_at',
  'payment_claimed_at', 'paid_at', 'onboarded_at', 'joined_at',
] as const;

/** Merges `drop` (web lead) into `keep` (Telegram-bound lead) and deletes `drop`. */
export function mergeLeads(db: DB, keep: Lead, drop: Lead, now: string): Lead {
  const patch: LeadPatch = {};
  const prefer = ['name', 'phone', 'anon_id', 'role', 'goal', 'schedule', 'timing', 'tier', 'score', 'referred_by'] as const;
  for (const k of prefer) {
    if (drop[k] !== null && (k === 'name' || keep[k] === null)) (patch as Record<string, unknown>)[k] = drop[k];
  }
  // Earliest touch wins for attribution.
  if (drop.created_at < keep.created_at && drop.src) {
    Object.assign(patch, { src: drop.src, med: drop.med, cmp: drop.cmp, cnt: drop.cnt, trm: drop.trm, click_id: drop.click_id, referrer: drop.referrer, landing: drop.landing });
  }
  for (const k of TIMESTAMPS) {
    const a = keep[k];
    const b = drop[k];
    if (b && (!a || b < a)) (patch as Record<string, unknown>)[k] = b;
  }
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE events SET lead_id = ? WHERE lead_id = ?').run(keep.id, drop.id);
    db.prepare('UPDATE leads SET referred_by = ? WHERE referred_by = ?').run(keep.id, drop.id);
    db.prepare('UPDATE OR IGNORE reminders SET lead_id = ? WHERE lead_id = ?').run(keep.id, drop.id);
    db.prepare('DELETE FROM reminders WHERE lead_id = ?').run(drop.id);
    db.prepare('UPDATE support_links SET lead_id = ? WHERE lead_id = ?').run(keep.id, drop.id);
    db.prepare('DELETE FROM leads WHERE id = ?').run(drop.id);
    if (drop.created_at < keep.created_at) db.prepare('UPDATE leads SET created_at = ? WHERE id = ?').run(drop.created_at, keep.id);
    const merged = Object.keys(patch).length ? updateLead(db, keep.id, patch, now) : getLead(db, keep.id)!;
    db.exec('COMMIT');
    return merged;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ── Payment ───────────────────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'kaspi_invoice' | 'kaspi_link' | 'card_link' | 'manual';

export async function requestPayment(ctx: AppContext, lead: Lead, method: PaymentMethod): Promise<Lead> {
  const now = iso(ctx);
  updateLead(ctx.db, lead.id, { payment_method: method }, now);
  const first = markOnce(ctx.db, lead.id, 'payment_requested_at', now);
  const updated = getLead(ctx.db, lead.id)!;
  track(ctx, 'payment_requested', { lead: updated, props: { method } });
  // Kaspi invoices need a human to act, so the team is always pinged for them.
  if (first || method === 'kaspi_invoice') await ctx.admin.leadEvent('payment_requested', updated);
  return updated;
}

export function markInvoiceSent(ctx: AppContext, lead: Lead): Lead {
  const now = iso(ctx);
  if (markOnce(ctx.db, lead.id, 'invoice_sent_at', now)) track(ctx, 'invoice_sent', { lead });
  return getLead(ctx.db, lead.id)!;
}

export async function claimPayment(ctx: AppContext, lead: Lead): Promise<Lead> {
  const now = iso(ctx);
  // Re-claims are allowed (e.g. after "payment not found") and always ping the team.
  updateLead(ctx.db, lead.id, { payment_claimed_at: now }, now);
  const updated = getLead(ctx.db, lead.id)!;
  track(ctx, 'payment_claimed', { lead: updated });
  await ctx.admin.leadEvent('payment_claimed', updated);
  return updated;
}

/**
 * The only way a lead becomes a paying student. Called from the admin "paid" button, `/paid`,
 * or a payment-provider webhook. Idempotent.
 */
export function confirmPayment(ctx: AppContext, lead: Lead, opts: { amount?: number; method?: PaymentMethod } = {}): { lead: Lead; already: boolean } {
  if (lead.paid_at) return { lead, already: true };
  const now = iso(ctx);
  const amount = opts.amount ?? priceNow(ctx.clock()).amount ?? 0;
  updateLead(
    ctx.db,
    lead.id,
    {
      paid_amount: amount,
      payment_method: opts.method ?? lead.payment_method ?? 'manual',
      cohort: lead.cohort ?? course.cohort.id,
      ref_code: lead.ref_code ?? uniqueRefCode(ctx.db),
      bot_state: null,
    },
    now,
  );
  markOnce(ctx.db, lead.id, 'paid_at', now);
  markOnce(ctx.db, lead.id, 'payment_requested_at', now);
  const updated = getLead(ctx.db, lead.id)!;
  track(ctx, 'paid', { lead: updated, props: { amount, currency: 'KZT', method: updated.payment_method } });
  return { lead: updated, already: false };
}

export function ensureRefCode(ctx: AppContext, lead: Lead): Lead {
  if (lead.ref_code) return lead;
  return updateLead(ctx.db, lead.id, { ref_code: uniqueRefCode(ctx.db) }, iso(ctx));
}

function uniqueRefCode(db: DB): string {
  for (let i = 0; i < 10; i++) {
    const code = newRefCode();
    if (!getLeadByRefCode(db, code)) return code;
  }
  return newRefCode(10);
}

export function markLost(ctx: AppContext, lead: Lead, reason: string): Lead {
  const now = iso(ctx);
  const updated = updateLead(ctx.db, lead.id, { lost_at: now, lost_reason: reason.slice(0, 200) }, now);
  track(ctx, 'lost', { lead: updated, props: { reason } });
  return updated;
}
