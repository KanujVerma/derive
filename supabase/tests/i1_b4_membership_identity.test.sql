begin;

select plan(12);

-- Canonical membership identity after I1-B4A.

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memberships'
      and column_name = 'tier'
      and column_default like '%founding_beta%'
      and column_default not like '%founding_beta_129%'
  ),
  'memberships.tier default is founding_beta'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memberships'
      and column_name = 'tier'
      and is_nullable = 'NO'
  ),
  'memberships.tier is NOT NULL'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'memberships'
      and c.contype = 'c'
      and c.conname = 'memberships_tier_check'
      and pg_get_constraintdef(c.oid) like '%founding_beta%'
      and pg_get_constraintdef(c.oid) not like '%founding_beta_129%'
  ),
  'memberships.tier CHECK accepts only founding_beta'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'memberships'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%active%'
      and pg_get_constraintdef(c.oid) like '%paused%'
      and pg_get_constraintdef(c.oid) like '%cancelled%'
  ),
  'memberships.status CHECK remains active/paused/cancelled'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  'b4a11111-1111-1111-1111-111111111111',
  'member_b4a@example.test',
  '{"full_name":"Member B4A"}'::jsonb
);

select lives_ok(
  $$
    insert into public.memberships (user_id, status)
    values ('b4a11111-1111-1111-1111-111111111111', 'active')
  $$,
  'inserting a membership without tier uses founding_beta default'
);

select results_eq(
  $$select tier from public.memberships where user_id = 'b4a11111-1111-1111-1111-111111111111'$$,
  array['founding_beta'],
  'defaulted membership row is founding_beta'
);

select lives_ok(
  $$
    insert into public.memberships (user_id, tier, status)
    values (
      'b4a11111-1111-1111-1111-111111111111',
      'founding_beta',
      'paused'
    )
  $$,
  'explicit founding_beta is accepted'
);

select throws_ok(
  $$
    insert into public.memberships (user_id, tier, status)
    values (
      'b4a11111-1111-1111-1111-111111111111',
      'founding_beta_129',
      'active'
    )
  $$,
  '23514',
  null,
  'legacy founding_beta_129 is rejected after B4A'
);

select throws_ok(
  $$
    insert into public.memberships (user_id, tier, status)
    values (
      'b4a11111-1111-1111-1111-111111111111',
      'premium',
      'active'
    )
  $$,
  '23514',
  null,
  'arbitrary membership tiers are rejected'
);

select ok(
  has_column_privilege('authenticated', 'public.memberships', 'tier', 'select')
    and not has_column_privilege('authenticated', 'public.memberships', 'tier', 'insert')
    and not has_column_privilege('authenticated', 'public.memberships', 'tier', 'update')
    and not has_column_privilege('authenticated', 'public.memberships', 'status', 'insert')
    and not has_column_privilege('authenticated', 'public.memberships', 'status', 'update')
    and not has_column_privilege('authenticated', 'public.memberships', 'stripe_customer_id', 'select')
    and not has_column_privilege('authenticated', 'public.memberships', 'stripe_subscription_id', 'select'),
  'authenticated members retain membership read-only access without Stripe projection or mutation'
);

set local role authenticated;
set local request.jwt.claim.sub = 'b4a11111-1111-1111-1111-111111111111';

select throws_ok(
  $$update public.memberships set status = 'cancelled'$$,
  '42501',
  null,
  'authenticated users cannot mutate membership status'
);

select throws_ok(
  $$
    insert into public.memberships (user_id, tier, status)
    values (
      'b4a11111-1111-1111-1111-111111111111',
      'founding_beta',
      'active'
    )
  $$,
  '42501',
  null,
  'authenticated users cannot insert memberships'
);

select * from finish();
rollback;
