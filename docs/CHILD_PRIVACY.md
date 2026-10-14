# Children's privacy & safety

LingoWorld is designed for COPPA (US), GDPR-K / UK Age Appropriate Design Code and similar regimes. This document describes product behaviour; it is not legal advice — have counsel review before launch.

## Data minimisation

| Collected | Not collected |
|---|---|
| Parent: email, first name, interface language, consents | Phone, address, payment card (handled by Stripe/stores) |
| Child: nickname, age (number), native/target/interface language, level estimate, goal, interests, accessibility needs, avatar | Surname, birthday, school, photo, precise or coarse location, contacts, device identifiers |
| Learning results: mastery, schedule, activity summaries, transcripts + scores of speaking attempts | Raw voice recordings |

Children have **no credentials**; access is via the parent's account. Analytics use a random `analytics_id` per child — never name, age or child id — and an allow-list of non-identifying event properties.

## Voice

- Microphone use requires **parent consent** (`consents.voiceProcessing`) **and** the per-child "Speaking activities" toggle.
- Recognition runs in the browser/OS engine or a configured provider; audio is used to score the attempt and discarded. `/api/speech/score` forwards a clip and keeps nothing.
- Only transcript + score are stored (`speech_attempts`), and support staff cannot read them.
- Without consent or a working microphone, children use "say it aloud and tap the star".

## Safety by design

No public chat, stranger messaging, public profiles, user-generated public content, location sharing, ads, or purchases in child mode. Payments only behind the parent gate. No loot boxes or random rewards. No loss-framed streaks or FOMO notifications. Experiments limited to presentation surfaces. Leaderboards: none.

## Parent controls

Parent Zone → Settings & each child: voice, audio, notifications, analytics, weekly email, daily target, soft screen-time limit, accessibility, learning language, downloads, data export (`export_family_data`), deletion of a child, deletion of the whole account (cascade + analytics purge).

## Security

RLS on every table (tested); service-role key server-only (`server-only` import guard); webhook signatures verified; admin roles checked server-side; security headers (no framing, nosniff, camera/geolocation disabled); PBKDF2 in device mode. See DEPLOYMENT.md for the threat model.

## Retention (recommended defaults)

Activity history and speech transcripts are capped per child on the client (400 / 300 most recent); configure a scheduled job to delete `speech_attempts` older than 12 months and `analytics_events` older than 25 months.
