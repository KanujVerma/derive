-- Align fresh replay with the already-approved hosted global rolling-day cap: 1000.
-- No source/release activation, policy/ACL change, owner quota change or hosted application here.
-- CREATE OR REPLACE preserves the existing function owner and grants.
CREATE OR REPLACE FUNCTION public.part_one_worker(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare policy private.part_one_policies; j private.part_one_jobs; u uuid;
 v_now timestamptz; retry_at timestamptz; allowed boolean; reserved jsonb; blocked boolean;
begin
 if p_action not in ('public/policy','public/budget','public/backoff','public/reserve') then
  return public.part_one_worker_before_public_runtime(p_action,p_payload);
 end if;
 if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>8192 then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
 select * into policy from private.part_one_policies where id='open_facts';
 v_now:=clock_timestamp();
 allowed:=found and policy.version='derive-obf-public-content-v1'
  and p_payload->>'policyVersion'=policy.version
  and policy.lookup_allowed and policy.retain_allowed and policy.display_allowed
  and policy.expires_at>v_now and policy.expires_at<='2027-01-04T00:00:00Z'::timestamptz
  and policy.permission_evidence='https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/ ; ODbL database / DbCL contents; reviewed public identity and ingredient fields only';
 if p_action='public/policy' then
  return jsonb_build_object('allowed',coalesce(allowed,false),'policyVersion',coalesce(policy.version,'unconfigured'),'expiresAt',policy.expires_at);
 end if;
 if not coalesce(allowed,false) then raise exception 'PART_ONE_SOURCE_POLICY_DISABLED'; end if;
 if p_action='public/backoff' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('derive_obf_lookup_budget',29050000));
  retry_at:=(p_payload->>'retryAt')::timestamptz;v_now:=clock_timestamp();
  if retry_at is null or retry_at>v_now+interval '365 days' then raise exception 'PART_ONE_INVALID_BACKOFF'; end if;
  -- Retry-After:0 and transaction waits cannot erase upstream backoff.
  retry_at:=greatest(retry_at,v_now+interval '60 seconds');
  update private.part_one_budgets set reset_at=greatest(coalesce(reset_at,v_now),retry_at) where provider='open_facts';
  if not found then raise exception 'PART_ONE_BUDGET_CONFIGURATION_REQUIRED'; end if;
  return jsonb_build_object('allowed',false);
 end if;
 if p_action='public/budget' and p_payload->>'operation' is distinct from 'search' then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
 if p_action='public/reserve' then
  if p_payload->>'provider' is distinct from 'open_facts' then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
  -- Complete lifecycle order comes before profile/global/job/budget row locks.
  perform pg_catalog.pg_advisory_xact_lock(40203);
  perform pg_catalog.pg_advisory_xact_lock(40204);
  perform pg_catalog.pg_advisory_xact_lock(40205);
  perform pg_catalog.pg_advisory_xact_lock(40206);
 end if;
 u:=(p_payload->>'ownerId')::uuid;
 if u is null then raise exception 'INVALID_EXTERNAL_CANDIDATE_OWNER'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text,191027));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('derive_obf_lookup_budget',29050000));
 if p_action='public/reserve' then
  select * into j from private.part_one_jobs where id=(p_payload->>'jobId')::uuid for update;
  if not found or j.state<>'running' or j.lease_token is distinct from (p_payload->>'leaseToken')::uuid or j.lease_expires_at<=clock_timestamp() then raise exception 'PART_ONE_STALE_LEASE'; end if;
 end if;
 -- Source selection is re-read after every possible lock wait.
 select * into policy from private.part_one_policies where id='open_facts';
 v_now:=clock_timestamp();
 allowed:=found and policy.version='derive-obf-public-content-v1'
  and p_payload->>'policyVersion'=policy.version
  and policy.lookup_allowed and policy.retain_allowed and policy.display_allowed
  and policy.expires_at>v_now and policy.expires_at<='2027-01-04T00:00:00Z'::timestamptz
  and policy.permission_evidence='https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/ ; ODbL database / DbCL contents; reviewed public identity and ingredient fields only';
 if not coalesce(allowed,false) then raise exception 'PART_ONE_SOURCE_POLICY_DISABLED'; end if;
 if not exists(select 1 from private.part_one_budgets where provider='open_facts') then raise exception 'PART_ONE_BUDGET_CONFIGURATION_REQUIRED'; end if;
 if not exists(select 1 from public.profiles where id=u and deletion_started_at is null) then raise exception 'EXTERNAL_CANDIDATE_OWNER_UNAVAILABLE'; end if;
 blocked:=exists(select 1 from private.part_one_budgets where provider='open_facts' and reset_at>v_now)
  or (select count(*) from private.external_candidate_lookup_reservations where reserved_at>v_now-interval '1 minute')>=case when p_action='public/budget' then 8 else 12 end
  or (select count(*) from private.external_candidate_lookup_reservations where reserved_at>v_now-interval '1 day')>=1000
  or (select count(*) from private.external_candidate_lookup_reservations where user_id=u and reserved_at>v_now-interval '1 minute')>=10
  or (select count(*) from private.external_candidate_lookup_reservations where user_id=u and reserved_at>v_now-interval '1 day')>=100;
 if blocked then
  if p_action='public/reserve' then
   -- Never insert or dispatch a provider stage when shared quota is exhausted.
   -- Refund claim attempt like inherited reserve, and relinquish the lease.
   retry_at:=greatest(v_now+interval '60 seconds',coalesce((select reset_at from private.part_one_budgets where provider='open_facts'),v_now));
   if (select count(*) from private.external_candidate_lookup_reservations where reserved_at>v_now-interval '1 day')>=1000 then
    retry_at:=greatest(retry_at,(select min(reserved_at)+interval '1 day' from private.external_candidate_lookup_reservations where reserved_at>v_now-interval '1 day'));
   end if;
   update private.part_one_jobs set state='deferred_budget',next_eligible_at=retry_at,attempts=greatest(0,attempts-1),lease_token=null,lease_expires_at=null,updated_at=clock_timestamp() where id=j.id;
   return jsonb_build_object('deferred',true,'nextCheckAfter',retry_at,'reason','shared_quota_wait');
  end if;
  return jsonb_build_object('allowed',false);
 end if;
 if p_action='public/reserve' then
  reserved:=public.part_one_worker_before_public_runtime('reserve',p_payload-array['ownerId','policyVersion']);
  if coalesce((reserved->>'deferred')::boolean,false) or reserved->>'state' is distinct from 'reserved' then return reserved; end if;
 end if;
 -- Shared charge precedes HTTP; failed DNS remains conservatively charged.
 perform public.reserve_external_candidate_lookup(u);
 if p_action='public/reserve' then return reserved; end if;
 select * into policy from private.part_one_policies where id='open_facts';
 v_now:=clock_timestamp();
 allowed:=found and policy.version='derive-obf-public-content-v1'
  and p_payload->>'policyVersion'=policy.version
  and policy.lookup_allowed and policy.retain_allowed and policy.display_allowed
  and policy.expires_at>v_now and policy.expires_at<='2027-01-04T00:00:00Z'::timestamptz
  and policy.permission_evidence='https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/ ; ODbL database / DbCL contents; reviewed public identity and ingredient fields only';
 return jsonb_build_object('allowed',coalesce(allowed,false));
end $function$
;
