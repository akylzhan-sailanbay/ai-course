# «Собери с ИИ»: course site, application funnel and Telegram bot

The acquisition and onboarding system for a 4-week, beginner-friendly AI/vibe-coding course in Kazakhstan.
The brief is in [`main.md`](main.md).

```
Ad / post ─► Landing (RU / KZ) ─► 2-step application ─► Telegram bot ─► Kaspi or card payment ─► onboarding ─► course
                                     │ name + phone      │ quiz, FAQ, human support           │ one-time chat invite,
                                     └ 4 tap questions   └ team chat gets every lead          └ Zoom reminders
```

## What's inside

| Part | Where |
|---|---|
| Landing page, Russian (`/`) and Kazakh (`/kz`), server-rendered, ~70 KB first load | `src/web/`, `public/` |
| Application API + first-party analytics + UTM/click-id attribution | `src/web/app.ts`, `public/js/app.js` |
| Telegram bot: deep links, quiz, Kaspi invoice + card link, onboarding, support relay, broadcasts, `/stats` | `src/bot/` |
| Reminders (drop-off nudges, invoice SLA, Zoom one hour before class) + daily DB backup | `src/bot/reminders.ts`, `src/services/backup.ts` |
| Admin dashboard: funnel, channels with CAC/ROAS, segments, leads, CSV, launch readiness | `/admin` |
| Course facts (single source of truth) | `src/config/course.ts` |
| All copy, RU + KZ (type-checked to stay in sync) | `src/content/` |

Stack: Node 22 · TypeScript · Hono · grammY · zod · SQLite (`node:sqlite`). One process, one database file,
one Docker container. The reasons are in [`docs/PLAN.md`](docs/PLAN.md).

## Quick start (local)

```bash
npm install
cp .env.example .env      # for local dev set NODE_ENV=development, PUBLIC_URL=http://localhost:3000, DATABASE_PATH=./data/dev.db
npm run dev               # http://localhost:3000 and /kz; the bot starts if BOT_TOKEN is set
npm test                  # 52 tests
npm run check:placeholders  # what's still missing before launch
```

Without `BOT_TOKEN` the site and API work fully and the bot is off. Add a token from @BotFather to run the bot
locally (polling, no public URL needed).

## Before launch

1. Fill the facts: [`docs/LAUNCH-CHECKLIST.md`](docs/LAUNCH-CHECKLIST.md). Missing facts are red on the site and listed in `/admin`.
2. Deploy: [`docs/DEPLOY.md`](docs/DEPLOY.md). Includes the environment-variable reference and the KZ data-localisation note.
3. Run the 30-minute real-device test: [`docs/TESTING.md`](docs/TESTING.md) §4.

## Docs

| Doc | For |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Architecture and decisions |
| [`docs/STRATEGY.md`](docs/STRATEGY.md) | 30-day acquisition plan: segments, objections, channels, pricing, funnel math |
| [`docs/MARKETING.md`](docs/MARKETING.md) | Reels scripts, Telegram posts, ad copy RU/KZ, retargeting, launch calendar, UGC, link conventions |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Team runbook: cards, buttons, commands, automatic follow-ups |
| [`docs/EXPERIMENTS.md`](docs/EXPERIMENTS.md) | Prioritised experiment backlog (ICE) |
| [`docs/TESTING.md`](docs/TESTING.md) | What was tested, what wasn't, pre-launch checklist |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Hosting, Telegram setup, analytics, backups, env vars |
| [`docs/LAUNCH-CHECKLIST.md`](docs/LAUNCH-CHECKLIST.md) | Facts, evidence, setup, legal |

## Commands

| Command | |
|---|---|
| `npm run dev` | Dev server with reload |
| `npm test` | Unit, API and bot tests (fake Telegram API) |
| `npm run typecheck` | TypeScript |
| `npm run build` / `npm start` | Bundle to `dist/index.js` / run it |
| `npm run check:placeholders` | Fails while any course fact is missing |
| `docker compose up -d --build` | Production (app + Caddy HTTPS) |
