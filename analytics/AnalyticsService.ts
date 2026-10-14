import type { AnalyticsEventInput, DataRepository } from '@/services/data/DataRepository';

/**
 * Privacy-conscious analytics.
 *  - Children are identified only by a pseudonymous analytics id (never name, age, or child id).
 *  - Props are restricted to an allow-list of non-identifying keys and primitive values.
 *  - Nothing is sent when the parent has opted out; events are batched and dropped if the queue grows.
 */
export const EVENT_NAMES = [
  'onboarding_completed', 'child_onboarding_completed', 'journey_start', 'journey_complete', 'activity_complete', 'activity_abandon',
  'answer_correct', 'answer_incorrect', 'speech_attempt', 'world_unlock', 'reward_unlock', 'session_duration', 'app_open',
  'feature_use', 'subscription_view', 'subscription_start', 'book_complete', 'creation_saved', 'mimo_evolved',
  'track_changed', 'checkout_start', 'payment_succeeded',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

const ALLOWED_PROPS = new Set([
  'gameType', 'family', 'worldId', 'episodeId', 'language', 'ageBand', 'stars', 'correct', 'total', 'durationSec', 'difficulty',
  'feature', 'plan', 'stage', 'accepted', 'score', 'rewardKind', 'mode', 'platform', 'locale', 'step', 'variant', 'experiment', 'track', 'fromTrack', 'provider', 'method', 'currency',
]);

export class AnalyticsService {
  private queue: AnalyticsEventInput[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private consent = true;

  constructor(private readonly repo: DataRepository, private readonly platform = detectPlatform()) {}

  setConsent(allowed: boolean) {
    this.consent = allowed;
    if (!allowed) this.queue = [];
  }

  track(name: EventName, subject: { kind: 'child' | 'parent' | 'anonymous'; id: string }, props: Record<string, unknown> = {}) {
    if (!this.consent) return;
    const clean: AnalyticsEventInput['props'] = {};
    for (const [k, v] of Object.entries(props)) {
      if (!ALLOWED_PROPS.has(k)) continue;
      if (typeof v === 'string') clean[k] = v.slice(0, 64);
      else if (typeof v === 'number' || typeof v === 'boolean' || v === null) clean[k] = v as number | boolean | null;
    }
    this.queue.push({ subjectId: subject.id, subjectKind: subject.kind, name, props: clean, at: new Date().toISOString(), platform: this.platform });
    if (this.queue.length > 200) this.queue = this.queue.slice(-200);
    if (!this.timer) this.timer = setTimeout(() => void this.flush(), 4000);
  }

  async flush() {
    this.timer = null;
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, this.queue.length);
    try { await this.repo.trackEvents(batch); } catch { /* analytics must never break the app */ }
  }
}

function detectPlatform(): string {
  if (typeof window === 'undefined') return 'server';
  const cap = (window as unknown as { Capacitor?: { getPlatform(): string } }).Capacitor;
  if (cap) return cap.getPlatform();
  return window.matchMedia?.('(display-mode: standalone)').matches ? 'pwa' : 'web';
}

/** Product metrics computed from raw events (admin dashboard). */
export function computeProductMetrics(events: AnalyticsEventInput[], now = new Date()) {
  const day = 86_400_000;
  const childEvents = events.filter((e) => e.subjectKind === 'child');
  const activeIn = (ms: number) => new Set(childEvents.filter((e) => now.getTime() - new Date(e.at).getTime() <= ms).map((e) => e.subjectId)).size;
  const firstSeen = new Map<string, number>();
  const activeDays = new Map<string, Set<number>>();
  for (const e of childEvents) {
    const t = new Date(e.at).getTime();
    const d = Math.floor(t / day);
    firstSeen.set(e.subjectId, Math.min(firstSeen.get(e.subjectId) ?? t, t));
    activeDays.set(e.subjectId, (activeDays.get(e.subjectId) ?? new Set()).add(d));
  }
  const retention = (n: number) => {
    const cohort = [...firstSeen.entries()].filter(([, t]) => now.getTime() - t >= n * day);
    if (!cohort.length) return null;
    const retained = cohort.filter(([id, t]) => activeDays.get(id)?.has(Math.floor(t / day) + n)).length;
    return Math.round((retained / cohort.length) * 100);
  };
  const count = (name: string) => events.filter((e) => e.name === name).length;
  const starts = count('journey_start');
  const completes = count('journey_complete');
  const durations = events.filter((e) => e.name === 'session_duration').map((e) => Number(e.props.durationSec ?? 0));
  const byProp = (name: string, prop: string) => {
    const m = new Map<string, number>();
    for (const e of events.filter((x) => x.name === name)) { const k = String(e.props[prop] ?? '—'); m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  };
  const parents = new Set(events.filter((e) => e.subjectKind === 'parent').map((e) => e.subjectId)).size;
  const subs = count('subscription_start');
  return {
    dau: activeIn(day), wau: activeIn(7 * day), mau: activeIn(30 * day),
    d1: retention(1), d7: retention(7), d30: retention(30),
    journeyCompletion: starts ? Math.round((completes / starts) * 100) : null,
    averageSessionMin: durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length / 6) / 10 : null,
    speakingAttempts: count('speech_attempt'),
    speakingAccepted: events.filter((e) => e.name === 'speech_attempt' && e.props.accepted === true).length,
    gamePopularity: byProp('activity_complete', 'gameType'),
    worldPopularity: byProp('journey_complete', 'worldId'),
    conversion: parents ? Math.round((subs / parents) * 1000) / 10 : null,
    churn: count('subscription_cancel' as never),
    totalEvents: events.length,
  };
}
