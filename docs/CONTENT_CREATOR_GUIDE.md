# Content creator guide

## Voice & tone

- Characters are warm and encouraging. Never "wrong" — use "Almost!", "Try again!", "Listen again!".
- Zuzu makes funny language mistakes so the child can correct him; mistakes are never about the child.
- Cliffhangers create curiosity ("Light pours out… Tomorrow…"), never pressure ("Don't lose your streak!").
- Avoid assumptions about religion, holidays, family structure or gender. We never ask a child's gender; first-person phrases use gender-neutral constructions (e.g. French "J'ai faim" rather than "Je suis content/contente").
- All music and lyrics must be original, licensed or royalty-free (record the license in the media library).

## Adding a word

1. Vocabulary → New: `id` = `topic.word` (e.g. `food.kiwi`), topic, word class, image (emoji or `asset:`), stage, age bands, tags. Add `confusableWith` for hard distractors.
2. Translations of words → one lexeme per language. Nouns need `gender` (except English). Adjectives need `forms {m,f}` (French, Italian, Spanish) or `invariable: true`. French pre-nominal adjectives: `preNominal: true` (+ `mVowelForm` for vieil/nouvel). German weak nouns: `obliqueForm` (Elefanten). Accepted alternatives for speech: `variants`.
3. Add the concept to a curriculum unit (≤6 concepts per unit is the sweet spot).
4. Check the preview row for all five languages, then send for native-speaker review.

## Writing an episode

An episode is a list of beats. Proven template:

1. **Intro** — 2–3 short lines; one may carry a `target` phrase.
2. **Discover** — Pico introduces today's word: `target: { slot: 'focus1', pattern: 'this-is' }`. Interaction: `speak` with `expect: { slot: 'focus1' }`.
3. **Activity** — `families: ['listening','matching']` and a purpose line. The engine picks the game.
4. **Choice** (optional) — `choiceKey` must be unique and stable (e.g. `gk.puppy`); 2 options with emoji.
5. **Activity** — a different family.
6. **Finale** — payoff line, optionally `memoryKey` on the episode.
7. **Cliffhanger** — 1–2 lines ending with "Tomorrow…".

Use `{name}` for the child's nickname and `{mimo}` for the companion's name. Add `memoryCallbacks` to later beats to reference earlier choices (`optionId: '*'` = any choice). Keep each line under ~20 words; Little Explorers hear everything read aloud.

Narrative text is authored in English + Arabic; other interface languages go through Translations.

## Books & songs

Each page/line is either `{ phraseId }` or `{ template, slots }` with templates `word`, `this-is`, `i-see`, `i-have`, `give-me`, `where-is`, `is-adjective`, `location` and slots `noun`, `adj`, `prep`, `object`, `predicate`. The system writes grammatical sentences in all five languages — check the preview. Add a quiz question whose answer is a concept.

## Role-plays

A role-play is a list of turns: the partner says an approved phrase, the child answers with one of 1–3 approved reply phrases. Keep replies short and useful in real life.

## Before publishing

- Dashboard shows **Ready to publish** (no validation errors).
- Native-speaker review done for new lexemes/phrases.
- Preview the journey in at least two languages and both a young and an older age band.
- Write release notes.
