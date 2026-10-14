import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Paper card for the child world (solid cut-paper edge) or a quiet panel for grown-ups. */
export function Card({ tone = 'paper', className, ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: 'paper' | 'night' | 'parent' }) {
  const tones = {
    paper: 'bg-paper text-ink rounded-blob shadow-paper',
    night: 'bg-night-600/80 text-paper rounded-blob shadow-night',
    parent: 'bg-white text-ink rounded-tab border border-ink/10',
  };
  return <div className={cn(tones[tone], className)} {...rest} />;
}
