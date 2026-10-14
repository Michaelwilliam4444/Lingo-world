import type { ContentBundle } from '@/types/content';

/**
 * Maps a ContentBundle onto the normalised CMS tables (supabase/migrations).
 * Used by the seed generator (→ SQL) and by the publish endpoint (→ upserts with the service role).
 * Order matters: parents before children (foreign keys).
 */
export type TableRows = { table: string; conflict: string; rows: Record<string, unknown>[] }[];

export function bundleToTableRows(b: ContentBundle): TableRows {
  const published = 'published';
  return [
    { table: 'languages', conflict: 'code', rows: [['en', 'English', 'en-GB', 1], ['fr', 'Français', 'fr-FR', 2], ['de', 'Deutsch', 'de-DE', 3], ['it', 'Italiano', 'it-IT', 4], ['es', 'Español', 'es-ES', 5]]
      .map(([code, name, tts, sort]) => ({ code, name, tts_locale: tts, sort_order: sort })) },
    { table: 'interface_languages', conflict: 'code', rows: [['en', 'English', false], ['ar', 'العربية', true], ['fr', 'Français', false], ['de', 'Deutsch', false], ['it', 'Italiano', false], ['es', 'Español', false]]
      .map(([code, name, rtl]) => ({ code, name, rtl })) },
    { table: 'curriculum_levels', conflict: 'stage', rows: b.stages.map((s) => ({ stage: s.stage, name: s.name, cefr: s.cefr, target_cumulative_words: s.targetCumulativeWords, description: s.description })) },
    { table: 'skills', conflict: 'id', rows: ['listening', 'speaking', 'pronunciation', 'reading', 'writing', 'vocabulary', 'grammar'].map((id) => ({ id, name: { en: id } })) },
    { table: 'grammar_patterns', conflict: 'id', rows: b.grammarPatterns.map((g) => ({ id: g.id, name: g.name, description: g.description, cefr: g.cefr, stage: g.stage, template: g.template })) },
    { table: 'vocabulary', conflict: 'id', rows: b.concepts.map((c) => ({ id: c.id, topic: c.topic, word_class: c.wordClass, image: c.image, difficulty: c.difficulty, age_bands: c.ageBands, cefr: c.cefr, stage: c.stage, tags: c.tags, confusable_with: c.confusableWith ?? [], status: published })) },
    { table: 'lexemes', conflict: 'concept_id,language', rows: b.lexemes.map((l) => ({ concept_id: l.conceptId, language: l.language, text: l.text, gender: l.gender ?? null, plural: l.plural ?? null, forms: l.forms ?? null, article_override: l.articleOverride ?? null,
      invariable: !!l.invariable, pre_nominal: !!l.preNominal, m_vowel_form: l.mVowelForm ?? null, oblique_form: l.obliqueForm ?? null, variants: l.variants ?? [], syllables: l.syllables ?? [], phoneme_focus: l.phonemeFocus ?? [], review_status: 'review' })) },
    { table: 'phrases', conflict: 'id,language', rows: b.phrases.map((p) => ({ id: p.id, language: p.language, text: p.text, gloss: p.gloss, topic: p.topic, concept_ids: p.conceptIds, cefr: p.cefr, stage: p.stage, accepted_variants: p.acceptedVariants ?? [], status: published })) },
    { table: 'curriculum_units', conflict: 'id', rows: b.units.map((u) => ({ id: u.id, stage: u.stage, sort_order: u.order, topic: u.topic, title: u.title, skills: u.skills, concept_ids: u.conceptIds, phrase_ids: u.phraseIds, grammar_pattern_ids: u.grammarPatternIds, goals: u.goals, prerequisites: u.prerequisites, mastery_threshold: u.masteryThreshold, age_bands: u.ageBands, status: published, version: u.version })) },
    { table: 'characters', conflict: 'id', rows: b.characters.map((c) => ({ id: c.id, name: c.name, role: c.role, traits: c.traits, emoji: c.emoji, color: c.color, voice: c.voice })) },
    { table: 'worlds', conflict: 'id', rows: b.worlds.map((w) => ({ id: w.id, sort_order: w.order, name: w.name, emoji: w.emoji, palette: w.palette, topics: w.topics, stage: w.stage, unlock: w.unlock, premium: w.premium, hidden_items: w.hiddenItems, landmarks: w.landmarks, ambient: w.ambient, status: published })) },
    { table: 'story_arcs', conflict: 'id', rows: b.arcs.map((a) => ({ id: a.id, title: a.title, description: a.description, season: a.season, world_ids: a.worldIds, premium: a.premium, seasonal: a.seasonal ?? null, status: a.status })) },
    { table: 'journeys', conflict: 'id', rows: b.episodes.map((e) => ({ id: e.id, arc_id: e.arcId, sort_order: e.order, world_id: e.worldId, title: e.title, summary: e.summary, topics: e.topics, cliffhanger: e.cliffhanger ?? null, reward_ids: e.rewardIds, min_stage: e.minStage, memory_key: e.memoryKey ?? null, status: e.status, version: e.version })) },
    { table: 'journey_scenes', conflict: 'id', rows: b.episodes.flatMap((e) => e.beats.map((bt, i) => ({ id: bt.id, journey_id: e.id, sort_order: i, background: bt.background, lines: bt.lines, interaction: bt.interaction ?? null, memory_callbacks: bt.memoryCallbacks ?? null }))) },
    { table: 'tracks', conflict: 'id', rows: (b.tracks ?? []).map((t, i) => ({ id: t.id, sort_order: i, name: t.name, ages: t.ages, tagline: t.tagline, description: t.description, emoji: t.emoji, color: t.color,
      stages: t.stages, unit_ids: t.unitIds, arc_ids: t.arcIds, game_types: t.gameTypes, daily_minutes: t.dailyMinutes, new_items_per_day: t.newItemsPerDay, max_games_per_journey: t.maxGamesPerJourney,
      review_items_per_journey: t.reviewItemsPerJourney, features: t.features, navigation: t.navigation, skills_focus: t.skillsFocus, graduation: t.graduation })) },
    { table: 'games', conflict: 'type', rows: b.games.map((g) => ({ type: g.type, name: g.name, emoji: g.emoji, family: g.family, skills: g.skills, evidence: g.evidence, age_bands: g.ageBands, min_stage: g.minStage, needs_microphone: g.needsMicrophone, needs_reading: g.needsReading, items_by_difficulty: g.itemsByDifficulty, premium: g.premium })) },
    { table: 'game_templates', conflict: 'id', rows: b.gameTemplates.map((t) => ({ id: t.id, type: t.type, name: t.name, topics: t.topics === 'any' ? null : t.topics, difficulty: t.difficulty, learning_skill: t.learningSkill, success_rules: t.successRules, scoring: t.scoring, hints: t.hints, age_bands: t.ageBands, status: t.status })) },
    { table: 'rewards', conflict: 'id', rows: b.rewards.map((r) => ({ id: r.id, kind: r.kind, name: r.name, emoji: r.emoji, premium: r.premium })) },
    { table: 'achievements', conflict: 'id', rows: b.achievements.map((a) => ({ id: a.id, name: a.name, description: a.description, emoji: a.emoji, rule: a.rule })) },
    { table: 'books', conflict: 'id', rows: b.books.map((bk) => ({ id: bk.id, title: bk.title, cover_emoji: bk.coverEmoji, world_id: bk.worldId, topic: bk.topic, age_bands: bk.ageBands, stage: bk.stage, pages: bk.pages, quiz: bk.quiz, premium: bk.premium, status: bk.status })) },
    { table: 'songs', conflict: 'id', rows: b.songs.map((s) => ({ id: s.id, title: s.title, emoji: s.emoji, kind: s.kind, topic: s.topic, lines: s.lines, bpm: s.bpm, premium: s.premium })) },
    { table: 'roleplays', conflict: 'id', rows: b.roleplays.map((r) => ({ id: r.id, title: r.title, emoji: r.emoji, topic: r.topic, partner: r.partner, min_stage: r.minStage, turns: r.turns })) },
  ];
}
