-- ============================================================================
-- Derive S1A: Auth provisioning, least-privilege RLS, and private photo storage
--
-- This migration is intentionally additive. The baseline migration may already
-- have reached a shared Supabase project, so its history is not rewritten.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Auth -> profile lifecycle
-- --------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();

  return new;
end;
$$;

revoke all on function private.handle_auth_user_change() from public, anon, authenticated;

drop trigger if exists derive_profile_after_auth_insert on auth.users;
create trigger derive_profile_after_auth_insert
  after insert on auth.users
  for each row execute function private.handle_auth_user_change();

drop trigger if exists derive_profile_after_auth_identity_update on auth.users;
create trigger derive_profile_after_auth_identity_update
  after update of email, raw_user_meta_data on auth.users
  for each row execute function private.handle_auth_user_change();

-- Backfill profiles for auth users created before the trigger existed.
insert into public.profiles (id, email, full_name)
select
  users.id,
  coalesce(users.email, ''),
  nullif(trim(coalesce(users.raw_user_meta_data ->> 'full_name', '')), '')
from auth.users as users
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(public.profiles.full_name, excluded.full_name),
  updated_at = now();

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

drop trigger if exists skin_profiles_set_updated_at on public.skin_profiles;
create trigger skin_profiles_set_updated_at
  before update on public.skin_profiles
  for each row execute function private.set_updated_at();

-- --------------------------------------------------------------------------
-- RLS enablement and least-privilege grants
-- --------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.skin_profiles enable row level security;
alter table public.products enable row level security;
alter table public.user_products enable row level security;
alter table public.routines enable row level security;
alter table public.routine_items enable row level security;
alter table public.user_photos enable row level security;
alter table public.check_ins enable row level security;
alter table public.refill_requests enable row level security;
alter table public.founder_review_tasks enable row level security;

-- Do not inherit permissive Data API defaults for future public objects. New
-- tables/functions must opt client roles in explicitly after RLS review.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

revoke all privileges on table public.profiles from anon, authenticated;
revoke all privileges on table public.memberships from anon, authenticated;
revoke all privileges on table public.skin_profiles from anon, authenticated;
revoke all privileges on table public.products from anon, authenticated;
revoke all privileges on table public.user_products from anon, authenticated;
revoke all privileges on table public.routines from anon, authenticated;
revoke all privileges on table public.routine_items from anon, authenticated;
revoke all privileges on table public.user_photos from anon, authenticated;
revoke all privileges on table public.check_ins from anon, authenticated;
revoke all privileges on table public.refill_requests from anon, authenticated;
revoke all privileges on table public.founder_review_tasks from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

grant select on table public.profiles to authenticated;
grant update (full_name, phone) on table public.profiles to authenticated;

grant select (id, user_id, tier, status, created_at)
  on table public.memberships to authenticated;

grant select on table public.skin_profiles to authenticated;
grant insert (
  user_id,
  primary_goal,
  secondary_goals,
  routine_complexity,
  cost_preference,
  midday_feel,
  post_cleanse_tightness,
  known_sensitivities,
  active_prescriptions,
  is_pregnant_or_nursing,
  additional_notes
) on table public.skin_profiles to authenticated;
grant update (
  primary_goal,
  secondary_goals,
  routine_complexity,
  cost_preference,
  midday_feel,
  post_cleanse_tightness,
  known_sensitivities,
  active_prescriptions,
  is_pregnant_or_nursing,
  additional_notes
) on table public.skin_profiles to authenticated;
grant select on table public.products to authenticated;
grant select, delete on table public.user_products to authenticated;
grant insert (
  user_id,
  product_id,
  detected_brand,
  detected_name,
  action,
  action_reason,
  frequency_nights_per_week,
  is_confirmed_by_user
) on table public.user_products to authenticated;
grant update (
  product_id,
  detected_brand,
  detected_name,
  action,
  action_reason,
  frequency_nights_per_week,
  is_confirmed_by_user
) on table public.user_products to authenticated;

grant select (id, user_id, version, status, summary_sentence, created_at, published_at)
  on table public.routines to authenticated;
grant select on table public.routine_items to authenticated;

grant select on table public.user_photos to authenticated;
grant insert (user_id, photo_type, storage_path)
  on table public.user_photos to authenticated;

grant select on table public.check_ins to authenticated;
grant insert (user_id, skin_state, irritation, notes)
  on table public.check_ins to authenticated;

grant select on table public.refill_requests to authenticated;
grant insert (user_id, product_name, brand)
  on table public.refill_requests to authenticated;

-- These application tables are Derive-owned. Normalize every existing policy,
-- including dashboard-created drift, before installing the audited policy set.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles',
        'memberships',
        'skin_profiles',
        'products',
        'user_products',
        'routines',
        'routine_items',
        'user_photos',
        'check_ins',
        'refill_requests',
        'founder_review_tasks'
      ])
  loop
    execute format(
      'drop policy %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end;
$$;

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy memberships_select_own
  on public.memberships for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy skin_profiles_select_own
  on public.skin_profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy skin_profiles_insert_own
  on public.skin_profiles for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy skin_profiles_update_own
  on public.skin_profiles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy products_select_authenticated
  on public.products for select
  to authenticated
  using (true);

create policy user_products_select_own
  on public.user_products for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_products_insert_own
  on public.user_products for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy user_products_update_own
  on public.user_products for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy user_products_delete_own
  on public.user_products for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy routines_select_own
  on public.routines for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy routine_items_select_own
  on public.routine_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.routines
      where routines.id = routine_items.routine_id
        and routines.user_id = (select auth.uid())
    )
  );

create policy user_photos_select_own
  on public.user_photos for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy user_photos_insert_own_path
  on public.user_photos for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and storage_path like user_id::text || '/%'
  );

create policy check_ins_select_own
  on public.check_ins for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy check_ins_insert_own
  on public.check_ins for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy refill_requests_select_own
  on public.refill_requests for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy refill_requests_insert_own
  on public.refill_requests for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- founder_review_tasks intentionally has no anon/authenticated policy.
-- Trusted server operations use the server-side service role, which bypasses RLS.

-- Index every ownership key used by an RLS predicate.
create index if not exists memberships_user_id_idx
  on public.memberships (user_id);
create index if not exists user_products_user_id_idx
  on public.user_products (user_id);
create index if not exists routines_user_id_version_idx
  on public.routines (user_id, version desc);
create index if not exists routine_items_routine_id_idx
  on public.routine_items (routine_id);
create index if not exists user_photos_user_id_idx
  on public.user_photos (user_id);
create index if not exists check_ins_user_id_idx
  on public.check_ins (user_id);
create index if not exists refill_requests_user_id_idx
  on public.refill_requests (user_id);
create index if not exists founder_review_tasks_user_id_idx
  on public.founder_review_tasks (user_id);

-- --------------------------------------------------------------------------
-- Private photo bucket
-- --------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'customer-skin-photos',
  'customer-skin-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- An unrelated permissive storage.objects policy would be OR-combined with
-- Derive's restrictions. Fail closed so a shared-project deploy must inspect
-- and explicitly reconcile any pre-existing Storage policy first.
do $$
declare
  unexpected_policies text;
begin
  select string_agg(policyname, ', ' order by policyname)
  into unexpected_policies
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname not in (
      'customer_skin_photos_insert_own',
      'customer_skin_photos_operation_metadata',
      'customer_skin_photos_delete_own'
    );

  if unexpected_policies is not null then
    raise exception
      'Unexpected storage.objects policies require explicit review before Derive photo policy install: %',
      unexpected_policies;
  end if;
end;
$$;

drop policy if exists customer_skin_photos_insert_own on storage.objects;
drop policy if exists customer_skin_photos_operation_metadata on storage.objects;
drop policy if exists customer_skin_photos_delete_own on storage.objects;

create policy customer_skin_photos_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'customer-skin-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and owner_id = (select auth.uid())::text
  );

-- Immutable, non-upserting uploads require only INSERT. There is deliberately
-- no customer SELECT, UPDATE, or DELETE policy: customers cannot list, read,
-- sign, replace, or independently remove objects. Trusted endpoints must issue
-- short-lived reads and perform Storage-API-first deletion so blobs and metadata
-- cannot be separated by a partial client workflow.
