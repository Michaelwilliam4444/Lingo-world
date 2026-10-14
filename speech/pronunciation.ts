import type { AgeBand, LearningLanguage } from '@/types/core';
import type { RecognitionResult } from './recognition';

/**
 * PronunciationScoringService
 *
 * Default (on-device) scorer: compares recognizer transcripts/alternatives with the expected text
 * and accepted variants using token overlap + normalised edit distance. It is robust to
 * articles, punctuation, capitalisation and Spanish ¿¡ marks, and lenient for younger children.
 *
 * A server provider (e.g. Azure Pronunciation Assessment, phoneme-level) can be plugged in behind
 * the same interface via /api/speech/score when PRONUNCIATION_PROVIDER is configured.
 */

export type FeedbackLevel = 'great' | 'good' | 'almost' | 'try-again';

export interface PronunciationResult {
  score: number;            // 0..100
  accepted: boolean;
  level: FeedbackLevel;
  matched: string;          // best matching alternative heard
  missingWords: string[];   // expected words not heard (used for highlighting)
  focusSounds: string[];    // tricky sounds inside missed words
}

export interface PronunciationScoringService {
  readonly id: string;
  score(input: { expected: string; variants: string[]; recognition: RecognitionResult; language: LearningLanguage; ageBand: AgeBand }): Promise<PronunciationResult>;
}

const ACCEPT_AT: Record<AgeBand, number> = { little: 50, adventurer: 62, hero: 70 };

const ARTICLES: Record<LearningLanguage, string[]> = {
  en: ['a', 'an', 'the'], fr: ['le', 'la', 'les', "l'", 'un', 'une', 'des'], de: ['der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'einem'],
  it: ['il', 'lo', 'la', "l'", 'i', 'gli', 'le', 'un', 'uno', 'una', "un'"], es: ['el', 'la', 'los', 'las', 'un', 'una'],
};

const SOUNDS: Record<LearningLanguage, [string, RegExp][]> = {
  en: [['th', /th/], ['r', /r/], ['w', /w/], ['v', /v/]],
  fr: [['r', /r/], ['u', /u/], ['on/an', /(on|an|en)/], ['eu', /eu/]],
  de: [['ch', /ch/], ['ü', /ü/], ['ö', /ö/], ['r', /r/], ['z', /z/]],
  it: [['gli', /gli/], ['gn', /gn/], ['r', /r/], ['double', /([bcdfglmnprstvz])\1/]],
  es: [['rr', /rr/], ['j', /j/], ['ñ', /ñ/], ['ll', /ll/]],
};

export function normalizeSpeech(text: string, language: LearningLanguage, dropArticles = false): string {
  let t = text.toLowerCase().normalize('NFC').replace(/[¿¡!?.,;:"“”«»() …]/g, ' ').replace(/[’`]/g, "'");
  // Recognizers often drop accents for some engines; compare accent-insensitively but keep German umlauts meaningful.
  if (language !== 'de') t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  if (dropArticles) {
    const arts = new Set(ARTICLES[language]);
    t = t.split(' ').filter((w) => !arts.has(w)).join(' ');
    t = t.replace(/\b(l|un)'/g, '');
  }
  return t;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n]!;
}

export function similarity(heard: string, expected: string): number {
  if (!expected) return 0;
  const charSim = 1 - levenshtein(heard, expected) / Math.max(heard.length, expected.length, 1);
  const hw = heard.split(' ').filter(Boolean);
  const ew = expected.split(' ').filter(Boolean);
  // Per expected word: full credit for (near-)exact matches, half credit for close attempts ("tree" for "three").
  const wordCredit = (w: string) => {
    let best = 0;
    for (const h of hw) best = Math.max(best, 1 - levenshtein(h, w) / Math.max(h.length, w.length, 1));
    return best >= 0.85 ? 1 : best * 0.5;
  };
  const tokenSim = ew.length ? ew.reduce((sum, w) => sum + wordCredit(w), 0) / ew.length : 0;
  // Containment: child said extra words ("um, apple") — still correct.
  const contains = heard.includes(expected) ? 1 : 0;
  return Math.max(contains, 0.55 * charSim + 0.45 * tokenSim);
}

export class LocalPronunciationScorer implements PronunciationScoringService {
  readonly id = 'local';

  async score({ expected, variants, recognition, language, ageBand }: Parameters<PronunciationScoringService['score']>[0]): Promise<PronunciationResult> {
    const targets = [...new Set([expected, ...variants])].filter(Boolean);
    const heardList = [recognition.transcript, ...recognition.alternatives].filter(Boolean);
    let best = 0; let matched = ''; let bestTarget = expected;
    for (const h of heardList) {
      for (const t of targets) {
        for (const drop of [false, true]) {
          const s = similarity(normalizeSpeech(h, language, drop), normalizeSpeech(t, language, drop));
          if (s > best) { best = s; matched = h; bestTarget = t; }
        }
      }
    }
    // Recognizer confidence lightly modulates the score (unreliable on many devices, so weight is small).
    const conf = recognition.confidence > 0 ? recognition.confidence : 0.8;
    const score = Math.round(Math.min(100, best * 100 * (0.9 + 0.1 * conf)));
    const accepted = score >= ACCEPT_AT[ageBand];
    const level: FeedbackLevel = score >= 88 ? 'great' : accepted ? 'good' : score >= ACCEPT_AT[ageBand] - 20 ? 'almost' : 'try-again';
    const heardWords = new Set(normalizeSpeech(matched, language).split(' '));
    const missingWords = normalizeSpeech(bestTarget, language).split(' ').filter((w) => w && !heardWords.has(w));
    const focusSounds = [...new Set(missingWords.flatMap((w) => SOUNDS[language].filter(([, re]) => re.test(w)).map(([s]) => s)))];
    return { score, accepted, level, matched, missingWords, focusSounds };
  }
}

/** Child-friendly, never-shaming feedback lines (interface language). */
export function feedbackLine(level: FeedbackLevel, locale: string, seed: number): string {
  const lines: Record<'en' | 'ar', Record<FeedbackLevel, string[]>> = {
    en: {
      great: ['Wow, perfect!', 'Amazing voice!', 'You sound like a star!'],
      good: ['Great job!', 'Well said!', 'Yes! That’s it!'],
      almost: ['Almost! Let’s try that sound again.', 'So close! Listen to Lumi.', 'You’re getting close!'],
      'try-again': ['Great try! Let’s listen together.', 'Let’s try again — slowly!', 'Listen to Lumi, then you!'],
    },
    ar: {
      great: ['رائع، ممتاز!', 'صوتك مذهل!', 'أنت نجم!'],
      good: ['أحسنت!', 'قلتها جيدًا!', 'نعم! هكذا تمامًا!'],
      almost: ['تقريبًا! لنجرب هذا الصوت مرة أخرى.', 'قريب جدًا! استمع إلى لومي.', 'أنت تقترب!'],
      'try-again': ['محاولة رائعة! لنستمع معًا.', 'لنحاول مرة أخرى ببطء!', 'استمع إلى لومي، ثم أنت!'],
    },
  };
  const set = (locale === 'ar' ? lines.ar : lines.en)[level];
  return set[Math.abs(seed) % set.length]!;
}
