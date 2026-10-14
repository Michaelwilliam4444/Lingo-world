import { describe, expect, it } from 'vitest';
import { getSeedContent } from '@/content';
import { validateBundle } from '@/content/schema';
import { LEARNING_LANGUAGES } from '@/types/core';

describe('seed content', () => {
  const bundle = getSeedContent();
  it('validates with zero errors', () => {
    const errors = validateBundle(bundle).filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });
  it('covers every concept in all five languages', () => {
    for (const lang of LEARNING_LANGUAGES) expect(bundle.lexemes.filter((l) => l.language === lang).length).toBe(bundle.concepts.length);
  });
  it('has the 20 initial worlds, 30 game types and a 12-episode Season 1', () => {
    expect(bundle.worlds).toHaveLength(20);
    expect(bundle.games).toHaveLength(30);
    expect(bundle.arcs.find((a) => a.id === 'golden-key')!.episodeIds).toHaveLength(12);
  });
  it('covers the required foundational topics', () => {
    const topics = new Set(bundle.concepts.map((c) => c.topic));
    for (const t of ['greetings', 'numbers', 'colors', 'family', 'home', 'food', 'animals', 'body', 'clothing', 'school', 'toys', 'weather', 'feelings', 'routine', 'directions', 'transport', 'nature', 'sports', 'hobbies', 'travel', 'shopping', 'restaurant', 'time', 'calendar', 'questions', 'actions', 'descriptions']) {
      expect(topics.has(t as never), t).toBe(true);
    }
  });
  it('builds a prerequisite chain through all six stages', () => {
    const stages = new Set(bundle.units.map((u) => u.stage));
    expect([...stages].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(bundle.units.filter((u) => u.prerequisites.length === 0)).toHaveLength(1);
  });
});
