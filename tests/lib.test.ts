import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { course } from '../src/config/course';
import { CONTENT } from '../src/content/index';
import { parseSourcePayload } from '../src/lib/attribution';
import { csvCell, toCsv } from '../src/lib/csv';
import { safeEqual, newToken } from '../src/lib/ids';
import { formatPhone, normalizePhone } from '../src/lib/phone';
import { findPlaceholders, splitPlaceholders, todo } from '../src/lib/placeholders';
import { qualify } from '../src/lib/scoring';
import { cohortSessions, formatWeekdays, isWorkingHours, kzDateTime, kzParts } from '../src/lib/time';
import { typo } from '../src/web/app';

describe('phone', () => {
  it('normalizes Kazakh formats to E.164', () => {
    for (const raw of ['8 701 234 56 78', '+7 (701) 234-56-78', '87012345678', '7012345678', '77012345678', '+77012345678']) {
      assert.equal(normalizePhone(raw), '+77012345678', raw);
    }
  });
  it('accepts other countries only with a plus', () => {
    assert.equal(normalizePhone('+996 555 123 456'), '+996555123456');
    assert.equal(normalizePhone('996555123456'), null);
  });
  it('rejects junk', () => {
    for (const raw of ['', '123', '8 701 234 56', 'phone', '+7 777 777 77 77', '<script>', '1'.repeat(40)]) {
      assert.equal(normalizePhone(raw), null, raw);
    }
  });
  it('formats for humans', () => {
    assert.equal(formatPhone('+77012345678'), '+7 701 234 56 78');
  });
});

describe('qualification', () => {
  it('is hot when the person can attend and wants the next cohort', () => {
    assert.equal(qualify({ role: 'business', goal: 'site', schedule: 'yes', timing: 'now' }).tier, 'hot');
    assert.equal(qualify({ role: 'other', goal: 'explore', schedule: 'partly', timing: 'now' }).tier, 'hot');
  });
  it('is warm when they want it later or cannot make the schedule', () => {
    assert.equal(qualify({ role: 'business', goal: 'site', schedule: 'no', timing: 'now' }).tier, 'warm');
    assert.equal(qualify({ role: 'business', goal: 'site', schedule: 'yes', timing: 'soon' }).tier, 'warm');
  });
  it('is cold for "just looking"', () => {
    assert.equal(qualify({ role: 'business', goal: 'site', schedule: 'yes', timing: 'later' }).tier, 'cold');
  });
  it('scores 0–5', () => {
    assert.equal(qualify({ role: 'business', goal: 'site', schedule: 'yes', timing: 'now' }).score, 5);
    assert.equal(qualify({ role: 'business', goal: 'explore', schedule: 'no', timing: 'later' }).score, 0);
  });
});

describe('attribution', () => {
  it('parses bot source payloads', () => {
    assert.deepEqual(parseSourcePayload('s_instagram__bio'), { source: 'instagram', medium: 'telegram_bot', campaign: 'bio' });
    assert.deepEqual(parseSourcePayload('s_tiktok'), { source: 'tiktok', medium: 'telegram_bot', campaign: undefined });
    assert.equal(parseSourcePayload('a_token'), null);
    assert.equal(parseSourcePayload('s_<script>'), null);
  });
});

describe('placeholders', () => {
  it('splits text for highlighting', () => {
    assert.deepEqual(splitPlaceholders(`Цена: ${todo('цена')} ₸`), [
      { text: 'Цена: ', todo: false },
      { text: 'цена', todo: true },
      { text: ' ₸', todo: false },
    ]);
  });
  it('finds placeholders anywhere in the config tree', () => {
    const found = findPlaceholders({ a: [{ b: todo('x') }], c: 'ok' });
    assert.deepEqual(found, [{ path: 'a[0].b', text: '[[TODO: x]]' }]);
  });
});

describe('csv', () => {
  it('neutralises spreadsheet formulas and quotes', () => {
    assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
    assert.equal(csvCell('+77012345678'), "'+77012345678");
    assert.equal(csvCell('a,b'), '"a,b"');
    assert.ok(toCsv([{ a: 1 }], ['a']).startsWith('﻿a\r\n1'));
  });
});

describe('ids', () => {
  it('makes Telegram-safe tokens', () => {
    const t = newToken();
    assert.match(t, /^[A-Za-z0-9_-]{22}$/);
    assert.ok(`a_${t}`.length <= 64);
  });
  it('compares secrets', () => {
    assert.ok(safeEqual('secret-value', 'secret-value'));
    assert.ok(!safeEqual('secret-value', 'secret-valuE'));
  });
});

describe('time (Kazakhstan, UTC+5)', () => {
  it('converts KZ local time', () => {
    assert.equal(kzDateTime('2026-11-02', '19:30').toISOString(), '2026-11-02T14:30:00.000Z');
    assert.equal(kzParts(new Date('2026-11-02T14:30:00Z')).hour, 19);
  });
  it('generates 12 sessions on Mon/Wed/Fri with Demo Day last', () => {
    const sessions = cohortSessions({ ...course, cohort: { ...course.cohort, startDate: '2026-11-02' } });
    assert.equal(sessions.length, 12);
    assert.deepEqual(
      sessions.slice(0, 4).map((s) => s.startsAt.toISOString()),
      ['2026-11-02T14:30:00.000Z', '2026-11-04T14:30:00.000Z', '2026-11-06T14:30:00.000Z', '2026-11-09T14:30:00.000Z'],
    );
    assert.equal(sessions.at(-1)!.isDemoDay, true);
    assert.equal(sessions.at(-1)!.week, 4);
  });
  it('knows working hours', () => {
    assert.ok(isWorkingHours(new Date('2026-10-05T07:00:00Z'), { from: 10, to: 21 })); // 12:00
    assert.ok(!isWorkingHours(new Date('2026-10-05T17:00:00Z'), { from: 10, to: 21 })); // 22:00
  });
  it('formats weekdays in both languages', () => {
    assert.equal(formatWeekdays([1, 3, 5], 'ru'), 'пн, ср, пт');
    assert.equal(formatWeekdays([1, 3, 5], 'kk'), 'дс, ср, жм');
  });
});

describe('typography', () => {
  it('glues dashes and numbers in text but never touches tags or scripts', () => {
    const out = typo('<h1 id="x">Первый сайт — за 60 минут</h1><script>var a = 1 b</script>');
    assert.equal(out, '<h1 id="x">Первый сайт\u00A0— за 60\u00A0минут</h1><script>var a = 1 b</script>');
  });
});

describe('content', () => {
  it('has the same FAQ and curriculum shape in both languages', () => {
    assert.equal(CONTENT.ru.curriculum.weeks.length, CONTENT.kk.curriculum.weeks.length);
    assert.equal(CONTENT.ru.projects.items.length, CONTENT.kk.projects.items.length);
    for (let i = 0; i < CONTENT.ru.curriculum.weeks.length; i++) {
      assert.equal(CONTENT.ru.curriculum.weeks[i]!.sessions.length, CONTENT.kk.curriculum.weeks[i]!.sessions.length);
    }
  });
});
