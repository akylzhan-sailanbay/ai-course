# Implementation plan — «Собери с ИИ»

Status: Step 1 (Understand) found an empty workspace: no framework, infra, assets or credentials exist yet.
Everything below is built from scratch with the minimum moving parts.

## Decisions (from the founder)

| Topic | Decision |
|---|---|
| Language | Russian **and** Kazakh (site `/` = RU, `/kz` = KZ; bot follows the user's language, switchable) |
| Payments | Kaspi (manual invoice/QR, confirmed with one tap by an admin) **plus** an optional card payment link |
| Name | «Собери с ИИ» / «ЖИ-мен құрастыр». Hook: «Первый сайт — за 60 минут. Свой продукт — за 4 недели.» |

## Architecture: one small service

```
                 ┌──────────────────────────── one Node.js process (Docker) ───────────────────────────┐
Ad / post / bio ─┤  Hono HTTP server                      grammY Telegram bot          Scheduler (60s)  │
                 │  • SSR landing RU/KZ (no client fw)    • deep-link binding          • nudges        │
Visitor ────────►│  • /api/lead, /api/application         • quiz / qualification       • session       │
                 │  • /api/event (1st-party analytics)    • Kaspi / card payment       •   reminders   │
                 │  • /admin dashboard + CSV              • onboarding + invite link   • daily backup  │
                 │  • /privacy, /offer                    • FAQ, human support relay                    │
                 │                    └──────────── shared funnel service ────────────┘                │
                 │                                   SQLite (node:sqlite, WAL)                         │
                 └─────────────────────────────────────────────────────────────────────────────────────┘
```

Why this and not Next.js + Vercel + Supabase:
* **One deploy, one database file, roughly $5/month.** Nothing to keep in sync between services.
* **Reminders need minute-level scheduling.** Vercel Hobby cron runs daily only.
* **Data localisation.** Kazakhstan's personal-data law expects databases of KZ citizens' personal data to be
  stored in KZ. A single Docker container on a KZ VPS satisfies that; a US/EU serverless stack does not.
* **No client framework.** The landing is server-rendered HTML with about 10 KB of vanilla JS, which loads fast on mobile 4G.

Stack: Node 22, TypeScript, Hono (HTTP + JSX SSR), grammY (bot), zod (validation), node:sqlite.
Build: esbuild produces one bundle. Tests use `node:test` via tsx.

## Single source of truth

* `src/config/course.ts` holds the facts: price, dates, schedule, capacity, contacts, instructor, guarantee terms.
  Anything unknown is a visible `[[TODO: …]]` placeholder. It is highlighted on the page and listed in `/admin`.
* `src/content/ru.ts` / `kk.ts` hold all copy (site + bot). Both are typed against one `Content` interface, so the
  compiler catches a missing translation.

## Funnel

```
Ad/content ─► Landing ─► Step 1: name + phone (lead saved immediately)
                      └► Step 2: 4 one-tap questions (role, goal, schedule fit, start timing) ─► score: hot / warm / cold
                           └► "Continue in Telegram" (deep link t.me/bot?start=a_<token>)
Bot-first traffic (bio, posts, ads to bot) ─► /start s_<source> ─► same quiz in chat (phone via "share contact")
hot  ─► price + payment choice ─► Kaspi invoice (admin taps "invoice sent" → student pays → admin taps "paid")
                               └► card link (student pays → taps "I paid" → admin confirms)
     ─► paid ─► onboarding: one-time group invite link, checklist, schedule, project-idea question
warm ─► waitlist for next cohort + nurture;  cold ─► content channel + nurture
Any free-text question ─► forwarded to the team chat; the team's reply is relayed back (no dead ends)
```

Each lead row stores a timestamp for every funnel step (`applied_at`, `qualified_at`, `tg_linked_at`,
`payment_requested_at`, `paid_at`, `joined_at`, …). Funnel reports are therefore plain `COUNT(col)` grouped by
first-touch source, with no fragile event reconstruction.

## Analytics

* First-party: every visit and CTA goes to `/api/event`, and every lead carries first- and last-touch UTM + click ids.
  This keeps working when ad blockers drop third-party pixels.
* Optional forwarding, enabled per env var: PostHog (funnels + session replay), Meta Pixel and TikTok Pixel
  (ad optimisation + retargeting), Yandex Metrica (Webvisor), GA4.
* Ads optimise on a custom `QualifiedLead` event rather than raw `Lead`, so the algorithms learn to find payers.
* `/admin` and the bot's `/stats` show the funnel, conversion per source, revenue, and CAC once ad spend is
  logged with `/spend`.

## Security

Secrets live only in env vars and nothing secret ships to the browser. Admin actions are authorised server-side
by Telegram user id; the web admin is behind Basic auth with constant-time compare. Webhook secret header,
zod validation, rate limits, honeypot, Origin check, body-size limits, CSV formula-injection escaping and
HTML escaping are in place. Deep-link tokens bind to one Telegram account only. The Zoom link and group invites are
sent only to paid students; invites are single-use.

## Build order (highest impact first)

1. Config + RU/KZ copy → 2. landing + 2-step form → 3. API + DB → 4. bot (deep link, quiz, payment, onboarding,
support relay, admin) → 5. analytics + admin dashboard → 6. scheduler → 7. Docker/Caddy deploy →
8. tests + browser QA → 9. strategy, marketing assets, experiments, launch checklist.
