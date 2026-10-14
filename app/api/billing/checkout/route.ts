import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { serverConfig } from '@/lib/server-config';
import { publicConfig } from '@/lib/config';
import { getSupabaseAdmin, userFromRequest } from '@/lib/supabase/admin';
import type { PlanId } from '@/types/core';

/** Creates a Stripe Checkout session for the signed-in parent. The webhook grants the entitlement. */
export async function POST(req: Request) {
  if (serverConfig.billingProvider !== 'stripe' || !serverConfig.stripeSecretKey) return NextResponse.json({ error: 'Stripe is not configured' }, { status: 501 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const { plan } = (await req.json()) as { plan: Exclude<PlanId, 'free'> };
  const price = serverConfig.stripePrices[plan];
  if (!price) return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
  const stripe = new Stripe(serverConfig.stripeSecretKey);
  const admin = getSupabaseAdmin()!;
  const { data: sub } = await admin.from('subscriptions').select('provider_customer_id').eq('parent_id', user.id).maybeSingle();
  let customer = sub?.provider_customer_id as string | undefined;
  if (!customer) {
    customer = (await stripe.customers.create({ email: user.email, metadata: { parent_id: user.id } })).id;
    await admin.from('subscriptions').upsert({ parent_id: user.id, provider: 'stripe', provider_customer_id: customer });
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription', customer, line_items: [{ price, quantity: 1 }],
    success_url: `${publicConfig.appUrl}/parent/plan?checkout=success`, cancel_url: `${publicConfig.appUrl}/parent/plan?checkout=cancel`,
    client_reference_id: user.id, subscription_data: { metadata: { parent_id: user.id, plan } }, allow_promotion_codes: true,
  });
  return NextResponse.json({ url: session.url });
}
