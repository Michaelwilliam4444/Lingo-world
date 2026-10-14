'use client';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'lantern' | 'berry' | 'lagoon' | 'paper' | 'night' | 'ghost' | 'parent' | 'parent-quiet' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
  lantern: 'bg-lantern text-night shadow-lantern active:shadow-none',
  berry: 'bg-berry text-paper shadow-berry active:shadow-none',
  lagoon: 'bg-lagoon text-night shadow-lagoon active:shadow-none',
  paper: 'bg-paper text-ink shadow-paper active:shadow-none',
  night: 'bg-night-500 text-paper shadow-night active:shadow-none',
  ghost: 'bg-transparent text-paper hover:bg-white/10',
  parent: 'bg-night text-paper hover:bg-night-600 rounded-tab font-read font-bold',
  'parent-quiet': 'bg-transparent text-ink border-2 border-ink/20 hover:border-ink/50 rounded-tab font-read font-bold',
  danger: 'bg-berry-dark text-paper hover:bg-berry rounded-tab font-read font-bold',
};
const SIZES: Record<Size, string> = {
  sm: 'min-h-[40px] px-4 text-base',
  md: 'min-h-[52px] px-6 text-kid-base',
  lg: 'min-h-[64px] px-8 text-kid-lg',
  xl: 'min-h-[80px] px-10 text-kid-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
}

/** Large, tactile button. Pressing "squashes" it onto its paper shadow. Min touch target 52px (kid). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'lantern', size = 'md', icon, block, className, children, type = 'button', ...rest }, ref,
) {
  const kid = !variant.startsWith('parent') && variant !== 'danger';
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center gap-3 transition-transform duration-100 ease-bounce disabled:opacity-50 disabled:pointer-events-none',
        kid && 'rounded-blob font-kid font-bold active:translate-y-[5px]',
        VARIANTS[variant], SIZES[size], block && 'w-full', className,
      )}
      {...rest}
    >
      {icon && <span aria-hidden className="text-[1.3em] leading-none">{icon}</span>}
      {children}
    </button>
  );
});

export function IconButton({ label, children, className, tone = 'paper', size = 56, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { label: string; children: ReactNode; tone?: 'paper' | 'night' | 'lantern' | 'lagoon' | 'berry'; size?: number }) {
  const tones = {
    paper: 'bg-paper text-ink shadow-paper-sm', night: 'bg-night-500 text-paper shadow-night', lantern: 'bg-lantern text-night shadow-lantern',
    lagoon: 'bg-lagoon text-night shadow-lagoon', berry: 'bg-berry text-paper shadow-berry',
  };
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-kid text-2xl transition-transform active:translate-y-[3px] active:shadow-none disabled:opacity-40', tones[tone], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
