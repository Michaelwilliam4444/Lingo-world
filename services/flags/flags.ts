import { hashString } from '@/lib/random';
import type { AppEnv } from '@/lib/config';

export interface FeatureFlag { key: string; description: string; enabled: boolean; rolloutPercent: number; environments: AppEnv[] }
export interface Experiment { key: string; description: string; surface: 'ui' | 'journey-ordering' | 'game-preference' | 'reward-presentation'; active: boolean; variants: { id: string; weight: number }[] }

export const DEFAULT_FLAGS: FeatureFlag[] = [
  { key: 'newMiniGame', description: 'Show experimental mini-games in Play mode', enabled: false, rolloutPercent: 0, environments: ['development'] },
  { key: 'newStoryEngine', description: 'Alternative story pacing', enabled: false, rolloutPercent: 0, environments: ['development'] },
  { key: 'AIStoryVariation', description: 'LingoAI picks narrative variations (curriculum unchanged)', enabled: false, rolloutPercent: 0, environments: ['development', 'staging'] },
  { key: 'advancedPronunciation', description: 'Server-side phoneme scoring provider', enabled: false, rolloutPercent: 0, environments: ['development'] },
  { key: 'creationMode', description: 'Create mode', enabled: true, rolloutPercent: 100, environments: ['development', 'staging', 'production'] },
  { key: 'experimentalWorld', description: 'Unreleased world preview', enabled: false, rolloutPercent: 0, environments: ['development'] },
];

/** Deterministic: a subject always lands in the same rollout bucket for a flag. */
export function isFlagOn(flag: FeatureFlag | undefined, env: AppEnv, subjectId: string): boolean {
  if (!flag || !flag.enabled || !flag.environments.includes(env)) return false;
  if (flag.rolloutPercent >= 100) return true;
  return hashString(`${flag.key}:${subjectId}`) % 100 < flag.rolloutPercent;
}

/**
 * Safe A/B assignment. Allowed surfaces are limited to presentation (UI, ordering, game preference,
 * reward animation). Experiments may never touch pricing prompts to children, time pressure, or streak pressure.
 */
export function assignVariant(exp: Experiment, subjectId: string): string | null {
  if (!exp.active || !exp.variants.length) return null;
  const total = exp.variants.reduce((s, v) => s + v.weight, 0);
  let r = hashString(`${exp.key}:${subjectId}`) % Math.max(1, total);
  for (const v of exp.variants) { r -= v.weight; if (r < 0) return v.id; }
  return exp.variants.at(-1)!.id;
}
