import type { InterfaceLocale } from '@/types/core';
import { en, type MessageKey, type Messages } from './messages/en';
import { ar } from './messages/ar';
import { fr } from './messages/fr';
import { de } from './messages/de';
import { it } from './messages/it';
import { es } from './messages/es';

const catalogs: Record<InterfaceLocale, Partial<Messages>> = { en, ar, fr, de, it, es };

export const LOCALE_NAMES: Record<InterfaceLocale, string> = { en: 'English', ar: 'العربية', fr: 'Français', de: 'Deutsch', it: 'Italiano', es: 'Español' };
export const RTL_LOCALES: InterfaceLocale[] = ['ar'];

export function translate(locale: InterfaceLocale, key: MessageKey, vars: Record<string, string | number> = {}): string {
  const raw = catalogs[locale]?.[key] ?? en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export function isRtl(locale: InterfaceLocale): boolean {
  return RTL_LOCALES.includes(locale);
}

/** Missing-key report for the CMS translation manager. */
export function translationCoverage(): Record<InterfaceLocale, { total: number; translated: number; missing: MessageKey[] }> {
  const keys = Object.keys(en) as MessageKey[];
  return Object.fromEntries(Object.entries(catalogs).map(([loc, cat]) => {
    const missing = keys.filter((k) => !(k in cat));
    return [loc, { total: keys.length, translated: keys.length - missing.length, missing }];
  })) as never;
}

export type { MessageKey };
