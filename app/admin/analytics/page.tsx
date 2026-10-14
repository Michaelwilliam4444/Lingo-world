'use client';
import { useEffect, useState } from 'react';
import { computeProductMetrics } from '@/analytics/AnalyticsService';
import { getServices } from '@/services';
import { LocalRepository } from '@/services/data/LocalRepository';
import { isSupabaseConfigured } from '@/lib/config';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { ParentCard, MetricCard } from '@/components/ui/MetricCard';
import type { AnalyticsEventInput } from '@/services/data/DataRepository';

/** Product analytics from pseudonymous events. Analysts only (RLS) in cloud mode. */
export default function Analytics() {
  const [events, setEvents] = useState<AnalyticsEventInput[] | null>(null);
  const [learning, setLearning] = useState<{ before: number; after: number } | null>(null);
  useEffect(() => {
    (async () => {
      if (isSupabaseConfigured()) {
        const { data } = await getSupabaseBrowserClient().from('analytics_events').select('subject_id, subject_kind, name, props, at, platform').gte('at', new Date(Date.now() - 45 * 86_400_000).toISOString()).limit(50_000);
        setEvents((data ?? []).map((e) => ({ subjectId: e.subject_id, subjectKind: e.subject_kind, name: e.name, props: e.props, at: e.at, platform: e.platform })));
      } else {
        const repo = getServices().repo;
        setEvents(repo instanceof LocalRepository ? await repo.readAnalytics() : []);
      }
    })();
  }, []);
  useEffect(() => {
    if (!events) return;
    // Learning improvement: first-try accuracy in each subject's first week vs. their latest week.
    const acts = events.filter((e) => e.name === 'activity_complete' && typeof e.props.total === 'number' && Number(e.props.total) > 0);
    const bySubject = new Map<string, AnalyticsEventInput[]>();
    for (const a of acts) bySubject.set(a.subjectId, [...(bySubject.get(a.subjectId) ?? []), a]);
    let b = 0, bt = 0, a2 = 0, at = 0;
    for (const list of bySubject.values()) {
      if (list.length < 6) continue;
      const sorted = list.sort((x, y) => x.at.localeCompare(y.at));
      for (const e of sorted.slice(0, 3)) { b += Number(e.props.correct); bt += Number(e.props.total); }
      for (const e of sorted.slice(-3)) { a2 += Number(e.props.correct); at += Number(e.props.total); }
    }
    setLearning(bt && at ? { before: Math.round((b / bt) * 100), after: Math.round((a2 / at) * 100) } : null);
  }, [events]);
  if (!events) return <p>Loading…</p>;
  const m = computeProductMetrics(events);
  const pct = (v: number | null) => (v === null ? '—' : `${v}%`);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Product analytics</h1>
      <ParentCard title="Engagement">
        <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-4 lg:grid-cols-7">
          <MetricCard label="DAU" value={m.dau} /><MetricCard label="WAU" value={m.wau} /><MetricCard label="MAU" value={m.mau} />
          <MetricCard label="D1 retention" value={pct(m.d1)} /><MetricCard label="D7 retention" value={pct(m.d7)} /><MetricCard label="D30 retention" value={pct(m.d30)} />
          <MetricCard label="Avg session" value={m.averageSessionMin === null ? '—' : `${m.averageSessionMin} min`} />
        </div>
      </ParentCard>
      <ParentCard title="Learning & monetisation">
        <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-5">
          <MetricCard label="Journey completion" value={pct(m.journeyCompletion)} />
          <MetricCard label="Speaking attempts" value={m.speakingAttempts} detail={`${m.speakingAccepted} accepted`} />
          <MetricCard label="Learning improvement" value={learning ? `${learning.before}% → ${learning.after}%` : '—'} detail="first-try accuracy, first vs latest activities" />
          <MetricCard label="Subscription conversion" value={m.conversion === null ? '—' : `${m.conversion}%`} />
          <MetricCard label="Churn events" value={m.churn} />
        </div>
      </ParentCard>
      <div className="grid gap-6 lg:grid-cols-2">
        <ParentCard title="Game popularity"><ol className="list-decimal ps-5">{m.gamePopularity.map(([k, v]) => <li key={k}>{k} — {v}</li>)}</ol></ParentCard>
        <ParentCard title="World popularity"><ol className="list-decimal ps-5">{m.worldPopularity.map(([k, v]) => <li key={k}>{k} — {v}</li>)}</ol></ParentCard>
      </div>
      <p className="text-sm text-ink-soft">{m.totalEvents} events · children are counted by pseudonymous ids only.</p>
    </div>
  );
}
