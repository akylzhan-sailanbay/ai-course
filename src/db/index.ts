import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type DB = DatabaseSync;

// Append-only migrations; the index + 1 is stored in PRAGMA user_version.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    ref_code TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'ru',
    channel TEXT NOT NULL,
    cohort TEXT,
    name TEXT,
    phone TEXT,
    anon_id TEXT,
    tg_user_id INTEGER UNIQUE,
    tg_chat_id INTEGER,
    tg_username TEXT,
    tg_first_name TEXT,
    role TEXT,
    goal TEXT,
    schedule TEXT,
    timing TEXT,
    tier TEXT,
    score INTEGER,
    project_idea TEXT,
    bot_state TEXT,
    payment_method TEXT,
    paid_amount INTEGER,
    referred_by INTEGER REFERENCES leads(id),
    src TEXT, med TEXT, cmp TEXT, cnt TEXT, trm TEXT,
    click_id TEXT, referrer TEXT, landing TEXT,
    last_src TEXT, last_med TEXT, last_cmp TEXT,
    quiz_started_at TEXT,
    applied_at TEXT,
    qualified_at TEXT,
    tg_linked_at TEXT,
    payment_requested_at TEXT,
    invoice_sent_at TEXT,
    payment_claimed_at TEXT,
    paid_at TEXT,
    onboarded_at TEXT,
    joined_at TEXT,
    lost_at TEXT,
    lost_reason TEXT,
    opted_out_at TEXT,
    blocked_at TEXT,
    notes TEXT
  );
  CREATE INDEX leads_phone ON leads(phone);
  CREATE INDEX leads_anon ON leads(anon_id);
  CREATE INDEX leads_created ON leads(created_at);
  CREATE INDEX leads_src ON leads(src);

  CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    name TEXT NOT NULL,
    anon_id TEXT,
    lead_id INTEGER,
    src TEXT, med TEXT, cmp TEXT,
    path TEXT,
    props TEXT
  );
  CREATE INDEX events_name_ts ON events(name, ts);
  CREATE INDEX events_lead ON events(lead_id);

  CREATE TABLE reminders (
    lead_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    PRIMARY KEY (lead_id, kind)
  );

  CREATE TABLE support_links (
    admin_msg_id INTEGER PRIMARY KEY,
    lead_id INTEGER NOT NULL,
    user_chat_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE ad_spend (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    src TEXT NOT NULL,
    amount INTEGER NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `,
];

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

function migrate(db: DB) {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[v]!);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

/** node:sqlite rejects `undefined`; map it to NULL. Booleans become 0/1. */
export function params<T extends Record<string, unknown>>(obj: T): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) out[k] = null;
    else if (typeof v === 'boolean') out[k] = v ? 1 : 0;
    else if (typeof v === 'number' || typeof v === 'string') out[k] = v;
    else out[k] = JSON.stringify(v);
  }
  return out;
}

export function kvGet(db: DB, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function kvSet(db: DB, key: string, value: string) {
  db.prepare('INSERT INTO kv(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
