-- Stop customer-owned private uploads before account deletion inventories Storage.
-- The upload policy and deletion RPC share a transaction-scoped advisory lock:
-- a deletion waits for admitted DB inserts to commit, and subsequent inserts
-- see the durable deletion marker. This marker is deliberately server-writable.
alter table public.profiles
  add column deletion_started_at timestamptz;

revoke update (deletion_started_at) on public.profiles from anon, authenticated;

create or replace function public.customer_private_upload_allowed()
returns boolean
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_allowed boolean;
begin
  if v_user_id is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 191027));
  select p.deletion_started_at is null into v_allowed
    from public.profiles p where p.id = v_user_id;
  return coalesce(v_allowed, false);
end;
$$;
revoke all on function public.customer_private_upload_allowed() from public, anon;
grant execute on function public.customer_private_upload_allowed() to authenticated;

create or replace function public.begin_customer_account_deletion(p_user_id uuid)
returns boolean
language plpgsql volatile security invoker
set search_path = ''
as $$
begin
  if p_user_id is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 191027));
  update public.profiles
    set deletion_started_at = coalesce(deletion_started_at, now())
    where id = p_user_id;
  return found;
end;
$$;
revoke all on function public.begin_customer_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.begin_customer_account_deletion(uuid) to service_role;

-- Restrictive policies AND with both the managed and free permissive policies,
-- including any future customer INSERT policy for these two private buckets.
create policy customer_private_upload_deletion_fence
  on storage.objects as restrictive for insert to authenticated
  with check (
    bucket_id not in ('customer-skin-photos', 'customer-product-evidence')
    or (select public.customer_private_upload_allowed())
  );
