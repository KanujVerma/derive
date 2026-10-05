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
create function pg_temp.lease_fixture_context() returns jsonb language plpgsql as $$
declare ctx jsonb; begin
 begin
  ctx:=private.part_two_context('f7200000-0000-4000-8000-000000000001','f7230000-0000-4000-8000-000000000001',null);
  raise exception using errcode='ZX001',message='Release only fixture setup locks';
 exception when sqlstate 'ZX001' then null; end;
 return ctx;
end $$;
insert into lease_state values('context',pg_temp.lease_fixture_context());
insert into private.part_two_current(binding_key,owner_id,scan_id,result_revision,build_key,context_digest,generation,evidence_revision,deletion_epoch,release_id,release_epoch,state,lease_token,lease_expires_at,dependencies,expires_at)
 select value->>'bindingKey','f7200000-0000-4000-8000-000000000001','f7230000-0000-4000-8000-000000000001',1,value->>'contextDigest',value->>'contextDigest',0,1,0,value->>'releaseId',(value->>'releaseEpoch')::integer,'pending','f7250000-0000-4000-8000-000000000001',clock_timestamp()+interval '0.5 seconds',array(select (d->>'id')::uuid from jsonb_array_elements(value->'dependencies') d),(value->>'expiresAt')::timestamptz from lease_state where key='context';
insert into lease_state values('publication',(select jsonb_build_object('bindingKey',value->>'bindingKey','leaseToken','f7250000-0000-4000-8000-000000000001','contextDigest',value->>'contextDigest','expectedResultRevision',1,'result',jsonb_build_object('schemaVersion',2,'state','failed','authenticatedOwnerId',value->>'ownerId','scanId',value->>'scanId','captureSessionId',null,'generation',0,'evidenceRevision',1,'bindingKey',value->>'bindingKey','expiresAt',value->>'expiresAt')) from lease_state where key='context'));

-- LEASE_CONTENTION_BLOCK

select is(public.part_two_worker('publish',(select value from lease_state where key='publication'))->>'published','false','publication begun before expiry but locked until after expiry is refused');
select is((select result_revision from private.part_two_current where scan_id='f7230000-0000-4000-8000-000000000001'),1,'expired publication does not advance the result revision');
select is((select count(*)::integer from private.part_two_snapshots where owner_id='f7200000-0000-4000-8000-000000000001'),0,'expired work cannot write a snapshot');
update private.part_two_current set lease_expires_at=clock_timestamp()+interval '5 seconds' where scan_id='f7230000-0000-4000-8000-000000000001';
select is(public.part_two_worker('publish',(select value||jsonb_build_object('leaseToken','f7250000-0000-4000-8000-000000000002') from lease_state where key='publication'))->>'published','false','wrong token remains fenced even with a current lease');
select is(public.part_two_worker('publish',(select value||jsonb_build_object('expectedResultRevision',999) from lease_state where key='publication'))->>'published','false','wrong revision remains fenced even with a current lease');
select is(public.part_two_worker('publish',(select value from lease_state where key='publication'))->>'published','true','otherwise valid unexpired work still publishes');
select is((select result_revision from private.part_two_current where scan_id='f7230000-0000-4000-8000-000000000001'),2,'valid publication advances the result revision exactly once');
select ok(not has_function_privilege('authenticated','public.part_two_worker(text,jsonb)','execute'),'publication remains service-only');


select finish();
rollback;
