import { Bot, GrammyError, InlineKeyboard } from 'grammy';
import type { InlineKeyboardMarkup, Message, ReplyKeyboardMarkup, ReplyKeyboardRemove } from 'grammy/types';
import { course, type Lang } from '../config/course';
import { content } from '../content/index';
import type { Content, Facts } from '../content/types';
import { updateLead, type Lead } from '../db/leads';
import { esc } from '../lib/html';
import { formatPhone, whatsappLink } from '../lib/phone';
import type { AdminEvent, AppContext } from '../services/context';
import { botFacts } from '../services/offer';
import { stage, TIER_LABEL } from '../services/stage';

export type Markup = InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove;

export interface Copy {
  c: Content;
  t: Content['bot'];
  f: Facts;
}

/** Shared helpers for the bot modules. */
export class BotKit {
  constructor(
    readonly bot: Bot,
    readonly ctx: AppContext,
  ) {}

  get env() {
    return this.ctx.env;
  }

  copy(lang: Lang): Copy {
    const c = content(lang);
    return { c, t: c.bot, f: botFacts(this.ctx, lang) };
  }

  isAdmin(userId: number | undefined): boolean {
    return userId !== undefined && this.env.ADMIN_IDS.includes(userId);
  }

  /** Sends HTML; marks the lead as blocked on 403 instead of throwing. */
  async send(chatId: number, html: string, markup?: Markup): Promise<Message.TextMessage | null> {
    try {
      return await this.bot.api.sendMessage(chatId, html, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: markup,
      });
    } catch (err) {
      if (err instanceof GrammyError && err.error_code === 403) {
        this.ctx.db.prepare('UPDATE leads SET blocked_at = ? WHERE tg_chat_id = ? AND blocked_at IS NULL').run(this.ctx.clock().toISOString(), chatId);
        return null;
      }
      this.ctx.log.error('telegram send failed', { chatId, err: String(err) });
      return null;
    }
  }

  async sendToLead(lead: Lead, html: string, markup?: Markup): Promise<boolean> {
    if (!lead.tg_chat_id || lead.blocked_at) return false;
    return (await this.send(lead.tg_chat_id, html, markup)) !== null;
  }

  async toAdmins(html: string, markup?: InlineKeyboardMarkup): Promise<Message.TextMessage | null> {
    if (!this.env.ADMIN_CHAT_ID) {
      this.ctx.log.warn('ADMIN_CHAT_ID not set; admin message dropped', { html });
      return null;
    }
    return this.send(this.env.ADMIN_CHAT_ID, html, markup);
  }

  setState(lead: Lead, state: string | null): Lead {
    return updateLead(this.ctx.db, lead.id, { bot_state: state }, this.ctx.clock().toISOString());
  }

  menu(lang: Lang): InlineKeyboard {
    const m = content(lang).bot.menu;
    return new InlineKeyboard()
      .text(m.apply, 'm:apply')
      .row()
      .text(m.program, 'm:program')
      .text(m.price, 'm:price')
      .row()
      .text(m.faq, 'm:faq')
      .text(m.human, 'm:human')
      .row()
      .text(m.switchLang, 'm:lang');
  }

  botLink(payload?: string): string | null {
    if (!this.ctx.botUsername) return null;
    return `https://t.me/${this.ctx.botUsername}${payload ? `?start=${payload}` : ''}`;
  }

  // ── Admin cards ────────────────────────────────────────────────────────────────────────────

  leadCard(lead: Lead, header: string, extra?: string): string {
    const ru = content('ru').apply.quiz;
    const label = (field: 'role' | 'goal' | 'schedule' | 'timing') => {
      const v = lead[field];
      return v ? (ru[field].options as Record<string, string>)[v] ?? v : '—';
    };
    const lines = [
      `<b>${esc(header)}</b>`,
      `${esc(lead.name ?? lead.tg_first_name ?? '—')}${lead.tg_username ? ` · @${esc(lead.tg_username)}` : ''} · ${lead.lang.toUpperCase()}`,
      lead.phone ? `📞 ${esc(formatPhone(lead.phone))}` : null,
      lead.role || lead.goal ? `👤 ${esc(label('role'))} → ${esc(label('goal'))}` : null,
      lead.schedule || lead.timing ? `🗓 Расписание: ${esc(label('schedule'))} · Старт: ${esc(label('timing'))}` : null,
      lead.tier ? `Оценка: ${TIER_LABEL[lead.tier]} (${lead.score ?? 0}/5)` : null,
      `Источник: ${esc([lead.src ?? '(direct)', lead.med, lead.cmp].filter(Boolean).join(' / '))}`,
      lead.referred_by ? `🤝 По рекомендации лида #${lead.referred_by}` : null,
      `Этап: ${esc(stage(lead))} · #${lead.id}`,
      extra ? esc(extra) : null,
    ];
    return lines.filter(Boolean).join('\n');
  }

  contactButtons(lead: Lead, kb = new InlineKeyboard()): InlineKeyboard {
    if (lead.phone) kb.url('WhatsApp', whatsappLink(lead.phone));
    if (lead.tg_username) kb.url('Telegram', `https://t.me/${lead.tg_username}`);
    return kb;
  }

  adminButtons(kind: AdminEvent, lead: Lead): InlineKeyboard {
    const kb = new InlineKeyboard();
    if (kind === 'payment_requested' && lead.payment_method === 'kaspi_invoice') kb.text('🧾 Счёт выставлен', `adm:inv:${lead.id}`);
    if (kind === 'payment_claimed') {
      kb.text('✅ Оплата есть', `adm:paid:${lead.id}`).text('❌ Не нашли', `adm:nf:${lead.id}`);
    } else if (kind === 'payment_requested') {
      kb.text('✅ Оплачено', `adm:paid:${lead.id}`);
    }
    if (kind !== 'paid') kb.row().text('✖️ Не целевой', `adm:lost:${lead.id}`);
    return this.contactButtons(lead, kb.row());
  }
}

export const ADMIN_HEADERS: Record<AdminEvent, (l: Lead) => string> = {
  lead: (l) => `🆕 Лид #${l.id} с сайта`,
  application: (l) => `📝 Анкета #${l.id}: ${l.tier ? TIER_LABEL[l.tier] : ''}`,
  tg_linked: (l) => `🔗 #${l.id} открыл бота`,
  payment_requested: (l) =>
    l.payment_method === 'kaspi_invoice'
      ? `💳 #${l.id} ждёт счёт Kaspi на ${l.phone ? formatPhone(l.phone) : '—'}`
      : `💳 #${l.id} открыл оплату (${l.payment_method === 'card_link' ? 'карта' : 'Kaspi-ссылка'})`,
  payment_claimed: (l) => `💰 #${l.id} говорит, что оплатил — проверьте поступление`,
  paid: (l) => `✅ #${l.id} оплатил`,
};

export function seatsLine(taken: number): string {
  return `Мест занято: ${taken} из ${course.cohort.capacity}`;
}
