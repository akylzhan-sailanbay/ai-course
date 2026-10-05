import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLeadByToken } from '../src/db/leads';
import { funnel } from '../src/db/stats';
import { RateLimiter } from '../src/lib/ratelimit';
import { createWebApp } from '../src/web/app';
import { makeCtx } from './helpers';

const ORIGIN = 'https://soberi.test';

function setup(env: Record<string, string> = {}, limits?: NonNullable<Parameters<typeof createWebApp>[1]>['limits']) {
  const ctx = makeCtx({ ADMIN_PASSWORD: 'correct-horse-battery', ...env });
  ctx.botUsername = 'soberi_test_bot';
  const app = createWebApp(ctx, { limits });
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: JSON.stringify(body) });
  return { ctx, app, post };
}

const validLead = {
  name: 'Айгерим',
  phone: '8 701 234 56 78',
  lang: 'ru',
  anonId: 'abcdefghijklmnopqrstuv',
  elapsedMs: 9000,
  attribution: { first: { source: 'Instagram', medium: 'cpc', campaign: 'launch' }, last: { source: 'instagram' } },
};

describe('pages', () => {
  it('renders RU and KZ landings with hreflang, form and security headers', async () => {
    const { app } = setup();
    for (const [path, lang] of [['/', 'ru'], ['/kz', 'kk']] as const) {
      const res = await app.request(path);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, new RegExp(`<html lang="${lang}">`));
      assert.match(html, /hreflang="kk"/);
      assert.match(html, /id="lead-form"/);
      assert.match(html, /id="price"/);
      assert.ok(res.headers.get('content-security-policy')?.includes("script-src 'self'"));
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    }
  });

  it('never ships secrets to the browser', async () => {
    const { app } = setup({ BOT_TOKEN: '123:SECRET-TOKEN', ZOOM_URL: 'https://zoom.us/j/secret', PAYMENT_LINK_URL: 'https://pay.example/secret' });
    const html = await (await app.request('/')).text();
    for (const secret of ['SECRET-TOKEN', 'correct-horse-battery', 'zoom.us/j/secret', 'pay.example/secret']) {
      assert.ok(!html.includes(secret), secret);
    }
  });

  it('serves legal pages, robots and static assets', async () => {
    const { app } = setup();
    for (const p of ['/privacy', '/offer', '/kz/privacy', '/kz/offer', '/robots.txt', '/sitemap.xml', '/healthz']) {
      assert.equal((await app.request(p)).status, 200, p);
    }
    const css = await app.request('/assets/css/site.css?v=1');
    assert.equal(css.status, 200);
    assert.match(css.headers.get('cache-control') ?? '', /immutable/);
  });

  it('supports conditional GET', async () => {
    const { app } = setup();
    const first = await app.request('/');
    const etag = first.headers.get('etag')!;
    assert.equal((await app.request('/', { headers: { 'if-none-match': etag } })).status, 304);
  });
});

describe('POST /api/lead', () => {
  it('stores a lead with normalized phone and attribution and returns a deep link', async () => {
    const { ctx, post } = setup();
    const res = await post('/api/lead', validLead);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { token: string; tg: string };
    assert.match(body.tg, /^https:\/\/t\.me\/soberi_test_bot\?start=a_[A-Za-z0-9_-]{22}$/);
    const lead = getLeadByToken(ctx.db, body.token)!;
    assert.equal(lead.phone, '+77012345678');
    assert.equal(lead.src, 'instagram');
    assert.equal(lead.cmp, 'launch');
    assert.equal(lead.channel, 'web');
    assert.equal(funnel(ctx.db).leads, 1);
  });

  it('updates the same browser’s recent lead instead of duplicating', async () => {
    const { ctx, post } = setup();
    const a = (await (await post('/api/lead', validLead)).json()) as { token: string };
    const b = (await (await post('/api/lead', { ...validLead, name: 'Айгерим Н.' })).json()) as { token: string };
    assert.equal(a.token, b.token);
    assert.equal(funnel(ctx.db).leads, 1);
    assert.equal(getLeadByToken(ctx.db, a.token)!.name, 'Айгерим Н.');
  });

  it('rejects bad phone and spammy names with a field code', async () => {
    const { post } = setup();
    assert.deepEqual(await (await post('/api/lead', { ...validLead, phone: '123' })).json(), { ok: false, error: 'phone' });
    assert.deepEqual(await (await post('/api/lead', { ...validLead, name: 'buy now www.spam.ru' })).json(), { ok: false, error: 'name' });
    assert.equal((await post('/api/lead', { nope: true })).status, 400);
  });

  it('silently drops honeypot and too-fast submissions', async () => {
    const { ctx, post } = setup();
    assert.equal((await post('/api/lead', { ...validLead, website: 'http://bot' })).status, 200);
    assert.equal((await post('/api/lead', { ...validLead, anonId: 'zzzzzzzzzzzzzzzzzzzzzz', elapsedMs: 200 })).status, 200);
    assert.equal(funnel(ctx.db).leads, 0);
  });

  it('blocks other origins and oversized bodies', async () => {
    const { post } = setup();
    assert.equal((await post('/api/lead', validLead, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await post('/api/lead', { ...validLead, name: 'x'.repeat(20_000) })).status, 413);
  });

  it('rate limits per IP', async () => {
    const { post } = setup({}, { lead: new RateLimiter(2, 60_000) });
    await post('/api/lead', validLead);
    await post('/api/lead', validLead);
    assert.equal((await post('/api/lead', validLead)).status, 429);
  });
});

describe('POST /api/application', () => {
  it('qualifies the lead and stamps funnel steps', async () => {
    const { ctx, post } = setup();
    const { token } = (await (await post('/api/lead', validLead)).json()) as { token: string };
    const res = await post('/api/application', { token, answers: { role: 'business', goal: 'booking', schedule: 'yes', timing: 'now' } });
    assert.deepEqual(await res.json(), { ok: true, tier: 'hot', tg: `https://t.me/soberi_test_bot?start=a_${token}` });
    const lead = getLeadByToken(ctx.db, token)!;
    assert.ok(lead.applied_at && lead.qualified_at);
    const f = funnel(ctx.db);
    assert.equal(f.applied, 1);
    assert.equal(f.qualified, 1);
  });

  it('rejects unknown tokens and invalid answers', async () => {
    const { post } = setup();
    assert.equal((await post('/api/application', { token: 'x'.repeat(22), answers: { role: 'business', goal: 'site', schedule: 'yes', timing: 'now' } })).status, 404);
    assert.equal((await post('/api/application', { token: 'x'.repeat(22), answers: { role: 'hacker' } })).status, 400);
  });
});

describe('POST /api/event', () => {
  it('records allowed events with first-touch source and ignores the rest', async () => {
    const { ctx, post } = setup();
    assert.equal((await post('/api/event', { name: 'page_view', anonId: 'abcdefghijkl', attribution: { first: { source: 'tiktok' } } })).status, 204);
    assert.equal((await post('/api/event', { name: 'drop_table', anonId: 'abcdefghijkl' })).status, 204);
    const rows = ctx.db.prepare('SELECT name, src FROM events').all() as Array<{ name: string; src: string }>;
    assert.deepEqual(rows.map((r) => ({ ...r })), [{ name: 'page_view', src: 'tiktok' }]);
    assert.equal(funnel(ctx.db).visitors, 1);
  });
});

describe('admin', () => {
  const auth = (pass: string) => ({ authorization: `Basic ${Buffer.from(`admin:${pass}`).toString('base64')}` });

  it('requires the password and uses a strict CSP', async () => {
    const { app } = setup();
    assert.equal((await app.request('/admin')).status, 401);
    assert.equal((await app.request('/admin', { headers: auth('wrong') })).status, 401);
    const ok = await app.request('/admin', { headers: auth('correct-horse-battery') });
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-security-policy') ?? '', /default-src 'none'/);
    assert.match(await ok.text(), /Готовность к запуску/);
  });

  it('is disabled entirely without ADMIN_PASSWORD', async () => {
    const ctx = makeCtx();
    const app = createWebApp(ctx);
    assert.equal((await app.request('/admin')).status, 404);
  });

  it('exports CSV with formula injection neutralised', async () => {
    const { app, post } = setup();
    await post('/api/lead', { ...validLead, name: '=cmd|calc' });
    const res = await app.request('/admin/leads.csv', { headers: auth('correct-horse-battery') });
    const csv = await res.text();
    assert.match(csv, /'=cmd\|calc/);
    assert.match(csv, /'\+77012345678/);
  });

  it('escapes user-supplied names in the dashboard', async () => {
    const { app, post } = setup();
    await post('/api/lead', { ...validLead, name: 'Ann "quote" & co' });
    const html = await (await app.request('/admin', { headers: auth('correct-horse-battery') })).text();
    assert.ok(html.includes('Ann &quot;quote&quot; &amp; co'));
  });
});
