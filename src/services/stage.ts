import type { Lead } from '../db/leads';

/** Human label of where a lead is in the funnel (team-facing, Russian). */
export function stage(l: Lead): string {
  if (l.lost_at) return `потерян${l.lost_reason ? `: ${l.lost_reason}` : ''}`;
  if (l.joined_at) return 'в чате потока';
  if (l.paid_at) return 'оплатил';
  if (l.payment_claimed_at) return 'говорит, что оплатил';
  if (l.invoice_sent_at) return 'счёт выставлен';
  if (l.payment_requested_at) return 'ждёт счёт/оплату';
  if (l.tier === 'hot') return 'горячий';
  if (l.tier === 'warm') return 'лист ожидания';
  if (l.tier === 'cold') return 'холодный';
  if (l.quiz_started_at) return 'проходит анкету';
  return 'новый';
}

export const TIER_LABEL: Record<string, string> = { hot: '🔥 горячий', warm: '🌤 тёплый', cold: '❄️ холодный' };
