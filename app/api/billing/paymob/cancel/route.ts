import { NextResponse } from 'next/server';
import { serverConfig } from '@/lib/server-config';
import { getSupabaseAdmin, userFromRequest } from '@/lib/supabase/admin';
import { cancelSubscription } from '@/billing/paymob';

/**
 * Turns off auto-renewal for the parent's Paymob card subscription. Access continues until the paid period ends.
 * Prepaid (wallet / kiosk) periods never renew, so there is nothing to cancel.
 */
export async function POST(req: Request) {
  if (serverConfig.billingProvider !== 'paymob') return NextResponse.json({ error: 'Paymob is not the active payment provider' }, { status: 501 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'no service role' }, { status: 501 });
  const { data: sub } = await admin.from('subscriptions').select('provider,provider_subscription_id,cancel_at_period_end,current_period_end').eq('parent_id', user.id).maybeSingle();
  if (!sub || sub.provider !== 'paymob' || !sub.provider_subscription_id) {
    return NextResponse.json({ ok: true, message: 'Your plan is prepaid and will not renew automatically.' });
  }
  if (sub.cancel_at_period_end) return NextResponse.json({ ok: true, message: 'Auto-renewal is already off.' });
  try {
    await cancelSubscription(sub.provider_subscription_id as string);
  } catch {
    // Record the request so support can finish it in the Paymob dashboard; never leave the parent stuck.
    await admin.from('audit_logs').insert({ actor: user.id, action: 'billing.cancel_failed', entity_type: 'subscription', entity_id: user.id, diff: { provider: 'paymob' } }).then(() => undefined, () => undefined);
    return NextResponse.json({ error: 'We could not reach the payment provider. Your cancellation request was recorded — support will confirm by email within one business day.' }, { status: 502 });
  }
  await admin.from('subscriptions').update({ cancel_at_period_end: true }).eq('parent_id', user.id);
  const end = sub.current_period_end ? new Date(sub.current_period_end as string).toDateString() : 'the end of the period';
  return NextResponse.json({ ok: true, message: `Auto-renewal is off. Premium stays active until ${end}.` });
}
