begin;

select plan(36);

select has_table('public', 'founder_accounts', 'founder allowlist exists');
select has_table('public', 'founder_member_notes', 'private founder notes exist');
select has_table('public', 'product_formula_reviews', 'formula review history exists');
select has_table('public', 'founder_operation_log', 'founder operation audit log exists');

select results_eq(
  $$
    select relname::text collate "default"
    from pg_class
    where oid in (
      'public.founder_accounts'::regclass,
      'public.founder_member_notes'::regclass,
      'public.product_formula_reviews'::regclass,
      'public.founder_operation_log'::regclass
    ) and relrowsecurity
    order by relname
  $$,
  array['founder_accounts', 'founder_member_notes', 'founder_operation_log', 'product_formula_reviews'],
  'all founder-only S4 tables enforce RLS'
);

select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename in (
    'founder_accounts', 'founder_member_notes', 'product_formula_reviews', 'founder_operation_log'
  )),
  0,
  'no client RLS policies expose founder-only records'
);

select ok(
  not has_table_privilege('anon', 'public.founder_accounts', 'select')
    and not has_table_privilege('authenticated', 'public.founder_accounts', 'select')
    and not has_table_privilege('authenticated', 'public.founder_member_notes', 'select')
    and not has_table_privilege('authenticated', 'public.product_formula_reviews', 'select')
    and not has_table_privilege('authenticated', 'public.founder_operation_log', 'select'),
  'anonymous and member roles cannot read founder operations data'
);

select ok(
  has_table_privilege('service_role', 'public.founder_accounts', 'select')
    and has_table_privilege('service_role', 'public.founder_member_notes', 'insert')
    and has_table_privilege('service_role', 'public.product_formula_reviews', 'insert')
    and has_table_privilege('service_role', 'public.founder_operation_log', 'insert'),
  'service role can operate S4 records'
);

select ok(
  has_function_privilege('service_role', 'public.founder_publish_routine(uuid,uuid,text,jsonb,text,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.founder_publish_routine(uuid,uuid,text,jsonb,text,uuid)', 'execute')
    and not has_function_privilege('anon', 'public.founder_publish_routine(uuid,uuid,text,jsonb,text,uuid)', 'execute'),
  'routine publication is service-only'
);

select ok(
  has_function_privilege('service_role', 'public.founder_transition_refill(uuid,uuid,text,text,text,text,timestamptz,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.founder_transition_refill(uuid,uuid,text,text,text,text,timestamptz,uuid)', 'execute'),
  'refill transitions are service-only'
);

select ok(
  has_function_privilege('service_role', 'public.founder_review_formula(uuid,uuid,text,text[],text[],text,text,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.founder_review_formula(uuid,uuid,text,text[],text[],text,text,uuid)', 'execute'),
  'formula verification is service-only'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('f4000000-0000-4000-8000-000000000001', 's4-founder@example.test', '{"full_name":"S4 Founder"}'::jsonb),
  ('f4000000-0000-4000-8000-000000000002', 's4-member@example.test', '{"full_name":"S4 Member"}'::jsonb),
  ('f4000000-0000-4000-8000-000000000003', 's4-disabled@example.test', '{"full_name":"S4 Disabled"}'::jsonb);

insert into public.founder_accounts (user_id, role, status)
values
  ('f4000000-0000-4000-8000-000000000001', 'founder', 'active'),
  ('f4000000-0000-4000-8000-000000000003', 'operator', 'disabled');

insert into public.skin_profiles (
  user_id, primary_goal, routine_complexity, cost_preference, midday_feel,
  sensitivities_status, pregnancy_status, onboarding_completed
) values (
  'f4000000-0000-4000-8000-000000000002', 'dryness', 'simple', 'balanced', 'dry_tight',
  'none_known', 'no', true
);

insert into public.products (
  id, brand, name, category, key_actives, full_ingredients, is_catalog_standard
) values
  ('f4100000-0000-4000-8000-000000000001', 'S4', 'Gentle Cleanser', 'cleanser', array['Glycerin'], array['Water', 'Glycerin'], true),
  ('f4100000-0000-4000-8000-000000000002', 'S4', 'Provisional Lotion', 'moisturizer', '{}', '{}', false);

set local role service_role;

select throws_ok(
  $$ select private.assert_active_founder('f4000000-0000-4000-8000-000000000002') $$,
  'P0001',
  'FOUNDER_ACCESS_REQUIRED',
  'ordinary members cannot pass the defense-in-depth founder assertion'
);

select throws_ok(
  $$ select private.assert_active_founder('f4000000-0000-4000-8000-000000000003') $$,
  'P0001',
  'FOUNDER_ACCESS_REQUIRED',
  'disabled founder accounts fail closed'
);

select lives_ok(
  $$ select private.assert_active_founder('f4000000-0000-4000-8000-000000000001') $$,
  'active founder passes the defense-in-depth assertion'
);

select public.create_routine_version(
  'f4000000-0000-4000-8000-000000000002',
  'Awaiting founder review',
  '[{"order_index":1,"timing":"am","product_id":"f4100000-0000-4000-8000-000000000001","product_name":"Gentle Cleanser","brand":"S4","category":"cleanser","amount":"one pump","area":"face","days":[],"purpose":"cleanse","why_chosen":"gentle baseline"}]'::jsonb,
  'awaiting_review'
);

insert into public.founder_review_tasks (id, user_id, task_type, status, priority, notes)
values (
  'f4200000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000002',
  'initial_routine', 'pending', 'normal', 'Review the first plan.'
);

select lives_ok(
  $$
    select public.founder_publish_routine(
      'f4000000-0000-4000-8000-000000000001',
      (select id from public.routines where user_id = 'f4000000-0000-4000-8000-000000000002' and version = 1),
      'Founder-reviewed published routine',
      '[{"order_index":1,"timing":"am","product_id":"f4100000-0000-4000-8000-000000000001","product_name":"Gentle Cleanser","brand":"S4","category":"cleanser","amount":"one pump","area":"face","days":[],"purpose":"cleanse","why_chosen":"verified gentle baseline"}]'::jsonb,
      'Reviewed against member context.',
      'f4300000-0000-4000-8000-000000000001'
    )
  $$,
  'founder can publish a reviewed routine atomically'
);

select results_eq(
  $$ select version || ':' || status from public.routines where user_id = 'f4000000-0000-4000-8000-000000000002' order by version $$,
  array['1:approved', '2:published'],
  'publication preserves the proposal and appends a published version'
);

select is(
  (select count(*)::integer from public.routine_items where routine_id = (
    select id from public.routines where user_id = 'f4000000-0000-4000-8000-000000000002' and version = 2
  )),
  1,
  'published version contains its immutable reviewed step snapshot'
);

select is(
  (select status from public.founder_review_tasks where id = 'f4200000-0000-4000-8000-000000000001'),
  'completed',
  'publication completes the routine review task'
);

select is(
  (select count(*)::integer from public.founder_operation_log where operation = 'routine_published'),
  1,
  'publication creates one audit event'
);

select lives_ok(
  $$
    select public.founder_publish_routine(
      'f4000000-0000-4000-8000-000000000001',
      (select id from public.routines where user_id = 'f4000000-0000-4000-8000-000000000002' and version = 1),
      'Founder-reviewed published routine',
      '[{"order_index":1,"timing":"am","product_id":"f4100000-0000-4000-8000-000000000001","product_name":"Gentle Cleanser","brand":"S4","category":"cleanser","amount":"one pump","area":"face","days":[],"purpose":"cleanse","why_chosen":"verified gentle baseline"}]'::jsonb,
      'Reviewed against member context.',
      'f4300000-0000-4000-8000-000000000001'
    )
  $$,
  'replaying the same publication request is safe'
);

select is(
  (select count(*)::integer from public.routines where user_id = 'f4000000-0000-4000-8000-000000000002'),
  2,
  'publication retry does not create another routine version'
);

insert into public.refill_requests (
  id, user_id, product_id, product_name, brand, status
) values (
  'f4400000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000002',
  'f4100000-0000-4000-8000-000000000001',
  'Gentle Cleanser', 'S4', 'requested'
);

select throws_ok(
  $$
    select public.founder_transition_refill(
      'f4000000-0000-4000-8000-000000000001', 'f4400000-0000-4000-8000-000000000001',
      'shipped', 'UPS', 'TRACK', 'https://example.test/track', null,
      'f4300000-0000-4000-8000-000000000002'
    )
  $$,
  'P0001', 'INVALID_REFILL_TRANSITION',
  'refill states cannot skip ordered'
);

select lives_ok(
  $$ select public.founder_transition_refill(
    'f4000000-0000-4000-8000-000000000001', 'f4400000-0000-4000-8000-000000000001',
    'ordered', null, null, null, null, 'f4300000-0000-4000-8000-000000000003'
  ) $$,
  'requested refill can move to ordered'
);

select throws_ok(
  $$ select public.founder_transition_refill(
    'f4000000-0000-4000-8000-000000000001', 'f4400000-0000-4000-8000-000000000001',
    'shipped', null, null, null, null, 'f4300000-0000-4000-8000-000000000004'
  ) $$,
  'P0001', 'SHIPMENT_TRACKING_REQUIRED',
  'shipping requires carrier and tracking number'
);

select lives_ok(
  $$ select public.founder_transition_refill(
    'f4000000-0000-4000-8000-000000000001', 'f4400000-0000-4000-8000-000000000001',
    'shipped', 'UPS', 'TRACK-123', 'https://example.test/track/TRACK-123', now() + interval '3 days',
    'f4300000-0000-4000-8000-000000000005'
  ) $$,
  'ordered refill can move to shipped with tracking'
);

select ok(
  (select status = 'shipped' and shipped_at is not null and carrier = 'UPS' and tracking_number = 'TRACK-123'
   from public.refill_requests where id = 'f4400000-0000-4000-8000-000000000001'),
  'shipment metadata persists atomically with status'
);

select lives_ok(
  $$ select public.founder_transition_refill(
    'f4000000-0000-4000-8000-000000000001', 'f4400000-0000-4000-8000-000000000001',
    'delivered', null, null, null, null, 'f4300000-0000-4000-8000-000000000006'
  ) $$,
  'shipped refill can move to delivered'
);

select ok(
  (select status = 'delivered' and delivered_at is not null
   from public.refill_requests where id = 'f4400000-0000-4000-8000-000000000001'),
  'delivery transition records completion timestamp'
);

select lives_ok(
  $$ select public.founder_review_formula(
    'f4000000-0000-4000-8000-000000000001', 'f4100000-0000-4000-8000-000000000002',
    'verified', array['Water', 'Glycerin', 'Ceramide NP'], array['Ceramide NP'],
    'https://manufacturer.example/formula', 'Checked against current label.',
    'f4300000-0000-4000-8000-000000000007'
  ) $$,
  'founder can verify a provisional formula with provenance'
);

select ok(
  (select is_catalog_standard and full_ingredients = array['Water', 'Glycerin', 'Ceramide NP']
   from public.products where id = 'f4100000-0000-4000-8000-000000000002'),
  'verified formula promotes trusted catalog truth'
);

select is(
  (select count(*)::integer from public.product_formula_reviews where product_id = 'f4100000-0000-4000-8000-000000000002'),
  1,
  'formula verification preserves immutable review evidence'
);

select lives_ok(
  $$ select public.founder_add_member_note(
    'f4000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000002',
    'member_feedback', 'Member prefers the simplest possible morning routine.',
    'f4300000-0000-4000-8000-000000000008'
  ) $$,
  'founder can append a private member note'
);

select is(
  (select body from public.founder_member_notes where user_id = 'f4000000-0000-4000-8000-000000000002'),
  'Member prefers the simplest possible morning routine.',
  'private note content persists without customer exposure'
);

insert into public.founder_review_tasks (id, user_id, task_type, status, priority, notes)
values (
  'f4200000-0000-4000-8000-000000000002',
  'f4000000-0000-4000-8000-000000000002',
  'safety_flag', 'pending', 'urgent', 'Privacy-minimized safety escalation.'
);

select lives_ok(
  $$ select public.founder_resolve_task(
    'f4000000-0000-4000-8000-000000000001', 'f4200000-0000-4000-8000-000000000002',
    'completed', 'f4300000-0000-4000-8000-000000000009'
  ) $$,
  'founder can complete a safety task'
);

select is(
  (select status from public.founder_review_tasks where id = 'f4200000-0000-4000-8000-000000000002'),
  'completed',
  'safety task resolution persists'
);

select is(
  (select count(*)::integer from public.founder_operation_log),
  7,
  'every successful privileged mutation has one audit event'
);

select * from finish();
rollback;
