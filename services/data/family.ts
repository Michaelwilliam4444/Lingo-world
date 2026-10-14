import type { AgeBand, PlanId } from '@/types/core';
import type { AvatarConfig, ChildProfile, ChildSettings, Subscription } from '@/types/learner';
import type { NewChildInput } from './DataRepository';

export function ageBandFor(age: number): AgeBand {
  if (age <= 5) return 'little';
  if (age <= 8) return 'adventurer';
  return 'hero';
}

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: 'tone3', hair: 'short', hairColor: 'brown', face: 'smile', outfit: 'explorer', shoes: 'sneakers', accessory: 'none', background: 'meadow', color: 'sunrise',
};

export function defaultSettings(input: Pick<NewChildInput, 'dailyTargetMinutes' | 'accessibilityNeeds'>): ChildSettings {
  const needs = new Set(input.accessibilityNeeds);
  return {
    dailyTargetMinutes: input.dailyTargetMinutes,
    audioEnabled: true, musicVolume: 0.5, voiceEnabled: true,
    reducedMotion: needs.has('reduced-motion'), highContrast: needs.has('high-contrast'), largeText: needs.has('large-text'),
    dyslexiaFont: needs.has('dyslexia'), captions: true, screenTimeLimitMinutes: null, streaksEnabled: true,
  };
}

export function buildChild(id: string, parentId: string, input: NewChildInput, now: Date): ChildProfile {
  return {
    id, parentId,
    nickname: input.nickname.trim().slice(0, 24),
    age: input.age,
    ageBand: ageBandFor(input.age),
    nativeLanguage: input.nativeLanguage,
    interfaceLocale: input.interfaceLocale,
    targetLanguage: input.targetLanguage,
    estimatedLevel: input.estimatedLevel,
    learningGoal: input.learningGoal,
    interests: input.interests,
    accessibilityNeeds: input.accessibilityNeeds,
    avatar: DEFAULT_AVATAR,
    settings: defaultSettings(input),
    onboarded: false,
    createdAt: now.toISOString(),
    analyticsId: crypto.randomUUID(),
    ...(input.trackId && input.trackId !== ageBandFor(input.age) ? { trackId: input.trackId } : {}),
  };
}

/** Mirrors enforce_child_limit() in the database. */
export function maxChildren(sub: Pick<Subscription, 'plan' | 'status'>): number {
  const active = sub.status === 'active' || sub.status === 'trialing';
  if (active && sub.plan === 'family') return 6;
  if (active && (sub.plan === 'premium_monthly' || sub.plan === 'premium_annual')) return 3;
  return 2;
}

export function freeSubscription(parentId: string): Subscription {
  return { parentId, plan: 'free' as PlanId, status: 'none', provider: 'mock', currentPeriodEnd: null, seats: 1 };
}
