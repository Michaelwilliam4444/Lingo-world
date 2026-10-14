'use client';
import { useEffect, type ReactNode } from 'react';
import { useApp } from '@/store/app';
import { isRtl } from '@/i18n';
import { ErrorBoundary } from './ErrorBoundary';
import { ChildErrorScreen } from './ChildErrorScreen';

/** Boots the app once, keeps <html lang/dir> in sync with the active locale, registers the service worker. */
export function Providers({ children }: { children: ReactNode }) {
  const boot = useApp((s) => s.boot);
  const childLocale = useApp((s) => s.childState?.child.interfaceLocale);
  const parentLocale = useApp((s) => s.parent?.interfaceLocale);

  useEffect(() => { void boot(); }, [boot]);

  useEffect(() => {
    const locale = childLocale ?? parentLocale ?? 'en';
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr';
  }, [childLocale, parentLocale]);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);

  return <ErrorBoundary fallback={(reset) => <ChildErrorScreen onRetry={reset} locale={childLocale ?? 'en'} />}>{children}</ErrorBoundary>;
}

export function BootSplash() {
  return (
    <div className="sky-night flex min-h-dvh flex-col items-center justify-center gap-4 font-kid text-paper" role="status" aria-label="Loading">
      <div className="animate-bob text-7xl" aria-hidden>🗝️</div>
      <p className="text-kid-lg font-bold">LingoWorld</p>
    </div>
  );
}
