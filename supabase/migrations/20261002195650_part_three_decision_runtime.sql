-- Part 3 keeps personal authority separate from public truth and ingredient education.
create table private.part_three_release (
 id boolean primary key default true check(id), release_hash text, permitted boolean not null default false,
 epoch bigint not null default 0, withdrawn_hashes text[] not null default '{}',
 provider_enabled boolean not null default false, processing_approved boolean not null default false,
 tradeoff_utility_approved boolean not null default false, question_utility_approved boolean not null default false,
 configured_model text, processing_approval_id text, processing_fields text[] not null default '{}',
 token_budget_remaining bigint not null default 0 check(token_budget_remaining>=0),
 call_cap integer not null default 1 check(call_cap between 0 and 1), spend_cap_approved boolean not null default false, circuit_open boolean not null default true
);
insert into private.part_three_release(id) values(true);
alter table private.part_three_release enable row level security;
revoke all on private.part_three_release from public,anon,authenticated;
grant all on private.part_three_release to service_role;
create table private.part_three_external_grants (
 id text primary key, owner_id uuid references auth.users(id) on delete cascade,
 source_field_id text not null, purpose text not null check(purpose='optional_content_selection'),
 operation text not null check(operation='external_process'), approval_id text not null,
 permitted boolean not null default false, expires_at timestamptz not null,
 projection_version text not null check(projection_version='part-three-provider-projection/v1')
);
alter table private.part_three_external_grants enable row level security;
revoke all on private.part_three_external_grants from public,anon,authenticated;
grant all on private.part_three_external_grants to service_role;
create table private.part_three_encounters (
 owner_id uuid not null references auth.users(id) on delete cascade, id uuid not null,
 exposed_question_id text, skipped boolean not null default false, answered boolean not null default false,
 interacted boolean not null default false, provider_calls integer not null default 0,
 primary key(owner_id,id)
);
alter table private.part_three_encounters enable row level security;
revoke all on private.part_three_encounters from public,anon,authenticated;
grant all on private.part_three_encounters to service_role;
create table public.part_three_results (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 encounter_id uuid not null, scan_id uuid not null references private.part_one_scans(id) on delete cascade,
 capture_id uuid references private.part_one_captures(id) on delete cascade,
 request_id uuid not null, request jsonb not null, binding jsonb not null, binding_hash text not null,
 result_revision bigint not null default 1, state text not null default 'pending', payload jsonb,
 lease_token uuid, expires_at timestamptz not null, created_at timestamptz not null default now(),
 context_revision bigint not null, part_two_binding_key text not null, part_two_revision bigint not null,
 pinned_snapshot_id uuid references private.part_two_snapshots(id) on delete cascade,
 source_dependencies uuid[] not null default '{}', context_dependencies uuid[] not null default '{}',
 unique(owner_id,request_id), unique(owner_id,encounter_id,binding_hash)
);
create table public.part_three_saved_assessments (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, result_id uuid references public.part_three_results(id) on delete set null,
 packet jsonb, request jsonb, binding_hash text, result_revision bigint,
 pinned_snapshot_id uuid references private.part_two_snapshots(id) on delete set null,
 scan_id uuid references private.part_one_scans(id) on delete set null,
 saved_at timestamptz not null default now(), unique(owner_id,request_id)
);
create table private.part_three_provider_attempts (
 id uuid primary key default gen_random_uuid(), result_id uuid not null unique references public.part_three_results(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 planned_menu jsonb not null, candidate_set_hash text not null, configured_model text not null,
 grant_ids text[] not null, processing_approval_id text not null, actual_selection jsonb,
 created_at timestamptz not null default now()
);
alter table private.part_three_provider_attempts enable row level security;
revoke all on private.part_three_provider_attempts from public,anon,authenticated;
grant all on private.part_three_provider_attempts to service_role;

alter table public.part_three_results enable row level security;
alter table public.part_three_saved_assessments enable row level security;
revoke all on public.part_three_results,public.part_three_saved_assessments from public,anon,authenticated;
grant all on public.part_three_results,public.part_three_saved_assessments to service_role;

create function private.purge_part_three_context_dependents(p_owner uuid,p_revision_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 -- Conservatively purge all personal derived copies for this owner. Product/source
 -- truth is independently owned and remains outside this erasure operation.
 update public.part_three_saved_assessments set packet=null,request=null,binding_hash=null,result_revision=null where owner_id=p_owner;
 delete from public.part_three_results where owner_id=p_owner;
 update private.part_three_encounters set exposed_question_id=null,skipped=true,answered=false,interacted=true where owner_id=p_owner;
end $$;
revoke all on function private.purge_part_three_context_dependents(uuid,uuid[]) from public,anon,authenticated;
grant execute on function private.purge_part_three_context_dependents(uuid,uuid[]) to service_role;

create function private.part_three_owner(p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,191027));
 if p_owner is null or not exists(select 1 from public.profiles where id=p_owner and deletion_started_at is null) then raise exception 'PART_THREE_FORBIDDEN' using errcode='42501'; end if;
end $$;
revoke all on function private.part_three_owner(uuid) from public,anon,authenticated;

create function private.part_three_binding_current(p_owner uuid,b jsonb,p_pinned uuid default null,p_context_required boolean default true) returns boolean
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; cur private.part_two_current; rel private.part_three_release; body jsonb; head public.personal_context_heads; s private.part_two_snapshots;
begin
 perform private.part_three_owner(p_owner);
 if b->>'ownerId' is distinct from p_owner::text then return false; end if;
 select * into rel from private.part_three_release where id=true for share;
 if not rel.permitted or rel.release_hash=any(rel.withdrawn_hashes) or rel.release_hash is distinct from b->'releases'->>'releaseHash' or b->'releases'->>'policy' is distinct from 'earned-judgment-v1' then return false; end if;
 if p_context_required then
  select * into head from public.personal_context_heads where user_id=p_owner for share;
  if coalesce(head.revision,0) is distinct from (b->>'contextRevision')::bigint then return false; end if;
 end if;
 if p_pinned is not null then
  select * into s from private.part_two_snapshots where id=p_pinned and owner_id=p_owner;
  if not found then return false; end if;
  body:=private.part_two_project_withdrawals(p_pinned,p_owner);
  if body is null then return false; end if;
 else
  ctx:=private.part_two_context(p_owner,(b->>'scanId')::uuid,nullif(b->>'captureSessionId','')::uuid);
  select * into cur from private.part_two_current where binding_key=b->>'partTwoBindingKey' and owner_id=p_owner for share;
  if not found or cur.context_digest is distinct from ctx->>'contextDigest' or ctx->>'state' not in('pending','ready') then return false; end if;
  body:=cur.result;
 end if;
 if body is null or body->>'state'<>'ready' or (body->>'resultRevision')::bigint is distinct from (b->>'partTwoRevision')::bigint
  or body->>'bindingKey' is distinct from b->>'partTwoBindingKey'
  or (body->>'generation')::bigint is distinct from (b->>'partOneGeneration')::bigint
  or (body->>'evidenceRevision')::bigint is distinct from (b->>'partOneRevision')::bigint
  or body->'output'->'reading'->'dependencyManifest'->>'dependencyDigest' is distinct from b->>'sourceDigest'
  or body->'output'->'reading'->'dependencyManifest'->>'policyEpoch' is distinct from b->>'fieldPermissionEpoch'
  or (body->>'expiresAt')::timestamptz<=now() then return false; end if;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;
revoke all on function private.part_three_binding_current(uuid,jsonb,uuid,boolean) from public,anon,authenticated;

create function private.part_three_refinement_authorized(p_owner uuid,p_trace jsonb) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from private.part_three_provider_attempts a cross join private.part_three_release r where a.owner_id=p_owner and a.id::text=p_trace->>'callId' and r.id=true and r.provider_enabled and r.processing_approved and r.spend_cap_approved and not r.circuit_open and r.configured_model=a.configured_model and r.processing_approval_id=a.processing_approval_id
 and not exists(select 1 from jsonb_array_elements(a.planned_menu->'jobs') j where (j->>'id'='prioritize_tradeoff' and not r.tradeoff_utility_approved) or (j->>'id'='select_question' and not r.question_utility_approved))
 and not exists(select 1 from unnest(a.grant_ids) required where not exists(select 1 from private.part_three_external_grants g where g.id=required and g.permitted and g.expires_at>now() and g.approval_id=a.processing_approval_id and (g.owner_id is null or g.owner_id=p_owner))));
$$;
revoke all on function private.part_three_refinement_authorized(uuid,jsonb) from public,anon,authenticated;

create function private.part_three_baseline_packet(p_packet jsonb,p_revision bigint,p_suppressed boolean) returns jsonb language plpgsql immutable set search_path='' as $$
declare body jsonb:=p_packet;
begin
 body:=jsonb_set(body,'{selectedTradeoffId}',coalesce(body->'refinementTrace'->'baselineTradeoffId','null'::jsonb));
 body:=jsonb_set(body,'{question}',case when p_suppressed then 'null'::jsonb else coalesce(body->'refinementTrace'->'originalQuestion','null'::jsonb) end);
 body:=jsonb_set(body,'{refinementTrace}','null'::jsonb);body:=jsonb_set(body,'{binding,refinement}','null'::jsonb);
 body:=jsonb_set(body,'{refinementStatus}','"off"'::jsonb);body:=jsonb_set(body,'{resultRevision}',to_jsonb(p_revision));
 return body;
end $$;
revoke all on function private.part_three_baseline_packet(jsonb,bigint,boolean) from public,anon,authenticated;

create function public.part_three_worker(p_owner uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.part_three_results; saved public.part_three_saved_assessments; rel private.part_three_release; b jsonb; digest text; token uuid; packet jsonb; pinned uuid; enc private.part_three_encounters; snap private.part_two_snapshots; attempt private.part_three_provider_attempts; menu jsonb; v_grant_ids text[]; sanitized_saved_packet jsonb;
begin
 if p_action='release/register' then
  if p_payload->>'releaseHash' !~ '^[a-f0-9]{64}$' or p_payload->>'localFixture' is distinct from 'true' then raise exception 'PART_THREE_INVALID_RELEASE'; end if;
  update private.part_three_release set release_hash=p_payload->>'releaseHash',permitted=true,epoch=epoch+1 where id=true and not (p_payload->>'releaseHash'=any(withdrawn_hashes));
  return jsonb_build_object('registered',true);
 elsif p_action='release/withdraw' then
  perform pg_catalog.pg_advisory_xact_lock(40203);perform pg_catalog.pg_advisory_xact_lock(40204);
  update private.part_three_release set withdrawn_hashes=array_append(withdrawn_hashes,p_payload->>'releaseHash'),permitted=false,provider_enabled=false,epoch=epoch+1 where id=true;
  update public.part_three_saved_assessments set packet=null,request=null,binding_hash=null,result_revision=null;
  delete from public.part_three_results;
  return jsonb_build_object('withdrawn',true);
 end if;
 perform private.part_three_owner(p_owner);
 select * into rel from private.part_three_release where id=true for update;
 if p_action='cancel_encounter' then
  insert into private.part_three_encounters(owner_id,id,interacted) values(p_owner,(p_payload->>'encounterId')::uuid,true) on conflict(owner_id,id) do update set interacted=true;
  update public.part_three_results set lease_token=null where owner_id=p_owner and encounter_id=(p_payload->>'encounterId')::uuid;
  delete from public.part_three_results where owner_id=p_owner and encounter_id=(p_payload->>'encounterId')::uuid and state='pending';
  return jsonb_build_object('kind','acknowledged');
 elsif p_action='encounter/read' then
  select * into enc from private.part_three_encounters where owner_id=p_owner and id=(p_payload->>'encounterId')::uuid;
  return jsonb_build_object('exposedQuestionId',enc.exposed_question_id,'skip',coalesce(enc.skipped,false),'answered',coalesce(enc.answered,false),'interacted',coalesce(enc.interacted,false),'providerCalls',coalesce(enc.provider_calls,0));
 elsif p_action='list_saved' then
  return jsonb_build_object('kind','saved_list','items',coalesce((select jsonb_agg(x.body order by x.saved_at desc) from (select saved_at,jsonb_build_object('savedAssessmentId',id,'scanId',scan_id,'savedAt',private.part_one_utc(saved_at)) body from public.part_three_saved_assessments where owner_id=p_owner order by saved_at desc limit 100) x),'[]'::jsonb));
 elsif p_action='provider/gate' then
  if not rel.permitted or not rel.provider_enabled or not rel.processing_approved or not rel.spend_cap_approved or rel.circuit_open or rel.configured_model is distinct from 'jev-1.13.0' then return jsonb_build_object('allowed',false); end if;
  select * into row from public.part_three_results where owner_id=p_owner and id=(p_payload->>'resultId')::uuid for update;
  if not found or (row.state<>'pending' and (row.state<>'ready' or row.lease_token is null)) or row.encounter_id is distinct from (p_payload->>'encounterId')::uuid or row.expires_at<=now() or not private.part_three_binding_current(p_owner,row.binding,row.pinned_snapshot_id) then return jsonb_build_object('allowed',false); end if;
  menu:=p_payload->'menu';
  if menu->>'candidateSetHash' is distinct from encode(extensions.digest(private.part_one_canonical_json(menu-'candidateSetHash'),'sha256'),'hex') or jsonb_array_length(menu->'jobs') not between 1 and 2 then return jsonb_build_object('allowed',false); end if;
  select * into enc from private.part_three_encounters where owner_id=p_owner and id=(p_payload->>'encounterId')::uuid for update;
  if not found or enc.provider_calls>=rel.call_cap or enc.interacted or enc.exposed_question_id is not null or rel.token_budget_remaining<34768 then return jsonb_build_object('allowed',false); end if;
  if exists(select 1 from jsonb_array_elements_text(p_payload->'fieldIds') f where not f=any(rel.processing_fields)) then return jsonb_build_object('allowed',false); end if;
  -- Each menu description and transmitted derivation needs its own exact grant.
  -- A display or export grant is deliberately insufficient.
  if exists(select 1 from (select value field_id from jsonb_array_elements_text(p_payload->'sourceFieldIds') union select value from jsonb_array_elements_text(p_payload->'menuSourceFields') union select 'context:'||value from jsonb_array_elements_text(p_payload->'menuContextRefs')) fields
    where not exists(select 1 from private.part_three_external_grants g where g.source_field_id=fields.field_id and (g.owner_id is null or g.owner_id=p_owner) and g.permitted and g.expires_at>now() and g.approval_id=rel.processing_approval_id)) then return jsonb_build_object('allowed',false); end if;
  if (p_payload->'jobs' ? 'prioritize_tradeoff' and not rel.tradeoff_utility_approved) or (p_payload->'jobs' ? 'select_question' and not rel.question_utility_approved) then return jsonb_build_object('allowed',false); end if;
  select array_agg(distinct g.id order by g.id) into v_grant_ids from private.part_three_external_grants g where g.source_field_id in(select value from jsonb_array_elements_text(p_payload->'sourceFieldIds') union select value from jsonb_array_elements_text(p_payload->'menuSourceFields') union select 'context:'||value from jsonb_array_elements_text(p_payload->'menuContextRefs')) and (g.owner_id is null or g.owner_id=p_owner) and g.permitted and g.expires_at>now() and g.approval_id=rel.processing_approval_id;
  insert into private.part_three_provider_attempts(result_id,owner_id,planned_menu,candidate_set_hash,configured_model,grant_ids,processing_approval_id) values(row.id,p_owner,menu,menu->>'candidateSetHash',rel.configured_model,v_grant_ids,rel.processing_approval_id) returning * into attempt;
  update private.part_three_encounters set provider_calls=provider_calls+1 where owner_id=p_owner and id=enc.id;
  update private.part_three_release set token_budget_remaining=token_budget_remaining-34768 where id=true;
  return jsonb_build_object('allowed',true,'callId',attempt.id,'model',rel.configured_model,'approvalId',rel.processing_approval_id,'grants',(select jsonb_agg(g.id order by g.id) from private.part_three_external_grants g where g.source_field_id in(select value from jsonb_array_elements_text(p_payload->'sourceFieldIds')) and (g.owner_id is null or g.owner_id=p_owner) and g.permitted and g.expires_at>now() and g.approval_id=rel.processing_approval_id));
 elsif p_action='prepare' then
  b:=p_payload->'binding';pinned:=nullif(p_payload->>'pinnedSnapshotId','')::uuid;
  if not private.part_three_binding_current(p_owner,b,pinned) then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
  digest:=encode(extensions.digest(private.part_one_canonical_json(b),'sha256'),'hex');
  select * into row from public.part_three_results where owner_id=p_owner and request_id=(p_payload->'request'->>'requestId')::uuid;
  if found and row.request is distinct from p_payload->'request' then raise exception 'PART_THREE_IDEMPOTENCY_CONFLICT'; end if;
  if not found then select * into row from public.part_three_results where owner_id=p_owner and encounter_id=(b->>'encounterId')::uuid and binding_hash=digest; end if;
  if found and row.expires_at>now() and row.state='ready' then
  if row.payload->'refinementTrace' is not null and row.payload->'refinementTrace'<>'null'::jsonb and not private.part_three_refinement_authorized(p_owner,row.payload->'refinementTrace') then
   select * into enc from private.part_three_encounters where owner_id=p_owner and id=row.encounter_id;
   packet:=private.part_three_baseline_packet(row.payload,row.result_revision+1,enc.exposed_question_id is not null or coalesce(enc.skipped,false) or coalesce(enc.answered,false));
   update public.part_three_results set payload=packet,binding=packet->'binding',binding_hash=encode(extensions.digest(private.part_one_canonical_json(packet->'binding'),'sha256'),'hex'),result_revision=result_revision+1 where id=row.id returning * into row;
  end if;
   return jsonb_build_object('cached',row.payload,'replayed',true); end if;
  if found and row.state='pending' and row.expires_at>now() then return jsonb_build_object('pending',true,'resultId',row.id); end if;
  token:=gen_random_uuid();
  if row.id is null then
   insert into public.part_three_results(owner_id,encounter_id,scan_id,capture_id,request_id,request,binding,binding_hash,lease_token,expires_at,context_revision,part_two_binding_key,part_two_revision,pinned_snapshot_id,source_dependencies,context_dependencies)
   values(p_owner,(b->>'encounterId')::uuid,(b->>'scanId')::uuid,nullif(b->>'captureSessionId','')::uuid,(p_payload->'request'->>'requestId')::uuid,p_payload->'request',b,digest,token,(p_payload->>'validUntil')::timestamptz,(b->>'contextRevision')::bigint,b->>'partTwoBindingKey',(b->>'partTwoRevision')::bigint,pinned,
    coalesce((select dependencies from private.part_two_snapshots where owner_id=p_owner and binding_key=b->>'partTwoBindingKey' and result_revision=(b->>'partTwoRevision')::bigint order by created_at desc limit 1),'{}'::uuid[]),
    array(select distinct value::uuid from jsonb_array_elements_text(p_payload->'contextRefs')))
   returning * into row;
  else update public.part_three_results set state='pending',payload=null,result_revision=result_revision+1,lease_token=token,expires_at=(p_payload->>'validUntil')::timestamptz where id=row.id returning * into row; end if;
  insert into private.part_three_encounters(owner_id,id) values(p_owner,(b->>'encounterId')::uuid) on conflict do nothing;
  return jsonb_build_object('resultId',row.id,'resultRevision',row.result_revision+1,'leaseToken',token,'bindingHash',digest);
 elsif p_action='refinement/prepare' then
  select * into row from public.part_three_results where owner_id=p_owner and id=(p_payload->>'resultId')::uuid for update;
  if not found or row.state<>'ready' or row.lease_token is not null or row.expires_at<=now() or row.result_revision<>(p_payload->>'expectedResultRevision')::bigint or row.binding_hash is distinct from p_payload->>'expectedBindingHash' or not private.part_three_binding_current(p_owner,row.binding,row.pinned_snapshot_id) then return jsonb_build_object('allowed',false); end if;
  select * into enc from private.part_three_encounters where owner_id=p_owner and id=row.encounter_id;
  if not rel.provider_enabled or rel.circuit_open or enc.interacted or enc.exposed_question_id is not null or enc.provider_calls>=rel.call_cap then return jsonb_build_object('allowed',false); end if;
  token:=gen_random_uuid();update public.part_three_results set lease_token=token where id=row.id;
  return jsonb_build_object('resultId',row.id,'resultRevision',row.result_revision+1,'leaseToken',token);
 elsif p_action='publish' then
  select * into row from public.part_three_results where id=(p_payload->>'resultId')::uuid and owner_id=p_owner for update;
  if not found or row.lease_token is distinct from (p_payload->>'leaseToken')::uuid or not private.part_three_binding_current(p_owner,row.binding,row.pinned_snapshot_id) then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
  packet:=p_payload->'result';
  if (packet->'binding')-'refinement' is distinct from row.binding-'refinement' or packet->>'resultId' is distinct from row.id::text or (packet->>'resultRevision')::bigint<>row.result_revision+1 or packet->>'schemaVersion'<>'personal-result/v2' or (packet->>'validUntil')::timestamptz>row.expires_at or (packet->>'validUntil')::timestamptz<=now() then raise exception 'PART_THREE_INVALID_PUBLICATION'; end if;
  if packet->'refinementTrace' is not null and packet->'refinementTrace'<>'null'::jsonb then
   select a.* into attempt from private.part_three_provider_attempts a where a.id=(packet->'refinementTrace'->>'callId')::uuid and a.result_id=row.id and a.owner_id=p_owner;
   if not found or not rel.provider_enabled or not rel.processing_approved or not rel.spend_cap_approved or rel.circuit_open or rel.configured_model is distinct from attempt.configured_model or exists(select 1 from jsonb_array_elements(attempt.planned_menu->'jobs') j where (j->>'id'='prioritize_tradeoff' and not rel.tradeoff_utility_approved) or (j->>'id'='select_question' and not rel.question_utility_approved)) or attempt.processing_approval_id is distinct from rel.processing_approval_id or exists(select 1 from unnest(attempt.grant_ids) required where not exists(select 1 from private.part_three_external_grants g where g.id=required and g.permitted and g.expires_at>now())) then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
   if packet->'refinementTrace'->'menu' is distinct from attempt.planned_menu or packet->'binding'->'refinement'->>'candidateSetHash' is distinct from attempt.candidate_set_hash or packet->'binding'->'refinement'->>'configuredModel' is distinct from attempt.configured_model or packet->'binding'->'refinement'->>'projectionVersion' is distinct from 'part-three-provider-projection/v1' or packet->'binding'->'refinement'->>'promptVersion' is distinct from 'jev-choice-v1' or packet->'binding'->'refinement'->>'adapterVersion' is distinct from 'jev-http-v1' or (packet->'binding'->'refinement'->>'resolvedModel' is not null and packet->'binding'->'refinement'->>'resolvedModel' is distinct from attempt.configured_model) then raise exception 'PART_THREE_INVALID_REFINEMENT'; end if;
   update private.part_three_provider_attempts set actual_selection=packet->'refinementTrace'->'selection' where id=attempt.id;
  elsif packet->'binding'->'refinement'<>'null'::jsonb or packet->>'refinementStatus'<>'off' then raise exception 'PART_THREE_INVALID_REFINEMENT'; end if;
  if exists(select 1 from jsonb_object_keys(packet) k where k not in('schemaVersion','resultId','resultRevision','generation','state','binding','evaluatedAt','validUntil','summary','findings','materialGaps','question','refinementStatus','selectedTradeoffId','refinementTrace','ruleResults')) then raise exception 'PART_THREE_INVALID_PUBLICATION'; end if;
  update public.part_three_results set binding=packet->'binding',binding_hash=encode(extensions.digest(private.part_one_canonical_json(packet->'binding'),'sha256'),'hex'),state=packet->>'state',payload=packet,result_revision=result_revision+1,lease_token=null where id=row.id;
  return jsonb_build_object('kind','result','result',packet,'replayed',false);
 elsif p_action='read' then
  select * into row from public.part_three_results where id=(p_payload->>'resultId')::uuid and owner_id=p_owner for update;
  if not found then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
  if row.expires_at<=now() or not private.part_three_binding_current(p_owner,row.binding,row.pinned_snapshot_id) then
   -- A current-result lease ending is not erasure of an independently retained,
   -- source-reauthorized historical snapshot. Context erasure has its own hook.
   if not private.part_three_binding_current(p_owner,row.binding,row.pinned_snapshot_id,false) then
    update public.part_three_saved_assessments set packet=null,binding_hash=null,result_revision=null where result_id=row.id;
   end if;
   delete from public.part_three_results where id=row.id;
   return jsonb_build_object('kind','unavailable','reason','changed_basis');
  end if;
  if row.payload->'refinementTrace' is not null and row.payload->'refinementTrace'<>'null'::jsonb and not private.part_three_refinement_authorized(p_owner,row.payload->'refinementTrace') then
   select * into enc from private.part_three_encounters where owner_id=p_owner and id=row.encounter_id;
   packet:=private.part_three_baseline_packet(row.payload,row.result_revision+1,enc.exposed_question_id is not null or coalesce(enc.skipped,false) or coalesce(enc.answered,false));
   update public.part_three_results set payload=packet,binding=packet->'binding',binding_hash=encode(extensions.digest(private.part_one_canonical_json(packet->'binding'),'sha256'),'hex'),result_revision=result_revision+1 where id=row.id returning * into row;
  end if;
  if row.payload is null then return jsonb_build_object('kind','unavailable','reason','evidence_unavailable'); end if;
  return jsonb_build_object('kind','result','result',row.payload,'replayed',true);
 elsif p_action='save' then
  select * into row from public.part_three_results where id=(p_payload->>'resultId')::uuid and owner_id=p_owner for update;
  if not found or row.state<>'ready' or row.expires_at<=now() or row.result_revision<>(p_payload->>'expectedResultRevision')::bigint or row.binding_hash is distinct from p_payload->>'expectedBindingHash' or not private.part_three_binding_current(p_owner,row.binding,row.pinned_snapshot_id) then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
  if row.payload->'refinementTrace' is not null and row.payload->'refinementTrace'<>'null'::jsonb and not private.part_three_refinement_authorized(p_owner,row.payload->'refinementTrace') then
   select * into enc from private.part_three_encounters where owner_id=p_owner and id=row.encounter_id;
   packet:=private.part_three_baseline_packet(row.payload,row.result_revision+1,enc.exposed_question_id is not null or coalesce(enc.skipped,false) or coalesce(enc.answered,false));
   update public.part_three_results set payload=packet,binding=packet->'binding',binding_hash=encode(extensions.digest(private.part_one_canonical_json(packet->'binding'),'sha256'),'hex'),result_revision=result_revision+1,lease_token=null where id=row.id;
   return jsonb_build_object('kind','unavailable','reason','changed_basis');
  end if;
  select * into saved from public.part_three_saved_assessments where owner_id=p_owner and request_id=(p_payload->>'requestId')::uuid;
  if found then
   if saved.result_id is distinct from row.id or saved.binding_hash is distinct from row.binding_hash or saved.result_revision is distinct from row.result_revision then raise exception 'PART_THREE_IDEMPOTENCY_CONFLICT'; end if;
   return jsonb_build_object('kind','saved','savedAssessmentId',saved.id,'resultRevision',saved.result_revision,'replayed',true);
  end if;
  if row.pinned_snapshot_id is null then select * into snap from private.part_two_snapshots where binding_key=row.part_two_binding_key and result_revision=row.part_two_revision and owner_id=p_owner; else select * into snap from private.part_two_snapshots where id=row.pinned_snapshot_id and owner_id=p_owner; end if;
  if snap.id is null then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
  insert into public.part_three_saved_assessments(owner_id,request_id,result_id,packet,request,binding_hash,result_revision,pinned_snapshot_id,scan_id) values(p_owner,(p_payload->>'requestId')::uuid,row.id,row.payload,row.request,row.binding_hash,row.result_revision,snap.id,row.scan_id) returning * into saved;
  return jsonb_build_object('kind','saved','savedAssessmentId',saved.id,'resultRevision',saved.result_revision,'replayed',false);
 elsif p_action in('read_saved','saved/input') then
  select * into saved from public.part_three_saved_assessments where id=(p_payload->>'savedAssessmentId')::uuid and owner_id=p_owner for update;
  if not found then raise exception 'PART_THREE_FORBIDDEN' using errcode='42501'; end if;
  if saved.packet is not null and not private.part_three_binding_current(p_owner,saved.packet->'binding',saved.pinned_snapshot_id,false) then update public.part_three_saved_assessments set packet=null,binding_hash=null,result_revision=null where id=saved.id;saved.packet:=null; end if;
  if saved.packet->'refinementTrace' is not null and saved.packet->'refinementTrace'<>'null'::jsonb and not private.part_three_refinement_authorized(p_owner,saved.packet->'refinementTrace') then
   sanitized_saved_packet:=private.part_three_baseline_packet(saved.packet,(saved.packet->>'resultRevision')::bigint+1,true);
   update public.part_three_saved_assessments set packet=sanitized_saved_packet,binding_hash=encode(extensions.digest(private.part_one_canonical_json(sanitized_saved_packet->'binding'),'sha256'),'hex'),result_revision=(sanitized_saved_packet->>'resultRevision')::bigint where id=saved.id returning * into saved;
  end if;
  if p_action='saved/input' then
   if saved.pinned_snapshot_id is null then return jsonb_build_object('kind','unavailable','reason','historical_only'); end if;
   packet:=private.part_two_project_withdrawals(saved.pinned_snapshot_id,p_owner);
   select sa.* into saved from public.part_three_saved_assessments sa where sa.id=(p_payload->>'savedAssessmentId')::uuid and sa.owner_id=p_owner;
   return jsonb_build_object('partTwo',packet,'pinnedSnapshotId',saved.pinned_snapshot_id,'request',saved.request);
  end if;
  return jsonb_build_object('kind','historical','savedAssessmentId',saved.id,'savedAt',private.part_one_utc(saved.saved_at),'assessmentWhenSaved',saved.packet,'currentAssessment','unavailable');
 elsif p_action='question_event' then
  select * into row from public.part_three_results where id=(p_payload->>'resultId')::uuid and owner_id=p_owner;
  if not found or row.encounter_id<>(p_payload->>'encounterId')::uuid or row.expires_at<=now() or not private.part_three_binding_current(p_owner,row.binding,row.pinned_snapshot_id) then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
  select * into enc from private.part_three_encounters where owner_id=p_owner and id=row.encounter_id for update;
  -- Client exposure/touch records its actually displayed revision. A refinement
  -- published just before that event cannot become a late moving target.
  if row.payload->'refinementTrace' is not null and row.payload->'refinementTrace'<>'null'::jsonb and nullif(p_payload->>'expectedResultRevision','')::bigint<row.result_revision then
   packet:=private.part_three_baseline_packet(row.payload,row.result_revision+1,enc.exposed_question_id is not null or coalesce(enc.skipped,false) or coalesce(enc.answered,false));
   update public.part_three_results set payload=packet,binding=packet->'binding',binding_hash=encode(extensions.digest(private.part_one_canonical_json(packet->'binding'),'sha256'),'hex'),result_revision=result_revision+1,lease_token=null where id=row.id returning * into row;
  end if;
  if p_payload->>'event'='interact' then update private.part_three_encounters set interacted=true where owner_id=p_owner and id=row.encounter_id;
  elsif row.payload->'question'->>'id' is distinct from p_payload->>'questionId' and enc.exposed_question_id is distinct from p_payload->>'questionId' then raise exception 'PART_THREE_INVALID_QUESTION';
  else
   update private.part_three_encounters set exposed_question_id=coalesce(exposed_question_id,p_payload->>'questionId'),skipped=skipped or p_payload->>'event'='skip',answered=answered or p_payload->>'event'='answer',interacted=interacted or p_payload->>'event' in('skip','answer') where owner_id=p_owner and id=row.encounter_id;
  end if;
  return jsonb_build_object('kind','acknowledged');
 end if;
 raise exception 'PART_THREE_INVALID_ACTION';
end $$;
revoke all on function public.part_three_worker(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.part_three_worker(uuid,text,jsonb) to service_role;

-- Remove original derived bytes at source withdrawal. Current requests recompute
-- from remaining separately permitted Part2 facts; unsafe saved history is purged.
-- User-authored encounter choices are independent context, so source withdrawal
-- retains them for pinned safe reassessment. Context erasure still clears them.
create function private.part_three_source_erasure() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.part_three_saved_assessments set packet=null,binding_hash=null,result_revision=null where result_id in(select id from public.part_three_results where new.record_id=any(source_dependencies));
 delete from public.part_three_results where new.record_id=any(source_dependencies);
 return new;
end $$;
create trigger part_three_source_erasure after insert or update on private.part_one_record_status for each row when(new.status<>'active') execute function private.part_three_source_erasure();
revoke all on function private.part_three_source_erasure() from public,anon,authenticated;
create function private.part_three_field_erasure() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.label_assertion_epoch is distinct from old.label_assertion_epoch or new.display_allowed is distinct from old.display_allowed or new.retain_allowed is distinct from old.retain_allowed then
  update public.part_three_saved_assessments set packet=null,binding_hash=null,result_revision=null where result_id in(select r.id from public.part_three_results r where exists(select 1 from private.part_one_records s where s.id=any(r.source_dependencies) and s.policy_id=new.id));
  delete from public.part_three_results r where exists(select 1 from private.part_one_records s where s.id=any(r.source_dependencies) and s.policy_id=new.id);
 end if;return new;
end $$;
create trigger part_three_field_erasure after update on private.part_one_policies for each row execute function private.part_three_field_erasure();
revoke all on function private.part_three_field_erasure() from public,anon,authenticated;

create function private.part_three_original_erasure() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.part_three_saved_assessments set packet=null,binding_hash=null,result_revision=null where result_id in(select id from public.part_three_results where old.id=any(source_dependencies));
 delete from public.part_three_results where old.id=any(source_dependencies);
 return old;
end $$;
create trigger part_three_original_erasure before delete on private.part_one_records for each row execute function private.part_three_original_erasure();
revoke all on function private.part_three_original_erasure() from public,anon,authenticated;

create function private.part_three_snapshot_erasure() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.part_three_saved_assessments set packet=null,binding_hash=null,result_revision=null where pinned_snapshot_id=old.id or result_id in(select id from public.part_three_results where pinned_snapshot_id=old.id);
 return old;
end $$;
create trigger part_three_snapshot_erasure before delete on private.part_two_snapshots for each row execute function private.part_three_snapshot_erasure();
revoke all on function private.part_three_snapshot_erasure() from public,anon,authenticated;

-- Part2 withdrawal creates an authorized immutable projection before erasing its
-- unsafe predecessor. Move the independently owned saved-assessment basis in
-- that same transaction; never retain the old personal packet or derived hash.
create function private.part_three_snapshot_projection() returns trigger
language plpgsql security definer set search_path='' as $$
declare predecessor uuid;
begin
 if new.lineage->>'projectionOf' is null then return new; end if;
 predecessor:=(new.lineage->>'projectionOf')::uuid;
 if not exists(select 1 from private.part_two_snapshots predecessor_row where predecessor_row.id=predecessor and predecessor_row.owner_id=new.owner_id and predecessor_row.binding_key=new.binding_key and predecessor_row.result_revision<new.result_revision and predecessor_row.dependencies=new.dependencies) then return new; end if;
 update public.part_three_saved_assessments set pinned_snapshot_id=new.id,packet=null,binding_hash=null,result_revision=null where owner_id=new.owner_id and pinned_snapshot_id=predecessor;
 return new;
end $$;
create trigger part_three_snapshot_projection after insert on private.part_two_snapshots for each row execute function private.part_three_snapshot_projection();
revoke all on function private.part_three_snapshot_projection() from public,anon,authenticated;
