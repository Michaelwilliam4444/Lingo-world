import { MASTERY_DIMENSIONS, type LearningLanguage, type MasteryDimension, type MasteryVector } from '@/types/core';
import type { LearningEvidence, MasteryRecord } from '@/types/learner';
import type { MasterySummary } from '@/types/engine';
import { clamp, daysBetween } from '@/lib/time';

/**
 * LearningBrain — multi-dimensional mastery model.
 *
 * Every activity emits LearningEvidence. The brain maps each evidence kind onto one or more mastery
 * dimensions and moves them toward a target with an adaptive learning rate (fast for new items,
 * slower once established, so one lucky tap can't "master" a word and one slip can't erase it).
 * Retention is only raised by successful recall after a gap — that is what makes it "retention".
 *
 * All values 0..100. Children never see these numbers; parents see summaries.
 */

const EVIDENCE_DIMENSIONS: Record<LearningEvidence['kind'], MasteryDimension[]> = {
  'exposure-see': ['seen'],
  'exposure-hear': ['heard'],
  'image-recognition': ['imageRecognition'],
  'listening-recognition': ['listeningRecognition'],
  speaking: ['speaking'],
  pronunciation: ['pronunciation'],
  reading: ['reading'],
  spelling: ['spelling'],
  writing: ['writing', 'spelling'],
  'sentence-usage': ['sentenceUsage'],
};

/** Weights of each dimension in the overall score. Exposure counts little; production counts most. */
export const DIMENSION_WEIGHTS: Record<MasteryDimension, number> = {
  seen: 0.03, heard: 0.04, imageRecognition: 0.1, listeningRecognition: 0.16, speaking: 0.14, pronunciation: 0.1,
  reading: 0.08, spelling: 0.04, writing: 0.04, sentenceUsage: 0.1, retention: 0.14, confidence: 0.03,
};

/** Dimensions considered for "mastered" depend on what the learner's age band is expected to do. */
export const CORE_DIMENSIONS_BY_AGE: Record<'little' | 'adventurer' | 'hero', MasteryDimension[]> = {
  little: ['listeningRecognition', 'imageRecognition', 'speaking', 'retention'],
  adventurer: ['listeningRecognition', 'imageRecognition', 'speaking', 'reading', 'retention'],
  hero: ['listeningRecognition', 'speaking', 'reading', 'sentenceUsage', 'writing', 'retention'],
};

export function emptyMastery(): MasteryVector {
  return Object.fromEntries(MASTERY_DIMENSIONS.map((d) => [d, 0])) as MasteryVector;
}

export function newMasteryRecord(childId: string, language: LearningLanguage, itemId: string, itemType: 'concept' | 'phrase', now: Date): MasteryRecord {
  return {
    childId, language, itemId, itemType, mastery: emptyMastery(), attempts: 0, correct: 0,
    consecutiveCorrect: 0, consecutiveWrong: 0, lastSeenAt: null, firstSeenAt: null, updatedAt: now.toISOString(),
  };
}

export class LearningBrain {
  /** Apply one piece of evidence; returns a new record (pure). */
  apply(record: MasteryRecord, ev: LearningEvidence): MasteryRecord {
    const m: MasteryVector = { ...record.mastery };
    const at = new Date(ev.at);
    const isExposure = ev.kind === 'exposure-see' || ev.kind === 'exposure-hear';
    const graded = !isExposure;

    if (isExposure) {
      for (const d of EVIDENCE_DIMENSIONS[ev.kind]) m[d] = clamp(m[d] + 35, 0, 100);
    } else {
      const attempts = record.attempts;
      // Learning rate: 0.5 for brand-new items, decaying towards 0.2 as evidence accumulates.
      const rate = clamp(0.5 - attempts * 0.03, 0.2, 0.5);
      const hintPenalty = clamp(ev.hintsUsed * 0.15, 0, 0.45);
      let target: number;
      if (typeof ev.score === 'number') target = clamp(ev.score, 0, 100) * (1 - hintPenalty);
      else target = ev.correct ? 100 * (1 - hintPenalty) : 0;
      // Wrong answers pull down less hard than correct answers push up (children guess; we stay gentle).
      const effectiveRate = ev.correct ? rate : rate * 0.6;
      for (const d of EVIDENCE_DIMENSIONS[ev.kind]) m[d] = clamp(m[d] + effectiveRate * (target - m[d]), 0, 100);
      // Receptive success implies exposure.
      m.seen = Math.max(m.seen, 60);
      m.heard = ev.kind === 'reading' || ev.kind === 'spelling' || ev.kind === 'writing' ? m.heard : Math.max(m.heard, 60);
    }

    // Retention: successful recall after a gap of ≥ 20h is strong evidence; failure after a gap lowers it.
    if (graded && record.lastSeenAt) {
      const gapDays = daysBetween(record.lastSeenAt, at);
      if (gapDays >= 0.8) {
        const gain = clamp(15 + gapDays * 6, 15, 45);
        m.retention = ev.correct ? clamp(m.retention + gain, 0, 100) : clamp(m.retention - 20, 0, 100);
      } else if (ev.correct && m.retention < 30) {
        m.retention = clamp(m.retention + 5, 0, 30); // same-session success: small, capped credit
      }
    }

    const consecutiveCorrect = graded ? (ev.correct ? record.consecutiveCorrect + 1 : 0) : record.consecutiveCorrect;
    const consecutiveWrong = graded ? (ev.correct ? 0 : record.consecutiveWrong + 1) : record.consecutiveWrong;

    // Confidence: streaks and quick, unaided answers.
    if (graded) {
      const fast = typeof ev.responseMs === 'number' && ev.responseMs < 3500;
      const delta = ev.correct ? (fast && ev.hintsUsed === 0 ? 12 : 6) : -10;
      m.confidence = clamp(m.confidence + delta + Math.min(consecutiveCorrect, 5), 0, 100);
    }

    return {
      ...record,
      mastery: m,
      attempts: graded ? record.attempts + 1 : record.attempts,
      correct: graded && ev.correct ? record.correct + 1 : record.correct,
      consecutiveCorrect,
      consecutiveWrong,
      lastSeenAt: ev.at,
      firstSeenAt: record.firstSeenAt ?? ev.at,
      updatedAt: ev.at,
    };
  }

  applyAll(record: MasteryRecord, evidence: LearningEvidence[]): MasteryRecord {
    return [...evidence].sort((a, b) => a.at.localeCompare(b.at)).reduce((r, ev) => this.apply(r, ev), record);
  }

  overall(m: MasteryVector): number {
    let s = 0;
    for (const d of MASTERY_DIMENSIONS) s += m[d] * DIMENSION_WEIGHTS[d];
    return Math.round(s);
  }

  /** Average over the dimensions that matter for this age band. */
  coreScore(m: MasteryVector, ageBand: keyof typeof CORE_DIMENSIONS_BY_AGE): number {
    const dims = CORE_DIMENSIONS_BY_AGE[ageBand];
    return Math.round(dims.reduce((s, d) => s + m[d], 0) / dims.length);
  }

  summarize(record: MasteryRecord, ageBand: keyof typeof CORE_DIMENSIONS_BY_AGE): MasterySummary {
    const core = this.coreScore(record.mastery, ageBand);
    const dims = CORE_DIMENSIONS_BY_AGE[ageBand];
    const weakest = [...dims].sort((a, b) => record.mastery[a] - record.mastery[b]).slice(0, 2);
    let status: MasterySummary['status'];
    if (record.attempts === 0) status = record.lastSeenAt ? 'learning' : 'new';
    else if (record.consecutiveWrong >= 3 || (record.attempts >= 4 && record.correct / record.attempts < 0.4)) status = 'struggling';
    else if (core >= 75 && record.mastery.retention >= 60) status = 'mastered';
    else if (core >= 45) status = 'practiced';
    else status = 'learning';
    return { itemId: record.itemId, overall: this.overall(record.mastery), weakest, status };
  }

  isMastered(record: MasteryRecord, ageBand: keyof typeof CORE_DIMENSIONS_BY_AGE): boolean {
    return this.summarize(record, ageBand).status === 'mastered';
  }
}

export const learningBrain = new LearningBrain();
