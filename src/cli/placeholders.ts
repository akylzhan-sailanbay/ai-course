// Lists every missing course fact. Exits 1 if anything is missing — run before launch.
import { course, missingFacts } from '../config/course';
import { CONTENT } from '../content/index';
import { findPlaceholders } from '../lib/placeholders';

const missing = missingFacts(course);
const todos = [...findPlaceholders(course, 'course'), ...findPlaceholders(CONTENT.ru, 'ru'), ...findPlaceholders(CONTENT.kk, 'kk')];

if (!missing.length && !todos.length) {
  console.log('✓ All course facts are filled in.');
  process.exit(0);
}
console.log(`Missing facts (${missing.length + todos.length}):\n`);
for (const m of missing) console.log(`  • ${m}`);
for (const t of todos) console.log(`  • ${t.path}: ${t.text}`);
console.log('\nEdit src/config/course.ts (facts) or src/content/*.ts (copy).');
process.exit(1);
