import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { serverConfig } from '@/lib/server-config';
import { publicConfig } from '@/lib/config';
import { getSupabaseAdmin, userFromRequest } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  if (serverConfig.billingProvider !== 'stripe' || !serverConfig.stripeSecretKey) return NextResponse.json({ error: 'Stripe is not configured' }, { status: 501 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const { data } = await getSupabaseAdmin()!.from('subscriptions').select('provider_customer_id').eq('parent_id', user.id).maybeSingle();
  if (!data?.provider_customer_id) return NextResponse.json({ error: 'No billing account yet' }, { status: 400 });
  const portal = await new Stripe(serverConfig.stripeSecretKey).billingPortal.sessions.create({ customer: data.provider_customer_id as string, return_url: `${publicConfig.appUrl}/parent/plan` });
  return NextResponse.json({ url: portal.url });
}
