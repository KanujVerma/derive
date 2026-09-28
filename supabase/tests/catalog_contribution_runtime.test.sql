begin;
select plan(19);

select has_table('public', 'catalog_contributions', 'private proposals have a durable table');
select ok(has_function_privilege('service_role', 'public.submit_catalog_contribution(uuid,uuid,jsonb,text,text,integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.submit_catalog_contribution(uuid,uuid,jsonb,text,text,integer)', 'execute'),
  'submission is server-only');
select ok(has_function_privilege('service_role', 'public.withdraw_catalog_contribution(uuid,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.withdraw_catalog_contribution(uuid,uuid)', 'execute'),
  'withdrawal is server-only');
select is((select count(*)::int from pg_policies where schemaname = 'public'
  and tablename = 'catalog_contributions' and policyname = 'catalog_contributions_owner_read'), 1,
  'owner-only read policy exists');

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('c1500000-0000-4000-8000-000000000001', null, true, '{}'::jsonb),
  ('c1500000-0000-4000-8000-000000000002', null, true, '{}'::jsonb);

select lives_ok($$
  select public.submit_catalog_contribution(
    'c1500000-0000-4000-8000-000000000001',
    'c1500000-0000-4000-8000-000000000011',
    '{"version":1,"intent":"help_add_product","requestId":"c1500000-0000-4000-8000-000000000011","product":{"brand":"Test","name":"Lotion"}}'::jsonb,
    '["catalog-proposal-v1",["label","test","lotion"],null,null,null]',
    repeat('a', 64), 1)
$$, 'explicit proposal can be saved');
select is((select count(*)::int from public.catalog_contributions), 1, 'one row is saved');
select lives_ok($$
  select public.submit_catalog_contribution(
    'c1500000-0000-4000-8000-000000000001',
    'c1500000-0000-4000-8000-000000000011',
    '{"version":1,"intent":"help_add_product","requestId":"c1500000-0000-4000-8000-000000000011","product":{"brand":"Test","name":"Lotion"}}'::jsonb,
    '["catalog-proposal-v1",["label","test","lotion"],null,null,null]',
    repeat('a', 64), 1)
$$, 'same request replays');
select is((select count(*)::int from public.catalog_contributions), 1, 'replay does not duplicate demand');
select throws_ok($$
  select public.submit_catalog_contribution(
    'c1500000-0000-4000-8000-000000000001',
    'c1500000-0000-4000-8000-000000000011',
    '{"product":{"brand":"Other","name":"Lotion"}}'::jsonb,
    'different', repeat('b', 64), 1)
$$, 'P0001', 'CATALOG_CONTRIBUTION_REQUEST_CONFLICT', 'changed replay is rejected');

set local role authenticated;
set local request.jwt.claim.sub = 'c1500000-0000-4000-8000-000000000002';
select is((select count(*)::int from public.catalog_contributions), 0, 'another owner cannot read proposal');
select throws_ok($$delete from public.catalog_contributions$$, '42501', null,
  'customer cannot directly delete or withdraw contributions');
set local request.jwt.claim.sub = 'c1500000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.catalog_contributions), 1, 'owner can read own proposal');
set local role postgres;

select throws_ok($$
  select public.submit_catalog_contribution(
    'c1500000-0000-4000-8000-000000000002',
    'c1500000-0000-4000-8000-000000000012',
    '{"evidence":[{"evidenceId":"c1500000-0000-4000-8000-000000000099","role":"front_label"}]}'::jsonb,
    'private', repeat('b', 64), 1)
$$, 'P0001', 'CATALOG_CONTRIBUTION_EVIDENCE_UNAVAILABLE',
  'missing or foreign evidence cannot be attached');
select throws_ok($$
  select public.submit_catalog_contribution(
    'c1500000-0000-4000-8000-000000000002',
    'c1500000-0000-4000-8000-000000000013',
    jsonb_build_object('blob', repeat('x', 5000)), 'oversized', repeat('c', 64), 1)
$$, 'P0001', 'INVALID_CATALOG_CONTRIBUTION', 'database rejects oversized payload');

select lives_ok($$
  select public.withdraw_catalog_contribution('c1500000-0000-4000-8000-000000000001',
    (select id from public.catalog_contributions where user_id = 'c1500000-0000-4000-8000-000000000001'))
$$, 'owner-derived withdrawal succeeds');
select ok((select status = 'withdrawn' and payload is null and candidate_key is null
  and request_fingerprint is null and withdrawn_at is not null from public.catalog_contributions),
  'withdrawal scrubs product and evidence payload');
select is((select count(*)::int from public.catalog_contributions where status = 'submitted'), 0,
  'withdrawn proposals no longer count toward demand');
select lives_ok($$
  select public.submit_catalog_contribution(
    'c1500000-0000-4000-8000-000000000001',
    'c1500000-0000-4000-8000-000000000011',
    '{"product":{"brand":"Test","name":"Lotion"}}'::jsonb,
    'another key', repeat('b', 64), 1)
$$, 'withdrawn request IDs cannot reactivate data');
select is((select status from public.catalog_contributions), 'withdrawn',
  'replay after withdrawal remains withdrawn');

select * from finish();
rollback;
