import type { ChildState } from '@/types/learner';

/**
 * Conflict resolution for learner state edited on two devices (or offline then online).
 * Learning data is mostly monotonic, so we merge per field with "never lose learning" rules:
 *   - mastery: the record with more evidence wins (attempts, then recency)
 *   - review schedule: the most recently reviewed wins
 *   - activity/speech/sessions/creations: union by id
 *   - story: union of completed episodes & memories; choices from the newer state for shared keys
 *   - companion: highest XP wins; learned commands union
 *   - inventory: union of owned items; counters take the max (never double-count)
 */
export function mergeChildState(a: ChildState, b: ChildState): ChildState {
  const newer = a.updatedAt >= b.updatedAt ? a : b;
  const older = newer === a ? b : a;

  const byId = <T>(xs: T[], ys: T[], key: (x: T) => string, pick: (x: T, y: T) => T) => {
    const m = new Map<string, T>();
    for (const x of xs) m.set(key(x), x);
    for (const y of ys) {
      const k = key(y);
      const x = m.get(k);
      m.set(k, x ? pick(x, y) : y);
    }
    return [...m.values()];
  };

  const mastery = byId(a.mastery, b.mastery, (m) => m.itemId, (x, y) =>
    x.attempts !== y.attempts ? (x.attempts > y.attempts ? x : y) : x.updatedAt >= y.updatedAt ? x : y);
  const reviews = byId(a.reviews, b.reviews, (r) => r.itemId, (x, y) => ((x.lastReviewedAt ?? '') >= (y.lastReviewedAt ?? '') ? x : y));
  const history = byId(a.history, b.history, (h) => h.id, (x) => x).sort((p, q) => p.at.localeCompare(q.at)).slice(-400);
  const speech = byId(a.speech, b.speech, (s) => s.id, (x) => x).sort((p, q) => p.at.localeCompare(q.at)).slice(-300);
  const sessions = byId(a.sessions, b.sessions, (s) => s.id, (x, y) => ((x.endedAt ?? '') >= (y.endedAt ?? '') ? x : y)).sort((p, q) => p.date.localeCompare(q.date));
  const creations = byId(a.creations, b.creations, (c) => c.id, (x, y) => (x.updatedAt >= y.updatedAt ? x : y));
  const books = byId(a.books, b.books, (bk) => bk.bookId, (x, y) => ({
    ...(x.updatedAt >= y.updatedAt ? x : y),
    pagesRead: Math.max(x.pagesRead, y.pagesRead), completed: x.completed || y.completed, quizCorrect: Math.max(x.quizCorrect, y.quizCorrect),
  }));

  const completedUnits = [...new Set([...a.progress.completedUnitIds, ...b.progress.completedUnitIds])];
  const progressBase = a.progress.completedUnitIds.length >= b.progress.completedUnitIds.length ? a.progress : b.progress;

  const companionBase = a.companion.xp >= b.companion.xp ? a.companion : b.companion;
  const memories = byId(a.story.memories, b.story.memories, (m) => `${m.key}:${m.episodeId}`, (x) => x);

  return {
    ...newer,
    progress: { ...progressBase, completedUnitIds: completedUnits, difficulty: newer.progress.difficulty, challengeTolerance: newer.progress.challengeTolerance },
    mastery, reviews, history, speech, sessions, creations, books,
    story: {
      ...newer.story,
      completedEpisodeIds: [...new Set([...older.story.completedEpisodeIds, ...newer.story.completedEpisodeIds])],
      choices: { ...older.story.choices, ...newer.story.choices },
      memories,
    },
    companion: { ...companionBase, learnedCommands: [...new Set([...a.companion.learnedCommands, ...b.companion.learnedCommands])] },
    inventory: {
      ...newer.inventory,
      stars: Math.max(a.inventory.stars, b.inventory.stars),
      adventurePoints: Math.max(a.inventory.adventurePoints, b.inventory.adventurePoints),
      rewardIds: [...new Set([...a.inventory.rewardIds, ...b.inventory.rewardIds])],
      achievementIds: [...new Set([...a.inventory.achievementIds, ...b.inventory.achievementIds])],
      newRewardIds: [...new Set([...newer.inventory.newRewardIds])],
    },
    streak: { ...newer.streak, bestDays: Math.max(a.streak.bestDays, b.streak.bestDays) },
    visitedWorldIds: [...new Set([...a.visitedWorldIds, ...b.visitedWorldIds])],
    updatedAt: newer.updatedAt,
  };
}
