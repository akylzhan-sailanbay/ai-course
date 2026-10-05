# Prioritised experiment backlog

Scored **ICE** (Impact × Confidence × Ease, each 1–5). Run one or two at a time and judge them in `/admin` by
*qualified leads* and *payments*, not clicks. "Build" means a code change; the rest are operational.

| # | Experiment | Hypothesis | Metric | I | C | E | ICE | Type |
|---|---|---|---|---|---|---|---|---|
| 1 | **Instructor voice message to every hot lead within 15 min** | Personal contact raises hot → paid for a pilot | Hot → paid % | 5 | 4 | 5 | 100 | Ops |
| 2 | **Free live open lesson "Сайт за 60 минут"** with bot registration and reminders | Seeing the promise kept live converts cold traffic better than the landing alone | Registrants → hot → paid | 5 | 4 | 4 | 80 | Ops now; build `ol_*` registration + 24h/1h reminders in the bot (≈ 0.5 day, the reminder engine already exists) |
| 3 | **Optimise Meta ads for `QualifiedLead` vs `Lead`** | Optimising on quality lowers CAC even if CPL rises | CAC per paid | 4 | 4 | 4 | 64 | Ads |
| 4 | **Hero proof video on vs off** (once recorded) | The 60-minute video lifts visit → lead | Visit → lead % | 4 | 4 | 4 | 64 | Content |
| 5 | **Bot-first ads (click-to-Telegram) vs landing-first** | People already in Telegram skip the form friction | Cost per hot lead | 4 | 3 | 5 | 60 | Ads |
| 6 | **Pilot price with deadline vs flat price** | A real dated pilot price speeds decisions | Time-to-pay, hot → paid | 4 | 3 | 5 | 60 | Config |
| 7 | **Kaspi installments** (if the merchant agreement allows) | Monthly payments remove the price objection | Payment requests / hot | 5 | 3 | 3 | 45 | Ops + config |
| 8 | **Kazakh-language creatives vs Russian** for the same angle | KZ content is less saturated, so cheaper reach | CPM, cost per hot lead | 3 | 3 | 4 | 36 | Ads |
| 9 | **"Приходите вдвоём" pair discount** | Pairs lower the perceived risk; one buyer recruits another | Paid seats per hot lead | 3 | 3 | 4 | 36 | Config |
| 10 | **Automatic card payment confirmation** (provider webhook → `confirmPayment`) | Instant onboarding raises paid → joined and removes manual work | Time to onboard, team hours | 3 | 4 | 3 | 36 | Build (≈ 1 day once the provider is chosen; one call into `confirmPayment()`) |
| 11 | **First-lesson money-back promise** ("не понравилось первое занятие — вернём деньги") | A stronger risk reversal than the guarantee alone | Hot → paid | 4 | 3 | 3 | 36 | Policy (check cost and legal first) |
| 12 | **Company invoice option on the pricing card** | Employers pay for managers' training | Share of company-paid seats | 3 | 3 | 4 | 36 | Copy |
| 13 | **Alternative hero hooks** (see below) | The hook drives most of visit → lead | Visit → lead % | 4 | 2 | 4 | 32 | Copy (run as ads first: cheaper than a site A/B test at low traffic) |
| 14 | **Exit-intent / scroll-depth sticky "Задать вопрос в Telegram"** | Captures hesitant visitors as conversations | Bot starts per visit | 2 | 3 | 4 | 24 | Build (small) |
| 15 | **Server-side Meta Conversions API** for Lead/Purchase | Better attribution through iOS/ad blockers; enables a Purchase audience for exclusion | Match rate, CPA stability | 3 | 3 | 2 | 18 | Build |

**Low traffic warning:** with a few hundred visitors a month, on-site A/B tests won't reach significance. Test
messages as **ads** (Meta splits traffic and reports cost per result), then put the winner on the site.

## Alternative hooks to test as ads

1. «Первый сайт — за 60 минут. Свой продукт — за 4 недели.» *(current)*
2. «Час назад вы не писали код. Теперь ваш сайт в интернете.»
3. «Сайт, запись клиентов и Telegram-бот — соберите сами, с ИИ.»
4. «Не просто вайбкодинг: собираете с ИИ и безопасно запускаете в реальный мир.»

## Product ideas after cohort 1

- Advanced course: payments, AI agents, integrations (Kaspi, 1C, CRM).
- Corporate format for teams (a manager plus 5–10 employees automating their own processes).
- Alumni project showcase page with live links (social proof for every future cohort).
