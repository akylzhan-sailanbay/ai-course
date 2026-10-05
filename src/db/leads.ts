import type { DB } from './index';
import { params } from './index';
import type { Lang } from '../config/course';
import type { Goal, Role, Schedule, Tier, Timing } from '../lib/scoring';

export interface Lead {
  id: number;
  token: string;
  ref_code: string | null;
  created_at: string;
  updated_at: string;
  lang: Lang;
  channel: 'web' | 'bot';
  cohort: string | null;
  name: string | null;
  phone: string | null;
  anon_id: string | null;
  tg_user_id: number | null;
  tg_chat_id: number | null;
  tg_username: string | null;
  tg_first_name: string | null;
  role: Role | null;
  goal: Goal | null;
  schedule: Schedule | null;
  timing: Timing | null;
  tier: Tier | null;
  score: number | null;
  project_idea: string | null;
  bot_state: string | null;
  payment_method: string | null;
  paid_amount: number | null;
  referred_by: number | null;
  src: string | null;
  med: string | null;
  cmp: string | null;
  cnt: string | null;
  trm: string | null;
  click_id: string | null;
  referrer: string | null;
  landing: string | null;
  last_src: string | null;
  last_med: string | null;
  last_cmp: string | null;
  quiz_started_at: string | null;
  applied_at: string | null;
  qualified_at: string | null;
  tg_linked_at: string | null;
  payment_requested_at: string | null;
  invoice_sent_at: string | null;
  payment_claimed_at: string | null;
  paid_at: string | null;
  onboarded_at: string | null;
  joined_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  opted_out_at: string | null;
  blocked_at: string | null;
  notes: string | null;
}

type Writable = Omit<Lead, 'id' | 'created_at' | 'updated_at'>;
export type LeadPatch = Partial<Writable>;

const WRITABLE = new Set<string>([
  'token', 'ref_code', 'lang', 'channel', 'cohort', 'name', 'phone', 'anon_id', 'tg_user_id', 'tg_chat_id',
  'tg_username', 'tg_first_name', 'role', 'goal', 'schedule', 'timing', 'tier', 'score', 'project_idea',
  'bot_state', 'payment_method', 'paid_amount', 'referred_by', 'src', 'med', 'cmp', 'cnt', 'trm', 'click_id',
  'referrer', 'landing', 'last_src', 'last_med', 'last_cmp', 'quiz_started_at', 'applied_at', 'qualified_at',
  'tg_linked_at', 'payment_requested_at', 'invoice_sent_at', 'payment_claimed_at', 'paid_at', 'onboarded_at',
  'joined_at', 'lost_at', 'lost_reason', 'opted_out_at', 'blocked_at', 'notes',
]);

function columns(patch: object): string[] {
  const keys = Object.keys(patch).filter((k) => (patch as Record<string, unknown>)[k] !== undefined);
  for (const k of keys) if (!WRITABLE.has(k)) throw new Error(`Unknown lead column: ${k}`);
  return keys;
}

export function insertLead(db: DB, data: LeadPatch & { token: string; channel: Lead['channel'] }, now: string): Lead {
  const cols = columns(data);
  const sql = `INSERT INTO leads (${cols.join(', ')}, created_at, updated_at)
               VALUES (${cols.map((c) => `$${c}`).join(', ')}, $now, $now) RETURNING *`;
  return db.prepare(sql).get(params({ ...data, now })) as unknown as Lead;
}

export function updateLead(db: DB, id: number, patch: LeadPatch, now: string): Lead {
  const cols = columns(patch);
  const sets = [...cols.map((c) => `${c} = $${c}`), 'updated_at = $now'].join(', ');
  return db.prepare(`UPDATE leads SET ${sets} WHERE id = $id RETURNING *`).get(params({ ...patch, now, id })) as unknown as Lead;
}

/** Sets a funnel timestamp only if it is still empty. Returns true if it was set now. */
export function markOnce(db: DB, id: number, column: keyof Lead & `${string}_at`, now: string): boolean {
  if (!WRITABLE.has(column)) throw new Error(`Unknown lead column: ${column}`);
  const res = db.prepare(`UPDATE leads SET ${column} = $now, updated_at = $now WHERE id = $id AND ${column} IS NULL`).run({ now, id });
  return Number(res.changes) > 0;
}

export function getLead(db: DB, id: number): Lead | undefined {
  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as unknown as Lead | undefined;
}

export function getLeadByToken(db: DB, token: string): Lead | undefined {
  return db.prepare('SELECT * FROM leads WHERE token = ?').get(token) as unknown as Lead | undefined;
}

export function getLeadByTgUser(db: DB, tgUserId: number): Lead | undefined {
  return db.prepare('SELECT * FROM leads WHERE tg_user_id = ?').get(tgUserId) as unknown as Lead | undefined;
}

export function getLeadByRefCode(db: DB, code: string): Lead | undefined {
  return db.prepare('SELECT * FROM leads WHERE ref_code = ?').get(code) as unknown as Lead | undefined;
}

/** Most recent web lead from the same browser within `days` (to update instead of duplicating). */
export function getRecentLeadByAnon(db: DB, anonId: string, sinceIso: string): Lead | undefined {
  return db
    .prepare("SELECT * FROM leads WHERE anon_id = ? AND channel = 'web' AND created_at >= ? AND tg_user_id IS NULL ORDER BY id DESC LIMIT 1")
    .get(anonId, sinceIso) as unknown as Lead | undefined;
}

export function getOtherLeadByPhone(db: DB, phone: string, excludeId: number): Lead | undefined {
  return db.prepare('SELECT * FROM leads WHERE phone = ? AND id != ? ORDER BY id DESC LIMIT 1').get(phone, excludeId) as unknown as Lead | undefined;
}

export function findLeads(db: DB, query: string): Lead[] {
  const q = query.trim();
  if (/^\d{1,9}$/.test(q)) return [getLead(db, Number(q))].filter((l): l is Lead => !!l);
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 6) {
    return db.prepare("SELECT * FROM leads WHERE replace(phone, '+', '') LIKE ? ORDER BY id DESC LIMIT 5").all(`%${digits.slice(-10)}%`) as unknown as Lead[];
  }
  const handle = q.replace(/^@/, '');
  return db
    .prepare('SELECT * FROM leads WHERE tg_username = ? COLLATE NOCASE OR name LIKE ? ORDER BY id DESC LIMIT 5')
    .all(handle, `%${q}%`) as unknown as Lead[];
}

export function countPaid(db: DB, cohort: string): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM leads WHERE paid_at IS NOT NULL AND cohort = ?').get(cohort) as { n: number };
  return row.n;
}

export function referralCounts(db: DB, leadId: number): { invited: number; paid: number } {
  const row = db
    .prepare('SELECT COUNT(*) AS invited, COUNT(paid_at) AS paid FROM leads WHERE referred_by = ?')
    .get(leadId) as { invited: number; paid: number };
  return row;
}

/** Leads reachable in Telegram for broadcasts. */
export function audience(db: DB, segment: 'students' | 'hot' | 'waitlist' | 'all', cohort: string): Lead[] {
  const reachable = 'tg_chat_id IS NOT NULL AND blocked_at IS NULL';
  const marketing = `${reachable} AND opted_out_at IS NULL AND lost_at IS NULL`;
  const sql: Record<typeof segment, string> = {
    students: `SELECT * FROM leads WHERE ${reachable} AND paid_at IS NOT NULL AND cohort = $cohort`,
    hot: `SELECT * FROM leads WHERE ${marketing} AND paid_at IS NULL AND tier = 'hot'`,
    waitlist: `SELECT * FROM leads WHERE ${marketing} AND paid_at IS NULL AND tier IN ('warm', 'cold')`,
    all: `SELECT * FROM leads WHERE ${marketing} AND paid_at IS NULL`,
  };
  return db.prepare(sql[segment]).all(segment === 'students' ? { cohort } : {}) as unknown as Lead[];
}

export function recentLeads(db: DB, limit = 100): Lead[] {
  return db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT ?').all(limit) as unknown as Lead[];
}

export function allLeads(db: DB): Lead[] {
  return db.prepare('SELECT * FROM leads ORDER BY id').all() as unknown as Lead[];
}
