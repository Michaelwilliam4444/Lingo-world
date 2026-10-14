import type { ContentBundle } from '@/types/content';
import type { ContentStatus } from '@/types/core';

/**
 * Admin entity registry: how each content type is listed, identified, previewed and validated.
 * Every type maps onto one array in the ContentBundle; publishing compiles the draft into a versioned bundle.
 */
export type EntityType =
  | 'concepts' | 'lexemes' | 'phrases' | 'units' | 'worlds' | 'arcs' | 'episodes' | 'characters' | 'games' | 'gameTemplates'
  | 'rewards' | 'achievements' | 'books' | 'songs' | 'roleplays' | 'grammarPatterns' | 'stages' | 'tracks';

export interface EntityDef {
  type: EntityType;
  label: string;
  key: (e: Record<string, unknown>) => string;
  title: (e: Record<string, unknown>) => string;
  hasStatus: boolean;
  /** Skeleton for "New" */
  blank: () => Record<string, unknown>;
  group: 'Language' | 'Curriculum' | 'Story & world' | 'Play' | 'Library';
}

const en = (v: unknown) => (v && typeof v === 'object' && 'en' in (v as object) ? String((v as { en: string }).en) : '');

export const ENTITIES: EntityDef[] = [
  { type: 'concepts', label: 'Vocabulary', group: 'Language', key: (e) => String(e.id), title: (e) => `${e.image} ${e.id}`, hasStatus: false,
    blank: () => ({ id: 'topic.new_word', topic: 'animals', wordClass: 'noun', image: '❓', difficulty: 1, ageBands: ['little', 'adventurer', 'hero'], cefr: 'preA1', stage: 1, tags: [] }) },
  { type: 'lexemes', label: 'Translations of words', group: 'Language', key: (e) => `${e.language}:${e.conceptId}`, title: (e) => `${e.language} · ${e.conceptId} → ${e.text}`, hasStatus: false,
    blank: () => ({ conceptId: 'topic.new_word', language: 'en', text: '' }) },
  { type: 'phrases', label: 'Phrases', group: 'Language', key: (e) => `${e.language}:${e.id}`, title: (e) => `${e.language} · ${e.text}`, hasStatus: false,
    blank: () => ({ id: 'topic.new_phrase', language: 'en', text: '', gloss: { en: '' }, topic: 'greetings', conceptIds: [], cefr: 'preA1', stage: 1 }) },
  { type: 'grammarPatterns', label: 'Grammar patterns', group: 'Language', key: (e) => String(e.id), title: (e) => en(e.name), hasStatus: false,
    blank: () => ({ id: 'new-pattern', name: { en: '' }, description: { en: '' }, cefr: 'A1', stage: 3, template: 'np' }) },
  { type: 'stages', label: 'Curriculum levels', group: 'Curriculum', key: (e) => String(e.stage), title: (e) => `${e.stage}. ${en(e.name)}`, hasStatus: false,
    blank: () => ({ stage: 6, name: { en: '' }, cefr: 'A2', targetCumulativeWords: 0, description: { en: '' } }) },
  { type: 'tracks', label: 'Age tracks', group: 'Curriculum', key: (e) => String(e.id), title: (e) => `${e.emoji} ${en(e.name)}`, hasStatus: false,
    blank: () => ({ id: 'adventurer', emoji: '🗝️', color: '#2ec4b6', name: { en: '' }, ages: { min: 6, max: 8 }, tagline: { en: '' }, description: { en: '' }, stages: [1, 2, 3, 4], unitIds: [], arcIds: [], gameTypes: [],
      dailyMinutes: { min: 12, max: 15 }, newItemsPerDay: 4, maxGamesPerJourney: 3, reviewItemsPerJourney: 6,
      features: { reading: true, writing: false, reviewSentences: true, storyCreator: true, freeSpeechRoleplay: false, showTargetText: true },
      navigation: ['adventure', 'explore', 'play', 'create', 'mimo'], skillsFocus: [], graduation: { wordsMastered: 350, nextTrack: 'hero' } }) },
  { type: 'units', label: 'Curriculum units', group: 'Curriculum', key: (e) => String(e.id), title: (e) => `S${e.stage} · ${en(e.title)}`, hasStatus: false,
    blank: () => ({ id: 'u1-new-1', stage: 1, order: 99, topic: 'animals', title: { en: '' }, skills: ['listening', 'speaking'], conceptIds: [], phraseIds: [], grammarPatternIds: [], goals: {}, prerequisites: [], masteryThreshold: 60, ageBands: ['little', 'adventurer', 'hero'], version: 1 }) },
  { type: 'worlds', label: 'Worlds', group: 'Story & world', key: (e) => String(e.id), title: (e) => `${e.emoji} ${en(e.name)}`, hasStatus: false,
    blank: () => ({ id: 'new-world', order: 99, name: { en: '' }, emoji: '🌍', palette: ['#3b3190', '#1b1446'], topics: [], stage: 1, unlock: { type: 'start' }, premium: false, hiddenItems: [], landmarks: [], ambient: [] }) },
  { type: 'arcs', label: 'Story arcs', group: 'Story & world', key: (e) => String(e.id), title: (e) => en(e.title), hasStatus: true,
    blank: () => ({ id: 'new-arc', title: { en: '' }, description: { en: '' }, season: null, worldIds: [], episodeIds: [], premium: false, status: 'draft' }) },
  { type: 'episodes', label: 'Journeys (episodes & scenes)', group: 'Story & world', key: (e) => String(e.id), title: (e) => `${e.id} · ${en(e.title)}`, hasStatus: true,
    blank: () => ({ id: 'new-episode-01', arcId: 'golden-key', order: 99, worldId: 'my-home', title: { en: '' }, summary: { en: '' }, topics: [], beats: [], rewardIds: [], minStage: 1, status: 'draft', version: 1 }) },
  { type: 'characters', label: 'Characters', group: 'Story & world', key: (e) => String(e.id), title: (e) => `${e.emoji} ${e.name}`, hasStatus: false,
    blank: () => ({ id: 'lumi', name: '', role: { en: '' }, traits: [], emoji: '🙂', color: 'sunrise', voice: { pitch: 1, rate: 1 } }) },
  { type: 'games', label: 'Game types', group: 'Play', key: (e) => String(e.type), title: (e) => `${e.emoji} ${en(e.name)}`, hasStatus: false,
    blank: () => ({ type: 'picture-hunt', name: { en: '' }, emoji: '🎲', family: 'listening', skills: [], evidence: [], ageBands: [], minStage: 1, needsMicrophone: false, needsReading: false, itemsByDifficulty: [4, 5, 6, 7, 8], premium: false }) },
  { type: 'gameTemplates', label: 'Game configuration', group: 'Play', key: (e) => String(e.id), title: (e) => String(e.id), hasStatus: true,
    blank: () => ({ id: 'tpl.new', type: 'picture-hunt', name: { en: '' }, topics: 'any', difficulty: 1, learningSkill: 'listening', successRules: { minCorrectRatio: 0.6 }, scoring: { starsAt: [0.4, 0.7, 0.95] }, hints: [], ageBands: ['little'], status: 'draft' }) },
  { type: 'rewards', label: 'Rewards', group: 'Play', key: (e) => String(e.id), title: (e) => `${e.emoji} ${en(e.name)}`, hasStatus: false,
    blank: () => ({ id: 'sticker.new', kind: 'sticker', name: { en: '' }, emoji: '⭐', premium: false }) },
  { type: 'achievements', label: 'Achievements', group: 'Play', key: (e) => String(e.id), title: (e) => `${e.emoji} ${en(e.name)}`, hasStatus: false,
    blank: () => ({ id: 'new-achievement', name: { en: '' }, description: { en: '' }, emoji: '🏆', rule: { type: 'wordsPracticed', count: 10 } }) },
  { type: 'books', label: 'Books', group: 'Library', key: (e) => String(e.id), title: (e) => `${e.coverEmoji} ${en(e.title)}`, hasStatus: true,
    blank: () => ({ id: 'book.new', title: { en: '' }, coverEmoji: '📘', worldId: 'my-home', topic: 'animals', ageBands: ['little', 'adventurer'], stage: 1, pages: [], quiz: [], premium: false, status: 'draft' }) },
  { type: 'songs', label: 'Songs & rhymes', group: 'Library', key: (e) => String(e.id), title: (e) => `${e.emoji} ${en(e.title)}`, hasStatus: false,
    blank: () => ({ id: 'song.new', title: { en: '' }, emoji: '🎵', kind: 'song', topic: 'greetings', lines: [], bpm: 100, premium: false }) },
  { type: 'roleplays', label: 'Role-plays', group: 'Library', key: (e) => String(e.id), title: (e) => `${e.emoji} ${en(e.title)}`, hasStatus: false,
    blank: () => ({ id: 'rp.new', title: { en: '' }, emoji: '🎭', topic: 'greetings', partner: 'lumi', minStage: 1, turns: [] }) },
];

export function entityDef(type: string): EntityDef | undefined {
  return ENTITIES.find((e) => e.type === type);
}

export function listEntities(bundle: ContentBundle, type: EntityType): Record<string, unknown>[] {
  return bundle[type] as unknown as Record<string, unknown>[];
}

export function upsertEntity(bundle: ContentBundle, type: EntityType, entity: Record<string, unknown>, originalKey?: string): ContentBundle {
  const def = entityDef(type)!;
  const list = listEntities(bundle, type);
  const k = originalKey ?? def.key(entity);
  const idx = list.findIndex((e) => def.key(e) === k);
  const next = idx >= 0 ? list.map((e, i) => (i === idx ? entity : e)) : [...list, entity];
  return { ...bundle, [type]: next };
}

export function removeEntity(bundle: ContentBundle, type: EntityType, key: string): ContentBundle {
  const def = entityDef(type)!;
  return { ...bundle, [type]: listEntities(bundle, type).filter((e) => def.key(e) !== key) };
}

export function setStatus(bundle: ContentBundle, type: EntityType, key: string, status: ContentStatus): ContentBundle {
  const def = entityDef(type)!;
  return { ...bundle, [type]: listEntities(bundle, type).map((e) => (def.key(e) === key ? { ...e, status } : e)) };
}

/** Narrative/UI texts missing a translation in a locale — fed to the translation manager. */
export function missingTranslations(bundle: ContentBundle, locale: string): { where: string; path: string; en: string }[] {
  const out: { where: string; path: string; en: string }[] = [];
  const visit = (v: unknown, where: string, path: string) => {
    if (!v || typeof v !== 'object') return;
    if ('en' in (v as object) && typeof (v as { en: unknown }).en === 'string' && Object.keys(v as object).every((k) => k.length <= 3)) {
      if (!(v as Record<string, string>)[locale]) out.push({ where, path, en: (v as { en: string }).en });
      return;
    }
    if (Array.isArray(v)) v.forEach((x, i) => visit(x, where, `${path}[${i}]`));
    else for (const [k, x] of Object.entries(v as object)) visit(x, where, path ? `${path}.${k}` : k);
  };
  for (const type of ['tracks', 'worlds', 'arcs', 'episodes', 'books', 'songs', 'roleplays', 'rewards', 'achievements', 'units', 'stages'] as EntityType[]) {
    const def = entityDef(type)!;
    for (const e of listEntities(bundle, type)) visit(e, `${type}/${def.key(e)}`, '');
  }
  return out;
}

/** Set a translated string at a dotted/indexed path inside an entity (immutable). */
export function setAtPath(obj: unknown, path: string, value: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  const rec = (o: unknown, i: number): unknown => {
    if (i === parts.length) return value;
    const k = parts[i]!;
    if (Array.isArray(o)) return o.map((x, j) => (String(j) === k ? rec(x, i + 1) : x));
    return { ...(o as object), [k]: rec((o as Record<string, unknown>)[k], i + 1) };
  };
  return rec(obj, 0);
}
