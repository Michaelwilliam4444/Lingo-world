# Admin guide

Studio: `/admin`. Cloud mode: sign in with an account in `admin_users`. Device mode: passcode (`LOCAL_ADMIN_PASSCODE`).

## Roles

| Role | Can |
|---|---|
| owner | Everything, incl. managing admins |
| editor | Edit all content, publish releases, upload media |
| reviewer | Edit + move content through review |
| translator | Translations |
| support | Family lookup (no transcripts, no content edits) |
| analyst | Analytics, experiments |

Grant: `npm run admin:grant -- person@example.com editor`.

## Dashboard

Counts for every content type, validation status (errors block publishing), the review queue.

## Content

Pick a type on the left (Vocabulary, Translations of words, Phrases, Grammar patterns, Curriculum levels/units, Worlds, Story arcs, Journeys, Characters, Game types, Game configuration, Rewards, Achievements, Books, Songs, Role-plays).
- **Edit** in the JSON editor; **Save to draft** validates and reports issues for that item.
- **Workflow** (episodes, arcs, books, templates): `draft → review → published → archived`. Only published items are visible to families.
- **Preview**: vocabulary renders in all five languages; journeys render as a full generated adventure in any language; books/songs render every line.
- **Bulk**: Export JSON/CSV, Import JSON (upserts by id into the draft).

## Translations

Interface coverage per locale, target-language coverage, and a queue of story/world text missing in a locale. Write the translation, then *Send to review* or *Approve*. Each change is versioned and audited. Machine translation must always be reviewed before approval.

## Media

Upload images, audio, video and animations with license and language. Copy the `asset:` reference into content (e.g. lexeme `audio`). Assets live in Supabase Storage / your CDN.

## Releases

Publish the draft as an immutable version with notes. Families get it on their next app start; progress is never reset. Device mode supports rollback; in cloud mode publish a corrected release.

## Analytics

DAU/WAU/MAU, D1/D7/D30 retention, journey completion, average session, speaking attempts and acceptance, learning improvement (first-try accuracy early vs. recent), game and world popularity, subscription conversion, churn. Children are counted only by pseudonymous ids.

## Flags & experiments

Flags with per-environment rollout percentages (deterministic bucketing). Experiments only on presentation surfaces — never pricing prompts, time pressure or streak pressure for children.

## Support

Look up a family by parent email: plan, children (nickname, age band, language), last sync. Every lookup is audited.
