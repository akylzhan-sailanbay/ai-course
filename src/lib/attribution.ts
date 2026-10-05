import { z } from 'zod';

// First/last-touch attribution captured in the browser (see public/js/app.js) or from a bot deep link.

const tag = z
  .string()
  .trim()
  .max(100)
  .transform((v) => v.toLowerCase().replace(/[^a-z0-9а-яёәғқңөұүһі_.\-+ ]/gi, '').slice(0, 100))
  .optional()
  .catch(undefined);

const text = z.string().trim().max(500).optional().catch(undefined);

export const touchSchema = z
  .object({
    source: tag,
    medium: tag,
    campaign: tag,
    content: tag,
    term: tag,
    clickId: text,
    referrer: text,
    landing: text,
    ts: z.string().max(40).optional().catch(undefined),
  })
  .partial();

export type Touch = z.infer<typeof touchSchema>;

export const attributionSchema = z
  .object({ first: touchSchema.optional(), last: touchSchema.optional() })
  .optional()
  .catch(undefined);

export type Attribution = z.infer<typeof attributionSchema>;

/** Bot payload sources are written as s_<source>[__<campaign>], e.g. s_instagram__bio. */
export function parseSourcePayload(payload: string): Touch | null {
  const m = /^s_([a-z0-9-]{1,30})(?:__([a-z0-9_-]{1,30}))?$/i.exec(payload);
  if (!m) return null;
  return { source: m[1]!.toLowerCase(), medium: 'telegram_bot', campaign: m[2]?.toLowerCase() };
}
