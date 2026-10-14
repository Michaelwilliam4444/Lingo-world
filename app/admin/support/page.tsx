'use client';
import { useState } from 'react';
import { ParentCard } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { isSupabaseConfigured } from '@/lib/config';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Support tools: look up a family by parent email (support role, server-enforced RLS) to see plan status,
 * child profiles (nickname, age band, language) and recent sync health. No learning content is editable here,
 * and support can never see speech transcripts.
 */
export default function Support() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const lookup = async () => {
    if (!isSupabaseConfigured()) { setMsg('Support lookup requires cloud mode (Supabase). In device mode each family’s data exists only on their device.'); return; }
    const token = (await getSupabaseBrowserClient().auth.getSession()).data.session?.access_token;
    const res = await fetch(`/api/admin/support?email=${encodeURIComponent(email)}`, { headers: { Authorization: `Bearer ${token ?? ''}` } });
    if (!res.ok) { setMsg((await res.json().catch(() => ({}))).error ?? 'Lookup failed'); return; }
    setResult(await res.json()); setMsg(null);
  };
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-bold">Support</h1>
      <ParentCard title="Find a family">
        <div className="flex gap-2"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@example.com" aria-label="Parent email" className="flex-1 rounded-tab border-2 border-ink/15 px-3 py-2" />
          <Button variant="parent" className="h-11 px-5" onClick={() => void lookup()}>Look up</Button></div>
        {msg && <p role="status" className="mt-2">{msg}</p>}
        {result !== null && <pre className="mt-3 max-h-96 overflow-auto rounded-tab bg-paper-dark p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>}
      </ParentCard>
      <ParentCard title="Common answers">
        <ul className="list-disc space-y-1 ps-5">
          <li>Microphone not working: Parent Zone → child → “Speaking activities”, then allow the microphone in browser/OS settings. Without it, children use “say it aloud and tap the star”.</li>
          <li>Progress on two devices: sign in with the same parent account; offline progress merges automatically and never overwrites learning.</li>
          <li>Data export / deletion: Parent Zone → Settings → Your data.</li>
        </ul>
      </ParentCard>
    </div>
  );
}
