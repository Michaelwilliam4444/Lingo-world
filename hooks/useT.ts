'use client';
import { useCallback } from 'react';
import type { InterfaceLocale } from '@/types/core';
import { translate, type MessageKey } from '@/i18n';
import { useApp } from '@/store/app';

/** Translation hook. 'child' uses the active child's interface locale; 'parent' the parent's. */
export function useT(scope: 'child' | 'parent' = 'child') {
  const childLocale = useApp((s) => s.childState?.child.interfaceLocale);
  const parentLocale = useApp((s) => s.parent?.interfaceLocale);
  const mimo = useApp((s) => s.childState?.companion.name ?? 'Mimo');
  const locale: InterfaceLocale = (scope === 'child' ? childLocale ?? parentLocale : parentLocale ?? childLocale) ?? 'en';
  const t = useCallback((key: MessageKey, vars: Record<string, string | number> = {}) => translate(locale, key, { mimo, ...vars }), [locale, mimo]);
  return { t, locale, dir: locale === 'ar' ? ('rtl' as const) : ('ltr' as const) };
}
