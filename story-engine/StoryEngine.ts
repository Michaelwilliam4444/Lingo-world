import type { InterfaceLocale, LearningLanguage, StageNumber } from '@/types/core';
import type { Episode, LocalizedText, NarrativeLine, StoryArc, World } from '@/types/content';
import type { StoryState } from '@/types/learner';
import type { ContentIndex } from '@/content';

/**
 * StoryEngine — episodes, branching choices, persistent story memory and world unlocking.
 *
 * Story memory: every choice is stored (choiceKey → optionId) and episodes can carry callbacks
 * that only play when a past choice matches ("You helped me find my puppy last week!").
 * Option id "*" matches any recorded choice for that key.
 */

export interface StoryContext {
  nickname: string;
  mimoName: string;
  locale: InterfaceLocale;
}

export function localize(text: LocalizedText, locale: InterfaceLocale): string {
  return text[locale] ?? text.en;
}

export function fillPlaceholders(text: string, ctx: Pick<StoryContext, 'nickname' | 'mimoName'>): string {
  return text.replaceAll('{name}', ctx.nickname).replaceAll('{mimo}', ctx.mimoName);
}

export function initialStoryState(childId: string, language: LearningLanguage): StoryState {
  return { childId, language, activeArcId: 'golden-key', completedEpisodeIds: [], choices: {}, memories: [], lastEpisodeId: null, pendingCliffhangerEpisodeId: null };
}

export class StoryEngine {
  constructor(private readonly content: ContentIndex) {}

  arcs(): StoryArc[] {
    return this.content.bundle.arcs.filter((a) => a.status === 'published');
  }

  /** Worlds unlocked by story progress or mastery. Premium gating is applied separately by entitlements. */
  /**
   * Worlds open by: start, completed episodes, or words mastered. Episode unlocks count the named arc's
   * episodes OR (for tracks that do not start with that arc) all completed episodes, so every track opens worlds.
   * The worlds of the track's opening season are always open.
   */
  unlockedWorlds(state: StoryState, wordsMastered: number, openingArcId?: string): World[] {
    const opening = new Set(openingArcId ? (this.arcs().find((a) => a.id === openingArcId)?.episodeIds ?? []).map((id) => this.content.episodes.get(id)?.worldId) : []);
    return this.content.bundle.worlds.filter((w) => {
      const u = w.unlock;
      if (u.type === 'start' || opening.has(w.id)) return true;
      if (u.type === 'episodes') {
        const inArc = state.completedEpisodeIds.filter((id) => this.content.episodes.get(id)?.arcId === u.arcId).length;
        const total = state.completedEpisodeIds.length;
        return inArc >= u.episodeCount || (openingArcId !== undefined && openingArcId !== u.arcId && total >= u.episodeCount);
      }
      return wordsMastered >= u.wordsMastered;
    });
  }

  /**
   * Pick today's episode:
   *  1. continue the active arc (cliffhangers pay off the next day);
   *  2. else start the next arc whose world is unlocked & allowed (premium, stage, season);
   *  3. else (everything finished) replay a favourite-free episode — the journey engine makes replays
   *     different by changing slots, games and sentences.
   */
  nextEpisode(state: StoryState, opts: { stage: StageNumber; unlockedWorldIds: Set<string>; premium: boolean; month: number; rngPick: <T>(items: T[]) => T; arcIds?: string[] }): Episode {
    const trackArcs = opts.arcIds;
    const opening = trackArcs?.[0] ?? 'golden-key';
    const inTrack = (a: StoryArc) => !trackArcs || trackArcs.includes(a.id);
    const allowedArc = (a: StoryArc) => inTrack(a) && (!a.premium || opts.premium) && this.seasonOk(a, opts.month);
    const rank = (arcId: string) => (trackArcs ? trackArcs.indexOf(arcId) : 0);
    const nextInArc = (arc: StoryArc) => arc.episodeIds.map((id) => this.content.episodes.get(id)!).find((e) => e && !state.completedEpisodeIds.includes(e.id));

    const active = this.arcs().find((a) => a.id === state.activeArcId);
    if (active && allowedArc(active)) {
      const ep = nextInArc(active);
      if (ep && (opts.unlockedWorldIds.has(ep.worldId) || active.id === opening)) return ep;
    }
    const candidates = this.arcs()
      .filter(allowedArc)
      .map((a) => nextInArc(a))
      .filter((e): e is Episode => !!e && (e.arcId === opening || (e.minStage <= Math.max(opts.stage, 2) && opts.unlockedWorldIds.has(e.worldId))));
    if (candidates.length) return candidates.sort((a, b) => rank(a.arcId) - rank(b.arcId) || a.order - b.order)[0]!;

    // Everything available is complete: replay (never the most recent one).
    const replayable = this.content.bundle.episodes.filter((e) => e.id !== state.lastEpisodeId && opts.unlockedWorldIds.has(e.worldId)
      && (!trackArcs || trackArcs.includes(e.arcId))
      && (!this.content.bundle.arcs.find((a) => a.id === e.arcId)?.premium || opts.premium));
    return opts.rngPick(replayable.length ? replayable : this.content.bundle.episodes);
  }

  private seasonOk(arc: StoryArc, month: number): boolean {
    if (!arc.seasonal) return true;
    // Seasonal packs are shown in their season (northern-hemisphere default; localisable per market).
    const seasons: Record<string, number[]> = { winter: [12, 1, 2], spring: [3, 4, 5], summer: [6, 7, 8], autumn: [9, 10, 11], 'back-to-school': [8, 9] };
    const months = seasons[arc.seasonal];
    return months ? months.includes(month) : true;
  }

  /** Lines for a beat with memory callbacks resolved against past choices. */
  resolveLines(lines: NarrativeLine[], callbacks: { choiceKey: string; optionId: string; line: NarrativeLine }[] | undefined, state: StoryState): NarrativeLine[] {
    const extra = (callbacks ?? []).filter((cb) => {
      const chosen = state.choices[cb.choiceKey];
      return chosen !== undefined && (cb.optionId === '*' || cb.optionId === chosen);
    });
    // At most one callback per beat keeps the pace snappy.
    return extra.length ? [...lines.slice(0, 1), extra[0]!.line, ...lines.slice(1)] : lines;
  }

  recordChoice(state: StoryState, choiceKey: string, optionId: string): StoryState {
    return { ...state, choices: { ...state.choices, [choiceKey]: optionId } };
  }

  completeEpisode(state: StoryState, episode: Episode, now: Date, memoryKey?: string): StoryState {
    const completed = [...new Set([...state.completedEpisodeIds, episode.id])];
    const arc = this.content.bundle.arcs.find((a) => a.id === episode.arcId);
    const arcDone = !!arc && arc.episodeIds.every((id) => completed.includes(id));
    let activeArcId = state.activeArcId;
    if (arcDone) {
      const nextArc = this.arcs().find((a) => a.id !== arc!.id && a.episodeIds.some((id) => !completed.includes(id)));
      activeArcId = nextArc?.id ?? state.activeArcId;
    } else if (arc) activeArcId = arc.id;
    const memories = memoryKey ? [...state.memories, { key: memoryKey, at: now.toISOString(), episodeId: episode.id }] : state.memories;
    return {
      ...state, completedEpisodeIds: completed, activeArcId, memories,
      lastEpisodeId: episode.id, pendingCliffhangerEpisodeId: episode.cliffhanger ? episode.id : null,
    };
  }

  /** "Previously on…" recap line for the start of a journey after a cliffhanger. */
  recap(state: StoryState, locale: InterfaceLocale): string | null {
    if (!state.pendingCliffhangerEpisodeId) return null;
    const ep = this.content.episodes.get(state.pendingCliffhangerEpisodeId);
    if (!ep?.cliffhanger?.[0]) return null;
    return localize(ep.cliffhanger[0].text, locale);
  }

  arcProgress(state: StoryState): { arc: StoryArc; done: number; total: number }[] {
    return this.arcs().map((arc) => ({
      arc, total: arc.episodeIds.length, done: arc.episodeIds.filter((id) => state.completedEpisodeIds.includes(id)).length,
    }));
  }
}
