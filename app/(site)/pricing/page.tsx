import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { PricingTable } from '@/components/site/PricingTable';
import { PAYMENT_METHODS } from '@/billing/pricing';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Start free. Premium unlocks every world, story, game and language. Pay by card, mobile wallet or Fawry in Egypt.',
};

const FAQ: [string, ReactNode][] = [
  ['Is there a free plan?', 'Yes. The free plan includes one daily adventure per child, the starter worlds, 15 games and a weekly report — no card needed.'],
  ['How do I pay in Egypt?', 'By bank card (Visa, Mastercard, Meeza), mobile wallet (Vodafone Cash, Orange Cash, Etisalat Cash, WE Pay…) or cash at any Fawry or Aman outlet. Payments are processed securely by Paymob; we never see your card details.'],
  ['Does it renew automatically?', 'Card payments renew automatically at the end of each month or year until you turn auto-renewal off in the Parent Zone (one tap). Wallet and Fawry/Aman payments are prepaid and never renew — buy again to add more time.'],
  ['Can I cancel?', <>Any time, from Parent Zone → Plan. Premium stays active until the end of the period you paid for. See the <Link className="underline" href="/legal/refunds">refund policy</Link>.</>],
  ['Do prices differ by age track?', 'No. Every plan includes all three tracks — Little Explorers, Adventurers and Heroes — and each child gets the track that fits them.'],
  ['Are there ads or in-app purchases for children?', 'Never. Children never see prices or purchase prompts. Payments live only in the Parent Zone, behind a parent check.'],
];

export default function PricingPage() {
  return (
    <main className="grown-up px-4 py-14">
      <div className="mx-auto max-w-6xl">
        <header className="text-center">
          <h1 className="text-4xl font-bold sm:text-5xl">Simple plans for the whole family</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-soft">Start free. Upgrade when your child is hooked — and cancel any time.</p>
        </header>
        <div className="mt-10"><PricingTable /></div>

        <section className="mt-16" aria-labelledby="pay-title">
          <h2 id="pay-title" className="text-center text-3xl font-bold">Ways to pay</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PAYMENT_METHODS.map((m) => (
              <div key={m.id} className="rounded-tab bg-white p-5">
                <p className="text-3xl" aria-hidden>{m.icon}</p>
                <h3 className="mt-2 text-xl font-bold">{m.label.en}</h3>
                <p className="mt-1 text-ink-soft">{m.detail.en}</p>
                <p className="mt-2 text-sm font-bold">{m.recurring ? 'Auto-renews · cancel any time' : 'Prepaid · no auto-renewal'} · {m.currencies.join(' / ')}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl" aria-labelledby="faq-title">
          <h2 id="faq-title" className="text-center text-3xl font-bold">Questions</h2>
          <div className="mt-6 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="rounded-tab bg-white p-4">
                <summary className="cursor-pointer text-lg font-bold">{q}</summary>
                <p className="mt-2 text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
