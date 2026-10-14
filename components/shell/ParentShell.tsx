'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/store/app';
import { useT } from '@/hooks/useT';
import { Navigation } from '@/components/ui/Navigation';
import { ParentGate } from './ParentGate';
import { BootSplash } from './Providers';
import { publicConfig } from '@/lib/config';

/** Parent Zone frame: signed-in parent + parent gate. Visually distinct from the child world. */
export function ParentShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, children: kids, isParentUnlocked, signOut, pendingSync } = useApp();
  const { t, dir } = useT('parent');
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => { if (status === 'signed-out') router.replace('/auth/sign-in'); }, [status, router]);
  useEffect(() => { setUnlocked(isParentUnlocked()); }, [isParentUnlocked]);

  if (status !== 'ready') return <BootSplash />;
  // First-time setup (no children yet) doesn't need the gate: there is no child on the device yet.
  if (!unlocked && kids.length > 0) return <ParentGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div dir={dir} className="grown-up min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/parent" className="text-xl font-bold">🗝️ {t('parent.title')}</Link>
          {publicConfig.dataMode === 'local' && <span className="rounded-tab bg-paper-dark px-2 py-0.5 text-xs">Device mode</span>}
          {pendingSync > 0 && <span className="rounded-tab bg-lantern/40 px-2 py-0.5 text-xs">{t('offline.badge')}</span>}
          <div className="ms-auto flex items-center gap-2">
            {kids.length > 0 && <Link href="/who" className="rounded-tab bg-lantern px-3 py-2 font-bold text-night">{t('parent.backToKids')}</Link>}
            <button type="button" onClick={() => void signOut().then(() => router.replace('/welcome'))} className="rounded-tab px-3 py-2 font-bold text-ink-soft hover:bg-paper-dark">{t('parent.signOut')}</button>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2">
          <Navigation label={t('parent.title')} items={[
            { href: '/parent', label: t('parent.overview') },
            { href: '/parent/children', label: t('parent.children') },
            { href: '/parent/reports', label: t('parent.reports') },
            { href: '/parent/plan', label: t('parent.plan') },
            { href: '/parent/downloads', label: t('parent.downloads') },
            { href: '/parent/settings', label: t('parent.settings') },
          ]} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
