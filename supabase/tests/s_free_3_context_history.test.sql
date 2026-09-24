begin;
select plan(15);

select ok(to_regclass('public.free_saved_products') is not null, 'free saved products exist separately from managed Shelf');
select ok(to_regclass('public.free_check_history') is not null, 'free Check history exists');
select ok(to_regclass('public.free_product_experiences') is not null, 'free experience history exists');
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.free_saved_products'::regclass, 'public.free_check_history'::regclass,
  'public.free_product_experiences'::regclass)), 'RLS is on for all free context');
select ok(not has_table_privilege('anon', 'public.free_saved_products', 'select')
  and not has_table_privilege('authenticated', 'public.free_saved_products', 'select')
  and not has_table_privilege('authenticated', 'public.free_check_history', 'select')
  and not has_table_privilege('authenticated', 'public.free_product_experiences', 'select'),
  'raw free context is Edge-only');

insert into auth.users (id, is_anonymous, raw_user_meta_data) values
  ('f3100000-0000-4000-8000-000000000001', true, '{}'::jsonb),
  ('f3100000-0000-4000-8000-000000000002', true, '{}'::jsonb);

insert into public.free_saved_products (user_id, request_id, name, source, state) values
  ('f3100000-0000-4000-8000-000000000001', 'f3110000-0000-4000-8000-000000000001', 'My wash', 'user_reported', 'using');
insert into public.free_check_history (user_id, request_id, product_name, resolution_state) values
  ('f3100000-0000-4000-8000-000000000001', 'f3120000-0000-4000-8000-000000000001', 'Product not identified', 'insufficient_evidence');
insert into public.free_product_experiences (user_id, request_id, product_name, source, kind, note) values
  ('f3100000-0000-4000-8000-000000000001', 'f3130000-0000-4000-8000-000000000001', 'My wash', 'user_reported', 'reacted', 'Stinging');
insert into public.product_resolution_cases (
  id, user_id, request_id, consumer, resolution_state, next_action, review_status
) values (
  'f3140000-0000-4000-8000-000000000001',
  'f3100000-0000-4000-8000-000000000002',
  'f3150000-0000-4000-8000-000000000001',
  'scan', 'insufficient_evidence', 'manual_review', 'not_needed'
);
select throws_ok($$insert into public.free_check_history (
  user_id, request_id, resolution_case_id, product_name, resolution_state
) values (
  'f3100000-0000-4000-8000-000000000001',
  'f3120000-0000-4000-8000-000000000002',
  'f3140000-0000-4000-8000-000000000001',
  'Product not identified', 'insufficient_evidence'
)$$, '23514', 'FREE_CHECK_CASE_OWNER_MISMATCH', 'a Check cannot reference another guest case');

select is((select count(*)::int from public.memberships where user_id = 'f3100000-0000-4000-8000-000000000001'), 0,
  'free history does not create managed membership');
select is((select count(*)::int from public.user_products where user_id = 'f3100000-0000-4000-8000-000000000001'), 0,
  'free saved product does not create managed Shelf row');
select throws_ok($$insert into public.free_saved_products (user_id, request_id, name, source, state) values
  ('f3100000-0000-4000-8000-000000000002', 'f3110000-0000-4000-8000-000000000002', 'My wash', 'catalog', 'using')$$,
  '23514', null, 'catalog source requires canonical product ID');
select throws_ok($$insert into public.free_product_experiences (user_id, request_id, product_name, source, kind) values
  ('f3100000-0000-4000-8000-000000000002', 'f3130000-0000-4000-8000-000000000002', 'My wash', 'user_reported', 'allergy')$$,
  '23514', null, 'an experience cannot claim a diagnosed allergy');
select throws_ok($$insert into public.free_check_history (user_id, request_id, product_name, resolution_state) values
  ('f3100000-0000-4000-8000-000000000001', 'f3120000-0000-4000-8000-000000000001', 'Duplicate', 'catalog_product')$$,
  '23505', null, 'repeated Check request ID cannot create another history row');

set local role authenticated;
set local request.jwt.claim.sub = 'f3100000-0000-4000-8000-000000000001';
select throws_ok($$select * from public.free_saved_products$$, '42501', null, 'guest cannot read raw saved products');
select throws_ok($$select * from public.free_check_history$$, '42501', null, 'guest cannot read raw Check history');
select throws_ok($$select * from public.free_product_experiences$$, '42501', null, 'guest cannot read raw experience notes');
select throws_ok($$insert into public.free_check_history (user_id, request_id, product_name, resolution_state) values
  ('f3100000-0000-4000-8000-000000000002', 'f3120000-0000-4000-8000-000000000002', 'Forged', 'catalog_product')$$,
  '42501', null, 'guest cannot write another owner Check');

select * from finish();
rollback;
