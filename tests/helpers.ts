import type { UserFromGetMe } from 'grammy/types';
import { createBot } from '../src/bot/index';
import { openDb } from '../src/db/index';
import { loadEnv, type Env } from '../src/env';
import type { AppContext, Logger } from '../src/services/context';
import { logOnlyAdmin } from '../src/services/context';

export const silent: Logger = { info: () => {}, warn: () => {}, error: () => {} };

export function makeCtx(envOverrides: Record<string, string> = {}, now = new Date('2026-10-05T07:00:00Z')): AppContext & { setNow(d: Date): void } {
  let current = now;
  const env: Env = loadEnv({ NODE_ENV: 'test', PUBLIC_URL: 'https://soberi.test', ...envOverrides });
  const ctx = {
    db: openDb(':memory:'),
    env,
    clock: () => current,
    admin: logOnlyAdmin(silent),
    log: silent,
    fetch: (async () => new Response('{}')) as typeof fetch,
    setNow(d: Date) {
      current = d;
    },
  };
  return ctx;
}

export const BOT_INFO = {
  id: 999,
  is_bot: true,
  first_name: 'Soberi',
  username: 'soberi_test_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
} as unknown as UserFromGetMe;

export const ADMIN = { id: 500, first_name: 'Admin', username: 'boss' };
export const ADMIN_CHAT = -100500;
export const COHORT_CHAT = -100777;

export interface ApiCall {
  method: string;
  payload: Record<string, unknown>;
}

/** Bot wired to a fake Telegram API that records every call. */
export function makeBot(envOverrides: Record<string, string> = {}, now?: Date) {
  const ctx = makeCtx(
    {
      BOT_TOKEN: '123:TEST',
      ADMIN_IDS: String(ADMIN.id),
      ADMIN_CHAT_ID: String(ADMIN_CHAT),
      COHORT_CHAT_ID: String(COHORT_CHAT),
      ZOOM_URL: 'https://zoom.us/j/123',
      ...envOverrides,
    },
    now,
  );
  const rt = createBot(ctx, { botInfo: BOT_INFO });
  ctx.admin = rt.notifier;
  ctx.botUsername = BOT_INFO.username;
  const calls: ApiCall[] = [];
  let nextId = 1000;
  rt.bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    const p = payload as Record<string, unknown>;
    let result: unknown = true;
    if (method === 'sendMessage') result = { message_id: nextId++, date: 0, chat: { id: p.chat_id, type: 'private' }, text: p.text };
    if (method === 'copyMessage') result = { message_id: nextId++ };
    if (method === 'createChatInviteLink') {
      result = { invite_link: `https://t.me/+invite${nextId++}`, creator: BOT_INFO, creates_join_request: false, is_primary: false, is_revoked: false };
    }
    return { ok: true, result } as never;
  });

  let updateId = 1;
  const user = (id: number, first_name = 'Айгерим', extra: Record<string, unknown> = {}) => ({ id, is_bot: false, first_name, language_code: 'ru', ...extra });

  const send = async (from: ReturnType<typeof user>, text: string, extra: Record<string, unknown> = {}, chat?: { id: number; type: string }) => {
    const command = text.startsWith('/') ? text.split(' ')[0]!.length : 0;
    await rt.bot.handleUpdate({
      update_id: updateId++,
      message: {
        message_id: updateId++,
        date: Math.floor(Date.now() / 1000),
        chat: chat ?? { id: from.id, type: 'private', first_name: from.first_name },
        from,
        text,
        ...(command ? { entities: [{ type: 'bot_command', offset: 0, length: command }] } : {}),
        ...extra,
      },
    } as never);
  };

  const click = async (from: ReturnType<typeof user>, data: string, chatId = from.id) => {
    await rt.bot.handleUpdate({
      update_id: updateId++,
      callback_query: {
        id: String(updateId++),
        from,
        chat_instance: 'x',
        data,
        message: { message_id: 42, date: 0, chat: { id: chatId, type: chatId < 0 ? 'supergroup' : 'private' }, text: 'card text' },
      },
    } as never);
  };

  const sentTo = (chatId: number) => calls.filter((c) => c.method === 'sendMessage' && c.payload.chat_id === chatId);
  const lastTextTo = (chatId: number) => String(sentTo(chatId).at(-1)?.payload.text ?? '');
  const buttons = (call?: ApiCall) => {
    const markup = call?.payload.reply_markup as { inline_keyboard?: Array<Array<{ text: string; callback_data?: string; url?: string }>> } | undefined;
    return (markup?.inline_keyboard ?? []).flat();
  };

  return { ctx, rt, calls, user, send, click, sentTo, lastTextTo, buttons };
}
