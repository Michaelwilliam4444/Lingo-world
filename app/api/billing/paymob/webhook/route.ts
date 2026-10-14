import { NextResponse } from 'next/server';
import { serverConfig } from '@/lib/server-config';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifyTransactionHmac } from '@/billing/paymob-hmac';
import { classifyTransaction, grantPaidPeriod, merchantReference, revokeForRefund, seatsFor, type PaymobTransaction, type SubscriptionRow } from '@/billing/paymobEvents';
import type { PlanId } from '@/types/core';

/**
 * Paymob "transaction processed" callback — the ONLY way a Paymob payment grants access.
 *  1. verify the HMAC (query ?hmac=…) over the documented transaction fields
 *  2. find our payment by the reference we sent (merchant order id) or by Paymob's order id
 *  3. idempotently record the result and extend/revoke access with the service role
 * Always answers 200 for authentic-but-irrelevant events so Paymob does not retry forever.
 */
export async function POST(req: Request) {
  const secret = serverConfig.paymob.hmacSecret;
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 501 });
  const body = (await req.json().catch(() => null)) as { type?: string; obj?: PaymobTransaction } | null;
  const tx = body?.obj;
  const hmac = new URL(req.url).searchParams.get('hmac');
  if (!tx || !verifyTransactionHmac(tx as unknown as Record<string, unknown>, hmac, secret)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }
  if (body?.type && body.type !== 'TRANSACTION') return NextResponse.json({ ignored: body.type });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'no service role' }, { status: 501 });

  const reference = merchantReference(tx);
  const orderId = typeof tx.order === 'object' ? tx.order?.id : tx.order;
  let q = admin.from('payments').select('*').eq('provider', 'paymob');
  q = reference ? q.eq('reference', reference) : q.eq('provider_order_id', String(orderId ?? ''));
  const { data: payment } = await q.maybeSingle();
  if (!payment) return NextResponse.json({ ignored: 'unknown payment' }); // e.g. a MOTO renewal — handled by the subscription callback

  const status = classifyTransaction(tx);
  const txId = String(tx.id);
  if (payment.status === status && payment.provider_transaction_id === txId) return NextResponse.json({ ok: true, duplicate: true });
  if (status === 'paid' && (tx.amount_cents !== payment.amount_cents || tx.currency !== payment.currency)) {
    await admin.from('payments').update({ status: 'failed', failure_reason: 'amount/currency mismatch', provider_transaction_id: txId }).eq('id', payment.id);
    return NextResponse.json({ error: 'amount mismatch' }, { status: 200 });
  }
  if (payment.status === 'paid' && status === 'failed') return NextResponse.json({ ok: true, ignored: 'late failure after success' });

  const now = new Date();
  await admin.from('payments').update({
    status, provider_transaction_id: txId, ...(status === 'paid' ? { paid_at: now.toISOString() } : {}),
    ...(status === 'failed' ? { failure_reason: (tx.data?.message ?? 'declined').slice(0, 200) } : {}),
  }).eq('id', payment.id);

  const { data: sub } = await admin.from('subscriptions').select('plan,status,current_period_end,cancel_at_period_end,provider_subscription_id').eq('parent_id', payment.parent_id).maybeSingle();
  const current = (sub as SubscriptionRow | null) ?? null;
  let next: SubscriptionRow | null = null;
  if (status === 'paid' && payment.status !== 'paid') next = grantPaidPeriod(current, payment.plan as Exclude<PlanId, 'free'>, payment.period_months as number, now);
  if ((status === 'refunded' || status === 'voided') && current && payment.status === 'paid') next = revokeForRefund(current, now);
  if (next) {
    await admin.from('subscriptions').upsert({
      parent_id: payment.parent_id, plan: next.plan, status: next.status, provider: 'paymob', current_period_end: next.current_period_end,
      cancel_at_period_end: next.cancel_at_period_end ?? false, seats: seatsFor(next.plan), payment_method: payment.method,
      provider_subscription_id: next.provider_subscription_id ?? null,
    });
  }
  return NextResponse.json({ received: true, status });
}
