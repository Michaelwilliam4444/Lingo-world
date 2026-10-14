import type { AgeBand, CefrLevel, LearningLanguage, StageNumber } from '@/types/core';
import type { Concept, Lexeme, TopicId, WordClass } from '@/types/content';

/**
 * Compact authoring DSL for the seed lexicon. One row = one concept in all five languages.
 *
 *   "Apfel/m"                   noun with gender
 *   "rosso|rossa"               adjective masculine|feminine
 *   "lila!"                     invariable adjective
 *   "joli|jolie;pre"            French pre-nominal adjective
 *   "nouveau|nouvelle;pre;mv=nouvel"
 *   "Elefant/m;obl=Elefanten"   German weak noun oblique form
 *   "hibou/m;def=le hibou"      article overrides (def= / indef=)
 *   "jugo/m;alt=zumo"           accepted speech variants (comma separated)
 *
 * The CMS stores the parsed Lexeme objects; the DSL exists only to keep seed files reviewable.
 */
export type Row = [
  id: string,
  image: string,
  wordClass: WordClass,
  stage: StageNumber,
  words: Record<LearningLanguage, string>,
  extra?: { confusable?: string[]; tags?: string[]; difficulty?: 1 | 2 | 3 | 4 | 5 },
];

/** Uncountable nouns: the realizer never pairs them with an indefinite article ("a water"). */
export const MASS_NOUNS = new Set([
  'food.water', 'food.milk', 'food.bread', 'food.rice', 'food.juice', 'food.soup', 'food.cheese', 'food.ice_cream',
  'nature.sand', 'nature.grass', 'shopping.money', 'hobbies.music', 'weather.rain', 'weather.snow', 'weather.wind',
  'school.paper', 'sports.swimming', 'sports.tennis', 'sports.football', 'sports.basketball', 'food.grapes', 'clothing.glasses',
]);

const CEFR_BY_STAGE: Record<StageNumber, CefrLevel> = { 1: 'preA1', 2: 'preA1', 3: 'A1', 4: 'A1', 5: 'A2', 6: 'A2' };

export function ageBandsForStage(stage: StageNumber): AgeBand[] {
  if (stage <= 2) return ['little', 'adventurer', 'hero'];
  if (stage === 3) return ['little', 'adventurer', 'hero'];
  if (stage === 4) return ['adventurer', 'hero'];
  return ['hero'];
}

export function parseLexeme(conceptId: string, language: LearningLanguage, spec: string): Lexeme {
  const [main = '', ...opts] = spec.split(';');
  const lex: Lexeme = { conceptId, language, text: main };

  if (main.includes('/')) {
    const [text, g] = main.split('/');
    lex.text = text!;
    if (g === 'm' || g === 'f' || g === 'n') lex.gender = g;
  } else if (main.includes('|')) {
    const [m, f] = main.split('|');
    lex.text = m!;
    lex.forms = { m: m!, f: f! };
  } else if (main.endsWith('!')) {
    lex.text = main.slice(0, -1);
    lex.invariable = true;
  }

  for (const opt of opts) {
    const [key, value = ''] = opt.split('=');
    switch (key) {
      case 'def': lex.articleOverride = { ...lex.articleOverride, def: value }; break;
      case 'indef': lex.articleOverride = { ...lex.articleOverride, indef: value }; break;
      case 'pre': lex.preNominal = true; break;
      case 'mv': lex.mVowelForm = value; break;
      case 'obl': lex.obliqueForm = value; break;
      case 'alt': lex.variants = value.split(',').map((v) => v.trim()).filter(Boolean); break;
      case 'pl': lex.plural = value; break;
      default: throw new Error(`Unknown lexicon option "${key}" in ${conceptId}/${language}`);
    }
  }
  lex.syllables = naiveSyllables(lex.text, language);
  return lex;
}

export function buildFromRows(rows: Row[]): { concepts: Concept[]; lexemes: Lexeme[] } {
  const concepts: Concept[] = [];
  const lexemes: Lexeme[] = [];
  const seen = new Set<string>();
  for (const [id, image, wordClass, stage, words, extra] of rows) {
    if (seen.has(id)) throw new Error(`Duplicate concept id ${id}`);
    seen.add(id);
    const topic = id.split('.')[0] as TopicId;
    const enLen = words.en.length;
    const difficulty = extra?.difficulty ?? (Math.min(5, Math.max(1, Math.ceil(stage / 1.5) + (enLen > 8 ? 1 : 0))) as 1 | 2 | 3 | 4 | 5);
    concepts.push({
      id,
      topic,
      wordClass,
      image,
      difficulty,
      ageBands: ageBandsForStage(stage),
      cefr: CEFR_BY_STAGE[stage],
      stage,
      tags: [...(extra?.tags ?? []), ...(MASS_NOUNS.has(id) ? ['mass'] : [])],
      confusableWith: extra?.confusable,
    });
    for (const lang of Object.keys(words) as LearningLanguage[]) {
      lexemes.push(parseLexeme(id, lang, words[lang]));
    }
  }
  return { concepts, lexemes };
}

/**
 * Approximate syllable split used for "syllable-separated" slow playback and visual chunking.
 * Human-authored syllables (CMS) override this. Deliberately simple: vowel-group nuclei.
 */
export function naiveSyllables(text: string, language: LearningLanguage): string[] {
  const vowels = language === 'de' ? 'aeiouyäöüAEIOUYÄÖÜ' : 'aeiouyàâéèêëîïôûùüáíóúñAEIOUYÉÈÁÍÓÚ';
  const words = text.split(/\s+/);
  const out: string[] = [];
  for (const word of words) {
    const parts: string[] = [];
    let current = '';
    for (let i = 0; i < word.length; i++) {
      const ch = word[i]!;
      current += ch;
      const isVowel = vowels.includes(ch);
      const next = word[i + 1];
      const nextNext = word[i + 2];
      if (isVowel && next && !vowels.includes(next) && nextNext && vowels.includes(nextNext)) {
        parts.push(current);
        current = '';
      }
    }
    if (current) {
      if (parts.length && !/[aeiouyàâéèêëîïôûùüáíóúäö]/i.test(current)) parts[parts.length - 1] += current;
      else parts.push(current);
    }
    out.push(...parts);
  }
  return out.length ? out : [text];
}
