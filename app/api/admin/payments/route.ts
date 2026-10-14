import { NextResponse } from 'next/server';
import { adminAccess } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { buildRevenueReport, paymentsCsv, samplePayments, type PaymentRow, type SubscriptionRowLite } from '@/billing/revenue';

/**
 * Owner-only revenue report: GET → JSON, GET ?format=csv → spreadsheet download.
 * Access: 'owner' admin role AND email in OWNER_EMAILS (see src/lib/admin-auth.ts). Every other admin gets 403.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const access = await adminAccess(req);
  if (!access.owner) {
    const why = access.mode === 'supabase' && !access.ownerConfigured ? 'Set OWNER_EMAILS on the server to your email to unlock this page.' : 'Only the business owner can see payments.';
    return NextResponse.json({ error: why }, { status: access.admin ? 403 : 401 });
  }
  if (!rateLimit(`admin-payments:${access.userId ?? 'local'}`, 30)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const csv = new URL(req.url).searchParams.get('format') === 'csv';
  const now = new Date();

  let payments: PaymentRow[]; let subs: SubscriptionRowLite[]; let sample = false;
  if (access.mode === 'local') {
    ({ payments, subs } = samplePayments(now)); sample = true;
  } else {
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 501 });
    const [p, s, profiles] = await Promise.all([
      admin.from('payments').select('id,parent_id,created_at,paid_at,plan,method,kind,amount_cents,currency,status,reference,provider_transaction_id,failure_reason').order('created_at', { ascending: false }).limit(10000),
      admin.from('subscriptions').select('parent_id,plan,status,current_period_end,cancel_at_period_end,payment_method,provider'),
      admin.from('parent_profiles').select('id,display_name'),
    ]);
    if (p.error || s.error) return NextResponse.json({ error: 'Could not load payments' }, { status: 500 });
    const names = new Map((profiles.data ?? []).map((r) => [r.id as string, r.display_name as string]));
    // Emails help the owner match refunds and support requests (owner-only data).
    const emails = new Map<string, string>();
    for (let page = 1; page <= 20; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      for (const u of data?.users ?? []) emails.set(u.id, u.email ?? '');
      if (!data || data.users.length < 1000) break;
    }
    payments = (p.data as PaymentRow[]).map((r) => ({ ...r, customer: [names.get(r.parent_id), emails.get(r.parent_id)].filter(Boolean).join(' · ') || r.parent_id }));
    subs = s.data as SubscriptionRowLite[];
  }

  if (csv) {
    return new NextResponse(paymentsCsv(payments), {
      headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="lingoworld-payments-${now.toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' },
    });
  }
  return NextResponse.json({ sample, report: buildRevenueReport(payments, subs, now) }, { headers: { 'cache-control': 'no-store' } });
}
