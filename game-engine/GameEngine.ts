import type { AgeBand, GameType, LearningLanguage } from '@/types/core';
import type { GameDefinition } from '@/types/content';
import type { LearningEvidence } from '@/types/learner';
import type { DifficultyConfig, GameInstance, GameRound, PresentedItem, RoundMechanic } from '@/types/engine';
import type { ContentIndex } from '@/content';
import { GrammarRealizer, type PatternId } from '@/curriculum/grammar';
import type { Rng } from '@/lib/random';

/**
 * GameEngine — a single framework behind all 30 mini-games.
 *
 * Each game type is a *skin* over one of eight round mechanics. The engine produces round data
 * (prompts, options, tiles, groups, evidence mapping); React renderers in src/features/games draw them.
 * New games = new skin + a mechanic mapping here; no new learning logic required.
 */

export const GAME_MECHANICS: Record<GameType, RoundMechanic> = {
  'picture-hunt': 'choose-image', 'sound-match': 'choose-image', 'memory-cards': 'pairs', 'drag-drop': 'choose-image',
  'treasure-hunt': 'choose-image', 'voice-command': 'command', 'endless-runner': 'choose-image', 'puzzle-builder': 'spell',
  cooking: 'choose-image', 'dress-up': 'choose-image', shopping: 'choose-image', 'story-choice': 'choose-image',
  'mystery-clue': 'choose-image', 'companion-care': 'command', 'maze-directions': 'command', sorting: 'sort',
  'balloon-pop': 'choose-image', rhythm: 'choose-image', 'listening-race': 'choose-image', 'sentence-builder': 'order',
  'word-construction': 'spell', 'hidden-object': 'choose-image', 'matching-pairs': 'pairs', sequence: 'order',
  'quick-reaction': 'choose-image', roleplay: 'speak', 'create-a-scene': 'speak', 'story-builder': 'order',
  'pronunciation-challenge': 'speak', 'world-exploration': 'choose-image',
};

const EVIDENCE_BY_MECHANIC: Record<RoundMechanic, LearningEvidence['kind'][]> = {
  'choose-image': ['listening-recognition'],
  'choose-word': ['reading'],
  speak: ['speaking', 'pronunciation'],
  pairs: ['image-recognition'],
  order: ['sentence-usage', 'reading'],
  spell: ['spelling'],
  sort: ['image-recognition'],
  command: ['speaking'],
};

const CARRIERS: PatternId[] = ['where-is', 'give-me', 'i-see', 'this-is'];

export interface BuildGameInput {
  game: GameDefinition;
  templateId: string;
  language: LearningLanguage;
  ageBand: AgeBand;
  targets: { itemId: string; itemType: 'concept' | 'phrase' }[];
  distractorPool: string[];      // concept ids the child has met (plus same-topic fillers)
  difficulty: DifficultyConfig;
  rng: Rng;
  reasons?: string[];
  idPrefix: string;
  canReadTargetLanguage: boolean;
}

export class GameEngine {
  private readonly realizer: GrammarRealizer;
  constructor(private readonly content: ContentIndex) {
    this.realizer = new GrammarRealizer(content);
  }

  get grammar(): GrammarRealizer {
    return this.realizer;
  }

  present(itemId: string, itemType: 'concept' | 'phrase', language: LearningLanguage): PresentedItem {
    if (itemType === 'phrase') {
      const p = this.content.phrase(itemId, language);
      if (!p) throw new Error(`Unknown phrase ${itemId}/${language}`);
      const first = p.conceptIds[0] ? this.content.concepts.get(p.conceptIds[0]) : undefined;
      return {
        itemId, itemType, text: p.text, displayLabel: p.text, image: first?.image ?? '💬',
        variants: [p.text, ...(p.acceptedVariants ?? [])], syllables: p.text.split(/\s+/),
      };
    }
    const c = this.content.concepts.get(itemId);
    const lex = this.content.get(itemId, language);
    if (!c || !lex) throw new Error(`Unknown concept ${itemId}/${language}`);
    const label = c.wordClass === 'noun' ? this.realizer.cardLabel(itemId, language) : lex.text;
    return {
      itemId, itemType, text: lex.text, displayLabel: label, image: c.image,
      variants: [lex.text, label, ...(lex.variants ?? []), ...(lex.forms?.f ? [lex.forms.f] : [])],
      syllables: lex.syllables ?? [lex.text],
    };
  }

  /** A sentence carrying a noun target, to raise listening difficulty without changing the answer picture. */
  carrierSentence(conceptId: string, language: LearningLanguage, rng: Rng): string {
    const c = this.content.concepts.get(conceptId);
    if (!c || c.wordClass !== 'noun') return this.present(conceptId, 'concept', language).text;
    return this.realizer.realize(language, rng.pick(CARRIERS), { subject: { noun: conceptId } });
  }

  private distractors(target: PresentedItem, pool: string[], count: number, hard: boolean, language: LearningLanguage, rng: Rng): PresentedItem[] {
    const tc = this.content.concepts.get(target.itemId);
    const sameTopic = tc ? pool.filter((id) => this.content.concepts.get(id)?.topic === tc.topic) : [];
    const confusable = tc?.confusableWith ?? [];
    const ordered = hard ? [...rng.shuffle(confusable), ...rng.shuffle(sameTopic), ...rng.shuffle(pool)] : [...rng.shuffle(pool), ...rng.shuffle(sameTopic)];
    const out: PresentedItem[] = [];
    const usedText = new Set([target.text.toLowerCase()]);
    const usedImage = new Set([target.image]);
    // Pass 1: same word class (a noun among nouns); pass 2: anything, so we always fill the options.
    for (const sameClassOnly of [true, false]) {
      for (const id of ordered) {
        if (out.length >= count) return out;
        if (id === target.itemId) continue;
        const c = this.content.concepts.get(id);
        if (!c || (sameClassOnly && tc && c.wordClass !== tc.wordClass)) continue;
        const p = this.present(id, 'concept', language);
        // Never two options with identical words or pictures (e.g. "orange" the fruit vs the colour).
        if (usedText.has(p.text.toLowerCase()) || usedImage.has(p.image)) continue;
        usedText.add(p.text.toLowerCase()); usedImage.add(p.image);
        out.push(p);
      }
    }
    return out;
  }

  build(input: BuildGameInput): GameInstance {
    const { game, language, difficulty, rng } = input;
    let mechanic = GAME_MECHANICS[game.type];
    // Reading-based mechanics fall back to listening for pre-readers.
    if ((mechanic === 'spell' || mechanic === 'order') && !input.canReadTargetLanguage) mechanic = 'choose-image';
    const targets = input.targets.slice(0, Math.max(2, difficulty.itemCount));
    const presented = targets.map((t) => this.present(t.itemId, t.itemType, language));
    const pool = [...new Set([...input.distractorPool, ...targets.filter((t) => t.itemType === 'concept').map((t) => t.itemId)])];
    const rounds: GameRound[] = [];

    const mk = (i: number, m: RoundMechanic, prompt: PresentedItem, extra: Partial<GameRound> = {}): GameRound => ({
      id: `${input.idPrefix}.r${i}`, mechanic: m, prompt, options: [], evidence: EVIDENCE_BY_MECHANIC[m], ...extra,
    });

    switch (mechanic) {
      case 'choose-image':
      case 'choose-word': {
        presented.forEach((p, i) => {
          const options = rng.shuffle([p, ...this.distractors(p, pool, difficulty.optionCount - 1, difficulty.hardDistractors, language, rng)]);
          let prompt = p;
          if (p.itemType === 'concept' && difficulty.sentenceComplexity >= 3 && (game.type === 'story-choice' || game.type === 'mystery-clue' || game.type === 'listening-race' || game.type === 'shopping')) {
            prompt = { ...p, text: this.carrierSentence(p.itemId, language, rng) };
          } else if (p.itemType === 'concept' && difficulty.sentenceComplexity >= 1) {
            prompt = { ...p, text: p.displayLabel };
          }
          rounds.push(mk(i, mechanic, prompt, { options }));
        });
        break;
      }
      case 'speak': {
        presented.forEach((p, i) => {
          let prompt = p;
          if (p.itemType === 'concept' && difficulty.sentenceComplexity >= 3 && input.ageBand !== 'little') {
            const sentence = this.carrierSentence(p.itemId, language, rng);
            prompt = { ...p, text: sentence, displayLabel: sentence, variants: [sentence, ...p.variants] };
          }
          rounds.push(mk(i, 'speak', prompt));
        });
        break;
      }
      case 'command': {
        const commandItems = this.commandItems(game.type, language, presented, rng);
        commandItems.forEach((p, i) => rounds.push(mk(i, 'command', p)));
        break;
      }
      case 'pairs': {
        const pairs = presented.filter((p) => p.itemType === 'concept').slice(0, Math.min(6, Math.max(3, difficulty.itemCount)));
        const fill = this.distractors(pairs[0] ?? presented[0]!, pool, Math.max(0, 3 - pairs.length), false, language, rng);
        const all = [...pairs, ...fill];
        rounds.push(mk(0, 'pairs', all[0]!, { options: rng.shuffle(all) }));
        break;
      }
      case 'order': {
        // Sentences need nouns (carrier patterns) or curated phrases; top up from known nouns when needed.
        const isNounOrPhrase = (p: PresentedItem) => p.itemType === 'phrase' || this.content.concepts.get(p.itemId)?.wordClass === 'noun';
        let base = presented.filter(isNounOrPhrase);
        if (base.length < 2) {
          const extra = rng.shuffle(pool.filter((id) => this.content.concepts.get(id)?.wordClass === 'noun' && !this.content.concepts.get(id)?.tags.includes('mass')))
            .slice(0, 3 - base.length).map((id) => this.present(id, 'concept', language));
          base = [...base, ...extra];
        }
        const sentences = (base.length ? base : presented).map((p) => {
          if (p.itemType === 'phrase') return p;
          const s = this.carrierSentence(p.itemId, language, rng);
          return { ...p, text: s, displayLabel: s };
        });
        sentences.slice(0, 4).forEach((p, i) => {
          const words = tokenize(p.text);
          if (words.length < 2) return;
          rounds.push(mk(i, 'order', p, { tiles: rng.shuffle(words), solution: words }));
        });
        if (!rounds.length) presented.forEach((p, i) => rounds.push(mk(i, 'speak', p)));
        break;
      }
      case 'spell': {
        presented.filter((p) => p.itemType === 'concept' && !/\s/.test(p.text) && p.text.length <= 10).forEach((p, i) => {
          const letters = [...p.text.toLowerCase()];
          rounds.push(mk(i, 'spell', p, { tiles: rng.shuffle(letters), solution: letters }));
        });
        if (!rounds.length) presented.forEach((p, i) => rounds.push(mk(i, 'choose-image', p, { options: rng.shuffle([p, ...this.distractors(p, pool, difficulty.optionCount - 1, false, language, rng)]) })));
        break;
      }
      case 'sort': {
        const concepts = [...new Set([...presented.filter((p) => p.itemType === 'concept').map((p) => p.itemId), ...pool])];
        const byTopic = new Map<string, string[]>();
        for (const id of concepts) {
          const topic = this.content.concepts.get(id)?.topic;
          if (topic) byTopic.set(topic, [...(byTopic.get(topic) ?? []), id]);
        }
        const topics = rng.shuffle([...byTopic.entries()].filter(([, ids]) => ids.length >= 2)).slice(0, 2);
        if (topics.length < 2) {
          presented.forEach((p, i) => rounds.push(mk(i, 'choose-image', p, { options: rng.shuffle([p, ...this.distractors(p, pool, difficulty.optionCount - 1, false, language, rng)]) })));
          break;
        }
        const groups = topics.map(([topic, ids]) => {
          const picked = rng.shuffle(ids).slice(0, 3);
          return { id: topic, label: topic, emoji: this.content.concepts.get(picked[0]!)!.image, itemIds: picked };
        });
        const items = groups.flatMap((g) => g.itemIds.map((id) => this.present(id, 'concept', language)));
        rounds.push(mk(0, 'sort', items[0]!, { options: rng.shuffle(items), groups }));
        break;
      }
    }

    return {
      id: input.idPrefix,
      type: game.type,
      family: game.family,
      templateId: input.templateId,
      difficulty,
      rounds,
      itemIds: [...new Set(rounds.flatMap((r) => [r.prompt.itemId, ...(r.mechanic === 'pairs' || r.mechanic === 'sort' ? r.options.map((o) => o.itemId) : [])]))],
      reasons: input.reasons ?? [],
    };
  }

  /** Items for voice-command style games: Mimo commands, maze directions, or the day's words. */
  private commandItems(type: GameType, language: LearningLanguage, fallback: PresentedItem[], rng: Rng): PresentedItem[] {
    if (type === 'maze-directions') {
      return rng.shuffle(['dir.go_left', 'dir.go_right', 'dir.go_up', 'dir.go_down']).slice(0, 4).map((id) => this.present(id, 'phrase', language));
    }
    if (type === 'companion-care' || type === 'voice-command') {
      const commands = this.content.bundle.concepts.filter((c) => c.tags.includes('mimo-command') && c.stage <= 2);
      const fromTargets = fallback.filter((p) => commands.some((c) => c.id === p.itemId));
      const extra = rng.shuffle(commands).slice(0, 4 - Math.min(4, fromTargets.length)).map((c) => this.present(c.id, 'concept', language));
      return [...fromTargets, ...extra].slice(0, 4);
    }
    return fallback;
  }
}

/** Split a sentence into word tiles, keeping punctuation attached and Spanish ¿¡ on the first word. */
export function tokenize(sentence: string): string[] {
  return sentence.replace(/ /g, ' ').split(/\s+/).filter((w) => w && !/^[.!?]$/.test(w));
}

/** Evidence produced by one answered round. */
export function evidenceForRound(round: GameRound, correct: boolean, opts: { hintsUsed: number; responseMs?: number; score?: number; at: string }): LearningEvidence[] {
  const ids = round.mechanic === 'pairs' || round.mechanic === 'sort' ? round.options.map((o) => o) : [round.prompt];
  return ids.flatMap((item) =>
    round.evidence.map((kind) => ({
      itemId: item.itemId, itemType: item.itemType, kind, correct,
      score: kind === 'pronunciation' ? opts.score : undefined,
      hintsUsed: opts.hintsUsed, responseMs: opts.responseMs, at: opts.at,
    })),
  );
}
