'use client';
import { useEffect, useState } from 'react';
import { DEFAULT_FLAGS, type Experiment, type FeatureFlag } from '@/services/flags/flags';
import { ParentCard } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { getKV } from '@/lib/kv';
import { isSupabaseConfigured } from '@/lib/config';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const DEFAULT_EXPERIMENTS: Experiment[] = [
  { key: 'reward_reveal_style', description: 'Sticker reveal animation: burst vs. gentle float', surface: 'reward-presentation', active: false, variants: [{ id: 'burst', weight: 50 }, { id: 'float', weight: 50 }] },
  { key: 'story_first_vs_game_first', description: 'Open journeys with a story beat or a warm-up game', surface: 'journey-ordering', active: false, variants: [{ id: 'story', weight: 50 }, { id: 'game', weight: 50 }] },
];

export default function Flags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(DEFAULT_FLAGS);
  const [exps, setExps] = useState<Experiment[]>(DEFAULT_EXPERIMENTS);
  const [msg, setMsg] = useState<string | null>(null);
  const kv = getKV('lingoworld-admin');
  useEffect(() => {
    (async () => {
      if (isSupabaseConfigured()) {
        const sb = getSupabaseBrowserClient();
        const { data: f } = await sb.from('feature_flags').select('*');
        if (f?.length) setFlags(f.map((x) => ({ key: x.key, description: x.description, enabled: x.enabled, rolloutPercent: x.rollout_percent, environments: x.environments })));
        const { data: e } = await sb.from('experiments').select('*');
        if (e?.length) setExps(e.map((x) => ({ key: x.key, description: x.description, surface: x.surface, active: x.active, variants: x.variants })));
      } else {
        setFlags((await kv.get<FeatureFlag[]>('flags')) ?? DEFAULT_FLAGS);
        setExps((await kv.get<Experiment[]>('experiments')) ?? DEFAULT_EXPERIMENTS);
      }
    })();
  }, [kv]);

  const persist = async () => {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseBrowserClient();
      const r1 = await sb.from('feature_flags').upsert(flags.map((f) => ({ key: f.key, description: f.description, enabled: f.enabled, rollout_percent: f.rolloutPercent, environments: f.environments })));
      const r2 = await sb.from('experiments').upsert(exps.map((e) => ({ key: e.key, description: e.description, surface: e.surface, active: e.active, variants: e.variants })));
      setMsg(r1.error || r2.error ? `Save failed: ${(r1.error ?? r2.error)!.message}` : 'Saved');
    } else { await kv.set('flags', flags); await kv.set('experiments', exps); setMsg('Saved'); }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Feature flags & experiments</h1>
      <ParentCard title="Feature flags">
        <table className="w-full text-sm">
          <thead><tr className="text-start text-ink-soft"><th className="text-start">Flag</th><th>On</th><th>Rollout %</th><th className="text-start">Environments</th></tr></thead>
          <tbody>{flags.map((f, i) => (
            <tr key={f.key} className="border-t border-ink/10">
              <td className="py-2"><b>{f.key}</b><br /><span className="text-ink-soft">{f.description}</span></td>
              <td className="text-center"><input type="checkbox" aria-label={`${f.key} enabled`} checked={f.enabled} onChange={(e) => setFlags(flags.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))} /></td>
              <td className="text-center"><input type="number" min={0} max={100} aria-label={`${f.key} rollout`} value={f.rolloutPercent} className="w-16 rounded border px-1" onChange={(e) => setFlags(flags.map((x, j) => (j === i ? { ...x, rolloutPercent: Number(e.target.value) } : x)))} /></td>
              <td>{(['development', 'staging', 'production'] as const).map((env) => (
                <label key={env} className="me-2"><input type="checkbox" checked={f.environments.includes(env)} onChange={(e) => setFlags(flags.map((x, j) => (j === i ? { ...x, environments: e.target.checked ? [...x.environments, env] : x.environments.filter((v) => v !== env) } : x)))} /> {env}</label>
              ))}</td>
            </tr>
          ))}</tbody>
        </table>
      </ParentCard>
      <ParentCard title="Experiments (presentation only)">
        <p className="mb-2 text-sm text-ink-soft">Allowed surfaces: UI, journey ordering, game preference, reward presentation. Never pricing prompts, time pressure, streak pressure or anything aimed at manipulating children.</p>
        <ul className="divide-y divide-ink/10">{exps.map((e, i) => (
          <li key={e.key} className="flex items-center gap-3 py-2">
            <div className="flex-1"><b>{e.key}</b> <span className="rounded-tab bg-paper-dark px-1.5 text-xs">{e.surface}</span><br /><span className="text-sm text-ink-soft">{e.description} · {e.variants.map((v) => `${v.id} ${v.weight}%`).join(' / ')}</span></div>
            <label><input type="checkbox" checked={e.active} onChange={(ev) => setExps(exps.map((x, j) => (j === i ? { ...x, active: ev.target.checked } : x)))} /> active</label>
          </li>
        ))}</ul>
      </ParentCard>
      <div className="flex items-center gap-3"><Button variant="parent" className="h-11 px-5" onClick={() => void persist()}>Save</Button>{msg && <span role="status">{msg}</span>}</div>
    </div>
  );
}
