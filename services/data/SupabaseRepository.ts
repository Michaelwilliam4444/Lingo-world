import type { SupabaseClient } from '@supabase/supabase-js';
import type { InterfaceLocale, LearningLanguage, MasteryVector } from '@/types/core';
import type { ContentBundle } from '@/types/content';
import type {
  ActivityRecord, BookProgress, ChildProfile, ChildState, CompanionState, Creation, DailySession, MasteryRecord, ParentProfile,
  ReviewState, SpeechAttemptRecord, Subscription,
} from '@/types/learner';
import type { DailyJourney } from '@/types/engine';
import type { WeeklyReport } from '@/parent/insights';
import { uuidFromString } from '@/lib/random';
import {
  RepositoryError, type AnalyticsEventInput, type AppNotification, type AuthUser, type DataRepository, type NewChildInput,
} from './DataRepository';
import { DEFAULT_AVATAR, ageBandFor, defaultSettings, freeSubscription } from './family';

type Row = Record<string, unknown>;

/**
 * SupabaseRepository — production persistence. All access is governed by RLS (see migrations);
 * the browser only ever holds the anon key + the parent's session. Writes are incremental:
 * only rows that changed since the last save are upserted.
 */
export class SupabaseRepository implements DataRepository {
  readonly mode = 'supabase' as const;
  private saved = new Map<string, { at: string; activityIds: Set<string>; speechIds: Set<string> }>();

  constructor(private readonly sb: SupabaseClient) {}

  private fail(error: { message: string; code?: string } | null, context: string): never {
    const msg = error?.message ?? 'Unknown error';
    if (/child_limit_reached/.test(msg)) throw new RepositoryError('child_limit_reached', 'limit');
    if (/JWT|auth|permission|row-level security/i.test(msg)) throw new RepositoryError(`${context}: not allowed`, 'auth');
    if (/fetch|network|Failed to fetch/i.test(msg)) throw new RepositoryError(`${context}: offline`, 'network');
    throw new RepositoryError(`${context}: ${msg}`);
  }

  private async uid(): Promise<string> {
    const { data } = await this.sb.auth.getUser();
    if (!data.user) throw new RepositoryError('Not signed in', 'auth');
    return data.user.id;
  }

  // ───────── auth ─────────
  async getCurrentUser(): Promise<AuthUser | null> {
    const { data } = await this.sb.auth.getUser();
    return data.user ? { id: data.user.id, email: data.user.email ?? '' } : null;
  }

  async signUp(email: string, password: string, displayName: string, locale: InterfaceLocale): Promise<AuthUser> {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { data: { display_name: displayName, locale } } });
    if (error || !data.user) throw new RepositoryError(error?.message ?? 'Sign-up failed', 'auth');
    return { id: data.user.id, email: data.user.email ?? email };
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new RepositoryError('Email or password is incorrect', 'auth');
    return { id: data.user.id, email: data.user.email ?? email };
  }

  async signInWithOAuth(provider: 'google' | 'apple'): Promise<void> {
    const { error } = await this.sb.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) throw new RepositoryError(error.message, 'auth');
  }

  async signOut() { await this.sb.auth.signOut(); }

  async requestPasswordReset(email: string) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/parent/settings` });
    if (error) throw new RepositoryError(error.message, 'auth');
  }

  // ───────── family ─────────
  async getParent(): Promise<ParentProfile | null> {
    const { data: u } = await this.sb.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await this.sb.from('parent_profiles').select('*').eq('id', u.user.id).maybeSingle();
    if (error) this.fail(error, 'getParent');
    if (!data) return null;
    return mapParent(data, u.user.email ?? '');
  }

  async updateParent(patch: Partial<ParentProfile>): Promise<ParentProfile> {
    const id = await this.uid();
    const row: Row = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.interfaceLocale !== undefined) row.interface_locale = patch.interfaceLocale;
    if (patch.parentPinHash !== undefined) row.parent_pin_hash = patch.parentPinHash;
    if (patch.consents) {
      row.consent_voice_processing = patch.consents.voiceProcessing;
      row.consent_analytics = patch.consents.analytics;
      row.consent_weekly_email = patch.consents.weeklyEmail;
      row.consent_notifications = patch.consents.notifications;
    }
    const { error } = await this.sb.from('parent_profiles').update(row).eq('id', id);
    if (error) this.fail(error, 'updateParent');
    return (await this.getParent())!;
  }

  async listChildren(): Promise<ChildProfile[]> {
    const { data, error } = await this.sb.from('children').select('*, child_preferences(*), avatars(config)').order('created_at');
    if (error) this.fail(error, 'listChildren');
    return (data ?? []).map(mapChild);
  }

  async createChild(input: NewChildInput): Promise<ChildProfile> {
    const parentId = await this.uid();
    const { data, error } = await this.sb.from('children').insert({
      parent_id: parentId, nickname: input.nickname.trim().slice(0, 24), age: input.age, age_band: ageBandFor(input.age),
      native_language: input.nativeLanguage, interface_locale: input.interfaceLocale, target_language: input.targetLanguage,
      estimated_level: input.estimatedLevel, learning_goal: input.learningGoal, interests: input.interests, accessibility_needs: input.accessibilityNeeds,
      track_id: input.trackId && input.trackId !== ageBandFor(input.age) ? input.trackId : null,
    }).select('*').single();
    if (error || !data) this.fail(error, 'createChild');
    const settings = defaultSettings(input);
    await this.sb.from('child_preferences').insert({ child_id: data.id, ...settingsToRow(settings) });
    await this.sb.from('avatars').insert({ child_id: data.id, config: DEFAULT_AVATAR });
    return mapChild({ ...data, child_preferences: settingsToRow(settings), avatars: { config: DEFAULT_AVATAR } });
  }

  async updateChild(child: ChildProfile): Promise<ChildProfile> {
    const { error } = await this.sb.from('children').update({
      nickname: child.nickname, age: child.age, age_band: ageBandFor(child.age), native_language: child.nativeLanguage,
      interface_locale: child.interfaceLocale, target_language: child.targetLanguage, estimated_level: child.estimatedLevel,
      learning_goal: child.learningGoal, interests: child.interests, accessibility_needs: child.accessibilityNeeds, onboarded: child.onboarded,
      track_id: child.trackId ?? null,
    }).eq('id', child.id);
    if (error) this.fail(error, 'updateChild');
    await this.sb.from('child_preferences').upsert({ child_id: child.id, ...settingsToRow(child.settings) });
    await this.sb.from('avatars').upsert({ child_id: child.id, config: child.avatar });
    return { ...child, ageBand: ageBandFor(child.age) };
  }

  async deleteChild(childId: string): Promise<void> {
    const { error } = await this.sb.from('children').delete().eq('id', childId);
    if (error) this.fail(error, 'deleteChild');
  }

  // ───────── learner state ─────────
  async loadChildState(child: ChildProfile): Promise<ChildState | null> {
    const L = child.targetLanguage;
    const id = child.id;
    const [progress, mastery, reviews, story, choices, companion, inventory, history, speech, books, creations, sessions] = await Promise.all([
      this.sb.from('language_progress').select('*').eq('child_id', id).eq('language', L).maybeSingle(),
      this.sb.from('learning_mastery').select('*').eq('child_id', id).eq('language', L),
      this.sb.from('review_schedule').select('*').eq('child_id', id).eq('language', L),
      this.sb.from('story_state').select('*').eq('child_id', id).eq('language', L).maybeSingle(),
      this.sb.from('story_choices').select('*').eq('child_id', id).eq('language', L),
      this.sb.from('companion_progress').select('*').eq('child_id', id).maybeSingle(),
      this.sb.from('reward_inventory').select('*').eq('child_id', id).maybeSingle(),
      this.sb.from('activity_history').select('*').eq('child_id', id).eq('language', L).order('at', { ascending: false }).limit(400),
      this.sb.from('speech_attempts').select('*').eq('child_id', id).eq('language', L).order('at', { ascending: false }).limit(300),
      this.sb.from('book_progress').select('*').eq('child_id', id).eq('language', L),
      this.sb.from('creations').select('*').eq('child_id', id),
      this.sb.from('daily_sessions').select('id, child_id, language, date, journey_id, started_at, ended_at, learning_ms, free_play_ms, journey_completed').eq('child_id', id).eq('language', L).order('date', { ascending: false }).limit(120),
    ]);
    for (const r of [progress, mastery, reviews, story, choices, companion, inventory, history, speech, books, creations, sessions]) if (r.error) this.fail(r.error, 'loadChildState');
    if (!progress.data) return null;
    const p = progress.data as Row;
    const inv = (inventory.data ?? {}) as Row;
    const st = (story.data ?? {}) as Row;
    const state: ChildState = {
      child,
      progress: { childId: id, language: L, stage: p.stage as never, currentUnitId: p.current_unit_id as string, completedUnitIds: p.completed_unit_ids as string[], difficulty: p.difficulty as number, challengeTolerance: p.challenge_tolerance as number },
      mastery: (mastery.data ?? []).map((m: Row) => ({ childId: id, language: L, itemId: m.item_id as string, itemType: m.item_type as 'concept', mastery: m.mastery as MasteryVector, attempts: m.attempts as number, correct: m.correct as number, consecutiveCorrect: m.consecutive_correct as number, consecutiveWrong: m.consecutive_wrong as number, firstSeenAt: m.first_seen_at as string | null, lastSeenAt: m.last_seen_at as string | null, updatedAt: m.updated_at as string })),
      reviews: (reviews.data ?? []).map((r: Row) => ({ childId: id, language: L, itemId: r.item_id as string, itemType: r.item_type as 'concept', ease: r.ease as number, intervalDays: r.interval_days as number, repetitions: r.repetitions as number, lapses: r.lapses as number, dueAt: r.due_at as string, lastReviewedAt: r.last_reviewed_at as string | null })),
      story: {
        childId: id, language: L, activeArcId: (st.active_arc_id as string) ?? 'golden-key', completedEpisodeIds: (st.completed_episode_ids as string[]) ?? [],
        choices: Object.fromEntries((choices.data ?? []).map((c: Row) => [c.choice_key as string, c.option_id as string])),
        memories: (st.memories as ChildState['story']['memories']) ?? [], lastEpisodeId: (st.last_episode_id as string) ?? null, pendingCliffhangerEpisodeId: (st.pending_cliffhanger_episode_id as string) ?? null,
      },
      companion: companion.data ? mapCompanion(companion.data, id) : { childId: id, name: 'Mimo', eggColor: 'gold', stage: 'egg', path: 'balanced', xp: 0, affinity: { speaking: 0, reading: 0, exploring: 0, creating: 0 }, happiness: 80, equippedCosmetics: [], learnedCommands: [], lastFedAt: null, hatchedAt: null },
      inventory: { childId: id, stars: (inv.stars as number) ?? 0, adventurePoints: (inv.adventure_points as number) ?? 0, rewardIds: (inv.reward_ids as string[]) ?? [], achievementIds: (inv.achievement_ids as string[]) ?? [], newRewardIds: (inv.new_reward_ids as string[]) ?? [] },
      streak: { childId: id, currentDays: (inv.streak_current as number) ?? 0, bestDays: (inv.streak_best as number) ?? 0, lastActiveDate: (inv.streak_last_date as string) ?? null },
      history: (history.data ?? []).reverse().map((h: Row) => ({ id: h.id as string, childId: id, language: L, sessionId: h.session_id as string, gameType: h.game_type as ActivityRecord['gameType'], family: h.family as ActivityRecord['family'], worldId: h.world_id as string | null, itemIds: h.item_ids as string[], correct: h.correct as number, total: h.total as number, stars: h.stars as 0, durationMs: h.duration_ms as number, abandoned: h.abandoned as boolean, difficulty: h.difficulty as number, at: h.at as string })),
      speech: (speech.data ?? []).reverse().map((s: Row) => ({ id: s.id as string, childId: id, language: L, itemId: s.item_id as string, expected: s.expected as string, heard: s.heard as string, score: s.score as number, accepted: s.accepted as boolean, focusSounds: s.focus_sounds as string[], at: s.at as string })),
      books: (books.data ?? []).map((b: Row) => ({ childId: id, bookId: b.book_id as string, language: L, pagesRead: b.pages_read as number, completed: b.completed as boolean, favorite: b.favorite as boolean, quizCorrect: b.quiz_correct as number, updatedAt: b.updated_at as string })),
      creations: (creations.data ?? []).map((c: Row) => ({ id: c.id as string, childId: id, kind: c.kind as Creation['kind'], title: c.title as string, language: c.language as LearningLanguage, objects: c.objects as Creation['objects'], storyLines: (c.story_lines as string[]) ?? undefined, background: c.background as string, createdAt: c.created_at as string, updatedAt: c.updated_at as string })),
      sessions: (sessions.data ?? []).reverse().map((s: Row) => ({ id: s.id as string, childId: id, language: L, date: s.date as string, journeyId: s.journey_id as string | null, startedAt: s.started_at as string, endedAt: s.ended_at as string | null, learningMs: s.learning_ms as number, freePlayMs: s.free_play_ms as number, journeyCompleted: s.journey_completed as boolean })),
      visitedWorldIds: (inv.visited_world_ids as string[]) ?? ['my-home'],
      activeJourney: null,
      updatedAt: new Date().toISOString(),
    };
    this.saved.set(id, { at: state.updatedAt, activityIds: new Set(state.history.map((h) => h.id)), speechIds: new Set(state.speech.map((s) => s.id)) });
    return state;
  }

  async saveChildState(state: ChildState): Promise<void> {
    const id = state.child.id;
    const L = state.child.targetLanguage;
    const marker = this.saved.get(id) ?? { at: '1970-01-01T00:00:00.000Z', activityIds: new Set<string>(), speechIds: new Set<string>() };
    const changed = <T extends { updatedAt?: string; lastReviewedAt?: string | null; dueAt?: string }>(rows: T[], key: (r: T) => string | null | undefined) =>
      rows.filter((r) => (key(r) ?? '') > marker.at);

    const ops: PromiseLike<{ error: { message: string } | null }>[] = [
      this.sb.from('language_progress').upsert({ child_id: id, language: L, stage: state.progress.stage, current_unit_id: state.progress.currentUnitId, completed_unit_ids: state.progress.completedUnitIds, difficulty: state.progress.difficulty, challenge_tolerance: state.progress.challengeTolerance }),
      this.sb.from('story_state').upsert({ child_id: id, language: L, active_arc_id: state.story.activeArcId, completed_episode_ids: state.story.completedEpisodeIds, memories: state.story.memories, last_episode_id: state.story.lastEpisodeId, pending_cliffhanger_episode_id: state.story.pendingCliffhangerEpisodeId }),
      this.sb.from('companion_progress').upsert(companionToRow(state.companion)),
      this.sb.from('reward_inventory').upsert({ child_id: id, stars: state.inventory.stars, adventure_points: state.inventory.adventurePoints, reward_ids: state.inventory.rewardIds, achievement_ids: state.inventory.achievementIds, new_reward_ids: state.inventory.newRewardIds, streak_current: state.streak.currentDays, streak_best: state.streak.bestDays, streak_last_date: state.streak.lastActiveDate, visited_world_ids: state.visitedWorldIds }),
    ];
    const choiceRows = Object.entries(state.story.choices).map(([k, v]) => ({ child_id: id, language: L, choice_key: k, option_id: v }));
    if (choiceRows.length) ops.push(this.sb.from('story_choices').upsert(choiceRows));
    const masteryRows = changed(state.mastery, (m) => m.updatedAt).map((m: MasteryRecord) => ({ child_id: id, language: L, item_id: m.itemId, item_type: m.itemType, mastery: m.mastery, attempts: m.attempts, correct: m.correct, consecutive_correct: m.consecutiveCorrect, consecutive_wrong: m.consecutiveWrong, first_seen_at: m.firstSeenAt, last_seen_at: m.lastSeenAt }));
    if (masteryRows.length) ops.push(this.sb.from('learning_mastery').upsert(masteryRows));
    const reviewRows = changed(state.reviews, (r) => r.lastReviewedAt ?? r.dueAt).map((r: ReviewState) => ({ child_id: id, language: L, item_id: r.itemId, item_type: r.itemType, ease: r.ease, interval_days: r.intervalDays, repetitions: r.repetitions, lapses: r.lapses, due_at: r.dueAt, last_reviewed_at: r.lastReviewedAt }));
    if (reviewRows.length) ops.push(this.sb.from('review_schedule').upsert(reviewRows));
    const newActivities = state.history.filter((h) => !marker.activityIds.has(h.id)).map((h: ActivityRecord) => ({ id: h.id, child_id: id, language: L, session_id: h.sessionId, game_type: h.gameType, family: h.family, world_id: h.worldId, item_ids: h.itemIds, correct: h.correct, total: h.total, stars: h.stars, duration_ms: h.durationMs, abandoned: h.abandoned, difficulty: h.difficulty, at: h.at }));
    if (newActivities.length) ops.push(this.sb.from('activity_history').upsert(newActivities));
    const newSpeech = state.speech.filter((s) => !marker.speechIds.has(s.id)).map((s: SpeechAttemptRecord) => ({ id: s.id, child_id: id, language: L, item_id: s.itemId, expected: s.expected, heard: s.heard, score: Math.round(s.score), accepted: s.accepted, focus_sounds: s.focusSounds, at: s.at }));
    if (newSpeech.length) ops.push(this.sb.from('speech_attempts').upsert(newSpeech));
    const bookRows = changed(state.books, (b) => b.updatedAt).map((b: BookProgress) => ({ child_id: id, book_id: b.bookId, language: L, pages_read: b.pagesRead, completed: b.completed, favorite: b.favorite, quiz_correct: b.quizCorrect }));
    if (bookRows.length) ops.push(this.sb.from('book_progress').upsert(bookRows));
    const creationRows = changed(state.creations, (c) => c.updatedAt).map((c: Creation) => ({ id: c.id, child_id: id, kind: c.kind, title: c.title, language: c.language, objects: c.objects, story_lines: c.storyLines ?? null, background: c.background }));
    if (creationRows.length) ops.push(this.sb.from('creations').upsert(creationRows));
    const sessionRows = state.sessions.filter((s) => (s.endedAt ?? s.startedAt) > marker.at).map((s: DailySession) => ({ id: s.id, child_id: id, language: L, date: s.date, journey_id: s.journeyId, started_at: s.startedAt, ended_at: s.endedAt, learning_ms: s.learningMs, free_play_ms: s.freePlayMs, journey_completed: s.journeyCompleted }));
    if (sessionRows.length) ops.push(this.sb.from('daily_sessions').upsert(sessionRows));

    const results = await Promise.all(ops);
    const err = results.find((r) => r.error);
    if (err?.error) this.fail(err.error, 'saveChildState');
    this.saved.set(id, { at: state.updatedAt, activityIds: new Set(state.history.map((h) => h.id)), speechIds: new Set(state.speech.map((s) => s.id)) });
  }

  async saveJourney(childId: string, journey: DailyJourney): Promise<void> {
    const { error } = await this.sb.from('daily_sessions').upsert({ id: uuidFromString(journey.id), child_id: childId, language: journey.language, date: journey.date, journey_id: journey.id, journey });
    if (error) this.fail(error, 'saveJourney');
  }

  async loadJourney(childId: string, language: LearningLanguage, date: string): Promise<DailyJourney | null> {
    const { data, error } = await this.sb.from('daily_sessions').select('journey').eq('child_id', childId).eq('language', language).eq('date', date).not('journey', 'is', null).order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (error) this.fail(error, 'loadJourney');
    return (data?.journey as DailyJourney) ?? null;
  }

  // ───────── billing ─────────
  async getSubscription(): Promise<Subscription> {
    const id = await this.uid();
    const { data } = await this.sb.from('subscriptions').select('*').eq('parent_id', id).maybeSingle();
    if (!data) return freeSubscription(id);
    return { parentId: id, plan: data.plan, status: data.status, provider: data.provider, providerCustomerId: data.provider_customer_id ?? undefined, providerSubscriptionId: data.provider_subscription_id ?? undefined, currentPeriodEnd: data.current_period_end, seats: data.seats, cancelAtPeriodEnd: !!data.cancel_at_period_end, paymentMethod: data.payment_method ?? undefined };
  }

  // ───────── reports & notifications ─────────
  async saveReport(report: WeeklyReport): Promise<void> {
    const { error } = await this.sb.from('parent_reports').upsert({ child_id: report.childId, week_start: report.weekStart, language: report.language, report }, { onConflict: 'child_id,week_start,language' });
    if (error) this.fail(error, 'saveReport');
  }

  async listReports(childId: string): Promise<WeeklyReport[]> {
    const { data, error } = await this.sb.from('parent_reports').select('report').eq('child_id', childId).order('week_start', { ascending: false }).limit(26);
    if (error) this.fail(error, 'listReports');
    return (data ?? []).map((r) => r.report as WeeklyReport);
  }

  async listNotifications(): Promise<AppNotification[]> {
    const { data, error } = await this.sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) this.fail(error, 'listNotifications');
    return (data ?? []).map((n: Row) => ({ id: n.id as string, childId: n.child_id as string | null, kind: n.kind as AppNotification['kind'], title: n.title as string, body: n.body as string, readAt: n.read_at as string | null, createdAt: n.created_at as string }));
  }

  async addNotification(n: Omit<AppNotification, 'id' | 'createdAt' | 'readAt'>): Promise<void> {
    const parentId = await this.uid();
    await this.sb.from('notifications').insert({ parent_id: parentId, child_id: n.childId, kind: n.kind, title: n.title, body: n.body });
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  }

  async trackEvents(events: AnalyticsEventInput[]): Promise<void> {
    if (!events.length) return;
    const { error } = await this.sb.from('analytics_events').insert(events.map((e) => ({ subject_id: e.subjectId, subject_kind: e.subjectKind, name: e.name, props: e.props, platform: e.platform, at: e.at, app_env: process.env.NEXT_PUBLIC_APP_ENV ?? 'production' })));
    if (error) this.fail(error, 'trackEvents');
  }

  async exportFamilyData(): Promise<unknown> {
    const { data, error } = await this.sb.rpc('export_family_data');
    if (error) this.fail(error, 'exportFamilyData');
    return data;
  }

  async deleteAccount(): Promise<void> {
    const { data } = await this.sb.auth.getSession();
    const res = await fetch('/api/account/delete', { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } });
    if (!res.ok) throw new RepositoryError('Account deletion failed', 'unknown');
    await this.sb.auth.signOut();
  }

  async loadPublishedContent(): Promise<ContentBundle | null> {
    const { data, error } = await this.sb.from('content_bundles').select('bundle').eq('published', true).order('published_at', { ascending: false }).limit(1).maybeSingle();
    if (error) return null;
    return (data?.bundle as ContentBundle) ?? null;
  }
}

function mapParent(row: Row, email: string): ParentProfile {
  return {
    id: row.id as string, email, displayName: row.display_name as string, interfaceLocale: row.interface_locale as InterfaceLocale,
    parentPinHash: (row.parent_pin_hash as string) ?? undefined, createdAt: row.created_at as string,
    consents: { voiceProcessing: row.consent_voice_processing as boolean, analytics: row.consent_analytics as boolean, weeklyEmail: row.consent_weekly_email as boolean, notifications: row.consent_notifications as boolean },
  };
}

function settingsToRow(s: ChildProfile['settings']): Row {
  return {
    daily_target_minutes: s.dailyTargetMinutes, audio_enabled: s.audioEnabled, music_volume: s.musicVolume, voice_enabled: s.voiceEnabled,
    reduced_motion: s.reducedMotion, high_contrast: s.highContrast, large_text: s.largeText, dyslexia_font: s.dyslexiaFont, captions: s.captions,
    screen_time_limit_minutes: s.screenTimeLimitMinutes, streaks_enabled: s.streaksEnabled,
  };
}

function mapChild(row: Row): ChildProfile {
  const prefRaw = row.child_preferences as Row | Row[] | null;
  const pref = (Array.isArray(prefRaw) ? prefRaw[0] : prefRaw) ?? {};
  const avatarRaw = row.avatars as { config: ChildProfile['avatar'] } | { config: ChildProfile['avatar'] }[] | null;
  const avatar = (Array.isArray(avatarRaw) ? avatarRaw[0]?.config : avatarRaw?.config) ?? DEFAULT_AVATAR;
  return {
    id: row.id as string, parentId: row.parent_id as string, nickname: row.nickname as string, age: row.age as number,
    ageBand: row.age_band as ChildProfile['ageBand'], nativeLanguage: row.native_language as string, interfaceLocale: row.interface_locale as InterfaceLocale,
    targetLanguage: row.target_language as LearningLanguage, estimatedLevel: row.estimated_level as ChildProfile['estimatedLevel'],
    learningGoal: row.learning_goal as ChildProfile['learningGoal'], interests: row.interests as ChildProfile['interests'],
    accessibilityNeeds: row.accessibility_needs as string[], avatar, onboarded: row.onboarded as boolean, createdAt: row.created_at as string,
    analyticsId: row.analytics_id as string,
    ...(row.track_id ? { trackId: row.track_id as ChildProfile['ageBand'] } : {}),
    settings: {
      dailyTargetMinutes: ((pref.daily_target_minutes as number) ?? 15) as 10 | 15 | 20, audioEnabled: (pref.audio_enabled as boolean) ?? true,
      musicVolume: (pref.music_volume as number) ?? 0.5, voiceEnabled: (pref.voice_enabled as boolean) ?? true, reducedMotion: (pref.reduced_motion as boolean) ?? false,
      highContrast: (pref.high_contrast as boolean) ?? false, largeText: (pref.large_text as boolean) ?? false, dyslexiaFont: (pref.dyslexia_font as boolean) ?? false,
      captions: (pref.captions as boolean) ?? true, screenTimeLimitMinutes: (pref.screen_time_limit_minutes as number | null) ?? null, streaksEnabled: (pref.streaks_enabled as boolean) ?? true,
    },
  };
}

function mapCompanion(row: Row, childId: string): CompanionState {
  return {
    childId, name: row.name as string, eggColor: row.egg_color as string, stage: row.stage as CompanionState['stage'], path: row.path as CompanionState['path'],
    xp: row.xp as number, affinity: row.affinity as CompanionState['affinity'], happiness: row.happiness as number,
    equippedCosmetics: row.equipped_cosmetics as string[], learnedCommands: row.learned_commands as string[], lastFedAt: row.last_fed_at as string | null, hatchedAt: row.hatched_at as string | null,
  };
}

function companionToRow(c: CompanionState): Row {
  return { child_id: c.childId, name: c.name, egg_color: c.eggColor, stage: c.stage, path: c.path, xp: c.xp, affinity: c.affinity, happiness: c.happiness, equipped_cosmetics: c.equippedCosmetics, learned_commands: c.learnedCommands, last_fed_at: c.lastFedAt, hatched_at: c.hatchedAt };
}
