-- Two actual PostgreSQL sessions; original synthetic fixtures, no provider transport.
-- Run through tests/check-lease-clock-concurrency.mjs: it holds the existing
-- lifecycle advisory lock in a second session. Fixtures and pgtap setup roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create temp table lease_state(key text primary key,value jsonb);
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values ('f7200000-0000-4000-8000-000000000001',null,true,'{}');
insert into private.part_one_records(id,kind,item_id,revision,policy_id,policy_version,payload,dependencies,observed_at,expires_at) values
 ('f7210000-0000-4000-8000-000000000001','observation',null,1,'derive_catalog','1','{"provider":"synthetic","rawText":"Water"}','{}',now(),now()+interval '1 day'),
 ('f7210000-0000-4000-8000-000000000002','declaration','f7220000-0000-4000-8000-000000000001',1,'derive_catalog','1','{"state":"accepted","rawText":"Water","sections":[],"predicate":{"association":{"passed":true},"noContradiction":{"passed":true},"variantMarket":{"passed":true},"completeness":{"passed":true},"rightsFreshness":{"passed":true}}}',array['f7210000-0000-4000-8000-000000000001'::uuid],now(),now()+interval '1 day'),
 ('f7210000-0000-4000-8000-000000000003','snapshot','f7220000-0000-4000-8000-000000000001',1,'derive_catalog','1','{"name":"Original synthetic lease identity","declarationIds":["f7210000-0000-4000-8000-000000000002"]}','{}',now(),now()+interval '1 day');
insert into private.part_one_scans(id,owner_id,idempotency_key,request,generation,result) values
 ('f7230000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001','lease-clock-synthetic','{}',0,'{"snapshotId":"f7210000-0000-4000-8000-000000000003","declarationId":"f7210000-0000-4000-8000-000000000002","identity":"exact","declarationState":"accepted"}');
insert into private.part_two_releases(id,versions,release_hash,permitted,review_evidence) values ('lease-clock-original-synthetic','{}',repeat('a',64),true,'Original synthetic local database regression only');
update private.part_two_config set release_id='lease-clock-original-synthetic',epoch=epoch+1 where id=true;
insert into lease_state values('request','{"schemaVersion":1,"requestId":"f7240000-0000-4000-8000-000000000001","scanId":"f7230000-0000-4000-8000-000000000001","captureSessionId":null,"expectedGeneration":0,"expectedEvidenceRevision":1}');

-- LEASE_CONTENTION_BLOCK

insert into lease_state values('resolve',public.part_two_resolve('f7200000-0000-4000-8000-000000000001',(select value from lease_state where key='request')));
select is((select value->>'state' from lease_state where key='resolve'),'pending','delayed resolve issues authorized deterministic work');
select ok((select extract(epoch from (lease_expires_at-clock_timestamp())) between 29.8 and 30.0 from private.part_two_current where scan_id='f7230000-0000-4000-8000-000000000001'),'resolve receives thirty seconds after global and row locks');
insert into lease_state values('joined',public.part_two_resolve('f7200000-0000-4000-8000-000000000001',(select value from lease_state where key='request')));
select is((select value->'ticket' from lease_state where key='joined'),'null'::jsonb,'an unexpired pending binding still joins singleflight');
update private.part_two_current set lease_expires_at=clock_timestamp()-interval '1 millisecond' where scan_id='f7230000-0000-4000-8000-000000000001';
insert into lease_state values('reclaimed',public.part_two_resolve('f7200000-0000-4000-8000-000000000001',(select value from lease_state where key='request')));
select ok((select value->'ticket' is not null and value->'ticket'<>'null'::jsonb from lease_state where key='reclaimed'),'actual elapsed expiry permits a new ticket in the same transaction');
select ok((select (value->>'resultRevision')::integer from lease_state where key='reclaimed')>(select (value->>'resultRevision')::integer from lease_state where key='resolve'),'new ticket advances the monotonic result revision');
select is(public.part_two_worker('publish',(select value->'ticket'||'{"result":{}}'::jsonb from lease_state where key='resolve'))->>'published','false','newer ticket fences the prior token');
select is(public.part_two_worker('publish',(select value->'ticket'||jsonb_build_object('expectedResultRevision',999,'result','{}'::jsonb) from lease_state where key='reclaimed'))->>'published','false','current token cannot bypass the result revision fence');
select is(public.part_two_resolve('f7200000-0000-4000-8000-000000000001',(select value||'{"expectedEvidenceRevision":999}'::jsonb from lease_state where key='request'))->>'state','blocked','source evidence revision mismatch remains blocked');
-- Source-policy rights are independent of the later retraction fixture.
update private.part_one_policies set display_allowed=false where id='derive_catalog';
insert into lease_state values('rights_denied',public.part_two_resolve('f7200000-0000-4000-8000-000000000001',(select value from lease_state where key='request')));
select is((select value->>'state' from lease_state where key='rights_denied'),'blocked','withdrawn display rights cannot mint a lease');
select is((select value->'context'->'observations' from lease_state where key='rights_denied'),'[]'::jsonb,'withdrawn display rights do not expose the synthetic source text');
update private.part_one_policies set display_allowed=true where id='derive_catalog';
select is(public.part_two_resolve('f7200000-0000-4000-8000-000000000001',(select value from lease_state where key='request'))->>'state','pending','restored independently permitted rights can mint current work');
insert into private.part_one_record_status(record_id,status) values ('f7210000-0000-4000-8000-000000000001','retracted');
select is(public.part_two_resolve('f7200000-0000-4000-8000-000000000001',(select value from lease_state where key='request'))->>'state','blocked','source retraction still blocks new work');
update public.profiles set deletion_started_at=clock_timestamp() where id='f7200000-0000-4000-8000-000000000001';
select throws_ok($$select public.part_two_resolve('f7200000-0000-4000-8000-000000000001',(select value from lease_state where key='request'))$$,'42501','PART_TWO_FORBIDDEN','owner deletion fence remains enforced');


select finish();
rollback;
