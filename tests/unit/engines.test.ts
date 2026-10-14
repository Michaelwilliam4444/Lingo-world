import { describe, expect, it } from 'vitest';
import { LearningBrain, newMasteryRecord } from '@/learning-engine/LearningBrain';
import { AdaptiveReviewEngine, newReviewState, qualityFromEvidence } from '@/learning-engine/AdaptiveReviewEngine';
import { DifficultyEngine } from '@/learning-engine/DifficultyEngine';
import { AntiBoredomEngine } from '@/learning-engine/AntiBoredomEngine';
import { CompanionEngine, newCompanion } from '@/companions/CompanionEngine';
import { RewardEngine, emptyInventory } from '@/learning-engine/RewardEngine';
import { getContentIndex } from '@/content';
import type { ActivityRecord, LearningEvidence } from '@/types/learner';
import { addDays } from '@/lib/time';

const t0 = new Date('2026-03-01T09:00:00Z');
const ev = (kind: LearningEvidence['kind'], correct: boolean, at: Date, extra: Partial<LearningEvidence> = {}): LearningEvidence =>
  ({ itemId: 'food.apple', itemType: 'concept', kind, correct, hintsUsed: 0, at: at.toISOString(), ...extra });

describe('LearningBrain', () => {
  const brain = new LearningBrain();
  it('raises listening mastery with correct answers and tracks dimensions independently', () => {
    let rec = newMasteryRecord('c', 'en', 'food.apple', 'concept', t0);
    for (let i = 0; i < 4; i++) rec = brain.apply(rec, ev('listening-recognition', true, new Date(t0.getTime() + i * 60000)));
    expect(rec.mastery.listeningRecognition).toBeGreaterThan(80);
    expect(rec.mastery.speaking).toBe(0);
    expect(rec.mastery.writing).toBe(0);
    expect(rec.mastery.heard).toBeGreaterThanOrEqual(60);
  });
  it('does not grant retention for same-session repetition, but does after a gap', () => {
    let rec = newMasteryRecord('c', 'en', 'food.apple', 'concept', t0);
    for (let i = 0; i < 5; i++) rec = brain.apply(rec, ev('listening-recognition', true, new Date(t0.getTime() + i * 60000)));
    expect(rec.mastery.retention).toBeLessThanOrEqual(30);
    rec = brain.apply(rec, ev('listening-recognition', true, addDays(t0, 3)));
    expect(rec.mastery.retention).toBeGreaterThan(40);
  });
  it('penalises hints and flags struggling items', () => {
    let rec = newMasteryRecord('c', 'en', 'food.apple', 'concept', t0);
    rec = brain.apply(rec, ev('speaking', true, t0, { hintsUsed: 2 }));
    expect(rec.mastery.speaking).toBeLessThan(40);
    for (let i = 1; i <= 3; i++) rec = brain.apply(rec, ev('speaking', false, new Date(t0.getTime() + i * 1000)));
    expect(brain.summarize(rec, 'adventurer').status).toBe('struggling');
  });
});

describe('AdaptiveReviewEngine', () => {
  const engine = new AdaptiveReviewEngine();
  it('uses short child-friendly first intervals and grows them', () => {
    let s = newReviewState('c', 'en', 'food.apple', 'concept', t0);
    const intervals: number[] = [];
    let now = t0;
    for (let i = 0; i < 6; i++) { s = engine.schedule(s, 5, now); intervals.push(s.intervalDays); now = new Date(s.dueAt); }
    expect(intervals.slice(0, 4)).toEqual([0.25, 1, 2, 4]);
    expect(intervals[5]!).toBeGreaterThan(intervals[4]!);
    expect(Math.max(...intervals)).toBeLessThanOrEqual(45);
  });
  it('resets on lapse and surfaces struggling items even before due', () => {
    let s = newReviewState('c', 'en', 'food.apple', 'concept', t0);
    s = engine.schedule(s, 5, t0); s = engine.schedule(s, 5, addDays(t0, 1));
    s = engine.schedule(s, 1, addDays(t0, 3));
    expect(s.repetitions).toBe(0); expect(s.lapses).toBe(1); expect(s.intervalDays).toBe(0.25);
    const brain = new LearningBrain();
    let rec = newMasteryRecord('c', 'en', 'food.apple', 'concept', t0);
    rec = brain.apply(rec, ev('listening-recognition', false, t0));
    rec = brain.apply(rec, ev('listening-recognition', false, t0));
    const future = { ...s, dueAt: addDays(t0, 10).toISOString() };
    const c = engine.candidates([future], new Map([[rec.itemId, rec]]), t0);
    expect(c[0]?.reason).toBe('struggling');
  });
  it('derives quality from correctness, hints and pronunciation', () => {
    expect(qualityFromEvidence([ev('listening-recognition', true, t0)])).toBe(5);
    expect(qualityFromEvidence([ev('listening-recognition', true, t0, { hintsUsed: 2 })])).toBeLessThan(4);
    expect(qualityFromEvidence([ev('listening-recognition', false, t0)])).toBe(0);
  });
});

describe('DifficultyEngine', () => {
  const engine = new DifficultyEngine();
  it('raises difficulty on easy success, lowers on struggle and abandonment, respects age caps', () => {
    expect(engine.update(2, { correct: 10, total: 10, abandoned: false }, 'adventurer')).toBeGreaterThan(2);
    expect(engine.update(2, { correct: 3, total: 10, abandoned: false }, 'adventurer')).toBeLessThan(2);
    expect(engine.update(2, { correct: 0, total: 0, abandoned: true }, 'adventurer')).toBeLessThan(2);
    expect(engine.update(3.2, { correct: 10, total: 10, abandoned: false }, 'little')).toBeLessThanOrEqual(3.2);
  });
  it('scaffolds struggling learners', () => {
    const easy = engine.configure(1.2, 'little', [4, 5, 6, 7, 8]);
    const hard = engine.configure(4.6, 'hero', [4, 5, 6, 7, 8]);
    expect(easy.optionCount).toBeLessThan(hard.optionCount);
    expect(easy.audioRate).toBeLessThan(1);
    expect(easy.offerFirstSound).toBe(true);
    expect(hard.hardDistractors).toBe(true);
    expect(engine.configure(4, 'hero', [4, 5, 6, 7, 8], { struggling: true }).level).toBeLessThan(4);
  });
});

describe('AntiBoredomEngine', () => {
  const engine = new AntiBoredomEngine();
  const games = getContentIndex().bundle.games.filter((g) => ['balloon-pop', 'picture-hunt', 'memory-cards'].includes(g.type));
  const rec = (type: string, family: ActivityRecord['family'], i: number, ratio = 1): ActivityRecord => ({
    id: `a${i}`, childId: 'c', language: 'en', sessionId: `s${Math.floor(i / 3)}`, gameType: type as never, family, worldId: null,
    itemIds: [], correct: ratio * 10, total: 10, stars: 3, durationMs: 1000, abandoned: false, difficulty: 2, at: addDays(t0, i / 10).toISOString(),
  });
  it('never puts the just-played game first and favours unused families', () => {
    const history = [rec('balloon-pop', 'movement', 1), rec('balloon-pop', 'movement', 2), rec('picture-hunt', 'listening', 3)];
    const scored = engine.score(games, { history, now: addDays(t0, 1) });
    expect(scored[0]!.type).toBe('memory-cards');
    expect(scored.at(-1)!.type).not.toBe('memory-cards');
  });
  it('graduates games the child aces repeatedly', () => {
    const history = [1, 2, 3].map((i) => rec('picture-hunt', 'listening', i, 1));
    expect(engine.graduatedTypes(history).has('picture-hunt')).toBe(true);
  });
});

describe('CompanionEngine', () => {
  const engine = new CompanionEngine();
  it('hatches and evolves through learning only, choosing a path from behaviour', () => {
    let mimo = newCompanion('c', 'gold');
    const speaking = Array.from({ length: 400 }, (_, i) => ev('speaking', true, new Date(t0.getTime() + i)));
    const r = engine.gainFromEvidence(mimo, speaking, t0);
    mimo = r.state;
    expect(mimo.stage).not.toBe('egg');
    expect(['advanced', 'specialized', 'legendary']).toContain(mimo.stage);
    expect(mimo.path).toBe('voice');
  });
  it('never drops happiness below 40 when away', () => {
    const mimo = { ...newCompanion('c', 'gold'), happiness: 70, lastFedAt: t0.toISOString() };
    expect(engine.decay(mimo, addDays(t0, 30)).happiness).toBe(40);
  });
});

describe('RewardEngine', () => {
  const engine = new RewardEngine();
  it('always celebrates effort with at least one star', () => {
    expect(engine.starsFor(0, 5)).toBe(1);
    expect(engine.starsFor(5, 5)).toBe(3);
  });
  it('uses gentle streaks with welcome-back instead of loss', () => {
    const s0 = { childId: 'c', currentDays: 5, bestDays: 5, lastActiveDate: '2026-03-01' };
    const next = engine.updateStreak(s0, new Date('2026-03-02T10:00:00'));
    expect(next.streak.currentDays).toBe(6);
    const back = engine.updateStreak(s0, new Date('2026-03-09T10:00:00'));
    expect(back.welcomeBack).toBe(true);
    expect(back.streak.currentDays).toBe(1);
    expect(back.streak.bestDays).toBe(5);
  });
  it('grants each reward once and respects premium cosmetics', () => {
    const idx = getContentIndex();
    const inv = emptyInventory('c');
    const r1 = engine.grant(inv, ['sticker.key', 'mimo.sparkles'], idx.rewards, false);
    expect(r1.granted).toEqual(['sticker.key']);
    const r2 = engine.grant(r1.inventory, ['sticker.key'], idx.rewards, false);
    expect(r2.granted).toEqual([]);
  });
});
