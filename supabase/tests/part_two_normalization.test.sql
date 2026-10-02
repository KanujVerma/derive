begin;
select no_plan();
select has_table('private','part_two_snapshots','Part 2 immutable derived snapshots installed');
select ok(not has_table_privilege('authenticated','private.part_two_current','select'),'A21 no owner bypass/cache table hydration');
select ok(not has_function_privilege('authenticated','public.part_two_worker(text,jsonb)','execute'),'A25 worker publication is service-only');
select ok(has_function_privilege('authenticated','public.part_two_operation(text,jsonb)','execute'),'closed authenticated operation installed');
select is((select release_id from private.part_two_config where id=true),null,'unreviewed release stays disabled by migration');
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
 ('f3000000-0000-4000-8000-000000000001',null,true,'{}'),('f3000000-0000-4000-8000-000000000002',null,true,'{}');
insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,dependencies,observed_at,expires_at) values
 ('f3100000-0000-4000-8000-000000000001','observation',null,1,null,'derive_catalog','1','{"provider":"synthetic","rawText":"Water"}','{}',now(),now()+interval '1 day'),
 ('f3100000-0000-4000-8000-000000000002','declaration','f3200000-0000-4000-8000-000000000001',1,null,'derive_catalog','1',
 '{"state":"accepted","rawText":"Water","sections":[],"sources":[],"predicate":{"association":{"passed":true},"noContradiction":{"passed":true},"variantMarket":{"passed":true},"completeness":{"passed":true},"rightsFreshness":{"passed":true}}}',array['f3100000-0000-4000-8000-000000000001'::uuid],now(),now()+interval '1 day'),
 ('f3100000-0000-4000-8000-000000000003','snapshot','f3200000-0000-4000-8000-000000000001',1,'gtin:00305210416383','derive_catalog','1',
 '{"name":"Synthetic Part 2","variantText":null,"declarationIds":["f3100000-0000-4000-8000-000000000002"],"requestedMarket":null,"sourceMarkets":[],"packageMarket":null}','{}',now(),now()+interval '1 day');
select public.part_two_worker('release/register','{"releaseId":"test-release-one","releaseHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","versions":{"parser":"one"},"reviewEvidence":"Synthetic local fixture: test-only original names"}');
select public.part_two_worker('release/register','{"releaseId":"test-release-two","releaseHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","versions":{"parser":"two"},"reviewEvidence":"Synthetic local fixture: test-only original names"}');
select public.part_two_worker('release/select','{"releaseId":"test-release-one"}');
create temp table p2_state(key text primary key,value jsonb);grant all on p2_state to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','f3000000-0000-4000-8000-000000000001',true);
insert into p2_state values('scan',public.part_one_operation('scans/create','{"idempotencyKey":"p2-test","request":{"schemaVersion":1,"requestId":"f3300000-0000-4000-8000-000000000001","clientScanId":"f3300000-0000-4000-8000-000000000002","idempotencyKey":"p2-test","generation":0,"code":{"raw":"305210416383","symbology":"upc_a","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
insert into p2_state values('request',jsonb_build_object('schemaVersion',1,'requestId','f3300000-0000-4000-8000-000000000003','scanId',(select value->>'scanId' from p2_state where key='scan'),'captureSessionId',null,'expectedGeneration',0,'expectedEvidenceRevision',(select (value->>'resultRevision')::int from p2_state where key='scan')));
reset role;
insert into p2_state values('first',public.part_two_resolve('f3000000-0000-4000-8000-000000000001',(select value from p2_state where key='request')));
select is((select value->>'state' from p2_state where key='first'),'pending','A28 miss schedules bounded durable local work');
insert into p2_state values('join',public.part_two_resolve('f3000000-0000-4000-8000-000000000001',(select value from p2_state where key='request')));
select is((select value->>'resultRevision' from p2_state where key='join'),(select value->>'resultRevision' from p2_state where key='first'),'A28 reopened pending joins same monotonic revision');
select is((select value->'ticket' from p2_state where key='join'),'null'::jsonb,'reopen does not duplicate work');
select throws_ok($$select public.part_two_resolve('f3000000-0000-4000-8000-000000000001',(select value||'{"productPresenceAllowed":true}' from p2_state where key='request'))$$,'P0001','PART_TWO_INVALID_REQUEST','A25 forged authority fields rejected');
select set_config('request.jwt.claim.sub','f3000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.part_two_resolve('f3000000-0000-4000-8000-000000000002',(select value from p2_state where key='request'))$$,'42501','PART_TWO_FORBIDDEN','A21 foreign owner cannot observe cached work');
reset role;
select public.part_two_worker('release/select','{"releaseId":"test-release-two"}');
select is(public.part_two_worker('publish',(select value->'ticket'||jsonb_build_object('result','{}'::jsonb) from p2_state where key='first'))->>'published','false','A22 late previous-release publication rejected');
select set_config('request.jwt.claim.sub','f3000000-0000-4000-8000-000000000001',true);
insert into p2_state values('r2',public.part_two_resolve('f3000000-0000-4000-8000-000000000001',(select value from p2_state where key='request')));
select ok((select (value->>'resultRevision')::integer from p2_state where key='r2')>(select (value->>'resultRevision')::integer from p2_state where key='first'),'A17 release changes produce higher Part 2 revision');
reset role;
select public.part_two_worker('release/select','{"releaseId":"test-release-one"}');
select is(public.part_two_worker('publish',(select value->'ticket'||jsonb_build_object('result','{}'::jsonb) from p2_state where key='r2'))->>'published','false','A22 rollback rejects in-flight new release job');
update private.part_one_record_status set status='retracted',status_revision=status_revision+1 where record_id='f3100000-0000-4000-8000-000000000001';
-- Existing fixture has no status row: insert explicit retraction also invalidates.
insert into private.part_one_record_status(record_id,status) values('f3100000-0000-4000-8000-000000000001','retracted') on conflict(record_id) do nothing;
insert into p2_state values('revoked',public.part_two_resolve('f3000000-0000-4000-8000-000000000001',(select value from p2_state where key='request')));
select is((select value->>'state' from p2_state where key='revoked'),'blocked','A19 source retraction blocks current facts');
select is((select value->'context'->'observations' from p2_state where key='revoked'),'[]'::jsonb,'A19 revoked source text not returned');
reset role;
select is(public.part_two_worker('publish',(select value->'ticket'||jsonb_build_object('result','{}'::jsonb) from p2_state where key='first'))->>'published','false','A19 revoked source cannot republish');
insert into private.part_two_snapshots(binding_key,owner_id,build_key,result_revision,release_id,payload,dependencies,private_payload,expires_at)
 select binding_key,owner_id,'immutable-fixture',100,'test-release-one','{"state":"ready"}',array['f3100000-0000-4000-8000-000000000001'::uuid],true,now()+interval '1 day' from private.part_two_current limit 1;
select throws_ok($$update private.part_two_snapshots set payload='{}'$$,'P0001','PART_ONE_IMMUTABLE','immutable snapshot updates rejected');
update private.part_one_policies set display_allowed=false where id='derive_catalog';
select is((select count(*)::integer from private.part_two_snapshots where private_payload),0,'A19 private copied payload purges on policy revocation');
select ok(not has_table_privilege('authenticated','private.part_two_capture_saves','select'),'private saved interpretation links cannot hydrate cross-owner');
insert into private.part_two_snapshots(binding_key,owner_id,build_key,result_revision,release_id,payload,dependencies,private_payload,expires_at)
 select binding_key,owner_id,'card-fixture',101,'test-release-one','{"output":{"reading":{"facts":[{"kind":"reference_function","dictionaryDependencies":["synthetic-card-policy"]}]}}}','{}',true,now()+interval '1 day' from private.part_two_current limit 1;
select public.part_two_worker('explanations/withdraw','{"recordId":"synthetic-card-policy","reason":"Synthetic local recall"}');
select is((select count(*)::integer from private.part_two_snapshots ps,jsonb_array_elements(ps.payload->'output'->'reading'->'facts') f where f->>'kind'='reference_function'),0,'A31 recalled card copies purge without deleting independent projection');
select public.part_two_worker('release/select','{"releaseId":"test-release-two"}');
select public.part_two_worker('release/select','{"releaseId":"test-release-one"}');
select is((select count(*)::integer from private.part_two_explanation_withdrawals where record_id='synthetic-card-policy'),1,'A22 rollback does not erase known card recall tombstone');
select finish();
rollback;
