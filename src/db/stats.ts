import type { DB } from './index';
import { params } from './index';

export interface EventRow {
  ts: string;
  name: string;
  anonId?: string | null;
  leadId?: number | null;
  src?: string | null;
  med?: string | null;
  cmp?: string | null;
  path?: string | null;
  props?: Record<string, unknown> | null;
}

export function insertEvent(db: DB, e: EventRow) {
  db.prepare(
    'INSERT INTO events (ts, name, anon_id, lead_id, src, med, cmp, path, props) VALUES ($ts, $name, $anonId, $leadId, $src, $med, $cmp, $path, $props)',
  ).run(params({ ...e, props: e.props && Object.keys(e.props).length ? JSON.stringify(e.props) : null }));
}

export interface Funnel {
  visitors: number;
  leads: number;
  applied: number;
  qualified: number;
  tgLinked: number;
  paymentRequested: number;
  paid: number;
  joined: number;
  revenue: number;
}

const DIRECT = '(direct)';

export function funnel(db: DB, since = '0000'): Funnel {
  const v = db
    .prepare("SELECT COUNT(DISTINCT anon_id) AS n FROM events WHERE name = 'page_view' AND ts >= ?")
    .get(since) as { n: number };
  const l = db
    .prepare(
      `SELECT COUNT(*) AS leads, COUNT(applied_at) AS applied, COUNT(qualified_at) AS qualified,
              COUNT(tg_linked_at) AS tgLinked, COUNT(payment_requested_at) AS paymentRequested,
              COUNT(paid_at) AS paid, COUNT(joined_at) AS joined, COALESCE(SUM(paid_amount), 0) AS revenue
       FROM leads WHERE created_at >= ?`,
    )
    .get(since) as Omit<Funnel, 'visitors'>;
  return { visitors: v.n, ...l };
}

export interface SourceRow extends Funnel {
  src: string;
  spend: number;
}

export function bySource(db: DB, since = '0000'): SourceRow[] {
  const rows = new Map<string, SourceRow>();
  const get = (src: string | null) => {
    const key = src || DIRECT;
    let row = rows.get(key);
    if (!row) {
      row = { src: key, visitors: 0, leads: 0, applied: 0, qualified: 0, tgLinked: 0, paymentRequested: 0, paid: 0, joined: 0, revenue: 0, spend: 0 };
      rows.set(key, row);
    }
    return row;
  };
  for (const r of db
    .prepare("SELECT src, COUNT(DISTINCT anon_id) AS n FROM events WHERE name = 'page_view' AND ts >= ? GROUP BY src")
    .all(since) as Array<{ src: string | null; n: number }>) {
    get(r.src).visitors = r.n;
  }
  for (const r of db
    .prepare(
      `SELECT src, COUNT(*) AS leads, COUNT(applied_at) AS applied, COUNT(qualified_at) AS qualified,
              COUNT(tg_linked_at) AS tgLinked, COUNT(payment_requested_at) AS paymentRequested,
              COUNT(paid_at) AS paid, COUNT(joined_at) AS joined, COALESCE(SUM(paid_amount), 0) AS revenue
       FROM leads WHERE created_at >= ? GROUP BY src`,
    )
    .all(since) as Array<Omit<SourceRow, 'visitors' | 'spend'> & { src: string | null }>) {
    Object.assign(get(r.src), { ...r, src: r.src || DIRECT });
  }
  for (const r of db
    .prepare('SELECT src, SUM(amount) AS spend FROM ad_spend WHERE day >= substr(?, 1, 10) GROUP BY src')
    .all(since) as Array<{ src: string; spend: number }>) {
    get(r.src).spend = r.spend;
  }
  return [...rows.values()].sort((a, b) => b.paid - a.paid || b.qualified - a.qualified || b.leads - a.leads || b.visitors - a.visitors);
}

export interface SegmentRow {
  role: string;
  leads: number;
  qualified: number;
  paid: number;
}

export function byRole(db: DB, since = '0000'): SegmentRow[] {
  return db
    .prepare(
      `SELECT COALESCE(role, '—') AS role, COUNT(*) AS leads, COUNT(qualified_at) AS qualified, COUNT(paid_at) AS paid
       FROM leads WHERE created_at >= ? GROUP BY role ORDER BY paid DESC, qualified DESC, leads DESC`,
    )
    .all(since) as unknown as SegmentRow[];
}

export function addSpend(db: DB, day: string, src: string, amount: number, note: string | null, now: string) {
  db.prepare('INSERT INTO ad_spend (day, src, amount, note, created_at) VALUES (?, ?, ?, ?, ?)').run(day, src, amount, note, now);
}

export function eventCounts(db: DB, since = '0000'): Array<{ name: string; n: number }> {
  return db
    .prepare('SELECT name, COUNT(*) AS n FROM events WHERE ts >= ? GROUP BY name ORDER BY n DESC')
    .all(since) as Array<{ name: string; n: number }>;
}

export function pct(part: number, whole: number): string {
  if (!whole) return '—';
  return `${((part / whole) * 100).toFixed(part / whole < 0.1 ? 1 : 0)}%`;
}
