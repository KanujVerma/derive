begin;
select plan(20);
select ok((select relrowsecurity from pg_class where oid='public.product_ingredient_scan_sessions'::regclass), 'sessions have RLS');
select ok((select relrowsecurity from pg_class where oid='public.product_ingredient_panel_attempts'::regclass), 'attempts have RLS');
select ok((select relrowsecurity from pg_class where oid='public.product_ingredient_scan_aliases'::regclass), 'aliases have RLS');
select ok(not has_table_privilege('authenticated','public.product_ingredient_scan_aliases','select,insert,update,delete'), 'authenticated cannot change aliases');
select ok(not has_table_privilege('anon','public.product_ingredient_panel_attempts','select,insert,update,delete'), 'anon cannot access journal');
select ok(not has_table_privilege('authenticated','public.product_ingredient_panel_attempts','select,insert,update,delete'), 'authenticated cannot access journal');
select ok(not has_table_privilege('authenticated','public.product_ingredient_scan_sessions','select,insert,update,delete'), 'authenticated cannot rebind a scope');
select ok(not has_function_privilege('authenticated','public.reserve_product_ingredient_panel(uuid,uuid,uuid,uuid,uuid,text,text)','execute'), 'only service can reserve');
select ok(not has_function_privilege('authenticated','public.settle_product_ingredient_panel(uuid,uuid,uuid,uuid,uuid,text)','execute'), 'only service can settle');
select ok(not has_function_privilege('authenticated','public.bind_product_ingredient_scan(uuid,uuid,uuid,uuid)','execute'), 'only service can bind continuity');
select ok(not (select prosecdef from pg_proc where oid='public.bind_product_ingredient_scan(uuid,uuid,uuid,uuid)'::regprocedure), 'binding is security invoker');
insert into auth.users(id,is_anonymous,raw_user_meta_data) values ('ac200000-0000-4000-8000-000000000001',true,'{}');
create temporary table attempt_receipts (name text primary key, value jsonb);
insert into attempt_receipts values ('initial',public.reserve_product_ingredient_panel(
  'ac200000-0000-4000-8000-000000000001','ac200000-0000-4000-8000-000000000002',null,null,
  'ac200000-0000-4000-8000-000000000003',repeat('a',64),repeat('b',64)));
select is((select value->>'decision' from attempt_receipts where name='initial'),'reserved','first submission reserves');
select is(public.reserve_product_ingredient_panel(
  'ac200000-0000-4000-8000-000000000001','ac200000-0000-4000-8000-000000000002',null,null,
  'ac200000-0000-4000-8000-000000000003',repeat('a',64),repeat('b',64))->>'decision','busy','pending retry does not redispatch');
select is(public.settle_product_ingredient_panel(
  'ac200000-0000-4000-8000-000000000001','ac200000-0000-4000-8000-000000000002',null,null,
  (select (value->>'leaseId')::uuid from attempt_receipts where name='initial'),'unreadable')->>'attemptsUsed','1','failed initial remains charged');
select is(public.reserve_product_ingredient_panel(
  'ac200000-0000-4000-8000-000000000001','ac200000-0000-4000-8000-000000000002',null,null,
  'ac200000-0000-4000-8000-000000000004',repeat('c',64),repeat('b',64))->>'attemptsUsed','1','same object with another request is uncharged');
insert into attempt_receipts values ('retake',public.reserve_product_ingredient_panel(
  'ac200000-0000-4000-8000-000000000001','ac200000-0000-4000-8000-000000000002',null,null,
  'ac200000-0000-4000-8000-000000000005',repeat('d',64),repeat('e',64)));
select is((select value->>'attemptsUsed' from attempt_receipts where name='retake'),'2','guided retake uses second slot');
select is(public.settle_product_ingredient_panel(
  'ac200000-0000-4000-8000-000000000001','ac200000-0000-4000-8000-000000000002',null,null,
  (select (value->>'leaseId')::uuid from attempt_receipts where name='retake'),'unavailable')->>'attemptsUsed','2','unavailable retake remains charged');
select is(public.reserve_product_ingredient_panel(
  'ac200000-0000-4000-8000-000000000001','ac200000-0000-4000-8000-000000000002',null,null,
  'ac200000-0000-4000-8000-000000000006',repeat('f',64),repeat('0',64))->>'decision','exhausted','third distinct submission is refused');
select is((select count(*)::integer from public.product_ingredient_panel_attempts where user_id='ac200000-0000-4000-8000-000000000001'),2,'journal has only two charges');
delete from auth.users where id='ac200000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.product_ingredient_panel_attempts where user_id='ac200000-0000-4000-8000-000000000001'),0,'owner erasure cascades journal');
select * from finish();
rollback;
