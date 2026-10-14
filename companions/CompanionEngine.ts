import type { CompanionPath, CompanionStage } from '@/types/core';
import type { CompanionState, LearningEvidence } from '@/types/learner';
import { clamp, daysBetween } from '@/lib/time';

/**
 * CompanionEngine — Mimo's growth is earned only through language learning.
 * There is no way to buy XP, evolution or learning power. Premium affects cosmetics only.
 *
 * Mimo never gets sick, sad-forever or "dies"; happiness drifts gently and is always restorable
 * by a single interaction, so there is no guilt or loss-framing.
 */

export const STAGE_THRESHOLDS: { stage: CompanionStage; xp: number }[] = [
  { stage: 'egg', xp: 0 },
  { stage: 'baby', xp: 20 },          // hatches during the first journey
  { stage: 'young', xp: 400 },
  { stage: 'advanced', xp: 1500 },
  { stage: 'specialized', xp: 3500 },
  { stage: 'legendary', xp: 8000 },   // cosmetic form only
];

const XP_BY_EVIDENCE: Partial<Record<LearningEvidence['kind'], number>> = {
  'listening-recognition': 3, 'image-recognition': 2, speaking: 5, pronunciation: 4, reading: 4,
  spelling: 4, writing: 6, 'sentence-usage': 6,
};

export const MIMO_FORMS: Record<CompanionStage, Partial<Record<CompanionPath, string>> & { default: string }> = {
  egg: { default: '🥚' },
  baby: { default: '🐣' },
  young: { default: '🐥' },
  advanced: { default: '🦜', voice: '🦜', wisdom: '🦉', explorer: '🦅', creator: '🦚' },
  specialized: { default: '🐲', voice: '🐉', wisdom: '🦉', explorer: '🦅', creator: '🦄' },
  legendary: { default: '🌟', voice: '🐉', wisdom: '🦉', explorer: '🦅', creator: '🦄' },
};

export function newCompanion(childId: string, eggColor: string, name = 'Mimo'): CompanionState {
  return {
    childId, name, eggColor, stage: 'egg', path: 'balanced', xp: 0,
    affinity: { speaking: 0, reading: 0, exploring: 0, creating: 0 },
    happiness: 80, equippedCosmetics: [], learnedCommands: [], lastFedAt: null, hatchedAt: null,
  };
}

export class CompanionEngine {
  stageFor(xp: number): CompanionStage {
    let stage: CompanionStage = 'egg';
    for (const t of STAGE_THRESHOLDS) if (xp >= t.xp) stage = t.stage;
    return stage;
  }

  nextThreshold(xp: number): { stage: CompanionStage; xp: number } | null {
    return STAGE_THRESHOLDS.find((t) => t.xp > xp) ?? null;
  }

  /** Progress towards the next stage, 0..1, for the growth ring around Mimo. */
  growthProgress(xp: number): number {
    const current = [...STAGE_THRESHOLDS].reverse().find((t) => xp >= t.xp)!;
    const next = this.nextThreshold(xp);
    if (!next) return 1;
    return clamp((xp - current.xp) / (next.xp - current.xp), 0, 1);
  }

  /** Path is decided by what the child does most — speaking, reading, exploring or creating. */
  pathFor(affinity: CompanionState['affinity']): CompanionPath {
    const entries = Object.entries(affinity) as [keyof CompanionState['affinity'], number][];
    const total = entries.reduce((s, [, v]) => s + v, 0);
    if (total < 30) return 'balanced';
    const [top, value] = entries.sort((a, b) => b[1] - a[1])[0]!;
    if (value / total < 0.34) return 'balanced';
    return ({ speaking: 'voice', reading: 'wisdom', exploring: 'explorer', creating: 'creator' } as const)[top];
  }

  gainFromEvidence(state: CompanionState, evidence: LearningEvidence[], now: Date): { state: CompanionState; evolvedTo: CompanionStage | null } {
    let xp = state.xp;
    const affinity = { ...state.affinity };
    for (const ev of evidence) {
      const base = XP_BY_EVIDENCE[ev.kind] ?? 0;
      xp += ev.correct ? base : Math.ceil(base / 2); // trying counts too
      if (ev.kind === 'speaking' || ev.kind === 'pronunciation') affinity.speaking += 1;
      if (ev.kind === 'reading' || ev.kind === 'writing' || ev.kind === 'spelling') affinity.reading += 1;
    }
    return this.withXp(state, xp, affinity, now);
  }

  /** Non-evidence growth sources (exploring a world, finishing a creation). */
  gainActivity(state: CompanionState, kind: 'explore' | 'create' | 'journey', now: Date): { state: CompanionState; evolvedTo: CompanionStage | null } {
    const affinity = { ...state.affinity };
    let xp = state.xp;
    if (kind === 'explore') { affinity.exploring += 3; xp += 6; }
    if (kind === 'create') { affinity.creating += 3; xp += 8; }
    if (kind === 'journey') xp += 25;
    return this.withXp(state, xp, affinity, now);
  }

  private withXp(state: CompanionState, xp: number, affinity: CompanionState['affinity'], now: Date) {
    const stage = this.stageFor(xp);
    const evolvedTo = stage !== state.stage ? stage : null;
    // Path is fixed once Mimo becomes "specialized" so the form doesn't flicker.
    const path = STAGE_THRESHOLDS.findIndex((t) => t.stage === stage) >= 4 && state.path !== 'balanced' ? state.path : this.pathFor(affinity);
    return {
      state: {
        ...state, xp, affinity, stage, path,
        hatchedAt: state.hatchedAt ?? (stage !== 'egg' ? now.toISOString() : null),
        happiness: clamp(state.happiness + 5, 0, 100),
      },
      evolvedTo,
    };
  }

  /** Gentle drift: happiness relaxes towards 60 when away — never below 40, never "sad" messaging. */
  decay(state: CompanionState, now: Date): CompanionState {
    const since = state.lastFedAt ? daysBetween(state.lastFedAt, now) : 0;
    const happiness = since > 1 ? Math.max(40, state.happiness - Math.floor(since) * 5) : state.happiness;
    return { ...state, happiness };
  }

  care(state: CompanionState, action: 'feed' | 'play' | 'sleep' | 'pet', now: Date): CompanionState {
    const boost = { feed: 15, play: 12, sleep: 8, pet: 6 }[action];
    return { ...state, happiness: clamp(state.happiness + boost, 0, 100), lastFedAt: action === 'feed' ? now.toISOString() : state.lastFedAt };
  }

  /** Mimo learns a command once the child has *said* the action word successfully. */
  learnCommand(state: CompanionState, conceptId: string): CompanionState {
    if (state.learnedCommands.includes(conceptId)) return state;
    return { ...state, learnedCommands: [...state.learnedCommands, conceptId] };
  }

  form(state: CompanionState): string {
    const forms = MIMO_FORMS[state.stage];
    return forms[state.path] ?? forms.default;
  }

  mood(state: CompanionState): 'sleepy' | 'calm' | 'happy' | 'ecstatic' {
    if (state.happiness >= 90) return 'ecstatic';
    if (state.happiness >= 65) return 'happy';
    if (state.happiness >= 45) return 'calm';
    return 'sleepy';
  }
}

export const companionEngine = new CompanionEngine();
