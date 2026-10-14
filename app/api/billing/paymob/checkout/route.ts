import { NextResponse } from 'next/server';
import { z } from 'zod';
import { serverConfig } from '@/lib/server-config';
import { publicConfig } from '@/lib/config';
import { getSupabaseAdmin, userFromRequest } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { PAYMENT_METHODS, PLAN_MONTHS, amountCents } from '@/billing/pricing';
import { createIntention, newReference, paymobConfigured } from '@/billing/paymob';
import { PLANS } from '@/billing/plans';

const Body = z.object({
  plan: z.enum(['premium_monthly', 'premium_annual', 'family']),
  method: z.enum(['card', 'wallet', 'kiosk']),
  currency: z.enum(['EGP', 'USD']),
  // Paymob requires a phone number; for wallets it is the wallet number that receives the payment prompt.
  phone: z.string().trim().regex(/^\+?[0-9 ]{8,16}$/, 'Enter a valid mobile number'),
  name: z.string().trim().min(1).max(60),
});

/**
 * Starts a Paymob payment for the signed-in parent and returns the hosted-checkout URL.
 * The amount comes from the server price table — never from the browser. Access is granted only by the
 * HMAC-verified webhook, never by this route or the browser redirect.
 */
export async function POST(req: Request) {
  if (serverConfig.billingProvider !== 'paymob') return NextResponse.json({ error: 'Paymob is not the active payment provider' }, { status: 501 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!rateLimit(`paymob-checkout:${user.id}`, 6)) return NextResponse.json({ error: 'Too many attempts — please wait a minute' }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  const { plan, method, currency, phone, name } = parsed.data;
  const methodInfo = PAYMENT_METHODS.find((m) => m.id === method)!;
  if (!methodInfo.currencies.includes(currency)) return NextResponse.json({ error: `${methodInfo.label.en} is only available in ${methodInfo.currencies.join('/')}` }, { status: 400 });

  const conf = paymobConfigured(method);
  if (!conf.ok) return NextResponse.json({ error: `Payments are not fully configured (${conf.missing.join(', ')})` }, { status: 501 });
  const recurring = method === 'card' && !!serverConfig.paymob.subscriptionPlans[plan];

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 501 });

  const reference = newReference();
  const cents = amountCents(plan, currency);
  const { error: insertError } = await admin.from('payments').insert({
    parent_id: user.id, provider: 'paymob', reference, kind: recurring ? 'subscription' : 'pass', plan, method,
    amount_cents: cents, currency, status: 'pending', period_months: PLAN_MONTHS[plan],
  });
  if (insertError) return NextResponse.json({ error: 'Could not start the payment' }, { status: 500 });

  const [first, ...rest] = name.split(/\s+/);
  try {
    const intention = await createIntention({
      amountCents: cents, currency, method, plan, reference,
      itemName: `LingoWorld ${PLANS.find((p) => p.id === plan)?.name.en ?? plan}`,
      billing: { first_name: first ?? 'Parent', last_name: rest.join(' ') || 'NA', email: user.email, phone_number: phone.replace(/\s+/g, '') },
      notificationUrl: `${publicConfig.appUrl}/api/billing/paymob/webhook`,
      redirectionUrl: `${publicConfig.appUrl}/parent/plan?checkout=paymob&ref=${reference}`,
      subscriptionPlanId: recurring ? serverConfig.paymob.subscriptionPlans[plan] : null,
      extras: { parent_id: user.id },
    });
    await admin.from('payments').update({ provider_order_id: intention.orderId }).eq('reference', reference);
    return NextResponse.json({ url: intention.checkoutUrl, reference, recurring });
  } catch (e) {
    await admin.from('payments').update({ status: 'failed', failure_reason: (e as Error).message.slice(0, 200) }).eq('reference', reference);
    return NextResponse.json({ error: 'The payment page could not be opened. Please try again.' }, { status: 502 });
  }
}
