import { NextResponse } from 'next/server';
import { serverConfig } from '@/lib/server-config';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { verifySubscriptionHmac } from '@/billing/paymob-hmac';
import { applySubscriptionEvent, seatsFor, type SubscriptionEvent, type SubscriptionRow } from '@/billing/paymobEvents';
import type { PlanId } from '@/types/core';

/**
 * Paymob subscription callback (card auto-renewal lifecycle): created, successful/failed deductions,
 * suspended, resumed, canceled. HMAC = SHA-512("{trigger_type}for{subscription_id}").
 * Configure this URL as the subscription plan's webhook_url (scripts/paymob-plans.ts does it).
 */
export async function POST(req: Request) {
  const secret = serverConfig.paymob.hmacSecret;
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 501 });
  const body = (await req.json().catch(() => null)) as (SubscriptionEvent & { hmac?: string }) | null;
  if (!body || !verifySubscriptionHmac(body, secret)) return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'no service role' }, { status: 501 });

  const subId = String(body.subscription_data.id);
  // Find the family: by subscription id (known after the first callback) or by the first payment's transaction.
  let parentId: string | null = null;
  let plan: Exclude<PlanId, 'free'> | null = null;
  const bySub = await admin.from('payments').select('parent_id,plan').eq('provider', 'paymob').eq('provider_subscription_id', subId).limit(1).maybeSingle();
  if (bySub.data) { parentId = bySub.data.parent_id as string; plan = bySub.data.plan as Exclude<PlanId, 'free'>; }
  const initial = body.subscription_data.initial_transaction;
  if (!parentId && initial !== undefined && initial !== null) {
    const byTx = await admin.from('payments').select('id,parent_id,plan').eq('provider', 'paymob').eq('provider_transaction_id', String(initial)).maybeSingle();
    if (byTx.data) {
      parentId = byTx.data.parent_id as string; plan = byTx.data.plan as Exclude<PlanId, 'free'>;
      await admin.from('payments').update({ provider_subscription_id: subId }).eq('id', byTx.data.id);
    }
  }
  if (!parentId) {
    const byRow = await admin.from('subscriptions').select('parent_id,plan').eq('provider', 'paymob').eq('provider_subscription_id', subId).maybeSingle();
    if (byRow.data) { parentId = byRow.data.parent_id as string; plan = byRow.data.plan === 'free' ? null : byRow.data.plan as Exclude<PlanId, 'free'>; }
  }
  if (!parentId) return NextResponse.json({ ignored: 'unknown subscription' });
  if (!plan) {
    const fromPlanId = Object.entries(serverConfig.paymob.subscriptionPlans).find(([, id]) => id === body.subscription_data.plan_id)?.[0];
    plan = (fromPlanId as Exclude<PlanId, 'free'> | undefined) ?? 'premium_monthly';
  }

  const { data: sub } = await admin.from('subscriptions').select('plan,status,current_period_end,cancel_at_period_end,provider_subscription_id').eq('parent_id', parentId).maybeSingle();
  const current: SubscriptionRow = (sub as SubscriptionRow | null) ?? { plan: 'free', status: 'none', current_period_end: null };
  const next = applySubscriptionEvent(current, body, plan, new Date());
  await admin.from('subscriptions').upsert({
    parent_id: parentId, plan: next.plan, status: next.status, provider: 'paymob', current_period_end: next.current_period_end,
    cancel_at_period_end: next.cancel_at_period_end ?? false, provider_subscription_id: next.provider_subscription_id ?? subId,
    seats: seatsFor(next.plan), payment_method: 'card',
  });
  return NextResponse.json({ received: true, trigger: body.trigger_type });
}
