'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/** Parent Zone / admin navigation: plain text tabs, current page underlined. */
export function Navigation({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const path = usePathname();
  return (
    <nav aria-label={label} className="no-scrollbar flex gap-1 overflow-x-auto">
      {items.map((it) => {
        const active = it.href === path || (it.href !== '/parent' && it.href !== '/admin' && path.startsWith(it.href));
        return (
          <Link key={it.href} href={it.href} aria-current={active ? 'page' : undefined}
            className={cn('whitespace-nowrap rounded-tab px-3 py-2 font-read text-[15px] font-bold', active ? 'bg-night text-paper' : 'text-ink-soft hover:bg-paper-dark')}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
