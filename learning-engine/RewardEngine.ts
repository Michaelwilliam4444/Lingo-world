import type { CompanionStage } from '@/types/core';
import type { AchievementDef, Reward } from '@/types/content';
import type { Inventory, StreakState } from '@/types/learner';
import { daysBetween, toLocalDateKey } from '@/lib/time';
import { STAGE_THRESHOLDS } from '@/companions/CompanionEngine';

/**
 * RewardEngine — understandable, non-gambling rewards.
 * Deterministic: the same achievement always gives the same reward. No loot boxes, no random drops,
 * no purchasable currency. Streaks are optional and never loss-framed.
 */

export interface LearnerStats {
  wordsPracticed: number;
  wordsMastered: number;
  sentencesSpoken: number;
  listeningCorrect: number;
  speechAttempts: number;
  booksRead: number;
  episodesCompleted: number;
  mimoStage: CompanionStage;
  worldsVisited: number;
  creations: number;
}

export function emptyInventory(childId: string): Inventory {
  return { childId, stars: 0, adventurePoints: 0, rewardIds: [], achievementIds: [], newRewardIds: [] };
}

export class RewardEngine {
  starsFor(correct: number, total: number, starsAt: [number, number, number] = [0.4, 0.7, 0.95]): 0 | 1 | 2 | 3 {
    if (total === 0) return 1; // participation in non-scored activities
    const r = correct / total;
    if (r >= starsAt[2]) return 3;
    if (r >= starsAt[1]) return 2;
    if (r >= starsAt[0]) return 1;
    return 1; // we never award zero stars for finishing — effort is celebrated
  }

  addActivity(inv: Inventory, stars: number, points: number): Inventory {
    return { ...inv, stars: inv.stars + stars, adventurePoints: inv.adventurePoints + points };
  }

  grant(inv: Inventory, rewardIds: string[], catalog: Map<string, Reward>, premium: boolean): { inventory: Inventory; granted: string[] } {
    const granted = rewardIds.filter((id) => {
      const r = catalog.get(id);
      return r && !inv.rewardIds.includes(id) && (!r.premium || premium);
    });
    return {
      inventory: { ...inv, rewardIds: [...inv.rewardIds, ...granted], newRewardIds: [...inv.newRewardIds, ...granted] },
      granted,
    };
  }

  markSeen(inv: Inventory): Inventory {
    return { ...inv, newRewardIds: [] };
  }

  achieved(def: AchievementDef, stats: LearnerStats): boolean {
    const r = def.rule;
    switch (r.type) {
      case 'wordsPracticed': return stats.wordsPracticed >= r.count;
      case 'wordsMastered': return stats.wordsMastered >= r.count;
      case 'sentencesSpoken': return stats.sentencesSpoken >= r.count;
      case 'listeningCorrect': return stats.listeningCorrect >= r.count;
      case 'speechAttempts': return stats.speechAttempts >= r.count;
      case 'booksRead': return stats.booksRead >= r.count;
      case 'episodesCompleted': return stats.episodesCompleted >= r.count;
      case 'worldsVisited': return stats.worldsVisited >= r.count;
      case 'creations': return stats.creations >= r.count;
      case 'mimoStage': {
        const order = STAGE_THRESHOLDS.map((t) => t.stage);
        return order.indexOf(stats.mimoStage) >= order.indexOf(r.stage as CompanionStage);
      }
    }
  }

  checkAchievements(inv: Inventory, defs: AchievementDef[], stats: LearnerStats): { inventory: Inventory; unlocked: AchievementDef[] } {
    const unlocked = defs.filter((d) => !inv.achievementIds.includes(d.id) && this.achieved(d, stats));
    if (!unlocked.length) return { inventory: inv, unlocked };
    return { inventory: { ...inv, achievementIds: [...inv.achievementIds, ...unlocked.map((u) => u.id)], adventurePoints: inv.adventurePoints + unlocked.length * 50 }, unlocked };
  }

  /** Gentle streak: missing days simply restarts the count; the UI says "Welcome back!" — never "you lost". */
  updateStreak(streak: StreakState, now: Date): { streak: StreakState; welcomeBack: boolean } {
    const today = toLocalDateKey(now);
    if (streak.lastActiveDate === today) return { streak, welcomeBack: false };
    const gap = streak.lastActiveDate ? Math.round(daysBetween(streak.lastActiveDate, today)) : null;
    const continued = gap === 1;
    const current = continued ? streak.currentDays + 1 : 1;
    return {
      streak: { ...streak, currentDays: current, bestDays: Math.max(streak.bestDays, current), lastActiveDate: today },
      welcomeBack: gap !== null && gap > 1,
    };
  }
}

export const rewardEngine = new RewardEngine();
