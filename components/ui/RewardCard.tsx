import { cn } from '@/lib/cn';

/** Sticker-style reward with a die-cut white border. */
export function RewardCard({ emoji, name, isNew, owned = true, size = 'md' }: { emoji: string; name: string; isNew?: boolean; owned?: boolean; size?: 'sm' | 'md' }) {
  return (
    <figure className="relative flex flex-col items-center gap-1">
      <span
        className={cn('flex items-center justify-center rounded-full border-[5px] border-white bg-paper shadow-paper', size === 'md' ? 'h-24 w-24 text-5xl' : 'h-16 w-16 text-3xl', !owned && 'opacity-30 grayscale')}
        aria-hidden
      >
        {owned ? emoji : '?'}
      </span>
      {isNew && <span className="absolute -top-1 end-0 rounded-full bg-berry px-2 py-0.5 font-kid text-xs font-bold text-paper">NEW</span>}
      <figcaption className="max-w-[7rem] text-center font-kid text-sm leading-tight">{owned ? name : '…'}</figcaption>
    </figure>
  );
}
