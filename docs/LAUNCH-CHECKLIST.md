# Launch checklist

`npm run check:placeholders` lists every missing fact and exits with an error until all are filled. `/admin`
shows the same list plus integration status. Missing facts are highlighted in red on the site so they can't
ship unnoticed.

## 1. Facts only you can provide (`src/config/course.ts`)

| Fact | Why it matters for conversion |
|---|---|
| **Start date** `cohort.startDate` | Shown in the hero, pricing and bot; drives Zoom reminders and the "last call" |
| **Class days** `cohort.weekdays` | Currently *assumed* Mon/Wed/Fri. The brief only says "3 per week". Confirm. |
| **Price** `price.amount` (+ optional `earlyBird` with a real date and reason) | See `docs/STRATEGY.md` §2 for the recommendation |
| **Installments** `price.installments` | Only if your Kaspi merchant terms allow it |
| **Lesson language** `lessonLanguage` | Kazakh-page visitors will ask; answer honestly |
| **Tool costs** `toolCosts` (+ `tools` list) | Disclose upfront; it pre-empts a top objection |
| **Instructor** name, role, 3 verifiable facts with links, photo | Credibility is the #1 trust lever for a new course. Use facts you can prove. |
| **Proof video** `proofVideoUrl` | Record yourself building and publishing a site from zero in ≤ 60 min. The single most important asset. |
| **Contacts**: WhatsApp, phone, Telegram channel, Instagram, email | WhatsApp fallback for people who don't use Telegram |
| **Legal**: ИП/ТОО name, ИИН/БИН, address | Required in the public offer and privacy policy |
| **Referral rewards** `referral.friendBonus` / `referrerBonus` | Keep them simple and real; the bot announces them to students |

## 2. Evidence to collect (proof, never invented)

- [ ] The 60-minute build video (screen + face, unedited mistakes are fine; they build trust).
- [ ] 3 links to things the instructor built and launched.
- [ ] Screenshots of the 4 course projects working (your own reference implementations).
- [ ] After cohort 1: Demo Day recordings, testimonials with the original message/video link (`course.testimonials`
      requires `sourceUrl`), and written consent to publish.

## 3. Setup

- [ ] Domain + KZ VPS (`docs/DEPLOY.md` §0, §2)
- [ ] Bot created; `BOT_TOKEN`; description and avatar set in @BotFather
- [ ] Team chat → `ADMIN_CHAT_ID`; admins → `ADMIN_IDS` (use `/chatid`)
- [ ] Private cohort chat with the bot as admin (invite permission) → `COHORT_CHAT_ID`
- [ ] `ZOOM_URL` (recurring meeting)
- [ ] `ADMIN_PASSWORD` (12+ chars)
- [ ] Meta Pixel (+ custom conversion `QualifiedLead`); optional PostHog / Yandex Metrica
- [ ] Kaspi Pay merchant account ready to issue invoices; optional `KASPI_PAY_URL` / `PAYMENT_LINK_URL`
- [ ] Offsite backup cron (`docs/DEPLOY.md` §5)

## 4. Legal and compliance (have a lawyer review)

- [ ] Public offer (`/offer`): refund terms, guarantee terms, your requisites
- [ ] Privacy policy (`/privacy`): hosting location in KZ, retention, third parties
- [ ] Consent to record sessions and use student projects/clips in marketing
- [ ] Kazakh texts proofread by a native speaker (site, bot, legal pages)

## 5. Final end-to-end test with real accounts (`docs/TESTING.md` §4)

- [ ] Phone (iOS + Android): form → quiz → "Open Telegram" → bot shows the offer
- [ ] Kaspi: request invoice → issue a real invoice → pay → "Я оплатил(а)" → "✅ Оплата есть" → one-time invite works → join is detected
- [ ] A team reply to a 💬 question reaches the student
- [ ] `/stats` and `/admin` show the test lead with the right source; then delete the test leads or mark them ✖️
