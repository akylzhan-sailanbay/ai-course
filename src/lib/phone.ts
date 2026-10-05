// Phone numbers are the main identifier in Kazakhstan (Kaspi invoices and WhatsApp both use them).

/** Normalizes to E.164. Accepts KZ formats (8 701…, +7 (701)…, 7701…, 701…) and other +country numbers. */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 32) return null;
  if (!/^[+\d\s()\-.]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+') && !digits.startsWith('7')) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  if (digits.length !== 11 || !digits.startsWith('7')) return null;
  // Country code 7 is shared by KZ (6xx/7xx) and RU (3xx/4xx/8xx/9xx); both are fine, but reject obvious junk.
  if (/^7(\d)\1{9}$/.test(digits)) return null;
  return `+${digits}`;
}

/** '+77012345678' → '+7 701 234 56 78' */
export function formatPhone(e164: string): string {
  const m = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+7 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}

export function whatsappLink(e164: string, text?: string): string {
  const base = `https://wa.me/${e164.replace(/\D/g, '')}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
