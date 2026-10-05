import { InlineKeyboard } from 'grammy';
import { course } from '../config/course';
import { content } from '../content/index';
import type { Lead } from '../db/leads';
import { esc } from '../lib/html';
import { formatPhone } from '../lib/phone';
import { isWorkingHours, kzToday } from '../lib/time';
import { track } from '../services/analytics';
import { seatsLeft, sessionsWithTitles } from '../services/offer';
import type { BotRuntime } from './index';

// Follow-ups that recover drop-offs, plus session reminders for students.
// Each (lead, kind) is sent at most once (reminders table), nudges only during working hours,
// never to people who sent /stop, blocked the bot, or were marked lost.

const PER_JOB_LIMIT = 25;

export async function runReminders(rt: BotRuntime, now = rt.kit.ctx.clock()): Promise<Record<string, number>> {
  const { kit } = rt;
  const app = kit.ctx;
  const db = app.db;
  const iso = now.toISOString();
  const hAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  const sent: Record<string, number> = {};

  const claim = (leadId: number, kind: string) =>
    Number(db.prepare('INSERT OR IGNORE INTO reminders (lead_id, kind, sent_at) VALUES (?, ?, ?)').run(leadId, kind, iso).changes) > 0;

  const pick = (where: string, ...args: Array<string | number>) =>
    db
      .prepare(
        `SELECT * FROM leads WHERE tg_chat_id IS NOT NULL AND blocked_at IS NULL AND opted_out_at IS NULL AND lost_at IS NULL AND ${where} LIMIT ${PER_JOB_LIMIT}`,
      )
      .all(...args) as unknown as Lead[];

  async function nudge(kind: string, leads: Lead[], render: (lead: Lead) => { text: string; kb?: InlineKeyboard }) {
    for (const lead of leads) {
      if (!claim(lead.id, kind)) continue;
      const { text, kb } = render(lead);
      if (await kit.sendToLead(lead, text, kb)) {
        sent[kind] = (sent[kind] ?? 0) + 1;
        track(app, 'reminder_sent', { lead, props: { kind } });
      }
    }
  }

  const working = isWorkingHours(now, course.payments.workingHours);
  const notStarted = !course.cohort.startDate || kzToday(now) < course.cohort.startDate;
  const unclaimed = (kind: string) => `NOT EXISTS (SELECT 1 FROM reminders r WHERE r.lead_id = leads.id AND r.kind = '${kind}')`;

  if (working) {
    // Started the quiz in the bot but stopped.
    await nudge('quiz', pick(`applied_at IS NULL AND quiz_started_at < ? AND quiz_started_at > ? AND ${unclaimed('quiz')}`, hAgo(2), hAgo(48)), (l) => {
      const t = kit.copy(l.lang).t;
      return { text: t.reminders.quiz, kb: new InlineKeyboard().text(t.menu.apply, 'm:apply') };
    });

    if (notStarted && seatsLeft(db) > 0) {
      // Qualified but never opened payment.
      const hot = `tier = 'hot' AND paid_at IS NULL AND payment_requested_at IS NULL`;
      await nudge('pay1', pick(`${hot} AND qualified_at < ? AND qualified_at > ? AND ${unclaimed('pay1')}`, hAgo(24), hAgo(24 * 14)), (l) => {
        const { t, f } = kit.copy(l.lang);
        return { text: t.reminders.pay1(f), kb: new InlineKeyboard().text(t.pay.kaspiInvoice, 'pay:ki').row().text(t.menu.faq, 'm:faq').text(t.menu.human, 'm:human') };
      });
      await nudge('pay2', pick(`${hot} AND qualified_at < ? AND qualified_at > ? AND ${unclaimed('pay2')}`, hAgo(72), hAgo(24 * 21)), (l) => {
        const { t, f } = kit.copy(l.lang);
        return { text: t.reminders.pay2(f), kb: new InlineKeyboard().text(t.pay.kaspiInvoice, 'pay:ki').row().text(t.menu.human, 'm:human') };
      });
    }

    // Kaspi invoice sent a day ago and still unpaid.
    await nudge('invoice', pick(`paid_at IS NULL AND invoice_sent_at < ? AND ${unclaimed('invoice')}`, hAgo(24)), (l) => {
      const t = kit.copy(l.lang).t;
      return { text: t.reminders.invoice, kb: new InlineKeyboard().text(t.pay.claim, 'pay:claim').row().text(t.pay.needHelp, 'pay:help') };
    });

    // Paid a day ago, still not in the cohort chat: send a fresh one-time invite.
    if (kit.env.COHORT_CHAT_ID) {
      for (const lead of pick(`paid_at < ? AND joined_at IS NULL AND ${unclaimed('join')}`, hAgo(24))) {
        if (!claim(lead.id, 'join')) continue;
        try {
          const link = await kit.bot.api.createChatInviteLink(kit.env.COHORT_CHAT_ID, {
            name: `lead-${lead.id}-r`,
            member_limit: 1,
            expire_date: Math.floor(now.getTime() / 1000) + 14 * 86_400,
          });
          if (await kit.sendToLead(lead, kit.copy(lead.lang).t.onboarding.joinReminder(esc(link.invite_link)))) sent.join = (sent.join ?? 0) + 1;
        } catch (err) {
          app.log.error('join reminder invite failed', { err: String(err) });
        }
      }
    }

    // A day after paying, invite students to bring friends (only when the reward is defined).
    if (course.referral.enabled && course.referral.friendBonus && course.referral.referrerBonus) {
      for (const lead of pick(`paid_at < ? AND ${unclaimed('referral')}`, hAgo(24))) {
        if (!claim(lead.id, 'referral')) continue;
        const code = lead.ref_code;
        if (!code) continue;
        const link = kit.botLink(`r_${code}`) ?? `${kit.env.PUBLIC_URL}/?ref=${code}`;
        const { t } = kit.copy(lead.lang);
        const lang = lead.lang;
        if (await kit.sendToLead(lead, t.referral(esc(link), esc(course.referral.friendBonus[lang]), esc(course.referral.referrerBonus[lang]), 0, 0))) {
          sent.referral = (sent.referral ?? 0) + 1;
        }
      }
    }

    // Team SLA: a Kaspi invoice was promised within N minutes.
    const late = new Date(now.getTime() - course.payments.invoiceWithinMinutes * 60_000).toISOString();
    const overdue = db
      .prepare(
        `SELECT * FROM leads WHERE payment_method = 'kaspi_invoice' AND payment_requested_at < ? AND invoice_sent_at IS NULL AND paid_at IS NULL AND lost_at IS NULL AND ${unclaimed('sla_invoice')} LIMIT ${PER_JOB_LIMIT}`,
      )
      .all(late) as unknown as Lead[];
    for (const lead of overdue) {
      if (!claim(lead.id, 'sla_invoice')) continue;
      await kit.toAdmins(
        `⏰ #${lead.id} ждёт счёт Kaspi дольше ${course.payments.invoiceWithinMinutes} мин. Номер: ${esc(lead.phone ? formatPhone(lead.phone) : '—')}`,
        new InlineKeyboard().text('🧾 Счёт выставлен', `adm:inv:${lead.id}`),
      );
      sent.sla_invoice = (sent.sla_invoice ?? 0) + 1;
    }
  }

  // Session reminders: one hour before each class, to every paid student of the cohort.
  const titles = content('ru').curriculum.weeks.map((w) => w.sessions.map((s) => s.title));
  const sessions = sessionsWithTitles('ru', titles);
  const total = sessions.length;
  for (const s of sessions) {
    const msBefore = s.startsAt.getTime() - now.getTime();
    if (msBefore > 60 * 60_000 || msBefore < 0) continue;
    const kind = `session_${s.n}`;
    const students = db
      .prepare(`SELECT * FROM leads WHERE paid_at IS NOT NULL AND cohort = ? AND tg_chat_id IS NOT NULL AND blocked_at IS NULL AND opted_out_at IS NULL AND ${unclaimed(kind)}`)
      .all(course.cohort.id) as unknown as Lead[];
    for (const lead of students) {
      if (!claim(lead.id, kind)) continue;
      const weekTitles = content(lead.lang).curriculum.weeks.map((w) => w.sessions.map((x) => x.title));
      const title = weekTitles[s.week - 1]?.[(s.n - 1) % course.cohort.sessionsPerWeek] ?? '';
      const zoom = kit.env.ZOOM_URL ? esc(kit.env.ZOOM_URL) : null;
      if (await kit.sendToLead(lead, kit.copy(lead.lang).t.reminders.session(s.n, total, esc(title), zoom))) sent[kind] = (sent[kind] ?? 0) + 1;
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  return sent;
}

export function startReminders(rt: BotRuntime, intervalMs = 60_000): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const sent = await runReminders(rt);
      if (Object.keys(sent).length) rt.kit.ctx.log.info('reminders sent', sent);
    } catch (err) {
      rt.kit.ctx.log.error('reminders failed', { err: String(err) });
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  void tick();
  return () => clearInterval(timer);
}
