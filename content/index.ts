import type { LearningLanguage } from '@/types/core';
import type { ContentBundle, GameTemplate, Lexeme } from '@/types/content';
import { buildFromRows } from './lexicon/dsl';
import { LEXICON_ROWS } from './lexicon/rows';
import { buildPhrases } from './phrases';
import { ACHIEVEMENTS, CHARACTERS, GAMES, GRAMMAR_PATTERNS, REWARDS, STAGES, WORLDS } from './world';
import { ARCS, EPISODES } from './story';
import { BOOKS, ROLEPLAYS, SONGS } from './library';
import { buildCurriculum } from './curriculum';
import { buildTracks } from './tracks';
import type { AgeBand } from '@/types/core';
import type { TrackDefinition } from '@/types/content';

function buildGameTemplates(): GameTemplate[] {
  return GAMES.flatMap((g) =>
    ([1, 3, 5] as const).map((difficulty) => ({
      id: `tpl.${g.type}.d${difficulty}`,
      type: g.type,
      name: g.name,
      topics: 'any' as const,
      difficulty,
      learningSkill: g.skills[0]!,
      successRules: { minCorrectRatio: difficulty === 1 ? 0.5 : difficulty === 3 ? 0.6 : 0.7 },
      scoring: { starsAt: [0.4, 0.7, 0.95] as [number, number, number] },
      hints: difficulty === 1 ? ['slow-audio', 'show-image', 'fewer-distractors'] : difficulty === 3 ? ['slow-audio', 'first-sound'] : ['slow-audio'],
      ageBands: g.ageBands,
      status: 'published' as const,
    })),
  );
}

let cached: ContentBundle | null = null;

/** The seed content bundle. In Supabase mode the CMS-published bundle replaces this at runtime. */
export function getSeedContent(): ContentBundle {
  if (cached) return cached;
  const { concepts, lexemes } = buildFromRows(LEXICON_ROWS);
  const phrases = buildPhrases();
  const units = buildCurriculum(concepts, phrases);
  cached = {
    version: 'seed-2026.10.2',
    concepts,
    lexemes,
    phrases,
    grammarPatterns: GRAMMAR_PATTERNS,
    stages: STAGES,
    units,
    characters: CHARACTERS,
    worlds: WORLDS,
    arcs: ARCS,
    episodes: EPISODES,
    games: GAMES,
    gameTemplates: buildGameTemplates(),
    books: BOOKS,
    songs: SONGS,
    rewards: REWARDS,
    achievements: ACHIEVEMENTS,
    roleplays: ROLEPLAYS,
    tracks: buildTracks(units),
  };
  return cached;
}

/** Fast lookup indexes over a bundle. Built once per bundle version. */
export class ContentIndex {
  readonly concepts = new Map<string, ContentBundle['concepts'][number]>();
  readonly lexemes = new Map<string, Lexeme>();
  readonly phrases = new Map<string, ContentBundle['phrases'][number]>();
  readonly episodes = new Map<string, ContentBundle['episodes'][number]>();
  readonly units = new Map<string, ContentBundle['units'][number]>();
  readonly worlds = new Map<string, ContentBundle['worlds'][number]>();
  readonly rewards = new Map<string, ContentBundle['rewards'][number]>();
  readonly books = new Map<string, ContentBundle['books'][number]>();
  readonly games = new Map<string, ContentBundle['games'][number]>();
  readonly tracks = new Map<string, TrackDefinition>();

  constructor(readonly bundle: ContentBundle) {
    for (const c of bundle.concepts) this.concepts.set(c.id, c);
    for (const l of bundle.lexemes) this.lexemes.set(`${l.language}:${l.conceptId}`, l);
    for (const p of bundle.phrases) this.phrases.set(`${p.language}:${p.id}`, p);
    for (const e of bundle.episodes) this.episodes.set(e.id, e);
    // Bundles published before tracks existed get the built-in track definitions.
    for (const t of bundle.tracks?.length ? bundle.tracks : buildTracks(bundle.units)) this.tracks.set(t.id, t);
    for (const u of bundle.units) this.units.set(u.id, u);
    for (const w of bundle.worlds) this.worlds.set(w.id, w);
    for (const r of bundle.rewards) this.rewards.set(r.id, r);
    for (const b of bundle.books) this.books.set(b.id, b);
    for (const g of bundle.games) this.games.set(g.type, g);
  }

  get(conceptId: string, language: LearningLanguage): Lexeme | undefined {
    return this.lexemes.get(`${language}:${conceptId}`);
  }

  /** The child's learning track (falls back to the Adventurers track). */
  track(id: AgeBand | undefined): TrackDefinition {
    return this.tracks.get(id ?? 'adventurer') ?? this.tracks.get('adventurer')!;
  }

  isMass(conceptId: string): boolean {
    return this.concepts.get(conceptId)?.tags.includes('mass') ?? false;
  }

  phrase(id: string, language: LearningLanguage) {
    return this.phrases.get(`${language}:${id}`);
  }

  conceptsForTopic(topic: string) {
    return this.bundle.concepts.filter((c) => c.topic === topic);
  }

  unitsInOrder() {
    return [...this.bundle.units].sort((a, b) => a.stage - b.stage || a.order - b.order);
  }
}

let cachedIndex: ContentIndex | null = null;
export function getContentIndex(): ContentIndex {
  if (!cachedIndex) cachedIndex = new ContentIndex(getSeedContent());
  return cachedIndex;
}

/** Swap the active bundle (used when a CMS-published bundle is fetched or edited in local admin). */
export function setActiveContent(bundle: ContentBundle): ContentIndex {
  cached = bundle;
  cachedIndex = new ContentIndex(bundle);
  return cachedIndex;
}
