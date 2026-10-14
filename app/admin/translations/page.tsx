'use client';
import { useMemo, useState } from 'react';
import { useDraft } from '@/admin/useDraft';
import { entityDef, listEntities, missingTranslations, setAtPath, upsertEntity, type EntityType } from '@/admin/entities';
import { translationCoverage } from '@/i18n';
import { ParentCard } from '@/components/ui/MetricCard';
import { Button } from '@/components/ui/Button';
import { getKV } from '@/lib/kv';
import { INTERFACE_LOCALES, LEARNING_LANGUAGES } from '@/types/core';

/**
 * Translation manager. Two kinds of translation:
 *  1. Interface/narrative text (stories, worlds, books…) per interface locale — source text, translation,
 *     review status, reviewer and version are tracked; machine translation is never published unreviewed.
 *  2. Target-language content (lexemes/phrases) — reviewed by native-speaker teachers via the Content editor.
 */
interface TState { status: 'draft' | 'review' | 'published'; reviewer?: string; version: number }

export default function Translations() {
  const { draft, save } = useDraft();
  const [locale, setLocale] = useState('ar');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<Record<string, TState>>({});
  const missing = useMemo(() => (draft ? missingTranslations(draft, locale) : []), [draft, locale]);
  const ui = useMemo(() => translationCoverage(), []);
  if (!draft) return <p>Loading…</p>;

  const lexCoverage = LEARNING_LANGUAGES.map((l) => ({ l, n: draft.lexemes.filter((x) => x.language === l).length }));
  const keyOf = (m: { where: string; path: string }) => `${m.where}|${m.path}`;

  const apply = async (m: { where: string; path: string; en: string }, status: TState['status']) => {
    const text = edits[keyOf(m)]?.trim();
    if (!text) return;
    const [type, id] = m.where.split('/') as [EntityType, string];
    const def = entityDef(type)!;
    const entity = listEntities(draft, type).find((e) => def.key(e) === id);
    if (!entity) return;
    const path = `${m.path}.${locale}`;
    await save(upsertEntity(draft, type, setAtPath(entity, path, text) as Record<string, unknown>, id), `translate:${locale}:${status}`, `${m.where}:${m.path}`);
    const next = { ...meta, [keyOf(m)]: { status, reviewer: status === 'published' ? 'admin' : undefined, version: (meta[keyOf(m)]?.version ?? 0) + 1 } };
    setMeta(next);
    await getKV('lingoworld-admin').set(`translations:${locale}`, next);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Translations</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <ParentCard title="Interface strings (app/i18n)">
          <table className="w-full text-sm"><tbody>{INTERFACE_LOCALES.map((l) => <tr key={l}><td className="font-bold">{l}</td><td>{ui[l].translated}/{ui[l].total}</td><td className="text-ink-soft">{ui[l].missing.length ? `${ui[l].missing.length} fall back to English` : 'complete'}</td></tr>)}</tbody></table>
        </ParentCard>
        <ParentCard title="Target-language content">
          <table className="w-full text-sm"><tbody>{lexCoverage.map(({ l, n }) => <tr key={l}><td className="font-bold">{l}</td><td>{n} words · {new Set(draft.phrases.filter((p) => p.language === l).map((p) => p.id)).size} phrases</td></tr>)}</tbody></table>
          <p className="mt-2 text-sm text-ink-soft">Edit and approve target-language words under Content → Translations of words. Educational language content requires native-speaker review.</p>
        </ParentCard>
      </div>
      <ParentCard title={`Story & world text missing in “${locale}” (${missing.length})`} action={
        <select aria-label="Locale" value={locale} onChange={(e) => setLocale(e.target.value)} className="rounded-tab border-2 border-ink/15 px-2 py-1">{INTERFACE_LOCALES.filter((l) => l !== 'en').map((l) => <option key={l}>{l}</option>)}</select>}>
        <ul className="divide-y divide-ink/10">
          {missing.slice(0, 60).map((m) => {
            const k = keyOf(m);
            return (
              <li key={k} className="grid gap-2 py-3 md:grid-cols-[1fr_1fr_auto]">
                <div><p className="text-xs text-ink-faint">{m.where} · {m.path}</p><p>{m.en}</p></div>
                <textarea aria-label="Translation" dir={locale === 'ar' ? 'rtl' : 'ltr'} value={edits[k] ?? ''} onChange={(e) => setEdits({ ...edits, [k]: e.target.value })} className="min-h-[60px] rounded-tab border-2 border-ink/15 p-2" />
                <div className="flex flex-col gap-1">
                  <Button variant="parent-quiet" className="h-9 px-3 text-sm" onClick={() => void apply(m, 'review')}>Send to review</Button>
                  <Button variant="parent" className="h-9 px-3 text-sm" onClick={() => void apply(m, 'published')}>Approve</Button>
                  {meta[k] && <span className="text-xs text-ink-soft">{meta[k]!.status} · v{meta[k]!.version}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        {missing.length > 60 && <p className="mt-2 text-sm text-ink-soft">Showing 60 of {missing.length}. Export/import JSON per content type for bulk translation.</p>}
      </ParentCard>
    </div>
  );
}
