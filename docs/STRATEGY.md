# 30-day acquisition strategy, Kazakhstan

**Goal:** 15–20 paid seats in cohort 1. Get there with the lowest CAC, and collect the proof (video, Demo Day
projects, testimonials) that makes cohort 2 cheaper to fill.
**We optimise:** qualified leads → applications → payments. Clicks and followers are not the target.

> **Where numbers come from.** Figures marked *assumption* are planning guesses that should be replaced with your
> own data after week 1. Market prices are linked to their source. Nothing here is a benchmark.

---

## TL;DR

1. **Proof first.** Before any ad money, record yourself building and publishing a site from zero in 60 minutes
   (screen + face). That one video is the hero proof, the best ad, the best Reel and the open-lesson trailer.
2. **Warm network, then a free live demo.** Use your own network and a free 60-minute live "build a site with me"
   session. It sells the course by doing the course's first promise in front of people.
3. **Run paid ads on Instagram (Meta) only after the landing page converts warm traffic.** Optimise ads for the custom
   `QualifiedLead` event, not raw leads, so the algorithm looks for payers.
4. **Answer hot leads within 15 minutes, with a personal voice message from the instructor.** For a pilot cohort,
   high-touch follow-up beats any automation.
5. **Use only real urgency:** 20 seats (the counter is real), a dated pilot price, and the start date.
6. **Build retention in from day 1:** capture the first-hour "wow" on video (with consent), make Demo Day shareable,
   and activate referrals once a student has seen value.

---

## 1. Funnel math and the CAC ceiling

Planning targets (*assumptions*; the dashboard shows the real values from day 1):

| Step | Conversion (*assumption*) | For 18 seats |
|---|---|---|
| Landing visit → lead (name + phone) | 3–6% (warm traffic higher, cold ads lower) | 2,500–6,000 visits |
| Lead → hot (qualified by the quiz) | 35–50% | 120–200 leads |
| Hot → paid (with fast human follow-up) | 25–35% | 55–70 hot leads |

**CAC ceiling:** max CAC = price − variable cost per student (assistant hours, tools, payment fees) − the margin
you want to keep. Example only: at a 169,000 ₸ pilot price and roughly 30,000 ₸ variable cost per student, any
channel below about 40,000–60,000 ₸ per *paid* student is clearly profitable, even before referrals. Log ad spend
with `/spend` in the bot; `/admin` shows CAC and ROAS per channel.

**Decision rules (weekly):**
- A channel with ≥ 20 leads and 0 hot leads is the wrong audience or angle: change targeting or the message.
- An ad set whose cost per *qualified* lead is above ⅓ of the CAC ceiling after 2–3 days of spend should be paused.
- If hot → paid is below 15%, fix follow-up before buying more traffic (speed, voice messages, objections).

## 2. Pricing (to decide before launch)

What KZ buyers already see (listings found Oct 2026; verify before deciding):
- AI courses in Kazakhstan range from about **100,700 ₸** (1.5-month AI-design course with a 50% discount) to **416,844 ₸**
  (GeekBrains «Нейросети для бизнеса»), almost always with monthly installments
  ([spbsot.kz](https://almaty.spbsot.kz/designschool/kursy-nejrosetej), [geekbrains.kz](https://geekbrains.kz/neuropredator/ai-integration-specialist/),
  [digitalbusiness.kz overview](https://digitalbusiness.kz/2026-03-13/v-kazahstane-rastet-spros-na-obuchenie-ii-vot-kakie-kursi-uzhe-dostupni/)).
- Russian-market vibe-coding courses: from about 41,700 ₽ (Netology) to 146,000 ₽ (ZeroCoder)
  ([klerk.ru roundup](https://www.klerk.ru/blogs/gdekurs/683223/)).

**Recommendation:**
* **Position as a premium live intensive, not a recorded course.** You offer 24 live hours, 20 seats, 1 assistant per
  10, homework review and a launch guarantee. The cheap end of the market is recorded content; don't compete there.
* **Pilot price for cohort 1, with an honest reason.** «Цена первого потока»: you are collecting feedback and
  showcases. Set a real end date (`course.price.earlyBird`). The working range I'd test is 149,000–199,000 ₸, then
  raise it for cohort 2 once Demo Day proof exists. *(This is my recommendation, not market data.)*
* **Installments.** Competitors advertise monthly payments, and Kaspi рассрочка is the norm in KZ. Check whether
  your Kaspi Pay merchant terms allow installments for education services. If they do, fill in
  `course.price.installments`; it's one of the strongest conversion levers available.
* **Company invoice.** Offer "оплата от ТОО/ИП по счёту" for managers whose employer pays. It's an easy objection
  handler and a later B2B channel.

## 3. Segments, ranked by how quickly they're likely to pay

| # | Segment | Strongest pain | Desired outcome | Main objections | Where they are |
|---|---|---|---|---|---|
| 1 | **Small-business owners**: salons, clinics, cafés, tutors, Instagram shops, repair, fitness | Leads and bookings handled by hand in WhatsApp/notebooks; developers are slow and expensive | Their own site + booking + Telegram bot, under their control | "I'm not technical", "no time", "will it really work for my business" | Instagram (business accounts), local business Telegram chats, 2GIS, communities, coworkings |
| 2 | **Freelancers / SMM / designers / marketers** | Clients ask for a site or bot and they have to turn the work away | Add sites, bots and automations to their services | "Is it professional-grade?", "can I charge for this?" (no income promises) | Instagram, Telegram channels for freelancers/marketers, Threads |
| 3 | **Office professionals and managers**: ops, sales, HR, analysts | Repetitive work in spreadsheets, waiting on IT | Automate their own work; show results; AI skills on the CV | "No time on weekdays" (sessions are evenings), "will my employer pay?" | LinkedIn, Telegram, corporate communities |
| 4 | **People with an idea** | Can't test the idea without a developer | A working MVP to show investors/customers | "Is 4 weeks enough?" | Telegram startup chats, Astana Hub / startup events |

**Do not target:** teenagers/students (low budget, schedule conflicts) or career switchers expecting a developer
job in 4 weeks (wrong expectation; refund and review risk). The landing's "Не подойдёт" block filters them out on
purpose.

## 4. Objections → where they're answered

| Objection | Answer | Where |
|---|---|---|
| "I've never coded" | Built for exactly that; the first lesson ends with a live site; assistants in breakout rooms | Hero, first-hour section, FAQ 1 |
| "Why pay when YouTube and ChatGPT exist?" | People get stuck on the first error and on deployment; live help + review + guarantee | Comparison table, FAQ 6 |
| "Is this another infobiz scam?" | No income claims, no invented reviews, a "not for you" list, real instructor credentials, an honest pilot note | Audience, proof section, instructor |
| "No time" | 3 evenings × 2h, one time zone for the whole country, recordings | Format, FAQ 3–4 |
| "Too expensive" | Value list, guarantee, installments/company invoice, pilot price | Pricing, FAQ 9 |
| "Will I really launch?" | Launch guarantee with clear terms; Demo Day | Guarantee |
| "Is it in Kazakh?" | Answer explicitly (fill `lessonLanguage`) | FAQ 8, the whole KZ page |
| "My laptop is old / I only have a phone" | Any laptop with a browser; phone won't work | FAQ 2, "not for" list |
| "Hidden tool costs?" | Disclose upfront (fill `toolCosts`) | FAQ 5 |

## 5. Channels, prioritised by speed, cost and conversion

| Priority | Channel | Speed | Cost | Conversion | First action | Track with |
|---|---|---|---|---|---|---|
| 1 | **Founder's warm network** (personal Instagram, Telegram, WhatsApp statuses, former colleagues, business friends) | Days | Free | Highest | Personal post + the 60-min video + DMs to 50 people who fit segments 1–3 | `?utm_source=personal&utm_medium=dm` |
| 2 | **Free live open lesson** "Сайт за 60 минут — вживую" (Zoom, weekday 19:30) | 1–2 weeks | Free–low | High (demonstrates the promise) | Announce in all channels with the bot link `t.me/<bot>?start=s_openlesson`; send the Zoom link with `/broadcast`; pitch the cohort at the end | Source `openlesson` in `/admin` |
| 3 | **Instagram Reels + Telegram channel** (organic, build-in-public) | 2–4 weeks | Time | Medium, compounding | 3 Reels/week from `docs/MARKETING.md` | `utm_source=instagram&utm_medium=bio` |
| 4 | **Meta ads (Instagram)**: Almaty, Astana, Shymkent + other oblast centres, 25–40, interests: entrepreneurship, small business, ChatGPT/AI, freelancing | Days | Paid | Medium; scalable | 3 angles × 2 audiences; optimise for `QualifiedLead` | Pixel + `utm_source=instagram&utm_medium=cpc&utm_campaign=…` |
| 5 | **Paid posts in KZ Telegram channels and chats** (business, marketing, freelancing, city channels) | Days | Paid per post | Medium–high when the niche fits | Shortlist 10 channels and buy 3 test posts with unique bot links | `s_tg-<channel>` payloads |
| 6 | **Partnerships**: coworkings, business associations, women-in-business communities, accelerators | 2–4 weeks | Low (affiliate % or free seat) | High (trust transfer) | Offer a free open lesson for their members | `utm_source=partner-<name>` |
| 7 | **Retargeting** (site visitors and video viewers who didn't apply) | Starts once the pixel has an audience | Low | High per lead | 2 creatives: proof video + guarantee | Meta custom audiences |
| 8 | **Google/Yandex search** ("курс вайбкодинга", "научиться делать сайты с нуля") | Days | Paid | Medium; low volume | Small test after week 2 | `utm_medium=cpc` |
| 9 | **TikTok** | Weeks | Time/paid | Unproven for 25–40 payers | Repurpose Reels; ads only if organic shows signal | TikTok pixel |

Language: run RU and KZ creatives as separate ad sets; the KZ page (`/kz`) and bot language follow automatically.
Kazakh-language AI education content is still rare, so KZ creatives may get cheaper reach. That's an *assumption*
to test, not a fact.

## 6. The 30 days

| Days | Focus | Key outputs |
|---|---|---|
| **0–3: Setup** | Fill every TODO (`npm run check:placeholders`), deploy, connect the bot and team chat, install the pixels | Live site, bot, `/admin`; **the 60-minute build video**; 10 Reels scripted |
| **4–10: Warm + proof** | Personal posts and DMs; Telegram channel launch; announce open lesson #1; first Reels | First 30–60 leads; quiz data shows which segment responds |
| **11–17: Paid tests** | Meta ads: 3 angles × 2 audiences, modest daily budget per ad set; 3 paid Telegram posts; open lesson #1 | CPL and *qualified* CPL per angle; open-lesson show-up and conversion |
| **18–24: Scale what works** | Move budget to the top 1–2 ad sets; start retargeting; open lesson #2; partner session | Pilot price deadline (real date) |
| **25–30: Close** | Personal follow-up to every hot lead; last-call broadcast (real start date, real seats left); onboarding | Cohort full; consent forms for filming; Demo Day date published |

Daily: reply to the team chat within 15 minutes during working hours (the bot escalates a Kaspi invoice after the
promised SLA). Weekly: `/stats` review against the decision rules in §1.

## 7. Content angles (organic)

1. **The 60-minute challenge:** "Час назад здесь ничего не было" — build live, publish, show the link.
2. **Local business before/after:** WhatsApp chaos → a booking page + bot for a real local business type.
3. **Myth-busting:** "Вайбкодинг ≠ «попросил ChatGPT и готово»" — what breaks and why the course exists.
4. **Security horror story (generic, educational):** API key left in the page → someone spends your money. Show
   the fix in 30 seconds.
5. **"Не программист? Отлично":** the instructor answers real objections from the bot/FAQ.
6. **Build in public:** making the course itself (this landing page, this bot): meta and credible.
7. **Kazakh-language series:** the same demos in Kazakh, a likely underserved niche (*assumption*).

## 8. Ad angles (paid)

| Angle | Hook (RU) | Proof | CTA |
|---|---|---|---|
| Speed / wow | «Первый сайт — за 60 минут. Даже если вы никогда не писали код» | Screen recording | Записаться |
| Local pain | «Записи клиентов всё ещё в WhatsApp? Соберите свою систему записи за неделю» | Booking demo | Пройти 4 вопроса |
| Accessibility | «Не нужно учить программирование 2 года, чтобы сделать бота для бизнеса» | Bot demo | Открыть Telegram |
| Security | «ИИ пишет код быстро. Но кто проверит, что ваши ключи не утекли?» | Leaked-key example | Узнать программу |
| Risk reversal | «Не запустили проект к Demo Day — следующий поток бесплатно» | Guarantee terms | Забронировать место |

Full scripts and texts are in `docs/MARKETING.md`.

## 9. Referral mechanics

* **Students (after the first-week wow):** a personal link via `/invite`; the friend gets X and the referrer gets Y
  after the friend pays. Fill in `course.referral` with simple, real rewards (e.g. a discount for the friend and
  Kaspi cash-back for the referrer). The bot sends it automatically a day after payment and tracks invites and
  payments per referrer.
* **"Приходите вдвоём":** a pair discount for two people from the same company or family. It lowers risk for the
  hesitant.
* **Demo Day guests:** students invite 1–2 people to watch, which is the warmest audience for cohort 2.
* **Partners:** communities get a referral code (`?ref=`) and a fixed fee per paid student.

## 10. Conversion mechanisms already built

2-step form (lead saved after step 1) · tap-only qualification · instant Telegram deep link that carries the
application · bot answers price/program/FAQ 24/7 · human escalation for any free-text question · Kaspi invoice
in ≤ 30 min with an SLA alert to the team · payment-claim → one-tap confirm · one-time invite link · real seat counter ·
dated pilot price · guarantee · honest "not for you" list · RU/KZ everywhere.

**High-touch additions for cohort 1 (manual, no code):** a 30–60-second voice message from the instructor to every
hot lead; a 10-minute call for anyone hesitating; a short screen recording answering a recurring objection.

## 11. Retention and re-engagement

* **Waitlist (warm/cold):** at most 1–2 bot broadcasts a week with value (a demo, a mini-lesson), one open-lesson
  invite per cohort, and the next start date first. `/stop` is always honoured.
* **Students:** session reminders with Zoom, homework nudges in the cohort chat, Demo Day as the shared finish line.
* **Alumni:** the alumni chat, an advanced follow-up course (payments, AI agents, scaling), a showcase page of
  projects, and referral rewards.
* **Re-takers (guarantee):** they're future success stories; make sure they launch.

## 12. Risks to manage

| Risk | Mitigation |
|---|---|
| Manual Kaspi confirmation becomes a bottleneck | SLA alert in the team chat; card link for auto-payment later (`docs/EXPERIMENTS.md`) |
| Personal-data localisation (KZ law) | Host the database on a KZ VPS (see `docs/DEPLOY.md`); have a lawyer review the privacy policy |
| Over-promising | Copy avoids income and "become a developer" claims; keep it that way in ads |
| Kazakh copy quality | Native speaker proofreads before launch |
| Instructor capacity (20 students, live) | Keep the 1:10 assistant ratio; cap the cohort at 20; recordings |
| First-hour promise fails for someone | Assistants pre-check setup (onboarding checklist); a fallback "pair with assistant" breakout |
