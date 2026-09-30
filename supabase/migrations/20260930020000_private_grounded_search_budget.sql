-- Private founder evaluation budget. Only attempt timestamps are retained;
-- no owner, product identity, query, ingredient text or model response is stored.
-- Global reservations survive account deletion to prevent allowance recycling.
create table private.grounded_search_reservations (
  id bigint generated always as identity primary key,
  reserved_at timestamptz not null default clock_timestamp()
);
create index grounded_search_reservations_time_idx on private.grounded_search_reservations (reserved_at);
alter table private.grounded_search_reservations enable row level security;
revoke all on private.grounded_search_reservations from public, anon, authenticated;
grant select, insert, delete on private.grounded_search_reservations to service_role;
grant usage on sequence private.grounded_search_reservations_id_seq to service_role;

create function public.reserve_private_grounded_search(p_user_id uuid)
returns void language plpgsql volatile security invoker set search_path = '' as $$
declare v_now timestamptz;
begin
  if p_user_id is null then raise exception 'GROUNDED_SEARCH_OWNER_UNAVAILABLE'; end if;
  -- Coordinate with the existing account-deletion fence before reserving globally.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 191027));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('derive_private_grounded_search', 30020000));
  if not exists (select 1 from public.profiles where id = p_user_id and deletion_started_at is null) then
    raise exception 'GROUNDED_SEARCH_OWNER_UNAVAILABLE';
  end if;
  v_now := clock_timestamp();
  delete from private.grounded_search_reservations where reserved_at <= v_now - interval '1 day';
  -- Reserve before the provider call; provider failures still consume this budget.
  if (select count(*) from private.grounded_search_reservations) >= 20
    or exists (select 1 from private.grounded_search_reservations where reserved_at > v_now - interval '10 seconds') then
    raise exception 'GROUNDED_SEARCH_LIMIT';
  end if;
  insert into private.grounded_search_reservations (reserved_at) values (v_now);
end;
$$;
revoke all on function public.reserve_private_grounded_search(uuid) from public, anon, authenticated;
grant execute on function public.reserve_private_grounded_search(uuid) to service_role;
