import type { Gender, LearningLanguage } from '@/types/core';
import type { Lexeme } from '@/types/content';

/**
 * Deterministic, rule-based grammar realizer.
 *
 * The engines never ask an LLM to produce target-language sentences that children learn from.
 * Instead they choose a pattern + concepts, and this module renders a grammatical sentence for
 * each language (articles, elision, gender/number agreement, German case endings, contractions).
 *
 * Coverage is intentionally limited to the patterns the curriculum uses at Pre-A1..A2.
 */

export type Det = 'def' | 'indef' | 'none';
export type GermanCase = 'nom' | 'acc' | 'dat';

export interface LexiconLookup {
  get(conceptId: string, language: LearningLanguage): Lexeme | undefined;
  /** Uncountable nouns get a definite article where an indefinite one would be ungrammatical. */
  isMass?(conceptId: string): boolean;
}

export interface NounPhraseSpec {
  noun: string;              // concept id
  adjectives?: string[];     // concept ids
  det?: Det;
}

export type PatternId = 'np' | 'this-is' | 'i-see' | 'i-have' | 'give-me' | 'where-is' | 'location' | 'is-adjective';

export interface PatternSlots {
  subject: NounPhraseSpec;
  prep?: string;             // preposition concept id (location)
  object?: NounPhraseSpec;   // location object
  predicate?: string;        // adjective concept id (is-adjective)
}

const VOWEL_START = /^[aeiouàâäéèêëîïôöûùüáíóúœæh]/i;
const EN_VOWEL_SOUND = /^[aeiou]/i;
const EN_A_EXCEPTIONS = /^(uni|use|usu|eu|one|once)/i;
const EN_AN_EXCEPTIONS = /^(hour|honest|honou?r|heir)/i;

/** Adjective ordering: size/opinion first, then age/shape, then colour (English and German). */
function adjectiveRank(conceptId: string): number {
  if (conceptId.startsWith('colors.')) return 3;
  if (/descriptions\.(round|new|old)/.test(conceptId)) return 2;
  if (/descriptions\.(big|small|long|short)/.test(conceptId)) return 1;
  return 0;
}

export class GrammarRealizer {
  constructor(private readonly lexicon: LexiconLookup) {}

  private lex(conceptId: string, language: LearningLanguage): Lexeme {
    const l = this.lexicon.get(conceptId, language);
    if (!l) throw new Error(`Missing lexeme ${conceptId} for ${language}`);
    return l;
  }

  /** Base text of a word as shown on a picture card (no article). */
  word(conceptId: string, language: LearningLanguage): string {
    return this.lex(conceptId, language).text;
  }

  /** Word with its article, as taught on vocabulary cards ("la pomme", "der Apfel"). */
  cardLabel(conceptId: string, language: LearningLanguage): string {
    const l = this.lex(conceptId, language);
    if (!l.gender || language === 'en') return l.text;
    return this.nounPhrase(language, { noun: conceptId, det: 'def' });
  }

  nounPhrase(language: LearningLanguage, spec: NounPhraseSpec, germanCase: GermanCase = 'nom'): string {
    const noun = this.lex(spec.noun, language);
    let det = spec.det ?? 'indef';
    if (det === 'indef' && this.lexicon.isMass?.(spec.noun)) det = 'def';
    const adjIds = [...(spec.adjectives ?? [])].sort((a, b) => adjectiveRank(a) - adjectiveRank(b));
    const adjs = adjIds.map((id) => this.lex(id, language));
    const gender: Gender = noun.gender ?? 'm';

    switch (language) {
      case 'en': return this.npEnglish(noun, adjs, det);
      case 'de': return this.npGerman(noun, adjs, det, gender, germanCase);
      case 'fr': return this.npRomance('fr', noun, adjs, det, gender);
      case 'it': return this.npRomance('it', noun, adjs, det, gender);
      case 'es': return this.npRomance('es', noun, adjs, det, gender);
    }
  }

  private npEnglish(noun: Lexeme, adjs: Lexeme[], det: Det): string {
    const words = [...adjs.map((a) => a.text), noun.text].join(' ');
    const override = det === 'def' ? noun.articleOverride?.def : det === 'indef' ? noun.articleOverride?.indef : undefined;
    // Overrides that only encode a/an are recomputed so "an apple" becomes "a red apple".
    if (override && !/^(a|an) /i.test(override) && adjs.length === 0) return override;
    if (override && !/^(a|an) /i.test(override) && adjs.length > 0) {
      const lead = override.split(' ')[0];
      return `${lead} ${words}`;
    }
    if (det === 'none') return words;
    if (det === 'def') return `the ${words}`;
    return `${englishIndefinite(words)} ${words}`;
  }

  private npGerman(noun: Lexeme, adjs: Lexeme[], det: Det, g: Gender, c: GermanCase): string {
    const nounText = c !== 'nom' && noun.obliqueForm ? noun.obliqueForm : noun.text;
    if (noun.articleOverride && adjs.length === 0) {
      const o = det === 'def' ? noun.articleOverride.def : noun.articleOverride.indef;
      if (o) return o;
    }
    const DEF: Record<GermanCase, Record<Gender, string>> = {
      nom: { m: 'der', f: 'die', n: 'das' },
      acc: { m: 'den', f: 'die', n: 'das' },
      dat: { m: 'dem', f: 'der', n: 'dem' },
    };
    const INDEF: Record<GermanCase, Record<Gender, string>> = {
      nom: { m: 'ein', f: 'eine', n: 'ein' },
      acc: { m: 'einen', f: 'eine', n: 'ein' },
      dat: { m: 'einem', f: 'einer', n: 'einem' },
    };
    // Weak declension after der/die/das; mixed after ein; strong with no article.
    const WEAK: Record<GermanCase, Record<Gender, string>> = {
      nom: { m: 'e', f: 'e', n: 'e' }, acc: { m: 'en', f: 'e', n: 'e' }, dat: { m: 'en', f: 'en', n: 'en' },
    };
    const MIXED: Record<GermanCase, Record<Gender, string>> = {
      nom: { m: 'er', f: 'e', n: 'es' }, acc: { m: 'en', f: 'e', n: 'es' }, dat: { m: 'en', f: 'en', n: 'en' },
    };
    const STRONG: Record<GermanCase, Record<Gender, string>> = {
      nom: { m: 'er', f: 'e', n: 'es' }, acc: { m: 'en', f: 'e', n: 'es' }, dat: { m: 'em', f: 'er', n: 'em' },
    };
    const table = det === 'def' ? WEAK : det === 'indef' ? MIXED : STRONG;
    const inflected = adjs.map((a) => (a.invariable ? a.text : germanStem(a.text) + table[c][g]));
    const article = det === 'def' ? DEF[c][g] : det === 'indef' ? INDEF[c][g] : '';
    return [article, ...inflected, nounText].filter(Boolean).join(' ');
  }

  private npRomance(lang: 'fr' | 'it' | 'es', noun: Lexeme, adjs: Lexeme[], det: Det, g: Gender): string {
    const gg: 'm' | 'f' = g === 'f' ? 'f' : 'm';
    const pre = adjs.filter((a) => lang === 'fr' && a.preNominal);
    const post = adjs.filter((a) => !(lang === 'fr' && a.preNominal));
    const form = (a: Lexeme, nextWord: string) => {
      if (a.invariable || !a.forms) return a.text;
      if (lang === 'fr' && gg === 'm' && a.mVowelForm && VOWEL_START.test(nextWord)) return a.mVowelForm;
      return (gg === 'f' ? a.forms.f : a.forms.m) ?? a.text;
    };
    const preWords: string[] = [];
    for (let i = 0; i < pre.length; i++) {
      const next = i + 1 < pre.length ? pre[i + 1]!.text : noun.text;
      preWords.push(form(pre[i]!, next));
    }
    const postWords = post.map((a) => form(a, ''));
    const conj = lang === 'fr' ? 'et' : lang === 'it' ? 'e' : 'y';
    const postPart = postWords.length > 1 ? `${postWords.slice(0, -1).join(', ')} ${conj} ${postWords.at(-1)}` : postWords.join('');
    const core = [...preWords, noun.text, postPart].filter(Boolean).join(' ');
    if (det === 'none') return core;

    const firstWord = core.split(' ')[0]!;
    if (noun.articleOverride && preWords.length === 0) {
      const o = det === 'def' ? noun.articleOverride.def : noun.articleOverride.indef;
      if (o) {
        // Override covers "article + noun"; append post-nominal adjectives.
        return postPart ? `${o} ${postPart}` : o;
      }
    }
    const article = romanceArticle(lang, det, gg, firstWord);
    return article.endsWith("'") ? `${article}${core}` : `${article} ${core}`;
  }

  /** Predicate adjective agreeing with a noun ("rossa" for "la palla"). */
  predicateAdjective(language: LearningLanguage, adjectiveId: string, nounId: string): string {
    const adj = this.lex(adjectiveId, language);
    if (language === 'en' || language === 'de' || adj.invariable || !adj.forms) return adj.text;
    const g = this.lex(nounId, language).gender === 'f' ? 'f' : 'm';
    return (g === 'f' ? adj.forms.f : adj.forms.m) ?? adj.text;
  }

  /** Preposition + definite noun phrase, with contractions (du, im, nel, al, del…). */
  prepositionalPhrase(language: LearningLanguage, prepId: string, obj: NounPhraseSpec): string {
    const prep = this.lex(prepId, language).text;
    const np = this.nounPhrase(language, { ...obj, det: obj.det ?? 'def' }, 'dat');
    return contract(language, prep, np);
  }

  realize(language: LearningLanguage, pattern: PatternId, slots: PatternSlots): string {
    const L = language;
    const subjDef = { ...slots.subject, det: slots.subject.det ?? 'def' } as NounPhraseSpec;
    const subjIndef = { ...slots.subject, det: slots.subject.det ?? 'indef' } as NounPhraseSpec;
    switch (pattern) {
      case 'np':
        return this.nounPhrase(L, subjIndef);
      case 'this-is': {
        const np = this.nounPhrase(L, subjIndef);
        const g = this.lex(slots.subject.noun, L).gender;
        const lead = { en: 'This is', fr: "C'est", de: 'Das ist', it: g === 'f' ? 'Questa è' : 'Questo è', es: 'Esto es' }[L];
        return punctuate(L, `${lead} ${np}`, '.');
      }
      case 'i-see': {
        const np = this.nounPhrase(L, subjIndef, 'acc');
        const lead = { en: 'I see', fr: 'Je vois', de: 'Ich sehe', it: 'Vedo', es: 'Veo' }[L];
        return punctuate(L, `${lead} ${np}`, '.');
      }
      case 'i-have': {
        const np = this.nounPhrase(L, subjIndef, 'acc');
        const lead = { en: 'I have', fr: "J'ai", de: 'Ich habe', it: 'Ho', es: 'Tengo' }[L];
        return punctuate(L, `${lead} ${np}`, '.');
      }
      case 'give-me': {
        const np = this.nounPhrase(L, subjDef, 'acc');
        const lead = { en: 'Give me', fr: 'Donne-moi', de: 'Gib mir', it: 'Dammi', es: 'Dame' }[L];
        return punctuate(L, `${lead} ${np}`, '!');
      }
      case 'where-is': {
        const np = this.nounPhrase(L, subjDef);
        if (L === 'it') {
          return punctuate(L, `Dov'è ${np}`, '?');
        }
        const lead = { en: 'Where is', fr: 'Où est', de: 'Wo ist', es: 'Dónde está' }[L];
        return punctuate(L, `${lead} ${np}`, '?');
      }
      case 'location': {
        if (!slots.prep || !slots.object) throw new Error('location pattern needs prep + object');
        const subj = capitalize(this.nounPhrase(L, subjDef));
        const be = { en: 'is', fr: 'est', de: 'ist', it: 'è', es: 'está' }[L];
        const pp = this.prepositionalPhrase(L, slots.prep, slots.object);
        return punctuate(L, `${subj} ${be} ${pp}`, '.');
      }
      case 'is-adjective': {
        if (!slots.predicate) throw new Error('is-adjective pattern needs predicate');
        const subj = capitalize(this.nounPhrase(L, subjDef));
        const be = { en: 'is', fr: 'est', de: 'ist', it: 'è', es: 'es' }[L];
        const adj = this.predicateAdjective(L, slots.predicate, slots.subject.noun);
        return punctuate(L, `${subj} ${be} ${adj}`, '.');
      }
    }
  }
}

function germanStem(adj: string): string {
  // Adjectives ending in -e drop it before endings (leise → leisen); "golden" keeps the stem.
  if (adj.endsWith('e')) return adj.slice(0, -1);
  return adj;
}

export function englishIndefinite(following: string): 'a' | 'an' {
  if (EN_AN_EXCEPTIONS.test(following)) return 'an';
  if (EN_A_EXCEPTIONS.test(following)) return 'a';
  return EN_VOWEL_SOUND.test(following) ? 'an' : 'a';
}

function italianNeedsLo(word: string): boolean {
  return /^(s[bcdfghjklmnpqrstvwxyz]|z|gn|ps|x|y|pn)/i.test(word);
}

export function romanceArticle(lang: 'fr' | 'it' | 'es', det: 'def' | 'indef', g: 'm' | 'f', nextWord: string): string {
  const vowel = VOWEL_START.test(nextWord);
  if (lang === 'fr') {
    if (det === 'def') return vowel ? "l'" : g === 'f' ? 'la' : 'le';
    return g === 'f' ? 'une' : 'un';
  }
  if (lang === 'it') {
    const itVowel = /^[aeiouàèéìòù]/i.test(nextWord);
    if (det === 'def') {
      if (g === 'f') return itVowel ? "l'" : 'la';
      if (itVowel) return "l'";
      return italianNeedsLo(nextWord) ? 'lo' : 'il';
    }
    if (g === 'f') return itVowel ? "un'" : 'una';
    return italianNeedsLo(nextWord) ? 'uno' : 'un';
  }
  if (det === 'def') return g === 'f' ? 'la' : 'el';
  return g === 'f' ? 'una' : 'un';
}

/** Contract "preposition + definite article" sequences. */
export function contract(language: LearningLanguage, prep: string, np: string): string {
  const joined = `${prep} ${np}`;
  switch (language) {
    case 'fr':
      return joined.replace(/\bde le /, 'du ').replace(/\bde les /, 'des ').replace(/\bà le /, 'au ').replace(/\bà les /, 'aux ');
    case 'es':
      return joined.replace(/\bde el /, 'del ').replace(/\ba el /, 'al ');
    case 'de':
      return joined.replace(/^in dem /, 'im ').replace(/^an dem /, 'am ').replace(/^zu dem /, 'zum ').replace(/^zu der /, 'zur ');
    case 'it': {
      const map: Record<string, Record<string, string>> = {
        in: { il: 'nel', lo: 'nello', la: 'nella', "l'": "nell'", i: 'nei', gli: 'negli', le: 'nelle' },
        a: { il: 'al', lo: 'allo', la: 'alla', "l'": "all'", i: 'ai', gli: 'agli', le: 'alle' },
        su: { il: 'sul', lo: 'sullo', la: 'sulla', "l'": "sull'", i: 'sui', gli: 'sugli', le: 'sulle' },
        di: { il: 'del', lo: 'dello', la: 'della', "l'": "dell'", i: 'dei', gli: 'degli', le: 'delle' },
      };
      const words = prep.split(' ');
      const last = words.at(-1)!;
      const table = map[last];
      if (!table) return joined;
      const m = np.match(/^(il|lo|la|i|gli|le) (.*)$/) ?? np.match(/^(l')(.*)$/);
      if (!m) return joined;
      const contracted = table[m[1]!];
      if (!contracted) return joined;
      const head = words.slice(0, -1).join(' ');
      const rest = contracted.endsWith("'") ? `${contracted}${m[2]}` : `${contracted} ${m[2]}`;
      return head ? `${head} ${rest}` : rest;
    }
    default:
      return joined;
  }
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Language-appropriate sentence punctuation (French spacing, Spanish inverted marks). */
export function punctuate(language: LearningLanguage, sentence: string, mark: '.' | '!' | '?'): string {
  const body = capitalize(sentence.trim());
  if (language === 'fr' && mark !== '.') return `${body} ${mark}`;
  if (language === 'es' && mark !== '.') return `${mark === '?' ? '¿' : '¡'}${body}${mark}`;
  return `${body}${mark}`;
}
