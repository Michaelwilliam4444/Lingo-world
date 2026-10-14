import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import type { ContentBundle } from '@/types/content';
import { getSupabaseAdmin, isAdminUser, userFromRequest } from '@/lib/supabase/admin';
import { validateBundle } from '@/content/schema';
import { bundleToTableRows } from '@/admin/tableRows';

/**
 * Publish a content release. Server-side: verifies the caller is an editor (admin_users),
 * re-validates the bundle, upserts the normalised CMS tables and writes an immutable release.
 */
export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user || !(await isAdminUser(user.id, ['editor']))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Supabase service role not configured' }, { status: 501 });
  const { bundle, notes } = (await req.json()) as { bundle: ContentBundle; notes?: string };
  const errors = validateBundle(bundle).filter((i) => i.severity === 'error');
  if (errors.length) return NextResponse.json({ error: 'Validation failed', issues: errors.slice(0, 50) }, { status: 422 });

  for (const { table, conflict, rows } of bundleToTableRows(bundle)) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from(table).upsert(rows.slice(i, i + 500), { onConflict: conflict });
      if (error) return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 });
    }
  }
  const json = JSON.stringify(bundle);
  const { error } = await admin.from('content_bundles').insert({
    version: bundle.version, bundle, checksum: createHash('sha256').update(json).digest('hex'),
    published: true, published_at: new Date().toISOString(), published_by: user.id, notes: notes ?? '',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from('audit_logs').insert({ actor: user.id, action: 'publish', entity_type: 'content_bundle', entity_id: bundle.version, diff: { notes } });
  return NextResponse.json({ version: bundle.version });
}
