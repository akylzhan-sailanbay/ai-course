import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { kvGet, kvSet, type DB } from '../db/index';
import { kzParts, kzToday } from '../lib/time';
import type { Logger } from './context';

// Daily consistent snapshot of the SQLite file (VACUUM INTO), keeping the last 14.
// Copy /data/backups off the server too (see docs/DEPLOY.md) — a backup on the same disk is not enough.

export function backupNow(db: DB, dir: string, day: string): string {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `app-${day}.db`);
  rmSync(file, { force: true });
  db.prepare('VACUUM INTO ?').run(file);
  const old = readdirSync(dir)
    .filter((f) => /^app-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort()
    .slice(0, -14);
  for (const f of old) rmSync(join(dir, f), { force: true });
  return file;
}

export function startDailyBackup(db: DB, dir: string, log: Logger, clock: () => Date = () => new Date()): () => void {
  const tick = () => {
    const now = clock();
    const day = kzToday(now);
    if (kzParts(now).hour < 4 || kvGet(db, 'backup:last') === day) return;
    try {
      const file = backupNow(db, dir, day);
      kvSet(db, 'backup:last', day);
      log.info('backup written', { file });
    } catch (err) {
      log.error('backup failed', { err: String(err) });
    }
  };
  const timer = setInterval(tick, 10 * 60_000);
  tick();
  return () => clearInterval(timer);
}
