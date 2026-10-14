'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDraft } from '@/admin/useDraft';
import { ENTITIES, entityDef, listEntities, removeEntity, setStatus, upsertEntity, type EntityType } from '@/admin/entities';
import { contentStore } from '@/admin/ContentStore';
import { validateBundle } from '@/content/schema';
import { ContentIndex } from '@/content';
import { GrammarRealizer } from '@/curriculum/grammar';
import { NeverSameJourneyEngine } from '@/journey-engine/NeverSameJourneyEngine';
import { initialChildState } from '@/learning-engine/LearningOrchestrator';
import { Button } from '@/components/ui/Button';
import { LEARNING_LANGUAGES, type ContentStatus, type LearningLanguage } from '@/types/core';
import type { ChildProfile } from '@/types/learner';
import { cn } from '@/lib/cn';

const STATUSES: ContentStatus[] = ['draft', 'review', 'published', 'archived'];

function ContentInner() {
  const router = useRouter();
  const params = useSearchParams();
  const type = (params.get('type') ?? 'concepts') as EntityType;
  const statusFilter = params.get('status');
  const def = entityDef(type)!;
  const { draft, save } = useDraft();
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [json, setJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const items = useMemo(() => {
    if (!draft) return [];
    return listEntities(draft, type).filter((e) => (!statusFilter || e.status === statusFilter) && (!query || JSON.stringify(e).toLowerCase().includes(query.toLowerCase())));
  }, [draft, type, query, statusFilter]);
  const selected = items.find((e) => def.key(e) === selectedKey) ?? null;
  useEffect(() => { setJson(selected ? JSON.stringify(selected, null, 2) : ''); setError(null); }, [selected]);
  useEffect(() => { setSelectedKey(null); }, [type]);

  if (!draft) return <p>Loading…</p>;

  const apply = async () => {
    try {
      const entity = JSON.parse(json) as Record<string, unknown>;
      const next = upsertEntity(draft, type, entity, selectedKey ?? undefined);
      const errs = validateBundle(next).filter((i) => i.severity === 'error' && i.where.includes(def.key(entity).split(':').pop()!));
      await save(next, selectedKey ? 'update' : 'create', `${type}/${def.key(entity)}`);
      setSelectedKey(def.key(entity));
      setError(errs.length ? `Saved to draft with ${errs.length} issue(s): ${errs.map((e) => e.message).join('; ')}` : null);
      setNotice('Saved to draft');
    } catch (e) { setError(`Invalid JSON: ${(e as Error).message}`); }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(listEntities(draft, type), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `lingoworld-${type}.json`; a.click();
  };
  const exportCsv = () => {
    const rows = listEntities(draft, type);
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const cell = (v: unknown) => { const s = typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''); return `"${s.replace(/"/g, '""')}"`; };
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `lingoworld-${type}.csv`; a.click();
  };
  const importJson = async (file: File) => {
    try {
      const rows = JSON.parse(await file.text()) as Record<string, unknown>[];
      if (!Array.isArray(rows)) throw new Error('Expected an array');
      let next = draft;
      for (const r of rows) next = upsertEntity(next, type, r);
      const errs = validateBundle(next).filter((i) => i.severity === 'error');
      await save(next, 'bulk-import', `${type} × ${rows.length}`);
      setNotice(`Imported ${rows.length} ${def.label.toLowerCase()} into the draft${errs.length ? ` — ${errs.length} validation errors to fix before publishing` : ''}.`);
    } catch (e) { setError(`Import failed: ${(e as Error).message}`); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1.2fr)]">
      <nav aria-label="Content types" className="flex flex-col gap-3">
        {(['Language', 'Curriculum', 'Story & world', 'Play', 'Library'] as const).map((g) => (
          <div key={g}>
            <p className="text-xs font-bold text-ink-faint">{g}</p>
            {ENTITIES.filter((e) => e.group === g).map((e) => (
              <button key={e.type} type="button" onClick={() => router.push(`/admin/content?type=${e.type}`)}
                className={cn('block w-full rounded-tab px-2 py-1 text-start', e.type === type ? 'bg-night font-bold text-paper' : 'hover:bg-paper-dark')}>{e.label}</button>
            ))}
          </div>
        ))}
      </nav>

      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{def.label}</h1>
          <span className="text-ink-soft">{items.length}</span>
          <Button variant="parent" className="ms-auto h-9 px-3 text-sm" onClick={() => { setSelectedKey(null); setJson(JSON.stringify(def.blank(), null, 2)); }}>New</Button>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search" className="rounded-tab border-2 border-ink/15 px-3 py-2" />
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" className="underline" onClick={exportJson}>Export JSON</button>
          <button type="button" className="underline" onClick={exportCsv}>Export CSV</button>
          <label className="cursor-pointer underline">Import JSON<input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && void importJson(e.target.files[0])} /></label>
        </div>
        <ul className="max-h-[65vh] overflow-auto rounded-tab border border-ink/10 bg-white">
          {items.slice(0, 400).map((e) => (
            <li key={def.key(e)}>
              <button type="button" onClick={() => setSelectedKey(def.key(e))}
                className={cn('flex w-full items-center gap-2 border-b border-ink/5 px-3 py-2 text-start', selectedKey === def.key(e) && 'bg-lagoon-light')}>
                <span className="min-w-0 flex-1 truncate">{def.title(e)}</span>
                {def.hasStatus && <span className="rounded-tab bg-paper-dark px-1.5 text-xs">{String(e.status)}</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        {(json || selected) ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold">{selected ? def.title(selected) : 'New item'}</h2>
              {def.hasStatus && selected && (
                <select aria-label="Workflow status" value={String(selected.status)} className="ms-auto rounded-tab border-2 border-ink/15 px-2 py-1"
                  onChange={async (ev) => { await save(setStatus(draft, type, def.key(selected), ev.target.value as ContentStatus), `status:${ev.target.value}`, `${type}/${def.key(selected)}`); }}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
            <textarea value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} aria-label="Item JSON"
              className="h-[42vh] w-full rounded-tab border-2 border-ink/15 bg-white p-3 font-mono text-[13px]" />
            {error && <p role="alert" className="rounded-tab bg-berry/10 p-2 text-sm text-berry-dark">{error}</p>}
            {notice && !error && <p role="status" className="text-sm text-lagoon-dark">{notice}</p>}
            <div className="flex gap-2">
              <Button variant="parent" className="h-10 px-4" onClick={() => void apply()}>Save to draft</Button>
              {selected && <Button variant="danger" className="h-10 px-4" onClick={async () => {
                if (!confirm('Delete from draft? Published content stays live until the next release.')) return;
                await save(removeEntity(draft, type, def.key(selected)), 'delete', `${type}/${def.key(selected)}`); setSelectedKey(null); setJson('');
              }}>Delete</Button>}
            </div>
            {selected && <Preview type={type} entity={selected} draftVersion={draft.version} />}
          </>
        ) : <p className="text-ink-soft">Select an item to edit, or create a new one. Changes go to the working draft; publish them from Releases.</p>}
      </section>
    </div>
  );
}

/** Live preview: how the item renders in every learning language / as a playable journey. */
function Preview({ type, entity, draftVersion }: { type: EntityType; entity: Record<string, unknown>; draftVersion: string }) {
  const { draft } = useDraft();
  const [lang, setLang] = useState<LearningLanguage>('en');
  const idx = useMemo(() => (draft ? new ContentIndex(draft) : null), [draft]);
  if (!idx) return null;
  const r = new GrammarRealizer(idx);
  let body: React.ReactNode = null;
  try {
    if (type === 'concepts') {
      body = (
        <table className="w-full text-sm"><tbody>
          {LEARNING_LANGUAGES.map((l) => <tr key={l}><td className="pe-3 font-bold">{l}</td><td>{r.cardLabel(String(entity.id), l)}</td><td className="text-ink-soft">{entity.wordClass === 'noun' ? r.realize(l, 'i-see', { subject: { noun: String(entity.id), adjectives: ['colors.red'] } }) : ''}</td></tr>)}
        </tbody></table>
      );
    } else if (type === 'episodes') {
      const child: ChildProfile = { id: 'preview', parentId: 'preview', nickname: 'Sam', age: 7, ageBand: 'adventurer', nativeLanguage: 'en', interfaceLocale: 'en', targetLanguage: lang, estimatedLevel: 'new', learningGoal: 'fun', interests: ['animals'], accessibilityNeeds: [],
        avatar: { skin: 'tone3', hair: 'short', hairColor: 'brown', face: 'smile', outfit: 'explorer', shoes: 'sneakers', accessory: 'none', background: 'meadow', color: 'sunrise' },
        settings: { dailyTargetMinutes: 15, audioEnabled: false, musicVolume: 0, voiceEnabled: false, reducedMotion: true, highContrast: false, largeText: false, dyslexiaFont: false, captions: true, screenTimeLimitMinutes: null, streaksEnabled: false }, onboarded: true, createdAt: new Date().toISOString() };
      const st = initialChildState(child, idx, new Date());
      const ep = idx.episodes.get(String(entity.id));
      const story = ep ? { ...st.story, activeArcId: ep.arcId, completedEpisodeIds: idx.bundle.arcs.find((a) => a.id === ep.arcId)?.episodeIds.filter((e) => (idx.episodes.get(e)?.order ?? 0) < ep.order) ?? [] } : st.story;
      const j = new NeverSameJourneyEngine(idx).compose({ child, progress: st.progress, mastery: [], reviews: [], story, companion: st.companion, history: [], premium: true, micAvailable: true, now: new Date(), journeysToday: 0 });
      body = (
        <ol className="space-y-1 text-sm">
          {j.steps.map((s) => <li key={s.id}><b>{s.kind}</b> {'lines' in s ? s.lines.map((l) => `${l.speaker}: ${l.text}${l.target ? ` [${l.target.text}]` : ''}`).join(' / ') : s.kind === 'game' ? `${s.game.type} · ${s.game.rounds.length} rounds` : ''}</li>)}
        </ol>
      );
    } else if (type === 'books' || type === 'songs') {
      const lines = (type === 'books' ? (entity.pages as { sentence: unknown }[]).map((p) => p.sentence) : (entity.lines as unknown[])) as ({ phraseId: string } | { template: string; slots: Record<string, string> })[];
      body = <ol className="list-decimal space-y-1 ps-5 text-sm">{lines.map((l, i) => <li key={i}>{'phraseId' in l ? idx.phrase(l.phraseId, lang)?.text : l.template === 'word' ? r.word(l.slots.noun!, lang) : r.realize(lang, l.template as never, { subject: { noun: l.slots.noun!, adjectives: l.slots.adj ? [l.slots.adj] : undefined }, prep: l.slots.prep, object: l.slots.object ? { noun: l.slots.object } : undefined, predicate: l.slots.predicate })}</li>)}</ol>;
    }
  } catch (e) { body = <p className="text-berry-dark">Preview error: {(e as Error).message}</p>; }
  if (!body) return null;
  return (
    <div className="rounded-tab border border-ink/10 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="font-bold">Preview</h3>
        {type !== 'concepts' && <select aria-label="Preview language" value={lang} onChange={(e) => setLang(e.target.value as LearningLanguage)} className="ms-auto rounded-tab border px-2 py-1">{LEARNING_LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select>}
        <span className="text-xs text-ink-faint">{draftVersion}</span>
      </div>
      {body}
    </div>
  );
}

export default function AdminContent() { return <Suspense><ContentInner /></Suspense>; }
void contentStore;
