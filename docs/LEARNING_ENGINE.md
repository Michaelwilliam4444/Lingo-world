# Learning engine

All engines are pure functions over plain data and are covered by `tests/unit`. The single entry point for changing a learner's state is `LearningOrchestrator`.

## Evidence

Every activity emits `LearningEvidence { itemId, itemType, kind, correct, score?, hintsUsed, responseMs?, at }`. Kinds: `exposure-see`, `exposure-hear`, `image-recognition`, `listening-recognition`, `speaking`, `pronunciation`, `reading`, `spelling`, `writing`, `sentence-usage`. Games map rounds to evidence automatically (`GameEngine.evidenceForRound`).

## LearningBrain — 12 mastery dimensions

`seen, heard, imageRecognition, listeningRecognition, speaking, pronunciation, reading, spelling, writing, sentenceUsage, retention, confidence` (0–100, never shown to children).

- Learning rate starts at 0.5 and decays to 0.2 with evidence, so one lucky tap can't "master" a word.
- Wrong answers pull down at 60 % of the strength correct answers push up (children guess).
- Hints reduce the target (−15 % each, max −45 %).
- **Retention** rises only on successful recall after a gap ≥ ~20 h (bigger gaps → bigger gains), falls on failure after a gap.
- **Confidence** rises with fast, unaided correct answers and streaks.
- Status: `new → learning → practiced → mastered`, or `struggling` (3 misses in a row or <40 % after 4 attempts). "Mastered" uses age-appropriate core dimensions (a 4-year-old is never judged on writing).

## AdaptiveReviewEngine — spaced repetition for children

SM-2 variant: first intervals 0.25 → 1 → 2 → 4 days, then × ease (1.3–2.8), capped at 45 days so known words keep resurfacing in stories. Quality (0–5) combines correctness, hints and pronunciation scores. Lapses reset to 6 hours. `candidates()` ranks due/overdue/fragile/struggling items; struggling items surface even before due, capped at 2 per session to avoid frustration. Reviews are never flashcards: they become game targets and composed story sentences.

## CurriculumEngine — what is learned

98 units across 6 stages (Pre-A1 → A2-aligned). Each unit: ≤6 concepts, phrases, grammar patterns, skill goals, prerequisite, mastery threshold. New items per day: 3/4/5 by age band, from a frontier of the current unit + 2 ahead, **throttled** when the backlog of weak practised items grows. A unit completes when every word has been met and the average unit score (best receptive channel, best productive channel, retention) passes the threshold. AI can never advance the curriculum.

## DifficultyEngine

Continuous difficulty 1.0–5.0 per child per language, targeting 70–88 % success, capped by age band. It changes presentation only: option count (2–5), similar-sounding/same-topic distractors, audio rate (0.8–1.0), picture support, first-sound hints, sentence complexity (word → article+noun → adjective phrase → full sentence), time pressure (Heroes only). Abandonment lowers difficulty. Items flagged as struggling are presented ~0.8 levels easier.

## AntiBoredomEngine

Scores candidate games: never the same game twice in a row, penalties for recent repeats and same-family steps, bonus for rarely used families (listening, speaking, movement, puzzle, matching, story, creation, memory, music, roleplay), small bonus for inferred favourites, and "graduation" of games a child aces 3× at ≥95 %. Never repeats yesterday's exact sequence (verified in tests).

## NeverSameJourneyEngine

Seed = child + language + date + journeys-today (stable within a day, different every day). Steps:

1. **What:** new items (CurriculumEngine) + due reviews (AdaptiveReviewEngine).
2. **Story:** next episode of the active arc (StoryEngine), honouring unlocks, premium, season. Replays re-skin with new words.
3. **Slots:** `focus1/focus2` filled with today's most important items; narrative lines render them through the grammar realizer.
4. **Beats → steps:** story, speak, choice, activity → a game chosen by AntiBoredom within the beat's families, configured by DifficultyEngine, built by GameEngine (max 2 games for Little Explorers, 3 otherwise).
5. **Phrase moments:** new/due phrases modelled by a character and spoken by the child.
6. **Natural review:** a sentence composed from due words, e.g. *yellow, elephant, under* → "The yellow elephant is under the bridge." (Adventurers/Heroes), interest-weighted.
7. Reward + cliffhanger. A plain-language `rationale` is shown to parents.

## StoryEngine

Episodes (31 seeded) are authored with reusable beats. Choices persist (`choiceKey → optionId`); beats carry `memoryCallbacks` that play only when a past choice matches ("You helped me find the puppy last week!"). Episodes record memories, unlock worlds and set the next cliffhanger, which is recapped at the start of the next day.

## CompanionEngine (Mimo)

Egg → Baby (first journey) → Young (400 XP) → Advanced (1 500) → Specialized (3 500) → Legendary cosmetic (8 000). XP only from learning evidence and completed journeys/exploration/creation — never purchasable. Path (voice/wisdom/explorer/creator) follows what the child does most. Mimo learns a voice command once the child says the action word correctly. Happiness drifts gently (floor 40) with no guilt messaging.

## RewardEngine

Deterministic rewards (no loot boxes): at least 1 star for finishing, episode stickers/items, 11 achievements, optional gentle streak ("Welcome back!" — never loss-framed).

## Simulation test

`tests/unit/journey-simulation.test.ts` plays 40 days as a simulated child in English and 8 days per language/age band in all five languages, asserting: every journey is playable; Season 1 runs in order; no consecutive identical sequences; yesterday's words return; a struggled word returns more often than its siblings; review sentences appear; units complete; Mimo evolves; story callbacks fire; determinism per day.

## Age tracks

Every child is on one of three tracks (`TrackDefinition` in `src/types/content.ts`, seed in `src/content/tracks.ts`, editable in the CMS under *Curriculum → Age tracks*, stored in the `tracks` table). The track id equals the age band by default; `ChildProfile.trackId` overrides it when a parent moves the child (`trackIdOf(child)`).

| | Little Explorers 4–5 | Adventurers 6–8 | Heroes 9–11 |
|---|---|---|---|
| Syllabus | stages 1–3, concrete topics only | stages 1–4 | stages 1–6 |
| Opening season | Mimo's First Friends | The Golden Key | The Clocktower Code |
| Games / journey | 18 types, max 2 | 30 types, max 3 | 26 types, max 3 |
| New items / day · reviews | 3 · 4 | 4 · 6 | 5 · 7 |
| Text, review sentences | no, no | yes, yes | yes, yes (+ writing, free role-play) |
| Navigation | Adventure, Play, Mimo, Books, Music | Adventure, Explore, Play, Create, Mimo | Adventure, Explore, Play, Create, Books |
| Graduation suggestion | 120 mastered → Adventurers | 350 → Heroes | — |

What uses the track: `CurriculumEngine` (unit order, new items per day), `NeverSameJourneyEngine` (game set and budget, review count, review sentences, text visibility), `StoryEngine.nextEpisode` (track seasons in order; the opening season's worlds are always open; world unlocks count all completed episodes for tracks that don't start with the Golden Key), child UI (navigation, game list, text), Parent Zone (dashboard track card, graduation progress, *Move to this track*). `LearningOrchestrator.changeTrack` keeps all mastery, reviews, rewards and Mimo and re-positions the child on the new syllabus. Covered by the "separate age tracks" simulation tests.
