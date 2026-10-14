'use client';
import { useEffect, useMemo, useState } from 'react';
import { useDraft } from '@/admin/useDraft';
import { contentStore, type AuditEntry, type Release } from '@/admin/ContentStore';
import { ParentCard } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { isSupabaseConfigured } from '@/lib/config';

/**
 * Releases: validate → publish an immutable, versioned content bundle. Children's progress is keyed by
 * stable concept/unit ids, so publishing never resets learners; removed units are skipped gracefully.
 */
export default function Releases() {
  const { draft } = useDraft();
  const [notes, setNotes] = useState('');
  const [releases, setReleases] = useState<Release[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const issues = useMemo(() => (draft ? contentStore.validate(draft) : []), [draft]);
  const errors = issues.filter((i) => i.severity === 'error');
  const refresh = () => { void contentStore.releases().then(setReleases); void contentStore.auditLog().then(setAudit); };
  useEffect(refresh, []);
  if (!draft) return <p>Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Releases</h1>
      <ParentCard title="Publish the working draft">
        {errors.length ? <p className="font-bold text-berry-dark">{errors.length} validation errors must be fixed first.</p> : <p className="text-lagoon-dark">All checks pass ({issues.length} warnings).</p>}
        <label className="mt-3 block font-bold">Release notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-tab border-2 border-ink/15 p-2" /></label>
        <div className="mt-3 flex gap-2">
          <Button variant="parent" className="h-11 px-5" disabled={!!errors.length} onClick={async () => {
            try { const r = await contentStore.publish(draft, notes, 'admin'); setMsg(r.version ? `Published ${r.version}` : 'Publishing blocked by validation'); refresh(); } catch (e) { setMsg((e as Error).message); }
          }}>Publish release</Button>
          <Button variant="parent-quiet" className="h-11 px-5" onClick={async () => { await contentStore.discardDraft(); location.reload(); }}>Discard draft</Button>
        </div>
        {msg && <p role="status" className="mt-2 font-bold">{msg}</p>}
        <p className="mt-2 text-sm text-ink-soft">{isSupabaseConfigured() ? 'Publishes to Supabase (normalised tables + content_bundles). All devices pick it up on next launch.' : 'Device mode: publishing updates the content used by this browser.'}</p>
      </ParentCard>
      <div className="grid gap-6 lg:grid-cols-2">
        <ParentCard title="History">
          <ul className="divide-y divide-ink/10">
            {releases.map((r) => (
              <li key={r.version} className="flex items-center gap-3 py-2">
                <div className="flex-1"><p className="font-bold">{r.version}</p><p className="text-sm text-ink-soft">{r.publishedAt && new Date(r.publishedAt).toLocaleString()} · {r.notes}</p></div>
                {!isSupabaseConfigured() && <Button variant="parent-quiet" className="h-9 px-3 text-sm" onClick={async () => { await contentStore.rollback(r.version, 'admin'); setMsg(`Rolled back to ${r.version}`); refresh(); }}>Roll back</Button>}
              </li>
            ))}
            {!releases.length && <li className="py-2 text-ink-soft">No releases yet — the app uses seed content {draft.version}.</li>}
          </ul>
        </ParentCard>
        <ParentCard title="Audit log">
          <ul className="max-h-80 overflow-auto text-sm">{audit.map((a, i) => <li key={i} className="py-0.5"><span className="text-ink-faint">{new Date(a.at).toLocaleString()}</span> · {a.actor} · <b>{a.action}</b> {a.entity}</li>)}</ul>
        </ParentCard>
      </div>
    </div>
  );
}
