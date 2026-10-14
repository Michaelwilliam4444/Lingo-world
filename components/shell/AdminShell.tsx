'use client';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Navigation } from '@/components/ui/Navigation';
import { Button } from '@/components/ui/Button';
import { publicConfig } from '@/lib/config';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/** Admin CMS gate. Authorization is enforced server-side (/api/admin/session, RLS, publish route). */
export function AdminShell({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'denied' | 'ok'>('checking');
  const [owner, setOwner] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    let headers: Record<string, string> = {};
    if (publicConfig.dataMode === 'supabase') {
      const token = (await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token;
      if (token) headers = { Authorization: `Bearer ${token}` };
    }
    const res = await fetch('/api/admin/session', { headers }).then((r) => r.json()).catch(() => ({ admin: false }));
    setOwner(!!res.owner);
    setState(res.admin ? 'ok' : 'denied');
  };
  useEffect(() => { void check(); }, []);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passcode }) });
    if (res.ok) { setError(null); void check(); } else setError((await res.json()).error ?? 'Not allowed');
  };

  if (state === 'checking') return <div className="grown-up flex min-h-dvh items-center justify-center">Checking access…</div>;
  if (state === 'denied') {
    return (
      <div className="grown-up flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold">LingoWorld content studio</h1>
          {publicConfig.dataMode === 'supabase' ? (
            <p className="mt-3 text-ink-soft">Sign in with an account listed in <code>admin_users</code>. <Link className="underline" href="/auth/sign-in">Sign in</Link></p>
          ) : (
            <form onSubmit={login} className="mt-4">
              <label className="block font-bold" htmlFor="pc">Admin passcode</label>
              <input id="pc" type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} className="mt-1 w-full rounded-tab border-2 border-ink/20 px-3 py-2" />
              <p className="mt-1 text-sm text-ink-soft">Set LOCAL_ADMIN_PASSCODE in your environment (default for local development: lingo-admin).</p>
              {error && <p role="alert" className="mt-2 text-berry-dark">{error}</p>}
              <Button type="submit" variant="parent" className="mt-4 h-11 w-full">Enter studio</Button>
            </form>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="grown-up min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/admin" className="text-lg font-bold">LingoWorld studio</Link>
          <Navigation label="Admin" items={[
            { href: '/admin', label: 'Dashboard' }, { href: '/admin/content', label: 'Content' }, { href: '/admin/translations', label: 'Translations' },
            { href: '/admin/media', label: 'Media' }, { href: '/admin/releases', label: 'Releases' }, { href: '/admin/analytics', label: 'Analytics' },
            { href: '/admin/flags', label: 'Flags & experiments' }, { href: '/admin/support', label: 'Support' },
            // Money pages: shown only to the owner (the server enforces it too).
            ...(owner ? [{ href: '/admin/payments', label: '💰 Payments' }] : []),
          ]} />
          <button type="button" className="ms-auto text-sm text-ink-soft underline" onClick={async () => { await fetch('/api/admin/session', { method: 'DELETE' }); setState('denied'); }}>Leave</button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
