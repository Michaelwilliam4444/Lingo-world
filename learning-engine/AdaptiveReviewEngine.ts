import type { LearningLanguage } from '@/types/core';
import type { LearningEvidence, MasteryRecord, ReviewState } from '@/types/learner';
import { addDays, clamp, daysBetween } from '@/lib/time';

/**
 * AdaptiveReviewEngine — spaced repetition tuned for young children.
 *
 * Based on SM-2 with child-specific changes:
 *  - short first intervals (same day → 1 → 2 → 4 days) because young learners forget fast;
 *  - interval capped at 45 days so mastered words keep resurfacing inside stories;
 *  - pronunciation and hint usage feed the quality score, not just right/wrong;
 *  - repeated failures shrink the interval *and* flag the item for scaffolding rather than drilling;
 *  - reviews are never shown as flashcards — the journey engine weaves due items into story sentences.
 */

export interface ReviewCandidate {
  itemId: string;
  itemType: 'concept' | 'phrase';
  priority: number;     // higher = more urgent
  overdueDays: number;
  reason: 'due' | 'overdue' | 'struggling' | 'fragile';
}

const FIRST_INTERVALS = [0.25, 1, 2, 4];
const MAX_INTERVAL_DAYS = 45;

export function newReviewState(childId: string, language: LearningLanguage, itemId: string, itemType: 'concept' | 'phrase', now: Date): ReviewState {
  return { childId, language, itemId, itemType, ease: 2.3, intervalDays: 0, repetitions: 0, lapses: 0, dueAt: now.toISOString(), lastReviewedAt: null };
}

/** Map a batch of evidence for one item in one session to an SM-2 quality 0..5. */
export function qualityFromEvidence(evidence: LearningEvidence[]): number {
  const graded = evidence.filter((e) => !e.kind.startsWith('exposure'));
  if (!graded.length) return 3; // exposure only: neutral
  const correctRatio = graded.filter((e) => e.correct).length / graded.length;
  const hints = graded.reduce((s, e) => s + e.hintsUsed, 0) / graded.length;
  const scored = graded.filter((e) => typeof e.score === 'number');
  const avgScore = scored.length ? scored.reduce((s, e) => s + (e.score ?? 0), 0) / scored.length : null;
  let q = correctRatio * 5;
  q -= hints * 0.7;
  if (avgScore !== null) q = q * 0.7 + (avgScore / 100) * 5 * 0.3;
  return clamp(Math.round(q * 10) / 10, 0, 5);
}

export class AdaptiveReviewEngine {
  /** Update one item's schedule after a session. Pure. */
  schedule(state: ReviewState, quality: number, now: Date): ReviewState {
    const q = clamp(quality, 0, 5);
    let { ease, intervalDays, repetitions, lapses } = state;

    if (q < 2.5) {
      // Lapse: come back soon, gently.
      repetitions = 0;
      lapses += 1;
      intervalDays = 0.25;
      ease = clamp(ease - 0.2, 1.3, 2.8);
    } else {
      repetitions += 1;
      if (repetitions <= FIRST_INTERVALS.length) intervalDays = FIRST_INTERVALS[repetitions - 1]!;
      else intervalDays = Math.min(MAX_INTERVAL_DAYS, intervalDays * ease);
      ease = clamp(ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), 1.3, 2.8);
    }

    return {
      ...state, ease, repetitions, lapses,
      intervalDays: Math.round(intervalDays * 100) / 100,
      dueAt: addDays(now, intervalDays).toISOString(),
      lastReviewedAt: now.toISOString(),
    };
  }

  /**
   * Rank items that should reappear today. Struggling items are surfaced even if not formally due,
   * but at most a few per session so the child is never stuck on what they find hardest.
   */
  candidates(states: ReviewState[], mastery: Map<string, MasteryRecord>, now: Date, limit = 8): ReviewCandidate[] {
    const out: ReviewCandidate[] = [];
    for (const s of states) {
      const overdueDays = daysBetween(s.dueAt, now);
      const rec = mastery.get(s.itemId);
      const struggling = !!rec && (rec.consecutiveWrong >= 2 || (rec.attempts >= 3 && rec.correct / rec.attempts < 0.5));
      const fragile = !!rec && rec.mastery.retention < 40 && rec.attempts >= 2;
      if (overdueDays < 0 && !struggling) continue;
      const reason: ReviewCandidate['reason'] = struggling ? 'struggling' : overdueDays > Math.max(1, s.intervalDays) ? 'overdue' : fragile ? 'fragile' : 'due';
      const weakness = rec ? (100 - (rec.mastery.listeningRecognition + rec.mastery.speaking + rec.mastery.retention) / 3) / 100 : 0.5;
      const priority = (reason === 'struggling' ? 2 : 0) + clamp(overdueDays / Math.max(s.intervalDays, 0.5), 0, 3) + weakness + s.lapses * 0.2;
      out.push({ itemId: s.itemId, itemType: s.itemType, priority: Math.round(priority * 100) / 100, overdueDays: Math.round(overdueDays * 10) / 10, reason });
    }
    out.sort((a, b) => b.priority - a.priority);
    // Cap struggling items to 2 per session to avoid frustration.
    const capped: ReviewCandidate[] = [];
    let struggling = 0;
    for (const c of out) {
      if (c.reason === 'struggling') {
        if (struggling >= 2) continue;
        struggling++;
      }
      capped.push(c);
      if (capped.length >= limit) break;
    }
    return capped;
  }

  /** Number of items due within the next N days — used in parent forecasts. */
  forecast(states: ReviewState[], now: Date, days = 7): number[] {
    const buckets = new Array(days).fill(0) as number[];
    for (const s of states) {
      const d = Math.floor(daysBetween(now, s.dueAt));
      if (d >= 0 && d < days) buckets[d]! += 1;
      else if (d < 0) buckets[0]! += 1;
    }
    return buckets;
  }
}

export const adaptiveReviewEngine = new AdaptiveReviewEngine();
