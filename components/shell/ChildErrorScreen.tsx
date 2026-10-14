'use client';
import { Button } from '@/components/ui/Button';
import { translate } from '@/i18n';
import type { InterfaceLocale } from '@/types/core';

export function ChildErrorScreen({ onRetry, locale = 'en', mimo = 'Mimo' }: { onRetry: () => void; locale?: InterfaceLocale; mimo?: string }) {
  return (
    <div className="sky-night flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center font-kid">
      <div className="animate-bob text-[7rem]" aria-hidden>🥚</div>
      <p className="max-w-sm text-kid-xl font-bold text-paper">{translate(locale, 'error.child', { mimo })}</p>
      <Button size="lg" onClick={onRetry}>{translate(locale, 'error.retry')}</Button>
    </div>
  );
}
