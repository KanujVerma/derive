-- E1: paid managed-skincare writes require the current canonical membership.
-- Owner reads, account identity, billing management, and historical records remain available.

do $$
declare
  unexpected text;
begin
  select string_agg(schemaname || '.' || tablename || '.' || policyname, ', ' order by schemaname, tablename, policyname)
  into unexpected
  from pg_policies
  where (
    schemaname = 'public'
    and tablename in ('skin_profiles', 'user_products', 'user_photos', 'check_ins', 'refill_requests')
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and policyname not in (
      'skin_profiles_insert_own', 'skin_profiles_update_own',
      'user_products_insert_own', 'user_products_update_own', 'user_products_delete_own',
      'user_photos_insert_own_path', 'check_ins_insert_own', 'refill_requests_insert_own'
    )
  ) or (
    schemaname = 'storage' and tablename = 'objects'
    and cmd in ('INSERT', 'ALL')
    and policyname <> 'customer_skin_photos_insert_own'
  );
  if unexpected is not null then
    raise exception 'E1: unexpected write policies require review: %', unexpected;
  end if;
end;
$$;

-- The timestamp is server-written ordering evidence, not a Stripe identifier.
-- Owner RLS still limits this column to the caller's own membership rows.
grant select (last_stripe_event_created_at) on public.memberships to authenticated;

create or replace function public.current_member_is_active()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select m.status = 'active'
    from public.memberships as m
    where m.user_id = (select auth.uid())
    order by m.last_stripe_event_created_at desc nulls last, m.created_at desc
    limit 1
  ), false);
$$;
revoke all on function public.current_member_is_active() from public, anon;
grant execute on function public.current_member_is_active() to authenticated;

drop policy if exists skin_profiles_insert_own on public.skin_profiles;
create policy skin_profiles_insert_own on public.skin_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.current_member_is_active()));
drop policy if exists skin_profiles_update_own on public.skin_profiles;
create policy skin_profiles_update_own on public.skin_profiles for update to authenticated
  using ((select auth.uid()) = user_id and (select public.current_member_is_active()))
  with check ((select auth.uid()) = user_id and (select public.current_member_is_active()));

drop policy if exists user_products_insert_own on public.user_products;
create policy user_products_insert_own on public.user_products for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.current_member_is_active()));
drop policy if exists user_products_update_own on public.user_products;
create policy user_products_update_own on public.user_products for update to authenticated
  using ((select auth.uid()) = user_id and (select public.current_member_is_active()))
  with check ((select auth.uid()) = user_id and (select public.current_member_is_active()));
drop policy if exists user_products_delete_own on public.user_products;
create policy user_products_delete_own on public.user_products for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.current_member_is_active()));

drop policy if exists user_photos_insert_own_path on public.user_photos;
create policy user_photos_insert_own_path on public.user_photos for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and storage_path like user_id::text || '/%'
    and (select public.current_member_is_active())
  );

drop policy if exists check_ins_insert_own on public.check_ins;
create policy check_ins_insert_own on public.check_ins for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.current_member_is_active()));
drop policy if exists refill_requests_insert_own on public.refill_requests;
create policy refill_requests_insert_own on public.refill_requests for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.current_member_is_active()));

drop policy if exists customer_skin_photos_insert_own on storage.objects;
create policy customer_skin_photos_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'customer-skin-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and owner_id = (select auth.uid())::text
    and (select public.current_member_is_active())
  );
