# Deployment

## 1. Environments

| Env | `NEXT_PUBLIC_APP_ENV` | Typical setup |
|---|---|---|
| development | `development` | `NEXT_PUBLIC_DATA_MODE=local`, all mocks |
| staging | `staging` | Separate Supabase project, Stripe **test** keys, AI on with test budget |
| production | `production` | Production Supabase, Stripe live, RevenueCat production |

Copy `.env.example` → `.env.local` for development; set the same keys in Vercel per environment. **Never** prefix secrets with `NEXT_PUBLIC_`.

## 2. Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_URL` | public | Environment name, canonical URL (checkout return URLs) |
| `NEXT_PUBLIC_DATA_MODE` | public | `local` (device) or `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase project (anon key is safe; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server** | Webhooks, publishing, account deletion, support |
| `BILLING_PROVIDER`, `NEXT_PUBLIC_BILLING_PROVIDER` | server / public | `mock`, `paymob` (Egypt) or `stripe` — set both to the same value |
| `PAYMOB_SECRET_KEY`, `PAYMOB_API_KEY`, `PAYMOB_HMAC_SECRET` | **server** | Paymob (see [LAUNCH_EGYPT.md](LAUNCH_EGYPT.md)) |
| `PAYMOB_PUBLIC_KEY`, `PAYMOB_INTEGRATION_*`, `PAYMOB_PLAN_*` | server | Paymob checkout key, integration ids, subscription plan ids |
| `NEXT_PUBLIC_COMPANY_*`, `NEXT_PUBLIC_SUPPORT_*`, `NEXT_PUBLIC_COMMERCIAL_REGISTER`, `NEXT_PUBLIC_TAX_ID` | public | Business details on the website (required by payment providers) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | **server** | Stripe |
| `STRIPE_PRICE_PREMIUM_MONTHLY`, `…_ANNUAL`, `…_FAMILY` | server | Stripe Price ids |
| `REVENUECAT_WEBHOOK_AUTH` | **server** | Shared secret for the RevenueCat webhook |
| `NEXT_PUBLIC_REVENUECAT_IOS_KEY`, `…_ANDROID_KEY` | public | RevenueCat SDK keys (native apps) |
| `AI_PROVIDER`, `AI_MODEL` | server | `mock` / `anthropic` / `openai` |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | **server** | LingoAI provider |
| `NEXT_PUBLIC_SPEECH_PROVIDER` | public | `browser` (Web Speech API) or `mock` |
| `PRONUNCIATION_PROVIDER`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | server | Optional phoneme-level scoring |
| `NEXT_PUBLIC_MEDIA_BASE_URL` | public | CDN / storage base for human audio & images |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `REPORT_FROM_EMAIL` | server | Weekly report emails |
| `OWNER_EMAILS` | server | Email(s) allowed to see `/admin/payments` (also need the `owner` role) |
| `LOCAL_ADMIN_PASSCODE` | server | Admin passcode in **device mode only** |

## 3. Local run

```bash
node -v            # 20+ (tested on 22)
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000  (device mode, no keys needed)
npm test           # unit + RLS tests
npm run build && npm start
```

## 4. Supabase

1. Create a project at supabase.com (choose an EU/US region matching your privacy commitments).
2. Install the CLI: `npm i -g supabase`, then `supabase login` and `supabase link --project-ref <ref>`.
3. Apply migrations: `supabase db push`.
4. Seed content: `npm run db:seed-sql`, then run `supabase/seed.sql` (SQL editor or `psql "$DATABASE_URL" -f supabase/seed.sql`).
5. Auth → Providers: enable **Email** (confirm email ON), **Google** (OAuth client id/secret) and **Apple** (Services ID, key). Redirect URL: `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback`).
6. Auth → URL configuration: Site URL = `NEXT_PUBLIC_APP_URL`.
7. Storage: the migration creates the public `content-media` bucket with editor-only writes.
8. Set `NEXT_PUBLIC_DATA_MODE=supabase` plus URL, anon key and service-role key.

### Admin setup

Sign up in the app with the admin's email, then:
```bash
SUPABASE_SERVICE_ROLE_KEY=… NEXT_PUBLIC_SUPABASE_URL=… npm run admin:grant -- admin@yourco.com owner
```
Roles: `owner` (everything), `editor` (content + publish), `reviewer`, `translator`, `support`, `analyst`. Studio: `/admin`.

## 5. Web payments

**Egypt-registered business → Paymob.** Follow [LAUNCH_EGYPT.md](LAUNCH_EGYPT.md): cards with auto-renewal, mobile wallets and Fawry/Aman, HMAC-verified webhooks at `/api/billing/paymob/webhook` and `/api/billing/paymob/subscription`.

**Business in a Stripe-supported country → Stripe:**


1. Create Products “Premium Monthly” (recurring monthly), “Premium Annual” (yearly), “Family” (yearly); copy each **Price id** into `STRIPE_PRICE_*`.
2. `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY=sk_…`.
3. Webhook endpoint `https://<domain>/api/billing/webhook`, events: `customer.subscription.created|updated|deleted`. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
4. Enable the Customer Portal (Settings → Billing → Customer portal) for plan changes/cancellation.
5. Local testing: `stripe listen --forward-to localhost:3000/api/billing/webhook`.

## 6. RevenueCat (iOS/Android)

1. Create the products in App Store Connect / Google Play with identifiers containing `premium_monthly`, `premium_annual`, `family`; attach them to an Offering whose package identifiers equal those names.
2. In the native app, install `@revenuecat/purchases-capacitor`, configure it with `NEXT_PUBLIC_REVENUECAT_*_KEY` and **appUserID = Supabase user id**, and expose it as `window.Purchases` (see `RevenueCatBilling`).
3. Webhook URL `https://<domain>/api/billing/revenuecat`, Authorization header = `REVENUECAT_WEBHOOK_AUTH`.
4. Store rules: purchases are offered only inside the Parent Zone (behind the parent gate), as required for Kids-category apps.

## 7. AI provider

`AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` (optional `AI_MODEL`, default a small fast model) or `AI_PROVIDER=openai` + `OPENAI_API_KEY`. Leave `mock` to run without AI — every AI task has a deterministic fallback. Turn on the `AIStoryVariation` flag per environment in `/admin/flags`. Read AI_SAFETY.md first.

## 8. Speech provider

Default: the platform's Web Speech API (Chrome, Edge, Safari, Android WebView) for recognition and `speechSynthesis` for voices — no keys. Children without recognition support use self-report automatically.
Optional server scoring: `PRONUNCIATION_PROVIDER=azure`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` enables `/api/speech/score` (phoneme-level; audio not stored). Human recordings: upload in `/admin/media`, reference as `asset:` ids on lexemes, set `NEXT_PUBLIC_MEDIA_BASE_URL`.

## 9. GitHub

```bash
git init && git add . && git commit -m "LingoWorld v1"
gh repo create yourorg/lingoworld --private --source=. --push
```
`.github/workflows/ci.yml` runs typecheck, content validation, unit + RLS tests, build and Playwright on every push/PR.

## 10. Vercel

1. vercel.com → New Project → import the repo (framework: Next.js, defaults).
2. Add environment variables for Production and Preview (staging) separately.
3. Deploy. Set your domain; update `NEXT_PUBLIC_APP_URL`, Supabase redirect URLs and the Stripe webhook URL.
4. `GET /api/health` shows the active modes/providers (no secrets).

## 11. Capacitor (iOS / Android)

The native shell wraps a static export of the app. Server features (webhooks, AI, publish) stay on your Vercel deployment.

```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android   # already in devDependencies
NEXT_PUBLIC_APP_URL=https://your-domain npm run build:native   # static export → out/ (API routes stay on the web deployment)
npx cap add ios && npx cap add android        # first time only (needs Xcode / Android Studio to build)
npx cap sync                                  # or: npm run cap:sync
npx cap open ios        # Xcode: set team, bundle id com.lingoworld.app, Microphone usage string
npx cap open android    # Android Studio: add RECORD_AUDIO permission
```
- iOS `Info.plist`: `NSMicrophoneUsageDescription` = "LingoWorld listens when your child practises speaking. Recordings are never saved." and `NSSpeechRecognitionUsageDescription`.
- Android `AndroidManifest.xml`: `<uses-permission android:name="android.permission.RECORD_AUDIO"/>`.
- `scripts/build-native.mjs` parks `src/app/api` during the export and restores it. Native apps call server features on your deployed origin; billing on native goes through RevenueCat.
- For native-quality speech on iOS consider `@capacitor-community/speech-recognition` behind the existing `SpeechRecognitionService` interface.
- Kids category: no third-party ads/analytics SDKs, parental gate before links/purchases (provided).

## 12. Threat model (summary)

| Asset | Threat | Mitigation |
|---|---|---|
| Child data | Cross-family access | RLS on every table (tested), no child credentials |
| Entitlements | Self-upgrade | Subscriptions writable only by service role via signed webhooks |
| Admin/CMS | Unauthorised edits | Server-side role checks, RLS on content, audit log |
| Secrets | Leakage to client | `server-only` guard, no `NEXT_PUBLIC_` secrets, health endpoint shows modes only |
| AI | Prompt injection, unsafe output | Screening, allow-listed ids, schema validation, rate limits |
| Voice | Recording retention | Transient processing, transcripts only |
| Web | Clickjacking/XSS | `X-Frame-Options: DENY`, React escaping, email HTML escaped |
| Abuse | API flooding | Rate limits on AI/speech; Supabase Auth rate limits |

## 13. Production readiness checklist

- [ ] Supabase: migrations applied, seed loaded, email confirmation on, OAuth redirect URLs set, PITR backups enabled
- [ ] Admin owner granted; LOCAL_ADMIN_PASSCODE unused in cloud mode
- [ ] Paymob live keys, integrations, subscription plans, callbacks; test card/wallet/Fawry/refund end-to-end (LAUNCH_EGYPT.md §5) — or Stripe live keys, prices, webhook + portal
- [ ] Business details env vars set; legal pages reviewed by counsel; final prices in `src/billing/pricing.ts`
- [ ] RevenueCat products, offering, webhook; sandbox purchase on iOS and Android
- [ ] Legal: Terms, Children's Privacy Notice, verifiable parental consent method for your markets, DPA with processors
- [ ] Native-speaker review of all 1 750 lexemes and 330 phrase translations (status in CMS); Arabic narrative review
- [ ] Human voice recordings for core vocabulary (TTS quality varies by device)
- [ ] Original illustrated art for characters/worlds (emoji placeholders today) via media library
- [ ] Error monitoring (e.g. Sentry with PII scrubbing) wired into `ErrorBoundary`
- [ ] Data retention jobs (speech 12 mo, analytics 25 mo)
- [ ] Load test Supabase writes (saves are incremental, ~1–6 upserts per activity)
- [ ] Accessibility audit with real assistive tech; usability sessions with children 4–11
- [ ] CI green: typecheck, content validation, unit, RLS, E2E on phone/tablet/desktop
