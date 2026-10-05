// Missing facts are written as [[TODO: what is missing]] so they are impossible to miss on the page
// (highlighted), in /admin (listed) and in `npm run check:placeholders` (fails CI before launch).

export const PLACEHOLDER_RE = /\[\[TODO:\s*([^\]]*?)\s*\]\]/g;

export function todo(what: string): string {
  return `[[TODO: ${what}]]`;
}

export function hasPlaceholder(value: string): boolean {
  PLACEHOLDER_RE.lastIndex = 0;
  return PLACEHOLDER_RE.test(value);
}

/** Splits text into plain parts and placeholder parts, for highlighted rendering. */
export function splitPlaceholders(text: string): Array<{ text: string; todo: boolean }> {
  const parts: Array<{ text: string; todo: boolean }> = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), todo: false });
    parts.push({ text: m[1] ?? '', todo: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), todo: false });
  return parts;
}

/** Walks any object/array tree and returns every string that still contains a placeholder. */
export function findPlaceholders(node: unknown, path = ''): Array<{ path: string; text: string }> {
  if (typeof node === 'string') {
    return hasPlaceholder(node) ? [{ path, text: node }] : [];
  }
  if (Array.isArray(node)) {
    return node.flatMap((v, i) => findPlaceholders(v, `${path}[${i}]`));
  }
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => findPlaceholders(v, path ? `${path}.${k}` : k));
  }
  return [];
}

/** Removes placeholder markup for plain-text channels (Telegram), keeping the description visible. */
export function plainPlaceholders(text: string): string {
  return text.replace(PLACEHOLDER_RE, (_m, what: string) => `[${what}]`);
}
