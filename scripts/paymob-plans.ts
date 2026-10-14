/**
 * Creates the three Paymob subscription plans (card auto-renewal) that match LingoWorld's paid plans.
 *
 *   PAYMOB_API_KEY=… PAYMOB_INTEGRATION_MOTO=… NEXT_PUBLIC_APP_URL=https://your-domain npm run paymob:plans            # dry run: prints the requests
 *   PAYMOB_API_KEY=… PAYMOB_INTEGRATION_MOTO=… NEXT_PUBLIC_APP_URL=https://your-domain npm run paymob:plans -- --create
 *
 * Copy the printed plan ids into PAYMOB_PLAN_PREMIUM_MONTHLY / _ANNUAL / _FAMILY.
 * Alternative: ask your Paymob account manager to create the plans and send you the ids.
 * The endpoint path is configurable (PAYMOB_PLAN_CREATE_PATH) — confirm it in your Paymob sandbox/Postman collection.
 * Docs: https://developers.paymob.com/paymob-docs/developers/subscription/create-subscription-plan
 */
import { PLAN_MONTHS, amountCents, type Currency, type PaidPlan } from '../src/billing/pricing';

const apiBase = (process.env.PAYMOB_API_BASE ?? 'https://accept.paymob.com').replace(/\/$/, '');
const createPath = process.env.PAYMOB_PLAN_CREATE_PATH ?? '/api/acceptance/subscription-plans';
const apiKey = process.env.PAYMOB_API_KEY ?? '';
const moto = Number(process.env.PAYMOB_INTEGRATION_MOTO);
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
const currency = (process.env.PAYMOB_PLAN_CURRENCY ?? 'EGP') as Currency;
const create = process.argv.includes('--create');

if (!moto || !appUrl) {
  console.error('Set PAYMOB_INTEGRATION_MOTO (your card MOTO integration id) and NEXT_PUBLIC_APP_URL.');
  process.exit(1);
}

const NAMES: Record<PaidPlan, string> = { premium_monthly: 'LingoWorld Premium Monthly', premium_annual: 'LingoWorld Premium Annual', family: 'LingoWorld Family Annual' };
const bodies = (Object.keys(NAMES) as PaidPlan[]).map((plan) => ({
  plan,
  body: {
    frequency: PLAN_MONTHS[plan] === 1 ? 30 : 360,
    name: NAMES[plan],
    reminder_days: 3,
    retrial_days: 3,
    plan_type: 'rent',
    number_of_deductions: null,
    amount_cents: amountCents(plan, currency),
    use_transaction_amount: false,
    is_active: true,
    integration: moto,
    webhook_url: `${appUrl}/api/billing/paymob/subscription`,
  },
}));

if (!create) {
  console.log(`Dry run — POST ${apiBase}${createPath} (Bearer token from /api/auth/tokens):`);
  for (const b of bodies) console.log(b.plan, JSON.stringify(b.body));
  console.log('\nRe-run with -- --create to create them.');
  process.exit(0);
}
async function main() {
  if (!apiKey) { console.error('Set PAYMOB_API_KEY'); process.exit(1); }

  const tokenRes = await fetch(`${apiBase}/api/auth/tokens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: apiKey }) });
  const { token } = (await tokenRes.json()) as { token?: string };
  if (!token) { console.error(`Auth failed (${tokenRes.status})`); process.exit(1); }

  for (const { plan, body } of bodies) {
    const res = await fetch(`${apiBase}${createPath}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { id?: number };
    if (!res.ok || !data.id) { console.error(plan, 'failed', res.status, JSON.stringify(data)); continue; }
    console.log(`PAYMOB_PLAN_${plan.toUpperCase()}=${data.id}`);
  }
}
void main();
