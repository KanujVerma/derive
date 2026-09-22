-- Build 9: optional automatic free Founding Beta access for the external TestFlight cohort.
-- The release flag defaults to false. A new environment does not open access until a trusted
-- operator explicitly enables open_external_testflight_beta.

create table if not exists private.release_flags (
  key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  constraint release_flags_key_check check (key ~ '^[a-z0-9_]+$')
);

revoke all on table private.release_flags from public, anon, authenticated;
grant all on table private.release_flags to service_role;

alter table private.release_flags enable row level security;

insert into private.release_flags (key, enabled)
values ('open_external_testflight_beta', false)
on conflict (key) do nothing;

create or replace function public.claim_external_beta_access()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_membership public.memberships;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform 1
  from public.profiles
  where id = v_user
  for update;

  if not found then
    raise exception 'profile required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from private.release_flags
    where key = 'open_external_testflight_beta'
      and enabled is true
  ) then
    raise exception 'beta access is closed' using errcode = '42501';
  end if;

  select *
  into v_membership
  from public.memberships
  where user_id = v_user
  order by last_stripe_event_created_at desc nulls last, created_at desc
  limit 1;

  if found then
    if v_membership.stripe_customer_id is not null
      or v_membership.stripe_subscription_id is not null
      or v_membership.stripe_price_id is not null
      or v_membership.last_stripe_event_created_at is not null
      or v_membership.status in ('paused', 'cancelled')
      or v_membership.status is distinct from 'active'
      or v_membership.tier is distinct from 'founding_beta' then
      return jsonb_build_object('result', 'unchanged');
    end if;

    return jsonb_build_object('result', 'already_active');
  end if;

  insert into public.memberships (
    user_id,
    tier,
    status,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    cancel_at_period_end
  ) values (
    v_user,
    'founding_beta',
    'active',
    null,
    null,
    null,
    false
  );

  return jsonb_build_object('result', 'granted');
end;
$$;

revoke all on function public.claim_external_beta_access() from public, anon;
grant execute on function public.claim_external_beta_access() to authenticated, service_role;
