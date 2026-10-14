import type { ActivityFamily, CompanionStage, LearningLanguage } from '@/types/core';
import type { AchievementDef } from '@/types/content';
import type { ActivityRecord, ChildProfile, ChildState, LearningEvidence, SpeechAttemptRecord } from '@/types/learner';
import type { DailyJourney } from '@/types/engine';
import type { ContentIndex } from '@/content';
import { learningBrain, newMasteryRecord } from './LearningBrain';
import { adaptiveReviewEngine, newReviewState, qualityFromEvidence } from './AdaptiveReviewEngine';
import { difficultyEngine } from './DifficultyEngine';
import { CurriculumEngine } from './CurriculumEngine';
import { emptyInventory, rewardEngine, type LearnerStats } from './RewardEngine';
import { companionEngine, newCompanion } from '@/companions/CompanionEngine';
import { StoryEngine, initialStoryState } from '@/story-engine/StoryEngine';
import { newId } from '@/lib/id';
import { trackIdOf } from './track';
import type { AgeBand } from '@/types/core';
import { uuidFromString } from '@/lib/random';
import { toLocalDateKey } from '@/lib/time';

/**
 * LearningOrchestrator — the single place where learning evidence changes a child's state.
 * Pure functions: (state, result) → (state', effects). Persistence and sync happen elsewhere,
 * which keeps the logic identical online, offline and on the server.
 */

export interface ActivityResult {
  sessionId: string;
  gameType: ActivityRecord['gameType'];
  family: ActivityFamily;
  worldId: string | null;
  evidence: LearningEvidence[];
  correct: number;
  total: number;
  durationMs: number;
  abandoned: boolean;
  hintsUsed: number;
  speech?: Omit<SpeechAttemptRecord, 'id' | 'childId' | 'language'>[];
  starsAt?: [number, number, number];
}

export interface Effects {
  stars: 0 | 1 | 2 | 3;
  evolvedTo: CompanionStage | null;
  unitsCompleted: string[];
  achievementsUnlocked: AchievementDef[];
  rewardsGranted: string[];
  commandsLearned: string[];
  welcomeBack?: boolean;
}

const MAX_HISTORY = 400;
const MAX_SPEECH = 300;

export function initialChildState(child: ChildProfile, content: ContentIndex, now: Date, eggColor = 'gold'): ChildState {
  const curriculum = new CurriculumEngine(content);
  return {
    child,
    progress: curriculum.initialProgress(child.id, child.targetLanguage, trackIdOf(child), child.estimatedLevel),
    mastery: [], reviews: [],
    story: { ...initialStoryState(child.id, child.targetLanguage), activeArcId: content.track(trackIdOf(child)).arcIds[0] ?? 'golden-key' },
    companion: newCompanion(child.id, eggColor),
    inventory: emptyInventory(child.id),
    streak: { childId: child.id, currentDays: 0, bestDays: 0, lastActiveDate: null },
    history: [], speech: [], books: [], creations: [], sessions: [], visitedWorldIds: ['my-home'],
    activeJourney: null,
    updatedAt: now.toISOString(),
  };
}

export class LearningOrchestrator {
  private readonly curriculum: CurriculumEngine;
  private readonly story: StoryEngine;

  constructor(private readonly content: ContentIndex) {
    this.curriculum = new CurriculumEngine(content);
    this.story = new StoryEngine(content);
  }

  processActivity(state: ChildState, result: ActivityResult, now: Date, premium: boolean): { state: ChildState; effects: Effects } {
    const lang: LearningLanguage = state.child.targetLanguage;
    const ageBand = state.child.ageBand;

    // 1. Mastery
    const masteryMap = new Map(state.mastery.map((m) => [m.itemId, m]));
    const byItem = new Map<string, LearningEvidence[]>();
    for (const ev of result.evidence) byItem.set(ev.itemId, [...(byItem.get(ev.itemId) ?? []), ev]);
    for (const [itemId, evs] of byItem) {
      const rec = masteryMap.get(itemId) ?? newMasteryRecord(state.child.id, lang, itemId, evs[0]!.itemType, now);
      masteryMap.set(itemId, learningBrain.applyAll(rec, evs));
    }

    // 2. Spaced repetition
    const reviewMap = new Map(state.reviews.map((r) => [r.itemId, r]));
    for (const [itemId, evs] of byItem) {
      // Passive exposure (hearing a story line) doesn't start a review schedule; practice does.
      const graded = evs.some((e) => !e.kind.startsWith('exposure'));
      const existing = reviewMap.get(itemId);
      if (!graded) {
        if (!existing && this.isCurriculumItem(itemId)) reviewMap.set(itemId, newReviewState(state.child.id, lang, itemId, evs[0]!.itemType, now));
        continue;
      }
      reviewMap.set(itemId, adaptiveReviewEngine.schedule(existing ?? newReviewState(state.child.id, lang, itemId, evs[0]!.itemType, now), qualityFromEvidence(evs), now));
    }

    // 3. History + difficulty
    const stars = rewardEngine.starsFor(result.correct, result.total, result.starsAt);
    const record: ActivityRecord = {
      id: newId(), childId: state.child.id, language: lang, sessionId: result.sessionId, gameType: result.gameType,
      family: result.family, worldId: result.worldId, itemIds: [...byItem.keys()], correct: result.correct, total: result.total,
      stars, durationMs: result.durationMs, abandoned: result.abandoned, difficulty: state.progress.difficulty, at: now.toISOString(),
    };
    const history = [...state.history, record].slice(-MAX_HISTORY);
    const difficulty = result.total > 0 || result.abandoned
      ? difficultyEngine.update(state.progress.difficulty, record, ageBand, result.hintsUsed)
      : state.progress.difficulty;
    let progress = { ...state.progress, difficulty, challengeTolerance: difficultyEngine.challengeTolerance(history) };

    // 4. Companion
    let { state: companion, evolvedTo } = companionEngine.gainFromEvidence(state.companion, result.evidence, now);
    const commandsLearned: string[] = [];
    for (const ev of result.evidence) {
      const c = this.content.concepts.get(ev.itemId);
      if (ev.correct && ev.kind === 'speaking' && c?.tags.includes('mimo-command') && !companion.learnedCommands.includes(c.id)) {
        companion = companionEngine.learnCommand(companion, c.id);
        commandsLearned.push(c.id);
      }
    }

    // 5. Curriculum
    const advanced = this.curriculum.advance(progress, masteryMap, trackIdOf(state.child));
    progress = advanced.progress;

    // 6. Speech log (transcripts and scores only — never audio)
    const speech = [...state.speech, ...(result.speech ?? []).map((s) => ({ ...s, id: newId(), childId: state.child.id, language: lang }))].slice(-MAX_SPEECH);

    let next: ChildState = {
      ...state, progress, history, companion, speech,
      mastery: [...masteryMap.values()], reviews: [...reviewMap.values()],
      inventory: rewardEngine.addActivity(state.inventory, stars, 10 + stars * 5),
      updatedAt: now.toISOString(),
    };
    const ach = rewardEngine.checkAchievements(next.inventory, this.content.bundle.achievements, this.stats(next));
    next = { ...next, inventory: ach.inventory };
    void premium;

    return { state: next, effects: { stars, evolvedTo, unitsCompleted: advanced.completed, achievementsUnlocked: ach.unlocked, rewardsGranted: [], commandsLearned } };
  }

  /** Items that belong to a curriculum unit (vs. narrative-only phrases like "Look!"). */
  private curriculumItems: Set<string> | null = null;
  private isCurriculumItem(itemId: string): boolean {
    if (!this.curriculumItems) this.curriculumItems = new Set(this.content.bundle.units.flatMap((u) => [...u.conceptIds, ...u.phraseIds]));
    return this.curriculumItems.has(itemId);
  }

  /**
   * Move a child to another track (parent decision or graduation). Learning is never lost:
   * mastery, reviews, rewards and Mimo carry over; the syllabus position is recomputed on the new
   * track and the story continues with that track's opening season.
   */
  changeTrack(state: ChildState, track: AgeBand, now: Date): ChildState {
    const child = { ...state.child, trackId: track };
    const units = this.curriculum.orderedUnits(track);
    const done = new Set(state.progress.completedUnitIds);
    const next = units.find((u) => !done.has(u.id)) ?? units.at(-1)!;
    const masteryMap = new Map(state.mastery.map((m) => [m.itemId, m]));
    let progress = { ...state.progress, currentUnitId: next.id, stage: next.stage };
    progress = this.curriculum.advance(progress, masteryMap, track).progress;
    const arcs = this.content.track(track).arcIds;
    const activeArcId = arcs.find((a) => this.content.bundle.arcs.find((x) => x.id === a)?.episodeIds.some((e) => !state.story.completedEpisodeIds.includes(e))) ?? arcs[0] ?? state.story.activeArcId;
    return { ...state, child, progress, story: { ...state.story, activeArcId }, activeJourney: null, updatedAt: now.toISOString() };
  }

  /** Should the parent be offered a move to the next track? */
  graduationSuggestion(state: ChildState): AgeBand | null {
    const track = this.content.track(trackIdOf(state.child));
    if (!track.graduation.nextTrack) return null;
    return this.stats(state).wordsMastered >= track.graduation.wordsMastered ? track.graduation.nextTrack : null;
  }

  recordChoice(state: ChildState, choiceKey: string, optionId: string): ChildState {
    return { ...state, story: this.story.recordChoice(state.story, choiceKey, optionId) };
  }

  completeJourney(state: ChildState, journey: DailyJourney, now: Date, premium: boolean, learningMs: number): { state: ChildState; effects: Effects } {
    const episode = this.content.episodes.get(journey.episodeId);
    let next = state;
    let granted: string[] = [];
    if (episode) {
      next = { ...next, story: this.story.completeEpisode(next.story, episode, now, episode.memoryKey) };
      const g = rewardEngine.grant(next.inventory, episode.rewardIds, this.content.rewards, premium);
      granted = g.granted;
      next = { ...next, inventory: g.inventory };
    }
    const { state: companion, evolvedTo } = companionEngine.gainActivity(next.companion, 'journey', now);
    const streakResult = rewardEngine.updateStreak(next.streak, now);
    const date = toLocalDateKey(now);
    const sessions = [...next.sessions.filter((s) => !(s.date === date && s.journeyId === journey.id)), {
      id: uuidFromString(journey.id), childId: state.child.id, language: state.child.targetLanguage, date, journeyId: journey.id,
      startedAt: new Date(now.getTime() - learningMs).toISOString(), endedAt: now.toISOString(), learningMs, freePlayMs: 0, journeyCompleted: true,
    }].slice(-120);
    const visited = [...new Set([...next.visitedWorldIds, journey.worldId])];
    next = { ...next, companion, streak: streakResult.streak, sessions, visitedWorldIds: visited, activeJourney: null, updatedAt: now.toISOString() };
    const ach = rewardEngine.checkAchievements(next.inventory, this.content.bundle.achievements, this.stats(next));
    next = { ...next, inventory: ach.inventory };
    return { state: next, effects: { stars: 3, evolvedTo, unitsCompleted: [], achievementsUnlocked: ach.unlocked, rewardsGranted: granted, commandsLearned: [], welcomeBack: streakResult.welcomeBack } };
  }

  /** Free-play time (explore, create, library) — tracked separately; never extends "learning" time. */
  addFreePlay(state: ChildState, ms: number, now: Date): ChildState {
    const date = toLocalDateKey(now);
    const today = state.sessions.find((s) => s.date === date);
    const sessions = today
      ? state.sessions.map((s) => (s === today ? { ...s, freePlayMs: s.freePlayMs + ms, endedAt: now.toISOString() } : s))
      : [...state.sessions, { id: newId(), childId: state.child.id, language: state.child.targetLanguage, date, journeyId: null, startedAt: now.toISOString(), endedAt: now.toISOString(), learningMs: 0, freePlayMs: ms, journeyCompleted: false }];
    return { ...state, sessions };
  }

  stats(state: ChildState): LearnerStats {
    const masteryMap = new Map(state.mastery.map((m) => [m.itemId, m]));
    const counts = this.curriculum.stageCounts(masteryMap, state.child.ageBand);
    const listeningCorrect = state.history.filter((h) => h.family === 'listening').reduce((s, h) => s + h.correct, 0);
    return {
      wordsPracticed: counts.practiced,
      wordsMastered: counts.mastered,
      sentencesSpoken: state.speech.filter((s) => s.accepted && s.expected.trim().split(/\s+/).length >= 3).length,
      listeningCorrect,
      speechAttempts: state.speech.length,
      booksRead: state.books.filter((b) => b.completed).length,
      episodesCompleted: state.story.completedEpisodeIds.length,
      mimoStage: state.companion.stage,
      worldsVisited: state.visitedWorldIds.length,
      creations: state.creations.length,
    };
  }
}
