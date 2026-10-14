import { cn } from '@/lib/cn';

/** Journey progress as a trail of footprints; the current step glows. */
export function ProgressIndicator({ total, current, label }: { total: number; current: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={current} className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn('h-3 rounded-full transition-all', i < current ? 'w-3 bg-lantern' : i === current ? 'w-6 bg-lantern shadow-glow' : 'w-3 bg-white/25')}
        />
      ))}
    </div>
  );
}

export function GrowthRing({ value, size = 120, children }: { value: number; size?: number; children: React.ReactNode }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.15)" strokeWidth="10" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#ffc94a" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
