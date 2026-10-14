'use client';
import { trackIdOf } from '@/learning-engine/track';
import { create } from 'zustand';
import type { AgeBand, InterfaceLocale, PlanId } from '@/types/core';
import type { AvatarConfig, ChildProfile, ChildState, Creation, ParentProfile, Subscription } from '@/types/learner';
import type { DailyJourney } from '@/types/engine';
import { getServices, refreshContent } from '@/services';
import { initialChildState, type ActivityResult, type Effects } from '@/learning-engine/LearningOrchestrator';
import { companionEngine } from '@/companions/CompanionEngine';
import { entitlementsFor, type Entitlements } from '@/billing/plans';
import type { CheckoutOptions } from '@/billing/BillingProvider';
import { freeSubscription } from '@/services/data/family';
import { RepositoryError, type NewChildInput } from '@/services/data/DataRepository';
import { toLocalDateKey } from '@/lib/time';
import { newId } from '@/lib/id';

const ACTIVE_CHILD_KEY = 'lw.activeChild';
const PARENT_UNLOCK_KEY = 'lw.parentUnlockedUntil';

export type Status = 'booting' | 'signed-out' | 'ready';

interface AppState {
  status: Status;
  error: string | null;
  parent: ParentProfile | null;
  children: ChildProfile[];
  subscription: Subscription | null;
  entitlements: Entitlements;
  activeChildId: string | null;
  childState: ChildState | null;
  journey: DailyJourney | null;
  pendingSync: number;
  lastEffects: Effects | null;
  contentVersion: string;
  micAvailable: boolean;

  boot(): Promise<void>;
  signUp(email: string, password: string, displayName: string, locale: InterfaceLocale): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refreshFamily(): Promise<void>;
  updateParent(patch: Partial<ParentProfile>): Promise<void>;
  createChild(input: NewChildInput): Promise<ChildProfile>;
  updateChild(child: ChildProfile): Promise<void>;
  deleteChild(childId: string): Promise<void>;
  selectChild(childId: string | null): Promise<void>;
  completeChildOnboarding(avatar: AvatarConfig, eggColor: string, interests: ChildProfile['interests']): Promise<void>;
  todaysJourney(): Promise<DailyJourney | null>;
  journeysCompletedToday(): number;
  recordActivity(result: ActivityResult): Promise<Effects | null>;
  recordChoice(choiceKey: string, optionId: string): Promise<void>;
  setJourneyStep(stepIndex: number): Promise<void>;
  completeJourney(learningMs: number): Promise<Effects | null>;
  addFreePlay(ms: number): Promise<void>;
  saveCreation(c: Omit<Creation, 'id' | 'childId' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Creation | null>;
  updateBook(bookId: string, patch: { pagesRead?: number; completed?: boolean; favorite?: boolean; quizCorrect?: number }): Promise<void>;
  careForMimo(action: 'feed' | 'play' | 'sleep' | 'pet'): Promise<void>;
  equipCosmetic(rewardId: string): Promise<void>;
  renameMimo(name: string): Promise<void>;
  markRewardsSeen(): Promise<void>;
  visitWorld(worldId: string): Promise<void>;
  /** Starts checkout (redirects) or, for 'free', opens management / turns off renewal. Returns a message to show, if any. */
  setPlan(plan: PlanId, opts?: CheckoutOptions): Promise<string | null>;
  /** Parent Zone: move a child to another learning track (keeps all progress). */
  changeTrack(childId: string, track: AgeBand): Promise<void>;
  isParentUnlocked(): boolean;
  unlockParent(minutes?: number): void;
  lockParent(): void;
}

function persistActiveChild(id: string | null) {
  try { if (id) localStorage.setItem(ACTIVE_CHILD_KEY, id); else localStorage.removeItem(ACTIVE_CHILD_KEY); } catch { /* ignore */ }
}

export const useApp = create<AppState>((set, get) => {
  const save = async (state: ChildState) => {
    const s = getServices();
    set({ childState: state });
    if (s.sync) {
      await s.sync.save(state);
      set({ pendingSync: await s.sync.pendingCount() });
    } else {
      await s.repo.saveChildState(state);
    }
  };

  const premium = () => get().entitlements.premium;

  return {
    status: 'booting',
    error: null,
    parent: null,
    children: [],
    subscription: null,
    entitlements: entitlementsFor(freeSubscription('')),
    activeChildId: null,
    childState: null,
    journey: null,
    pendingSync: 0,
    lastEffects: null,
    contentVersion: '',
    micAvailable: false,

    async boot() {
      const s = getServices();
      const micAvailable = s.recognition.id === 'browser';
      try {
        const contentVersion = await refreshContent();
        const user = await s.repo.getCurrentUser();
        if (!user) { set({ status: 'signed-out', contentVersion, micAvailable }); return; }
        set({ contentVersion, micAvailable });
        await get().refreshFamily();
        let active: string | null = null;
        try { active = localStorage.getItem(ACTIVE_CHILD_KEY); } catch { /* ignore */ }
        if (active && get().children.some((c) => c.id === active)) await get().selectChild(active);
        s.sync?.onPendingChange((n) => set({ pendingSync: n }));
        void s.sync?.flush();
        set({ status: 'ready' });
        s.analytics.track('app_open', { kind: 'parent', id: user.id });
      } catch (e) {
        set({ status: 'signed-out', error: (e as Error).message, micAvailable });
      }
    },

    async signUp(email, password, displayName, locale) {
      const s = getServices();
      await s.repo.signUp(email, password, displayName, locale);
      await get().refreshFamily();
      set({ status: 'ready', error: null });
    },

    async signIn(email, password) {
      const s = getServices();
      await s.repo.signIn(email, password);
      await get().refreshFamily();
      set({ status: 'ready', error: null });
    },

    async signOut() {
      await getServices().repo.signOut();
      persistActiveChild(null);
      get().lockParent();
      set({ status: 'signed-out', parent: null, children: [], childState: null, activeChildId: null, journey: null, subscription: null });
    },

    async refreshFamily() {
      const s = getServices();
      const [parent, children, subscription] = await Promise.all([s.repo.getParent(), s.repo.listChildren(), s.repo.getSubscription()]);
      s.analytics.setConsent(parent?.consents.analytics ?? true);
      set({ parent, children, subscription, entitlements: entitlementsFor(subscription) });
    },

    async updateParent(patch) {
      const parent = await getServices().repo.updateParent(patch);
      getServices().analytics.setConsent(parent.consents.analytics);
      set({ parent });
    },

    async createChild(input) {
      const s = getServices();
      const child = await s.repo.createChild(input);
      const state = initialChildState(child, s.content, new Date());
      if (s.sync) await s.sync.save(state); else await s.repo.saveChildState(state);
      set({ children: [...get().children, child] });
      s.analytics.track('onboarding_completed', { kind: 'parent', id: child.parentId }, { language: child.targetLanguage, ageBand: child.ageBand });
      return child;
    },

    async updateChild(child) {
      const s = getServices();
      const prev = get().children.find((c) => c.id === child.id);
      const saved = await s.repo.updateChild(child);
      set({ children: get().children.map((c) => (c.id === saved.id ? saved : c)) });
      if (get().activeChildId === child.id) {
        if (prev && prev.targetLanguage !== saved.targetLanguage) await get().selectChild(saved.id);
        else if (get().childState) set({ childState: { ...get().childState!, child: saved } });
      }
    },

    async deleteChild(childId) {
      await getServices().repo.deleteChild(childId);
      if (get().activeChildId === childId) { persistActiveChild(null); set({ activeChildId: null, childState: null, journey: null }); }
      set({ children: get().children.filter((c) => c.id !== childId) });
    },

    async selectChild(childId) {
      const s = getServices();
      persistActiveChild(childId);
      if (!childId) { set({ activeChildId: null, childState: null, journey: null }); return; }
      const child = get().children.find((c) => c.id === childId);
      if (!child) return;
      let state = s.sync ? await s.sync.load(child) : await s.repo.loadChildState(child);
      if (!state) {
        state = initialChildState(child, s.content, new Date());
        await save(state);
      }
      state = { ...state, child, companion: companionEngine.decay(state.companion, new Date()) };
      set({ activeChildId: childId, childState: state, journey: null });
      s.audio.enabled = child.settings.audioEnabled;
    },

    async completeChildOnboarding(avatar, eggColor, interests) {
      const st = get().childState;
      if (!st) return;
      const child = { ...st.child, avatar, interests, onboarded: true };
      await get().updateChild(child);
      await save({ ...st, child, companion: { ...st.companion, eggColor }, updatedAt: new Date().toISOString() });
      getServices().analytics.track('child_onboarding_completed', { kind: 'child', id: child.analyticsId ?? child.id }, { ageBand: child.ageBand, language: child.targetLanguage });
    },

    journeysCompletedToday() {
      const st = get().childState;
      if (!st) return 0;
      const today = toLocalDateKey(new Date());
      return st.sessions.filter((x) => x.date === today && x.journeyCompleted).length;
    },

    async todaysJourney() {
      const s = getServices();
      const st = get().childState;
      if (!st) return null;
      const now = new Date();
      const date = toLocalDateKey(now);
      const done = get().journeysCompletedToday();
      if (done >= get().entitlements.dailyJourneyLimit) return null; // healthy endpoint reached
      const existing = get().journey;
      const trackNow = trackIdOf(st.child);
      if (existing && existing.date === date && existing.language === st.child.targetLanguage && existing.ageBand === trackNow && !st.sessions.some((x) => x.journeyId === existing.id && x.journeyCompleted)) return existing;
      const stored = s.sync ? await s.sync.loadJourney(st.child.id, st.child.targetLanguage, date) : await s.repo.loadJourney(st.child.id, st.child.targetLanguage, date);
      if (stored && stored.ageBand === trackNow && !st.sessions.some((x) => x.journeyId === stored.id && x.journeyCompleted)) {
        set({ journey: stored });
        return stored;
      }
      const journey = s.journeys.compose({
        child: st.child, progress: st.progress, mastery: st.mastery, reviews: st.reviews, story: st.story, companion: st.companion,
        history: st.history, premium: premium(), micAvailable: get().micAvailable, now, journeysToday: done,
      });
      if (s.sync) await s.sync.saveJourney(st.child.id, journey); else await s.repo.saveJourney(st.child.id, journey);
      await save({ ...st, activeJourney: { journeyId: journey.id, stepIndex: 0, date } });
      set({ journey });
      s.analytics.track('journey_start', { kind: 'child', id: st.child.analyticsId ?? st.child.id }, { episodeId: journey.episodeId, worldId: journey.worldId, language: journey.language, ageBand: journey.ageBand });
      return journey;
    },

    async setJourneyStep(stepIndex) {
      const st = get().childState;
      const j = get().journey;
      if (!st || !j) return;
      await save({ ...st, activeJourney: { journeyId: j.id, stepIndex, date: j.date } });
    },

    async recordActivity(result) {
      const s = getServices();
      const st = get().childState;
      if (!st) return null;
      const { state, effects } = s.orchestrator.processActivity(st, result, new Date(), premium());
      await save(state);
      const subject = { kind: 'child' as const, id: st.child.analyticsId ?? st.child.id };
      if (result.gameType !== 'story-beat') {
        s.analytics.track(result.abandoned ? 'activity_abandon' : 'activity_complete', subject, { gameType: result.gameType, family: result.family, correct: result.correct, total: result.total, stars: effects.stars, durationSec: Math.round(result.durationMs / 1000), difficulty: Math.round(st.progress.difficulty) });
      }
      for (const sp of result.speech ?? []) s.analytics.track('speech_attempt', subject, { accepted: sp.accepted, score: Math.round(sp.score), language: st.child.targetLanguage });
      if (effects.evolvedTo) s.analytics.track('mimo_evolved', subject, { stage: effects.evolvedTo });
      set({ lastEffects: effects });
      return effects;
    },

    async recordChoice(choiceKey, optionId) {
      const st = get().childState;
      if (!st) return;
      await save(getServices().orchestrator.recordChoice(st, choiceKey, optionId));
    },

    async completeJourney(learningMs) {
      const s = getServices();
      const st = get().childState;
      const j = get().journey;
      if (!st || !j) return null;
      const opening = s.content.track(trackIdOf(st.child)).arcIds[0];
      const before = s.story.unlockedWorlds(st.story, 0, opening).map((w) => w.id);
      const { state, effects } = s.orchestrator.completeJourney(st, j, new Date(), premium(), learningMs);
      await save(state);
      const after = s.story.unlockedWorlds(state.story, 0, opening).map((w) => w.id);
      const subject = { kind: 'child' as const, id: st.child.analyticsId ?? st.child.id };
      s.analytics.track('journey_complete', subject, { episodeId: j.episodeId, worldId: j.worldId, durationSec: Math.round(learningMs / 1000) });
      s.analytics.track('session_duration', subject, { durationSec: Math.round(learningMs / 1000), mode: 'journey' });
      for (const w of after.filter((x) => !before.includes(x))) s.analytics.track('world_unlock', subject, { worldId: w });
      for (const r of effects.rewardsGranted) s.analytics.track('reward_unlock', subject, { rewardKind: s.content.rewards.get(r)?.kind ?? 'sticker' });
      if (st.child.parentId) {
        void s.repo.addNotification({ childId: st.child.id, kind: 'milestone', title: `${st.child.nickname} finished “${j.title}”`, body: `${effects.rewardsGranted.length} new reward(s) collected.` }).catch(() => undefined);
      }
      set({ lastEffects: effects, journey: null });
      return effects;
    },

    async addFreePlay(ms) {
      const st = get().childState;
      if (!st || ms < 1000) return;
      await save(getServices().orchestrator.addFreePlay(st, ms, new Date()));
    },

    async saveCreation(c) {
      const s = getServices();
      const st = get().childState;
      if (!st) return null;
      const now = new Date().toISOString();
      const existing = c.id ? st.creations.find((x) => x.id === c.id) : undefined;
      const creation: Creation = { ...(existing ?? { id: newId(), childId: st.child.id, createdAt: now }), ...c, id: existing?.id ?? c.id ?? newId(), childId: st.child.id, createdAt: existing?.createdAt ?? now, updatedAt: now } as Creation;
      const creations = existing ? st.creations.map((x) => (x.id === creation.id ? creation : x)) : [...st.creations, creation];
      const { state: companion } = companionEngine.gainActivity(st.companion, 'create', new Date());
      await save({ ...st, creations, companion, updatedAt: now });
      s.analytics.track('creation_saved', { kind: 'child', id: st.child.analyticsId ?? st.child.id }, { mode: c.kind });
      return creation;
    },

    async updateBook(bookId, patch) {
      const st = get().childState;
      if (!st) return;
      const now = new Date().toISOString();
      const prev = st.books.find((b) => b.bookId === bookId) ?? { childId: st.child.id, bookId, language: st.child.targetLanguage, pagesRead: 0, completed: false, favorite: false, quizCorrect: 0, updatedAt: now };
      const next = { ...prev, ...patch, pagesRead: Math.max(prev.pagesRead, patch.pagesRead ?? 0), completed: prev.completed || !!patch.completed, updatedAt: now };
      const books = [...st.books.filter((b) => b.bookId !== bookId), next];
      if (next.completed && !prev.completed) getServices().analytics.track('book_complete', { kind: 'child', id: st.child.analyticsId ?? st.child.id }, { language: st.child.targetLanguage });
      await save({ ...st, books, updatedAt: now });
    },

    async careForMimo(action) {
      const st = get().childState;
      if (!st) return;
      await save({ ...st, companion: companionEngine.care(st.companion, action, new Date()), updatedAt: new Date().toISOString() });
    },

    async equipCosmetic(rewardId) {
      const st = get().childState;
      if (!st || !st.inventory.rewardIds.includes(rewardId)) return;
      const eq = st.companion.equippedCosmetics.includes(rewardId) ? st.companion.equippedCosmetics.filter((r) => r !== rewardId) : [...st.companion.equippedCosmetics, rewardId].slice(-2);
      await save({ ...st, companion: { ...st.companion, equippedCosmetics: eq }, updatedAt: new Date().toISOString() });
    },

    async renameMimo(name) {
      const st = get().childState;
      const clean = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 14);
      if (!st || !clean) return;
      await save({ ...st, companion: { ...st.companion, name: clean }, updatedAt: new Date().toISOString() });
    },

    async markRewardsSeen() {
      const st = get().childState;
      if (!st || !st.inventory.newRewardIds.length) return;
      await save({ ...st, inventory: { ...st.inventory, newRewardIds: [] } });
    },

    async visitWorld(worldId) {
      const st = get().childState;
      if (!st || st.visitedWorldIds.includes(worldId)) return;
      const { state: companion } = companionEngine.gainActivity(st.companion, 'explore', new Date());
      await save({ ...st, visitedWorldIds: [...st.visitedWorldIds, worldId], companion, updatedAt: new Date().toISOString() });
    },

    async changeTrack(childId, track) {
      const s = getServices();
      const child = get().children.find((c) => c.id === childId);
      if (!child) return;
      const now = new Date();
      const isActive = get().activeChildId === childId && get().childState;
      const current = isActive ? get().childState! : (s.sync ? await s.sync.load(child) : await s.repo.loadChildState(child)) ?? initialChildState(child, s.content, now);
      const next = s.orchestrator.changeTrack({ ...current, child }, track, now);
      const saved = await s.repo.updateChild(next.child);
      set({ children: get().children.map((c) => (c.id === saved.id ? saved : c)) });
      const state = { ...next, child: saved };
      if (isActive) { await save(state); set({ journey: null }); }
      else if (s.sync) await s.sync.save(state); else await s.repo.saveChildState(state);
      s.analytics.track('track_changed', { kind: 'child', id: saved.analyticsId ?? saved.id }, { fromTrack: trackIdOf(child), track });
    },

    async setPlan(plan, opts) {
      const s = getServices();
      let message: string | null = null;
      if (plan === 'free') {
        const r = await s.billing.manage();
        if (r.redirectUrl) { window.location.href = r.redirectUrl; return null; }
        message = r.message ?? null;
      } else {
        s.analytics.track('checkout_start', { kind: 'parent', id: get().parent?.id ?? 'anon' }, { plan, provider: s.billing.id, method: opts?.method ?? 'card', currency: opts?.currency ?? 'USD' });
        const r = await s.billing.checkout(plan, opts);
        if (r.redirectUrl) { window.location.href = r.redirectUrl; return null; }
        s.analytics.track('subscription_start', { kind: 'parent', id: get().parent?.id ?? 'anon' }, { plan });
      }
      await get().refreshFamily();
      return message;
    },

    isParentUnlocked() {
      try { return Number(sessionStorage.getItem(PARENT_UNLOCK_KEY) ?? 0) > Date.now(); } catch { return false; }
    },
    unlockParent(minutes = 15) {
      try { sessionStorage.setItem(PARENT_UNLOCK_KEY, String(Date.now() + minutes * 60_000)); } catch { /* ignore */ }
    },
    lockParent() {
      try { sessionStorage.removeItem(PARENT_UNLOCK_KEY); } catch { /* ignore */ }
    },
  };
});

export function errorMessage(e: unknown): string {
  if (e instanceof RepositoryError) {
    if (e.code === 'limit') return 'You have reached the number of child profiles for your plan.';
    return e.message;
  }
  return (e as Error)?.message ?? 'Something went wrong';
}
