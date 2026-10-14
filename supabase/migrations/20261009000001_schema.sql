-- =====================================================================
-- LingoWorld · 0001 · Core schema
-- Identity: Supabase auth.users is the "users" table. Children never have credentials.
-- Content: normalised tables are the CMS source of truth; publishing compiles them
--          into content_bundles (versioned JSON) that apps download and cache offline.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- enums ----------
do $$ begin
  create type content_status as enum ('draft', 'review', 'published', 'archived');
  create type age_band as enum ('little', 'adventurer', 'hero');
  create type plan_id as enum ('free', 'premium_monthly', 'premium_annual', 'family');
  create type subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'none');
  create type billing_provider as enum ('mock', 'stripe', 'revenuecat');
  create type admin_role as enum ('owner', 'editor', 'reviewer', 'translator', 'support', 'analyst');
  create type item_type as enum ('concept', 'phrase');
exception when duplicate_object then null; end $$;

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- =====================================================================
-- Families
-- =====================================================================
create table if not exists parent_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  interface_locale text not null default 'en',
  parent_pin_hash text,                       -- optional PIN for the parent gate (bcrypt via pgcrypto)
  consent_voice_processing boolean not null default false,
  consent_analytics boolean not null default true,
  consent_weekly_email boolean not null default false,
  consent_notifications boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parent_profiles(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  age smallint not null check (age between 3 and 12),
  age_band age_band not null,
  native_language text not null,
  interface_locale text not null default 'en',
  target_language text not null,
  estimated_level text not null default 'new' check (estimated_level in ('new', 'some', 'confident')),
  learning_goal text not null default 'fun',
  interests text[] not null default '{}',
  accessibility_needs text[] not null default '{}',
  onboarded boolean not null default false,
  -- Pseudonymous id used in analytics instead of the child id.
  analytics_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists children_parent_idx on children(parent_id);

create table if not exists child_preferences (
  child_id uuid primary key references children(id) on delete cascade,
  daily_target_minutes smallint not null default 15 check (daily_target_minutes in (10, 15, 20)),
  audio_enabled boolean not null default true,
  music_volume real not null default 0.5,
  voice_enabled boolean not null default true,
  reduced_motion boolean not null default false,
  high_contrast boolean not null default false,
  large_text boolean not null default false,
  dyslexia_font boolean not null default false,
  captions boolean not null default true,
  screen_time_limit_minutes smallint,
  streaks_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists avatars (
  child_id uuid primary key references children(id) on delete cascade,
  config jsonb not null,                      -- {skin, hair, hairColor, face, outfit, shoes, accessory, background, color}
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  parent_id uuid primary key references parent_profiles(id) on delete cascade,
  plan plan_id not null default 'free',
  status subscription_status not null default 'none',
  provider billing_provider not null default 'mock',
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  seats smallint not null default 1,
  updated_at timestamptz not null default now()
);
create unique index if not exists subscriptions_provider_sub_idx on subscriptions(provider, provider_subscription_id) where provider_subscription_id is not null;

-- =====================================================================
-- Content (CMS source of truth)
-- =====================================================================
create table if not exists languages (
  code text primary key,                       -- 'en','fr','de','it','es', …
  name text not null,
  tts_locale text not null,                    -- e.g. 'en-GB'
  enabled boolean not null default true,
  sort_order smallint not null default 0
);

create table if not exists interface_languages (
  code text primary key,                       -- 'en','ar','fr','de','it','es'
  name text not null,
  rtl boolean not null default false,
  enabled boolean not null default true
);

create table if not exists curriculum_levels (
  stage smallint primary key check (stage between 1 and 6),
  name jsonb not null,
  cefr text not null,
  target_cumulative_words int not null,
  description jsonb not null
);

create table if not exists skills (
  id text primary key,                         -- listening, speaking, pronunciation, reading, writing, vocabulary, grammar
  name jsonb not null
);

create table if not exists grammar_patterns (
  id text primary key,
  name jsonb not null,
  description jsonb not null,
  cefr text not null,
  stage smallint not null references curriculum_levels(stage),
  template text not null
);

-- vocabulary = language-neutral concepts; lexemes = their realisation per language
create table if not exists vocabulary (
  id text primary key,                         -- 'food.apple'
  topic text not null,
  word_class text not null,
  image text not null,                         -- emoji or media_assets id ("asset:…")
  difficulty smallint not null check (difficulty between 1 and 5),
  age_bands age_band[] not null,
  cefr text not null,
  stage smallint not null references curriculum_levels(stage),
  tags text[] not null default '{}',
  confusable_with text[] not null default '{}',
  status content_status not null default 'draft',
  version int not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists lexemes (
  concept_id text not null references vocabulary(id) on delete cascade,
  language text not null references languages(code),
  text text not null,
  gender text check (gender in ('m', 'f', 'n')),
  plural text,
  forms jsonb,
  article_override jsonb,
  invariable boolean not null default false,
  pre_nominal boolean not null default false,
  m_vowel_form text,
  oblique_form text,
  variants text[] not null default '{}',
  syllables text[] not null default '{}',
  phoneme_focus text[] not null default '{}',
  audio_asset uuid,
  slow_audio_asset uuid,
  review_status content_status not null default 'draft',  -- native-speaker review
  reviewer uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (concept_id, language)
);

create table if not exists phrases (
  id text not null,
  language text not null references languages(code),
  text text not null,
  gloss jsonb not null,
  topic text not null,
  concept_ids text[] not null default '{}',
  grammar_pattern_id text references grammar_patterns(id),
  cefr text not null,
  stage smallint not null references curriculum_levels(stage),
  accepted_variants text[] not null default '{}',
  status content_status not null default 'draft',
  updated_at timestamptz not null default now(),
  primary key (id, language)
);

create table if not exists curriculum_units (
  id text primary key,
  stage smallint not null references curriculum_levels(stage),
  sort_order int not null,
  topic text not null,
  title jsonb not null,
  skills text[] not null,
  concept_ids text[] not null,
  phrase_ids text[] not null,
  grammar_pattern_ids text[] not null default '{}',
  goals jsonb not null default '{}',
  prerequisites text[] not null default '{}',
  mastery_threshold smallint not null default 60,
  age_bands age_band[] not null,
  status content_status not null default 'draft',
  version int not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists characters (
  id text primary key,
  name text not null,
  role jsonb not null,
  traits text[] not null,
  emoji text not null,
  color text not null,
  voice jsonb not null
);

create table if not exists worlds (
  id text primary key,
  sort_order int not null,
  name jsonb not null,
  emoji text not null,
  palette text[] not null,
  topics text[] not null,
  stage smallint not null,
  unlock jsonb not null,
  premium boolean not null default false,
  hidden_items jsonb not null default '[]',
  landmarks jsonb not null default '[]',
  ambient text[] not null default '{}',
  status content_status not null default 'draft',
  updated_at timestamptz not null default now()
);

create table if not exists story_arcs (
  id text primary key,
  title jsonb not null,
  description jsonb not null,
  season int,
  world_ids text[] not null,
  premium boolean not null default false,
  seasonal text,
  status content_status not null default 'draft',
  updated_at timestamptz not null default now()
);

-- Authored journeys = story episodes (templates). Daily, personalised journeys are generated at runtime.
create table if not exists journeys (
  id text primary key,
  arc_id text not null references story_arcs(id) on delete cascade,
  sort_order int not null,
  world_id text not null references worlds(id),
  title jsonb not null,
  summary jsonb not null,
  topics text[] not null,
  cliffhanger jsonb,
  reward_ids text[] not null default '{}',
  min_stage smallint not null default 1,
  memory_key text,
  status content_status not null default 'draft',
  version int not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists journey_scenes (
  id text primary key,
  journey_id text not null references journeys(id) on delete cascade,
  sort_order int not null,
  background text not null,
  lines jsonb not null,
  interaction jsonb,
  memory_callbacks jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists games (
  type text primary key,
  name jsonb not null,
  emoji text not null,
  family text not null,
  skills text[] not null,
  evidence text[] not null,
  age_bands age_band[] not null,
  min_stage smallint not null default 1,
  needs_microphone boolean not null default false,
  needs_reading boolean not null default false,
  items_by_difficulty int[] not null,
  premium boolean not null default false,
  enabled boolean not null default true
);

create table if not exists game_templates (
  id text primary key,
  type text not null references games(type),
  name jsonb not null,
  topics text[],
  difficulty smallint not null,
  learning_skill text not null,
  success_rules jsonb not null,
  scoring jsonb not null,
  hints text[] not null default '{}',
  reward_id text,
  age_bands age_band[] not null,
  status content_status not null default 'draft'
);

create table if not exists rewards (
  id text primary key,
  kind text not null,
  name jsonb not null,
  emoji text not null,
  premium boolean not null default false
);

create table if not exists achievements (
  id text primary key,
  name jsonb not null,
  description jsonb not null,
  emoji text not null,
  rule jsonb not null
);

create table if not exists books (
  id text primary key,
  title jsonb not null,
  cover_emoji text not null,
  world_id text references worlds(id),
  topic text not null,
  age_bands age_band[] not null,
  stage smallint not null,
  pages jsonb not null,
  quiz jsonb not null default '[]',
  premium boolean not null default false,
  status content_status not null default 'draft',
  updated_at timestamptz not null default now()
);

create table if not exists songs (
  id text primary key,
  title jsonb not null,
  emoji text not null,
  kind text not null,
  topic text not null,
  lines jsonb not null,
  bpm int not null,
  premium boolean not null default false,
  status content_status not null default 'published'
);

create table if not exists roleplays (
  id text primary key,
  title jsonb not null,
  emoji text not null,
  topic text not null,
  partner text not null references characters(id),
  min_stage smallint not null,
  turns jsonb not null,
  status content_status not null default 'published'
);

create table if not exists avatar_items (
  id text primary key,
  slot text not null,                           -- hair, outfit, shoes, accessory, background, …
  label jsonb not null,
  emoji text,
  color text,
  unlock_reward_id text references rewards(id),
  premium boolean not null default false
);

create table if not exists companions (
  id text primary key,                          -- egg colour / species variants
  name jsonb not null,
  egg_color text not null,
  forms jsonb not null
);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('image', 'audio', 'video', 'animation')),
  url text not null,                            -- storage/CDN URL; never bundled in code
  storage_path text,
  mime_type text,
  bytes int,
  duration_ms int,
  width int, height int,
  language text,
  license text not null default 'original',     -- original | licensed | royalty-free | generated
  attribution text,
  alt_text jsonb,
  tags text[] not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists content_translations (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,                    -- 'journey_scene', 'world', 'book', …
  entity_id text not null,
  field text not null,                          -- JSON path, e.g. 'lines[2].text'
  locale text not null,
  source_text text not null,
  translated_text text,
  status content_status not null default 'draft',
  machine_translated boolean not null default false,
  reviewer uuid references auth.users(id),
  version int not null default 1,
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, field, locale)
);

-- Compiled, immutable content releases consumed by apps (and cached offline).
create table if not exists content_bundles (
  version text primary key,
  bundle jsonb not null,
  checksum text not null,
  published boolean not null default false,
  published_at timestamptz,
  published_by uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Learner state (per child, per target language)
-- =====================================================================
create table if not exists language_progress (
  child_id uuid not null references children(id) on delete cascade,
  language text not null references languages(code),
  stage smallint not null default 1,
  current_unit_id text not null,
  completed_unit_ids text[] not null default '{}',
  difficulty real not null default 1.5,
  challenge_tolerance real not null default 0.5,
  content_version text,                         -- bundle version the progress was computed against
  updated_at timestamptz not null default now(),
  primary key (child_id, language)
);

create table if not exists learning_mastery (
  child_id uuid not null references children(id) on delete cascade,
  language text not null,
  item_id text not null,
  item_type item_type not null,
  mastery jsonb not null,                       -- 12 dimensions 0..100
  attempts int not null default 0,
  correct int not null default 0,
  consecutive_correct int not null default 0,
  consecutive_wrong int not null default 0,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (child_id, language, item_id)
);

create table if not exists review_schedule (
  child_id uuid not null references children(id) on delete cascade,
  language text not null,
  item_id text not null,
  item_type item_type not null,
  ease real not null,
  interval_days real not null,
  repetitions int not null,
  lapses int not null,
  due_at timestamptz not null,
  last_reviewed_at timestamptz,
  primary key (child_id, language, item_id)
);
create index if not exists review_due_idx on review_schedule(child_id, language, due_at);

create table if not exists daily_sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  language text not null,
  date date not null,
  journey_id text,
  journey jsonb,                                -- generated DailyJourney (for resume + parent transparency)
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  learning_ms int not null default 0,
  free_play_ms int not null default 0,
  journey_completed boolean not null default false
);
create index if not exists daily_sessions_child_date_idx on daily_sessions(child_id, date desc);

create table if not exists activity_history (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  language text not null,
  session_id text not null,
  game_type text not null,
  family text not null,
  world_id text,
  item_ids text[] not null default '{}',
  correct int not null,
  total int not null,
  stars smallint not null,
  duration_ms int not null,
  abandoned boolean not null default false,
  difficulty real not null,
  at timestamptz not null default now()
);
create index if not exists activity_child_at_idx on activity_history(child_id, at desc);

create table if not exists game_sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  game_type text not null,
  template_id text,
  mode text not null default 'journey' check (mode in ('journey', 'play', 'explore')),
  score int not null default 0,
  rounds int not null default 0,
  best_streak int not null default 0,
  at timestamptz not null default now()
);

-- Transcripts and scores only. Raw audio is never stored unless a parent explicitly opts in (not implemented by default).
create table if not exists speech_attempts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  language text not null,
  item_id text not null,
  expected text not null,
  heard text not null,
  score smallint not null,
  accepted boolean not null,
  focus_sounds text[] not null default '{}',
  at timestamptz not null default now()
);
create index if not exists speech_child_at_idx on speech_attempts(child_id, at desc);

create table if not exists pronunciation_results (
  child_id uuid not null references children(id) on delete cascade,
  language text not null,
  sound text not null,                          -- e.g. 'th', 'r', 'ü'
  attempts int not null default 0,
  average_score real not null default 0,
  updated_at timestamptz not null default now(),
  primary key (child_id, language, sound)
);

create table if not exists reading_progress (
  child_id uuid not null references children(id) on delete cascade,
  language text not null,
  words_read int not null default 0,
  sentences_read int not null default 0,
  comprehension_correct int not null default 0,
  comprehension_total int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (child_id, language)
);

create table if not exists writing_progress (
  child_id uuid not null references children(id) on delete cascade,
  language text not null,
  words_spelled int not null default 0,
  sentences_built int not null default 0,
  spelling_accuracy real not null default 0,
  updated_at timestamptz not null default now(),
  primary key (child_id, language)
);

create table if not exists story_state (
  child_id uuid not null references children(id) on delete cascade,
  language text not null,
  active_arc_id text not null,
  completed_episode_ids text[] not null default '{}',
  memories jsonb not null default '[]',
  last_episode_id text,
  pending_cliffhanger_episode_id text,
  updated_at timestamptz not null default now(),
  primary key (child_id, language)
);

create table if not exists story_choices (
  child_id uuid not null references children(id) on delete cascade,
  language text not null,
  choice_key text not null,
  option_id text not null,
  made_at timestamptz not null default now(),
  primary key (child_id, language, choice_key)
);

create table if not exists companion_progress (
  child_id uuid primary key references children(id) on delete cascade,
  name text not null default 'Mimo',
  egg_color text not null,
  stage text not null default 'egg',
  path text not null default 'balanced',
  xp int not null default 0,
  affinity jsonb not null default '{"speaking":0,"reading":0,"exploring":0,"creating":0}',
  happiness smallint not null default 80,
  equipped_cosmetics text[] not null default '{}',
  learned_commands text[] not null default '{}',
  last_fed_at timestamptz,
  hatched_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists reward_inventory (
  child_id uuid primary key references children(id) on delete cascade,
  stars int not null default 0,
  adventure_points int not null default 0,
  reward_ids text[] not null default '{}',
  achievement_ids text[] not null default '{}',
  new_reward_ids text[] not null default '{}',
  streak_current int not null default 0,
  streak_best int not null default 0,
  streak_last_date date,
  visited_world_ids text[] not null default '{my-home}',
  updated_at timestamptz not null default now()
);

create table if not exists book_progress (
  child_id uuid not null references children(id) on delete cascade,
  book_id text not null,
  language text not null,
  pages_read int not null default 0,
  completed boolean not null default false,
  favorite boolean not null default false,
  quiz_correct int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (child_id, book_id, language)
);

create table if not exists creations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  kind text not null,
  title text not null,
  language text not null,
  objects jsonb not null default '[]',
  story_lines text[],
  background text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists parent_reports (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  week_start date not null,
  language text not null,
  report jsonb not null,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (child_id, week_start, language)
);

-- Offline sync: idempotent client mutations (each client op id applied once).
create table if not exists sync_operations (
  op_id text primary key,
  child_id uuid not null references children(id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  client_created_at timestamptz not null,
  applied_at timestamptz not null default now()
);

-- =====================================================================
-- Platform
-- =====================================================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parent_profiles(id) on delete cascade,
  child_id uuid references children(id) on delete cascade,
  kind text not null,                           -- 'adventure-ready', 'weekly-report', 'milestone'
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists feature_flags (
  key text primary key,
  description text not null default '',
  enabled boolean not null default false,
  rollout_percent smallint not null default 0 check (rollout_percent between 0 and 100),
  environments text[] not null default '{development}',
  updated_at timestamptz not null default now()
);

create table if not exists experiments (
  key text primary key,
  description text not null,
  variants jsonb not null,                      -- [{"id":"a","weight":50},{"id":"b","weight":50}]
  surface text not null check (surface in ('ui', 'journey-ordering', 'game-preference', 'reward-presentation')),
  active boolean not null default false,
  guardrails text not null default 'No manipulative mechanics, no time-pressure or purchase prompts toward children.',
  created_at timestamptz not null default now()
);

create table if not exists experiment_assignments (
  experiment_key text not null references experiments(key) on delete cascade,
  subject_id uuid not null,                     -- children.analytics_id (pseudonymous)
  variant text not null,
  assigned_at timestamptz not null default now(),
  primary key (experiment_key, subject_id)
);

create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role admin_role not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  diff jsonb,
  at timestamptz not null default now()
);

-- Pseudonymous product analytics. subject_id is children.analytics_id or a parent-level hash; never names.
create table if not exists analytics_events (
  id bigint generated always as identity primary key,
  subject_id uuid not null,
  subject_kind text not null check (subject_kind in ('child', 'parent', 'anonymous')),
  name text not null,
  props jsonb not null default '{}',
  app_env text not null default 'production',
  platform text,
  at timestamptz not null default now()
);
create index if not exists analytics_name_at_idx on analytics_events(name, at desc);
create index if not exists analytics_subject_at_idx on analytics_events(subject_id, at desc);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['parent_profiles','children','child_preferences','avatars','subscriptions','vocabulary','lexemes','phrases',
    'curriculum_units','worlds','story_arcs','journeys','journey_scenes','books','content_translations','language_progress',
    'learning_mastery','pronunciation_results','reading_progress','writing_progress','story_state','companion_progress',
    'reward_inventory','book_progress','creations','feature_flags']
  loop
    execute format('drop trigger if exists %I_updated_at on %I', t, t);
    execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;
