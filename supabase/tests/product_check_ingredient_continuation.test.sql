begin;
select plan(16);
select ok((select relrowsecurity from pg_class
  where oid = 'public.product_resolution_continuations'::regclass), 'continuation RLS enabled');
select ok(not has_table_privilege('authenticated','public.product_resolution_continuations','select'),
  'caller cannot enumerate continuation links');
select ok(not has_function_privilege('authenticated',
  'public.record_product_resolution_continuation(uuid,uuid,uuid,uuid,text,text,text,uuid,uuid,uuid,jsonb,jsonb,jsonb)',
  'execute'), 'caller cannot create a child directly');
insert into auth.users(id,is_anonymous,raw_user_meta_data) values
  ('c7100000-0000-4000-8000-000000000001',true,'{}'),
  ('c7100000-0000-4000-8000-000000000002',true,'{}');
insert into public.products(id,brand,name,category,is_catalog_standard)
  values ('c7400000-0000-4000-8000-000000000001','Fixture','Continuation','cleanser',true);
insert into public.product_variants(id,product_id,variant_name,region_code)
  values ('c7500000-0000-4000-8000-000000000001',
    'c7400000-0000-4000-8000-000000000001','Exact','US');
insert into public.product_resolution_cases(id,user_id,request_id,consumer,resolution_state,
  next_action,product_id,variant_id,evidence_snapshot)
  values ('c7200000-0000-4000-8000-000000000001',
    'c7100000-0000-4000-8000-000000000001',
    'c7300000-0000-4000-8000-000000000001','scan',
    'identified_formula_unverified','photograph_ingredients',
    'c7400000-0000-4000-8000-000000000001',
    'c7500000-0000-4000-8000-000000000001','{}');
select is(public.seal_product_truth_snapshot('c7100000-0000-4000-8000-000000000001',
  'c7200000-0000-4000-8000-000000000001')->>'state',
  'identified_formula_unverified','root truth sealed before follow-up');
select is((public.record_product_resolution_continuation(
  'c7100000-0000-4000-8000-000000000001',
  'c7200000-0000-4000-8000-000000000001',
  (select id from public.product_truth_snapshots where case_id='c7200000-0000-4000-8000-000000000001'),
  'c7300000-0000-4000-8000-000000000002',repeat('a',64),
  'identified_formula_unverified','photograph_ingredients',
  'c7400000-0000-4000-8000-000000000001',
  'c7500000-0000-4000-8000-000000000001',null,'[]','[{"evidence_type":"ingredients","source_type":"member_input","extracted_text":"Water, Glycerin"}]',
  '[]')).consumer,'scan','child remains one Scan workflow');
select is((select count(*)::int from public.product_resolution_continuations),1,'one link reserved');
select is((select count(*)::int from public.product_truth_snapshots
  where case_id='c7200000-0000-4000-8000-000000000001'),1,'root snapshot unchanged');
select is((public.record_product_resolution_continuation(
  'c7100000-0000-4000-8000-000000000001',
  'c7200000-0000-4000-8000-000000000001',
  (select id from public.product_truth_snapshots where case_id='c7200000-0000-4000-8000-000000000001'),
  'c7300000-0000-4000-8000-000000000002',repeat('a',64),
  'identified_formula_unverified','photograph_ingredients',
  'c7400000-0000-4000-8000-000000000001',
  'c7500000-0000-4000-8000-000000000001',null,'[]','[]','[]')).id,
  (select child_case_id from public.product_resolution_continuations),'retry reuses child');
select is((select count(*)::int from public.product_resolution_cases
  where user_id='c7100000-0000-4000-8000-000000000001'),2,'retry creates no third case');
select throws_ok($$select public.record_product_resolution_continuation(
  'c7100000-0000-4000-8000-000000000001',
  'c7200000-0000-4000-8000-000000000001',
  (select id from public.product_truth_snapshots where case_id='c7200000-0000-4000-8000-000000000001'),
  'c7300000-0000-4000-8000-000000000003',repeat('b',64),
  'identified_formula_unverified','photograph_ingredients',
  'c7400000-0000-4000-8000-000000000001',
  'c7500000-0000-4000-8000-000000000001',null,'[]','[]','[]')$$,
  '23505','CONTINUATION_CONFLICT','second child refused');
select throws_ok($$select public.record_product_resolution_continuation(
  'c7100000-0000-4000-8000-000000000002',
  'c7200000-0000-4000-8000-000000000001',
  (select id from public.product_truth_snapshots where case_id='c7200000-0000-4000-8000-000000000001'),
  'c7300000-0000-4000-8000-000000000004',repeat('c',64),
  'identified_formula_unverified','photograph_ingredients',
  'c7400000-0000-4000-8000-000000000001',
  'c7500000-0000-4000-8000-000000000001',null,'[]','[]','[]')$$,
  'P0002','CHECK_NOT_FOUND','cross-owner root refused');
insert into public.free_check_history(user_id,request_id,resolution_case_id,product_name,resolution_state)
  values ('c7100000-0000-4000-8000-000000000001',
    'c7300000-0000-4000-8000-000000000005',
    'c7200000-0000-4000-8000-000000000001','Continuation','identified_formula_unverified');
select is((select attempt_case_id from public.free_check_history
  where request_id='c7300000-0000-4000-8000-000000000005'),
  'c7200000-0000-4000-8000-000000000001'::uuid,'root save binds attempt');
select throws_ok($$insert into public.free_check_history(user_id,request_id,resolution_case_id,product_name,resolution_state)
  values ('c7100000-0000-4000-8000-000000000001',
    'c7300000-0000-4000-8000-000000000006',
    (select child_case_id from public.product_resolution_continuations),'Continuation','identified_formula_unverified')$$,
  '23505',null,'child cannot be saved as a second Check');
select is((select count(*)::int from public.free_check_history),1,'one opt-in save per attempt');
select ok((select snapshot::text not like '%Water, Glycerin%' from public.product_truth_snapshots
  where case_id='c7200000-0000-4000-8000-000000000001'),
  'root snapshot never receives private ingredient text');
select ok((select evidence_fingerprint = repeat('a',64)
  from public.product_resolution_continuations),'link stores digest not raw ingredients');
select * from finish();
rollback;
