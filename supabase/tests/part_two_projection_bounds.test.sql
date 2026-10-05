begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values ('fa000000-0000-4000-8000-000000000001',null,true,'{}');
create temp table root_item as select jsonb_build_object('snapshotId','fa100000-0000-4000-8000-000000000001','itemId','fa200000-0000-4000-8000-000000000001','revision',1,'name','Synthetic root identity',
 'variant','{"brand":"Synthetic","line":null,"form":"lotion","scent":"unscented","shade":null,"spf":null,"strength":null,"size":"100","unit":"ml","packCount":1,"packagingLevel":"each"}'::jsonb,
 'fieldEvidence','{}'::jsonb,'barcodeAssertions','[]'::jsonb,'requestedMarket','US','sourceMarkets','["US"]'::jsonb,'packageMarket',null,'declarationIds','[]'::jsonb,'conflictIds','[]'::jsonb,'scope','public','supersedesId',null) body;
insert into private.part_one_records(id,kind,item_id,revision,policy_id,policy_version,payload,dependencies,observed_at,expires_at)
 select 'fa100000-0000-4000-8000-000000000001','snapshot','fa200000-0000-4000-8000-000000000001',1,'derive_catalog','1',body||'{"brand":"Synthetic","variantText":"Synthetic fixture","image":null}', '{}',now(),now()+interval '1 day' from root_item;
create temp table projected as select private.part_one_private_context('fa000000-0000-4000-8000-000000000001',
 jsonb_populate_record(null::private.part_one_captures,'{"id":"fa300000-0000-4000-8000-000000000001","owner_id":"fa000000-0000-4000-8000-000000000001","item_id":"fa200000-0000-4000-8000-000000000001"}'),
 jsonb_populate_record(null::private.part_one_scans,'{"result":{"snapshotId":"fa100000-0000-4000-8000-000000000001"}}'),
 jsonb_populate_record(null::private.part_one_capture_commits,'{"source_commit_id":"fa400000-0000-4000-8000-000000000001"}'),null) body;
select is((select body->'item' from projected),(select body from root_item),'production ROOT ItemSnapshot projects exact identity fields without display extras');
select is((select body->'item'->'variant'->>'scent' from projected),'unscented','variant conflict input is preserved');
select is((select body->'item'->>'requestedMarket' from projected),'US','market conflict input is preserved');
-- Full immutable nested/private historical shape still has the same exact projection.
select is(private.part_two_snapshot_item(jsonb_populate_record(null::private.part_one_records,(select to_jsonb(r)||jsonb_build_object('payload',jsonb_build_object('fullItem',(select body from root_item))) from private.part_one_records r where r.id='fa100000-0000-4000-8000-000000000001')),'fa000000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001'),(select body from root_item),'nested historical shape stays supported');
select is(private.part_two_snapshot_item(jsonb_populate_record(null::private.part_one_records,(select to_jsonb(r)||jsonb_build_object('payload',payload-'variant') from private.part_one_records r where r.id='fa100000-0000-4000-8000-000000000001')),'fa000000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001'),null,'missing required identity fields fail closed without guessed variants');
select is(private.part_two_snapshot_item((select r from private.part_one_records r where r.id='fa100000-0000-4000-8000-000000000001'),'fa000000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000002'),null,'different selected item cannot manufacture association');
insert into private.part_one_records(id,kind,revision,policy_id,policy_version,payload,dependencies,observed_at,expires_at)
 select md5('p2-early-chain-'||n)::uuid,case when n in(1,100) then 'declaration' else 'observation' end,1,'derive_catalog','1',jsonb_build_object('rawText',repeat('Synthetic ',100)),case when n<600 then array[md5('p2-early-chain-'||(n+1))::uuid] else '{}'::uuid[] end,now(),now()+interval '1 day' from generate_series(1,600) n;
select is(cardinality(private.part_two_bounded_ancestry(array[md5('p2-early-chain-1')::uuid])),513,'ancestry stops at 513 IDs before payload projection');
select is(cardinality(private.part_two_bounded_ancestry(array[md5('p2-early-chain-100')::uuid])),501,'below cap retains every ancestor');
insert into private.part_one_records(id,kind,revision,policy_id,policy_version,payload,dependencies,observed_at,expires_at)
 select md5('p2-cycle-'||n)::uuid,'observation',1,'derive_catalog','1','{}',case n when 1 then array[md5('p2-cycle-2')::uuid,md5('p2-cycle-3')::uuid] when 2 then array[md5('p2-cycle-4')::uuid] when 3 then array[md5('p2-cycle-4')::uuid] else array[md5('p2-cycle-1')::uuid] end,now(),now()+interval '1 day' from generate_series(1,4) n;
select is(cardinality(private.part_two_bounded_ancestry(array[md5('p2-cycle-1')::uuid])),4,'diamond and cycle visit each ID exactly once');
insert into private.part_one_scans(id,owner_id,idempotency_key,request,generation,result) values ('fa500000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','early-cap','{}',0,jsonb_build_object('declarationId',md5('p2-early-chain-1')::uuid));
create temp table bounded_context as select private.part_two_context('fa000000-0000-4000-8000-000000000001','fa500000-0000-4000-8000-000000000001',null) body;
select is((select body->>'state' from bounded_context),'parse_limit','actual resolver yields typed parse_limit for excessive ancestry');
select is((select body->'dependencies' from bounded_context),'[]'::jsonb,'overlimit response has no private or public source payload');
select is((select body->'result' from bounded_context),'{}'::jsonb,'overlimit response does not filter/copy source result before bound');
select ok(not has_function_privilege('authenticated','private.part_two_bounded_ancestry(uuid[])','execute'),'bounded ancestry remains service-internal');
select ok(not has_function_privilege('authenticated','private.part_two_snapshot_item(private.part_one_records,uuid,uuid)','execute'),'identity projection remains service-internal');
-- At/below the bound, canonical source authorization must remain authoritative.
update private.part_one_scans set result=jsonb_build_object('declarationId',md5('p2-early-chain-100')::uuid) where id='fa500000-0000-4000-8000-000000000001';
insert into private.part_one_record_status(record_id,status) values (md5('p2-early-chain-600')::uuid,'retracted');
select is(private.part_two_context('fa000000-0000-4000-8000-000000000001','fa500000-0000-4000-8000-000000000001',null)->'dependencies','[]'::jsonb,'below-cap source retraction still denies complete dependency graph');
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values ('fa000000-0000-4000-8000-000000000002',null,true,'{}');
insert into private.part_one_records(id,kind,revision,policy_id,policy_version,owner_id,scope,payload,observed_at,expires_at) values ('fa700000-0000-4000-8000-000000000001','observation',1,'derive_catalog','1','fa000000-0000-4000-8000-000000000002','private_package','{"rawText":"Foreign private synthetic evidence"}',now(),now()+interval '1 day');
insert into private.part_one_records(id,kind,revision,policy_id,policy_version,payload,dependencies,observed_at,expires_at) values ('fa700000-0000-4000-8000-000000000002','declaration',1,'derive_catalog','1','{}',array['fa700000-0000-4000-8000-000000000001'::uuid],now(),now()+interval '1 day');
update private.part_one_scans set result='{"declarationId":"fa700000-0000-4000-8000-000000000002"}' where id='fa500000-0000-4000-8000-000000000001';
select is(private.part_two_context('fa000000-0000-4000-8000-000000000001','fa500000-0000-4000-8000-000000000001',null)->'observations','[]'::jsonb,'below-cap foreign private ancestor is never projected');
select finish();
rollback;
