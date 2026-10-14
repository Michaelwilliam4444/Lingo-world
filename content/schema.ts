import { z } from 'zod';
import { LEARNING_LANGUAGES, AGE_BANDS, GAME_TYPES } from '@/types/core';
import { TOPICS, type ContentBundle } from '@/types/content';
import { GrammarRealizer, type PatternId } from '@/curriculum/grammar';
import { ContentIndex } from './index';

/** Zod schemas used by the CMS (create/edit/import) and the content validation script. */
const localized = z.object({ en: z.string().min(1) }).catchall(z.string());
const stage = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]);

export const ConceptSchema = z.object({
  id: z.string().regex(/^[a-z_]+\.[a-z0-9_]+$/),
  topic: z.enum(TOPICS),
  wordClass: z.enum(['noun', 'adjective', 'verb', 'number', 'expression', 'preposition', 'adverb', 'question']),
  image: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  ageBands: z.array(z.enum(AGE_BANDS)).min(1),
  cefr: z.enum(['preA1', 'A1', 'A2']),
  stage,
  tags: z.array(z.string()),
  confusableWith: z.array(z.string()).optional(),
});

export const LexemeSchema = z.object({
  conceptId: z.string(),
  language: z.enum(LEARNING_LANGUAGES),
  text: z.string().min(1),
  gender: z.enum(['m', 'f', 'n']).optional(),
  plural: z.string().optional(),
  forms: z.object({ m: z.string().optional(), f: z.string().optional(), n: z.string().optional() }).optional(),
  articleOverride: z.object({ def: z.string().optional(), indef: z.string().optional() }).optional(),
  invariable: z.boolean().optional(),
  preNominal: z.boolean().optional(),
  mVowelForm: z.string().optional(),
  obliqueForm: z.string().optional(),
  variants: z.array(z.string()).optional(),
  syllables: z.array(z.string()).optional(),
  phonemeFocus: z.array(z.string()).optional(),
  audio: z.string().optional(),
  slowAudio: z.string().optional(),
});

export const PhraseSchema = z.object({
  id: z.string(),
  language: z.enum(LEARNING_LANGUAGES),
  text: z.string().min(1),
  gloss: localized,
  topic: z.enum(TOPICS),
  conceptIds: z.array(z.string()),
  cefr: z.enum(['preA1', 'A1', 'A2']),
  stage,
  acceptedVariants: z.array(z.string()).optional(),
});

export const BookSchema = z.object({
  id: z.string(),
  title: localized,
  coverEmoji: z.string(),
  worldId: z.string(),
  topic: z.enum(TOPICS),
  ageBands: z.array(z.enum(AGE_BANDS)),
  stage,
  pages: z.array(z.object({ emoji: z.string(), sentence: z.union([z.object({ phraseId: z.string() }), z.object({ template: z.string(), slots: z.record(z.string()) })]) })).min(1),
  premium: z.boolean(),
  status: z.enum(['draft', 'review', 'published', 'archived']),
});

export const GameTemplateSchema = z.object({
  id: z.string(),
  type: z.enum(GAME_TYPES),
  difficulty: z.number().int().min(1).max(5),
  successRules: z.object({ minCorrectRatio: z.number().min(0).max(1) }),
});

export interface ValidationIssue { severity: 'error' | 'warning'; where: string; message: string }

/** Renders a book/song line's sentence (shared by validator, library reader and music area). */
export function renderTemplateSentence(
  realizer: GrammarRealizer, language: (typeof LEARNING_LANGUAGES)[number], template: string, slots: Record<string, string>,
): string {
  if (template === 'word') return realizer.word(slots.noun!, language);
  const subject = { noun: slots.noun!, adjectives: slots.adj ? slots.adj.split(',') : undefined };
  return realizer.realize(language, template as PatternId, {
    subject,
    prep: slots.prep,
    object: slots.object ? { noun: slots.object } : undefined,
    predicate: slots.predicate,
  });
}

/**
 * Referential + linguistic validation of a whole bundle. Run by `npm run content:validate`,
 * by unit tests, and by the CMS before publishing.
 */
export function validateBundle(bundle: ContentBundle): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (where: string, message: string) => issues.push({ severity: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ severity: 'warning', where, message });
  const idx = new ContentIndex(bundle);
  const realizer = new GrammarRealizer(idx);

  for (const c of bundle.concepts) {
    const r = ConceptSchema.safeParse(c);
    if (!r.success) err(`concept ${c.id}`, r.error.issues.map((i) => i.message).join('; '));
    for (const lang of LEARNING_LANGUAGES) {
      const lex = idx.get(c.id, lang);
      if (!lex) { err(`concept ${c.id}`, `missing ${lang} lexeme`); continue; }
      if (c.wordClass === 'noun' && lang !== 'en' && !lex.gender) err(`lexeme ${lang}:${c.id}`, 'noun without gender');
      if (c.wordClass === 'adjective' && lang !== 'en' && lang !== 'de' && !lex.invariable && !lex.forms) warn(`lexeme ${lang}:${c.id}`, 'adjective without forms');
    }
    for (const conf of c.confusableWith ?? []) if (!idx.concepts.has(conf)) err(`concept ${c.id}`, `unknown confusable ${conf}`);
  }
  for (const l of bundle.lexemes) {
    const r = LexemeSchema.safeParse(l);
    if (!r.success) err(`lexeme ${l.language}:${l.conceptId}`, r.error.issues.map((i) => i.message).join('; '));
  }
  const phraseIds = new Set(bundle.phrases.map((p) => p.id));
  for (const id of phraseIds) {
    for (const lang of LEARNING_LANGUAGES) if (!idx.phrase(id, lang)) err(`phrase ${id}`, `missing ${lang}`);
  }
  for (const p of bundle.phrases) {
    for (const c of p.conceptIds) if (!idx.concepts.has(c)) err(`phrase ${p.id}`, `unknown concept ${c}`);
  }
  for (const u of bundle.units) {
    for (const c of u.conceptIds) if (!idx.concepts.has(c)) err(`unit ${u.id}`, `unknown concept ${c}`);
    for (const p of u.phraseIds) if (!phraseIds.has(p)) err(`unit ${u.id}`, `unknown phrase ${p}`);
    for (const pre of u.prerequisites) if (!idx.units.has(pre)) err(`unit ${u.id}`, `unknown prerequisite ${pre}`);
  }
  // Tracks: one per age band, every reference resolvable, sensible pacing and a non-empty syllabus/season/game set.
  const trackIds = new Set((bundle.tracks ?? []).map((t) => t.id));
  for (const band of ['little', 'adventurer', 'hero'] as const) if (!trackIds.has(band)) err('tracks', `missing track ${band}`);
  const gameTypes = new Set(bundle.games.map((g) => g.type));
  const arcIds = new Set(bundle.arcs.map((a) => a.id));
  for (const t of bundle.tracks ?? []) {
    const w = `track ${t.id}`;
    if (!t.unitIds.length) err(w, 'empty syllabus');
    for (const u of t.unitIds) if (!idx.units.has(u)) err(w, `unknown unit ${u}`);
    if (!t.arcIds.length) err(w, 'no story seasons');
    for (const a of t.arcIds) if (!arcIds.has(a)) err(w, `unknown arc ${a}`);
    if (!t.gameTypes.length) err(w, 'no games');
    for (const g of t.gameTypes) if (!gameTypes.has(g)) err(w, `unknown game ${g}`);
    if (t.maxGamesPerJourney < 1 || t.newItemsPerDay < 1) err(w, 'pacing must be at least 1');
    if (t.ages.min > t.ages.max) err(w, 'ages min > max');
    if (t.navigation.length < 3 || t.navigation.length > 5) warn(w, 'navigation should have 3–5 items');
    if (!t.navigation.includes('adventure')) err(w, 'navigation must include the daily adventure');
    if (t.graduation.nextTrack && !trackIds.has(t.graduation.nextTrack)) err(w, `unknown next track ${t.graduation.nextTrack}`);
  }
  for (const e of bundle.episodes) {
    if (!idx.worlds.has(e.worldId)) err(`episode ${e.id}`, `unknown world ${e.worldId}`);
    for (const r of e.rewardIds) if (!idx.rewards.has(r)) err(`episode ${e.id}`, `unknown reward ${r}`);
    for (const b of e.beats) {
      for (const line of [...b.lines, ...(b.memoryCallbacks ?? []).map((m) => m.line)]) {
        if (line.target && 'phraseId' in line.target && !phraseIds.has(line.target.phraseId)) err(`beat ${b.id}`, `unknown phrase ${line.target.phraseId}`);
      }
    }
  }
  for (const a of bundle.arcs) for (const e of a.episodeIds) if (!idx.episodes.has(e)) err(`arc ${a.id}`, `unknown episode ${e}`);
  for (const w of bundle.worlds) {
    for (const h of w.hiddenItems) if (!idx.concepts.has(h.conceptId)) err(`world ${w.id}`, `unknown hidden item ${h.conceptId}`);
    if (w.unlock.type === 'episodes' && !bundle.arcs.some((a) => a.id === (w.unlock as { arcId: string }).arcId)) err(`world ${w.id}`, 'unlock arc missing');
  }
  const renderLines = (where: string, lines: ({ phraseId: string } | { template: string; slots: Record<string, string> })[]) => {
    for (const s of lines) {
      if ('phraseId' in s) { if (!phraseIds.has(s.phraseId)) err(where, `unknown phrase ${s.phraseId}`); continue; }
      for (const lang of LEARNING_LANGUAGES) {
        try { renderTemplateSentence(realizer, lang, s.template, s.slots); } catch (e) { err(where, `${lang}: ${(e as Error).message}`); }
      }
    }
  };
  for (const b of bundle.books) {
    const r = BookSchema.safeParse(b);
    if (!r.success) err(`book ${b.id}`, r.error.issues.map((i) => i.message).join('; '));
    renderLines(`book ${b.id}`, b.pages.map((p) => p.sentence));
    for (const q of b.quiz) for (const c of [q.answerConceptId, ...q.optionConceptIds]) if (!idx.concepts.has(c)) err(`book ${b.id}`, `quiz unknown concept ${c}`);
  }
  for (const s of bundle.songs) renderLines(`song ${s.id}`, s.lines);
  for (const rp of bundle.roleplays) for (const t of rp.turns) for (const id of [t.partnerPhraseId, ...t.replyPhraseIds]) if (!phraseIds.has(id)) err(`roleplay ${rp.id}`, `unknown phrase ${id}`);
  for (const t of bundle.gameTemplates) {
    const r = GameTemplateSchema.safeParse(t);
    if (!r.success) err(`template ${t.id}`, r.error.issues.map((i) => i.message).join('; '));
  }
  return issues;
}
