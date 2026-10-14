import { ACTIVITY_FAMILIES, type ActivityFamily, type GameType } from '@/types/core';
import type { GameDefinition } from '@/types/content';
import type { ActivityRecord } from '@/types/learner';
import { daysBetween } from '@/lib/time';

/**
 * AntiBoredomEngine — scores candidate activities for novelty and balance.
 *
 * Rules implemented:
 *  - never the same game twice in a row; strong penalty for repeats in the last ~2 sessions;
 *  - family rotation (listening, speaking, movement, puzzle, matching, story, creation, memory, music, roleplay);
 *  - boost least-used families over the last week;
 *  - favourites get a small bonus (fun matters) but never dominate;
 *  - if the child aces a game type repeatedly, it is "graduated": deprioritised in favour of a harder variant;
 *  - avoid replaying yesterday's exact activity sequence;
 *  - worlds/themes visited recently are deprioritised for the daily setting.
 */

export interface BoredomContext {
  history: ActivityRecord[];      // chronological
  now: Date;
  favoriteTypes?: GameType[];
  plannedToday?: GameType[];      // already chosen earlier in today's journey
}

export interface ScoredGame {
  type: GameType;
  family: ActivityFamily;
  score: number;
  notes: string[];
}

export class AntiBoredomEngine {
  familyUsage(history: ActivityRecord[], now: Date, days = 7): Record<ActivityFamily, number> {
    const usage = Object.fromEntries(ACTIVITY_FAMILIES.map((f) => [f, 0])) as Record<ActivityFamily, number>;
    for (const h of history) if (daysBetween(h.at, now) <= days) usage[h.family] += 1;
    return usage;
  }

  /** Types the child has completed with ≥95% three times in a row recently: time to vary. */
  graduatedTypes(history: ActivityRecord[]): Set<string> {
    const byType = new Map<string, ActivityRecord[]>();
    for (const h of history) byType.set(h.gameType, [...(byType.get(h.gameType) ?? []), h]);
    const out = new Set<string>();
    for (const [type, list] of byType) {
      const last = list.slice(-3);
      if (last.length === 3 && last.every((h) => h.total > 0 && h.correct / h.total >= 0.95)) out.add(type);
    }
    return out;
  }

  score(candidates: GameDefinition[], ctx: BoredomContext): ScoredGame[] {
    const { history, now } = ctx;
    const planned = ctx.plannedToday ?? [];
    const last = history.at(-1);
    const recentTypes = history.slice(-8).map((h) => h.gameType);
    const usage = this.familyUsage(history, now);
    const maxUse = Math.max(1, ...Object.values(usage));
    const graduated = this.graduatedTypes(history);
    const plannedFamilies = new Set(planned.map((t) => candidates.find((c) => c.type === t)?.family));

    return candidates
      .map((g) => {
        const notes: string[] = [];
        let score = 1;
        if (planned.includes(g.type)) { score -= 5; notes.push('already in today’s journey'); }
        if (last?.gameType === g.type) { score -= 3; notes.push('just played'); }
        const recentCount = recentTypes.filter((t) => t === g.type).length;
        if (recentCount) { score -= recentCount * 0.6; notes.push(`played ${recentCount}× recently`); }
        if (plannedFamilies.has(g.family)) { score -= 0.8; notes.push('same family as another step today'); }
        const freshness = 1 - usage[g.family] / maxUse;
        score += freshness * 1.2;
        if (freshness > 0.7) notes.push('rarely-used activity family');
        if (ctx.favoriteTypes?.includes(g.type)) { score += 0.4; notes.push('a favourite'); }
        if (graduated.has(g.type)) { score -= 1; notes.push('mastered this game — varying'); }
        return { type: g.type, family: g.family, score: Math.round(score * 100) / 100, notes };
      })
      .sort((a, b) => b.score - a.score);
  }

  /** True if today's planned sequence of types equals the most recent completed day's sequence. */
  sameAsYesterday(planned: GameType[], history: ActivityRecord[]): boolean {
    if (!history.length) return false;
    const lastSession = history.at(-1)!.sessionId;
    const seq = history.filter((h) => h.sessionId === lastSession).map((h) => h.gameType);
    return seq.length === planned.length && seq.every((t, i) => t === planned[i]);
  }

  /** Favourite types inferred from completion + stars (never asked of the child). */
  inferFavorites(history: ActivityRecord[], top = 3): GameType[] {
    const stats = new Map<string, { plays: number; stars: number; abandoned: number }>();
    for (const h of history) {
      if (h.gameType === 'story-beat' || h.gameType === 'speaking') continue;
      const s = stats.get(h.gameType) ?? { plays: 0, stars: 0, abandoned: 0 };
      s.plays += 1; s.stars += h.stars; s.abandoned += h.abandoned ? 1 : 0;
      stats.set(h.gameType, s);
    }
    return [...stats.entries()]
      .filter(([, s]) => s.plays >= 2)
      .sort((a, b) => (b[1].stars - b[1].abandoned * 3) / b[1].plays - (a[1].stars - a[1].abandoned * 3) / a[1].plays)
      .slice(0, top)
      .map(([t]) => t as GameType);
  }
}

export const antiBoredomEngine = new AntiBoredomEngine();
