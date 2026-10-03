-- Two actual PostgreSQL sessions; original synthetic fixtures, no provider transport.
-- Run through tests/check-lease-clock-concurrency.mjs: it holds the existing
-- lifecycle advisory lock in a second session. Fixtures and pgtap setup roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create temp table lease_state(key text primary key,value jsonb);
insert into private.part_one_jobs(id,coalescing_key,input,policy_version,state,attempts,lease_token,lease_expires_at,created_at) values
 ('f7100000-0000-4000-8000-000000000001','lease-clock-synthetic','{}','test','running',1,'f7100000-0000-4000-8000-000000000002',clock_timestamp()+interval '0.5 seconds','1900-01-01');

-- LEASE_CONTENTION_BLOCK

select throws_ok($$select public.part_one_worker('renew','{"jobId":"f7100000-0000-4000-8000-000000000001","leaseToken":"f7100000-0000-4000-8000-000000000002"}')$$,'P0001','PART_ONE_STALE_LEASE','renewal that began before expiry but acquired the lock after expiry is rejected');
select is((select attempts from private.part_one_jobs where id='f7100000-0000-4000-8000-000000000001'),1,'refused renewal cannot silently claim another attempt');
select throws_ok($$select public.part_one_worker('finish','{"jobId":"f7100000-0000-4000-8000-000000000001","leaseToken":"f7100000-0000-4000-8000-000000000002","expectedPublishRevision":0,"resultPatch":{},"targets":[]}')$$,'P0001','PART_ONE_STALE_LEASE','late publication with the expired token remains rejected');
-- A valid renewal still grants thirty seconds using the current clock.
update private.part_one_jobs set lease_expires_at=clock_timestamp()+interval '5 seconds' where id='f7100000-0000-4000-8000-000000000001';
select is(public.part_one_worker('renew','{"jobId":"f7100000-0000-4000-8000-000000000001","leaseToken":"f7100000-0000-4000-8000-000000000002"}')->>'renewed','true','an unexpired current token can renew');
select ok((select extract(epoch from (lease_expires_at-clock_timestamp())) between 29.8 and 30.0 from private.part_one_jobs where id='f7100000-0000-4000-8000-000000000001'),'successful renewal receives the full thirty seconds');


select finish();
rollback;
