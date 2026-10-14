import type { AgeBand } from '@/types/core';
import type { ActivityRecord } from '@/types/learner';
import type { DifficultyConfig } from '@/types/engine';
import { clamp } from '@/lib/time';

/**
 * DifficultyEngine — keeps each child in the "desirable difficulty" zone (~70–85% success).
 *
 * Difficulty is a continuous value 1.0..5.0 per child per language. After each activity it moves
 * towards harder or easier based on success, hint use and abandonment. The configuration it emits
 * changes *how* the same learning objective is presented: fewer/more options, similar-sounding
 * distractors, slow audio, picture support, first-sound hints, sentence complexity.
 */

const TARGET_LOW = 0.7;
const TARGET_HIGH = 0.88;

const AGE_CAP: Record<AgeBand, number> = { little: 3.2, adventurer: 4.4, hero: 5 };
const AGE_FLOOR: Record<AgeBand, number> = { little: 1, adventurer: 1.4, hero: 1.8 };

export class DifficultyEngine {
  /** Update continuous difficulty after an activity. */
  update(current: number, activity: Pick<ActivityRecord, 'correct' | 'total' | 'abandoned'>, ageBand: AgeBand, hintsUsed = 0): number {
    if (activity.abandoned) return clamp(current - 0.35, AGE_FLOOR[ageBand], AGE_CAP[ageBand]);
    if (activity.total === 0) return current;
    const ratio = activity.correct / activity.total;
    let delta = 0;
    if (ratio > TARGET_HIGH && hintsUsed === 0) delta = 0.25 + (ratio - TARGET_HIGH) * 1.5;
    else if (ratio > TARGET_HIGH) delta = 0.1;
    else if (ratio < TARGET_LOW) delta = -(0.2 + (TARGET_LOW - ratio) * 1.2);
    return Math.round(clamp(current + delta, AGE_FLOOR[ageBand], AGE_CAP[ageBand]) * 100) / 100;
  }

  /** Recent success rate across activities (for challenge tolerance & parent insights). */
  successRate(history: ActivityRecord[], lastN = 10): number | null {
    const recent = history.filter((h) => h.total > 0).slice(-lastN);
    if (!recent.length) return null;
    const c = recent.reduce((s, h) => s + h.correct, 0);
    const t = recent.reduce((s, h) => s + h.total, 0);
    return c / t;
  }

  /**
   * Challenge tolerance 0..1: how well the child keeps going after mistakes.
   * High tolerance → engine may push harder; low → more scaffolding, shorter games.
   */
  challengeTolerance(history: ActivityRecord[]): number {
    const recent = history.slice(-20);
    if (recent.length < 3) return 0.5;
    const hardOnes = recent.filter((h) => h.total > 0 && h.correct / h.total < 0.7);
    if (!hardOnes.length) return 0.7;
    const completedHard = hardOnes.filter((h) => !h.abandoned).length;
    return Math.round((completedHard / hardOnes.length) * 100) / 100;
  }

  /** Build the presentation config for one activity. `itemsByDifficulty` comes from the game definition. */
  configure(difficulty: number, ageBand: AgeBand, itemsByDifficulty: [number, number, number, number, number], opts: { struggling?: boolean } = {}): DifficultyConfig {
    const d = clamp(opts.struggling ? difficulty - 0.8 : difficulty, 1, 5);
    const level = Math.round(d);
    const optionsByAge: Record<AgeBand, [number, number]> = { little: [2, 3], adventurer: [3, 4], hero: [3, 5] };
    const [minOpt, maxOpt] = optionsByAge[ageBand];
    const optionCount = Math.round(minOpt + ((d - 1) / 4) * (maxOpt - minOpt));
    const complexity = ageBand === 'little' ? (d >= 2.5 ? 1 : 0) : ageBand === 'adventurer' ? (d >= 3.5 ? 3 : d >= 2.5 ? 2 : 1) : (d >= 3 ? 3 : 2);
    return {
      level,
      optionCount,
      hardDistractors: d >= 3,
      audioRate: d < 2 ? 0.8 : d < 3.5 ? 0.9 : 1,
      showImageWithAudio: d < 3.5 || ageBand === 'little',
      offerFirstSound: d < 3,
      hintsAvailable: d < 2 ? 3 : d < 4 ? 2 : 1,
      sentenceComplexity: complexity as DifficultyConfig['sentenceComplexity'],
      timePressure: d >= 4 && ageBand !== 'little',
      itemCount: itemsByDifficulty[clamp(level, 1, 5) - 1]! - (ageBand === 'little' ? 1 : 0),
    };
  }
}

export const difficultyEngine = new DifficultyEngine();
