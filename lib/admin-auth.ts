import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverConfig } from '@/lib/server-config';
import { publicConfig } from '@/lib/config';
import { isAdminUser, userFromRequest } from '@/lib/supabase/admin';

/**
 * Who may see what in /admin.
 *  - admin:  any row in admin_users (content editors, support, analysts…). Only the owner — or someone holding the
 *            server's service-role key — can add rows there; signing up on the website never makes anyone an admin.
 *  - owner:  money pages (payments, revenue, subscribers). Requires BOTH the 'owner' role AND an email listed in
 *            OWNER_EMAILS, so even an account wrongly given the owner role cannot see revenue.
 * Local (device) mode uses the LOCAL_ADMIN_PASSCODE cookie and shows sample data only.
 */
export const ADMIN_COOKIE = 'lw_admin';
export const signAdmin = (v: string) =>
  createHmac('sha256', serverConfig.localAdminPasscode + (process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'local')).update(v).digest('hex');

export function localAdminCookieValid(req: Request): boolean {
  const cookie = req.headers.get('cookie')?.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
  if (!cookie) return false;
  const [exp, sig] = decodeURIComponent(cookie).split('.');
  return !!exp && !!sig && Number(exp) > Date.now() && sig.length === 64 && timingSafeEqual(Buffer.from(sig), Buffer.from(signAdmin(exp)));
}

export interface AdminAccess { admin: boolean; owner: boolean; userId: string | null; mode: 'supabase' | 'local'; ownerConfigured: boolean }

export async function adminAccess(req: Request): Promise<AdminAccess> {
  if (publicConfig.dataMode === 'supabase') {
    const user = await userFromRequest(req);
    const ownerConfigured = serverConfig.ownerEmails.length > 0;
    if (!user) return { admin: false, owner: false, userId: null, mode: 'supabase', ownerConfigured };
    const admin = await isAdminUser(user.id);
    const ownerRole = admin && (await isAdminUser(user.id, []));          // [] → only the 'owner' role passes
    const ownerEmail = serverConfig.ownerEmails.includes(user.email.trim().toLowerCase());
    return { admin, owner: ownerRole && ownerEmail, userId: user.id, mode: 'supabase', ownerConfigured };
  }
  const ok = localAdminCookieValid(req);
  return { admin: ok, owner: ok, userId: null, mode: 'local', ownerConfigured: true };
}
