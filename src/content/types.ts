import type { Lang } from '../config/course';
import type { Goal, Role, Schedule, Timing, Tier } from '../lib/scoring';

/** Course facts resolved for one language (dates formatted, placeholders kept visible). */
export interface Facts {
  lang: Lang;
  brand: string;
  startDate: string;
  days: string;
  time: string;
  price: string;
  regularPrice: string | null;
  earlyBird: { reason: string; until: string } | null;
  installments: string | null;
  seatsLeft: number;
  /** True only when real scarcity applies (fewer seats than course.cohort.showSeatsLeftBelow). */
  showSeats: boolean;
  capacity: number;
  minSize: number;
  perAssistant: number;
  sessionsTotal: number;
  weeks: number;
  lessonLanguage: string;
  toolCosts: string;
  guarantee: { min: number; total: number; months: number };
  invoiceMinutes: number;
  hours: { from: number; to: number };
  cardPayment: boolean;
}

type F<T = string> = (f: Facts) => T;
type Item = { title: string; text: string };

export interface QuizCopy {
  role: { label: string; options: Record<Role, string> };
  goal: { label: string; options: Record<Goal, string> };
  schedule: { label: F; options: Record<Schedule, string> };
  timing: { label: string; options: Record<Timing, string> };
}

export interface Content {
  lang: Lang;
  htmlLang: string;
  path: string;
  langName: string;
  meta: { title: F; description: F };
  nav: { program: string; format: string; price: string; faq: string; apply: string };

  hero: {
    eyebrow: string;
    title: [string, string];
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    askTelegram: string;
    facts: F<Array<{ label: string; value: string }>>;
    demo: { you: string; prompt: string; ai: string; done: string; url: string; siteName: string; siteTitle: string; siteText: string; siteButton: string; toast: string; toastText: string };
  };
  pains: { title: string; items: Item[] };
  compare: { title: string; alone: string; rows: Array<{ label: string; alone: string; course: string }>; footnote: string };
  projects: { title: string; subtitle: string; unit: string; items: Array<{ week: string; title: string; text: string; example: string }> };
  curriculum: {
    title: F;
    subtitle: string;
    week: (n: number) => string;
    result: string;
    demoDay: string;
    weeks: Array<{ title: string; result: string; sessions: Item[] }>;
  };
  firstHour: { title: string; subtitle: string; steps: Array<{ time: string; text: string }>; goal: string; videoCaption: string; videoMissing: string };
  security: { eyebrow: string; title: string; subtitle: string; items: Item[] };
  audience: { title: string; forTitle: string; forItems: string[]; notTitle: string; notItems: string[] };
  format: { title: string; items: F<Array<{ label: string; value: string }>> };
  tools: { title: string };
  instructor: { title: string };
  proof: { title: string; emptyTitle: string; emptyText: string; viewSource: string; viewProject: string };
  guarantee: { title: string; text: string; termsTitle: string; terms: F<string[]> };
  pricing: {
    title: string;
    cohort: F;
    includes: F<string[]>;
    payMethods: F;
    note: string;
    cta: string;
    seatsLeft: F;
    soldOut: string;
    earlyBird: F<string | null>;
  };
  faq: { title: string; items: F<Array<{ q: string; a: string }>> };
  apply: {
    title: string;
    subtitle: string;
    steps: string[];
    noBot: string;
    name: string;
    phone: string;
    phoneHint: string;
    next: string;
    consent: [string, string];
    step: (n: number) => string;
    quizTitle: string;
    quiz: QuizCopy;
    back: string;
    sending: string;
    success: Record<Tier, { title: string; text: string; cta: string }>;
    noTelegram: string;
    errors: { name: string; phone: string; network: string; rate: string; generic: string };
  };
  sticky: { cta: string };
  footer: { privacy: string; offer: string; contacts: string; rights: string };
  bot: BotCopy;
}

export interface BotCopy {
  menu: { apply: string; program: string; price: string; faq: string; human: string; switchLang: string; back: string };
  welcome: (f: Facts, name: string) => string;
  linked: string;
  continueQuiz: string;
  askPhone: string;
  sharePhone: string;
  phoneSaved: (phone: string) => string;
  phoneInvalid: string;
  quizProgress: (n: number, total: number) => string;
  result: {
    hot: F;
    warm: string;
    cold: (channel: string | null) => string;
    wantNow: string;
  };
  pay: {
    kaspiInvoice: string;
    kaspiLink: string;
    card: string;
    askFirst: string;
    confirmPhone: (phone: string) => string;
    yes: string;
    otherPhone: string;
    invoiceRequested: F;
    invoiceSent: F;
    link: F;
    open: string;
    claimed: F;
    claim: string;
    notFound: string;
    needHelp: string;
    alreadyPaid: string;
  };
  onboarding: {
    welcome: (f: Facts, invite: string | null, tools: string[]) => string;
    askProject: string;
    skip: string;
    projectSaved: string;
    joinReminder: (invite: string) => string;
  };
  reminders: {
    quiz: string;
    pay1: F;
    pay2: F;
    invoice: string;
    session: (n: number, total: number, title: string, zoom: string | null) => string;
  };
  support: { ask: F; forwarded: string; reply: string; offHours: F };
  program: F;
  price: F;
  faqIntro: string;
  referral: (link: string, friend: string | null, referrer: string | null, invited: number, paid: number) => string;
  stopped: string;
  resumed: string;
  langSwitched: string;
  soldOut: string;
}
