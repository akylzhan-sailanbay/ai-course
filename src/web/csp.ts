import type { Env } from '../env';

// Content-Security-Policy: scripts only from us and from the analytics vendors that are switched on.
// If a vendor's script is blocked after you enable it, the browser console shows the host to add here.

export function publicCsp(env: Env): string {
  const script = new Set<string>(["'self'"]);
  const frame = new Set<string>(['https://www.youtube-nocookie.com']);
  if (env.POSTHOG_KEY) {
    script.add(env.POSTHOG_HOST);
    script.add(env.POSTHOG_HOST.replace(/^https:\/\/(\w+)\.i\.posthog\.com$/, 'https://$1-assets.i.posthog.com'));
  }
  if (env.META_PIXEL_ID) script.add('https://connect.facebook.net');
  if (env.TIKTOK_PIXEL_ID) script.add('https://analytics.tiktok.com');
  if (env.YANDEX_METRICA_ID) {
    ['https://mc.yandex.ru', 'https://mc.yandex.com', 'https://yastatic.net'].forEach((h) => script.add(h));
    ['https://mc.yandex.ru', 'https://mc.yandex.com', 'blob:'].forEach((h) => frame.add(h));
  }
  if (env.GA4_ID) script.add('https://www.googletagmanager.com');
  return [
    "default-src 'self'",
    `script-src ${[...script].join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https:",
    "media-src 'self' https:",
    `frame-src ${[...frame].join(' ')}`,
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export const ADMIN_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'";
