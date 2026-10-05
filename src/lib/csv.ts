// CSV export opened in Excel/Sheets: escape quotes and neutralise formula injection (=, +, -, @, tab, CR).

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c])).join(','));
  // BOM so Excel opens Cyrillic correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}
