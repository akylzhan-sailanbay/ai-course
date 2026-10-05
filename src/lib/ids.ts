import { randomBytes, randomInt, timingSafeEqual, createHash } from 'node:crypto';

/** 128-bit URL-safe token; also valid inside a Telegram /start payload ([A-Za-z0-9_-]). */
export function newToken(): string {
  return randomBytes(16).toString('base64url');
}

const REF_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Short, unambiguous referral code, e.g. 'k7m2qa'. */
export function newRefCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return out;
}

/** Constant-time string comparison for secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}
