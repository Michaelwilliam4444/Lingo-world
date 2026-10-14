import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicConfig } from '@/lib/config';
import { serverConfig } from '@/lib/server-config';

/**
 * Service-role client — bypasses RLS. Server-only (webhooks, account deletion, content publishing).
 * Never import this from client components; `server-only` enforces it at build time.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!publicConfig.supabaseUrl || !serverConfig.supabaseServiceRoleKey) return null;
  return createClient(publicConfig.supabaseUrl, serverConfig.supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Resolve the calling user from a Bearer access token (used by API routes). */
export async function userFromRequest(req: Request): Promise<{ id: string; email: string } | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const admin = getSupabaseAdmin();
  if (!token || !admin) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user ? { id: data.user.id, email: data.user.email ?? '' } : null;
}

export async function isAdminUser(userId: string, roles?: string[]): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { data } = await admin.from('admin_users').select('role').eq('user_id', userId).maybeSingle();
  if (!data) return false;
  return !roles || data.role === 'owner' || roles.includes(data.role as string);
}
