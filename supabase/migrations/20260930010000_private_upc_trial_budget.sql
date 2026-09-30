-- Private phone evaluation only. Global timestamps survive customer deletion,
-- so cycling accounts cannot replenish the provider-wide free allowance.
create table private.upc_trial_reservations (
  id bigint generated always as identity primary key,
  reserved_at timestamptz not null default clock_timestamp()
);
create index upc_trial_reservations_time_idx on private.upc_trial_reservations (reserved_at);
alter table private.upc_trial_reservations enable row level security;
revoke all on private.upc_trial_reservations from public, anon, authenticated;
grant select, insert, delete on private.upc_trial_reservations to service_role;
grant usage on sequence private.upc_trial_reservations_id_seq to service_role;

create function public.reserve_private_upc_trial(p_user_id uuid)
returns void language plpgsql volatile security invoker set search_path = '' as $$
declare v_now timestamptz;
begin
  if p_user_id is null then raise exception 'UPC_OWNER_UNAVAILABLE'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 191027));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('derive_private_upc_trial', 30010000));
  if not exists (select 1 from public.profiles where id = p_user_id and deletion_started_at is null) then
    raise exception 'UPC_OWNER_UNAVAILABLE';
  end if;
  v_now := clock_timestamp();
  delete from private.upc_trial_reservations where reserved_at <= v_now - interval '1 day';
  -- Trial: 100/day, 6/min. Reserve headroom for separate diagnostic tools.
  if (select count(*) from private.upc_trial_reservations) >= 80
    or exists (select 1 from private.upc_trial_reservations where reserved_at > v_now - interval '11 seconds') then
    raise exception 'UPC_TRIAL_LIMIT';
  end if;
  insert into private.upc_trial_reservations (reserved_at) values (v_now);
end;
$$;
revoke all on function public.reserve_private_upc_trial(uuid) from public, anon, authenticated;
grant execute on function public.reserve_private_upc_trial(uuid) to service_role;
