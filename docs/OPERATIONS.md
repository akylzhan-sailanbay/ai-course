# Team runbook: running the funnel day to day

Everything happens in the **team Telegram chat** (cards from the bot) plus a weekly look at `/admin`.
Working hours promised to students: **10:00–21:00 KZ time** (`course.payments.workingHours`).

## Cards you will see in the team chat

| Card | What happened | What to do |
|---|---|---|
| 🆕 **Лид #N с сайта** | Name + phone left on the site | If they don't open the bot within ~1 hour, message them on WhatsApp (button on the card) |
| 📝 **Анкета #N: 🔥 горячий** | Passed the quiz, wants the next cohort, can attend | **Within 15 minutes:** short voice message from the instructor in Telegram or WhatsApp |
| 📝 **Анкета #N: 🌤 / ❄️** | Waitlist / just looking | Nothing urgent; they get the waitlist message and broadcasts |
| 💳 **#N ждёт счёт Kaspi на +7 …** | Student chose "Kaspi — счёт на мой номер" | In **Kaspi Pay** issue an invoice for the course price to that number → press **🧾 Счёт выставлен** (the student gets payment instructions) |
| 💳 **#N открыл оплату (карта / Kaspi-ссылка)** | Student opened a payment link | Wait for their "I paid" |
| 💰 **#N говорит, что оплатил** | Student pressed "Я оплатил(а)" | Check Kaspi Pay / the provider dashboard → **✅ Оплата есть** or **❌ Не нашли** (asks for a receipt) |
| ⏰ **#N ждёт счёт Kaspi дольше 30 мин** | The invoice promise was missed | Issue it now and press 🧾 |
| 💬 **Вопрос от #N** | Any free-text message to the bot | **Reply to that message** (swipe → reply) — the bot forwards your answer. Text, photos and voice all work. |
| ⚠️ … оплатил, но не открыл бота | Paid (e.g. `/paid`) but has no Telegram link | Send them the bot link from the card via WhatsApp |
| ⚠️ … вошёл в чат потока без оплаты | Someone joined the cohort chat without a recorded payment | Check; remove if needed |

**✅ Оплата есть / ✅ Оплачено** is the only way a seat is taken. It immediately:
records the payment and amount (current price, including the early-bird if active) → sends the student a
**one-time invite** to the cohort chat → onboarding checklist → asks for their Demo Day project idea →
schedules Zoom reminders one hour before each class → a day later, sends their referral link (if configured).

## Commands (team chat or a private chat with the bot, admins only)

| Command | Use |
|---|---|
| `/stats` | Funnel for 7 days / all time, top channels for 30 days, seats taken |
| `/lead 12` · `/lead 7011234567` · `/lead @username` | Find a lead's card |
| `/paid 12` · `/paid 12 149000` | Record a payment made outside the flow (cash, transfer, company invoice) and onboard |
| `/spend instagram 50000` · `/spend tg-channelname 15000 2026-10-01 пост` | Log ad spend so `/admin` shows CAC and ROAS |
| `/seats` | Seats taken out of capacity |
| `/export` | All leads as CSV (Excel-safe) |
| `/broadcast` | **Private chat only.** Choose a segment → send any message → confirm. Segments: students, hot-unpaid, waitlist, everyone unpaid. |
| `/chatid` | Shows chat/user ids (for setup) |
| `/admin` | This list |

## Rules of thumb

- **Speed-to-lead:** hot leads answered within 15 minutes in working hours convert far better than next-day replies.
  The cards are designed to be actionable in one tap.
- **Broadcasts:** at most 1–2 a week to non-students; always useful content or real news (dates, seats, open
  lesson). Never fake urgency. People can `/stop`; the bot respects it automatically.
- **Mark junk:** press ✖️ **Не целевой** so it stops getting reminders and stays out of follow-ups.
- **Offline payments:** always `/paid <id>` so seats, revenue and CAC stay correct. Seats sold completely outside the
  system go into `course.cohort.seatsSoldOffline`.
- **Kazakh-speaking students:** the bot already speaks Kazakh to them; reply in Kazakh when you can.

## Automatic follow-ups (no action needed)

| When | Who | Message |
|---|---|---|
| 2 h after an unfinished quiz in the bot | Started quiz, didn't finish | "Осталось пару вопросов" |
| 24 h after qualifying | Hot, hasn't opened payment | Seats still available + FAQ + "ask a question" |
| 72 h after qualifying | Same, cohort not started, seats left | Start date + real seats left |
| 24 h after the invoice | Invoice sent, unpaid | Reminder + help button |
| 24 h after payment | Paid, not in the cohort chat | Fresh one-time invite |
| 24 h after payment | Paid | Referral link (if rewards are configured) |
| 1 h before each class | Paid students | Session title + Zoom link |

Nudges go out only 10:00–21:00 and never to people who sent `/stop`, blocked the bot or were marked ✖️.

## Weekly review (30 minutes)

1. `/admin` → **Каналы**: cost per paid student (CAC) and ROAS per source. Apply the decision rules in
   `docs/STRATEGY.md` §1.
2. **Сегменты**: which roles convert. Shift content and ads toward them.
3. Read every 💬 question from the week and add recurring ones to the FAQ (`src/content/*.ts`).
4. Pick the next experiment from `docs/EXPERIMENTS.md`.
