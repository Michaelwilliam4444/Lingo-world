import { NextResponse } from 'next/server';
import { getSupabaseAdmin, isAdminUser, userFromRequest } from '@/lib/supabase/admin';

/** Support lookup: minimal family overview for agents with the `support` role. Audited. */
export async function GET(req: Request) {
  const user = await userFromRequest(req);
  if (!user || !(await isAdminUser(user.id, ['support']))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const admin = getSupabaseAdmin()!;
  const email = new URL(req.url).searchParams.get('email')?.toLowerCase().trim();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
  const parent = users.users.find((u) => u.email?.toLowerCase() === email);
  if (!parent) return NextResponse.json({ error: 'No account' }, { status: 404 });
  const [{ data: sub }, { data: kids }] = await Promise.all([
    admin.from('subscriptions').select('plan, status, provider, current_period_end').eq('parent_id', parent.id).maybeSingle(),
    admin.from('children').select('id, nickname, age_band, target_language, created_at').eq('parent_id', parent.id),
  ]);
  const syncs = await admin.from('language_progress').select('child_id, language, updated_at').in('child_id', (kids ?? []).map((k) => k.id));
  await admin.from('audit_logs').insert({ actor: user.id, action: 'support-lookup', entity_type: 'parent', entity_id: parent.id });
  return NextResponse.json({ parent: { id: parent.id, createdAt: parent.created_at, lastSignIn: parent.last_sign_in_at }, subscription: sub, children: kids, lastSync: syncs.data });
}
