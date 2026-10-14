'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useT } from '@/hooks/useT';
import { useApp } from '@/store/app';
import { companionEngine } from '@/companions/CompanionEngine';
import { getServices } from '@/services';
import { trackIdOf } from '@/learning-engine/track';
import type { NavItem } from '@/types/content';

/**
 * Five big paper tokens, chosen by the child's track: Little Explorers get Books & Music instead of
 * Explore & Create; Heroes get Books instead of Mimo. Icons carry meaning; labels are short.
 */
export function BottomNavigation() {
  const path = usePathname();
  const { t } = useT();
  const companion = useApp((s) => s.childState?.companion);
  const child = useApp((s) => s.childState?.child);
  const nav: NavItem[] = child ? getServices().content.track(trackIdOf(child)).navigation : ['adventure', 'explore', 'play', 'create', 'mimo'];
  const all: Record<NavItem, { href: string; icon: string; label: string; match?: (p: string) => boolean }> = {
    adventure: { href: '/play', icon: '🗝️', label: t('nav.adventure'), match: (p: string) => p === '/play' || p.startsWith('/play/journey') },
    explore: { href: '/play/explore', icon: '🗺️', label: t('nav.explore') },
    play: { href: '/play/games', icon: '🎲', label: t('nav.play'), match: (p: string) => p.startsWith('/play/games') || p.startsWith('/play/game') },
    create: { href: '/play/create', icon: '🎨', label: t('nav.create') },
    mimo: { href: '/play/mimo', icon: companion ? companionEngine.form(companion) : '🥚', label: t('nav.mimo') },
    books: { href: '/play/library', icon: '📚', label: t('nav.books'), match: (p: string) => p.startsWith('/play/library') || p.startsWith('/play/book') },
    music: { href: '/play/music', icon: '🎵', label: t('nav.music') },
  };
  const items = nav.map((n) => all[n]);
  return (
    <nav aria-label="Main" className="pointer-events-auto mx-auto flex w-full max-w-xl items-end justify-around gap-1 px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
      {items.map((it) => {
        const active = it.match ? it.match(path) : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? 'page' : undefined} title={it.label}
            className="flex min-w-[64px] flex-col items-center gap-1 font-kid text-xs font-bold text-paper">
            <span className={cn('flex h-14 w-14 items-center justify-center rounded-full text-3xl transition-transform',
              active ? '-translate-y-1 bg-lantern shadow-lantern' : 'bg-night-500 shadow-night')}>{it.icon}</span>
            <span className={cn(active ? 'text-lantern' : 'text-paper/80')}>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
