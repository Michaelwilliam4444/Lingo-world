import { NextResponse } from 'next/server';
import { getSupabaseAdmin, userFromRequest } from '@/lib/supabase/admin';

/** Full account deletion (right to erasure). Cascades remove every child and all learning data. */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'not configured' }, { status: 501 });
  const { data: kids } = await admin.from('children').select('analytics_id').eq('parent_id', user.id);
  const ids = (kids ?? []).map((k) => k.analytics_id as string);
  if (ids.length) await admin.from('analytics_events').delete().in('subject_id', ids);
  await admin.from('analytics_events').delete().eq('subject_id', user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id); // cascades through parent_profiles → children → all child tables
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
