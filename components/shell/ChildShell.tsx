'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/store/app';
import { useT } from '@/hooks/useT';
import { BottomNavigation } from '@/components/ui/BottomNavigation';
import { AvatarFigure } from '@/components/ui/AvatarFigure';
import { StarIcon, LockIcon } from '@/components/ui/icons';
import { BootSplash } from './Providers';
import { MimoFigure } from '@/components/ui/MimoFigure';
import { cn } from '@/lib/cn';
import { toLocalDateKey } from '@/lib/time';

const FULLSCREEN = ['/play/journey', '/play/game', '/play/book', '/play/roleplay'];

export function ChildShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { status, childState, pendingSync, addFreePlay } = useApp();
  const { t, dir } = useT();
  const [online, setOnline] = useState(true);
  const lastTick = useRef(Date.now());

  useEffect(() => {
    if (status === 'signed-out') router.replace('/welcome');
    else if (status === 'ready' && !childState) router.replace('/who');
    else if (childState && !childState.child.onboarded) router.replace('/child/onboarding');
  }, [status, childState, router]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  // Free-play time (everything except the core journey) is tracked separately from learning time.
  const inJourney = path.startsWith('/play/journey');
  useEffect(() => {
    lastTick.current = Date.now();
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible' || inJourney) { lastTick.current = Date.now(); return; }
      const ms = Date.now() - lastTick.current;
      lastTick.current = Date.now();
      void addFreePlay(Math.min(ms, 65_000));
    }, 60_000);
    return () => clearInterval(id);
  }, [inJourney, addFreePlay]);

  if (!childState || !childState.child.onboarded) return <BootSplash />;
  const s = childState.child.settings;
  const full = FULLSCREEN.some((p) => path.startsWith(p));

  // Soft screen-time limit set by the parent: a calm rest screen, never a countdown.
  const today = toLocalDateKey(new Date());
  const usedMin = childState.sessions.filter((x) => x.date === today).reduce((sum, x) => sum + x.learningMs + x.freePlayMs, 0) / 60000;
  const resting = s.screenTimeLimitMinutes !== null && usedMin >= s.screenTimeLimitMinutes && !inJourney;

  return (
    <div dir={dir} className={cn('kid sky-night relative flex min-h-dvh flex-col overflow-hidden text-paper',
      s.largeText && 'kid-large-text', s.dyslexiaFont && 'kid-dyslexic', s.highContrast && 'kid-contrast', s.reducedMotion && 'reduce-motion')}>
      {!full && (
        <header className="relative z-20 flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <Link href="/play/me" aria-label={t('nav.me')} className="overflow-hidden rounded-full bg-paper shadow-paper-sm">
            <AvatarFigure config={childState.child.avatar} size={44} withBackground={false} />
          </Link>
          <Link href="/play/rewards" className="flex items-center gap-1.5 rounded-full bg-night-500 px-3 py-1.5 font-bold shadow-night" aria-label={t('nav.rewards')}>
            <StarIcon width={20} height={20} className="text-lantern" />
            <span className="tabular-nums">{childState.inventory.stars}</span>
            {childState.inventory.newRewardIds.length > 0 && <span className="h-2.5 w-2.5 rounded-full bg-berry" aria-hidden />}
          </Link>
          {(!online || pendingSync > 0) && <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{t('offline.badge')}</span>}
          <Link href="/parent" className="ms-auto flex items-center gap-1 rounded-full px-3 py-2 text-xs text-paper/60 hover:text-paper" aria-label={t('nav.grownups')}>
            <LockIcon width={14} height={14} /> {t('nav.grownups')}
          </Link>
        </header>
      )}
      <main className={cn('relative z-10 flex flex-1 flex-col', !full && 'pb-2')}>
        {resting ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <MimoFigure companion={childState.companion} action="sleep" size={180} />
            <p className="max-w-sm text-kid-xl font-bold">{t('home.doneToday')}</p>
            <p className="max-w-sm text-paper/80">{t('home.doneTodayHint')}</p>
          </div>
        ) : children}
      </main>
      {!full && <div className="relative z-20"><BottomNavigation /></div>}
    </div>
  );
}
