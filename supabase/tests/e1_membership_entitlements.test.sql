begin;
select plan(26);

select ok(
  has_column_privilege('authenticated', 'public.memberships', 'last_stripe_event_created_at', 'select'),
  'an owner can use server-written event time to identify the current membership'
);
select ok(
  not has_column_privilege('authenticated', 'public.memberships', 'stripe_customer_id', 'select'),
  'Stripe customer identity remains server-only'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('66000000-0000-4000-8000-000000000001', 'e1-none@example.test', '{}'::jsonb),
  ('66000000-0000-4000-8000-000000000002', 'e1-active@example.test', '{}'::jsonb),
  ('66000000-0000-4000-8000-000000000003', 'e1-paused@example.test', '{}'::jsonb);

set local role service_role;
insert into public.memberships (user_id, tier, status) values
  ('66000000-0000-4000-8000-000000000002', 'founding_beta', 'active'),
  ('66000000-0000-4000-8000-000000000003', 'founding_beta', 'paused');

set local role authenticated;
set local request.jwt.claim.sub = '66000000-0000-4000-8000-000000000001';
select throws_ok(
  $$insert into public.check_ins (user_id, skin_state, irritation) values ('66000000-0000-4000-8000-000000000001', 'same', 'none')$$,
  '42501', null, 'no membership cannot write a managed check-in'
);
select throws_ok(
  $$insert into public.skin_profiles (user_id, primary_goal, routine_complexity, cost_preference, midday_feel) values ('66000000-0000-4000-8000-000000000001', 'breakouts', 'simple', 'balanced', 'balanced')$$,
  '42501', null, 'no membership cannot start sensitive onboarding profile writes'
);
select throws_ok(
  $$insert into public.user_products (user_id, action, detected_brand, detected_name) values ('66000000-0000-4000-8000-000000000001', 'KEEP', 'Brand', 'Cleanser')$$,
  '42501', null, 'no membership cannot write a managed shelf decision'
);
select throws_ok(
  $$insert into public.refill_requests (user_id, product_name, brand) values ('66000000-0000-4000-8000-000000000001', 'Cleanser', 'Brand')$$,
  '42501', null, 'no membership cannot request a managed refill'
);
select throws_ok(
  $$insert into public.user_photos (user_id, photo_type, storage_path) values ('66000000-0000-4000-8000-000000000001', 'front', '66000000-0000-4000-8000-000000000001/front/photo.jpg')$$,
  '42501', null, 'no membership cannot write baseline photo metadata'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('customer-skin-photos', '66000000-0000-4000-8000-000000000001/front/photo.jpg', '66000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'no membership cannot upload a private baseline photo'
);

set local request.jwt.claim.sub = '66000000-0000-4000-8000-000000000003';
select results_eq(
  $$select status from public.memberships where user_id = '66000000-0000-4000-8000-000000000003'$$,
  array['paused'::text],
  'paused member retains owner-readable billing status'
);

set local request.jwt.claim.sub = '66000000-0000-4000-8000-000000000002';
select lives_ok(
  $$insert into public.skin_profiles (user_id, primary_goal, routine_complexity, cost_preference, midday_feel) values ('66000000-0000-4000-8000-000000000002', 'breakouts', 'simple', 'balanced', 'balanced')$$,
  'active membership permits onboarding profile writes'
);
select lives_ok(
  $$insert into public.user_products (user_id, action, detected_brand, detected_name) values ('66000000-0000-4000-8000-000000000002', 'KEEP', 'Brand', 'Cleanser')$$,
  'active membership permits own shelf writes'
);
select lives_ok(
  $$insert into public.check_ins (user_id, skin_state, irritation) values ('66000000-0000-4000-8000-000000000002', 'same', 'none')$$,
  'active membership permits own check-in'
);
select lives_ok(
  $$insert into public.refill_requests (user_id, product_name, brand) values ('66000000-0000-4000-8000-000000000002', 'Cleanser', 'Brand')$$,
  'active membership permits own refill request'
);
select lives_ok(
  $$insert into public.user_photos (user_id, photo_type, storage_path) values ('66000000-0000-4000-8000-000000000002', 'front', '66000000-0000-4000-8000-000000000002/front/photo.jpg')$$,
  'active membership permits own photo metadata'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('customer-skin-photos', '66000000-0000-4000-8000-000000000002/front/photo.jpg', '66000000-0000-4000-8000-000000000002')$$,
  'active membership permits own private photo upload'
);

set local role service_role;
update public.memberships set status = 'paused', last_stripe_event_created_at = '2026-09-19T22:30:00Z'
where user_id = '66000000-0000-4000-8000-000000000002';
set local role authenticated;
select results_eq(
  $$update public.skin_profiles set midday_feel = 'dry' where user_id = '66000000-0000-4000-8000-000000000002' returning midday_feel$$,
  array[]::text[], 'downgrade blocks profile updates without removing historical profile reads'
);
select results_eq(
  $$update public.user_products set action = 'PAUSE' where user_id = '66000000-0000-4000-8000-000000000002' returning action$$,
  array[]::text[], 'downgrade blocks shelf action updates'
);
select results_eq(
  $$delete from public.user_products where user_id = '66000000-0000-4000-8000-000000000002' returning action$$,
  array[]::text[], 'downgrade blocks shelf deletion'
);
select throws_ok(
  $$insert into public.check_ins (user_id, skin_state, irritation) values ('66000000-0000-4000-8000-000000000002', 'same', 'none')$$,
  '42501', null, 'downgrade immediately blocks another check-in'
);
select throws_ok(
  $$insert into public.refill_requests (user_id, product_name, brand) values ('66000000-0000-4000-8000-000000000002', 'Moisturizer', 'Brand')$$,
  '42501', null, 'downgrade immediately blocks another refill'
);
select throws_ok(
  $$insert into public.user_photos (user_id, photo_type, storage_path) values ('66000000-0000-4000-8000-000000000002', 'left', '66000000-0000-4000-8000-000000000002/left/photo.jpg')$$,
  '42501', null, 'downgrade blocks new photo metadata'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('customer-skin-photos', '66000000-0000-4000-8000-000000000002/left/photo.jpg', '66000000-0000-4000-8000-000000000002')$$,
  '42501', null, 'downgrade blocks new private photo upload'
);

set local role service_role;
insert into public.memberships (user_id, tier, status, created_at, last_stripe_event_created_at)
values ('66000000-0000-4000-8000-000000000002', 'founding_beta', 'active', '2026-09-01T00:00:00Z', '2026-09-18T00:00:00Z');
set local role authenticated;
select throws_ok(
  $$insert into public.check_ins (user_id, skin_state, irritation) values ('66000000-0000-4000-8000-000000000002', 'same', 'none')$$,
  '42501', null, 'an older active row cannot override the newer paused billing event'
);
select is(
  (select count(*)::integer from public.check_ins where user_id = '66000000-0000-4000-8000-000000000002'),
  1, 'downgraded member can still read historical check-ins'
);
select is(
  (select count(*)::integer from public.refill_requests where user_id = '66000000-0000-4000-8000-000000000002'),
  1, 'downgraded member can still read historical refills'
);
select is(
  (select count(*)::integer from public.user_products where user_id = '66000000-0000-4000-8000-000000000002'),
  1, 'downgraded member can still read their shelf history'
);

select * from finish();
rollback;
