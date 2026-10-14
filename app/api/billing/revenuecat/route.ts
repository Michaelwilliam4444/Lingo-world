import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { serverConfig } from '@/lib/server-config';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * RevenueCat webhook (App Store / Google Play). Configure the app user id = Supabase user id
 * and products/entitlements named premium_monthly, premium_annual, family.
 */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const expected = serverConfig.revenueCatWebhookAuth;
  if (!expected || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'no service role' }, { status: 501 });
  const { event } = (await req.json()) as { event: { type: string; app_user_id: string; product_id: string; expiration_at_ms?: number; id: string } };
  const plan = (['family', 'premium_annual', 'premium_monthly'] as const).find((p) => event.product_id.includes(p)) ?? 'premium_monthly';
  const active = ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE'].includes(event.type);
  const ended = ['EXPIRATION'].includes(event.type);
  if (!active && !ended && event.type !== 'CANCELLATION' && event.type !== 'BILLING_ISSUE') return NextResponse.json({ ok: true });
  await admin.from('subscriptions').upsert({
    parent_id: event.app_user_id, plan: ended ? 'free' : plan,
    status: ended ? 'canceled' : event.type === 'BILLING_ISSUE' ? 'past_due' : 'active',
    provider: 'revenuecat', provider_subscription_id: event.id,
    current_period_end: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null, seats: plan === 'family' ? 6 : 3,
  });
  return NextResponse.json({ ok: true });
}
