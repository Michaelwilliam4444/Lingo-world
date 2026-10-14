'use client';
import type { World } from '@/types/content';
import { cn } from '@/lib/cn';
import { LockIcon } from './icons';

/** A world as a floating paper island. */
export function WorldCard({ world, name, locked, premiumLocked, onClick, compact }: { world: World; name: string; locked?: boolean; premiumLocked?: boolean; onClick?: () => void; compact?: boolean }) {
  const [a, b] = world.palette;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      aria-label={name}
      className={cn('group relative flex flex-col items-center gap-2 text-center transition-transform active:translate-y-[4px]', locked && 'opacity-60')}
    >
      <span
        className={cn('relative flex items-center justify-center rounded-[45%_55%_50%_50%/55%_45%_55%_45%] shadow-night', compact ? 'h-24 w-24 text-5xl' : 'h-32 w-32 text-6xl sm:h-36 sm:w-36')}
        style={{ background: `linear-gradient(160deg, ${a}, ${b})` }}
      >
        <span className={cn('drop-shadow-[0_4px_0_rgba(0,0,0,0.25)]', locked && 'grayscale')}>{world.emoji}</span>
        {(locked || premiumLocked) && (
          <span className="absolute -bottom-1 -end-1 flex h-10 w-10 items-center justify-center rounded-full bg-night text-lantern shadow-night">
            <LockIcon width={20} height={20} />
          </span>
        )}
      </span>
      <span className="max-w-[9rem] font-kid text-kid-sm font-bold leading-tight text-paper">{name}</span>
    </button>
  );
}
