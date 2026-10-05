# Testing: what was verified, what wasn't, and the pre-launch checklist

Run everything: `npm run typecheck && npm test && npm run build`.

## 1. Automated tests: 52 passing (`npm test`, ~0.3 s)

| Area | What the tests prove |
|---|---|
| Phone | All common KZ formats normalise to `+7XXXXXXXXXX`; junk, short numbers, repeated digits and other countries without a `+` are rejected |
| Qualification | hot / warm / cold rules and scores |
| Attribution | Bot payloads `s_<source>__<campaign>`; malicious payloads ignored |
| Time | KZ UTC+5 conversion; 12 sessions on Mon/Wed/Fri with Demo Day last; working hours; RU/KZ weekday names |
| Typography | Non-breaking spaces applied to text only, never inside tags or scripts (regression test for a real bug found in QA) |
| Pages | RU and KZ render with `lang`, hreflang, form and pricing; security headers + CSP; legal pages, robots, sitemap, health; immutable caching for versioned assets; ETag/304 |
| **Secrets** | Bot token, admin password, Zoom link and payment link never appear in public HTML |
| Lead API | Stores the normalised phone + first-touch UTM; returns the bot deep link; same-browser resubmits update rather than duplicate; field-level errors; honeypot and too-fast bots silently dropped; other origins blocked (403); oversized bodies (413); rate limit (429) |
| Application API | Qualifies and stamps `applied_at` / `qualified_at`; unknown tokens 404; invalid answers 400 |
| Events API | Allow-listed events stored with first-touch source; unknown events ignored |
| Admin web | 401 without/with a wrong password; disabled with no password; strict CSP; CSV neutralises formula injection; user input escaped |
| Bot entry | A deep link binds the web application to the Telegram user; **a token can't be hijacked by a second user**; bot-first + web leads merge into one person (earliest attribution kept); site visitors arriving via `w_<id>` inherit their ad attribution; referrals recorded |
| Bot quiz | 4-tap quiz → warm → "want next cohort" upgrade → offer; forged callback values ignored |
| **Payment flow** | Phone request; **someone else's contact card refused**; Kaspi request → team card with buttons; **students can't press admin buttons**; invoice → claim → confirm → one-time invite link (member limit 1) → onboarding → project idea saved → cohort-chat join detected; confirming twice is a no-op; card link substitutes `{lead}` |
| Support relay | Free-text question copied to the team chat; an admin's reply reaches the student; **replies from non-admins are not relayed** |
| Admin commands | Only admins get `/stats`; `/spend` records ad spend; `/paid` records manual payment and alerts when the student isn't in Telegram |
| Reminders | Pay nudge after 24 h exactly once, never at night, never after `/stop`; **Zoom link 1 h before class only to paid students** |

## 2. Manual QA done in a real browser (Chromium via Playwright)

- **Desktop 1366 px and mobile 390 px**, both RU and KZ pages, full scroll. Fixed during QA: headline breaking before
  the dash, the time range breaking at the en dash, a `<figure>` default margin widening the mobile grid, uneven
  spacing in the security grid, the footer logo invisible on dark, a duplicate week label, and the KZ hero mock
  showing a Russian word. No horizontal overflow at 390 px (`scrollWidth = clientWidth`).
- **Kazakh glyphs:** the first display font (Unbounded) lacked Ә Ғ Қ Ң Ө Ұ Ү Һ, so it was replaced with Geologica
  after checking glyph coverage of five candidates programmatically.
- **Form end to end:** empty and short-phone validation messages → valid `8 (701) 234-56-78` → quiz (4 taps) →
  hot success state. DB check: phone `+77012345678`, `utm_source=instagram / cpc / launch_test` on the lead and on
  every funnel event; 0 console errors.
- **Analytics under CSP:** with dummy IDs for Meta, TikTok, Yandex Metrica, GA4 and PostHog, every vendor script
  loaded and sent its PageView; **no CSP violations**. The only errors came from the dummy IDs being rejected.
- **Performance:** first load ≈ 70 KB over the wire (HTML 11 KB, CSS 6 KB, JS 4.5 KB gzip, fonts ~48 KB with
  unicode-range so only the needed subsets load). Landing HTML is cached in memory for 60 s with ETags.
  `prefers-reduced-motion` disables the hero animation.
- **Production bundle:** `npm run build` → `node dist/index.js` serves `/` and `/kz` (200).

## 3. Not verified here (needs your accounts or infrastructure)

| Item | Why not | How to verify |
|---|---|---|
| Real Telegram API | No bot token in this environment; the bot was tested against a recorded fake API | §4 below, step 2–6 |
| Kaspi invoice and payment | Requires your Kaspi Pay merchant account | §4 step 4 |
| Docker image build | Docker daemon wasn't running on this machine | `docker compose build` on the server; `/healthz` |
| Real phones (Safari iOS, Android Chrome) | Emulated 390 px only | §4 step 1 |
| Lighthouse / Core Web Vitals | Not run | PageSpeed Insights after deploy |
| Kazakh copy quality | Written by AI, not proofread | Native speaker review |

## 4. Pre-launch manual test (≈ 30 minutes, after deploy)

1. **Phone, iOS and Android:** open the site from an Instagram DM link (in-app browser!) → form → quiz → "Открыть
   Telegram" opens the bot with the offer. Repeat on `/kz`.
2. **Bot-first:** a new Telegram account → `/start` → menu → Программа / Цена / Вопросы → "Записаться" → quiz.
3. **Questions:** send the bot a free-text question → it appears in the team chat → reply to it → the student receives it.
4. **Kaspi:** choose "Kaspi — счёт на мой номер" → share contact → confirm → the team card arrives → issue a real
   invoice in Kaspi Pay → "🧾 Счёт выставлен" → pay → "Я оплатил(а)" → "✅ Оплата есть".
5. **Onboarding:** the one-time invite opens the cohort chat; a second person can't use the same link; `/admin`
   shows "в чате потока".
6. **Reminders:** temporarily set `cohort.startDate` to tomorrow and check the session reminder arrives one hour
   before 19:30; then restore it.
7. **Analytics:** Meta Events Manager → Test Events shows PageView, Lead, CompleteRegistration, QualifiedLead.
8. Mark all test leads ✖️ or delete `data/app.db` before launch if you used production.
