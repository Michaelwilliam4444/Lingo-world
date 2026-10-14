-- =====================================================================
-- 0003 — Age tracks + Paymob (Egypt) payments
--   * tracks:        editable learning tracks (one per age band) — syllabus, seasons, games, pacing, navigation
--   * children.track_id: optional parent override of the age-based track (null = follow age)
--   * billing_provider gains 'paymob'
--   * payments:      one row per checkout / transaction (idempotent on provider transaction id)
--   * subscriptions: cancel-at-period-end + payment method
-- =====================================================================

-- ---------- tracks ----------
create table if not exists tracks (
  id age_band primary key,
  sort_order smallint not null default 0,
  name jsonb not null,
  ages jsonb not null,                       -- { min, max }
  tagline jsonb not null,
  description jsonb not null,
  emoji text not null,
  color text not null,
  stages smallint[] not null,
  unit_ids text[] not null,
  arc_ids text[] not null,
  game_types text[] not null,
  daily_minutes jsonb not null,              -- { min, max }
  new_items_per_day smallint not null check (new_items_per_day between 1 and 12),
  max_games_per_journey smallint not null check (max_games_per_journey between 1 and 6),
  review_items_per_journey smallint not null check (review_items_per_journey between 0 and 15),
  features jsonb not null,
  navigation text[] not null,
  skills_focus jsonb not null default '[]'::jsonb,
  graduation jsonb not null,                 -- { wordsMastered, nextTrack }
  updated_at timestamptz not null default now()
);

alter table tracks enable row level security;
alter table tracks force row level security;
drop policy if exists tracks_read on tracks;
create policy tracks_read on tracks for select to anon, authenticated using (true);
drop policy if exists tracks_admin on tracks;
create policy tracks_admin on tracks for all to authenticated
  using (public.is_admin(array['editor']::admin_role[])) with check (public.is_admin(array['editor']::admin_role[]));
drop trigger if exists tracks_updated_at on tracks;
create trigger tracks_updated_at before update on tracks for each row execute function set_updated_at();

-- ---------- children: parent-chosen track ----------
alter table children add column if not exists track_id age_band;
comment on column children.track_id is 'Learning track chosen by the parent; null = follows age_band.';

-- ---------- billing ----------
alter type billing_provider add value if not exists 'paymob';

alter table subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table subscriptions add column if not exists payment_method text check (payment_method in ('card', 'wallet', 'kiosk', 'store', 'mock'));

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parent_profiles(id) on delete cascade,
  provider billing_provider not null,
  reference text not null unique,            -- our special_reference sent to the gateway
  provider_order_id text,
  provider_transaction_id text,
  provider_subscription_id text,
  kind text not null check (kind in ('subscription', 'renewal', 'pass')),
  plan plan_id not null check (plan <> 'free'),
  method text not null check (method in ('card', 'wallet', 'kiosk')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'voided')),
  period_months smallint not null check (period_months in (1, 12)),
  paid_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists payments_provider_tx_idx on payments(provider, provider_transaction_id) where provider_transaction_id is not null;
create index if not exists payments_parent_idx on payments(parent_id, created_at desc);
create index if not exists payments_sub_idx on payments(provider_subscription_id) where provider_subscription_id is not null;

alter table payments enable row level security;
alter table payments force row level security;
-- Parents can see their own payment history. Nobody but the service role (webhooks) can write.
drop policy if exists payments_read_own on payments;
create policy payments_read_own on payments for select to authenticated using (parent_id = auth.uid());
-- Revenue is visible only to the business owner (admin role 'owner'); editors/support/analysts cannot read it.
drop policy if exists payments_owner_read on payments;
create policy payments_owner_read on payments for select to authenticated using (public.is_admin(array['owner']::admin_role[]));
drop trigger if exists payments_updated_at on payments;
create trigger payments_updated_at before update on payments for each row execute function set_updated_at();
