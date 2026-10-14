import type { GameType, StageNumber } from '@/types/core';
import type { CurriculumUnit, TopicId, TrackDefinition } from '@/types/content';

const L = (en: string, ar: string) => ({ en, ar });

/** Concrete, picture-friendly topics for 4–5 year olds. */
const LITTLE_TOPICS: TopicId[] = ['greetings', 'colors', 'numbers', 'animals', 'family', 'food', 'body', 'toys', 'home', 'actions', 'clothing', 'feelings', 'weather', 'nature', 'transport', 'descriptions'];

const LITTLE_GAMES: GameType[] = ['picture-hunt', 'sound-match', 'memory-cards', 'drag-drop', 'treasure-hunt', 'voice-command', 'endless-runner', 'cooking', 'dress-up',
  'companion-care', 'sorting', 'balloon-pop', 'rhythm', 'hidden-object', 'pronunciation-challenge', 'world-exploration', 'listening-race', 'create-a-scene'];
const ADVENTURER_GAMES: GameType[] = [...LITTLE_GAMES, 'puzzle-builder', 'shopping', 'story-choice', 'mystery-clue', 'maze-directions', 'sentence-builder', 'word-construction',
  'matching-pairs', 'sequence', 'quick-reaction', 'roleplay', 'story-builder'];
const HERO_GAMES: GameType[] = ADVENTURER_GAMES.filter((g) => !['drag-drop', 'dress-up', 'balloon-pop', 'companion-care'].includes(g));

/**
 * Builds the three tracks from the unit catalogue. Each track has its own syllabus, story seasons,
 * games, pacing, navigation and graduation rule. Editable in the content studio like any other content.
 */
export function buildTracks(units: CurriculumUnit[]): TrackDefinition[] {
  const ordered = [...units].sort((a, b) => a.stage - b.stage || a.order - b.order);
  const byStage = (stages: StageNumber[], filter: (u: CurriculumUnit) => boolean = () => true) => ordered.filter((u) => stages.includes(u.stage) && filter(u)).map((u) => u.id);
  return [
    {
      id: 'little', emoji: '🐣', color: '#ffc94a',
      name: L('Little Explorers', 'المستكشفون الصغار'), ages: { min: 4, max: 5 },
      tagline: L('Listen, point, say, sing.', 'استمع، أشِر، قل، غنِّ.'),
      description: L('Picture- and audio-first adventures with no reading required. Short daily sessions build a first vocabulary of everyday words through songs, touch games and talking to Mimo.',
        'مغامرات تعتمد على الصور والصوت دون الحاجة للقراءة. جلسات يومية قصيرة تبني أول مفردات للكلمات اليومية من خلال الأغاني وألعاب اللمس والتحدث مع ميمو.'),
      stages: [1, 2, 3],
      unitIds: byStage([1, 2, 3], (u) => LITTLE_TOPICS.includes(u.topic) && u.ageBands.includes('little')),
      arcIds: ['first-friends', 'forest-mystery', 'winter-wonder'],
      gameTypes: LITTLE_GAMES,
      dailyMinutes: { min: 8, max: 12 }, newItemsPerDay: 3, maxGamesPerJourney: 2, reviewItemsPerJourney: 4,
      features: { reading: false, writing: false, reviewSentences: false, storyCreator: false, freeSpeechRoleplay: false, showTargetText: false },
      navigation: ['adventure', 'play', 'mimo', 'books', 'music'],
      skillsFocus: [L('Listening', 'الاستماع'), L('First words', 'الكلمات الأولى'), L('Pronunciation', 'النطق'), L('Songs & rhythm', 'الأغاني والإيقاع')],
      graduation: { wordsMastered: 120, nextTrack: 'adventurer' },
    },
    {
      id: 'adventurer', emoji: '🗝️', color: '#2ec4b6',
      name: L('Adventurers', 'المغامرون'), ages: { min: 6, max: 8 },
      tagline: L('Words become sentences.', 'الكلمات تصبح جملًا.'),
      description: L('The Golden Key season and five more story arcs. Children build sentences, start reading, solve small mysteries and control the story with their voice.',
        'موسم المفتاح الذهبي وخمس قصص أخرى. يبني الأطفال الجمل ويبدؤون القراءة ويحلون ألغازًا صغيرة ويتحكمون في القصة بأصواتهم.'),
      stages: [1, 2, 3, 4],
      unitIds: byStage([1, 2, 3, 4]),
      arcIds: ['golden-key', 'forest-mystery', 'dragon-egg', 'dino-map', 'castle-room', 'underwater-city', 'winter-wonder'],
      gameTypes: ADVENTURER_GAMES,
      dailyMinutes: { min: 12, max: 15 }, newItemsPerDay: 4, maxGamesPerJourney: 3, reviewItemsPerJourney: 6,
      features: { reading: true, writing: false, reviewSentences: true, storyCreator: true, freeSpeechRoleplay: false, showTargetText: true },
      navigation: ['adventure', 'explore', 'play', 'create', 'mimo'],
      skillsFocus: [L('Vocabulary', 'المفردات'), L('Sentence building', 'بناء الجمل'), L('Early reading', 'القراءة المبكرة'), L('Speaking', 'التحدث')],
      graduation: { wordsMastered: 350, nextTrack: 'hero' },
    },
    {
      id: 'hero', emoji: '🕵️', color: '#e2447a',
      name: L('Heroes', 'الأبطال'), ages: { min: 9, max: 11 },
      tagline: L('Read, write, talk, solve.', 'اقرأ، اكتب، تحدّث، احلّ.'),
      description: L('A detective season with longer stories, reading clues, writing coded replies, role-play conversations and grammar learned in context. Moves faster and goes further, up to A2-aligned.',
        'موسم بوليسي بقصص أطول وقراءة الأدلة وكتابة الردود المشفرة ومحادثات لعب الأدوار والقواعد في سياقها. أسرع وأبعد، حتى مستوى A2.'),
      stages: [1, 2, 3, 4, 5, 6],
      unitIds: byStage([1, 2, 3, 4, 5, 6]),
      arcIds: ['clocktower-code', 'space-signal', 'underwater-city', 'dino-map', 'castle-room', 'golden-key', 'winter-wonder'],
      gameTypes: HERO_GAMES,
      dailyMinutes: { min: 15, max: 20 }, newItemsPerDay: 5, maxGamesPerJourney: 3, reviewItemsPerJourney: 7,
      features: { reading: true, writing: true, reviewSentences: true, storyCreator: true, freeSpeechRoleplay: true, showTargetText: true },
      navigation: ['adventure', 'explore', 'play', 'create', 'books'],
      skillsFocus: [L('Reading', 'القراءة'), L('Writing', 'الكتابة'), L('Conversation', 'المحادثة'), L('Grammar in context', 'القواعد في السياق')],
      graduation: { wordsMastered: 900, nextTrack: null },
    },
  ];
}
