// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { transactionHmacMessage, verifySubscriptionHmac, verifyTransactionHmac } from '@/billing/paymob-hmac';
import { addMonths, applySubscriptionEvent, classifyTransaction, grantPaidPeriod, merchantReference, revokeForRefund } from '@/billing/paymobEvents';
import { PRICES, amountCents, formatPrice, methodsFor } from '@/billing/pricing';
import { entitlementsFor } from '@/billing/plans';

const SECRET = 'test_hmac_secret';
// A transaction as Paymob posts it in the "transaction processed" callback (trimmed to what matters).
const tx = {
  id: 192837, amount_cents: 24900, created_at: '2026-10-10T12:00:00.000000', currency: 'EGP', error_occured: false,
  has_parent_transaction: false, integration_id: 4567890, is_3d_secure: true, is_auth: false, is_capture: false, is_refunded: false,
  is_standalone_payment: true, is_voided: false, order: { id: 556677, merchant_order_id: 'lw_abc_123' }, owner: 302, pending: false,
  source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' }, success: true, data: { message: 'Approved' },
};
// Computed independently (Python hmac/sha512) from the documented field order.
const EXPECTED_TX_HMAC = '81b85b6eb87b3da05e050cf7ca55ac3a9ff6289c2069814412c609ee06adfa11fc01d5d190e4ff8e8192d8f54c68dabd36faa84f2eaa48ba5ab264fdf28a54ac';
const EXPECTED_SUB_HMAC = '119a25ee9f330c9d3ff241eaea1daa32ec0103df1d10b01d0fc7b1731a38269020ac97e41790425ccb0ae9443693d7b49b2a515c02160ba979249125d07e2631';

describe('Paymob HMAC verification', () => {
  it('builds the documented concatenation and accepts a genuine transaction callback', () => {
    expect(transactionHmacMessage(tx)).toBe('249002026-10-10T12:00:00.000000EGPfalsefalse1928374567890truefalsefalsefalsetruefalse556677302false2346MasterCardcardtrue');
    expect(verifyTransactionHmac(tx, EXPECTED_TX_HMAC, SECRET)).toBe(true);
    expect(verifyTransactionHmac(tx, EXPECTED_TX_HMAC.toUpperCase(), SECRET)).toBe(true);
  });

  it('rejects tampered amounts, wrong secrets and missing signatures', () => {
    expect(verifyTransactionHmac({ ...tx, amount_cents: 100 }, EXPECTED_TX_HMAC, SECRET)).toBe(false);
    expect(verifyTransactionHmac({ ...tx, success: false }, EXPECTED_TX_HMAC, SECRET)).toBe(false);
    expect(verifyTransactionHmac(tx, EXPECTED_TX_HMAC, 'other')).toBe(false);
    expect(verifyTransactionHmac(tx, null, SECRET)).toBe(false);
    expect(verifyTransactionHmac(tx, EXPECTED_TX_HMAC, '')).toBe(false);
  });

  it('accepts the flat query-string form of the browser redirect callback', () => {
    const flat: Record<string, unknown> = {
      amount_cents: '24900', created_at: tx.created_at, currency: 'EGP', error_occured: 'false', has_parent_transaction: 'false', id: '192837',
      integration_id: '4567890', is_3d_secure: 'true', is_auth: 'false', is_capture: 'false', is_refunded: 'false', is_standalone_payment: 'true',
      is_voided: 'false', order: '556677', owner: '302', pending: 'false', 'source_data.pan': '2346', 'source_data.sub_type': 'MasterCard',
      'source_data.type': 'card', success: 'true',
    };
    expect(verifyTransactionHmac(flat, EXPECTED_TX_HMAC, SECRET)).toBe(true);
  });

  it('verifies subscription callbacks ("{trigger_type}for{id}")', () => {
    const body = { trigger_type: 'Successful Transaction', subscription_data: { id: 9876 }, hmac: EXPECTED_SUB_HMAC };
    expect(verifySubscriptionHmac(body, SECRET)).toBe(true);
    expect(verifySubscriptionHmac({ ...body, trigger_type: 'canceled' }, SECRET)).toBe(false);
    expect(verifySubscriptionHmac({ ...body, subscription_data: { id: 1 } }, SECRET)).toBe(false);
    expect(verifySubscriptionHmac({ ...body, hmac: undefined }, SECRET)).toBe(false);
  });
});

describe('payment → access decisions', () => {
  const now = new Date('2026-10-10T12:00:00Z');

  it('classifies transactions and finds our reference', () => {
    expect(classifyTransaction(tx)).toBe('paid');
    expect(classifyTransaction({ ...tx, pending: true })).toBe('pending'); // e.g. Fawry reference issued, not yet paid
    expect(classifyTransaction({ ...tx, success: false })).toBe('failed');
    expect(classifyTransaction({ ...tx, is_refunded: true })).toBe('refunded');
    expect(classifyTransaction({ ...tx, is_voided: true })).toBe('voided');
    expect(merchantReference(tx)).toBe('lw_abc_123');
  });

  it('a prepaid month starts now, and buying early adds time instead of losing days', () => {
    const first = grantPaidPeriod(null, 'premium_monthly', 1, now);
    expect(first.status).toBe('active');
    expect(first.current_period_end).toBe('2026-11-10T12:00:00.000Z');
    const again = grantPaidPeriod(first, 'premium_monthly', 1, new Date('2026-10-25T00:00:00Z'));
    expect(again.current_period_end).toBe('2026-12-10T12:00:00.000Z');
    const expired = grantPaidPeriod({ ...first, current_period_end: '2026-01-01T00:00:00Z' }, 'premium_annual', 12, now);
    expect(expired.current_period_end).toBe('2027-10-10T12:00:00.000Z');
    expect(entitlementsFor({ plan: first.plan, status: first.status, currentPeriodEnd: first.current_period_end }, now).premium).toBe(true);
    expect(entitlementsFor({ plan: first.plan, status: first.status, currentPeriodEnd: first.current_period_end }, new Date('2026-11-11T00:00:00Z')).premium).toBe(false);
  });

  it('handles month ends correctly', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('a refund ends access immediately', () => {
    const active = grantPaidPeriod(null, 'family', 12, now);
    const revoked = revokeForRefund(active, now);
    expect(entitlementsFor({ plan: revoked.plan, status: revoked.status, currentPeriodEnd: revoked.current_period_end }, now).premium).toBe(false);
  });

  it('card subscription lifecycle: renew, fail (grace), cancel keeps the paid period', () => {
    const start = { plan: 'free' as const, status: 'none' as const, current_period_end: null };
    const created = applySubscriptionEvent(start, { trigger_type: 'Subscription Created', subscription_data: { id: 9876, next_billing: '2026-11-10' } }, 'premium_monthly', now);
    expect(created).toMatchObject({ plan: 'premium_monthly', status: 'active', provider_subscription_id: '9876' });
    expect(created.current_period_end).toBe('2026-11-11T00:00:00.000Z');

    const failed = applySubscriptionEvent(created, { trigger_type: 'Failed Transaction', subscription_data: { id: 9876 } }, 'premium_monthly', new Date('2026-11-10T06:00:00Z'));
    expect(failed.status).toBe('past_due');
    expect(entitlementsFor({ plan: failed.plan, status: failed.status, currentPeriodEnd: failed.current_period_end }, new Date('2026-11-10T08:00:00Z')).premium).toBe(true);

    const renewed = applySubscriptionEvent(failed, { trigger_type: 'Successful Transaction', subscription_data: { id: 9876, next_billing: '2026-12-10' } }, 'premium_monthly', new Date('2026-11-11T06:00:00Z'));
    expect(renewed.status).toBe('active');
    expect(renewed.current_period_end).toBe('2026-12-11T00:00:00.000Z');

    const canceled = applySubscriptionEvent(renewed, { trigger_type: 'canceled', subscription_data: { id: 9876 } }, 'premium_monthly', new Date('2026-11-20T00:00:00Z'));
    expect(canceled).toMatchObject({ status: 'active', cancel_at_period_end: true, plan: 'premium_monthly' });
    const late = applySubscriptionEvent(renewed, { trigger_type: 'canceled', subscription_data: { id: 9876 } }, 'premium_monthly', new Date('2027-01-01T00:00:00Z'));
    expect(late).toMatchObject({ status: 'canceled', plan: 'free' });
  });
});

describe('pricing', () => {
  it('has a positive price for every paid plan in every currency, charged in minor units', () => {
    for (const plan of Object.keys(PRICES) as (keyof typeof PRICES)[]) {
      for (const c of ['EGP', 'USD'] as const) {
        expect(PRICES[plan][c]).toBeGreaterThan(0);
        expect(Number.isInteger(amountCents(plan, c))).toBe(true);
      }
    }
    expect(amountCents('premium_monthly', 'USD')).toBe(999);
  });
  it('offers wallets and Fawry/Aman only in EGP', () => {
    expect(methodsFor('EGP').map((m) => m.id)).toEqual(['card', 'wallet', 'kiosk']);
    expect(methodsFor('USD').map((m) => m.id)).toEqual(['card']);
    expect(formatPrice('premium_monthly', 'USD')).toBe('$9.99');
  });
});

describe('owner revenue report', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  const base = { parent_id: 'p1', plan: 'premium_monthly' as const, method: 'card' as const, kind: 'subscription' as const, currency: 'EGP', reference: 'r', provider_transaction_id: '1' };
  const payments = [
    { ...base, id: '1', created_at: '2026-10-14T08:00:00Z', paid_at: '2026-10-14T08:00:00Z', amount_cents: 24900, status: 'paid' as const },
    { ...base, id: '2', created_at: '2026-10-02T08:00:00Z', paid_at: '2026-10-02T08:00:00Z', amount_cents: 179900, status: 'paid' as const, plan: 'premium_annual' as const, method: 'wallet' as const, kind: 'pass' as const },
    { ...base, id: '3', created_at: '2026-09-20T08:00:00Z', paid_at: '2026-09-20T08:00:00Z', amount_cents: 24900, status: 'paid' as const },
    { ...base, id: '4', created_at: '2026-10-03T08:00:00Z', paid_at: null, amount_cents: 24900, status: 'failed' as const },
    { ...base, id: '5', created_at: '2026-10-05T08:00:00Z', paid_at: '2026-10-05T08:00:00Z', amount_cents: 24900, status: 'refunded' as const },
  ];
  const subs = [
    { parent_id: 'p1', plan: 'premium_monthly' as const, status: 'active' as const, current_period_end: '2026-11-14T00:00:00Z', payment_method: 'card' },
    { parent_id: 'p2', plan: 'premium_annual' as const, status: 'active' as const, current_period_end: '2026-10-18T00:00:00Z', payment_method: 'wallet' },
    { parent_id: 'p3', plan: 'family' as const, status: 'past_due' as const, current_period_end: '2026-10-20T00:00:00Z', payment_method: 'card' },
    { parent_id: 'p4', plan: 'premium_monthly' as const, status: 'active' as const, current_period_end: '2026-09-01T00:00:00Z', payment_method: 'card' },
    { parent_id: 'p5', plan: 'free' as const, status: 'none' as const, current_period_end: null },
  ];
  it('totals only paid money, per period, method and plan', async () => {
    const { buildRevenueReport } = await import('@/billing/revenue');
    const r = buildRevenueReport(payments, subs, now);
    expect(r.collected.today).toEqual({ EGP: 249 });
    expect(r.collected.thisMonth).toEqual({ EGP: 2048 });
    expect(r.collected.allTime).toEqual({ EGP: 2297 });
    expect(r.refunded.thisMonth).toEqual({ EGP: 249 });
    expect(r.counts).toEqual({ paid: 3, pending: 0, failed: 1, refunded: 1 });
    expect(r.byMethod.wallet).toEqual({ count: 1, amount: { EGP: 1799 } });
    expect(r.monthly).toHaveLength(12);
    expect(r.monthly.at(-1)).toMatchObject({ month: '2026-10', count: 2 });
    expect(r.subscribers).toMatchObject({ active: 3, autoRenew: 2, prepaid: 1, pastDue: 1, endingSoon: 1 });
  });
  it('exports a spreadsheet that cannot run formulas', async () => {
    const { paymentsCsv } = await import('@/billing/revenue');
    const csv = paymentsCsv([{ ...payments[0]!, customer: '=HYPERLINK("http://evil")' }]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});
