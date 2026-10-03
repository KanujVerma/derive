-- Two actual PostgreSQL sessions; original synthetic fixtures, no provider transport.
-- Run through tests/check-lease-clock-concurrency.mjs: it holds the existing
-- lifecycle advisory lock in a second session. Fixtures and pgtap setup roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create temp table lease_state(key text primary key,value jsonb);
insert into private.part_one_jobs(id,coalescing_key,input,policy_version,state,attempts,lease_token,lease_expires_at,created_at) values
 ('f7100000-0000-4000-8000-000000000001','lease-clock-synthetic','{}','test','queued',0,null,null,'1900-01-01');

-- LEASE_CONTENTION_BLOCK

insert into lease_state values('claim',public.part_one_worker('claim','{}'));
select is((select value->'job'->>'id' from lease_state where key='claim'),'f7100000-0000-4000-8000-000000000001','queued work remains claimable after the lock wait');
select is((select (value->'job'->>'attempts')::integer from lease_state where key='claim'),1,'first claim advances the attempt');
select ok((select extract(epoch from ((value->'job'->>'leaseExpiresAt')::timestamptz-clock_timestamp())) between 29.8 and 30.0 from lease_state where key='claim'),'claim receives the full thirty seconds after the lock wait');
update private.part_one_jobs set lease_expires_at=clock_timestamp()-interval '1 millisecond' where id='f7100000-0000-4000-8000-000000000001';
insert into lease_state values('reclaimed',public.part_one_worker('claim','{}'));
select is((select (value->'job'->>'attempts')::integer from lease_state where key='reclaimed'),2,'actual expired work can be reclaimed in the same transaction');
select ok((select value->'job'->>'leaseToken' from lease_state where key='claim') is distinct from (select value->'job'->>'leaseToken' from lease_state where key='reclaimed'),'newer claim obtains a different lease token');
select throws_ok($$select public.part_one_worker('renew',(select jsonb_build_object('jobId',value->'job'->'id','leaseToken',value->'job'->'leaseToken') from lease_state where key='claim'))$$,'P0001','PART_ONE_STALE_LEASE','a newer claim fences the previous lease token');
select throws_ok($$select public.part_one_worker('finish',(select jsonb_build_object('jobId',value->'job'->'id','leaseToken',value->'job'->'leaseToken','expectedPublishRevision',999,'targets','[]'::jsonb,'resultPatch','{}'::jsonb) from lease_state where key='reclaimed'))$$,'P0001','PART_ONE_STALE_PUBLICATION','current lease cannot bypass the publication revision fence');
select ok(not has_function_privilege('authenticated','public.part_one_worker(text,jsonb)','execute'),'claim and renewal remain service-only');


select finish();
rollback;
