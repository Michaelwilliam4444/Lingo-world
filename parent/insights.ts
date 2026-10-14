import type { AgeBand } from '@/types/core';
import type { InterfaceLocale, LearningLanguage, MasteryDimension, StageNumber } from '@/types/core';
import { trackIdOf } from '@/learning-engine/track';
import type { ChildState, MasteryRecord } from '@/types/learner';
import type { ContentIndex } from '@/content';
import { learningBrain } from '@/learning-engine/LearningBrain';
import { CurriculumEngine, unitItemScore } from '@/learning-engine/CurriculumEngine';
import { StoryEngine } from '@/story-engine/StoryEngine';
import { DAY_MS, startOfWeek, toLocalDateKey } from '@/lib/time';

/**
 * Parent insights — turns raw learning data into numbers *and* understandable sentences.
 * Deterministic templates (no LLM), so reports are reproducible and never invent progress.
 */

export interface SkillProgress { listening: number; speaking: number; pronunciation: number; reading: number; writing: number }
export interface TopicStrength { topic: string; label: string; score: number; items: number }

export interface DashboardMetrics {
  weeklyMinutes: number;
  monthlyMinutes: number;
  freePlayMinutesWeek: number;
  journeysCompletedWeek: number;
  journeysCompletedTotal: number;
  wordsExposed: number;
  wordsPracticed: number;
  wordsMastered: number;
  phrasesMastered: number;
  sentencesSpoken: number;
  speakingAttempts: number;
  speakingAttemptsWeek: number;
  pronunciationTrend: { week: string; score: number | null }[];
  skills: SkillProgress;
  worldsUnlocked: number;
  worldsTotal: number;
  episodesCompleted: number;
  stage: StageNumber;
  stageName: string;
  /** The child's learning track (age-based by default, adjustable by the parent). */
  track: { id: AgeBand; name: string; emoji: string; color: string; ages: string; isAgeDefault: boolean; dailyMinutes: string };
  /** Progress towards the next track: words mastered vs the graduation threshold. */
  graduation: { next: AgeBand | null; nextName: string | null; target: number; progress: number; ready: boolean };
  cefr: string;
  currentUnit: string;
  strongAreas: TopicStrength[];
  developingAreas: TopicStrength[];
  needsPractice: { itemId: string; label: string; image: string }[];
  focusSounds: { sound: string; attempts: number; successRate: number }[];
  dailyMinutes: { date: string; learning: number; free: number }[];
  reviewForecast: number[];
}

export interface WeeklyReport {
  id: string;
  childId: string;
  language: LearningLanguage;
  weekStart: string;
  generatedAt: string;
  headline: string;
  summary: string[];
  achievements: string[];
  skills: SkillProgress;
  progress: { wordsPracticed: number; wordsMastered: number; minutes: number; journeys: number };
  recommendedActions: string[];
  favoriteAdventure: string | null;
  newVocabulary: { itemId: string; text: string; image: string }[];
  nextWeekPlan: string;
}

const TRICKY_SOUNDS: Record<LearningLanguage, { sound: string; re: RegExp }[]> = {
  en: [{ sound: 'TH', re: /th/i }, { sound: 'R', re: /r/i }, { sound: 'W/V', re: /[wv]/i }, { sound: 'short vowels (i/e)', re: /\b\w*[ie]\w*\b/i }],
  fr: [{ sound: 'French R', re: /r/i }, { sound: 'U (tu)', re: /u(?![nm])/i }, { sound: 'nasal vowels (on/an/in)', re: /(on|an|en|in)(?![aeiou])/i }, { sound: 'EU', re: /eu|œu/i }],
  de: [{ sound: 'CH', re: /ch/i }, { sound: 'Ü', re: /ü/i }, { sound: 'Ö', re: /ö/i }, { sound: 'German R', re: /r/i }],
  it: [{ sound: 'GLI', re: /gli/i }, { sound: 'GN', re: /gn/i }, { sound: 'rolled R', re: /r/i }, { sound: 'double consonants', re: /([bcdfglmnprstvz])\1/i }],
  es: [{ sound: 'rolled RR', re: /rr|^r/i }, { sound: 'J', re: /j|g[ei]/i }, { sound: 'Ñ', re: /ñ/i }, { sound: 'LL', re: /ll/i }],
};

const DIM_FOR_SKILL: Record<keyof SkillProgress, MasteryDimension[]> = {
  listening: ['listeningRecognition'], speaking: ['speaking'], pronunciation: ['pronunciation'], reading: ['reading'], writing: ['writing', 'spelling'],
};

export class ParentInsightsService {
  private readonly curriculum: CurriculumEngine;
  private readonly story: StoryEngine;
  constructor(private readonly content: ContentIndex) {
    this.curriculum = new CurriculumEngine(content);
    this.story = new StoryEngine(content);
  }

  private label(itemId: string, state: ChildState): string {
    const lex = this.content.get(itemId, state.child.targetLanguage);
    if (lex) return lex.text;
    return this.content.phrase(itemId, state.child.targetLanguage)?.text ?? itemId;
  }

  metrics(state: ChildState, now: Date, locale: InterfaceLocale = 'en'): DashboardMetrics {
    const weekAgo = now.getTime() - 7 * DAY_MS;
    const monthAgo = now.getTime() - 30 * DAY_MS;
    const sessionsWeek = state.sessions.filter((s) => new Date(s.date).getTime() >= weekAgo - DAY_MS);
    const masteryMap = new Map(state.mastery.map((m) => [m.itemId, m]));
    const counts = this.curriculum.stageCounts(masteryMap, state.child.ageBand);
    const concepts = state.mastery.filter((m) => m.itemType === 'concept' && m.attempts > 0);
    const phrasesMastered = state.mastery.filter((m) => m.itemType === 'phrase' && learningBrain.isMastered(m, state.child.ageBand)).length;

    const skills = Object.fromEntries((Object.keys(DIM_FOR_SKILL) as (keyof SkillProgress)[]).map((skill) => {
      const dims = DIM_FOR_SKILL[skill];
      const relevant = concepts.filter((m) => dims.some((d) => m.mastery[d] > 0));
      const avg = relevant.length ? relevant.reduce((s, m) => s + Math.max(...dims.map((d) => m.mastery[d])), 0) / relevant.length : 0;
      return [skill, Math.round(avg)];
    })) as unknown as SkillProgress;

    // Topic strengths
    const byTopic = new Map<string, MasteryRecord[]>();
    for (const m of concepts) {
      const topic = this.content.concepts.get(m.itemId)?.topic;
      if (topic) byTopic.set(topic, [...(byTopic.get(topic) ?? []), m]);
    }
    const unitTitles = new Map(this.content.bundle.units.map((u) => [u.topic, u.title]));
    const topics: TopicStrength[] = [...byTopic.entries()].filter(([, items]) => items.length >= 2).map(([topic, items]) => ({
      topic, label: (unitTitles.get(topic as never)?.[locale] ?? unitTitles.get(topic as never)?.en ?? topic),
      score: Math.round(items.reduce((s, m) => s + unitItemScore(m.mastery, state.child.ageBand), 0) / items.length), items: items.length,
    }));
    const sortedTopics = [...topics].sort((a, b) => b.score - a.score);

    const needsPractice = state.mastery
      .filter((m) => m.attempts > 0 && learningBrain.summarize(m, state.child.ageBand).status === 'struggling')
      .slice(0, 8)
      .map((m) => ({ itemId: m.itemId, label: this.label(m.itemId, state), image: this.content.concepts.get(m.itemId)?.image ?? '💬' }));

    // Pronunciation trend: 4 weekly buckets
    const trend: { week: string; score: number | null }[] = [];
    for (let w = 3; w >= 0; w--) {
      const start = startOfWeek(new Date(now.getTime() - w * 7 * DAY_MS));
      const end = start.getTime() + 7 * DAY_MS;
      const inWeek = state.speech.filter((s) => { const t = new Date(s.at).getTime(); return t >= start.getTime() && t < end; });
      trend.push({ week: toLocalDateKey(start), score: inWeek.length ? Math.round(inWeek.reduce((s, x) => s + x.score, 0) / inWeek.length) : null });
    }

    // Focus sounds from failed vs successful speaking
    const sounds = TRICKY_SOUNDS[state.child.targetLanguage].map(({ sound, re }) => {
      const attempts = state.speech.filter((s) => re.test(s.expected));
      const ok = attempts.filter((s) => s.accepted && s.score >= 70).length;
      return { sound, attempts: attempts.length, successRate: attempts.length ? Math.round((ok / attempts.length) * 100) : 100 };
    }).filter((s) => s.attempts >= 3 && s.successRate < 70).sort((a, b) => a.successRate - b.successRate);

    const days: { date: string; learning: number; free: number }[] = [];
    for (let d = 6; d >= 0; d--) {
      const key = toLocalDateKey(new Date(now.getTime() - d * DAY_MS));
      const ss = state.sessions.filter((s) => s.date === key);
      days.push({ date: key, learning: Math.round(ss.reduce((s, x) => s + x.learningMs, 0) / 60000), free: Math.round(ss.reduce((s, x) => s + x.freePlayMs, 0) / 60000) });
    }

    const stage = this.content.bundle.stages.find((s) => s.stage === state.progress.stage)!;
    const track = this.content.track(trackIdOf(state.child));
    const unlocked = this.story.unlockedWorlds(state.story, counts.mastered, this.content.track(trackIdOf(state.child)).arcIds[0]);
    const unit = this.content.units.get(state.progress.currentUnitId);
    return {
      weeklyMinutes: Math.round(sessionsWeek.reduce((s, x) => s + x.learningMs, 0) / 60000),
      monthlyMinutes: Math.round(state.sessions.filter((s) => new Date(s.date).getTime() >= monthAgo).reduce((s, x) => s + x.learningMs, 0) / 60000),
      freePlayMinutesWeek: Math.round(sessionsWeek.reduce((s, x) => s + x.freePlayMs, 0) / 60000),
      journeysCompletedWeek: sessionsWeek.filter((s) => s.journeyCompleted).length,
      journeysCompletedTotal: state.sessions.filter((s) => s.journeyCompleted).length,
      wordsExposed: counts.exposed,
      wordsPracticed: counts.practiced,
      wordsMastered: counts.mastered,
      phrasesMastered,
      sentencesSpoken: state.speech.filter((s) => s.accepted && s.expected.trim().split(/\s+/).length >= 3).length,
      speakingAttempts: state.speech.length,
      speakingAttemptsWeek: state.speech.filter((s) => new Date(s.at).getTime() >= weekAgo).length,
      pronunciationTrend: trend,
      skills,
      worldsUnlocked: unlocked.length,
      worldsTotal: this.content.bundle.worlds.length,
      episodesCompleted: state.story.completedEpisodeIds.length,
      stage: state.progress.stage,
      stageName: stage.name[locale] ?? stage.name.en,
      track: {
        id: track.id, name: track.name[locale] ?? track.name.en, emoji: track.emoji, color: track.color,
        ages: `${track.ages.min}–${track.ages.max}`, isAgeDefault: track.id === state.child.ageBand,
        dailyMinutes: `${track.dailyMinutes.min}–${track.dailyMinutes.max}`,
      },
      graduation: {
        next: track.graduation.nextTrack,
        nextName: track.graduation.nextTrack ? (this.content.track(track.graduation.nextTrack).name[locale] ?? this.content.track(track.graduation.nextTrack).name.en) : null,
        target: track.graduation.wordsMastered,
        progress: Math.min(1, counts.mastered / track.graduation.wordsMastered),
        ready: !!track.graduation.nextTrack && counts.mastered >= track.graduation.wordsMastered,
      },
      cefr: stage.cefr === 'preA1' ? 'Pre-A1' : stage.cefr,
      currentUnit: unit ? unit.title[locale] ?? unit.title.en : '—',
      strongAreas: sortedTopics.slice(0, 3),
      developingAreas: sortedTopics.length > 3 ? sortedTopics.slice(-3).reverse() : [],
      needsPractice,
      focusSounds: sounds.slice(0, 3),
      dailyMinutes: days,
      reviewForecast: [],
    };
  }

  /** Plain-language summary lines ("This week Maria practised 74 words and confidently used 38 of them."). */
  summarize(state: ChildState, m: DashboardMetrics, now: Date, locale: InterfaceLocale = 'en'): string[] {
    const name = state.child.nickname;
    const weekAgo = now.getTime() - 7 * DAY_MS;
    const practicedWeek = new Set(state.history.filter((h) => new Date(h.at).getTime() >= weekAgo && h.total > 0).flatMap((h) => h.itemIds));
    const confident = state.mastery.filter((r) => practicedWeek.has(r.itemId) && r.mastery.confidence >= 60 && r.consecutiveCorrect >= 2).length;
    const lines: string[] = [];
    const langName = { en: 'English', fr: 'French', de: 'German', it: 'Italian', es: 'Spanish' }[state.child.targetLanguage];
    if (locale === 'ar') {
      lines.push(practicedWeek.size
        ? `هذا الأسبوع تدرّب ${name} على ${practicedWeek.size} كلمة${confident > 0 ? ` واستخدم ${confident} منها بثقة` : ' ويكتسب الثقة في استخدامها'}.`
        : `لم يبدأ ${name} مغامرات هذا الأسبوع بعد — مغامرة جديدة بانتظاره!`);
      if (m.strongAreas.length) lines.push(`أقوى المجالات: ${m.strongAreas.map((s) => s.label).join('، ')}.`);
      if (m.developingAreas.length || m.focusSounds.length) {
        const parts = [...m.developingAreas.slice(0, 2).map((d) => d.label), ...m.focusSounds.slice(0, 1).map((s) => `صوت ${s.sound}`)];
        lines.push(`يحتاج إلى مزيد من التدريب على: ${parts.join('، ')}.`);
      }
      if (m.needsPractice.length) lines.push(`الأسبوع القادم ستتضمن المغامرات تلقائيًا المزيد من الأنشطة حول: ${m.needsPractice.slice(0, 3).map((n) => n.label).join('، ')}.`);
      return lines;
    }
    lines.push(practicedWeek.size
      ? `This week ${name} practised ${practicedWeek.size} ${langName} word${practicedWeek.size === 1 ? '' : 's'}${confident > 0 ? ` and confidently used ${confident} of them` : ' and is building confidence with them'}.`
      : `${name} hasn't started this week's adventures yet — a new one is waiting!`);
    if (m.strongAreas.length) lines.push(`${name} is strongest in ${joinList(m.strongAreas.map((s) => s.label.toLowerCase()))} vocabulary.`);
    const developing = [...m.developingAreas.slice(0, 2).map((d) => d.label.toLowerCase()), ...m.focusSounds.slice(0, 1).map((s) => `the ${s.sound} sound`)];
    if (developing.length) lines.push(`${name} currently needs additional practice with ${joinList(developing)}.`);
    if (m.needsPractice.length) lines.push(`Next week LingoWorld will automatically include more activities involving ${joinList(m.needsPractice.slice(0, 3).map((n) => `“${n.label}”`))}.`);
    if (m.sentencesSpoken > 0) lines.push(`${name} has spoken ${m.sentencesSpoken} full sentence${m.sentencesSpoken === 1 ? '' : 's'} out loud so far.`);
    return lines;
  }

  recommendedFocus(m: DashboardMetrics, locale: InterfaceLocale = 'en'): string[] {
    const out: string[] = [];
    const ar = locale === 'ar';
    if (m.skills.speaking < m.skills.listening - 20) out.push(ar ? 'شجّع طفلك على التحدث بصوت عالٍ مع ميمو — التحدث يتأخر عن الاستماع.' : 'Encourage speaking out loud with Mimo — speaking is behind listening.');
    if (m.focusSounds[0]) out.push(ar ? `اطلب من طفلك تقليد لومي في نطق صوت ${m.focusSounds[0].sound}.` : `Practise the ${m.focusSounds[0].sound} sound together using “Say It Like Lumi”.`);
    if (m.weeklyMinutes < 30) out.push(ar ? 'حاول ٣–٤ مغامرات قصيرة في الأسبوع؛ الانتظام أهم من المدة.' : 'Aim for 3–4 short adventures a week; regularity matters more than length.');
    if (m.skills.reading < 30 && m.stage >= 2) out.push(ar ? 'جرّب «اقرأ بنفسي» في المكتبة لتقوية القراءة.' : 'Try “Read Myself” in the Library to build reading.');
    if (!out.length) out.push(ar ? 'تقدم رائع! استمروا كما أنتم واحتفلوا بالإنجازات معًا.' : 'Great progress — keep the rhythm and celebrate milestones together.');
    return out;
  }

  weeklyReport(state: ChildState, now: Date, locale: InterfaceLocale = 'en'): WeeklyReport {
    const m = this.metrics(state, now, locale);
    const weekStart = startOfWeek(now);
    const weekStartMs = weekStart.getTime();
    const newVocab = state.mastery
      .filter((r) => r.itemType === 'concept' && r.firstSeenAt && new Date(r.firstSeenAt).getTime() >= weekStartMs)
      .slice(0, 24)
      .map((r) => ({ itemId: r.itemId, text: this.label(r.itemId, state), image: this.content.concepts.get(r.itemId)?.image ?? '💬' }));
    const worlds = new Map<string, number>();
    for (const h of state.history) if (h.worldId && new Date(h.at).getTime() >= weekStartMs) worlds.set(h.worldId, (worlds.get(h.worldId) ?? 0) + 1);
    const fav = [...worlds.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const favWorld = fav ? this.content.worlds.get(fav) : undefined;
    const achievements = state.inventory.achievementIds
      .map((id) => this.content.bundle.achievements.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => !!a)
      .map((a) => `${a.emoji} ${a.name[locale] ?? a.name.en}`);
    const summary = this.summarize(state, m, now, locale);
    return {
      id: `${state.child.id}:${state.child.targetLanguage}:${toLocalDateKey(weekStart)}`,
      childId: state.child.id,
      language: state.child.targetLanguage,
      weekStart: toLocalDateKey(weekStart),
      generatedAt: now.toISOString(),
      headline: locale === 'ar' ? `أسبوع ${state.child.nickname} في لينغو وورلد` : `${state.child.nickname}'s week in LingoWorld`,
      summary,
      achievements,
      skills: m.skills,
      progress: { wordsPracticed: m.wordsPracticed, wordsMastered: m.wordsMastered, minutes: m.weeklyMinutes, journeys: m.journeysCompletedWeek },
      recommendedActions: this.recommendedFocus(m, locale),
      favoriteAdventure: favWorld ? `${favWorld.emoji} ${favWorld.name[locale] ?? favWorld.name.en}` : null,
      newVocabulary: newVocab,
      nextWeekPlan: summary.find((s) => s.startsWith('Next week') || s.startsWith('الأسبوع القادم')) ?? (locale === 'ar' ? 'سنواصل القصة مع كلمات جديدة.' : 'The story continues with new words and plenty of review.'),
    };
  }
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
