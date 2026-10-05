import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import { z } from 'zod';
import { course, LANGS, missingFacts, type Lang } from '../config/course';
import { CONTENT, content, otherLang } from '../content/index';
import { offer, privacy } from '../content/legal';
import { allLeads, getLeadByToken, recentLeads } from '../db/leads';
import { byRole, bySource, funnel, insertEvent } from '../db/stats';
import { publicConfig } from '../env';
import { attributionSchema } from '../lib/attribution';
import { toCsv } from '../lib/csv';
import { safeEqual } from '../lib/ids';
import { normalizePhone, whatsappLink } from '../lib/phone';
import { findPlaceholders } from '../lib/placeholders';
import { RateLimiter } from '../lib/ratelimit';
import { GOALS, ROLES, SCHEDULES, TIMINGS } from '../lib/scoring';
import type { AppContext } from '../services/context';
import { createWebLead, submitApplication } from '../services/funnel';
import { buildFacts, seatsTaken } from '../services/offer';
import { ADMIN_CSP, publicCsp } from './csp';
import { Admin } from './pages/Admin';
import type { Links } from './pages/Footer';
import { Landing } from './pages/Landing';
import { Legal } from './pages/Legal';

export interface WebOptions {
  publicDir?: string;
  /** grammY webhook handler, mounted at /telegram/webhook when BOT_MODE=webhook. */
  webhook?: (c: Context) => Promise<Response>;
  /** Rate limiter overrides (tests). */
  limits?: { lead?: RateLimiter; app?: RateLimiter; event?: RateLimiter; auth?: RateLimiter };
}

const EVENT_NAMES = new Set([
  'page_view', 'cta_click', 'form_start', 'form_error', 'quiz_answer', 'tg_click', 'wa_click', 'faq_open',
  'program_open', 'view_pricing', 'lang_switch', 'nav_click', 'video_play',
]);

const anonIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional().catch(undefined);
const langSchema = z.enum(['ru', 'kk']).catch('ru');

const leadSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(5).max(32),
  lang: langSchema,
  anonId: anonIdSchema,
  attribution: attributionSchema,
  ref: z.string().regex(/^[a-z0-9]{4,12}$/i).optional().catch(undefined),
  website: z.string().max(200).optional(),
  elapsedMs: z.number().int().nonnegative().optional().catch(undefined),
});

const applicationSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  answers: z.object({ role: z.enum(ROLES), goal: z.enum(GOALS), schedule: z.enum(SCHEDULES), timing: z.enum(TIMINGS) }),
});

const eventSchema = z.object({
  name: z.string().max(40),
  anonId: anonIdSchema,
  path: z.string().max(200).optional().catch(undefined),
  props: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional().catch(undefined),
  attribution: attributionSchema,
});

function assetVersion(dir: string): string {
  const h = createHash('sha1');
  for (const f of ['css/site.css', 'js/app.js', 'js/analytics.js']) {
    try {
      h.update(readFileSync(join(dir, f)));
    } catch {
      /* file optional */
    }
  }
  return h.digest('hex').slice(0, 10);
}

/** Renders a server component (sync or async) to a full HTML document. */
async function renderDoc(node: unknown, typography = true): Promise<string> {
  const resolved = await node;
  const html = resolved == null ? '' : await (resolved as { toString(): string | Promise<string> }).toString();
  return `<!doctype html>${typography ? typo(html) : html}`;
}

/** Russian/Kazakh typesetting on text nodes only: no line starts with a dash, numbers stay with their words. */
export function typo(html: string): string {
  let raw = false; // inside <script>/<style>
  return html
    .split(/(<[^>]*>)/)
    .map((part) => {
      if (part.startsWith('<')) {
        if (/^<(script|style)\b/i.test(part)) raw = true;
        else if (/^<\/(script|style)/i.test(part)) raw = false;
        return part;
      }
      if (raw) return part;
      return part
        .replace(/ — /g, '\u00A0— ')
        .replace(/(\d) (?=[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі])/g, '$1\u00A0')
        .replace(/(^|[\s«(])([А-Яа-яЁё]) (?=\S)/g, '$1$2\u00A0')
        .replace(/Demo Day/g, 'Demo\u00A0Day');
    })
    .join('');
}

/** Cleans a name: no control chars, no links (spam), collapsed spaces. */
function cleanName(raw: string): string | null {
  const name = raw.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  if (!name || /https?:|www\.|\.(ru|com|kz|net)\b/i.test(name)) return null;
  return name;
}

export function createWebApp(ctx: AppContext, opts: WebOptions = {}) {
  const { env } = ctx;
  const publicDir = opts.publicDir ?? join(process.cwd(), 'public');
  const assetV = assetVersion(publicDir);
  const csp = publicCsp(env);
  const pub = publicConfig(env);
  const analyticsOn = Object.entries(pub).some(([k, v]) => k !== 'posthogHost' && Boolean(v));
  const publicOrigin = new URL(env.PUBLIC_URL).origin;
  const limits = {
    lead: opts.limits?.lead ?? new RateLimiter(6, 60_000),
    app: opts.limits?.app ?? new RateLimiter(20, 60_000),
    event: opts.limits?.event ?? new RateLimiter(120, 60_000),
    auth: opts.limits?.auth ?? new RateLimiter(10, 60_000),
  };

  const app = new Hono();

  const clientIp = (c: Context): string => {
    if (env.TRUST_PROXY) {
      // One reverse proxy (Caddy) appends the real client IP as the last entry.
      const xff = c.req.header('x-forwarded-for');
      const last = xff?.split(',').pop()?.trim();
      if (last) return last;
    }
    try {
      return getConnInfo(c).remote.address ?? 'unknown';
    } catch {
      return 'unknown';
    }
  };

  const links = (lang: Lang): Links => ({
    telegram: ctx.botUsername ? `https://t.me/${ctx.botUsername}` : null,
    channel: course.contacts.telegramChannel,
    whatsapp: course.contacts.whatsapp
      ? whatsappLink(`+${course.contacts.whatsapp}`, lang === 'kk' ? `Сәлеметсіз бе! «${course.brand.kk}» курсы туралы білгім келеді.` : `Здравствуйте! Хочу узнать про курс «${course.brand.ru}».`)
      : null,
    instagram: course.contacts.instagram,
    phone: course.contacts.phone,
    email: course.contacts.email,
  });

  const deepLink = (token: string) => (ctx.botUsername ? `https://t.me/${ctx.botUsername}?start=a_${token}` : null);

  // Caddy compresses too; this covers hosts without a compressing proxy.
  app.use('*', compress());

  // ── Security headers ──────────────────────────────────────────────────────────────────────
  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    c.header('Cross-Origin-Opener-Policy', 'same-origin');
    if (env.NODE_ENV === 'production') c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (!c.res.headers.get('Content-Security-Policy')) {
      c.header('Content-Security-Policy', c.req.path.startsWith('/admin') ? ADMIN_CSP : csp);
    }
  });

  app.onError((err, c) => {
    ctx.log.error('request failed', { path: c.req.path, err: err instanceof Error ? err.stack : String(err) });
    return c.req.path.startsWith('/api/') ? c.json({ ok: false, error: 'server' }, 500) : c.text('Server error', 500);
  });

  app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ ok: false, error: 'not_found' }, 404) : c.redirect('/', 302)));

  // ── Pages ─────────────────────────────────────────────────────────────────────────────────
  const pageCache = new Map<string, { html: string; etag: string; expires: number }>();

  const renderLanding = async (lang: Lang) => {
    const cached = pageCache.get(lang);
    if (cached && cached.expires > Date.now()) return cached;
    const c = content(lang);
    const f = buildFacts(ctx, lang);
    const other = CONTENT[otherLang(lang)];
    const node = Landing({
      c,
      f,
      course,
      links: links(lang),
      assetV,
      publicUrl: env.PUBLIC_URL,
      otherLang: { href: other.path, name: other.langName },
      analytics: analyticsOn,
      clientConfig: {
        lang,
        bot: ctx.botUsername ?? null,
        analytics: pub,
        i18n: { sending: c.apply.sending, errors: c.apply.errors },
      },
    });
    const html = await renderDoc(node);
    const entry = { html, etag: `"${createHash('sha1').update(html).digest('base64url').slice(0, 16)}"`, expires: Date.now() + 60_000 };
    pageCache.set(lang, entry);
    return entry;
  };

  const sendPage = async (c: Context, lang: Lang) => {
    const page = await renderLanding(lang);
    c.header('Cache-Control', 'no-cache');
    c.header('ETag', page.etag);
    if (c.req.header('if-none-match') === page.etag) return c.body(null, 304);
    return c.html(page.html);
  };

  app.get('/', (c) => sendPage(c, 'ru'));
  app.get('/kz', (c) => sendPage(c, 'kk'));
  app.get('/kz/', (c) => c.redirect('/kz', 301));
  app.get('/ru', (c) => c.redirect('/', 301));

  const legalPage = (lang: Lang, kind: 'privacy' | 'offer') => async (c: Context) => {
    const ct = content(lang);
    const f = buildFacts(ctx, lang);
    const doc = kind === 'privacy' ? privacy(lang, course, f) : offer(lang, course, f);
    const node = Legal({
      c: ct,
      doc,
      brand: f.brand,
      course,
      links: links(lang),
      assetV,
      canonical: `${env.PUBLIC_URL}${lang === 'kk' ? '/kz' : ''}/${kind}`,
    });
    return c.html(await renderDoc(node));
  };
  for (const lang of LANGS) {
    const prefix = lang === 'kk' ? '/kz' : '';
    app.get(`${prefix}/privacy`, legalPage(lang, 'privacy'));
    app.get(`${prefix}/offer`, legalPage(lang, 'offer'));
  }

  app.get('/robots.txt', (c) => c.text(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${env.PUBLIC_URL}/sitemap.xml\n`));
  app.get('/sitemap.xml', (c) => {
    c.header('Content-Type', 'application/xml');
    const urls = ['/', '/kz', '/offer', '/privacy', '/kz/offer', '/kz/privacy'];
    return c.body(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
        .map((u) => `<url><loc>${env.PUBLIC_URL}${u}</loc></url>`)
        .join('')}</urlset>`,
    );
  });
  app.get('/favicon.ico', (c) => c.redirect('/assets/img/favicon.svg', 301));
  app.get('/healthz', (c) => {
    ctx.db.prepare('SELECT 1').get();
    return c.json({ ok: true, bot: Boolean(ctx.botUsername) });
  });

  app.use('/assets/*', async (c, next) => {
    await next();
    if (c.res.status === 200) {
      const versioned = c.req.query('v') || c.req.path.startsWith('/assets/fonts/');
      c.header('Cache-Control', versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
    }
  });
  app.use('/assets/*', serveStatic({ root: publicDir, rewriteRequestPath: (p) => p.replace(/^\/assets/, '') }));

  // ── Public API ────────────────────────────────────────────────────────────────────────────
  app.use('/api/*', bodyLimit({ maxSize: 8 * 1024, onError: (c) => c.json({ ok: false, error: 'too_large' }, 413) }));
  app.use('/api/*', async (c, next) => {
    // Browsers always send Origin on cross-site POSTs; reject other sites posting to our API.
    const origin = c.req.header('origin');
    const devOk = env.NODE_ENV !== 'production' && origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (origin && origin !== publicOrigin && !devOk) return c.json({ ok: false, error: 'origin' }, 403);
    await next();
  });

  const readJson = async (c: Context) => {
    try {
      return await c.req.json();
    } catch {
      return null;
    }
  };

  app.post('/api/lead', async (c) => {
    if (!limits.lead.take(`lead:${clientIp(c)}`)) return c.json({ ok: false, error: 'rate' }, 429);
    const parsed = leadSchema.safeParse(await readJson(c));
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      return c.json({ ok: false, error: field === 'phone' ? 'phone' : field === 'name' ? 'name' : 'invalid' }, 400);
    }
    const body = parsed.data;
    // Bots fill hidden fields and submit instantly. Pretend success, store nothing.
    if (body.website || (body.elapsedMs !== undefined && body.elapsedMs < 1500)) {
      ctx.log.warn('spam lead dropped', { ip: clientIp(c) });
      return c.json({ ok: true, token: 'x'.repeat(22), tg: null });
    }
    const name = cleanName(body.name);
    if (!name) return c.json({ ok: false, error: 'name' }, 400);
    const phone = normalizePhone(body.phone);
    if (!phone) return c.json({ ok: false, error: 'phone' }, 400);
    const { lead } = await createWebLead(ctx, {
      name,
      phone,
      lang: body.lang,
      anonId: body.anonId ?? null,
      attribution: body.attribution,
      refCode: body.ref,
    });
    return c.json({ ok: true, token: lead.token, tg: deepLink(lead.token) });
  });

  app.post('/api/application', async (c) => {
    if (!limits.app.take(`app:${clientIp(c)}`)) return c.json({ ok: false, error: 'rate' }, 429);
    const parsed = applicationSchema.safeParse(await readJson(c));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid' }, 400);
    const lead = getLeadByToken(ctx.db, parsed.data.token);
    if (!lead) return c.json({ ok: false, error: 'not_found' }, 404);
    const updated = await submitApplication(ctx, lead, parsed.data.answers);
    return c.json({ ok: true, tier: updated.tier, tg: deepLink(lead.token) });
  });

  app.post('/api/event', async (c) => {
    if (!limits.event.take(`ev:${clientIp(c)}`)) return c.body(null, 204);
    const parsed = eventSchema.safeParse(await readJson(c));
    if (!parsed.success || !EVENT_NAMES.has(parsed.data.name)) return c.body(null, 204);
    const e = parsed.data;
    const touch = e.attribution?.first;
    insertEvent(ctx.db, {
      ts: ctx.clock().toISOString(),
      name: e.name,
      anonId: e.anonId ?? null,
      src: touch?.source ?? null,
      med: touch?.medium ?? null,
      cmp: touch?.campaign ?? null,
      path: e.path ?? null,
      props: e.props ?? null,
    });
    return c.body(null, 204);
  });

  // ── Telegram webhook ──────────────────────────────────────────────────────────────────────
  if (opts.webhook) {
    const handler = opts.webhook;
    app.post('/telegram/webhook', (c) => handler(c));
  }

  // ── Admin (Basic auth, server-side) ───────────────────────────────────────────────────────
  app.use('/admin/*', async (c, next) => adminGuard(c, next));
  app.use('/admin', async (c, next) => adminGuard(c, next));
  async function adminGuard(c: Context, next: () => Promise<void>) {
    if (!env.ADMIN_PASSWORD) return c.text('Not found', 404);
    const header = c.req.header('authorization') ?? '';
    const [scheme, encoded] = header.split(' ');
    let ok = false;
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const pass = decoded.slice(decoded.indexOf(':') + 1);
      ok = safeEqual(pass, env.ADMIN_PASSWORD);
    }
    if (!ok) {
      if (!limits.auth.take(`auth:${clientIp(c)}`)) return c.text('Too many attempts', 429);
      c.header('WWW-Authenticate', 'Basic realm="admin", charset="UTF-8"');
      return c.text('Unauthorized', 401);
    }
    c.header('Cache-Control', 'no-store');
    await next();
  }

  app.get('/admin', async (c) => {
    const days = Math.min(3650, Math.max(1, Number(c.req.query('days')) || 30));
    const now = ctx.clock().getTime();
    const since = (d: number) => new Date(now - d * 86_400_000).toISOString();
    const node = Admin({
      d: {
        brand: course.brand.ru,
        days,
        funnels: [
          { label: '7 дн.', f: funnel(ctx.db, since(7)) },
          { label: '30 дн.', f: funnel(ctx.db, since(30)) },
          { label: 'всё время', f: funnel(ctx.db) },
        ],
        sources: bySource(ctx.db, since(days)),
        roles: byRole(ctx.db, since(days)),
        leads: recentLeads(ctx.db, 100),
        readiness: readiness(ctx),
        seats: { taken: seatsTaken(ctx.db), capacity: course.cohort.capacity },
      },
    });
    return c.html(await renderDoc(node, false));
  });

  app.get('/admin/leads.csv', (c) => {
    const cols = [
      'id', 'created_at', 'channel', 'lang', 'name', 'phone', 'tg_username', 'tg_user_id', 'role', 'goal', 'schedule', 'timing',
      'tier', 'score', 'src', 'med', 'cmp', 'cnt', 'trm', 'last_src', 'referrer', 'referred_by', 'applied_at', 'qualified_at',
      'tg_linked_at', 'payment_requested_at', 'invoice_sent_at', 'payment_claimed_at', 'paid_at', 'paid_amount', 'payment_method',
      'joined_at', 'lost_at', 'lost_reason', 'project_idea', 'notes',
    ];
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="leads-${ctx.clock().toISOString().slice(0, 10)}.csv"`);
    return c.body(toCsv(allLeads(ctx.db) as unknown as Array<Record<string, unknown>>, cols));
  });

  return app;
}

export function readiness(ctx: AppContext) {
  const { env } = ctx;
  return {
    missing: missingFacts(course),
    placeholders: [...findPlaceholders(course, 'course'), ...findPlaceholders(CONTENT.ru, 'ru'), ...findPlaceholders(CONTENT.kk, 'kk')],
    integrations: [
      { name: 'Telegram-бот', ok: Boolean(env.BOT_TOKEN), hint: 'BOT_TOKEN от @BotFather' },
      { name: 'Чат команды для заявок', ok: Boolean(env.ADMIN_CHAT_ID), hint: 'ADMIN_CHAT_ID' },
      { name: 'Админы бота', ok: env.ADMIN_IDS.length > 0, hint: 'ADMIN_IDS — ваши Telegram user id' },
      { name: 'Чат потока (инвайты)', ok: Boolean(env.COHORT_CHAT_ID || env.COHORT_INVITE_URL), hint: 'COHORT_CHAT_ID или COHORT_INVITE_URL' },
      { name: 'Ссылка Zoom', ok: Boolean(env.ZOOM_URL), hint: 'ZOOM_URL — уходит только оплатившим' },
      { name: 'Оплата картой', ok: Boolean(env.PAYMENT_LINK_URL), hint: 'PAYMENT_LINK_URL (необязательно)' },
      { name: 'Kaspi ссылка/QR', ok: Boolean(env.KASPI_PAY_URL), hint: 'KASPI_PAY_URL (необязательно, есть счёт на номер)' },
      { name: 'Meta Pixel', ok: Boolean(env.META_PIXEL_ID), hint: 'META_PIXEL_ID — нужен для рекламы в Instagram' },
      { name: 'TikTok Pixel', ok: Boolean(env.TIKTOK_PIXEL_ID), hint: 'TIKTOK_PIXEL_ID (если реклама в TikTok)' },
      { name: 'PostHog', ok: Boolean(env.POSTHOG_KEY), hint: 'POSTHOG_KEY (воронки и записи сессий)' },
      { name: 'Яндекс Метрика', ok: Boolean(env.YANDEX_METRICA_ID), hint: 'YANDEX_METRICA_ID (необязательно)' },
      { name: 'Пароль панели', ok: Boolean(env.ADMIN_PASSWORD), hint: 'ADMIN_PASSWORD' },
    ],
  };
}
