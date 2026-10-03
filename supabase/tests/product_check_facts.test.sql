begin;
select plan(15);
select ok((select relrowsecurity from pg_class where oid='public.product_check_fact_assessments'::regclass),'facts RLS enabled');
select ok(not has_table_privilege('anon','public.product_check_fact_assessments','select'),'anon cannot read facts');
select ok(not has_table_privilege('authenticated','public.product_check_fact_assessments','insert'),'customers cannot forge facts');
select ok(not has_function_privilege('authenticated','public.persist_product_check_facts(uuid,uuid,uuid,jsonb)','execute'),'customers cannot invoke persistence');
insert into auth.users(id,is_anonymous,raw_user_meta_data) values
 ('b7100000-0000-4000-8000-000000000001',true,'{}'),('b7100000-0000-4000-8000-000000000002',true,'{}');
insert into public.product_resolution_cases(id,user_id,request_id,consumer,resolution_state,next_action)
 values ('b7200000-0000-4000-8000-000000000001','b7100000-0000-4000-8000-000000000001',
 'b7300000-0000-4000-8000-000000000001','scan','insufficient_evidence','manual_review');
select public.seal_product_truth_snapshot('b7100000-0000-4000-8000-000000000001','b7200000-0000-4000-8000-000000000001');
create temp table fact_fixture as select id as snapshot_id,
 jsonb_build_object('schemaVersion','product-check-facts/v1','caseId',case_id,'snapshotId',id,
 'caseRevision',case_revision,'createdAt',now(),'category','unknown','facts','[]'::jsonb,
 'missing','["identity","ingredient_list","readable_label"]'::jsonb,'nextEvidence','ingredients') as packet
 from public.product_truth_snapshots where case_id='b7200000-0000-4000-8000-000000000001';
select lives_ok($$select public.persist_product_check_facts('b7100000-0000-4000-8000-000000000001',
 'b7200000-0000-4000-8000-000000000001',snapshot_id,packet) from fact_fixture$$,'owner packet persists');
select is((select count(*)::int from public.product_check_fact_assessments),1,'one snapshot has one packet');
select is((select public.persist_product_check_facts('b7100000-0000-4000-8000-000000000001',
 'b7200000-0000-4000-8000-000000000001',snapshot_id,jsonb_set(packet,'{category}','"sunscreen"')) from fact_fixture),
 (select packet from fact_fixture),'retry returns original packet despite changed input');
select throws_ok($$select public.persist_product_check_facts('b7100000-0000-4000-8000-000000000002',
 'b7200000-0000-4000-8000-000000000001',snapshot_id,packet) from fact_fixture$$,'P0001','PRODUCT_FACTS_CASE_NOT_FOUND','other owner rejected');
select throws_ok($$select public.persist_product_check_facts('b7100000-0000-4000-8000-000000000001',
 'b7200000-0000-4000-8000-000000000001',snapshot_id,jsonb_set(packet,'{caseRevision}','999')) from fact_fixture$$,
 'P0001','PRODUCT_FACTS_SNAPSHOT_MISMATCH','wrong revision rejected');
select throws_ok($$select public.persist_product_check_facts('b7100000-0000-4000-8000-000000000001',
 'b7200000-0000-4000-8000-000000000001',snapshot_id,'{}') from fact_fixture$$,
 'P0001','INVALID_PRODUCT_FACTS_PACKET','unbound packet rejected');
select throws_ok($$update public.product_check_fact_assessments set packet='{}'$$,'P0001',null,'stored facts immutable');
set local role authenticated;
set local request.jwt.claim.sub='b7100000-0000-4000-8000-000000000002';
select is((select count(*)::int from public.product_check_fact_assessments),0,'other owner sees no packet');
set local request.jwt.claim.sub='b7100000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.product_check_fact_assessments),1,'owner reads packet');
select throws_ok($$delete from public.product_check_fact_assessments$$,'42501',null,'owner cannot bypass history deletion');
reset role;
delete from auth.users where id='b7100000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.product_check_fact_assessments),0,'account deletion removes facts');
select * from finish();
rollback;
