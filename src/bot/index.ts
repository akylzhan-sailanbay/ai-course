import type { Context as HonoContext } from 'hono';
import { Bot, InlineKeyboard, webhookCallback } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import { course } from '../config/course';
import { content } from '../content/index';
import { markOnce, type Lead } from '../db/leads';
import { esc } from '../lib/html';
import { track } from '../services/analytics';
import type { AdminNotifier, AppContext } from '../services/context';
import { registerAdminHandlers } from './admin';
import { ADMIN_HEADERS, BotKit } from './kit';
import { registerUserHandlers } from './user';

const ALLOWED_UPDATES = ['message', 'callback_query', 'chat_member', 'my_chat_member'] as const;

export interface BotRuntime {
  bot: Bot;
  kit: BotKit;
  notifier: AdminNotifier;
  onboard(lead: Lead): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  webhook?: (c: HonoContext) => Promise<Response>;
}

export function createBot(app: AppContext, opts: { botInfo?: UserFromGetMe } = {}): BotRuntime {
  const { env } = app;
  if (!env.BOT_TOKEN) throw new Error('BOT_TOKEN is required to create the bot');
  const bot = new Bot(env.BOT_TOKEN, opts.botInfo ? { botInfo: opts.botInfo } : undefined);
  const kit = new BotKit(bot, app);

  async function onboard(lead: Lead) {
    const { t, f } = kit.copy(lead.lang);
    let invite: string | null = null;
    if (env.COHORT_CHAT_ID) {
      try {
        const link = await bot.api.createChatInviteLink(env.COHORT_CHAT_ID, {
          name: `lead-${lead.id}`,
          member_limit: 1,
          expire_date: Math.floor(app.clock().getTime() / 1000) + 14 * 86_400,
        });
        invite = link.invite_link;
      } catch (err) {
        app.log.error('invite link failed — is the bot an admin of the cohort chat?', { err: String(err) });
      }
    }
    invite ??= env.COHORT_INVITE_URL ?? null;
    await kit.sendToLead(lead, t.onboarding.welcome(f, invite ? esc(invite) : null, course.tools.map(esc)));
    kit.setState(lead, 'await_project');
    await kit.sendToLead(lead, t.onboarding.askProject, new InlineKeyboard().text(t.onboarding.skip, 'ob:skip'));
    if (markOnce(app.db, lead.id, 'onboarded_at', app.clock().toISOString())) track(app, 'onboarded', { lead });
  }

  // Order matters: admin handlers see messages first and pass everything else on.
  registerAdminHandlers(bot, kit, onboard);
  registerUserHandlers(bot, kit);

  bot.catch((err) => app.log.error('bot handler failed', { update: err.ctx.update.update_id, err: String(err.error) }));

  const notifier: AdminNotifier = {
    async leadEvent(kind, lead, extra) {
      // "Opened the bot" is only worth a ping for hot leads; everything else is in /stats.
      if (kind === 'tg_linked' && lead.tier !== 'hot') return;
      const dup = extra?.duplicateOf ? `⚠️ Этот номер уже оставлял заявку: лид #${extra.duplicateOf.id}` : extra?.note;
      await kit.toAdmins(kit.leadCard(lead, ADMIN_HEADERS[kind](lead), dup), kit.adminButtons(kind, lead));
    },
    async text(html) {
      await kit.toAdmins(html);
    },
  };

  async function setCommands() {
    for (const lang of ['ru', 'kk'] as const) {
      const m = content(lang).bot.menu;
      const strip = (s: string) => s.replace(/^\S+\s/, '');
      const commands = [
        { command: 'start', description: lang === 'kk' ? 'Басты мәзір' : 'Главное меню' },
        { command: 'apply', description: strip(m.apply) },
        { command: 'program', description: strip(m.program) },
        { command: 'price', description: strip(m.price) },
        { command: 'faq', description: strip(m.faq) },
        { command: 'help', description: strip(m.human) },
        { command: 'invite', description: lang === 'kk' ? 'Досты шақыру' : 'Пригласить друга' },
        { command: 'lang', description: lang === 'kk' ? 'Тілді ауыстыру' : 'Сменить язык' },
      ];
      await bot.api.setMyCommands(commands, lang === 'kk' ? { language_code: 'kk' } : undefined);
    }
    const adminCommands = [
      { command: 'stats', description: 'Воронка и каналы' },
      { command: 'lead', description: 'Найти лида' },
      { command: 'paid', description: 'Подтвердить оплату вручную' },
      { command: 'spend', description: 'Записать расход на рекламу' },
      { command: 'seats', description: 'Занятые места' },
      { command: 'export', description: 'CSV со всеми лидами' },
      { command: 'admin', description: 'Справка' },
    ];
    if (env.ADMIN_CHAT_ID) await bot.api.setMyCommands(adminCommands, { scope: { type: 'chat', chat_id: env.ADMIN_CHAT_ID } });
    for (const id of env.ADMIN_IDS) {
      await bot.api
        .setMyCommands([...adminCommands, { command: 'broadcast', description: 'Рассылка' }], { scope: { type: 'chat', chat_id: id } })
        .catch(() => undefined); // admin hasn't opened the bot yet
    }
  }

  const runtime: BotRuntime = {
    bot,
    kit,
    notifier,
    onboard,
    async start() {
      await bot.init();
      app.botUsername = env.BOT_USERNAME ?? bot.botInfo.username;
      await setCommands().catch((err) => app.log.warn('setMyCommands failed', { err: String(err) }));
      if (env.BOT_MODE === 'webhook') {
        await bot.api.setWebhook(`${env.PUBLIC_URL}/telegram/webhook`, {
          secret_token: env.TELEGRAM_WEBHOOK_SECRET,
          allowed_updates: [...ALLOWED_UPDATES],
        });
        app.log.info('bot webhook set', { username: app.botUsername });
      } else {
        void bot.start({
          allowed_updates: [...ALLOWED_UPDATES],
          onStart: (info) => app.log.info('bot polling started', { username: info.username }),
        });
      }
    },
    async stop() {
      if (bot.isRunning()) await bot.stop();
    },
  };
  if (env.BOT_MODE === 'webhook') {
    const handle = webhookCallback(bot, 'hono', { secretToken: env.TELEGRAM_WEBHOOK_SECRET });
    runtime.webhook = (c) => handle(c) as Promise<Response>;
  }
  return runtime;
}
