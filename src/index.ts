import { dirname, join } from 'node:path';
import { serve } from '@hono/node-server';
import { createBot } from './bot/index';
import { startReminders } from './bot/reminders';
import { openDb } from './db/index';
import { loadEnv } from './env';
import { startDailyBackup } from './services/backup';
import { consoleLogger, logOnlyAdmin, type AppContext } from './services/context';
import { createWebApp, readiness } from './web/app';

async function main() {
  const env = loadEnv();
  const log = consoleLogger;
  const db = openDb(env.DATABASE_PATH);
  const ctx: AppContext = { db, env, log, clock: () => new Date(), fetch, admin: logOnlyAdmin(log), botUsername: env.BOT_USERNAME };

  const ready = readiness(ctx);
  const gaps = ready.missing.length + ready.placeholders.length;
  if (gaps) log.warn(`${gaps} course facts are still missing — see /admin or run npm run check:placeholders`);

  const bot = env.BOT_TOKEN ? createBot(ctx) : null;
  if (bot) ctx.admin = bot.notifier;
  else log.warn('BOT_TOKEN not set: site works, Telegram bot and notifications are disabled');

  const app = createWebApp(ctx, { webhook: bot?.webhook });
  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => log.info('http listening', { port: info.port, url: env.PUBLIC_URL }));

  const stops: Array<() => void> = [startDailyBackup(db, env.BACKUP_DIR ?? join(dirname(env.DATABASE_PATH), 'backups'), log)];
  if (bot) {
    try {
      await bot.start();
      stops.push(startReminders(bot));
    } catch (err) {
      log.error('bot failed to start — check BOT_TOKEN', { err: String(err) });
    }
  }

  const shutdown = async (signal: string) => {
    log.info('shutting down', { signal });
    stops.forEach((s) => s());
    await bot?.stop().catch(() => undefined);
    server.close();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
