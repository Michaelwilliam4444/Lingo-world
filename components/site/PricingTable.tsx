'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PLANS } from '@/billing/plans';
import { CURRENCIES, PLAN_MONTHS, formatPrice, guessCurrency, monthlyEquivalent, type Currency } from '@/billing/pricing';
import { cn } from '@/lib/cn';

const KEY = 'lw.currency';

/** Public price table with an EGP / USD switch (defaults to EGP in Egypt). */
export function PricingTable() {
  const [currency, setCurrency] = useState<Currency>('EGP');
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
    setCurrency(saved === 'EGP' || saved === 'USD' ? saved : guessCurrency());
  }, []);
  const pick = (c: Currency) => { setCurrency(c); try { localStorage.setItem(KEY, c); } catch { /* ignore */ } };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-center gap-3" role="radiogroup" aria-label="Currency">
        {CURRENCIES.map((c) => (
          <button key={c} role="radio" aria-checked={currency === c} onClick={() => pick(c)}
            className={cn('rounded-full border-2 px-5 py-2 font-bold', currency === c ? 'border-night bg-night text-paper' : 'border-ink/20 bg-white')}>
            {c === 'EGP' ? '🇪🇬 Egyptian pound (EGP)' : '🌍 US dollar (USD)'}
          </button>
        ))}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => (
          <section key={p.id} className={cn('relative flex flex-col rounded-tab border-2 bg-white p-6', p.highlight ? 'border-night shadow-lg' : 'border-ink/10')}>
            {p.highlight && <span className="absolute -top-3 start-6 rounded-full bg-lantern px-3 py-0.5 text-sm font-bold">Best value</span>}
            <h2 className="text-xl font-bold">{p.name.en}</h2>
            <p className="mt-2 text-4xl font-bold tabular-nums">{formatPrice(p.id, currency)}<span className="text-base font-normal text-ink-soft">{p.period ? ` / ${p.period}` : ''}</span></p>
            <p className="h-5 text-sm text-ink-soft">{p.id !== 'free' && PLAN_MONTHS[p.id] === 12 ? `≈ ${monthlyEquivalent(p.id, currency)} ${currency} a month` : ''}</p>
            <p className="mt-2 text-sm font-bold">Up to {p.seats} children · all 3 age tracks</p>
            <ul className="mt-4 flex-1 space-y-1.5">{p.features.map((f) => <li key={f.en}>✓ {f.en}</li>)}</ul>
            <Link href="/auth/sign-up" className={cn('mt-6 rounded-full px-5 py-3 text-center font-bold', p.id === 'free' ? 'border-2 border-ink/20' : 'bg-night text-paper')}>
              {p.id === 'free' ? 'Start free' : `Start free, then upgrade`}
            </Link>
          </section>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-ink-soft">
        {currency === 'EGP' ? 'Prices in Egyptian pounds include applicable taxes.' : 'USD prices are charged by card. Your bank may apply currency conversion fees.'}
      </p>
    </div>
  );
}
