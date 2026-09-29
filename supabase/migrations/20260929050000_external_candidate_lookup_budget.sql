-- Evaluation-only OBF request reservations. No barcode or product data is stored.
-- This is independent of customer Check quotas and analytics ingestion.
create table private.external_candidate_lookup_reservations (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reserved_at timestamptz not null default clock_timestamp()
);
create index external_candidate_lookup_owner_time_idx
  on private.external_candidate_lookup_reservations (user_id, reserved_at desc);
create index external_candidate_lookup_time_idx
  on private.external_candidate_lookup_reservations (reserved_at desc);

alter table private.external_candidate_lookup_reservations enable row level security;
revoke all on private.external_candidate_lookup_reservations from public, anon, authenticated;
grant select, insert, delete on private.external_candidate_lookup_reservations to service_role;
grant usage on sequence private.external_candidate_lookup_reservations_id_seq to service_role;

create function public.reserve_external_candidate_lookup(p_user_id uuid)
returns void
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_now timestamptz;
begin
  if p_user_id is null then raise exception 'INVALID_EXTERNAL_CANDIDATE_OWNER'; end if;
  -- Shared deletion fence, then one global lock: concurrent Edge instances
  -- cannot each observe the same remaining provider budget.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 191027));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('derive_obf_lookup_budget', 29050000));
  if not exists (select 1 from public.profiles
      where id = p_user_id and deletion_started_at is null) then
    raise exception 'EXTERNAL_CANDIDATE_OWNER_UNAVAILABLE';
  end if;
  v_now := clock_timestamp();
  delete from private.external_candidate_lookup_reservations
    where reserved_at <= v_now - interval '1 day';
  -- Published product-read limit is 15/minute/IP. Reserve headroom for
  -- non-Edge diagnostic reads sharing an outbound address.
  if (select count(*) from private.external_candidate_lookup_reservations
      where reserved_at > v_now - interval '1 minute') >= 12
     or (select count(*) from private.external_candidate_lookup_reservations
      where reserved_at > v_now - interval '1 day') >= 1000 then
    raise exception 'EXTERNAL_CANDIDATE_GLOBAL_LIMIT';
  end if;
  if (select count(*) from private.external_candidate_lookup_reservations
      where user_id = p_user_id and reserved_at > v_now - interval '1 minute') >= 10
     or (select count(*) from private.external_candidate_lookup_reservations
      where user_id = p_user_id and reserved_at > v_now - interval '1 day') >= 100 then
    raise exception 'EXTERNAL_CANDIDATE_USER_LIMIT';
  end if;
  insert into private.external_candidate_lookup_reservations (user_id, reserved_at)
    values (p_user_id, v_now);
end;
$$;
revoke all on function public.reserve_external_candidate_lookup(uuid) from public, anon, authenticated;
grant execute on function public.reserve_external_candidate_lookup(uuid) to service_role;
