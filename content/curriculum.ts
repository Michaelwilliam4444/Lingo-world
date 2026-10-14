import type { Skill, StageNumber } from '@/types/core';
import type { Concept, CurriculumUnit, Phrase, TopicId } from '@/types/content';
import { ageBandsForStage } from './lexicon/dsl';

/** Authored teaching order of topics within each stage. */
export const TOPIC_ORDER: TopicId[] = [
  'greetings', 'colors', 'numbers', 'animals', 'family', 'food', 'body', 'toys', 'home', 'actions', 'clothing',
  'feelings', 'weather', 'nature', 'descriptions', 'school', 'transport', 'routine', 'directions', 'adventure',
  'hobbies', 'sports', 'travel', 'shopping', 'restaurant', 'time', 'calendar', 'questions',
];

const TOPIC_TITLES: Record<TopicId, [string, string]> = {
  greetings: ['Hello & Goodbye', 'مرحبًا ووداعًا'], numbers: ['Numbers', 'الأرقام'], colors: ['Colours', 'الألوان'],
  family: ['My Family', 'عائلتي'], home: ['At Home', 'في البيت'], food: ['Yummy Food', 'طعام لذيذ'], animals: ['Animals', 'الحيوانات'],
  body: ['My Body', 'جسمي'], clothing: ['Clothes', 'الملابس'], school: ['At School', 'في المدرسة'], toys: ['Toys', 'الألعاب'],
  weather: ['Weather', 'الطقس'], feelings: ['Feelings', 'المشاعر'], routine: ['My Day', 'يومي'], directions: ['Which Way?', 'أي اتجاه؟'],
  transport: ['On the Move', 'وسائل النقل'], nature: ['Nature', 'الطبيعة'], sports: ['Sports', 'الرياضة'], hobbies: ['Hobbies', 'الهوايات'],
  travel: ['Travel', 'السفر'], shopping: ['Shopping', 'التسوق'], restaurant: ['Restaurant', 'المطعم'], time: ['Time', 'الوقت'],
  calendar: ['Days & Months', 'الأيام والشهور'], questions: ['Questions', 'الأسئلة'], actions: ['Actions', 'الأفعال'],
  descriptions: ['Describing Things', 'وصف الأشياء'], adventure: ['Adventure Words', 'كلمات المغامرة'],
};

const CHUNK = 6;

function skillsFor(stage: StageNumber, topic: TopicId): Skill[] {
  const skills: Skill[] = ['listening', 'speaking', 'vocabulary', 'pronunciation'];
  if (stage >= 2) skills.push('reading');
  if (stage >= 3) skills.push('grammar', 'writing');
  if (topic === 'directions' || topic === 'descriptions') skills.push('grammar');
  return [...new Set(skills)];
}

const GOALS: Record<StageNumber, CurriculumUnit['goals']> = {
  1: { listening: { en: 'Recognise each word when heard', ar: 'التعرف على كل كلمة عند سماعها' }, speaking: { en: 'Say each word clearly', ar: 'نطق كل كلمة بوضوح' } },
  2: { listening: { en: 'Understand words inside short sentences', ar: 'فهم الكلمات داخل جمل قصيرة' }, speaking: { en: 'Use words in two- to three-word phrases', ar: 'استخدام الكلمات في عبارات قصيرة' }, reading: { en: 'Match written words to pictures', ar: 'مطابقة الكلمات المكتوبة بالصور' } },
  3: { listening: { en: 'Follow simple instructions', ar: 'اتباع تعليمات بسيطة' }, speaking: { en: 'Build short sentences', ar: 'بناء جمل قصيرة' }, reading: { en: 'Read short sentences', ar: 'قراءة جمل قصيرة' }, writing: { en: 'Spell key words', ar: 'تهجئة الكلمات الأساسية' } },
  4: { listening: { en: 'Understand short dialogues', ar: 'فهم حوارات قصيرة' }, speaking: { en: 'Take part in role-plays', ar: 'المشاركة في لعب الأدوار' }, reading: { en: 'Read and answer questions', ar: 'القراءة والإجابة عن الأسئلة' }, writing: { en: 'Write short sentences', ar: 'كتابة جمل قصيرة' } },
  5: { reading: { en: 'Read short stories independently', ar: 'قراءة قصص قصيرة باستقلالية' }, writing: { en: 'Write a few connected sentences', ar: 'كتابة عدة جمل مترابطة' }, speaking: { en: 'Retell a story', ar: 'إعادة سرد قصة' } },
  6: { speaking: { en: 'Handle everyday situations', ar: 'التعامل مع مواقف يومية' }, writing: { en: 'Write a short message', ar: 'كتابة رسالة قصيرة' }, listening: { en: 'Understand longer stories', ar: 'فهم قصص أطول' } },
};

const PATTERN_STAGE: Record<string, StageNumber> = { np: 1, 'this-is': 1, 'i-see': 2, 'i-have': 2, 'give-me': 3, 'where-is': 3, 'is-adjective': 3, location: 4 };

/**
 * Builds the curriculum units from the authored topic order and the lexicon.
 * Each unit is a small, coherent vocabulary set (≤6 concepts) with its phrases, goals and prerequisites,
 * which keeps sessions short and lets mastery gates be precise.
 */
export function buildCurriculum(concepts: Concept[], phrases: Phrase[]): CurriculumUnit[] {
  const units: CurriculumUnit[] = [];
  const phraseIds = [...new Map(phrases.map((p) => [p.id, p])).values()];
  let previous: string | null = null;

  for (const stage of [1, 2, 3, 4] as StageNumber[]) {
    let order = 0;
    const stageUnits: CurriculumUnit[] = [];
    for (const topic of TOPIC_ORDER) {
      const inTopic = concepts.filter((c) => c.stage === stage && c.topic === topic);
      if (!inTopic.length) continue;
      for (let i = 0; i < inTopic.length; i += CHUNK) {
        const chunk = inTopic.slice(i, i + CHUNK);
        const part = Math.floor(i / CHUNK) + 1;
        const [en, ar] = TOPIC_TITLES[topic];
        const id = `u${stage}-${topic}-${part}`;
        const unit: CurriculumUnit = {
          id, stage, order: order++, topic,
          title: { en: part > 1 ? `${en} ${part}` : en, ar: part > 1 ? `${ar} ${part}` : ar },
          skills: skillsFor(stage, topic),
          conceptIds: chunk.map((c) => c.id),
          phraseIds: part === 1 ? phraseIds.filter((p) => p.topic === topic && p.stage === stage).map((p) => p.id) : [],
          grammarPatternIds: Object.entries(PATTERN_STAGE).filter(([, s]) => s === stage).map(([p]) => p).slice(0, order === 1 ? 4 : 0),
          goals: GOALS[stage],
          prerequisites: previous ? [previous] : [],
          masteryThreshold: stage === 1 ? 55 : stage === 2 ? 60 : 65,
          ageBands: ageBandsForStage(stage),
          version: 1,
        };
        stageUnits.push(unit);
        previous = id;
      }
    }
    // Phrases whose topic has no vocabulary unit in this stage join the stage's last unit.
    const covered = new Set(stageUnits.flatMap((u) => u.phraseIds));
    const orphan = phraseIds.filter((p) => p.stage === stage && !covered.has(p.id)).map((p) => p.id);
    if (orphan.length && stageUnits.length) stageUnits.at(-1)!.phraseIds.push(...orphan);
    units.push(...stageUnits);
  }

  // Stages 5–6: skill-consolidation units (reading, writing, longer listening) over earlier vocabulary.
  const consolidation: [StageNumber, TopicId[], string, string][] = [
    [5, ['animals', 'nature', 'adventure'], 'Story Reading: Wild Worlds', 'قراءة القصص: عوالم برية'],
    [5, ['home', 'family', 'routine'], 'Story Reading: Everyday Life', 'قراءة القصص: الحياة اليومية'],
    [5, ['food', 'restaurant', 'shopping'], 'Writing: My Shopping List', 'الكتابة: قائمة التسوق'],
    [6, ['travel', 'transport', 'directions'], 'Real Life: Getting Around', 'الحياة الواقعية: التنقل'],
    [6, ['feelings', 'body', 'questions'], 'Real Life: Talking About Me', 'الحياة الواقعية: الحديث عن نفسي'],
    [6, ['time', 'calendar', 'hobbies'], 'Real Life: Making Plans', 'الحياة الواقعية: وضع الخطط'],
  ];
  consolidation.forEach(([stage, topics, en, ar], idx) => {
    const id = `u${stage}-consolidate-${idx + 1}`;
    units.push({
      id, stage, order: idx, topic: topics[0]!, title: { en, ar },
      skills: ['reading', 'writing', 'listening', 'speaking', 'grammar'],
      conceptIds: concepts.filter((c) => topics.includes(c.topic) && c.wordClass === 'noun').slice(0, 10).map((c) => c.id),
      phraseIds: phraseIds.filter((p) => topics.includes(p.topic)).map((p) => p.id),
      grammarPatternIds: ['location', 'is-adjective', 'give-me', 'where-is'],
      goals: GOALS[stage], prerequisites: previous ? [previous] : [], masteryThreshold: 70,
      ageBands: ageBandsForStage(stage), version: 1,
    });
    previous = id;
  });

  return units;
}
