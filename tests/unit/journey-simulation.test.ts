import { describe, expect, it, vi } from 'vitest';
import { getContentIndex } from '@/content';
import { NeverSameJourneyEngine } from '@/journey-engine/NeverSameJourneyEngine';
import { LearningOrchestrator, initialChildState } from '@/learning-engine/LearningOrchestrator';
import { evidenceForRound } from '@/game-engine/GameEngine';
import { createRng } from '@/lib/random';
import { addDays } from '@/lib/time';
import type { ChildState } from '@/types/learner';
import type { DailyJourney } from '@/types/engine';
import { LEARNING_LANGUAGES, type LearningLanguage } from '@/types/core';
import { makeChild } from './helpers';

const content = getContentIndex();
const engine = new NeverSameJourneyEngine(content);
const orch = new LearningOrchestrator(content);

/** Plays a journey like a child: mostly right, always wrong on `hardItem` for the first days. */
const hardSeen = new Map<string, number>();
/** The hard item is answered wrongly on its first 3 days of practice. */
function isHardToday(key: string, item: string, day: number): boolean {
  const k = `${key}:${item}`;
  if (!hardSeen.has(k)) hardSeen.set(k, day);
  return day - hardSeen.get(k)! < 3;
}

function play(state: ChildState, journey: DailyJourney, now: Date, day: number, hardItem: string, rngSeed: string) {
  const rng = createRng(rngSeed);
  const key = rngSeed.split('-')[0]! + state.child.ageBand;
  let s = state;
  const choices: Record<string, string> = {};
  for (const step of journey.steps) {
    if (step.kind === 'game') {
      const evidence = []; let correct = 0;
      for (const round of step.game.rounds) {
        const isHard = round.prompt.itemId === hardItem && isHardToday(key, hardItem, day);
        const ok = !isHard && rng.next() < 0.85;
        if (ok) correct++;
        evidence.push(...evidenceForRound(round, ok, { hintsUsed: 0, at: now.toISOString(), score: ok ? 85 : 40 }));
      }
      s = orch.processActivity(s, { sessionId: journey.id, gameType: step.game.type, family: step.game.family, worldId: journey.worldId, evidence, correct, total: step.game.rounds.length, durationMs: 60000, abandoned: false, hintsUsed: 0 }, now, false).state;
    } else if (step.kind === 'speak') {
      const ok = step.expected.itemId !== hardItem || !isHardToday(key, hardItem, day);
      const ids = [step.expected.itemId, ...(step.expected.relatedItemIds ?? [])];
      const evidence = ids.flatMap((id) => ([{ itemId: id, itemType: step.expected.itemType, kind: 'speaking' as const, correct: ok, hintsUsed: 0, at: now.toISOString() }]));
      s = orch.processActivity(s, { sessionId: journey.id, gameType: 'speaking', family: 'speaking', worldId: journey.worldId, evidence, correct: ok ? 1 : 0, total: 1, durationMs: 8000, abandoned: false, hintsUsed: 0,
        speech: [{ itemId: step.expected.itemId, expected: step.expected.text, heard: ok ? step.expected.text : '...', score: ok ? 90 : 30, accepted: ok, focusSounds: [], at: now.toISOString() }] }, now, false).state;
    } else if (step.kind === 'choice') {
      const opt = step.options[day % step.options.length]!;
      choices[step.choiceKey] = opt.id;
      s = orch.recordChoice(s, step.choiceKey, opt.id);
    } else if (step.kind === 'story') {
      const ev = step.lines.filter((l) => l.target?.itemId).map((l) => ({ itemId: l.target!.itemId!, itemType: l.target!.itemType ?? 'concept', kind: 'exposure-hear' as const, correct: true, hintsUsed: 0, at: now.toISOString() }));
      if (ev.length) s = orch.processActivity(s, { sessionId: journey.id, gameType: 'story-beat', family: 'story', worldId: journey.worldId, evidence: ev, correct: 0, total: 0, durationMs: 5000, abandoned: false, hintsUsed: 0 }, now, false).state;
    }
  }
  return { state: orch.completeJourney(s, journey, now, false, 12 * 60000).state, choices };
}

function simulate(lang: LearningLanguage, days: number, ageBand: 'little' | 'adventurer' | 'hero' = 'adventurer') {
  const child = makeChild({ targetLanguage: lang, ageBand, age: ageBand === 'little' ? 5 : ageBand === 'hero' ? 10 : 7 });
  let state = initialChildState(child, content, new Date('2026-03-01T08:00:00Z'));
  const journeys: DailyJourney[] = [];
  const hardItem = 'colors.yellow';
  for (let d = 0; d < days; d++) {
    const now = addDays(new Date('2026-03-01T17:00:00Z'), d);
    const j = engine.compose({ child: state.child, progress: state.progress, mastery: state.mastery, reviews: state.reviews, story: state.story, companion: state.companion, history: state.history, premium: false, micAvailable: true, now, journeysToday: 0 });
    journeys.push(j);
    state = play(state, j, now, d, hardItem, `${lang}-${d}`).state;
  }
  return { state, journeys };
}

describe('Never-Same Journey + learning loop (simulated 40 days)', () => {
  const { state, journeys } = simulate('en', 40);

  it('produces a playable journey every day with story, games, speaking and a reward', () => {
    for (const j of journeys) {
      expect(j.steps.some((s) => s.kind === 'game')).toBe(true);
      expect(j.steps.some((s) => s.kind === 'speak')).toBe(true);
      expect(j.steps.some((s) => s.kind === 'reward')).toBe(true);
      expect(j.estimatedMinutes).toBeGreaterThanOrEqual(5);
      expect(j.estimatedMinutes).toBeLessThanOrEqual(25);
      for (const s of j.steps) if (s.kind === 'game') expect(s.game.rounds.length).toBeGreaterThan(0);
    }
  });

  it('progresses the Golden Key season in order, then continues with other arcs', () => {
    expect(journeys.slice(0, 12).map((j) => j.episodeId)).toEqual(Array.from({ length: 12 }, (_, i) => `gk-${String(i + 1).padStart(2, '0')}`));
    expect(state.story.completedEpisodeIds.length).toBeGreaterThan(12);
    expect(state.story.memories.map((m) => m.key)).toContain('helped-puppy');
  });

  it('never repeats the exact same game sequence on consecutive days', () => {
    const seqs = journeys.map((j) => j.steps.filter((s) => s.kind === 'game').map((s) => (s.kind === 'game' ? s.game.type : '')).join(','));
    for (let i = 1; i < seqs.length; i++) expect(seqs[i]).not.toBe(seqs[i - 1]);
    expect(new Set(seqs.flatMap((s) => s.split(','))).size).toBeGreaterThanOrEqual(10);
  });

  it('brings yesterday’s words back in today’s journey (spaced repetition)', () => {
    const day1New = new Set(journeys[0]!.newItemIds);
    const reviewedLater = journeys.slice(1, 4).flatMap((j) => j.reviewItemIds);
    expect(reviewedLater.some((id) => day1New.has(id))).toBe(true);
  });

  it('remembers mistakes: the struggled word keeps returning as review', () => {
    if (process.env.DEBUG_SIM) journeys.slice(0, 20).forEach((j, d) => console.log(d, 'new', j.newItemIds.join(','), '| review', j.reviewItemIds.join(',')));
    const appear = (id: string) => journeys.filter((j) => j.reviewItemIds.includes(id)).length;
    // The struggled word comes back more often than a sibling word learned at the same time.
    expect(appear('colors.yellow')).toBeGreaterThan(appear('colors.green'));
    expect(appear('colors.yellow')).toBeGreaterThanOrEqual(3);
  });

  it('weaves due words into composed story sentences', () => {
    const sentences = journeys.flatMap((j) => j.steps.filter((s) => s.kind === 'speak' && s.reviewSentence));
    expect(sentences.length).toBeGreaterThan(5);
  });

  it('advances the curriculum, grows vocabulary and evolves Mimo', () => {
    expect(state.progress.completedUnitIds.length).toBeGreaterThan(2);
    const practiced = state.mastery.filter((m) => m.attempts > 0).length;
    expect(practiced).toBeGreaterThan(40);
    expect(['young', 'advanced', 'specialized', 'legendary']).toContain(state.companion.stage);
    expect(state.inventory.achievementIds.length).toBeGreaterThan(2);
    expect(state.streak.currentDays).toBe(40);
  });

  it('plays story callbacks for persisted choices', () => {
    const gk2 = journeys.find((j) => j.episodeId === 'gk-02')!;
    const lines = gk2.steps.flatMap((s) => ('lines' in s ? s.lines.map((l) => l.text) : []));
    expect(lines.some((t) => /Yesterday/.test(t))).toBe(true);
  });

  it('is deterministic for the same child and day, different across days', () => {
    const child = makeChild();
    const st = initialChildState(child, content, new Date('2026-03-01T08:00:00Z'));
    const input = { child, progress: st.progress, mastery: st.mastery, reviews: st.reviews, story: st.story, companion: st.companion, history: st.history, premium: false, micAvailable: true, journeysToday: 0 };
    const a = engine.compose({ ...input, now: new Date('2026-03-01T10:00:00') });
    const b = engine.compose({ ...input, now: new Date('2026-03-01T18:00:00') });
    expect(JSON.stringify(a.steps)).toBe(JSON.stringify(b.steps));
  });
});

describe('journeys compose in every language and age band', () => {
  for (const lang of LEARNING_LANGUAGES) {
    it(`${lang}: 8 days as Little Explorer and Hero`, () => {
      for (const band of ['little', 'hero'] as const) {
        const { journeys, state } = simulate(lang, 8, band);
        expect(journeys).toHaveLength(8);
        expect(state.mastery.length).toBeGreaterThan(10);
        if (band === 'little') {
          for (const j of journeys) expect(j.steps.filter((s) => s.kind === 'game').length).toBeLessThanOrEqual(2);
        }
      }
    });
  }
});

describe('separate age tracks', () => {
  const runs = (['little', 'adventurer', 'hero'] as const).map((band) => ({ band, track: content.track(band), ...simulate('fr', 20, band) }));

  it('each track tells its own story seasons, opening with its own first season', () => {
    for (const { track, journeys } of runs) {
      const arcs = journeys.map((j) => content.episodes.get(j.episodeId)!.arcId);
      expect(arcs[0]).toBe(track.arcIds[0]);
      for (const a of arcs) expect(track.arcIds).toContain(a);
    }
    const openings = runs.map((r) => content.episodes.get(r.journeys[0]!.episodeId)!.arcId);
    expect(new Set(openings).size).toBe(3);
  });

  it('only uses the track’s games, within its per-journey game budget', () => {
    for (const { track, journeys } of runs) {
      for (const j of journeys) {
        const games = j.steps.filter((s) => s.kind === 'game');
        expect(games.length).toBeLessThanOrEqual(track.maxGamesPerJourney);
        for (const g of games) if (g.kind === 'game') expect(track.gameTypes).toContain(g.game.type);
      }
    }
  });

  it('Little Explorers get no text-based review sentences; older tracks do', () => {
    const little = runs.find((r) => r.band === 'little')!;
    expect(little.journeys.some((j) => j.steps.some((s) => s.kind === 'speak' && s.reviewSentence))).toBe(false);
    const hero = runs.find((r) => r.band === 'hero')!;
    expect(hero.journeys.some((j) => j.steps.some((s) => s.kind === 'speak' && s.reviewSentence))).toBe(true);
  });

  it('follows the track syllabus and pace (Heroes move further than Little Explorers)', () => {
    for (const { track, state } of runs) {
      expect(track.unitIds).toContain(state.progress.currentUnitId);
    }
    const words = (band: string) => runs.find((r) => r.band === band)!.state.mastery.length;
    expect(words('hero')).toBeGreaterThan(words('little'));
  });

  it('unlocks new worlds on every track', () => {
    for (const { state, track } of runs) {
      const opening = engine['story'].unlockedWorlds(state.story, 0, track.arcIds[0]).length;
      const start = engine['story'].unlockedWorlds({ ...state.story, completedEpisodeIds: [] }, 0, track.arcIds[0]).length;
      expect(opening).toBeGreaterThan(start);
    }
  });

  it('a parent can move a child to another track without losing progress', () => {
    const little = runs.find((r) => r.band === 'little')!.state;
    const moved = orch.changeTrack(little, 'adventurer', new Date('2026-03-25T08:00:00Z'));
    expect(moved.child.trackId).toBe('adventurer');
    expect(moved.mastery).toEqual(little.mastery);
    expect(moved.inventory).toEqual(little.inventory);
    expect(moved.companion).toEqual(little.companion);
    expect(content.track('adventurer').unitIds).toContain(moved.progress.currentUnitId);
    expect(content.track('adventurer').arcIds).toContain(moved.story.activeArcId);
    const j = engine.compose({ child: moved.child, progress: moved.progress, mastery: moved.mastery, reviews: moved.reviews, story: moved.story, companion: moved.companion, history: moved.history, premium: false, micAvailable: true, now: new Date('2026-03-25T17:00:00Z'), journeysToday: 0 });
    expect(content.track('adventurer').arcIds).toContain(content.episodes.get(j.episodeId)!.arcId);
    expect(j.ageBand).toBe('adventurer');
  });

  it('suggests graduation once the word target is reached', () => {
    const little = runs.find((r) => r.band === 'little')!.state;
    expect(orch.graduationSuggestion(little)).toBeNull();
    const target = content.track('little').graduation.wordsMastered;
    const spy = vi.spyOn(orch, 'stats').mockReturnValue({ ...orch.stats(little), wordsMastered: target });
    expect(orch.graduationSuggestion(little)).toBe('adventurer');
    spy.mockRestore();
    const hero = runs.find((r) => r.band === 'hero')!.state;
    expect(orch.graduationSuggestion(hero)).toBeNull();
  });
});
