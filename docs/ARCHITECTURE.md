# Architecture

## Principles

1. **The child is the player, the parent is the customer, the curriculum is the product.** The story is the experience; engines make it personal.
2. **Deterministic education, constrained AI.** Curriculum, mastery, review scheduling and every target-language sentence are deterministic code. LingoAI only *chooses among approved options* (see AI_SAFETY.md).
3. **Pure engines, thin UI.** All learning logic is framework-free TypeScript taking `(state, input) → state'`. The same code runs online, offline, in tests and (if desired) on a server.
4. **Data-driven content.** No lesson lives in a component. Content is a versioned `ContentBundle` produced by the CMS.
5. **Provider abstraction everywhere.** Data, speech, TTS, pronunciation, AI, billing, email and analytics each sit behind an interface with a working mock.

## Layers

```
┌──────────────────────── Next.js App Router (src/app) ─────────────────────────┐
│ /play/*  child world   /parent/*  Parent Zone   /admin/*  CMS   /api/*  server │
└───────────────┬───────────────────────────────────────────────────────┬────────┘
                │ Zustand store (src/store/app.ts)                      │ route handlers
┌───────────────▼────────────────────────┐            ┌─────────────────▼──────────────┐
│ Engines (pure TS)                      │            │ Server services                │
│  LearningOrchestrator                  │            │  Stripe / RevenueCat webhooks  │
│   ├ LearningBrain (mastery)            │            │  LingoAI (Anthropic/OpenAI)    │
│   ├ AdaptiveReviewEngine (SRS)         │            │  Pronunciation (Azure)         │
│   ├ DifficultyEngine                   │            │  Publish (service role)        │
│   ├ CurriculumEngine                   │            │  Account deletion, email       │
│   ├ CompanionEngine · RewardEngine     │            └────────────────────────────────┘
│  NeverSameJourneyEngine                │
│   ├ StoryEngine · AntiBoredomEngine    │
│   └ GameEngine → GrammarRealizer       │
│  ParentInsightsService                 │
└───────────────┬────────────────────────┘
┌───────────────▼────────────────────────────────────────────────────────────────┐
│ Services: DataRepository (Local | Supabase) · OfflineSyncService · TTS ·        │
│ SpeechRecognition · PronunciationScorer · AudioService · Analytics · Billing     │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Folder map

| Folder | Responsibility |
|---|---|
| `src/types` | Domain types (core, content, learner, engine) |
| `src/content` | Seed content + `ContentIndex` + Zod schemas/validation |
| `src/curriculum` | Grammar realizer |
| `src/learning-engine` | Brain, review, difficulty, anti-boredom, curriculum, reward, orchestrator |
| `src/journey-engine` | NeverSameJourneyEngine |
| `src/story-engine` | Episodes, branching, memory, world unlocks |
| `src/game-engine` | 30 game types → 8 round mechanics |
| `src/companions` | Mimo |
| `src/speech` | TTS, recognition, pronunciation scoring, audio/SFX |
| `src/services` | Repositories, offline sync, AI, flags, service container |
| `src/billing`, `src/analytics`, `src/parent`, `src/admin` | Plans/entitlements, analytics, insights, CMS logic |
| `src/features` | Feature UI (games, avatar, library, parent forms) |
| `src/components` | Design system + shells |
| `src/i18n` | Interface localization (6 locales, RTL) |

## Key flows

**Daily journey.** Child taps the golden key → `store.todaysJourney()` loads today's stored journey or asks `NeverSameJourneyEngine.compose()` → steps (story, speak, game, choice, reward, cliffhanger) render in `/play/journey` → every answer produces `LearningEvidence` → `LearningOrchestrator.processActivity()` updates mastery, review schedule, difficulty, Mimo, achievements, curriculum → state saved through `OfflineSyncService`.

**Persistence modes.** `NEXT_PUBLIC_DATA_MODE=local` → `LocalRepository` (IndexedDB, PBKDF2 passwords, no server). `supabase` → `SupabaseRepository` (RLS-protected Postgres, incremental upserts) wrapped by `OfflineSyncService` (local-first cache, outbox, merge on reconnect).

**Content release.** CMS edits a draft bundle → validation → publish → Supabase normalised tables + immutable `content_bundles` row → apps fetch the newest bundle on boot (`refreshContent`) and rebuild engines if it validates.

## Design system

"Paper-cut diorama at dusk": a deep-indigo night sky (`night #1b1446`), warm lantern gold (`lantern #ffc94a`) for the one thing to tap, berry (`#e2447a`) for voice, lagoon (`#2ec4b6`) for success, cream paper (`#fff6e3`) cards with **solid offset shadows** that squash when pressed — tactile like paper toys. Type: Grandstander (child), Atkinson Hyperlegible (grown-ups; designed for legibility), Lexend (dyslexia option), Baloo Bhaijaan 2 (Arabic). All fonts are self-hosted for offline use.

Tokens live in `tailwind.config.ts` (colours, 1.25 modular type scale, radii `blob/token/tab`, paper shadows, motion keyframes, breakpoints). Components: `Button`, `IconButton`, `Card`, `CharacterToken/CharacterCard`, `WorldCard`, `RewardCard`, `DialogueBox`, `ProgressIndicator/GrowthRing`, `SpeechButton`, `GameContainer`, `Modal`, `ParentCard`, `MetricCard/SkillBar`, `Navigation`, `BottomNavigation`, `AvatarFigure`, `MimoFigure`, `Sparkles`.

Child screens follow a 3-second rule: one glowing primary action, voiced instructions, ≥52 px touch targets (most are 56–112 px). The Parent Zone is visually separate (light paper, plain type) and sits behind a typed multiplication gate.

Accessibility: visible focus everywhere, reduced motion (OS + per child), large text, high contrast, dyslexia font, captions, screen-reader labels on picture-only controls, RTL mirroring, keyboard-operable controls.

## Error handling

`ErrorBoundary` + route `error.tsx` → friendly "Mimo dropped something" screen. Repository errors are typed (`auth`, `limit`, `network`, …). Network failures queue to the offline outbox. Speech failures fall back to self-report so a child is never blocked.

## Performance

Static prerendering for all pages, route-level code splitting, deterministic journey generation (<10 ms), memoised content indexes, emoji/SVG art (no image weight), self-hosted subset fonts, service-worker caching of hashed assets, audio Cache API.
