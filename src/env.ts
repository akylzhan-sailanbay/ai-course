import { z } from 'zod';

// Every secret and deployment-specific value lives here. Nothing from this module is sent to the
// browser except the explicitly public analytics IDs exposed via `publicConfig()`.

const optional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional();

const idList = optional.transform((v) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isSafeInteger),
);

const chatId = optional.transform((v) => (v && /^-?\d+$/.test(v) ? Number(v) : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_URL: optional.transform((v) => (v ?? 'http://localhost:3000').replace(/\/+$/, '')),
  DATABASE_PATH: optional.transform((v) => v ?? './data/app.db'),
  BACKUP_DIR: optional,
  TRUST_PROXY: optional.transform((v) => v === '1' || v === 'true'),

  BOT_TOKEN: optional,
  BOT_USERNAME: optional.transform((v) => v?.replace(/^@/, '')),
  BOT_MODE: z.enum(['polling', 'webhook']).default('polling'),
  TELEGRAM_WEBHOOK_SECRET: optional,
  ADMIN_CHAT_ID: chatId,
  ADMIN_IDS: idList,
  COHORT_CHAT_ID: chatId,
  COHORT_INVITE_URL: optional,
  ZOOM_URL: optional,

  KASPI_PAY_URL: optional,
  PAYMENT_LINK_URL: optional,

  ADMIN_PASSWORD: optional,

  POSTHOG_KEY: optional,
  POSTHOG_HOST: optional.transform((v) => (v ?? 'https://eu.i.posthog.com').replace(/\/+$/, '')),
  META_PIXEL_ID: optional,
  TIKTOK_PIXEL_ID: optional,
  YANDEX_METRICA_ID: optional,
  GA4_ID: optional,
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (!env.PUBLIC_URL.startsWith('https://')) problems.push('PUBLIC_URL must be https:// in production');
    if (env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length < 12) problems.push('ADMIN_PASSWORD must be at least 12 characters');
    if (env.BOT_MODE === 'webhook' && (!env.TELEGRAM_WEBHOOK_SECRET || env.TELEGRAM_WEBHOOK_SECRET.length < 24)) {
      problems.push('TELEGRAM_WEBHOOK_SECRET (24+ chars) is required when BOT_MODE=webhook');
    }
    if (problems.length) throw new Error(`Unsafe production configuration:\n  ${problems.join('\n  ')}`);
  }
  return env;
}

/** Values that are safe to embed in public HTML (analytics IDs are public by design). */
export function publicConfig(env: Env) {
  return {
    posthogKey: env.POSTHOG_KEY,
    posthogHost: env.POSTHOG_HOST,
    metaPixelId: env.META_PIXEL_ID,
    tiktokPixelId: env.TIKTOK_PIXEL_ID,
    yandexMetricaId: env.YANDEX_METRICA_ID,
    ga4Id: env.GA4_ID,
  };
}

export type PublicConfig = ReturnType<typeof publicConfig>;
