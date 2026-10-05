import { InlineKeyboard, InputFile, type Bot, type Context } from 'grammy';
import { course } from '../config/course';
import { audience, findLeads, getLead, getLeadByTgUser, markOnce, allLeads, type Lead } from '../db/leads';
import { addSpend, bySource, funnel, pct } from '../db/stats';
import { toCsv } from '../lib/csv';
import { esc } from '../lib/html';
import { kzToday } from '../lib/time';
import { track } from '../services/analytics';
import { confirmPayment, markInvoiceSent, markLost } from '../services/funnel';
import { seatsTaken } from '../services/offer';
import { ADMIN_HEADERS, seatsLine, type BotKit } from './kit';

type Segment = 'students' | 'hot' | 'waitlist' | 'all';
const SEGMENT_LABEL: Record<Segment, string> = {
  students: 'Студенты потока (оплатили)',
  hot: 'Горячие без оплаты',
  waitlist: 'Лист ожидания (тёплые и холодные)',
  all: 'Все, кто не оплатил',
};

interface BroadcastDraft {
  segment: Segment;
  stage: 'message' | 'confirm';
  fromChat?: number;
  messageId?: number;
}

export function registerAdminHandlers(bot: Bot, kit: BotKit, onboard: (lead: Lead) => Promise<void>) {
  const { ctx: app, env } = kit;
  const drafts = new Map<number, BroadcastDraft>();
  const adminName = (c: Context) => (c.from?.username ? `@${c.from.username}` : c.from?.first_name ?? 'админ');

  /** Admin commands work in the team chat or in a private chat with the bot, and only for ADMIN_IDS. */
  const adminCommand = (name: string, fn: (c: Context, args: string) => Promise<unknown>) =>
    bot.command(name, async (c, next) => {
      const inPlace = c.chat?.type === 'private' || c.chat?.id === env.ADMIN_CHAT_ID;
      if (!kit.isAdmin(c.from?.id) || !inPlace) return next();
      await fn(c, (c.match as string | undefined)?.trim() ?? '');
    });

  // ── Team replies to forwarded questions ───────────────────────────────────────────────────
  bot.on('message', async (c, next) => {
    const replyTo = c.message.reply_to_message;
    if (c.chat.id !== env.ADMIN_CHAT_ID || !replyTo || !kit.isAdmin(c.from.id)) return next();
    const link = app.db.prepare('SELECT lead_id, user_chat_id FROM support_links WHERE admin_msg_id = ?').get(replyTo.message_id) as
      | { lead_id: number; user_chat_id: number }
      | undefined;
    if (!link) return next();
    const lead = getLead(app.db, link.lead_id);
    const { t } = kit.copy(lead?.lang ?? 'ru');
    let ok = false;
    if (c.message.text) {
      ok = (await kit.send(link.user_chat_id, `${t.support.reply}\n\n${esc(c.message.text)}`)) !== null;
    } else {
      ok = (await kit.send(link.user_chat_id, t.support.reply)) !== null;
      if (ok) {
        try {
          await kit.bot.api.copyMessage(link.user_chat_id, c.chat.id, c.message.message_id);
        } catch {
          ok = false;
        }
      }
    }
    await c.reply(ok ? '✓ Отправлено' : '✗ Не доставлено (пользователь заблокировал бота?)', { reply_parameters: { message_id: c.message.message_id } });
  });

  // ── Broadcast message capture (private chat only) ─────────────────────────────────────────
  bot.chatType('private').on('message', async (c, next) => {
    const draft = drafts.get(c.from.id);
    if (!draft || draft.stage !== 'message' || !kit.isAdmin(c.from.id) || c.message.text?.startsWith('/')) return next();
    draft.stage = 'confirm';
    draft.fromChat = c.chat.id;
    draft.messageId = c.message.message_id;
    const n = audience(app.db, draft.segment, course.cohort.id).length;
    await c.reply(`Отправить это сообщение: «${SEGMENT_LABEL[draft.segment]}», получателей: ${n}?`, {
      reply_markup: new InlineKeyboard().text(`✅ Отправить (${n})`, 'bc:go').text('Отмена', 'bc:cancel'),
    });
  });

  // ── Lead card buttons ─────────────────────────────────────────────────────────────────────
  bot.callbackQuery(/^adm:(inv|paid|nf|lost):(\d+)$/, async (c) => {
    if (!kit.isAdmin(c.from.id)) return c.answerCallbackQuery({ text: 'Только для админов', show_alert: true });
    const lead = getLead(app.db, Number(c.match[2]));
    if (!lead) return c.answerCallbackQuery({ text: 'Лид не найден' });
    const action = c.match[1];
    const who = adminName(c);
    const original = c.callbackQuery.message && 'text' in c.callbackQuery.message ? esc(c.callbackQuery.message.text ?? '') : '';
    const edit = async (note: string, keyboard?: InlineKeyboard) => {
      try {
        await c.editMessageText(`${original}\n\n${note}`, { parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true } });
      } catch {
        /* unchanged or too old */
      }
    };

    if (action === 'inv') {
      if (lead.paid_at) return c.answerCallbackQuery({ text: 'Уже оплачено' });
      const updated = markInvoiceSent(app, lead);
      const { t, f } = kit.copy(updated.lang);
      const delivered = await kit.sendToLead(updated, t.pay.invoiceSent(f), new InlineKeyboard().text(t.pay.claim, 'pay:claim').row().text(t.pay.needHelp, 'pay:help'));
      await c.answerCallbackQuery({ text: delivered ? 'Студенту отправлено уведомление' : 'Студент не в Telegram — напишите в WhatsApp' });
      return edit(`🧾 Счёт выставлен — ${esc(who)}`, kit.contactButtons(updated, new InlineKeyboard().text('✅ Оплачено', `adm:paid:${lead.id}`).text('✖️ Не целевой', `adm:lost:${lead.id}`).row()));
    }

    if (action === 'paid') {
      const res = confirmPayment(app, lead);
      if (res.already) return c.answerCallbackQuery({ text: 'Уже подтверждено' });
      await c.answerCallbackQuery({ text: 'Оплата подтверждена' });
      await edit(`✅ Оплата подтверждена — ${esc(who)}\n${seatsLine(seatsTaken(app.db))}`);
      return afterPaid(res.lead);
    }

    if (action === 'nf') {
      const { t } = kit.copy(lead.lang);
      await kit.sendToLead(lead, t.pay.notFound);
      await c.answerCallbackQuery({ text: 'Студента попросили прислать чек' });
      return edit(`❌ Оплата не найдена — ${esc(who)}`, kit.contactButtons(lead, new InlineKeyboard().text('✅ Всё-таки оплачено', `adm:paid:${lead.id}`).row()));
    }

    markLost(app, lead, 'не целевой');
    await c.answerCallbackQuery({ text: 'Помечен как нецелевой' });
    return edit(`✖️ Не целевой — ${esc(who)}`);
  });

  async function afterPaid(lead: Lead) {
    if (lead.tg_chat_id) {
      await onboard(lead);
    } else {
      await kit.toAdmins(`⚠️ #${lead.id} оплатил, но не открыл бота. Отправьте доступы вручную (WhatsApp) или попросите открыть: ${esc(kit.botLink(`a_${lead.token}`) ?? '')}`);
    }
  }

  // ── Commands ──────────────────────────────────────────────────────────────────────────────
  // Setup helper: shows the ids needed for ADMIN_CHAT_ID / ADMIN_IDS / COHORT_CHAT_ID. Reveals only the caller's own ids.
  bot.command('chatid', (c) => c.reply(`chat id: ${c.chat.id}\nyour user id: ${c.from?.id ?? '—'}`));

  adminCommand('admin', (c) =>
    c.reply(
      [
        'Команды админа:',
        '/stats — воронка и каналы',
        '/lead <id | телефон | @username> — карточка лида',
        '/paid <id> [сумма] — подтвердить оплату вручную (наличные и т.п.)',
        '/spend <источник> <сумма> [ГГГГ-ММ-ДД] — расход на рекламу (для CAC)',
        '/seats — занятые места',
        '/export — все лиды в CSV',
        '/broadcast — рассылка (только в личке с ботом)',
        '',
        'Вопросы студентов приходят в чат команды: ответьте реплаем — бот перешлёт ответ.',
      ].join('\n'),
    ),
  );

  adminCommand('stats', async (c) => {
    const week = new Date(app.clock().getTime() - 7 * 86_400_000).toISOString();
    const month = new Date(app.clock().getTime() - 30 * 86_400_000).toISOString();
    const a = funnel(app.db, week);
    const b = funnel(app.db);
    const rows: Array<[string, number, number]> = [
      ['Визиты', a.visitors, b.visitors],
      ['Лиды', a.leads, b.leads],
      ['Анкеты', a.applied, b.applied],
      ['Горячие', a.qualified, b.qualified],
      ['В боте', a.tgLinked, b.tgLinked],
      ['Запрос оплаты', a.paymentRequested, b.paymentRequested],
      ['Оплаты', a.paid, b.paid],
      ['В чате', a.joined, b.joined],
    ];
    const table = ['Шаг            7 дн.   всё', ...rows.map(([l, x, y]) => `${l.padEnd(14)}${String(x).padStart(6)}${String(y).padStart(6)}`)].join('\n');
    const sources = bySource(app.db, month)
      .slice(0, 8)
      .map((s) => `• ${esc(s.src)}: ${s.leads} лид. → ${s.paid} опл. (${pct(s.paid, s.leads)})${s.spend && s.paid ? `, CAC ${Math.round(s.spend / s.paid)} ₸` : ''}`)
      .join('\n');
    await c.reply(
      `<b>📊 Воронка</b>\n<pre>${esc(table)}</pre>\nВыручка: ${b.revenue} ₸ · ${seatsLine(seatsTaken(app.db))}\nКонверсия визит→оплата: ${pct(b.paid, b.visitors)}\n\n<b>Каналы, 30 дн.</b>\n${sources || '—'}${env.ADMIN_PASSWORD ? `\n\nПодробно: ${esc(env.PUBLIC_URL)}/admin` : ''}`,
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
    );
  });

  adminCommand('lead', async (c, args) => {
    if (!args) return c.reply('Использование: /lead 12 или /lead 7011234567 или /lead @username');
    const found = findLeads(app.db, args);
    if (!found.length) return c.reply('Не найдено');
    for (const lead of found) {
      await c.reply(kit.leadCard(lead, `Лид #${lead.id}`), { parse_mode: 'HTML', reply_markup: kit.adminButtons(lead.paid_at ? 'paid' : 'payment_requested', lead) });
    }
  });

  adminCommand('paid', async (c, args) => {
    const [idRaw, amountRaw] = args.split(/\s+/);
    const lead = idRaw ? getLead(app.db, Number(idRaw)) : undefined;
    if (!lead) return c.reply('Использование: /paid <id лида> [сумма в тенге]');
    const amount = amountRaw ? Number(amountRaw.replace(/\D/g, '')) : undefined;
    const res = confirmPayment(app, lead, { amount, method: 'manual' });
    if (res.already) return c.reply('Уже оплачено');
    await c.reply(`✅ #${lead.id} отмечен как оплативший (${res.lead.paid_amount} ₸). ${seatsLine(seatsTaken(app.db))}`);
    await afterPaid(res.lead);
  });

  adminCommand('spend', async (c, args) => {
    const m = /^([a-z0-9_.\-]+)\s+(\d[\d\s]*)(?:\s+(\d{4}-\d{2}-\d{2}))?(?:\s+(.+))?$/i.exec(args);
    if (!m) return c.reply('Использование: /spend instagram 50000 [2026-10-05] [заметка]');
    const amount = Number(m[2]!.replace(/\s/g, ''));
    addSpend(app.db, m[3] ?? kzToday(app.clock()), m[1]!.toLowerCase(), amount, m[4] ?? null, app.clock().toISOString());
    await c.reply(`Записал расход: ${m[1]!.toLowerCase()} — ${amount} ₸`);
  });

  adminCommand('seats', (c) => c.reply(seatsLine(seatsTaken(app.db))));

  adminCommand('export', async (c) => {
    const cols = ['id', 'created_at', 'name', 'phone', 'tg_username', 'role', 'goal', 'schedule', 'timing', 'tier', 'src', 'med', 'cmp', 'applied_at', 'paid_at', 'paid_amount', 'lost_reason', 'project_idea'];
    const csv = toCsv(allLeads(app.db) as unknown as Array<Record<string, unknown>>, cols);
    await c.replyWithDocument(new InputFile(Buffer.from(csv, 'utf8'), `leads-${kzToday(app.clock())}.csv`));
  });

  adminCommand('broadcast', async (c) => {
    if (c.chat?.type !== 'private') return c.reply('Рассылку запускайте в личном чате с ботом.');
    const kb = new InlineKeyboard();
    for (const s of Object.keys(SEGMENT_LABEL) as Segment[]) kb.text(`${SEGMENT_LABEL[s]} (${audience(app.db, s, course.cohort.id).length})`, `bc:${s}`).row();
    kb.text('Отмена', 'bc:cancel');
    await c.reply('Кому отправить?', { reply_markup: kb });
  });

  bot.callbackQuery(/^bc:(students|hot|waitlist|all|go|cancel)$/, async (c) => {
    if (!kit.isAdmin(c.from.id)) return c.answerCallbackQuery();
    const action = c.match[1] as Segment | 'go' | 'cancel';
    await c.answerCallbackQuery();
    if (action === 'cancel') {
      drafts.delete(c.from.id);
      return c.editMessageText('Рассылка отменена.');
    }
    if (action !== 'go') {
      drafts.set(c.from.id, { segment: action, stage: 'message' });
      return c.editMessageText(`Сегмент: ${SEGMENT_LABEL[action]}.\nОтправьте сообщение для рассылки (текст, фото или видео) — я покажу, сколько получателей.`);
    }
    const draft = drafts.get(c.from.id);
    drafts.delete(c.from.id);
    if (!draft || draft.stage !== 'confirm' || !draft.fromChat || !draft.messageId) return c.editMessageText('Черновик не найден, начните заново: /broadcast');
    await c.editMessageText('Отправляю…');
    const leads = audience(app.db, draft.segment, course.cohort.id);
    let sent = 0;
    let failed = 0;
    for (const lead of leads) {
      try {
        await kit.bot.api.copyMessage(lead.tg_chat_id!, draft.fromChat, draft.messageId);
        sent++;
      } catch (err) {
        failed++;
        if (String(err).includes('403')) {
          app.db.prepare('UPDATE leads SET blocked_at = ? WHERE id = ?').run(app.clock().toISOString(), lead.id);
        }
      }
      await new Promise((r) => setTimeout(r, 50)); // stay well under Telegram's 30 msg/s limit
    }
    track(app, 'broadcast', { props: { segment: draft.segment, sent, failed } });
    await c.reply(`Готово: доставлено ${sent}, не доставлено ${failed}.`);
  });

  // ── Cohort chat joins ─────────────────────────────────────────────────────────────────────
  bot.on('chat_member', async (c) => {
    const upd = c.chatMember;
    if (!env.COHORT_CHAT_ID || upd.chat.id !== env.COHORT_CHAT_ID) return;
    const wasIn = ['member', 'administrator', 'creator'].includes(upd.old_chat_member.status);
    const isIn = ['member', 'administrator', 'creator'].includes(upd.new_chat_member.status);
    if (wasIn || !isIn) return;
    const lead = getLeadByTgUser(app.db, upd.new_chat_member.user.id);
    if (!lead) {
      await kit.toAdmins(`⚠️ В чат потока вошёл человек без оплаты в системе: ${esc(upd.new_chat_member.user.first_name)} (id ${upd.new_chat_member.user.id}). Проверьте.`);
      return;
    }
    if (markOnce(app.db, lead.id, 'joined_at', app.clock().toISOString())) track(app, 'joined_group', { lead });
    if (!lead.paid_at) await kit.toAdmins(`⚠️ #${lead.id} вошёл в чат потока без подтверждённой оплаты.`);
  });

  return { afterPaid, adminHeaders: ADMIN_HEADERS };
}
