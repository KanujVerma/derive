begin;
select no_plan();
insert into private.part_one_budgets values('terminal_fixture',10,1,600,null);
insert into private.part_one_jobs(id,coalescing_key,input,policy_version,state,attempts,max_attempts,lease_token,lease_expires_at)
select ('ed050000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'terminal-'||n,'{}','fixture',
case n when 2 then 'retry_wait' when 5 then 'running' else 'failed_final' end,4,4,
case when n in (4,5) then 'ed050000-0000-4000-8000-000000000099'::uuid else null end,
case n when 4 then clock_timestamp()+interval '10 minutes' when 5 then clock_timestamp()-interval '5 minutes' else null end
from generate_series(1,5) n;
update private.part_one_jobs set updated_at=clock_timestamp()-interval '2 minutes' where coalescing_key like 'terminal-%';
insert into private.part_one_reservations(job_id,stage,provider,policy_version,state,reserved_at,retry_after)
select id,'lookup','terminal_fixture','fixture','dispatched_unknown',
case when coalescing_key='terminal-3' then clock_timestamp() else clock_timestamp()-interval '2 minutes' end,
clock_timestamp()+interval '10 minutes' from private.part_one_jobs where coalescing_key like 'terminal-%';
create temporary table original_charge as select job_id,reserved_at,retry_after from private.part_one_reservations where provider='terminal_fixture';
select public.part_one_worker('claim','{}');
select is((select state from private.part_one_reservations where job_id='ed050000-0000-4000-8000-000000000001'),'settled','old terminal unknown retires automatically');
select is((select outcome from private.part_one_reservations where job_id='ed050000-0000-4000-8000-000000000001'),'terminal_dispatch_outcome_unknown','unknown outcome is retained, never fabricated as success or miss');
select is((select state from private.part_one_reservations where job_id='ed050000-0000-4000-8000-000000000005'),'dispatched_unknown','newly terminal exhausted lease retains a sixty-second drain');
select is((select count(*)::int from private.part_one_reservations where provider='terminal_fixture' and state='dispatched_unknown'),4,'retryable, recently dispatched, newly terminal and leased terminal records retain their slots');
select is((select count(*)::int from private.part_one_reservations where provider='terminal_fixture' and state<>'released'),5,'all charges remain in original quota window');
select ok(not exists(select 1 from private.part_one_reservations r join original_charge o using(job_id) where r.reserved_at is distinct from o.reserved_at or r.retry_after is distinct from o.retry_after),'charge times and upstream retry-after are unchanged');
select ok(has_function_privilege('service_role','public.part_one_worker(text,jsonb)','execute') and not has_function_privilege('authenticated','public.part_one_worker(text,jsonb)','execute') and not has_function_privilege('anon','public.part_one_worker(text,jsonb)','execute'),'worker least privilege remains intact');
select public.part_one_worker('claim','{}');
select is((select count(*)::int from private.part_one_reservations where provider='terminal_fixture'),5,'repeated retirement neither duplicates calls nor deletes reservations');
update private.part_one_jobs set updated_at=clock_timestamp()-interval '2 minutes' where id='ed050000-0000-4000-8000-000000000005';
select public.part_one_worker('claim','{}');
select is((select state from private.part_one_reservations where job_id='ed050000-0000-4000-8000-000000000005'),'settled','exhausted lease retires after its terminal drain');
select * from finish();
rollback;
