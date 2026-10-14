import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { serverConfig } from '@/lib/server-config';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Stripe webhook — the ONLY way a web subscription becomes active.
 * Verifies the signature, maps the Stripe subscription onto our plan, writes with the service role.
 */
export async function POST(req: Request) {
  if (!serverConfig.stripeSecretKey || !serverConfig.stripeWebhookSecret) return NextResponse.json({ error: 'not configured' }, { status: 501 });
  const stripe = new Stripe(serverConfig.stripeSecretKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature') ?? '', serverConfig.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'no service role' }, { status: 501 });

  if (event.type.startsWith('customer.subscription.')) {
    const sub = event.data.object as Stripe.Subscription;
    const parentId = sub.metadata.parent_id;
    if (!parentId) return NextResponse.json({ ok: true });
    const priceId = sub.items.data[0]?.price.id;
    const plan = Object.entries(serverConfig.stripePrices).find(([, p]) => p === priceId)?.[0] ?? sub.metadata.plan ?? 'premium_monthly';
    const status = sub.status === 'active' || sub.status === 'trialing' ? sub.status : sub.status === 'past_due' ? 'past_due' : 'canceled';
    const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end ?? sub.items.data[0]?.current_period_end;
    await admin.from('subscriptions').upsert({
      parent_id: parentId, plan: event.type === 'customer.subscription.deleted' ? 'free' : plan, status: event.type === 'customer.subscription.deleted' ? 'canceled' : status,
      provider: 'stripe', provider_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id, provider_subscription_id: sub.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null, seats: plan === 'family' ? 6 : 3,
    });
  }
  return NextResponse.json({ received: true });
}
