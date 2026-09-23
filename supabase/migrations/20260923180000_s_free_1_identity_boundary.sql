-- S-FREE-1: an authenticated guest is not a managed member, even if a stale
-- or synthetic membership row exists. Applied migrations are never rewritten.

-- Guest accounts have no email. Preserve that truth, and let a later identity
-- link update the same profile UUID instead of inventing a placeholder email.
alter table public.profiles alter column email drop not null;
update public.profiles as p set email = null
from auth.users as u
where p.id = u.id and u.is_anonymous is true and p.email = '';

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
    nullif(trim(coalesce(new.email, '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      updated_at = now();
  return new;
end;
$$;
revoke all on function private.handle_auth_user_change() from public, anon, authenticated;

create or replace function private.current_auth_identity_is_permanent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select u.is_anonymous is false
    from auth.users as u
    where u.id = (select auth.uid())
  ), false);
$$;
revoke all on function private.current_auth_identity_is_permanent() from public, anon, authenticated;

-- The customer may execute this zero-argument function, but it can inspect
-- only their own Auth identity and latest managed membership. RLS policies
-- already call it for all managed-only direct writes and private uploads.
create or replace function public.current_member_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_auth_identity_is_permanent() and coalesce((
    select m.status = 'active'
    from public.memberships as m
    where m.user_id = (select auth.uid())
    order by m.last_stripe_event_created_at desc nulls last, m.created_at desc
    limit 1
  ), false);
$$;
revoke all on function public.current_member_is_active() from public, anon;
grant execute on function public.current_member_is_active() to authenticated;

-- Build 9's private release flag is not a substitute for identity. Replacing
-- this function is additive; its existing signature/grants and historical
-- paused, cancelled, Stripe-bound, and idempotency behavior are preserved.
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
  if not private.current_auth_identity_is_permanent() then
    raise exception 'permanent identity required' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = v_user for update;
  if not found then
    raise exception 'profile required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from private.release_flags
    where key = 'open_external_testflight_beta' and enabled is true
  ) then
    raise exception 'beta access is closed' using errcode = '42501';
  end if;

  select * into v_membership
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
    user_id, tier, status, stripe_customer_id, stripe_subscription_id,
    stripe_price_id, cancel_at_period_end
  ) values (v_user, 'founding_beta', 'active', null, null, null, false);

  return jsonb_build_object('result', 'granted');
end;
$$;
revoke all on function public.claim_external_beta_access() from public, anon;
grant execute on function public.claim_external_beta_access() to authenticated, service_role;

-- Free product facts are delivered only through the bounded catalog/resolver
-- functions. Do not expose raw product ingredient/caution columns merely
-- because an authenticated guest can read a sourced product row. Existing
-- managed members retain historical product/Shelf reads.
drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated on public.products for select to authenticated
using (
  (select public.current_member_is_active())
  or exists (
    select 1 from public.user_products as own_shelf
    where own_shelf.product_id = products.id
      and own_shelf.user_id = (select auth.uid())
  )
);
