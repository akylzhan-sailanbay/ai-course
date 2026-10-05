import { InlineKeyboard, Keyboard, type Bot, type Context } from 'grammy';
import { course, type Lang } from '../config/course';
import { getLead, getLeadByTgUser, markOnce, referralCounts, updateLead, type Lead } from '../db/leads';
import { parseSourcePayload, type Touch } from '../lib/attribution';
import { esc } from '../lib/html';
import { formatPhone, normalizePhone } from '../lib/phone';
import { plainPlaceholders } from '../lib/placeholders';
import { QUIZ_FIELDS, QUIZ_OPTIONS, type Answers, type QuizField } from '../lib/scoring';
import { isWorkingHours } from '../lib/time';
import { track } from '../services/analytics';
import {
  bindWebLead,
  claimPayment,
  ensureRefCode,
  requestPayment,
  submitApplication,
  upgradeToHot,
  upsertBotLead,
  type TgUser,
} from '../services/funnel';
import { priceNow, seatsLeft } from '../services/offer';
import { stage } from '../services/stage';
import type { BotKit } from './kit';

const MAX_SUPPORT_TEXT = 3500;

function tgUser(ctx: Context): TgUser | null {
  if (!ctx.from || !ctx.chat) return null;
  return {
    id: ctx.from.id,
    chatId: ctx.chat.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    languageCode: ctx.from.language_code,
  };
}

/** Attribution for people who clicked a Telegram link on the site: their first page view. */
function touchFromAnon(kit: BotKit, anonId: string): Touch {
  const row = kit.ctx.db
    .prepare("SELECT src, med, cmp FROM events WHERE anon_id = ? AND name = 'page_view' ORDER BY id LIMIT 1")
    .get(anonId) as { src: string | null; med: string | null; cmp: string | null } | undefined;
  return { source: row?.src ?? 'site', medium: row?.med ?? 'telegram_bot', campaign: row?.cmp ?? undefined };
}

export function registerUserHandlers(bot: Bot, kit: BotKit) {
  const { ctx: app } = kit;
  const now = () => app.clock().toISOString();
  const pm = bot.chatType('private');

  /** Current lead for this chat (created on first contact). */
  const leadOf = (c: Context): Lead | null => {
    const u = tgUser(c);
    if (!u) return null;
    return getLeadByTgUser(app.db, u.id) ?? upsertBotLead(app, u).lead;
  };

  // ── Entry ─────────────────────────────────────────────────────────────────────────────────
  pm.command('start', async (c) => {
    const u = tgUser(c)!;
    const payload = (c.match ?? '').trim();
    let lead: Lead | null = null;

    if (payload.startsWith('a_')) {
      lead = await bindWebLead(app, payload.slice(2), u);
      if (lead) {
        lead = kit.setState(lead, null);
        const { t } = kit.copy(lead.lang);
        await kit.send(u.chatId, t.linked);
        if (lead.applied_at) return showResult(lead);
        await kit.send(u.chatId, t.continueQuiz);
        return askNext(lead);
      }
    }

    let touch: Touch | null = null;
    if (payload.startsWith('w_') && /^w_[A-Za-z0-9_-]{8,64}$/.test(payload)) touch = touchFromAnon(kit, payload.slice(2));
    else touch = parseSourcePayload(payload);
    const refCode = /^r_[a-z0-9]{4,12}$/i.test(payload) ? payload.slice(2) : null;
    const res = upsertBotLead(app, u, { touch, refCode });
    lead = res.lead;
    if (payload.startsWith('w_') && !lead.anon_id) lead = updateLead(app.db, lead.id, { anon_id: payload.slice(2) }, now());
    if (lead.opted_out_at) lead = updateLead(app.db, lead.id, { opted_out_at: null }, now());
    lead = kit.setState(lead, null);
    const { t, f } = kit.copy(lead.lang);
    await kit.send(u.chatId, t.welcome(f, esc(lead.tg_first_name ?? '')), kit.menu(lead.lang));
  });

  pm.command('menu', async (c) => {
    const lead = leadOf(c);
    if (!lead) return;
    const { t, f } = kit.copy(lead.lang);
    await kit.send(lead.tg_chat_id!, t.welcome(f, esc(lead.tg_first_name ?? '')), kit.menu(lead.lang));
  });

  pm.command('stop', async (c) => {
    const lead = leadOf(c);
    if (!lead) return;
    updateLead(app.db, lead.id, { opted_out_at: now(), bot_state: null }, now());
    track(app, 'opted_out', { lead });
    await kit.send(lead.tg_chat_id!, kit.copy(lead.lang).t.stopped);
  });

  pm.command('invite', async (c) => {
    const lead = leadOf(c);
    if (lead) await sendReferral(lead);
  });

  pm.command('lang', async (c) => {
    const lead = leadOf(c);
    if (lead) await switchLang(lead);
  });

  const commandMenu: Record<string, (lead: Lead) => Promise<unknown>> = {
    apply: (l) => startApply(l),
    program: (l) => sendProgram(l),
    price: (l) => sendPrice(l),
    faq: (l) => sendFaqList(l),
    help: (l) => askHuman(l),
  };
  for (const [cmd, fn] of Object.entries(commandMenu)) {
    pm.command(cmd, async (c) => {
      const lead = leadOf(c);
      if (lead) await fn(lead);
    });
  }

  // ── Menu buttons ──────────────────────────────────────────────────────────────────────────
  bot.callbackQuery(/^m:(apply|program|price|faq|human|lang|menu)$/, async (c) => {
    await c.answerCallbackQuery();
    const lead = leadOf(c);
    if (!lead) return;
    switch (c.match[1]) {
      case 'apply':
        return startApply(lead);
      case 'program':
        return sendProgram(lead);
      case 'price':
        return sendPrice(lead);
      case 'faq':
        return sendFaqList(lead);
      case 'human':
        return askHuman(lead);
      case 'lang':
        return switchLang(lead);
      default: {
        const { t, f } = kit.copy(lead.lang);
        return kit.send(lead.tg_chat_id!, t.welcome(f, esc(lead.tg_first_name ?? '')), kit.menu(lead.lang));
      }
    }
  });

  bot.callbackQuery(/^faq:(\d{1,2})$/, async (c) => {
    await c.answerCallbackQuery();
    const lead = leadOf(c);
    if (!lead) return;
    const { c: copy, f } = kit.copy(lead.lang);
    const item = copy.faq.items(f)[Number(c.match[1])];
    if (!item) return;
    const m = copy.bot.menu;
    await kit.send(
      lead.tg_chat_id!,
      `<b>${esc(item.q)}</b>\n\n${esc(plainPlaceholders(item.a))}`,
      new InlineKeyboard().text(m.faq, 'm:faq').text(m.human, 'm:human').row().text(m.apply, 'm:apply'),
    );
  });

  // ── Quiz ──────────────────────────────────────────────────────────────────────────────────
  bot.callbackQuery(/^q:(role|goal|schedule|timing):([a-z]+)$/, async (c) => {
    const field = c.match[1] as QuizField;
    const value = c.match[2]!;
    if (!QUIZ_OPTIONS[field].includes(value)) return c.answerCallbackQuery();
    await c.answerCallbackQuery();
    let lead = leadOf(c);
    if (!lead) return;
    lead = updateLead(app.db, lead.id, { [field]: value }, now());
    // Replace the question's buttons with the chosen answer so the chat reads like a transcript.
    const { c: copy, f } = kit.copy(lead.lang);
    const q = copy.apply.quiz[field];
    const label = typeof q.label === 'function' ? q.label(f) : q.label;
    try {
      await c.editMessageText(`${esc(plainPlaceholders(label))}\n→ <b>${esc((q.options as Record<string, string>)[value])}</b>`, { parse_mode: 'HTML' });
    } catch {
      /* message too old to edit — harmless */
    }
    await askNext(lead);
  });

  async function startApply(lead: Lead) {
    if (lead.paid_at) return kit.sendToLead(lead, kit.copy(lead.lang).t.pay.alreadyPaid);
    if (lead.applied_at && QUIZ_FIELDS.every((k) => lead[k])) return showResult(lead);
    return askNext(lead);
  }

  async function askNext(lead: Lead) {
    const field = QUIZ_FIELDS.find((k) => !lead[k]);
    if (!field) {
      const answers = Object.fromEntries(QUIZ_FIELDS.map((k) => [k, lead[k]])) as unknown as Answers;
      const updated = await submitApplication(app, lead, answers);
      return showResult(updated);
    }
    if (markOnce(app.db, lead.id, 'quiz_started_at', now())) track(app, 'quiz_started', { lead });
    const { c: copy, f } = kit.copy(lead.lang);
    const q = copy.apply.quiz[field];
    const label = typeof q.label === 'function' ? q.label(f) : q.label;
    const kb = new InlineKeyboard();
    for (const v of QUIZ_OPTIONS[field]) kb.text((q.options as Record<string, string>)[v]!, `q:${field}:${v}`).row();
    const n = QUIZ_FIELDS.indexOf(field) + 1;
    return kit.sendToLead(lead, `${copy.bot.quizProgress(n, QUIZ_FIELDS.length)}\n<b>${esc(plainPlaceholders(label))}</b>`, kb);
  }

  async function showResult(lead: Lead) {
    const { t, f } = kit.copy(lead.lang);
    if (lead.paid_at) return kit.sendToLead(lead, t.pay.alreadyPaid);
    if (lead.tier === 'hot' && seatsLeft(app.db) <= 0) {
      updateLead(app.db, lead.id, { tier: 'warm' }, now());
      return kit.sendToLead(lead, t.soldOut, kit.menu(lead.lang));
    }
    if (lead.tier === 'hot') return kit.sendToLead(lead, t.result.hot(f), payKeyboard(lead));
    if (lead.tier === 'warm') {
      return kit.sendToLead(lead, t.result.warm, new InlineKeyboard().text(t.result.wantNow, 'up:now').row().text(t.menu.back, 'm:menu'));
    }
    return kit.sendToLead(lead, t.result.cold(course.contacts.telegramChannel ? esc(course.contacts.telegramChannel) : null), kit.menu(lead.lang));
  }

  function payKeyboard(lead: Lead): InlineKeyboard {
    const { t } = kit.copy(lead.lang);
    const kb = new InlineKeyboard();
    if (course.payments.kaspiInvoice) kb.text(t.pay.kaspiInvoice, 'pay:ki').row();
    if (kit.env.KASPI_PAY_URL) kb.text(t.pay.kaspiLink, 'pay:kl').row();
    if (kit.env.PAYMENT_LINK_URL) kb.text(t.pay.card, 'pay:card').row();
    return kb.text(t.pay.askFirst, 'm:human');
  }

  bot.callbackQuery('up:now', async (c) => {
    await c.answerCallbackQuery();
    const lead = leadOf(c);
    if (lead) await showResult(upgradeToHot(app, lead));
  });

  // ── Payment ───────────────────────────────────────────────────────────────────────────────
  bot.callbackQuery(/^pay:(ki|ki_ok|ki_phone|kl|card|claim|help)$/, async (c) => {
    await c.answerCallbackQuery();
    let lead = leadOf(c);
    if (!lead) return;
    const { t, f } = kit.copy(lead.lang);
    const action = c.match[1];
    if (lead.paid_at) return kit.sendToLead(lead, t.pay.alreadyPaid);
    if (action !== 'claim' && action !== 'help' && seatsLeft(app.db) <= 0) return kit.sendToLead(lead, t.soldOut, kit.menu(lead.lang));

    switch (action) {
      case 'ki':
        if (!lead.phone) return askPhone(lead);
        return kit.sendToLead(
          lead,
          t.pay.confirmPhone(esc(formatPhone(lead.phone))),
          new InlineKeyboard().text(t.pay.yes, 'pay:ki_ok').text(t.pay.otherPhone, 'pay:ki_phone'),
        );
      case 'ki_phone':
        return askPhone(lead);
      case 'ki_ok':
        lead = await requestPayment(app, lead, 'kaspi_invoice');
        return kit.sendToLead(lead, t.pay.invoiceRequested(f));
      case 'kl':
      case 'card': {
        const method = action === 'kl' ? 'kaspi_link' : 'card_link';
        const raw = action === 'kl' ? kit.env.KASPI_PAY_URL : kit.env.PAYMENT_LINK_URL;
        if (!raw) return;
        lead = await requestPayment(app, lead, method);
        const amount = priceNow(app.clock()).amount ?? '';
        const url = raw.replace('{lead}', String(lead.id)).replace('{amount}', String(amount));
        return kit.sendToLead(lead, t.pay.link(f), new InlineKeyboard().url(t.pay.open, url).row().text(t.pay.claim, 'pay:claim'));
      }
      case 'claim':
        lead = await claimPayment(app, lead);
        return kit.sendToLead(lead, t.pay.claimed(f));
      case 'help':
        return askHuman(lead);
    }
  });

  async function askPhone(lead: Lead) {
    const { t } = kit.copy(lead.lang);
    kit.setState(lead, 'await_phone');
    return kit.sendToLead(lead, t.askPhone, new Keyboard().requestContact(t.sharePhone).resized().oneTime());
  }

  async function savePhone(lead: Lead, raw: string): Promise<void> {
    const { t } = kit.copy(lead.lang);
    const phone = normalizePhone(raw);
    if (!phone) {
      await kit.sendToLead(lead, t.phoneInvalid);
      return;
    }
    lead = updateLead(app.db, lead.id, { phone, bot_state: null }, now());
    await kit.sendToLead(lead, t.phoneSaved(esc(formatPhone(phone))), { remove_keyboard: true });
    // Phone was asked for a Kaspi invoice; continue right there.
    await kit.sendToLead(
      lead,
      t.pay.confirmPhone(esc(formatPhone(phone))),
      new InlineKeyboard().text(t.pay.yes, 'pay:ki_ok').text(t.pay.otherPhone, 'pay:ki_phone'),
    );
  }

  pm.on('message:contact', async (c) => {
    const lead = leadOf(c);
    if (!lead) return;
    // Only accept the user's own contact card, never someone else's.
    if (c.message.contact.user_id !== c.from.id) return kit.sendToLead(lead, kit.copy(lead.lang).t.phoneInvalid);
    await savePhone(lead, c.message.contact.phone_number.startsWith('+') ? c.message.contact.phone_number : `+${c.message.contact.phone_number}`);
  });

  // ── Onboarding answers ────────────────────────────────────────────────────────────────────
  bot.callbackQuery('ob:skip', async (c) => {
    await c.answerCallbackQuery();
    const lead = leadOf(c);
    if (!lead) return;
    kit.setState(lead, null);
    await kit.sendToLead(lead, kit.copy(lead.lang).t.onboarding.projectSaved);
  });

  // ── Human support ─────────────────────────────────────────────────────────────────────────
  async function askHuman(lead: Lead) {
    const { t, f } = kit.copy(lead.lang);
    kit.setState(lead, 'await_support');
    return kit.sendToLead(lead, t.support.ask(f));
  }

  /** Forwards any user message to the team chat and remembers where replies should go. */
  async function forwardToTeam(c: Context, lead: Lead) {
    const { t, f } = kit.copy(lead.lang);
    if (!kit.env.ADMIN_CHAT_ID || !c.message) return;
    const header = await kit.toAdmins(
      `💬 <b>Вопрос от #${lead.id}</b> ${esc(lead.name ?? lead.tg_first_name ?? '')}${lead.tg_username ? ` @${esc(lead.tg_username)}` : ''}\nЭтап: ${esc(stage(lead))}\n<i>Ответьте реплаем на это или следующее сообщение — бот перешлёт ответ.</i>`,
    );
    let copied: { message_id: number } | null = null;
    try {
      copied = await kit.bot.api.copyMessage(kit.env.ADMIN_CHAT_ID, c.message.chat.id, c.message.message_id);
    } catch (err) {
      app.log.error('copy to admin failed', { err: String(err) });
    }
    const link = app.db.prepare('INSERT OR REPLACE INTO support_links (admin_msg_id, lead_id, user_chat_id, created_at) VALUES (?, ?, ?, ?)');
    if (header) link.run(header.message_id, lead.id, c.message.chat.id, now());
    if (copied) link.run(copied.message_id, lead.id, c.message.chat.id, now());
    kit.setState(lead, null);
    track(app, 'support_message', { lead });
    const open = isWorkingHours(app.clock(), course.payments.workingHours);
    await kit.sendToLead(lead, open ? t.support.forwarded : t.support.offHours(f));
  }

  // ── Free-form messages (must be registered last) ──────────────────────────────────────────
  pm.on('message', async (c, next) => {
    if (kit.isAdmin(c.from.id) && (c.message.text?.startsWith('/') ?? false)) return next();
    const lead = leadOf(c);
    if (!lead) return;
    const text = c.message.text?.trim();

    if (lead.bot_state === 'await_phone' && text) return savePhone(lead, text);
    if (lead.bot_state === 'await_project' && text) {
      updateLead(app.db, lead.id, { project_idea: text.slice(0, 500), bot_state: null }, now());
      track(app, 'project_idea', { lead });
      return kit.sendToLead(lead, kit.copy(lead.lang).t.onboarding.projectSaved);
    }
    if (text?.startsWith('/')) {
      const { t, f } = kit.copy(lead.lang);
      return kit.send(lead.tg_chat_id!, t.welcome(f, esc(lead.tg_first_name ?? '')), kit.menu(lead.lang));
    }
    if (text && text.length > MAX_SUPPORT_TEXT) return;
    // Anything else is a question for the team — never a dead end.
    return forwardToTeam(c, getLead(app.db, lead.id)!);
  });

  // ── Misc ──────────────────────────────────────────────────────────────────────────────────
  async function sendProgram(lead: Lead) {
    const { t, f } = kit.copy(lead.lang);
    return kit.sendToLead(lead, t.program(f), new InlineKeyboard().text(t.menu.apply, 'm:apply').row().text(t.menu.price, 'm:price').text(t.menu.back, 'm:menu'));
  }

  async function sendPrice(lead: Lead) {
    const { t, f } = kit.copy(lead.lang);
    return kit.sendToLead(lead, t.price(f), new InlineKeyboard().text(t.menu.apply, 'm:apply').row().text(t.menu.faq, 'm:faq').text(t.menu.back, 'm:menu'));
  }

  async function sendFaqList(lead: Lead) {
    const { c: copy, t, f } = kit.copy(lead.lang);
    const kb = new InlineKeyboard();
    copy.faq.items(f).forEach((it, i) => kb.text(it.q.length > 58 ? `${it.q.slice(0, 56)}…` : it.q, `faq:${i}`).row());
    kb.text(t.menu.human, 'm:human').text(t.menu.back, 'm:menu');
    return kit.sendToLead(lead, t.faqIntro, kb);
  }

  async function switchLang(lead: Lead) {
    const lang: Lang = lead.lang === 'ru' ? 'kk' : 'ru';
    const updated = updateLead(app.db, lead.id, { lang }, now());
    const { t, f } = kit.copy(lang);
    await kit.sendToLead(updated, t.langSwitched);
    return kit.sendToLead(updated, t.welcome(f, esc(updated.tg_first_name ?? '')), kit.menu(lang));
  }

  async function sendReferral(lead: Lead) {
    const withCode = ensureRefCode(app, lead);
    const link = kit.botLink(`r_${withCode.ref_code}`) ?? `${kit.env.PUBLIC_URL}/?ref=${withCode.ref_code}`;
    const counts = referralCounts(app.db, lead.id);
    const lang = lead.lang;
    const { t } = kit.copy(lang);
    const bonus = (b: Record<Lang, string> | null) => (b ? esc(b[lang]) : null);
    return kit.sendToLead(
      withCode,
      t.referral(esc(link), bonus(course.referral.friendBonus), bonus(course.referral.referrerBonus), counts.invited, counts.paid),
    );
  }

  return { showResult, askNext, sendReferral, forwardToTeam };
}
