import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Parent Zone panel with a heading; content first, decoration last. */
export function ParentCard({ title, children, className, action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn('rounded-tab border border-ink/10 bg-white p-5', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A single number with its label beneath; used sparingly in rows, never as the page hero. */
export function MetricCard({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <span className="text-2xl font-bold tabular-nums text-ink">{value}</span>
      <span className="text-sm text-ink-soft">{label}</span>
      {detail && <span className="text-xs text-ink-faint">{detail}</span>}
    </div>
  );
}

export function SkillBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm text-ink-soft">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-paper-dark" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className="h-full rounded-full bg-lagoon-dark" style={{ width: `${Math.max(2, value)}%` }} />
      </div>
      <span className="w-10 text-end text-sm tabular-nums text-ink-soft">{value}</span>
    </div>
  );
}
