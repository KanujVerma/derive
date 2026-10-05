-- Lease elapsed time begins after lifecycle/row locks, rather than transaction start.
-- Preserve global lock order, publication CAS, owner/deletion and source-rights gates.
-- Evidence expiry, timestamps, budgets and retry cadence keep their existing semantics.

create or replace function public.part_one_worker(p_action text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.part_one_jobs; b private.part_one_budgets; policy private.part_one_policies;
  reservation private.part_one_reservations; rec private.part_one_records; dec private.part_one_records; s private.part_one_scans;
  token uuid; r jsonb; targets jsonb; target jsonb; retry_at timestamptz; sid uuid; did uuid;
  calls integer; active integer; status text; lease_now timestamptz;
begin
 if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>262144 then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
 perform pg_catalog.pg_advisory_xact_lock(40203);
 if p_action='heartbeat' then
   perform private.part_one_purge_expired_private();
   insert into private.part_one_worker_health(id,heartbeat_at,consumer_version) values(true,now(),p_payload->>'consumerVersion')
     on conflict(id) do update set heartbeat_at=excluded.heartbeat_at,consumer_version=excluded.consumer_version;
   return jsonb_build_object('alive',true);
 end if;
 if p_action='purge_private' then
   perform private.part_one_purge_expired_private();
   return jsonb_build_object('purged',true);
 end if;
 if p_action='revoke_policy' then
   update private.part_one_policies set lookup_allowed=false,retain_allowed=false,display_allowed=false,export_allowed=false
     where id=p_payload->>'policyId';
   if not found then raise exception 'PART_ONE_SOURCE_POLICY_DISABLED'; end if;
   for s in select * from private.part_one_scans for update loop
     perform private.part_one_refresh_scan(s.id,s.owner_id);
   end loop;
   perform private.part_one_purge_expired_private();
   return jsonb_build_object('revoked',true);
 end if;
 if p_action='revoke' then
   update private.part_one_record_status set status=p_payload->>'status',reason=p_payload->>'reason',
     status_revision=status_revision+1,changed_at=now() where record_id=(p_payload->>'recordId')::uuid;
   if not found then
     insert into private.part_one_record_status(record_id,status,reason) values((p_payload->>'recordId')::uuid,p_payload->>'status',p_payload->>'reason');
   end if;
   -- A read-side filter also invalidates a save, never substitutes new evidence.
   for s in select * from private.part_one_scans for update loop
     perform private.part_one_refresh_scan(s.id,s.owner_id);
   end loop;
   perform private.part_one_purge_expired_private();
   return jsonb_build_object('revoked',true);
 end if;
 if p_action='admit' then
   select * into policy from private.part_one_policies where id=p_payload->>'policyId';
   if not found or not policy.retain_allowed or not policy.display_allowed or policy.version<>p_payload->>'policyVersion'
     or (policy.expires_at is not null and policy.expires_at<=now()) then raise exception 'PART_ONE_SOURCE_POLICY_DISABLED'; end if;
   if p_payload->>'scope'='private_package' then raise exception 'PART_ONE_PRIVATE_RETENTION_DISABLED'; end if;
   for sid in select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'dependencies','[]')) loop
     if not private.part_one_record_allowed(sid,null) then raise exception 'PART_ONE_DEPENDENCY_UNAVAILABLE'; end if;
   end loop;
   select * into rec from private.part_one_records where id=nullif(p_payload->>'id','')::uuid;
   if found then
     if rec.kind is distinct from p_payload->>'kind' or rec.item_id is distinct from nullif(p_payload->>'itemId','')::uuid
       or rec.revision is distinct from (p_payload->>'revision')::integer or rec.canonical_key is distinct from p_payload->>'canonicalKey'
       or rec.policy_id<>policy.id or rec.policy_version<>policy.version or rec.scope<>'public'
       or rec.payload is distinct from p_payload->'payload'
       or rec.dependencies is distinct from array(select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'dependencies','[]')))
       or rec.supersedes_id is distinct from nullif(p_payload->>'supersedesId','')::uuid
       or rec.observed_at is distinct from (p_payload->>'observedAt')::timestamptz
       or rec.expires_at is distinct from least((p_payload->>'expiresAt')::timestamptz,coalesce(policy.expires_at,'infinity'::timestamptz)) then
       raise exception 'PART_ONE_ADMISSION_REPLAY_CONFLICT';
     end if;
     return jsonb_build_object('recordId',rec.id,'replay',true);
   end if;
   insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,scope,
       payload,dependencies,supersedes_id,observed_at,expires_at)
     values(coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid()),p_payload->>'kind',nullif(p_payload->>'itemId','')::uuid,
       (p_payload->>'revision')::integer,p_payload->>'canonicalKey',policy.id,policy.version,'public',p_payload->'payload',
       array(select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'dependencies','[]'))),
       nullif(p_payload->>'supersedesId','')::uuid,(p_payload->>'observedAt')::timestamptz,
       least((p_payload->>'expiresAt')::timestamptz,coalesce(policy.expires_at,'infinity'::timestamptz))) returning * into rec;
   insert into private.part_one_record_status(record_id) values(rec.id);
   return jsonb_build_object('recordId',rec.id);
 end if;
 if p_action='claim' then
   lease_now:=clock_timestamp();
   -- Reservations dispatched before a crash stay unknown. They are never
   -- released or re-dispatched automatically by lease expiration.
   update private.part_one_jobs set state='failed_final',lease_token=null,lease_expires_at=null
     where state='running' and lease_expires_at<=lease_now and attempts>=max_attempts;
   lease_now:=clock_timestamp();
   select * into j from private.part_one_jobs where
     ((state in ('queued','deferred_budget','retry_wait') and next_eligible_at<=now())
       or (state='running' and lease_expires_at<=lease_now)) and attempts<max_attempts
     order by case when state='running' then 0 else 1 end,created_at,id for update skip locked limit 1;
   if not found then return jsonb_build_object('job',null); end if;
   token := gen_random_uuid();
   lease_now:=clock_timestamp();
   update private.part_one_jobs set state='running',lease_token=token,lease_expires_at=lease_now+interval '30 seconds',
     attempts=attempts+1,updated_at=now() where id=j.id returning * into j;
   select coalesce(jsonb_agg(jsonb_build_object('scanId',id,'generation',generation,'resultRevision',result_revision,'bindingRevision',binding_revision)), '[]')
     into targets from private.part_one_scans where job_id=j.id and generation=(request->>'generation')::integer;
   return jsonb_build_object('job',jsonb_build_object('id',j.id,'input',j.input,'leaseToken',token,
     'leaseExpiresAt',j.lease_expires_at,'attempts',j.attempts,'maxAttempts',j.max_attempts,
     'checkpoints',j.checkpoints,'publishRevision',j.publish_revision,'targets',targets,
     'unknownReservations',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'provider',provider,'stage',stage)),'[]')
       from private.part_one_reservations where job_id=j.id and state='dispatched_unknown')));
 end if;
 select * into j from private.part_one_jobs where id=(p_payload->>'jobId')::uuid for update;
 lease_now:=clock_timestamp();
 if not found or j.state<>'running' or j.lease_token is distinct from (p_payload->>'leaseToken')::uuid
   or j.lease_expires_at<=lease_now then raise exception 'PART_ONE_STALE_LEASE'; end if;
 if p_action='catalog' then return private.part_one_lookup_catalog(j); end if;
 if p_action='renew' then
   update private.part_one_jobs set lease_expires_at=lease_now+interval '30 seconds',updated_at=now() where id=j.id;
   return jsonb_build_object('renewed',true);
 end if;
 if p_action='reserve' then
   select * into policy from private.part_one_policies where id=p_payload->>'provider';
   if not found or not policy.lookup_allowed or (policy.expires_at is not null and policy.expires_at<=now()) then
     raise exception 'PART_ONE_SOURCE_POLICY_DISABLED'; end if;
   select * into reservation from private.part_one_reservations where job_id=j.id and stage=p_payload->>'stage';
   if found then
     return jsonb_build_object('reservationId',reservation.id,'state',reservation.state,'replay',true,
       'mayDispatch',reservation.state='reserved');
   end if;
   select * into b from private.part_one_budgets where provider=p_payload->>'provider' for update;
   if not found then raise exception 'PART_ONE_BUDGET_CONFIGURATION_REQUIRED'; end if;
   select count(*)::integer into calls from private.part_one_reservations where provider=b.provider
     and state<>'released' and reserved_at>now()-make_interval(secs=>b.window_seconds);
   select count(*)::integer into active from private.part_one_reservations where provider=b.provider
     and state in ('reserved','dispatched_unknown');
   if calls>=b.call_limit or active>=b.concurrency_limit or b.reset_at>now() then
     retry_at := greatest(now()+make_interval(secs=>b.window_seconds),coalesce(b.reset_at,now()));
     update private.part_one_jobs set state='deferred_budget',next_eligible_at=retry_at,attempts=greatest(0,attempts-1),lease_token=null,
       lease_expires_at=null,updated_at=now() where id=j.id;
     return jsonb_build_object('deferred',true,'nextCheckAfter',retry_at,'reason','quota_wait');
   end if;
   insert into private.part_one_reservations(job_id,stage,provider,policy_version) values(j.id,p_payload->>'stage',b.provider,policy.version) returning * into reservation;
   return jsonb_build_object('reservationId',reservation.id,'state','reserved','replay',false,'mayDispatch',true);
 end if;
 if p_action='release' then
   update private.part_one_reservations set state='released' where id=(p_payload->>'reservationId')::uuid
     and job_id=j.id and state='reserved';
   return jsonb_build_object('released',found);
 end if;
 if p_action='dispatch' then
   if not exists(select 1 from private.part_one_reservations rr join private.part_one_policies pp on pp.id=rr.provider
     where rr.id=(p_payload->>'reservationId')::uuid and rr.job_id=j.id and pp.lookup_allowed
       and pp.version=rr.policy_version and (pp.expires_at is null or pp.expires_at>now())) then
     raise exception 'PART_ONE_SOURCE_POLICY_DISABLED'; end if;
   update private.part_one_reservations set state='dispatched_unknown' where id=(p_payload->>'reservationId')::uuid
     and job_id=j.id and state='reserved';
   return jsonb_build_object('mayDispatch',found);
 end if;
 if p_action='checkpoint' then
   -- A completed stage is immutable and is reused on resume, including a true
   -- parsed miss. Missing ingredient fields and outages are never true misses.
   if j.checkpoints ? (p_payload->>'stage') then
     if j.checkpoints->(p_payload->>'stage') is distinct from p_payload->'output' then raise exception 'PART_ONE_CHECKPOINT_CONFLICT'; end if;
     return jsonb_build_object('checkpointed',true,'replay',true);
   end if;
   status := p_payload->'output'->>'status';
   if status is null or status not in ('found','not_found','unsupported','ambiguous','rate_limited','unavailable',
       'malformed_response','configuration_required','disallowed_by_source_policy') then raise exception 'PART_ONE_INVALID_PROVIDER_STATUS'; end if;
   if status='not_found' and not coalesce((p_payload->'output'->>'parsedNegative')::boolean,false) then
     raise exception 'PART_ONE_UNPROVEN_NEGATIVE'; end if;
   update private.part_one_jobs set checkpoints=checkpoints || jsonb_build_object(p_payload->>'stage',p_payload->'output'),updated_at=now() where id=j.id;
   if p_payload->>'reservationId' is not null then
     update private.part_one_reservations set state='settled',outcome=status,retry_after=nullif(coalesce(p_payload->'output'->>'retryAfter',p_payload->'output'->'reply'->>'retryAfter'),'')::timestamptz
       where id=(p_payload->>'reservationId')::uuid and job_id=j.id;
     if not found then raise exception 'PART_ONE_RESERVATION_NOT_FOUND'; end if;
     if status='rate_limited' then
       update private.part_one_budgets set reset_at=greatest(coalesce(reset_at,now()),
         coalesce(nullif(coalesce(p_payload->'output'->>'retryAfter',p_payload->'output'->'reply'->>'retryAfter'),'')::timestamptz,now()+interval '60 seconds'))
         where provider=(select provider from private.part_one_reservations where id=(p_payload->>'reservationId')::uuid);
     end if;
   end if;
   return jsonb_build_object('checkpointed',true);
 end if;
 if p_action in ('finish','retry') then
   if (p_payload->>'expectedPublishRevision')::integer is distinct from j.publish_revision then raise exception 'PART_ONE_STALE_PUBLICATION'; end if;
   r := coalesce(p_payload->'resultPatch','{}'::jsonb);
   sid := nullif(r->>'snapshotId','')::uuid; did := nullif(r->>'declarationId','')::uuid;
   if sid is not null then
     select * into rec from private.part_one_records where id=sid and kind='snapshot';
     if not found or rec.scope<>'public' or rec.canonical_key is distinct from j.input->>'canonicalKey'
       or rec.item_id::text is distinct from r->>'itemId' or not private.part_one_snapshot_identity_allowed(sid,null) then
       raise exception 'PART_ONE_INVALID_PUBLICATION'; end if;
     if did is not null then
       select * into dec from private.part_one_records where id=did and kind='declaration';
       if not found or not private.part_one_record_allowed(sid,null) or dec.scope<>'public' or dec.item_id is distinct from rec.item_id or
         not private.part_one_record_allowed(did,null) or not (rec.payload->'declarationIds') ? did::text or
         (r->>'declarationState'='accepted' and not dec.payload->'predicate' @> '{"association":{"passed":true},"noContradiction":{"passed":true},"variantMarket":{"passed":true},"completeness":{"passed":true},"rightsFreshness":{"passed":true}}'::jsonb) then
         raise exception 'PART_ONE_INVALID_PUBLICATION'; end if;
     end if;
   elsif did is not null then raise exception 'PART_ONE_INVALID_PUBLICATION'; end if;
   -- Provider output cannot alter operation IDs, generations, ownership or
   -- subscriptions. Only explicit evidence fields are projected.
   r := r - array['ownerId','scanId','requestId','generation','resultRevision','subscriptionId','jobId','schemaVersion'];
   for target in
     select value from jsonb_array_elements(coalesce(p_payload->'targets','[]'))
     union all
     select jsonb_build_object('scanId',ss.id,'generation',ss.generation,'bindingRevision',ss.binding_revision)
       from private.part_one_scans ss where ss.job_id=j.id and ss.binding_revision=1
         and ss.generation=(ss.request->>'generation')::integer
         and not exists(select 1 from jsonb_array_elements(coalesce(p_payload->'targets','[]')) t where t->>'scanId'=ss.id::text)
   loop
     -- Lock the deletion marker before the scan, matching deletion's profile-
     -- then-cascade order. A plain EXISTS snapshot can race a committed fence.
     select * into s from private.part_one_scans where id=(target->>'scanId')::uuid and job_id=j.id;
     if not found then continue; end if;
     perform 1 from public.profiles where id=s.owner_id and deletion_started_at is null for update;
     if not found then continue; end if;
     select * into s from private.part_one_scans where id=(target->>'scanId')::uuid and job_id=j.id for update;
     if found and s.generation=(target->>'generation')::integer and s.binding_revision=(target->>'bindingRevision')::integer
       and s.generation=(s.request->>'generation')::integer
       and exists(select 1 from public.profiles where id=s.owner_id and deletion_started_at is null)
       and s.result->>'scope' is distinct from 'private_package' then
       if r ? 'candidateIds' then
         perform private.part_one_bind_candidates(s.id,s.generation,s.owner_id,r->'candidateIds',j.input->>'canonicalKey',s.request->'requestedMarket');
       end if;
       s.result_revision := s.result_revision+1;
       update private.part_one_scans set result_revision=s.result_revision,binding_revision=binding_revision+1,
         result=private.part_one_filter_result(s.result || r || jsonb_build_object('identity',
           case when s.result->>'identity'='pending' and not r ? 'identity' then 'unresolved' else coalesce(r->>'identity',s.result->>'identity') end,
           'resultRevision',s.result_revision,
           'work',case when p_payload->>'terminalWork'='failed_final' then 'failed_final' when p_action='retry' and j.attempts<j.max_attempts then 'retry_wait'
             when p_action='retry' then 'failed_final' else 'complete' end),s.owner_id) where id=s.id;
     end if;
   end loop;
   update private.part_one_jobs set state=case when p_payload->>'terminalWork'='failed_final' then 'failed_final' when p_action='retry' and attempts<max_attempts then 'retry_wait'
       when p_action='retry' then 'failed_final' else 'complete' end,
     next_eligible_at=case when p_action='retry' then greatest(now()+interval '1 second',coalesce(nullif(p_payload->>'nextEligibleAt','')::timestamptz,
       now()+make_interval(secs=>least(300,power(2,attempts)::integer)))) else now() end,
     output=r,publish_revision=publish_revision+1,lease_token=null,lease_expires_at=null,updated_at=now() where id=j.id;
   return jsonb_build_object('finished',true);
 end if;
 raise exception 'PART_ONE_UNSUPPORTED_OPERATION';
end $$;

create or replace function public.part_two_resolve(p_owner uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=p_owner; ctx jsonb; cur private.part_two_current; key text; build text; token uuid; rev integer; expected boolean; lease_now timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 if p_owner is null or not exists(select 1 from auth.users where id=p_owner) then raise exception 'PART_TWO_FORBIDDEN' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,191027));
 perform 1 from public.profiles where id=p_owner and deletion_started_at is null for share;
 if not found then raise exception 'PART_TWO_FORBIDDEN' using errcode='42501'; end if;
 if octet_length(p_payload::text)>16384 then raise exception 'PART_TWO_INVALID_REQUEST'; end if;
 if jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in('schemaVersion','requestId','scanId','captureSessionId','expectedGeneration','expectedEvidenceRevision'))
  or p_payload->>'schemaVersion'<>'1' or p_payload->>'requestId' is null or p_payload->>'scanId' is null
  or not p_payload ? 'captureSessionId' or coalesce(p_payload->>'expectedGeneration','')!~'^[0-9]+$' or coalesce(p_payload->>'expectedEvidenceRevision','')!~'^[0-9]+$'
 then raise exception 'PART_TWO_INVALID_REQUEST'; end if;
 perform (p_payload->>'requestId')::uuid;
 ctx:=private.part_two_context(u,(p_payload->>'scanId')::uuid,nullif(p_payload->>'captureSessionId','')::uuid);
 key:=ctx->>'bindingKey'; build:=ctx->>'contextDigest';
 insert into private.part_two_current(binding_key,owner_id,scan_id,capture_id,generation,evidence_revision,deletion_epoch)
 values(key,u,(ctx->>'scanId')::uuid,nullif(ctx->'capture'->>'captureSessionId','')::uuid,(ctx->>'generation')::integer,(ctx->>'evidenceRevision')::integer,(ctx->>'deletionEpoch')::integer)
 on conflict(binding_key) do nothing;
 select * into cur from private.part_two_current where binding_key=key for update;
 lease_now:=clock_timestamp();
 expected:=(ctx->>'generation')::integer=(p_payload->>'expectedGeneration')::integer and (ctx->>'evidenceRevision')::integer=(p_payload->>'expectedEvidenceRevision')::integer;
 if not expected then
  if cur.context_digest is distinct from build then
   update private.part_two_current set context_digest=build,build_key=null,result=null,state='blocked',result_revision=result_revision+1,lease_token=null,lease_expires_at=null where binding_key=key returning * into cur;
  end if;
  return jsonb_build_object('context',ctx,'resultRevision',cur.result_revision,'state','blocked','reasonCodes',jsonb_build_array('evidence_changed'),'cached',null,'ticket',null);
 end if;
 if cur.build_key=build and cur.result is not null and (cur.expires_at is null or cur.expires_at>now()) then
  return jsonb_build_object('context',ctx,'resultRevision',cur.result_revision,'state',cur.state,'reasonCodes','[]'::jsonb,'cached',cur.result,'ticket',null);
 end if;
 if cur.build_key=build and cur.state<>'pending' and cur.result is null then
  return jsonb_build_object('context',ctx,'resultRevision',cur.result_revision,'state',cur.state,'reasonCodes',case when cur.state='blocked' then '["rights_or_evidence_unavailable"]'::jsonb else '[]'::jsonb end,'cached',null,'ticket',null);
 end if;
 if cur.build_key=build and cur.state='pending' and cur.lease_expires_at>lease_now then
  return jsonb_build_object('context',ctx,'resultRevision',cur.result_revision,'state','pending','reasonCodes','[]'::jsonb,'cached',null,'ticket',null);
 end if;
 rev:=cur.result_revision+1; token:=gen_random_uuid();
 update private.part_two_current set build_key=build,context_digest=build,result_revision=rev,generation=(ctx->>'generation')::integer,
  evidence_revision=(ctx->>'evidenceRevision')::integer,deletion_epoch=(ctx->>'deletionEpoch')::integer,release_id=ctx->>'releaseId',release_epoch=(ctx->>'releaseEpoch')::integer,
  state=ctx->>'state',lease_token=case when ctx->>'state'='pending' then token else null end,lease_expires_at=case when ctx->>'state'='pending' then lease_now+interval '30 seconds' else null end,
  result=null,dependencies=array(select (value->>'id')::uuid from jsonb_array_elements(ctx->'dependencies')),
  private_payload=coalesce((ctx->'capture' is not null and ctx->'capture'<>'null'::jsonb) or ctx->'declaration'->>'scope'='private_package',false),
  expires_at=nullif(ctx->>'expiresAt','')::timestamptz,updated_at=now() where binding_key=key;
 return jsonb_build_object('context',ctx,'resultRevision',rev,'state',ctx->>'state','reasonCodes',case when ctx->>'state'='blocked' then '["rights_or_evidence_unavailable"]'::jsonb else '[]'::jsonb end,'cached',null,
  'ticket',case when ctx->>'state'='pending' then jsonb_build_object('bindingKey',key,'leaseToken',token,'contextDigest',build,'expectedResultRevision',rev) else null end);
end $$;

create or replace function public.part_two_worker(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cur private.part_two_current; ctx jsonb; cfg private.part_two_config; rel private.part_two_releases; body jsonb; sid uuid; rev integer; recalled record; lease_now timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 if p_action='explanations/withdraw' then
  perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
  if coalesce(p_payload->>'recordId','')='' or length(p_payload->>'recordId')>200 or coalesce(p_payload->>'reason','')='' then raise exception 'PART_TWO_INVALID_WITHDRAWAL'; end if;
  if (select count(*) from private.part_two_explanation_withdrawals)>=1000 and not exists(select 1 from private.part_two_explanation_withdrawals where record_id=p_payload->>'recordId') then raise exception 'PART_TWO_INVALID_WITHDRAWAL'; end if;
  insert into private.part_two_explanation_withdrawals(record_id,reason) values(p_payload->>'recordId',p_payload->>'reason') on conflict(record_id) do nothing;
  -- Atomically replace affected stored copies with independent allowed facts.
  for recalled in select ps.id,ps.owner_id from private.part_two_snapshots ps where exists(select 1 from jsonb_array_elements(coalesce(ps.payload->'output'->'reading'->'facts','[]')) f where private.part_two_card_withdrawn(f,ps.payload->'output'->'reading')) loop
   body:=private.part_two_project_withdrawals(recalled.id,recalled.owner_id);
   if body is null then delete from private.part_two_snapshots where id=recalled.id; end if;
  end loop;
  update private.part_two_current set result=null,build_key=null,state='pending',lease_token=null,lease_expires_at=null,result_revision=result_revision+1 where result is not null and exists(select 1 from jsonb_array_elements(result->'output'->'reading'->'facts') f where private.part_two_card_withdrawn(f,result->'output'->'reading'));
  return jsonb_build_object('withdrawn',true);
 elsif p_action='release/register' then
  if coalesce(p_payload->>'reviewEvidence','')='' or coalesce(p_payload->>'releaseHash','')!~'^[0-9a-f]{64}$' or jsonb_typeof(p_payload->'versions')<>'object' then raise exception 'PART_TWO_INVALID_RELEASE'; end if;
  select * into rel from private.part_two_releases where id=p_payload->>'releaseId';
  if found then
   if rel.release_hash<>p_payload->>'releaseHash' or rel.versions<>p_payload->'versions' then raise exception 'PART_TWO_IMMUTABLE_RELEASE'; end if;
  else insert into private.part_two_releases(id,versions,release_hash,permitted,review_evidence) values(p_payload->>'releaseId',p_payload->'versions',p_payload->>'releaseHash',true,p_payload->>'reviewEvidence'); end if;
  return jsonb_build_object('registered',true);
 elsif p_action='release/select' then
  select * into rel from private.part_two_releases where id=p_payload->>'releaseId' and permitted and revoked_at is null;
  if not found then raise exception 'PART_TWO_RELEASE_UNAVAILABLE'; end if;
  update private.part_two_config set release_id=rel.id,epoch=epoch+1 where id=true;
  return jsonb_build_object('selected',rel.id);
 elsif p_action='release/revoke' then
  update private.part_two_releases set permitted=false,revoked_at=now() where id=p_payload->>'releaseId';
  update private.part_two_config set epoch=epoch+1 where id=true;
  delete from private.part_two_snapshots where private_payload and release_id=p_payload->>'releaseId';
  update private.part_two_current set result=null,result_revision=result_revision+1,state='blocked',lease_token=null,lease_expires_at=null,build_key=null where release_id=p_payload->>'releaseId';
  return jsonb_build_object('revoked',true);
 elsif p_action<>'publish' then raise exception 'PART_TWO_UNSUPPORTED'; end if;
 select * into cur from private.part_two_current where binding_key=p_payload->>'bindingKey';
 if not found then return jsonb_build_object('published',false,'reason','stale_work'); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(cur.owner_id::text,191027));
 ctx:=private.part_two_context(cur.owner_id,cur.scan_id,cur.capture_id);
 select * into cur from private.part_two_current where binding_key=p_payload->>'bindingKey' for update;
 lease_now:=clock_timestamp();
 if cur.lease_token is distinct from nullif(p_payload->>'leaseToken','')::uuid or cur.lease_expires_at<=lease_now
  or cur.context_digest is distinct from p_payload->>'contextDigest' or ctx->>'contextDigest' is distinct from cur.context_digest
  or cur.result_revision is distinct from (p_payload->>'expectedResultRevision')::integer or ctx->>'state'<>'pending' then
  return jsonb_build_object('published',false,'reason','stale_work'); end if;
 body:=p_payload->'result';
 if not private.part_two_client_result_containers(body) then raise exception 'PART_TWO_INVALID_RESULT'; end if;
 if jsonb_typeof(body)<>'object' or body->>'state' not in('ready','parse_limit','failed','blocked')
  or body->>'schemaVersion' is distinct from '2' or body->>'authenticatedOwnerId' is distinct from cur.owner_id::text
  or body->>'scanId' is distinct from cur.scan_id::text or nullif(body->>'captureSessionId','')::uuid is distinct from cur.capture_id
  or (body->>'expiresAt')::timestamptz is distinct from cur.expires_at
  or body->>'bindingKey' is distinct from cur.binding_key or (body->>'generation')::integer is distinct from cur.generation
  or (body->>'evidenceRevision')::integer is distinct from cur.evidence_revision then raise exception 'PART_TWO_INVALID_RESULT'; end if;
 rev:=cur.result_revision+1; body:=body-'requestId'||jsonb_build_object('resultRevision',rev);
 if body->>'state'='ready' then
  if body->'output'->>'kind'='bound' and (body->'output'->'productFacts'->'binding' is distinct from body->'output'->'reading'->'binding'
   or coalesce(body->'output'->'productFacts'->'labelAssertions','[]') is distinct from coalesce(body->'output'->'reading'->'labelAssertions','[]')
   or body->'output'->'productFacts'->'dependencyManifest'->'sourceRefs' is distinct from body->'output'->'reading'->'dependencyManifest'->'sourceRefs'
   or coalesce(body->'output'->'productFacts'->'dependencyManifest'->'labelAssertionPermissions','[]') is distinct from coalesce(body->'output'->'reading'->'dependencyManifest'->'labelAssertionPermissions','[]')) then raise exception 'PART_TWO_INVALID_RESULT'; end if;

  if exists(select 1 from jsonb_array_elements(coalesce(body->'output'->'reading'->'facts','[]')) f where f->>'kind'='product_label_assertion') then raise exception 'PART_TWO_INVALID_LABEL_ASSERTION'; end if;
  if body->'output'->>'kind'='reading_only' and (jsonb_array_length(coalesce(body->'output'->'reading'->'labelAssertions','[]'))>0 or exists(select 1 from jsonb_array_elements(coalesce(body->'output'->'reading'->'facts','[]')) f where f->>'kind'='product_label_assertion')) then raise exception 'PART_TWO_INVALID_LABEL_ASSERTION'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(body->'output'->'reading'->'labelAssertions','[]')) a where not exists(select 1 from jsonb_array_elements(ctx->'observations') o where o->>'id'=a->'span'->>'observationId' and o->>'revision'=a->'span'->>'sourceRevision') or not (ctx->'declaration'->'payload'->'observationIds' ? (a->'span'->>'observationId'))) then raise exception 'PART_TWO_INVALID_LABEL_ASSERTION'; end if;
  if not private.part_two_assertion_snapshot_allowed(body->'output'->'reading',cur.owner_id) or not private.part_two_assertion_snapshot_allowed(body->'output'->'productFacts',cur.owner_id) then raise exception 'PART_TWO_INVALID_LABEL_ASSERTION'; end if;
  if exists(select 1 from jsonb_array_elements(body->'output'->'reading'->'facts') f where private.part_two_card_withdrawn(f,body->'output'->'reading'))
   or exists(select 1 from jsonb_array_elements(coalesce(body->'output'->'productFacts'->'facts','[]')) f where private.part_two_card_withdrawn(f,body->'output'->'productFacts')) then raise exception 'PART_TWO_RECALLED_EXPLANATION'; end if;
  if body->'output'->'reading'->'binding'->>'dependencyDigest' is distinct from ctx->>'dependencyDigest'
   or body->'output'->'reading'->'binding'->>'authenticatedOwnerId' is distinct from cur.owner_id::text
   or body->'output'->'reading'->'binding'->>'bindingKey' is distinct from cur.binding_key
   or exists(select 1 from jsonb_array_elements(body->'output'->'reading'->'facts') f,lateral jsonb_array_elements_text(f->'sourceDependencies') sd
    where not exists(select 1 from jsonb_array_elements(ctx->'observations') o where o->>'id'=sd.value))
   or body->'output'->'reading'->'claimLimits'->>'negativeClaimsAllowed' is distinct from 'false' then raise exception 'PART_TWO_INVALID_RESULT'; end if;
  if body->'output'->>'kind'='bound' and (body->'output'->'reading'->'binding'->>'itemId' is distinct from ctx->'declaration'->>'item_id'
   or body->'output'->'reading'->'binding'->>'declarationId' is distinct from ctx->'declaration'->>'id'
   or body->'output'->'reading'->'binding'->>'snapshotId' is distinct from ctx->'snapshot'->>'id'
   or ctx->'declaration'->'payload'->'predicate'->'association'->>'passed' is distinct from 'true') then raise exception 'PART_TWO_INVALID_RESULT'; end if;
  if body->'output'->>'kind'='reading_only' and (cur.capture_id is null or body->'output'->'reading'->'binding'->>'kind' is distinct from 'capture'
   or body->'output'->'reading'->'binding'->>'ownerId' is distinct from cur.owner_id::text
   or body->'output'->'reading'->'claimLimits'->>'productPresenceAllowed' is distinct from 'false') then raise exception 'PART_TWO_INVALID_RESULT'; end if;
  sid:=gen_random_uuid();
  insert into private.part_two_snapshots(id,binding_key,owner_id,capture_id,build_key,result_revision,release_id,payload,dependencies,private_payload,expires_at)
   values(sid,cur.binding_key,cur.owner_id,cur.capture_id,cur.build_key,rev,cur.release_id,body,cur.dependencies,cur.private_payload,cur.expires_at);
  insert into private.part_two_review_queue(owner_id,snapshot_id,occurrence_id,reason)
   select cur.owner_id,sid,o->>'occurrenceId',case when o->'mapping'->>'state'='ambiguous' then 'ambiguous' else 'unresolved' end
    from jsonb_array_elements(coalesce(body->'output'->'reading'->'occurrences','[]')) o where o->'mapping'->>'state' in('unresolved','ambiguous');
 end if;
 update private.part_two_current set result=body,result_revision=rev,state=body->>'state',lease_token=null,lease_expires_at=null,updated_at=now() where binding_key=cur.binding_key;
 return jsonb_build_object('published',true,'result',body);
end $$;
