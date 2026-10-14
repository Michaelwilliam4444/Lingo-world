import type { AgeBand, CefrLevel, StageNumber } from '@/types/core';
import type { CurriculumUnit } from '@/types/content';
import type { LanguageProgress, MasteryRecord } from '@/types/learner';
import type { ContentIndex } from '@/content';
import { learningBrain } from './LearningBrain';

/**
 * CurriculumEngine — the educational authority. It decides WHAT is learned and when a unit is done.
 * AI and personalisation only decide HOW objectives are presented; they cannot advance the curriculum.
 */

const NEW_ITEMS_PER_DAY: Record<AgeBand, number> = { little: 3, adventurer: 4, hero: 5 };
/** How many units beyond the current one may feed new words (the "learning frontier"). */
const FRONTIER_UNITS = 2;
/** If this many introduced items are still weak, slow the intake of new words. */
const BACKLOG_LIMIT: Record<AgeBand, number> = { little: 10, adventurer: 16, hero: 20 };

/**
 * Unit readiness per item: what the child can recognise, what they can produce, and what they keep.
 * Using the best receptive/productive channel means a pre-reader isn't blocked by reading scores.
 */
export function unitItemScore(m: MasteryRecord['mastery'], ageBand: AgeBand): number {
  const receptive = Math.max(m.listeningRecognition, m.imageRecognition, ageBand === 'little' ? 0 : m.reading);
  const productive = Math.max(m.speaking, m.sentenceUsage, ageBand === 'hero' ? m.writing : 0);
  return Math.round(0.45 * receptive + 0.3 * productive + 0.25 * m.retention);
}

export interface UnitProgress {
  unit: CurriculumUnit;
  averageCore: number;
  itemsSeen: number;
  itemsMastered: number;
  complete: boolean;
}

export class CurriculumEngine {
  constructor(private readonly content: ContentIndex) {}

  /** The track's own syllabus, in order. `track` is a track id (same ids as age bands). */
  orderedUnits(track: AgeBand): CurriculumUnit[] {
    const ids = this.content.track(track).unitIds;
    const units = ids.map((id) => this.content.units.get(id)).filter((u): u is CurriculumUnit => !!u);
    return units.length ? units : this.content.unitsInOrder();
  }

  /** Starting unit from the parent's estimate of the child's level. */
  initialProgress(childId: string, language: LanguageProgress['language'], ageBand: AgeBand, estimatedLevel: 'new' | 'some' | 'confident'): LanguageProgress {
    const units = this.orderedUnits(ageBand);
    const startStage: StageNumber = estimatedLevel === 'confident' ? 2 : 1;
    const startIdx = Math.max(0, units.findIndex((u) => u.stage === startStage));
    const start = units[startIdx] ?? units[0]!;
    return {
      childId, language, stage: start.stage, currentUnitId: start.id,
      completedUnitIds: units.slice(0, startIdx).map((u) => u.id),
      difficulty: ageBand === 'little' ? 1.2 : ageBand === 'adventurer' ? 1.8 : 2.2 + (estimatedLevel === 'some' ? 0.3 : 0),
      challengeTolerance: 0.5,
    };
  }

  unitProgress(unit: CurriculumUnit, mastery: Map<string, MasteryRecord>, ageBand: AgeBand): UnitProgress {
    let total = 0; let seen = 0; let mastered = 0;
    for (const id of unit.conceptIds) {
      const rec = mastery.get(id);
      if (!rec) continue;
      seen += rec.lastSeenAt ? 1 : 0;
      total += unitItemScore(rec.mastery, ageBand);
      if (learningBrain.isMastered(rec, ageBand)) mastered += 1;
    }
    const averageCore = unit.conceptIds.length ? Math.round(total / unit.conceptIds.length) : 100;
    const complete = seen === unit.conceptIds.length && averageCore >= unit.masteryThreshold;
    return { unit, averageCore, itemsSeen: seen, itemsMastered: mastered, complete };
  }

  /**
   * Advance through completed units (possibly several, e.g. after a strong week).
   * Returns the updated progress and the list of units completed now.
   */
  advance(progress: LanguageProgress, mastery: Map<string, MasteryRecord>, ageBand: AgeBand): { progress: LanguageProgress; completed: string[] } {
    const units = this.orderedUnits(ageBand);
    let current = progress;
    const completed: string[] = [];
    for (let guard = 0; guard < units.length; guard++) {
      const unit = this.content.units.get(current.currentUnitId);
      if (!unit) break;
      const up = this.unitProgress(unit, mastery, ageBand);
      if (!up.complete) break;
      const idx = units.findIndex((u) => u.id === unit.id);
      const next = units[idx + 1];
      completed.push(unit.id);
      current = {
        ...current,
        completedUnitIds: [...new Set([...current.completedUnitIds, unit.id])],
        currentUnitId: next?.id ?? unit.id,
        stage: next?.stage ?? unit.stage,
      };
      if (!next) break;
    }
    return { progress: current, completed };
  }

  /**
   * New items for today: unseen concepts of the current unit first, then the next unit's when the
   * current one has all been introduced. Phrases of the unit are introduced once its words are known.
   */
  newItemsForToday(progress: LanguageProgress, mastery: Map<string, MasteryRecord>, ageBand: AgeBand): { itemId: string; itemType: 'concept' | 'phrase' }[] {
    const backlog = [...mastery.values()].filter((m) => m.attempts > 0 && unitItemScore(m.mastery, ageBand) < 40).length;
    const perDay = this.content.track(ageBand).newItemsPerDay ?? NEW_ITEMS_PER_DAY[ageBand];
    const limit = backlog >= BACKLOG_LIMIT[ageBand] ? 1 : backlog >= BACKLOG_LIMIT[ageBand] * 0.7 ? Math.ceil(perDay / 2) : perDay;
    const units = this.orderedUnits(ageBand);
    const startIdx = Math.max(0, units.findIndex((u) => u.id === progress.currentUnitId));
    const out: { itemId: string; itemType: 'concept' | 'phrase' }[] = [];
    for (let i = startIdx; i < units.length && i <= startIdx + FRONTIER_UNITS && out.length < limit; i++) {
      const unit = units[i]!;
      for (const c of unit.conceptIds) {
        if (out.length >= limit) break;
        if (!mastery.get(c)?.lastSeenAt) out.push({ itemId: c, itemType: 'concept' });
      }
      // Phrases come once the unit's words have been met (not for pre-readers' first stage).
      const wordsKnown = unit.conceptIds.every((c) => mastery.get(c)?.lastSeenAt);
      if (wordsKnown && (ageBand !== 'little' || unit.stage > 1)) {
        for (const p of unit.phraseIds) {
          if (out.length >= limit) break;
          if (!mastery.get(p)?.lastSeenAt) out.push({ itemId: p, itemType: 'phrase' });
        }
      }
    }
    return out;
  }

  /** Concepts the child has been introduced to (for distractors, explore mode, create mode). */
  knownConcepts(mastery: Map<string, MasteryRecord>): string[] {
    return [...mastery.values()].filter((m) => m.itemType === 'concept' && m.lastSeenAt).map((m) => m.itemId);
  }

  cefrForStage(stage: StageNumber): CefrLevel {
    return stage <= 2 ? 'preA1' : stage <= 4 ? 'A1' : 'A2';
  }

  stageCounts(mastery: Map<string, MasteryRecord>, ageBand: AgeBand): { exposed: number; practiced: number; mastered: number } {
    let exposed = 0; let practiced = 0; let mastered = 0;
    for (const rec of mastery.values()) {
      if (rec.itemType !== 'concept') continue;
      if (rec.lastSeenAt) exposed++;
      if (rec.attempts > 0) practiced++;
      if (learningBrain.isMastered(rec, ageBand)) mastered++;
    }
    return { exposed, practiced, mastered };
  }
}
