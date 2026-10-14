# LingoWorld

**Every Day, a New Adventure.** A story-driven language-learning platform for children aged 4–11.
Children play through a living adventure world; parents follow a structured Pre-A1 → A2 curriculum underneath it.

- **Learn:** English · French · German · Italian · Spanish (add more without code changes to the engines)
- **Interface:** English · العربية (RTL) · Français · Deutsch · Italiano · Español — independent of the learning language
- **Ages — three separate tracks:** Little Explorers (4–5), Adventurers (6–8), Heroes (9–11), each with its own syllabus, story seasons, games, pace, navigation and graduation rule (`src/content/tracks.ts`); parents can move a child between tracks without losing progress
- **Website & payments:** public site (`/welcome`, `/tracks`, `/pricing`, `/contact`, `/legal/*`) and Paymob payments for Egypt — cards (auto-renew), mobile wallets, Fawry/Aman. See [LAUNCH_EGYPT.md](docs/LAUNCH_EGYPT.md)
- **Runs:** web (installable PWA), iOS and Android (Capacitor)

## What's in this repository

| Area | Where | Notes |
|---|---|---|
| Child app: home, journey, explore, 30 mini-games, create, Mimo, library, music, role-play, rewards, avatar | `src/app/play`, `src/features` | Voice-first with automatic tap fallback |
| Parent Zone: gate, dashboard, insights, weekly reports, child controls, plans, offline, privacy | `src/app/parent` | |
| Admin CMS: content editor + preview, workflow, import/export, translations, media, releases, analytics, flags, support | `src/app/admin`, `src/admin` | |
| Learning engines | `src/learning-engine`, `src/journey-engine`, `src/story-engine`, `src/game-engine`, `src/companions` | Pure TypeScript, fully unit-tested |
| Grammar realizer (5 languages) | `src/curriculum/grammar.ts` | Articles, gender, German cases, contractions |
| Seed content | `src/content` | 350 concepts × 5 languages, 66 phrases × 5, 98 units, 20 worlds, 47 episodes in 10 story seasons, 3 age tracks, 12 books, 9 songs, 9 role-plays |
| Services (data, offline sync, speech, AI, billing, analytics, flags) | `src/services`, `src/speech`, `src/billing`, `src/analytics` | Every provider has a mock |
| Database | `supabase/migrations`, `supabase/seed.sql` | Postgres schema, RLS, triggers, export function |
| API routes | `src/app/api` | Billing webhooks, AI, speech scoring, publish, account deletion, email |
| Tests | `tests/unit`, `tests/db`, `tests/e2e` | 80 unit/db tests incl. a 40-day learner simulation; Playwright E2E |

## Quick start (no accounts or keys needed)

```bash
npm install
cp .env.example .env.local      # defaults: device mode, mock billing, mock AI, browser speech
npm run dev                     # http://localhost:3000
```

Device mode stores everything in the browser (IndexedDB) — perfect for development and demos.
Admin CMS: http://localhost:3000/admin (passcode `lingo-admin`, set `LOCAL_ADMIN_PASSCODE`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | TypeScript strict |
| `npm test` | Unit + database (RLS) tests |
| `npm run test:e2e` | Playwright E2E (phone, tablet, desktop) |
| `npm run content:validate` | Validates every concept, phrase, book, song and episode in all 5 languages |
| `npm run db:seed-sql` | Regenerates `supabase/seed.sql` from `src/content` |
| `npm run admin:grant -- email@example.com editor` | Grants an admin role (cloud mode) |
| `npm run paymob:plans` | Previews / creates the Paymob subscription plans (`-- --create`) |
| `npm run build:native` / `cap:sync` | Static export for Capacitor / export + sync iOS & Android |

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, modules, design system
- [DATABASE.md](docs/DATABASE.md) — schema, RLS, migrations
- [CONTENT_SYSTEM.md](docs/CONTENT_SYSTEM.md) — content model, grammar realizer, publishing
- [LEARNING_ENGINE.md](docs/LEARNING_ENGINE.md) — mastery, spaced repetition, journeys, difficulty, anti-boredom
- [AI_SAFETY.md](docs/AI_SAFETY.md) — LingoAI constraints
- [CHILD_PRIVACY.md](docs/CHILD_PRIVACY.md) — data minimisation, voice, consent, deletion
- [LAUNCH_EGYPT.md](docs/LAUNCH_EGYPT.md) — go live at your domain with Paymob (cards, wallets, Fawry), legal pages, test plan
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — Supabase, Stripe, RevenueCat, AI, speech, Vercel, Capacitor, readiness checklist
- [ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) and [CONTENT_CREATOR_GUIDE.md](docs/CONTENT_CREATOR_GUIDE.md)
