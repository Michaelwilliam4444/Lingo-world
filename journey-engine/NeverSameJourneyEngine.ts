import type { AgeBand, GameType, Interest, LearningLanguage } from '@/types/core';
import type { GameDefinition, NarrativeLine, StoryBeat, TopicId } from '@/types/content';
import type { ActivityRecord, ChildProfile, CompanionState, LanguageProgress, MasteryRecord, ReviewState, StoryState } from '@/types/learner';
import type { DailyJourney, JourneyStep, PresentedItem, ResolvedLine } from '@/types/engine';
import type { ContentIndex } from '@/content';
import { createRng, type Rng } from '@/lib/random';
import { toLocalDateKey } from '@/lib/time';
import { CurriculumEngine } from '@/learning-engine/CurriculumEngine';
import { adaptiveReviewEngine, type ReviewCandidate } from '@/learning-engine/AdaptiveReviewEngine';
import { antiBoredomEngine } from '@/learning-engine/AntiBoredomEngine';
import { difficultyEngine } from '@/learning-engine/DifficultyEngine';
import { StoryEngine, fillPlaceholders, localize } from '@/story-engine/StoryEngine';
import { GameEngine } from '@/game-engine/GameEngine';
import { capitalize, punctuate } from '@/curriculum/grammar';
import { trackIdOf } from '@/learning-engine/track';

/**
 * NeverSameJourneyEngine — composes today's adventure from approved components.
 *
 *   curriculum objectives (CurriculumEngine)      → WHAT must be learned: new items for today
 *   spaced repetition (AdaptiveReviewEngine)      → which items must come back, woven into the story
 *   story (StoryEngine)                           → which episode, branching, memory callbacks
 *   novelty (AntiBoredomEngine)                   → which game skins/families, avoiding repetition
 *   challenge (DifficultyEngine)                  → how hard each activity is presented
 *   interests                                      → which words/scenes decorate review sentences
 *
 * The seed is (child, date, journeys-today), so a journey is stable if reopened the same day,
 * but tomorrow's differs — and replaying an episode yields different words, games and sentences.
 * No LLM is involved: every target-language sentence comes from curated phrases or the grammar realizer.
 */

export interface JourneyInput {
  child: ChildProfile;
  progress: LanguageProgress;
  mastery: MasteryRecord[];
  reviews: ReviewState[];
  story: StoryState;
  companion: CompanionState;
  history: ActivityRecord[];
  premium: boolean;
  micAvailable: boolean;
  now: Date;
  journeysToday: number;
}

const INTEREST_TOPICS: Record<Interest, { topics: TopicId[]; concepts?: string[] }> = {
  animals: { topics: ['animals'] },
  space: { topics: ['adventure', 'transport'], concepts: ['adventure.planet', 'transport.rocket', 'adventure.astronaut', 'nature.star', 'nature.moon'] },
  dinosaurs: { topics: ['adventure'], concepts: ['animals.dinosaur', 'adventure.egg', 'adventure.footprint'] },
  magic: { topics: ['adventure'], concepts: ['adventure.wand', 'adventure.castle', 'adventure.dragon'] },
  fantasy: { topics: ['adventure'], concepts: ['adventure.castle', 'adventure.king', 'adventure.queen', 'clothing.crown'] },
  pirates: { topics: ['adventure'], concepts: ['adventure.pirate', 'adventure.treasure', 'adventure.chest', 'transport.boat', 'travel.map'] },
  cars: { topics: ['transport'] },
  robots: { topics: ['toys'], concepts: ['toys.robot'] },
  sports: { topics: ['sports'] },
  music: { topics: ['hobbies'], concepts: ['hobbies.music', 'hobbies.song', 'toys.drum', 'hobbies.guitar'] },
  nature: { topics: ['nature', 'weather'] },
  mysteries: { topics: ['questions', 'adventure'], concepts: ['adventure.footprint', 'adventure.lantern', 'home.key'] },
  art: { topics: ['hobbies', 'colors'], concepts: ['hobbies.brush', 'hobbies.drawing'] },
  science: { topics: ['nature'], concepts: ['adventure.planet', 'nature.star'] },
  cooking: { topics: ['food', 'restaurant'] },
};

export class NeverSameJourneyEngine {
  private readonly curriculum: CurriculumEngine;
  private readonly story: StoryEngine;
  private readonly games: GameEngine;

  constructor(private readonly content: ContentIndex) {
    this.curriculum = new CurriculumEngine(content);
    this.story = new StoryEngine(content);
    this.games = new GameEngine(content);
  }

  compose(input: JourneyInput): DailyJourney {
    const { child, progress, now } = input;
    const lang = child.targetLanguage;
    // The child's track (normally their age band; parents can move them) drives pacing, games and seasons.
    const ageBand: AgeBand = trackIdOf(child);
    const track = this.content.track(ageBand);
    const date = toLocalDateKey(now);
    const seed = `${child.id}|${lang}|${date}|${input.journeysToday}`;
    const rng = createRng(seed);
    const rationale: string[] = [];
    const masteryMap = new Map(input.mastery.map((m) => [m.itemId, m]));

    // 1 ─ WHAT: curriculum objectives + due reviews
    const newItems = this.curriculum.newItemsForToday(progress, masteryMap, ageBand);
    const reviewCandidates = adaptiveReviewEngine.candidates(input.reviews, masteryMap, now, track.reviewItemsPerJourney);
    const unit = this.content.units.get(progress.currentUnitId);
    if (newItems.length && unit) rationale.push(`Introduces ${newItems.length} new item(s) from the unit “${unit.title.en}”.`);
    const struggling = reviewCandidates.filter((r) => r.reason === 'struggling');
    if (reviewCandidates.length) rationale.push(`Brings back ${reviewCandidates.length} word(s) due for review${struggling.length ? `, including ${struggling.length} that need extra support` : ''}.`);

    // 2 ─ STORY: today's episode
    const wordsMastered = this.curriculum.stageCounts(masteryMap, ageBand).mastered;
    const unlocked = this.story.unlockedWorlds(input.story, wordsMastered, track.arcIds[0]).filter((w) => !w.premium || input.premium);
    const episode = this.story.nextEpisode(input.story, {
      stage: progress.stage, unlockedWorldIds: new Set(unlocked.map((w) => w.id)), premium: input.premium,
      month: now.getMonth() + 1, rngPick: (items) => rng.pick(items), arcIds: track.arcIds,
    });
    const isReplay = input.story.completedEpisodeIds.includes(episode.id);
    rationale.push(isReplay ? `Replays “${episode.title.en}” with fresh words and games.` : `Continues the story: “${episode.title.en}”.`);

    // 3 ─ Focus slots: new words first, then the most urgent review
    const focusPool = [
      ...newItems.filter((n) => n.itemType === 'concept'),
      ...reviewCandidates.filter((r) => r.itemType === 'concept'),
      ...newItems.filter((n) => n.itemType === 'phrase'),
    ];
    const fallbackConcept = unit?.conceptIds[0] ?? this.content.bundle.concepts[0]!.id;
    const focus1 = focusPool[0] ?? { itemId: fallbackConcept, itemType: 'concept' as const };
    const focus2 = focusPool[1] ?? focus1;
    const slots: Record<string, { itemId: string; itemType: 'concept' | 'phrase' }> = { focus1, focus2 };

    // 4 ─ Build steps from beats
    const knownConcepts = this.curriculum.knownConcepts(masteryMap);
    const distractorPool = [...new Set([...knownConcepts, ...(unit?.conceptIds ?? [])])];
    const steps: JourneyStep[] = [];
    const plannedTypes: GameType[] = [];
    let gamesBuilt = 0;
    const ctx = { nickname: child.nickname, mimoName: input.companion.name };
    const locale = child.interfaceLocale;

    const recap = this.story.recap(input.story, locale);
    if (recap && input.story.pendingCliffhangerEpisodeId !== episode.id) {
      steps.push({ id: `${episode.id}.recap`, kind: 'story', background: episode.worldId, lines: [
        { speaker: 'narrator', text: locale === 'ar' ? 'في المرة الماضية…' : 'Last time…' },
        { speaker: 'narrator', text: recap },
      ] });
    }

    for (const beat of episode.beats) {
      const lines = this.resolveBeatLines(beat, input.story, slots, lang, locale, ctx, rng);
      const inter = beat.interaction;
      if (!inter) {
        if (lines.length) steps.push({ id: beat.id, kind: 'story', lines, background: beat.background });
        continue;
      }
      if (inter.kind === 'speak') {
        const target = 'slot' in inter.expect ? slots[inter.expect.slot]! : { itemId: inter.expect.phraseId, itemType: 'phrase' as const };
        steps.push({ id: beat.id, kind: 'speak', lines, prompt: fillPlaceholders(localize(inter.prompt, locale), ctx),
          expected: this.games.present(target.itemId, target.itemType, lang), background: beat.background, reviewSentence: false });
      } else if (inter.kind === 'choice') {
        steps.push({ id: beat.id, kind: 'choice', lines, prompt: localize(inter.prompt, locale), choiceKey: inter.choiceKey,
          options: inter.options.map((o) => ({ id: o.id, emoji: o.emoji, label: localize(o.label, locale) })), background: beat.background });
      } else if (inter.kind === 'tap') {
        steps.push({ id: beat.id, kind: 'story', lines, background: beat.background });
      } else if (inter.kind === 'activity') {
        if (lines.length) steps.push({ id: `${beat.id}.lines`, kind: 'story', lines, background: beat.background });
        if (gamesBuilt >= track.maxGamesPerJourney) continue;
        const preferNew = gamesBuilt === 0;
        const targets = this.mixTargets(newItems, reviewCandidates, preferNew, rng, focus1);
        const game = this.chooseGame(inter.families, input, plannedTypes, rng, rationale);
        const strugglingTarget = targets.some((t) => struggling.some((s) => s.itemId === t.itemId));
        const difficulty = difficultyEngine.configure(progress.difficulty, ageBand, game.itemsByDifficulty, { struggling: strugglingTarget });
        const instance = this.games.build({
          game, templateId: `tpl.${game.type}.d${difficulty.level <= 2 ? 1 : difficulty.level <= 4 ? 3 : 5}`,
          language: lang, ageBand, targets, distractorPool, difficulty, rng,
          reasons: [], idPrefix: `${beat.id}.${game.type}`, canReadTargetLanguage: track.features.showTargetText,
        });
        plannedTypes.push(game.type);
        gamesBuilt++;
        steps.push({ id: beat.id, kind: 'game', purpose: fillPlaceholders(localize(inter.purpose, locale), ctx), game: instance, background: beat.background });
      }
    }

    // 4b ─ Phrase moments: each new or due phrase is modelled by a character and spoken by the child.
    const phraseItems = [...newItems.filter((n) => n.itemType === 'phrase'), ...reviewCandidates.filter((r) => r.itemType === 'phrase')]
      .filter((p) => p.itemId !== focus1.itemId).slice(0, ageBand === 'little' ? 1 : 2);
    const firstGameIdx = steps.findIndex((st) => st.kind === 'game');
    phraseItems.forEach((p, i) => {
      const item = this.games.present(p.itemId, 'phrase', lang);
      const gloss = this.content.phrase(p.itemId, lang)?.gloss;
      const speaker = rng.pick(['lumi', 'pico', 'bibi', 'nova'] as const);
      const step: JourneyStep = {
        id: `${episode.id}.phrase-${i}`, kind: 'speak', background: episode.worldId, reviewSentence: false,
        lines: [{ speaker, text: gloss ? `${localize(gloss, locale)}` : '…', emotion: 'happy', target: { text: item.text, itemId: p.itemId, itemType: 'phrase' } }],
        prompt: locale === 'ar' ? 'قلها معي!' : 'Say it with me!', expected: item,
      };
      steps.splice(firstGameIdx >= 0 ? firstGameIdx + 1 + i : steps.length, 0, step);
    });
    if (phraseItems.length) rationale.push(`Practises ${phraseItems.length} useful phrase(s) in conversation.`);

    // 5 ─ Natural review: a story sentence built from words the child needs to revisit
    if (track.features.reviewSentences) {
      const sentence = this.composeReviewSentence(reviewCandidates, masteryMap, child.interests, lang, rng, progress.stage);
      if (sentence) {
        const finaleIdx = steps.findIndex((s) => s.id.endsWith('.finale'));
        const step: JourneyStep = {
          id: `${episode.id}.review-sentence`, kind: 'speak', background: episode.worldId, reviewSentence: true,
          lines: [{ speaker: 'pico', text: locale === 'ar' ? 'انظر! هل يمكنك قول هذه الجملة كاملة؟' : 'Look! Can you say this whole sentence?', emotion: 'excited', target: { text: sentence.text, itemId: sentence.itemId, itemType: 'concept' } }],
          prompt: locale === 'ar' ? 'قل الجملة!' : 'Say the sentence!', expected: sentence,
        };
        steps.splice(finaleIdx >= 0 ? finaleIdx : steps.length, 0, step);
        rationale.push(`Reviews ${sentence.relatedItemIds?.length ?? 1} word(s) inside a story sentence: “${sentence.text}”.`);
      }
    }

    // 6 ─ Rewards and cliffhanger
    steps.push({ id: `${episode.id}.reward`, kind: 'reward', rewardIds: episode.rewardIds, stars: 3, background: episode.worldId });
    if (episode.cliffhanger?.length) {
      steps.push({ id: `${episode.id}.cliffhanger`, kind: 'cliffhanger', background: episode.worldId,
        lines: episode.cliffhanger.map((l) => this.resolveLine(l, slots, lang, locale, ctx, rng)) });
    }

    if (antiBoredomEngine.sameAsYesterday(plannedTypes, input.history)) rationale.push('Activity order differs from the last session.');
    const difficultyNote = difficultyEngine.configure(progress.difficulty, ageBand, [4, 5, 6, 7, 8]);
    rationale.push(`Challenge level ${progress.difficulty.toFixed(1)}/5: ${difficultyNote.optionCount} choices, ${difficultyNote.audioRate < 1 ? 'slower audio, ' : ''}${difficultyNote.showImageWithAudio ? 'picture support' : 'listening without pictures'}.`);

    const minutes = steps.reduce((s, st) => s + (st.kind === 'game' ? (ageBand === 'little' ? 2.5 : 3.5) : st.kind === 'speak' ? 1 : st.kind === 'story' ? 0.8 : 0.5), 0);
    const command = this.content.bundle.concepts.find((c) => c.tags.includes('mimo-command') && !input.companion.learnedCommands.includes(c.id));

    return {
      id: `journey:${seed}`,
      childId: child.id,
      language: lang,
      date,
      episodeId: episode.id,
      arcId: episode.arcId,
      worldId: episode.worldId,
      title: localize(episode.title, locale),
      ageBand,
      steps,
      newItemIds: newItems.map((n) => n.itemId),
      reviewItemIds: reviewCandidates.map((r) => r.itemId),
      estimatedMinutes: Math.max(5, Math.round(minutes)),
      mission: { text: fillPlaceholders(localize(episode.summary, locale), ctx), emoji: this.content.worlds.get(episode.worldId)?.emoji ?? '🗺️' },
      companionMission: command
        ? { text: locale === 'ar' ? `علّم ${input.companion.name} أمرًا جديدًا!` : `Teach ${input.companion.name} a new trick!`, command: command.id }
        : { text: locale === 'ar' ? `العب مع ${input.companion.name}!` : `Play with ${input.companion.name}!` },
      seed,
      rationale,
    };
  }

  private resolveBeatLines(beat: StoryBeat, state: StoryState, slots: Record<string, { itemId: string; itemType: 'concept' | 'phrase' }>, lang: LearningLanguage, locale: ChildProfile['interfaceLocale'], ctx: { nickname: string; mimoName: string }, rng: Rng): ResolvedLine[] {
    return this.story.resolveLines(beat.lines, beat.memoryCallbacks, state).map((l) => this.resolveLine(l, slots, lang, locale, ctx, rng));
  }

  private resolveLine(line: NarrativeLine, slots: Record<string, { itemId: string; itemType: 'concept' | 'phrase' }>, lang: LearningLanguage, locale: ChildProfile['interfaceLocale'], ctx: { nickname: string; mimoName: string }, rng: Rng): ResolvedLine {
    const resolved: ResolvedLine = { speaker: line.speaker, text: fillPlaceholders(localize(line.text, locale), ctx), emotion: line.emotion };
    const t = line.target;
    if (!t) return resolved;
    if ('phraseId' in t) {
      const p = this.content.phrase(t.phraseId, lang);
      if (p) resolved.target = { text: p.text, itemId: p.id, itemType: 'phrase' };
      return resolved;
    }
    const slot = slots[t.slot];
    if (!slot) return resolved;
    const item = this.games.present(slot.itemId, slot.itemType, lang);
    const concept = slot.itemType === 'concept' ? this.content.concepts.get(slot.itemId) : undefined;
    let text = item.displayLabel;
    if (concept?.wordClass === 'noun' && t.pattern && t.pattern !== 'word') {
      text = this.games.grammar.realize(lang, t.pattern === 'np' ? 'np' : t.pattern, { subject: { noun: slot.itemId } });
      if (t.pattern === 'np') text = punctuate(lang, capitalize(text), '!');
    } else if (concept && concept.wordClass !== 'noun') {
      text = capitalize(item.text) + (lang === 'fr' ? ' !' : '!');
      if (lang === 'es') text = `¡${capitalize(item.text)}!`;
    }
    void rng;
    resolved.target = { text, itemId: slot.itemId, itemType: slot.itemType };
    return resolved;
  }

  private mixTargets(newItems: { itemId: string; itemType: 'concept' | 'phrase' }[], reviews: ReviewCandidate[], preferNew: boolean, rng: Rng, focus: { itemId: string; itemType: 'concept' | 'phrase' }) {
    const news = newItems.filter((n) => n.itemType === 'concept');
    const revs = reviews.filter((r) => r.itemType === 'concept').map((r) => ({ itemId: r.itemId, itemType: r.itemType }));
    const ordered = preferNew ? [...news, ...revs] : [...revs, ...news];
    const out = ordered.length ? ordered : [focus];
    // Keep the most important first, shuffle the tail for variety.
    return [...out.slice(0, 2), ...rng.shuffle(out.slice(2))];
  }

  private chooseGame(families: string[], input: JourneyInput, planned: GameType[], rng: Rng, rationale: string[]): GameDefinition {
    const { child, progress, premium } = input;
    const voiceOk = input.micAvailable && child.settings.voiceEnabled;
    const track = this.content.track(trackIdOf(child));
    const eligible = this.content.bundle.games.filter((g) =>
      (track.gameTypes.length ? track.gameTypes.includes(g.type) : g.ageBands.includes(child.ageBand)) && g.minStage <= Math.max(progress.stage, 1) && (!g.needsMicrophone || voiceOk)
      && (!g.premium || premium) && !['roleplay', 'create-a-scene', 'story-builder'].includes(g.type));
    const inFamily = eligible.filter((g) => families.includes(g.family));
    const pool = inFamily.length ? inFamily : eligible;
    const favorites = antiBoredomEngine.inferFavorites(input.history);
    const scored = antiBoredomEngine.score(pool, { history: input.history, now: input.now, favoriteTypes: favorites, plannedToday: planned });
    const top = scored.slice(0, 3);
    const best = top[0]!.score;
    const choice = rng.weighted(top, (s) => Math.max(0.05, s.score - best + 1.5));
    const def = pool.find((g) => g.type === choice.type)!;
    rationale.push(`Picked “${def.name.en}”${choice.notes.length ? ` (${choice.notes.slice(0, 2).join(', ')})` : ''}.`);
    return def;
  }

  /**
   * Compose one sentence that reuses due/weak words, e.g. struggles with yellow, elephant, under →
   * “The yellow elephant is under the bridge.” Only uses grammar the child's stage allows.
   */
  composeReviewSentence(reviews: ReviewCandidate[], mastery: Map<string, MasteryRecord>, interests: Interest[], lang: LearningLanguage, rng: Rng, stage: number): PresentedItem | null {
    const reviewConcepts = reviews.filter((r) => r.itemType === 'concept').map((r) => this.content.concepts.get(r.itemId)!).filter(Boolean);
    const known = [...mastery.values()].filter((m) => m.itemType === 'concept' && m.lastSeenAt).map((m) => this.content.concepts.get(m.itemId)!).filter(Boolean);
    const isNoun = (c: { wordClass: string; tags: string[] }) => c.wordClass === 'noun' && !c.tags.includes('mass');
    const interestIds = new Set(interests.flatMap((i) => INTEREST_TOPICS[i]?.concepts ?? []));
    const interestTopics = new Set<string>(interests.flatMap((i) => INTEREST_TOPICS[i]?.topics ?? []));
    const byInterest = (a: { id: string; topic: string }) => (interestIds.has(a.id) ? 2 : interestTopics.has(a.topic) ? 1 : 0);

    const nouns = [...reviewConcepts.filter(isNoun), ...known.filter(isNoun).sort((a, b) => byInterest(b) - byInterest(a))];
    const subject = nouns[0];
    if (!subject) return null;
    const adjective = [...reviewConcepts, ...known].find((c) => c.wordClass === 'adjective' && c.topic === 'colors');
    const prep = [...reviewConcepts, ...known].find((c) => c.wordClass === 'preposition');
    const object = nouns.find((n) => n.id !== subject.id && n.topic !== subject.topic) ?? nouns.find((n) => n.id !== subject.id);
    const related = [subject.id];
    let text: string;
    const subj = { noun: subject.id, adjectives: adjective ? [adjective.id] : undefined };
    if (adjective) related.push(adjective.id);
    if (prep && object && stage >= 2) {
      text = this.games.grammar.realize(lang, 'location', { subject: subj, prep: prep.id, object: { noun: object.id } });
      related.push(prep.id, object.id);
    } else if (adjective) {
      text = this.games.grammar.realize(lang, rng.pick(['i-see', 'this-is'] as const), { subject: subj });
    } else {
      text = this.games.grammar.realize(lang, 'i-see', { subject: subj });
    }
    const base = this.games.present(subject.id, 'concept', lang);
    return { ...base, text, displayLabel: text, variants: [text], syllables: text.split(/\s+/), relatedItemIds: related };
  }
}
