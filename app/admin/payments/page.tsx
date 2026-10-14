'use client';
import { useEffect, useMemo, useState } from 'react';
import { publicConfig } from '@/lib/config';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { MetricCard, ParentCard } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { PLANS } from '@/billing/plans';
import type { Money, PaymentRow, RevenueReport } from '@/billing/revenue';
import { cn } from '@/lib/cn';

const PLAN_NAME = Object.fromEntries(PLANS.map((p) => [p.id, p.name.en])) as Record<string, string>;
const METHOD = { card: '💳 Card', wallet: '📱 Wallet', kiosk: '🏪 Fawry / Aman' } as const;
const STATUS_STYLE: Record<PaymentRow['status'], string> = {
  paid: 'bg-lagoon-light text-lagoon-dark', pending: 'bg-lantern/40 text-ink', failed: 'bg-berry/15 text-berry-dark', refunded: 'bg-ink/10 text-ink-soft', voided: 'bg-ink/10 text-ink-soft',
};

function fmt(m: Money | undefined): string {
  const entries = Object.entries(m ?? {}).filter(([, v]) => v);
  if (!entries.length) return '0';
  return entries.map(([c, v]) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(v)).join(' + ');
}

async function authHeaders(): Promise<Record<string, string>> {
  if (publicConfig.dataMode !== 'supabase') return {};
  const token = (await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Owner-only: money collected, subscribers and every payment. Access is enforced by /api/admin/payments. */
export default function PaymentsPage() {
  const [data, setData] = useState<{ sample: boolean; report: RevenueReport } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | PaymentRow['status']>('all');
  const [q, setQ] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [shown, setShown] = useState(30);

  const load = async () => {
    setError(null);
    const res = await fetch('/api/admin/payments', { headers: await authHeaders(), cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error ?? 'Not allowed'); return; }
    setData(body);
  };
  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => (data?.report.recent ?? []).filter((p) => (status === 'all' || p.status === status)
    && (!q || `${p.customer ?? ''} ${p.reference} ${p.provider_transaction_id ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [data, status, q]);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/admin/payments?format=csv', { headers: await authHeaders() });
      if (!res.ok) throw new Error('Download failed');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = `lingoworld-payments-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError((e as Error).message); } finally { setDownloading(false); }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-xl rounded-tab bg-white p-6">
        <h1 className="text-2xl font-bold">🔒 Payments</h1>
        <p className="mt-2 text-ink-soft">{error}</p>
      </div>
    );
  }
  if (!data) return <p className="text-ink-soft">Loading payments…</p>;
  const r = data.report;
  const maxMonth = Math.max(1, ...r.monthly.map((m) => Object.values(m.amount).reduce((a, b) => a + b, 0)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-ink-soft">Only you (the owner) can see this page. Money is paid out by Paymob to your bank account — see payouts in your <a className="underline" href="https://accept.paymob.com" target="_blank" rel="noopener">Paymob dashboard</a>.</p>
        </div>
        <div className="ms-auto flex gap-2">
          <Button variant="parent-quiet" className="h-10 px-4" onClick={() => void load()}>Refresh</Button>
          <Button variant="parent" className="h-10 px-4" disabled={downloading} onClick={() => void download()}>{downloading ? '…' : '⬇ Download Excel (CSV)'}</Button>
        </div>
      </div>
      {data.sample && <p className="rounded-tab bg-lantern/30 p-3 text-sm"><b>Sample data.</b> This installation is in device mode. Once the site runs on Supabase with Paymob, this page shows your real payments.</p>}

      <ParentCard title="Money collected">
        <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
          <MetricCard label="Today" value={fmt(r.collected.today)} />
          <MetricCard label="This month" value={fmt(r.collected.thisMonth)} detail={Object.keys(r.refunded.thisMonth).length ? `${fmt(r.refunded.thisMonth)} refunded` : undefined} />
          <MetricCard label="Last 30 days" value={fmt(r.collected.last30)} />
          <MetricCard label="All time" value={fmt(r.collected.allTime)} detail={`${r.counts.paid} payments`} />
        </div>
        <p className="mt-2 text-xs text-ink-soft">Before Paymob fees. Refunded payments are excluded.</p>
        <div className="mt-5" aria-label="Collected per month, last 12 months">
          <div className="flex h-40 items-end gap-1.5">
            {r.monthly.map((m) => {
              const total = Object.values(m.amount).reduce((a, b) => a + b, 0);
              return (
                <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${m.month}: ${fmt(m.amount)} (${m.count} payments)`}>
                  <div className="w-full rounded-t bg-lagoon-dark" style={{ height: `${Math.max(2, (total / maxMonth) * 100)}%` }} />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-1.5 text-[10px] text-ink-soft">{r.monthly.map((m) => <span key={m.month} className="flex-1 text-center">{new Date(`${m.month}-01T00:00:00Z`).toLocaleString('en', { month: 'short' })}</span>)}</div>
        </div>
      </ParentCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <ParentCard title="Subscribers">
          <p className="text-4xl font-bold">{r.subscribers.active}</p>
          <p className="text-ink-soft">families with Premium now</p>
          <ul className="mt-3 space-y-1">
            {(['premium_monthly', 'premium_annual', 'family'] as const).map((p) => <li key={p} className="flex justify-between"><span>{PLAN_NAME[p]}</span><b>{r.subscribers.byPlan[p]}</b></li>)}
          </ul>
        </ParentCard>
        <ParentCard title="Renewals to watch">
          <ul className="space-y-1.5">
            <li className="flex justify-between"><span>🔁 Auto-renewing (card)</span><b>{r.subscribers.autoRenew}</b></li>
            <li className="flex justify-between"><span>🧾 Prepaid (wallet / Fawry)</span><b>{r.subscribers.prepaid}</b></li>
            <li className="flex justify-between"><span>⏳ Ending in the next 7 days</span><b>{r.subscribers.endingSoon}</b></li>
            <li className="flex justify-between"><span>⚠️ Card renewal failing</span><b className={r.subscribers.pastDue ? 'text-berry-dark' : ''}>{r.subscribers.pastDue}</b></li>
            <li className="flex justify-between"><span>✋ Turned off auto-renewal</span><b>{r.subscribers.cancelling}</b></li>
          </ul>
        </ParentCard>
        <ParentCard title="How families pay">
          <ul className="space-y-1.5">
            {(['card', 'wallet', 'kiosk'] as const).map((m) => <li key={m} className="flex justify-between gap-2"><span>{METHOD[m]}</span><span><b>{r.byMethod[m].count}</b> · {fmt(r.byMethod[m].amount)}</span></li>)}
          </ul>
          <h3 className="mt-4 font-bold">By plan</h3>
          <ul className="mt-1 space-y-1.5">
            {(['premium_monthly', 'premium_annual', 'family'] as const).map((p) => <li key={p} className="flex justify-between gap-2"><span>{PLAN_NAME[p]}</span><span><b>{r.byPlan[p].count}</b> · {fmt(r.byPlan[p].amount)}</span></li>)}
          </ul>
        </ParentCard>
      </div>

      <ParentCard title={`All payments (${r.recent.length}${r.recent.length >= 200 ? ', latest 200 — download for all' : ''})`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(['all', 'paid', 'pending', 'failed', 'refunded'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} aria-pressed={status === s}
              className={cn('rounded-full border-2 px-3 py-1 text-sm font-bold capitalize', status === s ? 'border-night bg-night text-paper' : 'border-ink/15 bg-white')}>
              {s}{s !== 'all' ? ` (${s === 'failed' ? r.counts.failed : r.counts[s]})` : ''}
            </button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer or reference" aria-label="Search payments"
            className="ms-auto w-full rounded-tab border-2 border-ink/15 px-3 py-1.5 sm:w-64" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b-2 border-ink/10 text-start text-ink-soft">
              {['Date', 'Customer', 'Plan', 'Method', 'Amount', 'Status', 'Reference'].map((h) => <th key={h} className="px-2 py-2 text-start font-bold">{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.slice(0, shown).map((p) => (
                <tr key={p.id} className="border-b border-ink/5">
                  <td className="whitespace-nowrap px-2 py-2">{new Date(p.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="px-2 py-2">{p.customer}</td>
                  <td className="px-2 py-2">{PLAN_NAME[p.plan]}{p.kind === 'renewal' ? ' · renewal' : ''}</td>
                  <td className="whitespace-nowrap px-2 py-2">{METHOD[p.method]}</td>
                  <td className="whitespace-nowrap px-2 py-2 font-bold tabular-nums">{fmt({ [p.currency]: p.amount_cents / 100 })}</td>
                  <td className="px-2 py-2"><span className={cn('rounded-full px-2 py-0.5 text-xs font-bold capitalize', STATUS_STYLE[p.status])} title={p.failure_reason ?? undefined}>{p.status}</span></td>
                  <td className="px-2 py-2 font-mono text-xs text-ink-soft">{p.provider_transaction_id ?? p.reference}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="px-2 py-6 text-center text-ink-soft">No payments match.</td></tr>}
            </tbody>
          </table>
        </div>
        {rows.length > shown && <Button variant="parent-quiet" className="mt-3 h-10 px-4" onClick={() => setShown((n) => n + 50)}>Show more ({rows.length - shown} left)</Button>}
        <p className="mt-3 text-xs text-ink-soft">To refund a payment, find its Paymob transaction number in your Paymob dashboard and refund it there — LingoWorld ends that family’s Premium automatically.</p>
      </ParentCard>
    </div>
  );
}
