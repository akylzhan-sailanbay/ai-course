import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { course } from '../src/config/course';
import { getLead, getLeadByTgUser, getLeadByToken } from '../src/db/leads';
import { funnel } from '../src/db/stats';
import { runReminders } from '../src/bot/reminders';
import { createWebLead, submitApplication } from '../src/services/funnel';
import { ADMIN, ADMIN_CHAT, COHORT_CHAT, makeBot } from './helpers';

async function webLead(t: ReturnType<typeof makeBot>, answers = true) {
  const { lead } = await createWebLead(t.ctx, {
    name: 'Айгерим',
    phone: '+77012345678',
    lang: 'ru',
    anonId: 'browser-anon-0001',
    attribution: { first: { source: 'instagram', medium: 'cpc' } },
  });
  if (answers) return submitApplication(t.ctx, lead, { role: 'business', goal: 'booking', schedule: 'yes', timing: 'now' });
  return lead;
}

describe('bot: entry and deep links', () => {
  it('binds a website application to the Telegram user and shows the offer', async () => {
    const t = makeBot();
    const lead = await webLead(t);
    const u = t.user(1001);
    await t.send(u, `/start a_${lead.token}`);
    const bound = getLead(t.ctx.db, lead.id)!;
    assert.equal(bound.tg_user_id, 1001);
    assert.ok(bound.tg_linked_at);
    const offer = t.sentTo(1001).at(-1)!;
    assert.match(String(offer.payload.text), /курс вам подходит/);
    assert.ok(t.buttons(offer).some((b) => b.callback_data === 'pay:ki'));
  });

  it('refuses to bind someone else’s token', async () => {
    const t = makeBot();
    const lead = await webLead(t);
    await t.send(t.user(1001), `/start a_${lead.token}`);
    await t.send(t.user(2002, 'Mallory'), `/start a_${lead.token}`);
    assert.equal(getLead(t.ctx.db, lead.id)!.tg_user_id, 1001);
    const mallory = getLeadByTgUser(t.ctx.db, 2002)!;
    assert.notEqual(mallory.id, lead.id);
    assert.equal(mallory.phone, null);
  });

  it('merges a bot-first lead with their later website application', async () => {
    const t = makeBot();
    await t.send(t.user(1001), '/start s_tiktok__video1');
    const botLead = getLeadByTgUser(t.ctx.db, 1001)!;
    assert.equal(botLead.src, 'tiktok');
    const web = await webLead(t);
    await t.send(t.user(1001), `/start a_${web.token}`);
    const merged = getLeadByTgUser(t.ctx.db, 1001)!;
    assert.equal(merged.id, botLead.id);
    assert.equal(merged.phone, '+77012345678');
    assert.equal(merged.tier, 'hot');
    assert.equal(merged.src, 'tiktok', 'earliest touch wins');
    assert.equal(getLeadByToken(t.ctx.db, web.token), undefined);
    assert.equal(funnel(t.ctx.db).leads, 1);
  });

  it('attributes site visitors who open the bot from a Telegram link', async () => {
    const t = makeBot();
    t.ctx.db.prepare("INSERT INTO events (ts, name, anon_id, src, med, cmp) VALUES ('2026-10-01', 'page_view', 'anon-from-site-01', 'instagram', 'cpc', 'oct')").run();
    await t.send(t.user(1001), '/start w_anon-from-site-01');
    const lead = getLeadByTgUser(t.ctx.db, 1001)!;
    assert.equal(lead.src, 'instagram');
    assert.equal(lead.cmp, 'oct');
    assert.equal(lead.anon_id, 'anon-from-site-01');
  });

  it('tracks referrals', async () => {
    const t = makeBot();
    await t.send(t.user(1001), '/start');
    await t.send(t.user(1001), '/invite');
    const referrer = getLeadByTgUser(t.ctx.db, 1001)!;
    assert.ok(referrer.ref_code);
    await t.send(t.user(3003), `/start r_${referrer.ref_code}`);
    assert.equal(getLeadByTgUser(t.ctx.db, 3003)!.referred_by, referrer.id);
  });
});

describe('bot: quiz', () => {
  it('runs the 4-question quiz and qualifies', async () => {
    const t = makeBot();
    const u = t.user(1001);
    await t.send(u, '/start');
    await t.click(u, 'm:apply');
    assert.match(t.lastTextTo(1001), /Вопрос 1 из 4/);
    await t.click(u, 'q:role:freelance');
    await t.click(u, 'q:goal:bot');
    await t.click(u, 'q:schedule:partly');
    await t.click(u, 'q:timing:soon');
    const lead = getLeadByTgUser(t.ctx.db, 1001)!;
    assert.equal(lead.tier, 'warm');
    assert.ok(lead.applied_at);
    assert.match(t.lastTextTo(1001), /лист ожидания/);
    // "I want the next cohort after all"
    await t.click(u, 'up:now');
    assert.equal(getLeadByTgUser(t.ctx.db, 1001)!.tier, 'hot');
    assert.match(t.lastTextTo(1001), /курс вам подходит/);
  });

  it('ignores forged quiz values', async () => {
    const t = makeBot();
    const u = t.user(1001);
    await t.send(u, '/start');
    await t.click(u, 'q:role:admin');
    assert.equal(getLeadByTgUser(t.ctx.db, 1001)!.role, null);
  });
});

describe('bot: Kaspi payment → onboarding', () => {
  it('collects the phone, notifies the team, confirms payment and onboards with a one-time invite', async () => {
    const t = makeBot();
    const u = t.user(1001);
    await t.send(u, '/start s_instagram');
    for (const [f, v] of [['role', 'business'], ['goal', 'site'], ['schedule', 'yes'], ['timing', 'now']]) await t.click(u, `q:${f}:${v}`);

    await t.click(u, 'pay:ki');
    assert.match(t.lastTextTo(1001), /номер телефона/);
    assert.equal(getLeadByTgUser(t.ctx.db, 1001)!.bot_state, 'await_phone');

    // Someone else's contact card is refused.
    await t.send(u, '', { text: undefined, contact: { phone_number: '77779998877', first_name: 'X', user_id: 4242 } });
    assert.equal(getLeadByTgUser(t.ctx.db, 1001)!.phone, null);

    await t.send(u, '', { text: undefined, contact: { phone_number: '77011112233', first_name: 'Айгерим', user_id: 1001 } });
    assert.equal(getLeadByTgUser(t.ctx.db, 1001)!.phone, '+77011112233');
    assert.match(t.lastTextTo(1001), /\+7 701 111 22 33/);

    await t.click(u, 'pay:ki_ok');
    const lead = getLeadByTgUser(t.ctx.db, 1001)!;
    assert.ok(lead.payment_requested_at);
    const card = t.sentTo(ADMIN_CHAT).at(-1)!;
    assert.match(String(card.payload.text), /ждёт счёт Kaspi/);
    assert.ok(t.buttons(card).some((b) => b.callback_data === `adm:inv:${lead.id}`));

    // A student cannot press admin buttons.
    await t.click(u, `adm:paid:${lead.id}`);
    assert.equal(getLead(t.ctx.db, lead.id)!.paid_at, null);

    await t.click(t.user(ADMIN.id, 'Admin', { username: 'boss' }), `adm:inv:${lead.id}`, ADMIN_CHAT);
    assert.ok(getLead(t.ctx.db, lead.id)!.invoice_sent_at);
    assert.match(t.lastTextTo(1001), /отправлен в Kaspi/);

    await t.click(u, 'pay:claim');
    assert.match(String(t.sentTo(ADMIN_CHAT).at(-1)!.payload.text), /говорит, что оплатил/);

    await t.click(t.user(ADMIN.id, 'Admin', { username: 'boss' }), `adm:paid:${lead.id}`, ADMIN_CHAT);
    const paid = getLead(t.ctx.db, lead.id)!;
    assert.ok(paid.paid_at);
    assert.ok(paid.onboarded_at);
    assert.ok(paid.ref_code);
    const invite = t.calls.find((c) => c.method === 'createChatInviteLink')!;
    assert.equal(invite.payload.chat_id, COHORT_CHAT);
    assert.equal(invite.payload.member_limit, 1);
    const welcome = t.sentTo(1001).find((c) => /добро пожаловать в поток/.test(String(c.payload.text)))!;
    assert.match(String(welcome.payload.text), /https:\/\/t\.me\/\+invite/);
    assert.ok(!t.calls.some((c) => JSON.stringify(c.payload).includes('zoom.us') && c.payload.chat_id !== 1001), 'zoom link only to students');

    // Paying twice does nothing.
    const before = t.calls.length;
    await t.click(t.user(ADMIN.id, 'Admin'), `adm:paid:${lead.id}`, ADMIN_CHAT);
    assert.equal(t.calls.filter((c, i) => i >= before && c.method === 'createChatInviteLink').length, 0);

    // Project idea is saved.
    await t.send(u, 'CRM для моего салона');
    assert.equal(getLead(t.ctx.db, lead.id)!.project_idea, 'CRM для моего салона');

    // Joining the cohort chat is detected.
    await t.rt.bot.handleUpdate({
      update_id: 99999,
      chat_member: {
        chat: { id: COHORT_CHAT, type: 'supergroup', title: 'Поток' },
        from: u,
        date: 0,
        old_chat_member: { status: 'left', user: u },
        new_chat_member: { status: 'member', user: u },
      },
    } as never);
    assert.ok(getLead(t.ctx.db, lead.id)!.joined_at);
    assert.equal(funnel(t.ctx.db).joined, 1);
  });

  it('offers a card link with the lead id when configured', async () => {
    const t = makeBot({ PAYMENT_LINK_URL: 'https://pay.example/c?order={lead}&sum={amount}' });
    const lead = await webLead(t);
    await t.send(t.user(1001), `/start a_${lead.token}`);
    await t.click(t.user(1001), 'pay:card');
    const msg = t.sentTo(1001).at(-1)!;
    const url = t.buttons(msg).find((b) => b.url)?.url;
    assert.equal(url, `https://pay.example/c?order=${lead.id}&sum=`);
    assert.equal(getLead(t.ctx.db, lead.id)!.payment_method, 'card_link');
  });
});

describe('bot: human support relay', () => {
  it('forwards questions to the team and relays replies back', async () => {
    const t = makeBot();
    const u = t.user(1001);
    await t.send(u, '/start');
    await t.send(u, 'А можно с ноутбуком на Linux?');
    const copy = t.calls.find((c) => c.method === 'copyMessage' && c.payload.chat_id === ADMIN_CHAT);
    assert.ok(copy, 'question copied to team chat');
    const header = t.sentTo(ADMIN_CHAT).at(-1)!;
    const link = t.ctx.db.prepare('SELECT admin_msg_id FROM support_links WHERE user_chat_id = 1001').all() as Array<{ admin_msg_id: number }>;
    assert.equal(link.length, 2);

    await t.send(t.user(ADMIN.id, 'Admin'), 'Да, подойдёт любой ноутбук с Chrome.', {
      reply_to_message: { message_id: link[0]!.admin_msg_id, date: 0, chat: { id: ADMIN_CHAT, type: 'supergroup' }, text: String(header.payload.text) },
    }, { id: ADMIN_CHAT, type: 'supergroup' });
    assert.match(t.lastTextTo(1001), /Ответ команды[\s\S]*любой ноутбук/);
  });

  it('does not relay replies from non-admins in the team chat', async () => {
    const t = makeBot();
    await t.send(t.user(1001), '/start');
    await t.send(t.user(1001), 'вопрос');
    const link = t.ctx.db.prepare('SELECT admin_msg_id FROM support_links LIMIT 1').get() as { admin_msg_id: number };
    const before = t.sentTo(1001).length;
    await t.send(t.user(7777, 'Stranger'), 'spam reply', {
      reply_to_message: { message_id: link.admin_msg_id, date: 0, chat: { id: ADMIN_CHAT, type: 'supergroup' }, text: 'x' },
    }, { id: ADMIN_CHAT, type: 'supergroup' });
    assert.equal(t.sentTo(1001).length, before);
  });
});

describe('bot: admin commands', () => {
  it('only answers admins', async () => {
    const t = makeBot();
    await t.send(t.user(1001), '/stats');
    assert.ok(!t.sentTo(1001).some((c) => /Воронка/.test(String(c.payload.text))));
    await t.send(t.user(ADMIN.id, 'Admin'), '/stats');
    assert.match(t.lastTextTo(ADMIN.id), /Воронка/);
  });

  it('records ad spend and manual payments', async () => {
    const t = makeBot();
    const lead = await webLead(t);
    await t.send(t.user(ADMIN.id, 'Admin'), '/spend instagram 50 000 2026-10-01');
    const spend = t.ctx.db.prepare('SELECT src, amount, day FROM ad_spend').get() as { src: string; amount: number; day: string };
    assert.deepEqual({ ...spend }, { src: 'instagram', amount: 50000, day: '2026-10-01' });
    await t.send(t.user(ADMIN.id, 'Admin'), `/paid ${lead.id} 149000`);
    assert.equal(getLead(t.ctx.db, lead.id)!.paid_amount, 149000);
    assert.match(t.lastTextTo(ADMIN_CHAT), /не открыл бота/);
  });
});

describe('reminders', () => {
  it('nudges a hot lead once after 24h, only in working hours, and respects /stop', async () => {
    const t = makeBot({}, new Date('2026-10-05T07:00:00Z'));
    const lead = await webLead(t);
    await t.send(t.user(1001), `/start a_${lead.token}`);

    t.ctx.setNow(new Date('2026-10-06T08:00:00Z')); // +25h, 13:00 KZ
    assert.equal((await runReminders(t.rt)).pay1, 1);
    assert.equal((await runReminders(t.rt)).pay1, undefined, 'only once');

    t.ctx.setNow(new Date('2026-10-08T18:00:00Z')); // 23:00 KZ
    assert.deepEqual(await runReminders(t.rt), {}, 'quiet at night');

    await t.send(t.user(1001), '/stop');
    t.ctx.setNow(new Date('2026-10-09T07:00:00Z'));
    assert.equal((await runReminders(t.rt)).pay2, undefined);
  });

  it('sends the Zoom link one hour before each session to paid students only', async () => {
    const original = course.cohort.startDate;
    course.cohort.startDate = '2026-11-02';
    try {
      const t = makeBot({}, new Date('2026-10-05T07:00:00Z'));
      const student = await webLead(t);
      await t.send(t.user(1001), `/start a_${student.token}`);
      await t.send(t.user(ADMIN.id, 'Admin'), `/paid ${student.id}`);
      await t.send(t.user(2002, 'Lead'), '/start');

      t.ctx.setNow(new Date('2026-11-02T13:40:00Z')); // 18:40 KZ, class at 19:30
      const sent = await runReminders(t.rt);
      assert.equal(sent.session_1, 1);
      assert.match(t.lastTextTo(1001), /zoom\.us\/j\/123/);
      assert.ok(!t.sentTo(2002).some((c) => /zoom/.test(String(c.payload.text))));
    } finally {
      course.cohort.startDate = original;
    }
  });
});
