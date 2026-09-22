begin;
select plan(22);

select ok(
  not has_table_privilege('anon', 'private.release_flags', 'select')
  and not has_table_privilege('authenticated', 'private.release_flags', 'select')
  and not has_table_privilege('anon', 'private.release_flags', 'update')
  and not has_table_privilege('authenticated', 'private.release_flags', 'update'),
  'release flags are not customer-readable or writable'
);

select ok(
  not has_function_privilege('anon', 'public.claim_external_beta_access()', 'execute')
  and has_function_privilege('authenticated', 'public.claim_external_beta_access()', 'execute'),
  'only an authenticated caller may execute the beta claim'
);

select results_eq(
  $$select enabled from private.release_flags where key = 'open_external_testflight_beta'$$,
  array[false],
  'open external beta defaults to closed'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('b9111111-1111-4111-8111-111111111111', 'build9-none@example.test', '{"full_name":"Build Nine"}'::jsonb),
  ('b9222222-2222-4222-8222-222222222222', 'build9-active@example.test', '{"full_name":"Already Active"}'::jsonb),
  ('b9333333-3333-4333-8333-333333333333', 'build9-paused@example.test', '{"full_name":"Paused"}'::jsonb),
  ('b9444444-4444-4444-8444-444444444444', 'build9-cancelled@example.test', '{"full_name":"Cancelled"}'::jsonb),
  ('b9555555-5555-4555-8555-555555555555', 'build9-stripe@example.test', '{"full_name":"Stripe"}'::jsonb),
  ('b9666666-6666-4666-8666-666666666666', 'build9-noprofile@example.test', '{"full_name":"No Profile"}'::jsonb);

insert into public.memberships (user_id, tier, status) values
  ('b9222222-2222-4222-8222-222222222222', 'founding_beta', 'active'),
  ('b9333333-3333-4333-8333-333333333333', 'founding_beta', 'paused'),
  ('b9444444-4444-4444-8444-444444444444', 'founding_beta', 'cancelled');
insert into public.memberships (
  user_id, tier, status, stripe_customer_id, stripe_subscription_id, last_stripe_event_created_at
) values (
  'b9555555-5555-4555-8555-555555555555',
  'founding_beta',
  'active',
  'cus_build9',
  'sub_build9',
  '2026-09-22T12:00:00Z'
);

delete from public.profiles where id = 'b9666666-6666-4666-8666-666666666666';

set local role anon;
select throws_ok(
  $$select public.claim_external_beta_access()$$,
  '42501', null,
  'anonymous callers cannot claim beta access'
);

set local role authenticated;
select throws_ok(
  $$select public.claim_external_beta_access()$$,
  '42501', null,
  'a session without an auth user cannot claim beta access'
);

set local request.jwt.claim.sub = 'b9111111-1111-4111-8111-111111111111';
select throws_ok(
  $$select public.claim_external_beta_access()$$,
  '42501', null,
  'a closed release flag refuses the claim'
);

set local role postgres;
update private.release_flags set enabled = true where key = 'open_external_testflight_beta';

set local role authenticated;
set local request.jwt.claim.sub = 'b9666666-6666-4666-8666-666666666666';
select throws_ok(
  $$select public.claim_external_beta_access()$$,
  '42501', null,
  'a caller without a profile cannot claim beta access'
);

set local request.jwt.claim.sub = 'b9111111-1111-4111-8111-111111111111';
select results_eq(
  $$select public.claim_external_beta_access() ->> 'result'$$,
  array['granted'::text],
  'a member with no membership receives active founding beta access'
);
set local role service_role;
select results_eq(
  $$select tier, status, stripe_customer_id, stripe_subscription_id, stripe_price_id, cancel_at_period_end
    from public.memberships where user_id = 'b9111111-1111-4111-8111-111111111111'$$,
  $$values ('founding_beta'::text, 'active'::text, null::text, null::text, null::text, false)$$,
  'the free beta row carries no Stripe lifecycle'
);
set local role authenticated;
set local request.jwt.claim.sub = 'b9111111-1111-4111-8111-111111111111';
select results_eq(
  $$select public.claim_external_beta_access() ->> 'result'$$,
  array['already_active'::text],
  'a repeated claim is idempotent'
);
set local role service_role;
select results_eq(
  $$select count(*)::int from public.memberships where user_id = 'b9111111-1111-4111-8111-111111111111'$$,
  array[1],
  'a repeated claim does not insert a second row'
);

set local request.jwt.claim.sub = 'b9222222-2222-4222-8222-222222222222';
select results_eq(
  $$select public.claim_external_beta_access() ->> 'result'$$,
  array['already_active'::text],
  'an already active member is unchanged'
);
set local role service_role;
select results_eq(
  $$select count(*)::int from public.memberships where user_id = 'b9222222-2222-4222-8222-222222222222'$$,
  array[1],
  'an already active member does not gain a duplicate row'
);

set local request.jwt.claim.sub = 'b9333333-3333-4333-8333-333333333333';
select results_eq(
  $$select public.claim_external_beta_access() ->> 'result'$$,
  array['unchanged'::text],
  'a paused membership is not reactivated'
);
select results_eq(
  $$select status from public.memberships where user_id = 'b9333333-3333-4333-8333-333333333333'$$,
  array['paused'::text],
  'paused status remains canonical'
);

set local request.jwt.claim.sub = 'b9444444-4444-4444-8444-444444444444';
select results_eq(
  $$select public.claim_external_beta_access() ->> 'result'$$,
  array['unchanged'::text],
  'a cancelled membership is not reactivated'
);
select results_eq(
  $$select status from public.memberships where user_id = 'b9444444-4444-4444-8444-444444444444'$$,
  array['cancelled'::text],
  'cancelled status remains canonical'
);

set local request.jwt.claim.sub = 'b9555555-5555-4555-8555-555555555555';
select results_eq(
  $$select public.claim_external_beta_access() ->> 'result'$$,
  array['unchanged'::text],
  'a Stripe-bound membership is not overwritten'
);
set local role service_role;
select results_eq(
  $$select stripe_customer_id, status, count(*)::int
    from public.memberships
    where user_id = 'b9555555-5555-4555-8555-555555555555'
    group by stripe_customer_id, status$$,
  $$values ('cus_build9'::text, 'active'::text, 1)$$,
  'the Stripe row remains the only membership'
);
set local role authenticated;
set local request.jwt.claim.sub = 'b9555555-5555-4555-8555-555555555555';

select throws_ok(
  $$insert into public.memberships (user_id, tier, status) values ('b9111111-1111-4111-8111-111111111111', 'founding_beta', 'active')$$,
  '42501', null,
  'an authenticated caller still cannot insert membership directly'
);
select throws_ok(
  $$update private.release_flags set enabled = false where key = 'open_external_testflight_beta'$$,
  '42501', null,
  'an authenticated caller cannot change the release flag'
);

set local role service_role;
select results_eq(
  $$select count(*)::int from public.memberships where user_id = 'b9333333-3333-4333-8333-333333333333' and status = 'paused'$$,
  array[1],
  'claiming as one user cannot change another user membership'
);

select * from finish();
rollback;
