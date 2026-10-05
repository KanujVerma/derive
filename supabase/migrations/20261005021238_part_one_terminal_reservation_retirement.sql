-- Local candidate only. No configuration, grants, quotas or provider calls change.
-- Retire only terminal, unleased dispatch-unknown records after a conservative
-- sixty-second terminal drain (ordinary provider deadline is eight seconds). A settled
-- unknown remains charged in the original quota window and cannot redispatch.
do $migration$
declare definition text; old_branch text := $old$  return public.part_one_worker_before_public_runtime(p_action,p_payload);$old$;
 terminal_transition text := $old$update private.part_one_jobs set state='failed_final',lease_token=null,lease_expires_at=null
     where state='running' and lease_expires_at<=lease_now and attempts>=max_attempts;$old$;
begin
 -- Claim previously cleared exhausted leases without stamping terminal time.
 -- Record that transition, so an old reservation cannot bypass the drain.
 definition:=pg_get_functiondef('public.part_one_worker_before_public_runtime(text,jsonb)'::regprocedure);
 if strpos(definition,terminal_transition)=0 then raise exception 'PART_ONE_TERMINAL_TRANSITION_MISMATCH'; end if;
 execute replace(definition,terminal_transition,replace(terminal_transition,'lease_expires_at=null','lease_expires_at=null,updated_at=clock_timestamp()'));
 definition:=pg_get_functiondef('public.part_one_worker(text,jsonb)'::regprocedure);
 if strpos(definition,old_branch)=0 then raise exception 'PART_ONE_RETIREMENT_WRAPPER_MISMATCH'; end if;
 definition:=replace(definition,old_branch,$new$  reserved:=public.part_one_worker_before_public_runtime(p_action,p_payload);
  if p_action in ('claim','heartbeat','finish','retry') then
   -- Inherited worker already owns lifecycle lock 40203; no new lock order.
   update private.part_one_reservations r
     set state='settled',outcome='terminal_dispatch_outcome_unknown'
     from private.part_one_jobs terminal_job
     where r.job_id=terminal_job.id and r.state='dispatched_unknown'
       and terminal_job.state in ('complete','failed_final','cancelled')
       and terminal_job.lease_token is null and terminal_job.lease_expires_at is null
       and terminal_job.updated_at<=clock_timestamp()-interval '60 seconds'
       and r.reserved_at<=clock_timestamp()-interval '60 seconds';
  end if;
  return reserved;$new$);
 execute definition;
 -- CREATE OR REPLACE preserves the function OID and existing execution ACL.
end $migration$;
