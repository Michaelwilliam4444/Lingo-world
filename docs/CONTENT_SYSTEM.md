# Content system

## Model

| Type | Key idea |
|---|---|
| **Concept** (`vocabulary`) | Language-neutral meaning (`food.apple`): topic, word class, image, difficulty, age bands, CEFR, stage, tags, confusables |
| **Lexeme** | Concept in one language: text, gender, adjective forms, invariable/pre-nominal flags, article overrides, German oblique form, accepted speech variants, syllables, audio asset ids |
| **Phrase** | Curated sentence per language (never machine-assembled): gloss, concepts practised, accepted variants |
| **Grammar pattern** | `np`, `this-is`, `i-see`, `i-have`, `give-me`, `where-is`, `is-adjective`, `location` |
| **Curriculum unit** | ≤6 concepts + phrases + patterns + goals + prerequisites + mastery threshold |
| **World** | Palette, topics, unlock rule, landmarks, hidden items, premium flag |
| **Story arc / Episode / Beat** | Episodes = authored journeys; beats = scenes with lines, interaction (speak, choice, activity, tap) and memory callbacks |
| **Game definition / template** | 30 types → 8 mechanics; templates set difficulty, success rules, scoring, hints |
| **Book, Song, Role-play** | Sentences are phrase ids or pattern templates, so each exists in all 5 languages automatically |
| **Reward, Achievement** | Deterministic |

## Why concepts + a realizer?

One curriculum skeleton serves every language. The grammar realizer (`src/curriculum/grammar.ts`) renders correct sentences for each language: English a/an; French elision, pre-nominal adjectives, *vieil/nouvel*, contractions (du/au); German gender × case × article-type adjective endings, weak nouns (*den Elefanten*), *im/am/zum*; Italian *il/lo/l'/un'*, contractions (*nel/sul/al*); Spanish *el agua*, *¿¡*, *del/al*. Uncountable nouns avoid "a water". Every book/song/episode line is checked in all languages by `npm run content:validate`.

## Seed content (`src/content`)

- `lexicon/rows.ts` — 350 concepts in a compact, reviewable DSL (`"Apfel/m"`, `"rosso|rossa"`, `"lila!"`, `"joli|jolie;pre"`, `";alt=zumo"`). 27 required topics + adventure vocabulary.
- `phrases.ts` — 66 phrases × 5 languages (greetings, feelings, routine, directions/voice commands, questions, weather, shopping, restaurant, travel, friends, doctor, school, story).
- `curriculum.ts` — builds 98 units in authored topic order (stages 1–4) plus consolidation units (stages 5–6).
- `world.ts` — 6 characters, 6 stages, 8 grammar patterns, 20 worlds, 30 games, 37 rewards, 11 achievements.
- `story.ts` — Season 1 *The Golden Key* (12 episodes, 8 worlds, branching + callbacks) and 7 more arcs (Dragon Egg, Forest Mystery, Space Signal, Dinosaur Map, Secret Castle Room, Underwater City, seasonal Winter Wonder).
- `library.ts` — 12 books, 9 original songs/chants, 9 role-play scenarios (new friend, playground, shop, restaurant, doctor, class, birthday, airport, hotel).

## Scale: 365 days and beyond

Journeys are generated, not stored: each day combines curriculum objectives, reviews, an episode, game skins, difficulty, interests and sentence patterns. With 31 episodes, 30 games and hundreds of words the number of distinct journeys is effectively unbounded; arcs rotate, replays re-skin. Adding an arc, world or unit is a CMS operation — no code changes.

## Versioning

Bundles are immutable releases (`content_bundles.version` + checksum). Learner progress references stable ids (concept ids, unit ids, episode ids), so publishing never resets children: new units appear ahead of the learner; removed units are skipped (`CurriculumEngine.advance` follows the current ordered list). Each unit/episode has a `version` field for analytics comparisons.

## Publishing pipeline

CMS draft → `validateBundle` (schema + referential + all-language rendering) → publish → `/api/admin/publish` (editor role check, re-validation, upsert of normalised tables via `src/admin/tableRows.ts`, immutable release row, audit log) → apps load it on next start. The same mapper generates `supabase/seed.sql`.

## Media

Assets live in storage (`content-media` bucket or a CDN), referenced as `asset:<path>`. `AudioService` prefers human recordings (cached with the Cache API) and falls back to device TTS.
