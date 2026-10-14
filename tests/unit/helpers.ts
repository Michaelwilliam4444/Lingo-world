import type { ChildProfile } from '@/types/learner';
import type { AgeBand, LearningLanguage } from '@/types/core';

export function makeChild(overrides: Partial<ChildProfile> = {}): ChildProfile {
  const ageBand: AgeBand = overrides.ageBand ?? 'adventurer';
  return {
    id: 'child-1', parentId: 'parent-1', nickname: 'Maria', age: 7, ageBand,
    nativeLanguage: 'ar', interfaceLocale: 'en', targetLanguage: 'en' as LearningLanguage,
    estimatedLevel: 'new', learningGoal: 'fun', interests: ['animals', 'space'], accessibilityNeeds: [],
    avatar: { skin: 's3', hair: 'curly', hairColor: 'brown', face: 'smile', outfit: 'explorer', shoes: 'sneakers', accessory: 'none', background: 'sky', color: 'sunrise' },
    settings: { dailyTargetMinutes: 15, audioEnabled: true, musicVolume: 0.5, voiceEnabled: true, reducedMotion: false, highContrast: false, largeText: false, dyslexiaFont: false, captions: true, screenTimeLimitMinutes: null, streaksEnabled: true },
    onboarded: true, createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
