import { course, type Course, type Lang } from '../config/course';
import type { Facts } from '../content/types';
import type { DB } from '../db/index';
import { countPaid } from '../db/leads';
import { esc } from '../lib/html';
import { plainPlaceholders, todo } from '../lib/placeholders';
import { cohortSessions, formatDate, formatMoney, formatWeekdays, kzDateTime, kzToday } from '../lib/time';
import type { AppContext } from './context';

export interface PriceNow {
  amount: number | null;
  regular: number | null;
  earlyBird: { amount: number; until: string; reason: Record<Lang, string> } | null;
}

export function priceNow(now: Date, c: Course = course): PriceNow {
  const regular = c.price.amount;
  const eb = c.price.earlyBird;
  if (eb && kzToday(now) <= eb.until) return { amount: eb.amount, regular, earlyBird: eb };
  return { amount: regular, regular, earlyBird: null };
}

export function seatsTaken(db: DB, c: Course = course): number {
  return countPaid(db, c.cohort.id) + c.cohort.seatsSoldOffline;
}

export function seatsLeft(db: DB, c: Course = course): number {
  return Math.max(0, c.cohort.capacity - seatsTaken(db, c));
}

export function buildFacts(ctx: Pick<AppContext, 'db' | 'env' | 'clock'>, lang: Lang, c: Course = course): Facts {
  const now = ctx.clock();
  const price = priceNow(now, c);
  const left = seatsLeft(ctx.db, c);
  const start = c.cohort.startDate ? formatDate(kzDateTime(c.cohort.startDate, c.cohort.startTime), lang) : todo('дата старта');
  return {
    lang,
    brand: c.brand[lang],
    startDate: start,
    days: formatWeekdays(c.cohort.weekdays, lang),
    time: `${c.cohort.startTime}\u2060–\u2060${c.cohort.endTime}`,
    price: price.amount ? formatMoney(price.amount, lang) : todo('цена'),
    regularPrice: price.earlyBird && price.regular ? formatMoney(price.regular, lang) : null,
    earlyBird: price.earlyBird ? { reason: price.earlyBird.reason[lang], until: formatDate(kzDateTime(price.earlyBird.until, '12:00'), lang) } : null,
    installments: c.price.installments?.[lang] ?? null,
    seatsLeft: left,
    showSeats: left < c.cohort.showSeatsLeftBelow,
    capacity: c.cohort.capacity,
    minSize: c.cohort.minSize,
    perAssistant: c.cohort.studentsPerAssistant,
    sessionsTotal: c.cohort.weeks * c.cohort.sessionsPerWeek,
    weeks: c.cohort.weeks,
    lessonLanguage: c.lessonLanguage[lang],
    toolCosts: c.toolCosts[lang],
    guarantee: { min: c.guarantee.minSessionsAttended, total: c.guarantee.totalSessions, months: c.guarantee.validMonths },
    invoiceMinutes: c.payments.invoiceWithinMinutes,
    hours: c.payments.workingHours,
    cardPayment: Boolean(ctx.env.PAYMENT_LINK_URL),
  };
}

/** Facts for Telegram HTML: placeholders flattened to [..] and every string escaped. */
export function botFacts(ctx: Pick<AppContext, 'db' | 'env' | 'clock'>, lang: Lang, c: Course = course): Facts {
  const f = buildFacts(ctx, lang, c);
  const clean = (s: string) => esc(plainPlaceholders(s));
  return {
    ...f,
    brand: clean(f.brand),
    startDate: clean(f.startDate),
    days: clean(f.days),
    price: clean(f.price),
    regularPrice: f.regularPrice && clean(f.regularPrice),
    earlyBird: f.earlyBird && { reason: clean(f.earlyBird.reason), until: clean(f.earlyBird.until) },
    installments: f.installments && clean(f.installments),
    lessonLanguage: clean(f.lessonLanguage),
    toolCosts: clean(f.toolCosts),
  };
}

export function sessionsWithTitles(lang: Lang, titles: string[][], c: Course = course) {
  return cohortSessions(c).map((s) => {
    const idx = (s.n - 1) % c.cohort.sessionsPerWeek;
    return { ...s, title: titles[s.week - 1]?.[idx] ?? `#${s.n}` };
  });
}
