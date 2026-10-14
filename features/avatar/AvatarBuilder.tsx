'use client';
import { useState } from 'react';
import type { AvatarConfig } from '@/types/learner';
import { AvatarFigure } from '@/components/ui/AvatarFigure';
import { LockIcon } from '@/components/ui/icons';
import { AVATAR_OPTIONS, isUnlocked } from './catalog';
import { cn } from '@/lib/cn';

const SLOTS: { slot: keyof AvatarConfig; icon: string }[] = [
  { slot: 'skin', icon: '🖐️' }, { slot: 'hair', icon: '💇' }, { slot: 'hairColor', icon: '🎨' }, { slot: 'face', icon: '🙂' },
  { slot: 'outfit', icon: '👕' }, { slot: 'shoes', icon: '👟' }, { slot: 'accessory', icon: '🎀' }, { slot: 'background', icon: '🏞️' },
];

/** Tap-only avatar builder: icon tabs, colour swatches, no reading needed. Locked items show how to earn them. */
export function AvatarBuilder({ value, onChange, ownedRewards, premium }: { value: AvatarConfig; onChange: (c: AvatarConfig) => void; ownedRewards: string[]; premium: boolean }) {
  const [slot, setSlot] = useState<keyof AvatarConfig>('skin');
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-4 md:flex-row md:items-start">
      <div className="shrink-0 rounded-blob shadow-night"><AvatarFigure config={value} size={170} /></div>
      <div className="flex w-full flex-col gap-3">
        <div role="tablist" className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {SLOTS.map((s) => (
            <button key={s.slot} role="tab" aria-selected={slot === s.slot} aria-label={s.slot} type="button" onClick={() => setSlot(s.slot)}
              className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl', slot === s.slot ? 'bg-lantern shadow-lantern' : 'bg-night-500 shadow-night')}>
              {s.icon}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="grid grid-cols-4 gap-3 rounded-blob bg-paper p-4 shadow-paper sm:grid-cols-5">
          {AVATAR_OPTIONS[slot].map((o) => {
            const ok = isUnlocked(o, ownedRewards, premium);
            const selected = value[slot] === o.id;
            return (
              <button key={o.id} type="button" disabled={!ok} aria-pressed={selected} aria-label={o.label}
                onClick={() => onChange({ ...value, [slot]: o.id })}
                className={cn('relative flex aspect-square items-center justify-center rounded-token text-3xl text-ink shadow-paper-sm', selected ? 'ring-4 ring-lagoon' : '', !ok && 'opacity-40')}
                style={{ background: o.color ?? '#fff' }}>
                {o.emoji ?? (slot === 'face' ? o.label : slot === 'hair' ? '💇' : '')}
                {!ok && <span className="absolute bottom-1 end-1 text-night"><LockIcon width={16} height={16} /></span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
