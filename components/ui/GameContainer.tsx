'use client';
import type { ReactNode } from 'react';
import { IconButton } from './Button';
import { CloseIcon } from './icons';
import { ProgressIndicator } from './ProgressIndicator';

/** Frame shared by every mini-game: exit, round progress, hint slot, and the play area. */
export function GameContainer({ title, emoji, round, total, onExit, exitLabel, hints, children }: { title: string; emoji: string; round: number; total: number; onExit?: () => void; exitLabel: string; hints?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex h-full w-full flex-col">
      <header className="flex items-center gap-3 px-4 pt-3">
        {onExit && <IconButton label={exitLabel} tone="night" size={48} onClick={onExit}><CloseIcon /></IconButton>}
        <h2 className="flex items-center gap-2 font-kid text-kid-base font-bold text-paper"><span aria-hidden>{emoji}</span>{title}</h2>
        <div className="ms-auto"><ProgressIndicator total={total} current={round} label={`${round} / ${total}`} /></div>
      </header>
      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 p-4">{children}</div>
      {hints && <footer className="flex flex-wrap items-center justify-center gap-3 pb-4">{hints}</footer>}
    </section>
  );
}
