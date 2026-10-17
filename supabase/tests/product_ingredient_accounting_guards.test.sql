begin;
select plan(12);
-- acldefault enumerates privileges supported by this server (including PG17
-- MAINTAIN); has_table_privilege includes inherited/PUBLIC grants.
select is((select string_agg(acl.privilege_type,',' order by acl.privilege_type)
 from pg_class c cross join lateral aclexplode(acldefault('r',c.relowner)) acl
 where c.oid='public.product_ingredient_scan_sessions'::regclass
 and has_table_privilege('service_role',c.oid,acl.privilege_type)),
 'INSERT,SELECT,UPDATE', 'product_ingredient_scan_sessions has only required effective service privileges');
-- acldefault enumerates privileges supported by this server (including PG17
-- MAINTAIN); has_table_privilege includes inherited/PUBLIC grants.
select is((select string_agg(acl.privilege_type,',' order by acl.privilege_type)
 from pg_class c cross join lateral aclexplode(acldefault('r',c.relowner)) acl
 where c.oid='public.product_ingredient_scan_aliases'::regclass
 and has_table_privilege('service_role',c.oid,acl.privilege_type)),
 'INSERT,SELECT', 'product_ingredient_scan_aliases has only required effective service privileges');
-- acldefault enumerates privileges supported by this server (including PG17
-- MAINTAIN); has_table_privilege includes inherited/PUBLIC grants.
select is((select string_agg(acl.privilege_type,',' order by acl.privilege_type)
 from pg_class c cross join lateral aclexplode(acldefault('r',c.relowner)) acl
 where c.oid='public.product_ingredient_panel_attempts'::regclass
 and has_table_privilege('service_role',c.oid,acl.privilege_type)),
 'INSERT,SELECT,UPDATE', 'product_ingredient_panel_attempts has only required effective service privileges');
select ok(not (select prosecdef from pg_proc where oid='public.bind_product_ingredient_scan(uuid,uuid,uuid,uuid)'::regprocedure), 'forward binder remains invoker');
select ok(not has_function_privilege('authenticated','public.bind_product_ingredient_scan(uuid,uuid,uuid,uuid)','execute'), 'client cannot call forward binder');
select ok(has_function_privilege('service_role','public.bind_product_ingredient_scan(uuid,uuid,uuid,uuid)','execute'), 'existing service execute grant is retained');
insert into auth.users(id,is_anonymous,raw_user_meta_data) values ('ac300000-0000-4000-8000-000000000001',true,'{}');
set local role service_role;
select is(public.reserve_product_ingredient_panel(
 'ac300000-0000-4000-8000-000000000001','ac300000-0000-4000-8000-000000000002',null,null,
 'ac300000-0000-4000-8000-000000000003',repeat('a',64),repeat('b',64))->>'decision',
 'reserved','service can reserve with restricted table grants');
select is(public.settle_product_ingredient_panel(
 'ac300000-0000-4000-8000-000000000001','ac300000-0000-4000-8000-000000000002',null,null,
 (select lease_id from public.product_ingredient_panel_attempts where user_id='ac300000-0000-4000-8000-000000000001'),
 'unavailable')->>'decision','settled','service can settle with restricted table grants');
select throws_ok($$update public.product_ingredient_scan_aliases set scope_id=scope_id
 where user_id='ac300000-0000-4000-8000-000000000001'$$,
 '42501',null,'service cannot rewrite an existing alias');
select throws_ok($$delete from public.product_ingredient_scan_aliases
 where user_id='ac300000-0000-4000-8000-000000000001'$$,
 '42501',null,'service cannot delete and recreate an alias');
delete from public.profiles where id='ac300000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.product_ingredient_scan_aliases where user_id='ac300000-0000-4000-8000-000000000001'),0,'service profile erasure still cascades aliases');
select is((select count(*)::integer from public.product_ingredient_panel_attempts where user_id='ac300000-0000-4000-8000-000000000001'),0,'service profile erasure still cascades attempts');
reset role;
select * from finish();
rollback;
