import type { Course, Lang } from '../config/course';

// Kazakhstan is a single fixed UTC+5 zone, so all scheduling uses a fixed offset (no DST).
const KZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const TZ = 'Asia/Almaty';

export interface KzParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  /** ISO weekday, 1 = Monday … 7 = Sunday */
  weekday: number;
}

export function kzParts(date: Date): KzParts {
  const t = new Date(date.getTime() + KZ_OFFSET_MS);
  const wd = t.getUTCDay();
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    weekday: wd === 0 ? 7 : wd,
  };
}

/** 'YYYY-MM-DD' + 'HH:MM' in KZ time → Date */
export function kzDateTime(isoDate: string, hhmm: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  if (!y || !m || !d || hh === undefined || mm === undefined) throw new Error(`Bad date/time: ${isoDate} ${hhmm}`);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - KZ_OFFSET_MS);
}

export interface Session {
  n: number; // 1-based
  week: number; // 1-based
  startsAt: Date;
  endsAt: Date;
  isDemoDay: boolean;
}

/** Generates the cohort's session calendar from start date + weekdays. Empty if no start date yet. */
export function cohortSessions(c: Course): Session[] {
  const { startDate, weekdays, startTime, endTime, weeks, sessionsPerWeek } = c.cohort;
  if (!startDate) return [];
  const total = weeks * sessionsPerWeek;
  const sessions: Session[] = [];
  let cursor = kzDateTime(startDate, startTime);
  const [eh = 0, em = 0] = endTime.split(':').map(Number);
  const [sh = 0, sm = 0] = startTime.split(':').map(Number);
  const durationMs = ((eh - sh) * 60 + (em - sm)) * 60_000;
  for (let guard = 0; sessions.length < total && guard < 400; guard++) {
    if (weekdays.includes(kzParts(cursor).weekday)) {
      const n = sessions.length + 1;
      sessions.push({
        n,
        week: Math.ceil(n / sessionsPerWeek),
        startsAt: cursor,
        endsAt: new Date(cursor.getTime() + durationMs),
        isDemoDay: n === total,
      });
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return sessions;
}

export function isWorkingHours(now: Date, hours: { from: number; to: number }): boolean {
  const { hour } = kzParts(now);
  return hour >= hours.from && hour < hours.to;
}

const locale = (lang: Lang) => (lang === 'kk' ? 'kk-KZ' : 'ru-RU');

export function formatDate(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', timeZone: TZ }).format(date);
}

export function formatDateTime(date: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(date);
}

/** Short weekday names for ISO weekdays, e.g. [1,3,5] → 'пн, ср, пт' */
export function formatWeekdays(weekdays: number[], lang: Lang): string {
  // 2024-01-01 was a Monday.
  return weekdays
    .map((wd) => new Intl.DateTimeFormat(locale(lang), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, wd))))
    .join(', ');
}

export function formatMoney(amount: number, lang: Lang): string {
  return `${new Intl.NumberFormat(locale(lang)).format(amount)} ₸`;
}

export function isoNow(now = new Date()): string {
  return now.toISOString();
}

export function hoursAgo(hours: number, now = new Date()): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}

/** Today in KZ as 'YYYY-MM-DD' (for date-only comparisons such as early-bird deadlines). */
export function kzToday(now = new Date()): string {
  const p = kzParts(now);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
