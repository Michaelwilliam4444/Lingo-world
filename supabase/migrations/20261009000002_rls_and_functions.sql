-- =====================================================================
-- LingoWorld · 0002 · Row Level Security, helper functions, triggers
-- Principles:
--   * Parents see and change only their own family.
--   * Children have no credentials; all child data is accessed through the parent's session.
--   * Content: everyone reads PUBLISHED content; only admins write (role-checked server-side).
--   * Subscriptions are written only by the service role (billing webhooks) — never by clients.
--   * Analytics: clients may insert pseudonymous events; only analysts/admins read them.
-- =====================================================================

-- ---------- helpers (security definer so policies can call them without recursion) ----------
create or replace function public.owns_child(p_child uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from children c where c.id = p_child and c.parent_id = auth.uid());
$$;

create or replace function public.admin_role_of(p_user uuid) returns admin_role
language sql stable security definer set search_path = public as $$
  select role from admin_users where user_id = p_user;
$$;

create or replace function public.is_admin(p_roles admin_role[] default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admin_users a
    where a.user_id = auth.uid() and (p_roles is null or a.role = any(p_roles) or a.role = 'owner')
  );
$$;

revoke all on function public.owns_child(uuid) from public;
revoke all on function public.is_admin(admin_role[]) from public;
revoke all on function public.admin_role_of(uuid) from public;
grant execute on function public.owns_child(uuid) to authenticated;
grant execute on function public.is_admin(admin_role[]) to anon, authenticated;  -- anon evaluates content-read policies (returns false)
grant execute on function public.admin_role_of(uuid) to authenticated;

-- ---------- new auth user → parent profile + free subscription ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into parent_profiles (id, display_name, interface_locale)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''), coalesce(new.raw_user_meta_data->>'locale', 'en'))
  on conflict (id) do nothing;
  insert into subscriptions (parent_id, plan, status, provider) values (new.id, 'free', 'none', 'mock')
  on conflict (parent_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- child seat limit enforced in the database (not only in UI) ----------
create or replace function public.enforce_child_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare max_children int; existing int;
begin
  select case when s.plan = 'family' and s.status in ('active', 'trialing') then 6
              when s.plan in ('premium_monthly', 'premium_annual') and s.status in ('active', 'trialing') then 3
              else 2 end
    into max_children from subscriptions s where s.parent_id = new.parent_id;
  select count(*) into existing from children where parent_id = new.parent_id;
  if existing >= coalesce(max_children, 2) then
    raise exception 'child_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists children_limit on children;
create trigger children_limit before insert on children for each row execute function public.enforce_child_limit();

-- ---------- entitlement check usable from RLS / edge functions ----------
create or replace function public.has_premium(p_parent uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from subscriptions s where s.parent_id = p_parent
    and s.plan <> 'free' and s.status in ('active', 'trialing') and (s.current_period_end is null or s.current_period_end > now()));
$$;
grant execute on function public.has_premium(uuid) to authenticated;

-- ---------- parent data export (GDPR/COPPA access request) ----------
create or replace function public.export_family_data() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'parent', (select to_jsonb(p) - 'parent_pin_hash' from parent_profiles p where p.id = auth.uid()),
    'subscription', (select to_jsonb(s) from subscriptions s where s.parent_id = auth.uid()),
    'children', coalesce((select jsonb_agg(jsonb_build_object(
        'profile', to_jsonb(c) - 'analytics_id',
        'preferences', (select to_jsonb(cp) from child_preferences cp where cp.child_id = c.id),
        'progress', (select jsonb_agg(to_jsonb(lp)) from language_progress lp where lp.child_id = c.id),
        'mastery', (select jsonb_agg(to_jsonb(m)) from learning_mastery m where m.child_id = c.id),
        'activities', (select jsonb_agg(to_jsonb(a)) from activity_history a where a.child_id = c.id),
        'speech_attempts', (select jsonb_agg(to_jsonb(sa)) from speech_attempts sa where sa.child_id = c.id),
        'story', (select jsonb_agg(to_jsonb(st)) from story_state st where st.child_id = c.id),
        'companion', (select to_jsonb(cp2) from companion_progress cp2 where cp2.child_id = c.id),
        'creations', (select jsonb_agg(to_jsonb(cr)) from creations cr where cr.child_id = c.id),
        'reports', (select jsonb_agg(to_jsonb(r)) from parent_reports r where r.child_id = c.id)
      )) from children c where c.parent_id = auth.uid()), '[]'::jsonb)
  );
$$;
grant execute on function public.export_family_data() to authenticated;

-- ---------- enable RLS everywhere ----------
do $$
declare t text;
begin
  foreach t in array array[
    'parent_profiles','children','child_preferences','avatars','subscriptions',
    'languages','interface_languages','curriculum_levels','skills','grammar_patterns','vocabulary','lexemes','phrases',
    'curriculum_units','characters','worlds','story_arcs','journeys','journey_scenes','games','game_templates','rewards',
    'achievements','books','songs','roleplays','avatar_items','companions','media_assets','content_translations','content_bundles',
    'language_progress','learning_mastery','review_schedule','daily_sessions','activity_history','game_sessions','speech_attempts',
    'pronunciation_results','reading_progress','writing_progress','story_state','story_choices','companion_progress',
    'reward_inventory','book_progress','creations','parent_reports','sync_operations',
    'notifications','feature_flags','experiments','experiment_assignments','admin_users','audit_logs','analytics_events']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- ---------- family-owned tables ----------
drop policy if exists parent_self on parent_profiles;
create policy parent_self on parent_profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists children_own on children;
create policy children_own on children for all to authenticated using (parent_id = auth.uid()) with check (parent_id = auth.uid());

drop policy if exists sub_read_own on subscriptions;
create policy sub_read_own on subscriptions for select to authenticated using (parent_id = auth.uid());
-- (no insert/update/delete policy: only the service role, used by verified billing webhooks, may write)

drop policy if exists notif_own on notifications;
create policy notif_own on notifications for all to authenticated using (parent_id = auth.uid()) with check (parent_id = auth.uid());

-- Child-scoped tables: access only through owns_child(child_id)
do $$
declare t text;
begin
  foreach t in array array['child_preferences','avatars','language_progress','learning_mastery','review_schedule','daily_sessions',
    'activity_history','game_sessions','speech_attempts','pronunciation_results','reading_progress','writing_progress','story_state',
    'story_choices','companion_progress','reward_inventory','book_progress','creations','sync_operations']
  loop
    execute format('drop policy if exists %I on %I', t || '_family', t);
    execute format('create policy %I on %I for all to authenticated using (public.owns_child(child_id)) with check (public.owns_child(child_id))', t || '_family', t);
  end loop;
end $$;

-- Reports: parents read; generated server-side.
drop policy if exists reports_read on parent_reports;
create policy reports_read on parent_reports for select to authenticated using (public.owns_child(child_id));
drop policy if exists reports_write on parent_reports;
create policy reports_write on parent_reports for insert to authenticated with check (public.owns_child(child_id));

-- ---------- content: read published, admins write ----------
do $$
declare t text;
begin
  -- tables with a status column
  foreach t in array array['vocabulary','phrases','curriculum_units','worlds','story_arcs','journeys','books','songs','roleplays','game_templates']
  loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('create policy %I on %I for select to anon, authenticated using (status = ''published'' or public.is_admin())', t || '_read', t);
    execute format('drop policy if exists %I on %I', t || '_admin', t);
    execute format('create policy %I on %I for all to authenticated using (public.is_admin(array[''editor'',''reviewer'']::admin_role[])) with check (public.is_admin(array[''editor'',''reviewer'']::admin_role[]))', t || '_admin', t);
  end loop;
  -- reference tables without status
  foreach t in array array['languages','interface_languages','curriculum_levels','skills','grammar_patterns','lexemes','characters',
    'journey_scenes','games','rewards','achievements','avatar_items','companions','media_assets','feature_flags']
  loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', t || '_read', t);
    execute format('drop policy if exists %I on %I', t || '_admin', t);
    execute format('create policy %I on %I for all to authenticated using (public.is_admin(array[''editor'']::admin_role[])) with check (public.is_admin(array[''editor'']::admin_role[]))', t || '_admin', t);
  end loop;
end $$;

drop policy if exists translations_rw on content_translations;
create policy translations_rw on content_translations for all to authenticated
  using (public.is_admin(array['editor','translator','reviewer']::admin_role[]))
  with check (public.is_admin(array['editor','translator','reviewer']::admin_role[]));

drop policy if exists bundles_read on content_bundles;
create policy bundles_read on content_bundles for select to anon, authenticated using (published or public.is_admin());
drop policy if exists bundles_admin on content_bundles;
create policy bundles_admin on content_bundles for all to authenticated
  using (public.is_admin(array['editor']::admin_role[])) with check (public.is_admin(array['editor']::admin_role[]));

-- ---------- platform ----------
drop policy if exists experiments_read on experiments;
create policy experiments_read on experiments for select to authenticated using (true);
drop policy if exists experiments_admin on experiments;
create policy experiments_admin on experiments for all to authenticated using (public.is_admin(array['analyst']::admin_role[])) with check (public.is_admin(array['analyst']::admin_role[]));

drop policy if exists assignments_own on experiment_assignments;
create policy assignments_own on experiment_assignments for all to authenticated
  using (exists (select 1 from children c where c.analytics_id = subject_id and c.parent_id = auth.uid()) or public.is_admin(array['analyst']::admin_role[]))
  with check (exists (select 1 from children c where c.analytics_id = subject_id and c.parent_id = auth.uid()));

drop policy if exists admin_users_self on admin_users;
create policy admin_users_self on admin_users for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists admin_users_owner on admin_users;
create policy admin_users_owner on admin_users for all to authenticated using (public.is_admin(array['owner']::admin_role[])) with check (public.is_admin(array['owner']::admin_role[]));

drop policy if exists audit_read on audit_logs;
create policy audit_read on audit_logs for select to authenticated using (public.is_admin());
drop policy if exists audit_insert on audit_logs;
create policy audit_insert on audit_logs for insert to authenticated with check (public.is_admin() and actor = auth.uid());

drop policy if exists analytics_insert on analytics_events;
create policy analytics_insert on analytics_events for insert to anon, authenticated with check (
  subject_kind = 'anonymous'
  or (subject_kind = 'parent' and subject_id = auth.uid())
  or (subject_kind = 'child' and exists (select 1 from children c where c.analytics_id = subject_id and c.parent_id = auth.uid()))
);
drop policy if exists analytics_read on analytics_events;
create policy analytics_read on analytics_events for select to authenticated using (public.is_admin(array['analyst']::admin_role[]));

-- ---------- product analytics views (admins only via RLS on base table) ----------
create or replace view analytics_daily_active with (security_invoker = true) as
  select date_trunc('day', at)::date as day, count(distinct subject_id) filter (where subject_kind = 'child') as active_children
  from analytics_events group by 1;

-- ---------- storage bucket for content media (public read, admin write) ----------
insert into storage.buckets (id, name, public) values ('content-media', 'content-media', true) on conflict (id) do nothing;
drop policy if exists "content media read" on storage.objects;
create policy "content media read" on storage.objects for select to anon, authenticated using (bucket_id = 'content-media');
drop policy if exists "content media admin write" on storage.objects;
create policy "content media admin write" on storage.objects for all to authenticated
  using (bucket_id = 'content-media' and public.is_admin(array['editor']::admin_role[]))
  with check (bucket_id = 'content-media' and public.is_admin(array['editor']::admin_role[]));
