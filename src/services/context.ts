import type { DB } from '../db/index';
import type { Env } from '../env';
import type { Lead } from '../db/leads';

export type AdminEvent =
  | 'lead'
  | 'application'
  | 'tg_linked'
  | 'payment_requested'
  | 'payment_claimed'
  | 'paid';

/** Implemented by the Telegram bot; a logging no-op when the bot is not configured. */
export interface AdminNotifier {
  leadEvent(kind: AdminEvent, lead: Lead, extra?: { duplicateOf?: Lead; note?: string }): Promise<void>;
  text(html: string): Promise<void>;
}

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface AppContext {
  db: DB;
  env: Env;
  clock: () => Date;
  admin: AdminNotifier;
  log: Logger;
  fetch: typeof fetch;
  /** Filled from BOT_USERNAME or getMe() once the bot starts; used for t.me links on the site. */
  botUsername?: string;
}

export const consoleLogger: Logger = {
  info: (msg, meta) => console.log(JSON.stringify({ level: 'info', msg, ...meta, t: new Date().toISOString() })),
  warn: (msg, meta) => console.warn(JSON.stringify({ level: 'warn', msg, ...meta, t: new Date().toISOString() })),
  error: (msg, meta) => console.error(JSON.stringify({ level: 'error', msg, ...meta, t: new Date().toISOString() })),
};

export function logOnlyAdmin(log: Logger): AdminNotifier {
  return {
    async leadEvent(kind, lead) {
      log.info('admin notification (bot not configured)', { kind, leadId: lead.id });
    },
    async text(html) {
      log.info('admin text (bot not configured)', { html });
    },
  };
}
