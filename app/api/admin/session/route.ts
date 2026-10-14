import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { serverConfig } from '@/lib/server-config';
import { publicConfig } from '@/lib/config';
import { ADMIN_COOKIE, adminAccess, signAdmin } from '@/lib/admin-auth';

/**
 * Admin session check.
 *   Supabase mode: Bearer token → admin_users role (server-side; client checks are UI-only).
 *   Local mode:    LOCAL_ADMIN_PASSCODE → short-lived signed cookie (demo CMS on a single device).
 */
const COOKIE = ADMIN_COOKIE;
const sign = signAdmin;

export async function GET(req: Request) {
  const a = await adminAccess(req);
  return NextResponse.json({ admin: a.admin, owner: a.owner });
}

export async function POST(req: Request) {
  if (publicConfig.dataMode === 'supabase') return NextResponse.json({ error: 'Use your admin account' }, { status: 400 });
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: string };
  const expected = serverConfig.localAdminPasscode;
  const ok = typeof passcode === 'string' && passcode.length === expected.length && timingSafeEqual(Buffer.from(passcode), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: 'Incorrect passcode' }, { status: 401 });
  const exp = String(Date.now() + 8 * 3600_000);
  const res = NextResponse.json({ admin: true });
  res.cookies.set(COOKIE, `${exp}.${sign(exp)}`, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 8 * 3600 });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ admin: false });
  res.cookies.delete(COOKIE);
  return res;
}
