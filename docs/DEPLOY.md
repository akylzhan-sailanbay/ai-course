# Deployment and configuration

One Docker container (site + API + bot + scheduler + SQLite) behind Caddy, which handles HTTPS automatically.
Expected cost: a small VPS (1 vCPU, 1–2 GB RAM) plus a domain.

## 0. Where to host: read this first

Kazakhstan's personal-data law requires databases holding Kazakhstani citizens' personal data to be kept on the
territory of Kazakhstan. Leads (names, phones) count. **Recommended: a VPS from a Kazakhstani provider** (for
example ps.kz, hoster.kz or QazCloud; compare current prices yourself). If you use a `.kz` domain, also check
your registrar's hosting rules for `.kz` sites. This is not legal advice; confirm with a lawyer.

Hosting abroad (Railway, Fly.io, Hetzner…) works technically. See §7. Decide with the localisation risk in mind.

## 1. Telegram setup (15 minutes)

1. **Create the bot:** open @BotFather → `/newbot` → name «Собери с ИИ» → username (e.g. `soberi_ai_bot`). Copy the
   token into `BOT_TOKEN`. In @BotFather also set `/setdescription`, `/setabouttext` and `/setuserpic` (use
   `public/img/favicon.svg` exported to PNG, or a photo of the instructor).
2. **Team chat** (where leads, payment requests and questions arrive): create a Telegram group, add the bot and
   all team members. Send `/chatid` in the group; the bot replies with the chat id (starts with `-100`) →
   `ADMIN_CHAT_ID`.
3. **Admins:** every admin opens the bot privately and sends `/chatid` → put the "your user id" values into
   `ADMIN_IDS` (comma-separated). Only these accounts can press payment buttons or run `/stats`, `/paid`,
   `/broadcast`.
4. **Cohort chat:** create a *private* group for students, add the bot as **administrator with "Invite users via
   link"** permission, send `/chatid` there → `COHORT_CHAT_ID`. The bot then gives each paid student a one-time
   invite link and notices when they join.
5. **Zoom:** put the recurring meeting link into `ZOOM_URL`. It is only ever sent to paid students, one hour before
   each class.

Keep the bot's privacy mode **on** (the default). Replies to the bot's messages still reach it, and that's all the team
chat needs.

## 2. Server setup (Ubuntu 24.04)

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Code (copy the project folder, or git clone your repository)
cd /opt && git clone <your-repo> soberi && cd soberi

# Configuration
cp .env.example .env
nano .env            # fill DOMAIN, PUBLIC_URL, BOT_TOKEN, ADMIN_CHAT_ID, ADMIN_IDS, ADMIN_PASSWORD, …

# DNS: create an A record for DOMAIN (and www) pointing to the server's IP, then:
docker compose up -d --build
docker compose logs -f app       # expect "http listening" and "bot polling started"
```

Check:
- `https://<domain>/healthz` → `{"ok":true,"bot":true}`
- `https://<domain>/admin` → asks for a password (any username + `ADMIN_PASSWORD`); the "Готовность к запуску"
  block lists every remaining TODO and integration
- In Telegram: `/start` to the bot, then submit the site form and check the card arrives in the team chat.

**Update after changing code or course facts:** `git pull && docker compose up -d --build` (about 30 s of downtime).

## 3. Course facts and copy

- Facts (price, dates, instructor, contacts, legal details): `src/config/course.ts`
- Copy (RU / KZ): `src/content/ru.ts`, `src/content/kk.ts`
- Check what is still missing: `npm run check:placeholders` (exits with an error while anything is missing)
- Photo: put `public/img/instructor.jpg` (square, ≥ 520 px) and set `instructor.photo: '/assets/img/instructor.jpg'`
- Proof video: upload to YouTube (unlisted is fine) and set `proofVideoUrl`; it embeds via youtube-nocookie.

## 4. Analytics

All optional and independent; the first-party funnel in `/admin` works without any of them.

| Tool | Why | Setup |
|---|---|---|
| **Meta Pixel** | Instagram ads optimisation and retargeting | Events Manager → create pixel → `META_PIXEL_ID`. Create a **custom conversion** from the custom event `QualifiedLead` and optimise ads for it once it fires ~50×/week. |
| **TikTok Pixel** | Only if you run TikTok ads | `TIKTOK_PIXEL_ID` |
| **PostHog** | Funnels across site + bot (server events share the browser id), session replay | Create an EU-cloud project → `POSTHOG_KEY` |
| **Yandex Metrica** | Webvisor (session recordings), popular with CIS marketers | Create a counter → `YANDEX_METRICA_ID`; add JavaScript-event goals: `lead`, `application`, `qualified`, `telegram` |
| **GA4** | Only if you use Google Ads | `GA4_ID` |

The CSP allows exactly these vendors' script hosts. If you add another vendor, add its host in `src/web/csp.ts`.

## 5. Backups

The app writes a consistent SQLite snapshot every day after 04:00 KZ time to `/data/backups` (14 kept), on the same
volume. **Also copy it off the server**, e.g. a nightly cron on the host:

```bash
0 5 * * * cd /opt/soberi && docker compose cp app:/data/backups ./backups-copy && rclone sync ./backups-copy remote:soberi-backups
```

Restore: stop the app, copy a snapshot to `/data/app.db` (and delete `app.db-wal`, `app.db-shm`), start.

## 6. Telegram webhook (optional)

Polling (the default) needs no extra setup and is reliable for this traffic. To use webhooks instead: set
`BOT_MODE=webhook` and `TELEGRAM_WEBHOOK_SECRET` (`openssl rand -hex 24`); the app registers
`https://<domain>/telegram/webhook` on start and verifies Telegram's secret header on every call.

## 7. Alternative: Railway / Render / Fly.io (fastest, but data stored abroad)

1. New service from this repository (it detects the `Dockerfile`).
2. Add a persistent volume mounted at `/data`.
3. Set the environment variables from the table below (`PUBLIC_URL` = the service's https URL or your domain;
   `TRUST_PROXY=1`).
4. Keep `BOT_MODE=polling` and run exactly **one** instance: SQLite and polling both assume a single process.

## 8. Environment variables

| Variable | Required | Secret | Purpose |
|---|---|---|---|
| `PUBLIC_URL` | yes | no | Public https URL; used for links, canonical URLs, the CSRF origin check. Must be https in production. |
| `DOMAIN` | compose | no | Domain for Caddy's certificate |
| `NODE_ENV` | yes | no | `production` enables HSTS and strict config checks |
| `PORT` | no | no | Default 3000 |
| `DATABASE_PATH` | no | no | SQLite file; `/data/app.db` in Docker |
| `BACKUP_DIR` | no | no | Default: `backups/` next to the database |
| `TRUST_PROXY` | behind a proxy | no | `1` = take the client IP from `X-Forwarded-For` (rate limiting) |
| `BOT_TOKEN` | for the bot | **yes** | From @BotFather. Without it the site works and the bot is off. |
| `BOT_USERNAME` | no | no | Overrides the username read from Telegram |
| `BOT_MODE` | no | no | `polling` (default) or `webhook` |
| `TELEGRAM_WEBHOOK_SECRET` | webhook | **yes** | 24+ chars; verifies webhook calls |
| `ADMIN_CHAT_ID` | yes | no | Team chat for leads, payments, questions |
| `ADMIN_IDS` | yes | no | Comma-separated Telegram user ids with admin rights |
| `COHORT_CHAT_ID` | recommended | no | Private student group; the bot must be an admin |
| `COHORT_INVITE_URL` | fallback | semi | Shared invite link if the bot can't create one-time links |
| `ZOOM_URL` | recommended | semi | Sent only to paid students |
| `KASPI_PAY_URL` | no | no | Kaspi QR/payment link, shown as an extra button |
| `PAYMENT_LINK_URL` | no | no | Card payment link; `{lead}` and `{amount}` are substituted |
| `ADMIN_PASSWORD` | for `/admin` | **yes** | 12+ chars; empty disables `/admin` |
| `POSTHOG_KEY`, `POSTHOG_HOST` | no | public | PostHog project key and host |
| `META_PIXEL_ID`, `TIKTOK_PIXEL_ID`, `YANDEX_METRICA_ID`, `GA4_ID` | no | public | Ad and analytics IDs (public by design) |

Secrets live only in `.env` on the server. Nothing marked secret is ever rendered into a page; a test checks this.
