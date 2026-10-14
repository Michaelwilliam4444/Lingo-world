/**
 * AI safety utilities. Children's text is screened and redacted BEFORE any provider call,
 * and every model output is validated against an allow-list or sanitised before use.
 */

const PII_PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
  [/https?:\/\/\S+|www\.\S+/gi, '[link]'],
  [/(?:\+?\d[\s-]?){7,}/g, '[number]'],
  [/@\w{2,}/g, '[handle]'],
  [/\b\d{1,5}\s+\w+\s+(street|st|road|rd|avenue|ave|lane|ln|rue|straße|strasse|via|calle|شارع)\b/gi, '[address]'],
];

// Small, conservative blocklist; production deployments should add a provider moderation call.
const UNSAFE = [/\bkill\b/i, /\bsuicide\b/i, /\bsex\b/i, /\bnaked\b/i, /\bgun\b/i, /\bdrugs?\b/i, /\bmeet me\b/i, /\bsecret\b.*\bdon'?t tell\b/i];

export interface ScreenResult { safe: boolean; redacted: string; reasons: string[] }

export function screenChildText(text: string, maxLength = 200): ScreenResult {
  const reasons: string[] = [];
  let redacted = text.slice(0, maxLength);
  for (const [re, token] of PII_PATTERNS) {
    if (re.test(redacted)) reasons.push(`pii:${token}`);
    redacted = redacted.replace(re, token);
  }
  const unsafe = UNSAFE.some((re) => re.test(text));
  if (unsafe) reasons.push('unsafe-content');
  return { safe: !unsafe, redacted, reasons };
}

/** Model output must be one of the allowed ids; otherwise the caller uses its deterministic fallback. */
export function validateChoice<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** For parent-facing prose only: strip markup and links, cap length. Never shown to children. */
export function sanitizeParentText(text: string, max = 600): string {
  return text.replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function extractJson(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as Record<string, unknown>; } catch { return null; }
}
