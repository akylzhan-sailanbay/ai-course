// ─────────────────────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for course facts. The landing page, the bot, reminders and the legal
// pages all read from here. Fill every `null` and every [[TODO: …]] before launch:
//   npm run check:placeholders      (also listed at /admin)
// Copy (headlines, FAQ wording…) lives in src/content/{ru,kk}.ts.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import { todo } from '../lib/placeholders';

export type Lang = 'ru' | 'kk';
export const LANGS: readonly Lang[] = ['ru', 'kk'];
export type L10n<T = string> = Record<Lang, T>;

export interface Testimonial {
  name: string;
  role: L10n;
  quote: L10n;
  projectUrl?: string;
  photo?: string;
  /** Link to the original message/video. Never publish a testimonial you cannot show the source of. */
  sourceUrl: string;
}

export const course = {
  brand: { ru: 'Собери с ИИ', kk: 'ЖИ-мен құрастыр' } satisfies L10n,

  cohort: {
    id: 'c1',
    /** 'YYYY-MM-DD' of the first session. null → shown as TODO, session reminders disabled. */
    startDate: null as string | null,
    /** ISO weekdays (1 = Mon). ASSUMPTION: Mon/Wed/Fri — the brief only says "3 sessions per week". */
    weekdays: [1, 3, 5] as number[],
    startTime: '19:30',
    endTime: '21:30',
    /** Kazakhstan has used a single UTC+5 zone since 1 March 2024. */
    utcOffsetMinutes: 5 * 60,
    weeks: 4,
    sessionsPerWeek: 3,
    capacity: 20,
    minSize: 15,
    studentsPerAssistant: 10,
    /** Real scarcity only: "N seats left" appears when fewer than this many seats remain. */
    showSeatsLeftBelow: 10,
    /** Seats already sold outside the system (cash, friends…). Added to paid leads in the DB. */
    seatsSoldOffline: 0,
  },

  price: {
    /** Full price in KZT. null → TODO. See docs/STRATEGY.md → Pricing for the recommendation. */
    amount: null as number | null,
    /**
     * Optional real deadline-based discount, e.g. for the pilot cohort:
     * { amount: 149000, until: '2026-10-25', reason: { ru: 'Цена первого потока', kk: 'Бірінші ағын бағасы' } }
     */
    earlyBird: null as null | { amount: number; until: string; reason: L10n },
    /** e.g. { ru: 'Рассрочка Kaspi 0-0-3', kk: 'Kaspi бөліп төлеу 0-0-3' } — only if your Kaspi merchant terms allow it. */
    installments: null as L10n | null,
  },

  payments: {
    /** Admin issues a Kaspi invoice to the student's phone from Kaspi Pay, then taps "paid" in Telegram. */
    kaspiInvoice: true,
    /** Promise shown to the student. Keep it honest; the bot reminds admins if it is exceeded. */
    invoiceWithinMinutes: 30,
    /** Working hours for invoices and human replies, KZ time. */
    workingHours: { from: 10, to: 21 },
  },

  /** Main lesson language — students will ask on the KZ page. */
  lessonLanguage: { ru: todo('язык занятий, напр. «русский, ассистенты отвечают на русском и казахском»'), kk: todo('сабақ тілі') } satisfies L10n,

  /** Tools used in class. Rendered as a strip when filled, e.g. ['ChatGPT', 'Cursor', 'GitHub', 'Supabase', 'Vercel']. */
  tools: [] as string[],

  /** Monthly cost of paid tools a student may need, honest disclosure for the FAQ. */
  toolCosts: { ru: todo('нужны ли платные подписки и сколько стоят'), kk: todo('ақылы жазылымдар керек пе') } satisfies L10n,

  instructor: {
    name: todo('Имя преподавателя'),
    photo: null as string | null, // put a square photo at public/img/instructor.jpg and set '/assets/img/instructor.jpg'
    role: { ru: todo('кто вы: напр. «разработчик, 7 лет в продуктах»'), kk: todo('сіз кімсіз') } satisfies L10n,
    /** 3–4 verifiable facts: things you built and launched (with links), companies, numbers you can prove. */
    credentials: {
      ru: [todo('факт 1: что вы построили и запустили (ссылка)'), todo('факт 2: опыт / компании'), todo('факт 3: кого уже научили')],
      kk: [todo('1-факт'), todo('2-факт'), todo('3-факт')],
    } satisfies L10n<string[]>,
    links: [] as Array<{ label: string; url: string }>,
  },

  /** Real student testimonials only (empty until the first cohort). */
  testimonials: [] as Testimonial[],

  /** Proof for "first site in 60 minutes": a screen recording of you building+publishing a site from zero. */
  proofVideoUrl: null as string | null,

  guarantee: {
    minSessionsAttended: 10,
    totalSessions: 12,
    /** Homework for every week submitted before the next week starts. */
    allHomework: true,
    /** Free re-take must be used within this many months, subject to seats. */
    validMonths: 6,
  },

  contacts: {
    telegramChannel: null as string | null, // e.g. 'https://t.me/your_channel'
    whatsapp: null as string | null, // digits only, e.g. '77011234567'
    phone: null as string | null, // display format, e.g. '+7 701 123 45 67'
    email: null as string | null,
    instagram: null as string | null,
  },

  legal: {
    entity: todo('ИП/ТОО и ФИО/название'),
    bin: todo('ИИН/БИН'),
    address: todo('юридический адрес'),
  },


  referral: {
    enabled: true,
    /** What the friend gets and what the referrer gets. Keep it simple and real. */
    friendBonus: null as L10n | null, // e.g. { ru: 'скидка 10 000 ₸', kk: '10 000 ₸ жеңілдік' }
    referrerBonus: null as L10n | null, // e.g. { ru: '10 000 ₸ на Kaspi за каждого друга', kk: '…' }
  },
};

export type Course = typeof course;

/** Explicit launch-readiness checks for facts that are null rather than [[TODO]] strings. */
export function missingFacts(c: Course = course): string[] {
  const missing: string[] = [];
  if (!c.cohort.startDate) missing.push('cohort.startDate — дата старта');
  if (!c.price.amount) missing.push('price.amount — цена');
  if (!c.instructor.photo) missing.push('instructor.photo — фото преподавателя');
  if (!c.proofVideoUrl) missing.push('proofVideoUrl — видео «сайт за 60 минут»');
  if (!c.contacts.whatsapp && !c.contacts.phone) missing.push('contacts.whatsapp/phone — контакт для звонка');
  if (!c.contacts.telegramChannel) missing.push('contacts.telegramChannel — канал для прогрева');
  if (c.referral.enabled && (!c.referral.friendBonus || !c.referral.referrerBonus)) {
    missing.push('referral.friendBonus/referrerBonus — условия реферальной программы');
  }
  return missing;
}
