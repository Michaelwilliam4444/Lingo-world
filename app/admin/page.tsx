'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useDraft } from '@/admin/useDraft';
import { contentStore } from '@/admin/ContentStore';
import { ENTITIES, listEntities } from '@/admin/entities';
import { ParentCard, MetricCard } from '@/components/ui/MetricCard';
import { LEARNING_LANGUAGES } from '@/types/core';

export default function AdminDashboard() {
  const { draft } = useDraft();
  const issues = useMemo(() => (draft ? contentStore.validate(draft) : []), [draft]);
  if (!draft) return <p>Loading content…</p>;
  const errors = issues.filter((i) => i.severity === 'error');
  const review = [...draft.episodes, ...draft.books, ...draft.arcs, ...draft.gameTemplates].filter((e) => e.status === 'review');
  const drafts = [...draft.episodes, ...draft.books, ...draft.arcs, ...draft.gameTemplates].filter((e) => e.status === 'draft');
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Content overview</h1>
      <ParentCard title={`Working draft · based on ${draft.version}`}>
        <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-4 lg:grid-cols-8">
          <MetricCard label="Concepts" value={draft.concepts.length} />
          <MetricCard label="Lexemes" value={draft.lexemes.length} detail={LEARNING_LANGUAGES.map((l) => `${l} ${draft.lexemes.filter((x) => x.language === l).length}`).join(' · ')} />
          <MetricCard label="Phrases" value={new Set(draft.phrases.map((p) => p.id)).size} detail="× 5 languages" />
          <MetricCard label="Units" value={draft.units.length} />
          <MetricCard label="Worlds" value={draft.worlds.length} />
          <MetricCard label="Episodes" value={draft.episodes.length} detail={`${draft.arcs.length} arcs`} />
          <MetricCard label="Books" value={draft.books.length} />
          <MetricCard label="Game types" value={draft.games.length} detail={`${draft.gameTemplates.length} templates`} />
        </div>
      </ParentCard>
      <div className="grid gap-6 lg:grid-cols-3">
        <ParentCard title="Validation">
          {errors.length ? <p className="font-bold text-berry-dark">{errors.length} errors block publishing</p> : <p className="font-bold text-lagoon-dark">Ready to publish</p>}
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-sm">{issues.slice(0, 30).map((i, k) => <li key={k}><b>{i.severity}</b> {i.where}: {i.message}</li>)}</ul>
        </ParentCard>
        <ParentCard title="Review queue">
          <p>{review.length} in review · {drafts.length} drafts</p>
          <ul className="mt-2 space-y-1 text-sm">{review.slice(0, 10).map((e) => <li key={e.id}>{e.id}</li>)}</ul>
          <Link href="/admin/content?type=episodes&status=review" className="mt-3 inline-block font-bold underline">Open queue</Link>
        </ParentCard>
        <ParentCard title="Content types">
          <ul className="grid grid-cols-2 gap-1 text-sm">{ENTITIES.map((e) => <li key={e.type}><Link className="underline" href={`/admin/content?type=${e.type}`}>{e.label}</Link> ({listEntities(draft, e.type).length})</li>)}</ul>
        </ParentCard>
      </div>
    </div>
  );
}
