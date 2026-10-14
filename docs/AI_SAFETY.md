# AI safety (LingoAI)

## Rule

> Educational content defines **what** the child learns. AI only influences **how** it is presented — and only by choosing among approved options.

## What LingoAI may do

| Task | Input | Output | Fallback |
|---|---|---|---|
| `roleplay-reply` | The child's (imperfect) utterance + the approved reply options | The id of the approved reply the child meant | On-device similarity match |
| `story-variation` | Episode + interests + approved variations | One variation id | Seeded random choice |
| `parent-explanation` | Up to 12 deterministic facts | 2–3 sentences for a **parent** | The facts joined verbatim |

## What it may never do

- Free chat with a child; generating target-language sentences children learn from; changing curriculum, mastery, difficulty, rewards or entitlements; showing generated text to children.

## Controls

- **Allow-listed outputs:** `validateChoice` rejects any id not in the provided list → deterministic fallback.
- **Schema-validated requests:** `/api/ai` accepts only `AiTaskSchema` (Zod), with length limits.
- **Child text screening before any provider call:** `screenChildText` redacts emails, links, phone numbers, handles and addresses, and blocks unsafe content (then no provider call is made).
- **Strict system prompt:** choose only from options, no personal data, no links/brands, no negativity, urgency or purchase prompts, JSON only.
- **Parent prose sanitised:** markup/links stripped, length capped.
- **Server-side keys only,** rate limiting (30/min/IP), 6 s timeout, low temperature, small max tokens.
- **Provider-agnostic:** `AIProvider` adapters (Anthropic, OpenAI, mock). With `AI_PROVIDER=mock` the product works identically.
- **Feature flag:** `AIStoryVariation` off by default.

## Speech

Speech recognition is not generative AI but processes children's voices: audio is processed transiently for scoring and never stored (see CHILD_PRIVACY.md). Only transcripts and scores are kept.

## Review

Before enabling a provider in production: run the role-play and story-variation tasks against a red-team set (personal-data bait, unsafe phrases, prompt injection inside child utterances) and confirm 100 % of outputs are allow-listed ids.
