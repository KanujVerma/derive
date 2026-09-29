-- Owner-bound Managed Skincare waitlist. Interest is not a membership,
-- entitlement, or payment. The authenticated session is the only owner.

create table public.managed_waitlist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('joined', 'withdrawn')),
  joined_at timestamptz not null,
  withdrawn_at timestamptz,
  offer_version text not null,
  price_cents integer not null,
  entry_surface text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint managed_waitlist_offer_known check (
    offer_version = 'managed_waitlist_v1' and price_cents = 2500
  ),
  constraint managed_waitlist_surface_known check (
    entry_surface in ('plan', 'check', 'account', 'other')
  )
);

alter table public.managed_waitlist enable row level security;

create policy managed_waitlist_select_own
  on public.managed_waitlist
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.managed_waitlist from public, anon, authenticated;
grant select on table public.managed_waitlist to authenticated;

create or replace function public.read_managed_waitlist()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.managed_waitlist;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into v_row from public.managed_waitlist where user_id = v_user;
  if not found then
    return jsonb_build_object('status', 'none');
  end if;
  return jsonb_build_object(
    'status', v_row.status,
    'joinedAt', v_row.joined_at,
    'offerVersion', v_row.offer_version
  );
end;
$$;

create or replace function public.join_managed_waitlist(
  p_offer_version text,
  p_price_cents integer,
  p_entry_surface text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.managed_waitlist;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_offer_version is distinct from 'managed_waitlist_v1'
    or p_price_cents is distinct from 2500
    or p_entry_surface is null
    or p_entry_surface not in ('plan', 'check', 'account', 'other') then
    raise exception 'invalid offer' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 191028));
  select * into v_row from public.managed_waitlist where user_id = v_user;
  if found and v_row.status = 'joined' then
    return jsonb_build_object(
      'status', 'joined',
      'joinedAt', v_row.joined_at,
      'offerVersion', v_row.offer_version
    );
  end if;

  insert into public.managed_waitlist (
    user_id, status, joined_at, withdrawn_at, offer_version, price_cents, entry_surface, updated_at
  ) values (
    v_user, 'joined', pg_catalog.clock_timestamp(), null, p_offer_version, p_price_cents, p_entry_surface, pg_catalog.clock_timestamp()
  )
  on conflict (user_id) do update
    set status = 'joined',
        joined_at = pg_catalog.clock_timestamp(),
        offer_version = excluded.offer_version,
        price_cents = excluded.price_cents,
        entry_surface = excluded.entry_surface,
        updated_at = pg_catalog.clock_timestamp()
  returning * into v_row;

  return jsonb_build_object(
    'status', 'joined',
    'joinedAt', v_row.joined_at,
    'offerVersion', v_row.offer_version
  );
end;
$$;

create or replace function public.withdraw_managed_waitlist()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.managed_waitlist;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 191028));
  select * into v_row from public.managed_waitlist where user_id = v_user for update;
  if not found then
    return jsonb_build_object('status', 'none');
  end if;
  if v_row.status = 'withdrawn' then
    return jsonb_build_object(
      'status', 'withdrawn',
      'joinedAt', v_row.joined_at,
      'offerVersion', v_row.offer_version
    );
  end if;
  update public.managed_waitlist
    set status = 'withdrawn',
        withdrawn_at = pg_catalog.clock_timestamp(),
        updated_at = pg_catalog.clock_timestamp()
    where user_id = v_user
  returning * into v_row;
  return jsonb_build_object(
    'status', 'withdrawn',
    'joinedAt', v_row.joined_at,
    'offerVersion', v_row.offer_version
  );
end;
$$;

revoke all on function public.read_managed_waitlist() from public, anon;
revoke all on function public.join_managed_waitlist(text, integer, text) from public, anon;
revoke all on function public.withdraw_managed_waitlist() from public, anon;
grant execute on function public.read_managed_waitlist() to authenticated;
grant execute on function public.join_managed_waitlist(text, integer, text) to authenticated;
grant execute on function public.withdraw_managed_waitlist() to authenticated;
