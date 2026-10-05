// Qualification: four one-tap questions → hot / warm / cold. Shared by the web form and the bot.

export const ROLES = ['business', 'freelance', 'employee', 'other'] as const;
export const GOALS = ['site', 'booking', 'bot', 'idea', 'explore'] as const;
export const SCHEDULES = ['yes', 'partly', 'no'] as const;
export const TIMINGS = ['now', 'soon', 'later'] as const;

export type Role = (typeof ROLES)[number];
export type Goal = (typeof GOALS)[number];
export type Schedule = (typeof SCHEDULES)[number];
export type Timing = (typeof TIMINGS)[number];
export type Tier = 'hot' | 'warm' | 'cold';

export interface Answers {
  role: Role;
  goal: Goal;
  schedule: Schedule;
  timing: Timing;
}

export const QUIZ_FIELDS = ['role', 'goal', 'schedule', 'timing'] as const;
export type QuizField = (typeof QUIZ_FIELDS)[number];
export const QUIZ_OPTIONS: Record<QuizField, readonly string[]> = {
  role: ROLES,
  goal: GOALS,
  schedule: SCHEDULES,
  timing: TIMINGS,
};

/**
 * hot  — can attend (fully or mostly) and wants the next cohort → show price and payment.
 * warm — wants it soon, or wants it now but cannot make the schedule → waitlist + nurture.
 * cold — just curious → content + nurture.
 */
export function qualify(a: Answers): { tier: Tier; score: number } {
  const score =
    (a.schedule === 'yes' ? 2 : a.schedule === 'partly' ? 1 : 0) +
    (a.timing === 'now' ? 2 : a.timing === 'soon' ? 1 : 0) +
    (a.goal === 'explore' ? 0 : 1);
  if (a.timing === 'later') return { tier: 'cold', score };
  if (a.timing === 'now' && a.schedule !== 'no') return { tier: 'hot', score };
  return { tier: 'warm', score };
}
