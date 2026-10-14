// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LocalRepository } from '@/services/data/LocalRepository';
import { createMemoryKV } from '@/lib/kv';
import { mergeChildState } from '@/services/offline/merge';
import { initialChildState, LearningOrchestrator } from '@/learning-engine/LearningOrchestrator';
import { getContentIndex } from '@/content';
import { LocalPronunciationScorer, normalizeSpeech } from '@/speech/pronunciation';
import { screenChildText, validateChoice } from '@/services/ai/safety';
import { AIService, MockAIProvider } from '@/services/ai/AIService';
import { entitlementsFor, canPlayGame } from '@/billing/plans';
import { ParentInsightsService } from '@/parent/insights';
import { assignVariant, isFlagOn, DEFAULT_FLAGS } from '@/services/flags/flags';
import { computeProductMetrics } from '@/analytics/AnalyticsService';
import { makeChild } from './helpers';

const content = getContentIndex();
const newChild = { nickname: 'Maria', age: 7, nativeLanguage: 'ar', interfaceLocale: 'en' as const, targetLanguage: 'fr' as const, estimatedLevel: 'new' as const, learningGoal: 'fun' as const, dailyTargetMinutes: 15 as const, interests: ['animals' as const], accessibilityNeeds: [] };

describe('LocalRepository (device mode)', () => {
  it('signs up, isolates families, enforces child limits and deletes everything', async () => {
    const kv = createMemoryKV();
    const repo = new LocalRepository(kv);
    await repo.signUp('Parent@Example.com', 'supersecret', 'Sam', 'en');
    const c1 = await repo.createChild(newChild);
    expect(c1.ageBand).toBe('adventurer');
    await repo.createChild({ ...newChild, nickname: 'Omar', age: 4 });
    await expect(repo.createChild({ ...newChild, nickname: 'Third' })).rejects.toThrow(/child_limit_reached/);
    await repo.signOut();
    await expect(repo.signIn('parent@example.com', 'wrong-password')).rejects.toThrow(/incorrect/);
    await repo.signUp('other@example.com', 'supersecret', 'Other', 'ar');
    expect(await repo.listChildren()).toHaveLength(0);
    await expect(repo.loadChildState(c1)).rejects.toThrow(/Not your child/);
    await repo.signOut();
    await repo.signIn('parent@example.com', 'supersecret');
    expect(await repo.listChildren()).toHaveLength(2);
    const exported = (await repo.exportFamilyData()) as { children: unknown[] };
    expect(exported.children).toHaveLength(2);
    await repo.deleteAccount();
    expect(await repo.getCurrentUser()).toBeNull();
    await expect(repo.signIn('parent@example.com', 'supersecret')).rejects.toThrow();
  });
});

describe('offline merge', () => {
  it('never loses learning from either device', () => {
    const orch = new LearningOrchestrator(content);
    const child = makeChild();
    const base = initialChildState(child, content, new Date('2026-03-01T08:00:00Z'));
    const ev = (itemId: string, at: string) => ({ itemId, itemType: 'concept' as const, kind: 'listening-recognition' as const, correct: true, hintsUsed: 0, at });
    const a = orch.processActivity(base, { sessionId: 's1', gameType: 'balloon-pop', family: 'movement', worldId: null, evidence: [ev('food.apple', '2026-03-01T09:00:00Z')], correct: 1, total: 1, durationMs: 1, abandoned: false, hintsUsed: 0 }, new Date('2026-03-01T09:00:00Z'), false).state;
    const b0 = orch.processActivity(base, { sessionId: 's2', gameType: 'sound-match', family: 'listening', worldId: null, evidence: [ev('animals.cat', '2026-03-01T10:00:00Z')], correct: 1, total: 1, durationMs: 1, abandoned: false, hintsUsed: 0 }, new Date('2026-03-01T10:00:00Z'), false).state;
    const b = orch.recordChoice(b0, 'gk.first-search', 'garden');
    const merged = mergeChildState(a, b);
    expect(merged.mastery.map((m) => m.itemId).sort()).toEqual(['animals.cat', 'food.apple']);
    expect(merged.history).toHaveLength(2);
    expect(merged.story.choices['gk.first-search']).toBe('garden');
    expect(merged.inventory.stars).toBe(Math.max(a.inventory.stars, b.inventory.stars));
  });
});

describe('pronunciation scorer', () => {
  const scorer = new LocalPronunciationScorer();
  const rec = (t: string, alts: string[] = []) => ({ transcript: t, alternatives: alts, confidence: 0.9, durationMs: 1000 });
  it('accepts correct speech, ignores articles/accents/punctuation, and is lenient for little ones', async () => {
    expect((await scorer.score({ expected: '¡Una llave dorada!', variants: [], recognition: rec('una llave dorada'), language: 'es', ageBand: 'hero' })).accepted).toBe(true);
    expect((await scorer.score({ expected: 'la pomme', variants: ['pomme'], recognition: rec('pomme'), language: 'fr', ageBand: 'little' })).accepted).toBe(true);
    expect((await scorer.score({ expected: 'Elefant', variants: [], recognition: rec('der Elefant ist da'), language: 'de', ageBand: 'adventurer' })).accepted).toBe(true);
  });
  it('gives gentle "almost" feedback and identifies focus sounds', async () => {
    const r = await scorer.score({ expected: 'three', variants: [], recognition: rec('tree'), language: 'en', ageBand: 'hero' });
    expect(['almost', 'good']).toContain(r.level);
    const wrong = await scorer.score({ expected: 'the bridge', variants: [], recognition: rec('banana'), language: 'en', ageBand: 'hero' });
    expect(wrong.accepted).toBe(false);
    expect(wrong.focusSounds.length).toBeGreaterThan(0);
  });
  it('normalizes French typography', () => {
    expect(normalizeSpeech("Comment tu t'appelles ?", 'fr')).toBe("comment tu t'appelles");
  });
});

describe('LingoAI safety', () => {
  it('redacts personal info and flags unsafe text', () => {
    const r = screenChildText('my email is kid@mail.com call 0101 234 5678');
    expect(r.redacted).not.toMatch(/kid@mail|5678/);
    expect(screenChildText('meet me at the park').safe).toBe(false);
  });
  it('only accepts allow-listed choices and falls back deterministically', async () => {
    expect(validateChoice('x', ['a', 'b'])).toBeNull();
    const ai = new AIService(new MockAIProvider());
    const out = await ai.run({ task: 'roleplay-reply', language: 'en', ageBand: 'adventurer', scenarioTitle: 'Shop', partnerLine: 'What would you like?', childUtterance: 'i would like an apple', options: [{ id: 'shop.how_much', text: 'How much is it?' }, { id: 'shop.i_would_like', text: 'I would like' }] });
    expect(out.choiceId).toBe('shop.i_would_like');
    expect(out.fallback).toBe(true);
  });
});

describe('entitlements, flags & experiments', () => {
  it('maps plans to entitlements and never leaks premium after expiry', () => {
    const free = entitlementsFor({ plan: 'free', status: 'none', currentPeriodEnd: null });
    expect(free.premium).toBe(false);
    expect(canPlayGame('picture-hunt', free)).toBe(true);
    expect(canPlayGame('endless-runner', free)).toBe(false);
    expect(entitlementsFor({ plan: 'family', status: 'active', currentPeriodEnd: '2099-01-01' }).maxChildren).toBe(6);
    expect(entitlementsFor({ plan: 'premium_monthly', status: 'active', currentPeriodEnd: '2000-01-01' }).premium).toBe(false);
  });
  it('rolls out flags and assigns variants deterministically', () => {
    const flag = { ...DEFAULT_FLAGS[0]!, enabled: true, rolloutPercent: 50, environments: ['production' as const] };
    const on = Array.from({ length: 200 }, (_, i) => isFlagOn(flag, 'production', `s${i}`)).filter(Boolean).length;
    expect(on).toBeGreaterThan(60); expect(on).toBeLessThan(140);
    const exp = { key: 'x', description: '', surface: 'ui' as const, active: true, variants: [{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }] };
    expect(assignVariant(exp, 'kid')).toBe(assignVariant(exp, 'kid'));
  });
});

describe('parent insights', () => {
  it('produces readable summaries and a weekly report', () => {
    const child = makeChild();
    let st = initialChildState(child, content, new Date('2026-03-02T08:00:00Z'));
    const orch = new LearningOrchestrator(content);
    const items = ['animals.cat', 'animals.dog', 'animals.bird', 'food.apple', 'food.banana'];
    st = orch.processActivity(st, { sessionId: 's', gameType: 'picture-hunt', family: 'listening', worldId: 'animal-forest', evidence: items.map((itemId) => ({ itemId, itemType: 'concept' as const, kind: 'listening-recognition' as const, correct: true, hintsUsed: 0, at: '2026-03-02T09:00:00Z' })), correct: 5, total: 5, durationMs: 60000, abandoned: false, hintsUsed: 0 }, new Date('2026-03-02T09:00:00Z'), false).state;
    const ins = new ParentInsightsService(content);
    const now = new Date('2026-03-03T09:00:00Z');
    const m = ins.metrics(st, now);
    expect(m.wordsPracticed).toBe(5);
    const lines = ins.summarize(st, m, now);
    expect(lines[0]).toMatch(/This week Maria practised 5 English words/);
    const report = ins.weeklyReport(st, now, 'ar');
    expect(report.headline).toContain('Maria');
    expect(report.newVocabulary.length).toBe(5);
  });
});

describe('product analytics', () => {
  it('computes DAU/retention/completion from pseudonymous events', () => {
    const now = new Date('2026-03-10T12:00:00Z');
    const ev = (id: string, name: string, daysAgo: number) => ({ subjectId: id, subjectKind: 'child' as const, name, props: {}, at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), platform: 'web' });
    const m = computeProductMetrics([ev('a', 'journey_start', 0), ev('a', 'journey_complete', 0), ev('b', 'journey_start', 2), ev('a', 'app_open', 1), ev('a', 'app_open', 2)], now);
    expect(m.dau).toBe(1);
    expect(m.wau).toBe(2);
    expect(m.journeyCompletion).toBe(50);
  });
});
