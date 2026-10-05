-- Additive local Part 4 foundation gate. Permission stays off until local fixture
-- admission; no hosted activation or provider/source permissions are changed.
create table private.part_four_release (
 id boolean primary key default true check(id), release_id text not null,
 release_hash text not null, knowledge_version text not null, knowledge_hash text not null,
 permitted boolean not null default false, withdrawn_hashes text[] not null default '{}'
);
alter table private.part_four_release enable row level security;
revoke all on private.part_four_release from public,anon,authenticated;
grant all on private.part_four_release to service_role;
insert into private.part_four_release(id,release_id,release_hash,knowledge_version,knowledge_hash) values(true,'part-four-foundations/v1','b21980e7e398c5873a68c4ab7922ec49c459dd8f8c21dbcc961697e3944b5ea3','approved-37-v7/editorial-v1','7d87dfb01c6039e26617802f36dbf6476992d6e6e7623d470aab7ed07b69715b');

-- Preserve P3 authorization/lifecycle function; add only the optional P4 release gate.
create or replace function private.part_three_binding_current(p_owner uuid,b jsonb,p_pinned uuid default null,p_context_required boolean default true) returns boolean
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; cur private.part_two_current; rel private.part_three_release; p4 private.part_four_release; body jsonb; head public.personal_context_heads; s private.part_two_snapshots;
begin
 perform private.part_three_owner(p_owner);
 if b->>'ownerId' is distinct from p_owner::text then return false; end if;
 select * into rel from private.part_three_release where id=true for share;
 -- Shared authority lock uses the inherited P3 -> P4 lock order. A withdrawal
 -- UPDATE on this row cannot commit ahead of this transaction's publication/Save.
 if b->'releases'->'partFour' is not null then
  select * into p4 from private.part_four_release where id=true for share;
  if not found or not p4.permitted or p4.release_hash=any(p4.withdrawn_hashes)
   or b->'releases'->'partFour' is distinct from jsonb_build_object('releaseId',p4.release_id,'releaseHash',p4.release_hash,'knowledgeVersion',p4.knowledge_version,'knowledgeHash',p4.knowledge_hash)
   then return false; end if;
 end if;
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
 if b->'subject'->>'kind'='declaration' and jsonb_build_object('productId',b->'subject'->'productId','variantId',b->'subject'->'variantId','formulaVersionId',b->'subject'->'formulaVersionId') is distinct from coalesce(private.part_three_catalog_reference(p_owner,(b->'subject'->>'snapshotId')::uuid),jsonb_build_object('productId',null,'variantId',null,'formulaVersionId',null)) then return false; end if;
 return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;

-- Preserve one P3 transactional writer, idempotency and erasure paths.
-- Adds P4 publication binding checks and full-visible-packet hash checks.
create or replace function public.part_three_worker(p_owner uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.part_three_results; saved public.part_three_saved_assessments; rel private.part_three_release; b jsonb; digest text; token uuid; packet jsonb; pinned uuid; enc private.part_three_encounters; snap private.part_two_snapshots; attempt private.part_three_provider_attempts; menu jsonb; v_grant_ids text[]; sanitized_saved_packet jsonb; identity_record private.part_one_records; identity_body jsonb; scan private.part_one_scans;
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
 if p_action='identity/resolve' then
  if nullif(p_payload->>'pinnedSnapshotId','') is not null then
   identity_body:=private.part_two_project_withdrawals((p_payload->>'pinnedSnapshotId')::uuid,p_owner);
   if identity_body is null or identity_body->>'scanId' is distinct from p_payload->>'scanId' or identity_body->>'generation' is distinct from p_payload->>'generation' or identity_body->>'evidenceRevision' is distinct from p_payload->>'revision' or identity_body->'output'->'productFacts'->'binding'->>'snapshotId' is distinct from p_payload->>'snapshotId' then return null; end if;
  else
   select * into scan from private.part_one_scans where id=(p_payload->>'scanId')::uuid and owner_id=p_owner;
   if not found or scan.generation is distinct from (p_payload->>'generation')::bigint or scan.result_revision is distinct from (p_payload->>'revision')::bigint then return null; end if;
   identity_body:=private.part_one_filter_result(scan.result,p_owner);
   if identity_body->>'snapshotId' is distinct from p_payload->>'snapshotId' then return null; end if;
  end if;
  select * into identity_record from private.part_one_records where id=nullif(p_payload->>'snapshotId','')::uuid and kind='snapshot';
  if not found or not private.part_one_snapshot_identity_allowed(identity_record.id,p_owner) then return null; end if;
  return jsonb_build_object('name',identity_record.payload->>'name','expiresAt',private.part_one_utc(private.part_one_identity_expiry(identity_record.id)),'catalogReference',private.part_three_catalog_reference(p_owner,identity_record.id));
 elsif p_action='cancel_encounter' then
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
  -- An idempotency key never replays or rebinds a different authority generation.
  if found and ((row.binding-'refinement') is distinct from (b-'refinement') or row.pinned_snapshot_id is distinct from pinned or not private.part_three_binding_current(p_owner,row.binding,row.pinned_snapshot_id)) then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
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
  -- Publication and encounter events share the owner fence. A touch/exposure
  -- committed after the handler's last read cannot apply a late selection.
  select * into enc from private.part_three_encounters where owner_id=p_owner and id=row.encounter_id for update;
  if packet->'refinementTrace' is not null and packet->'refinementTrace'<>'null'::jsonb and (enc.interacted or enc.exposed_question_id is not null or enc.skipped or enc.answered) then
   if row.payload is not null then
    update public.part_three_results set lease_token=null where id=row.id;
    return jsonb_build_object('kind','result','result',row.payload,'replayed',true);
   end if;
   packet:=private.part_three_baseline_packet(packet,(packet->>'resultRevision')::bigint,coalesce(enc.skipped,false) or coalesce(enc.answered,false));
  end if;
  if packet->'refinementTrace' is not null and packet->'refinementTrace'<>'null'::jsonb then
   select a.* into attempt from private.part_three_provider_attempts a where a.id=(packet->'refinementTrace'->>'callId')::uuid and a.result_id=row.id and a.owner_id=p_owner;
   if not found or not rel.provider_enabled or not rel.processing_approved or not rel.spend_cap_approved or rel.circuit_open or rel.configured_model is distinct from attempt.configured_model or exists(select 1 from jsonb_array_elements(attempt.planned_menu->'jobs') j where (j->>'id'='prioritize_tradeoff' and not rel.tradeoff_utility_approved) or (j->>'id'='select_question' and not rel.question_utility_approved)) or attempt.processing_approval_id is distinct from rel.processing_approval_id or exists(select 1 from unnest(attempt.grant_ids) required where not exists(select 1 from private.part_three_external_grants g where g.id=required and g.permitted and g.expires_at>now())) then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
   if packet->'refinementTrace'->'menu' is distinct from attempt.planned_menu or packet->'binding'->'refinement'->>'candidateSetHash' is distinct from attempt.candidate_set_hash or packet->'binding'->'refinement'->>'configuredModel' is distinct from attempt.configured_model or packet->'binding'->'refinement'->>'projectionVersion' is distinct from 'part-three-provider-projection/v1' or packet->'binding'->'refinement'->>'promptVersion' is distinct from 'jev-choice-v1' or packet->'binding'->'refinement'->>'adapterVersion' is distinct from 'jev-http-v1' or (packet->'binding'->'refinement'->>'resolvedModel' is not null and packet->'binding'->'refinement'->>'resolvedModel' is distinct from attempt.configured_model) then raise exception 'PART_THREE_INVALID_REFINEMENT'; end if;
   update private.part_three_provider_attempts set actual_selection=packet->'refinementTrace'->'selection' where id=attempt.id;
  elsif packet->'binding'->'refinement'<>'null'::jsonb or packet->>'refinementStatus'<>'off' then raise exception 'PART_THREE_INVALID_REFINEMENT'; end if;
  if packet->'binding'->'releases'->'partFour' is not null then
   if jsonb_typeof(packet->'partFour') is distinct from 'object'
    or packet->'partFour'->>'version' is distinct from 'part-four-foundations/v1'
    or packet->'partFour'->>'releaseId' is distinct from packet->'binding'->'releases'->'partFour'->>'releaseId'
    or packet->'partFour'->'formula'->>'knowledgeHash' is distinct from packet->'binding'->'releases'->'partFour'->>'knowledgeHash'
    or packet->'partFour'->'formula'->>'knowledgeVersion' is distinct from packet->'binding'->'releases'->'partFour'->>'knowledgeVersion'
    or packet->'partFour'->'formula'->>'partTwoBindingKey' is distinct from packet->'binding'->>'partTwoBindingKey'
    or packet->'partFour'->'formula'->>'partTwoRevision' is distinct from packet->'binding'->>'partTwoRevision'
    or packet->'partFour'->'formula'->>'dependencyDigest' is distinct from packet->'binding'->>'sourceDigest'
    or packet->'partFour'->>'contextRevision' is distinct from packet->'binding'->>'contextRevision'
   then raise exception 'PART_FOUR_INVALID_PUBLICATION'; end if;
  elsif packet->'partFour' is not null then raise exception 'PART_FOUR_UNBOUND_PUBLICATION'; end if;
  if exists(select 1 from jsonb_object_keys(packet) k where k not in('schemaVersion','resultId','resultRevision','generation','state','binding','evaluatedAt','validUntil','summary','findings','materialGaps','question','refinementStatus','selectedTradeoffId','refinementTrace','ruleResults','partFour')) then raise exception 'PART_THREE_INVALID_PUBLICATION'; end if;
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
  -- A committed receipt survives the short current-result lease. Reauthorize
  -- its independently retained historical source before replaying metadata.
  select * into saved from public.part_three_saved_assessments where owner_id=p_owner and request_id=(p_payload->>'requestId')::uuid for update;
  if found then
   if saved.packet is null or not private.part_three_binding_current(p_owner,saved.packet->'binding',saved.pinned_snapshot_id,false) or (saved.packet->'refinementTrace' is not null and saved.packet->'refinementTrace'<>'null'::jsonb and not private.part_three_refinement_authorized(p_owner,saved.packet->'refinementTrace')) then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
   if (saved.packet->'partFour' is not null and p_payload->>'expectedPacketHash' is null)
    or (p_payload->>'expectedPacketHash' is not null and encode(extensions.digest(private.part_one_canonical_json(saved.packet),'sha256'),'hex') is distinct from p_payload->>'expectedPacketHash')
   then raise exception 'PART_THREE_IDEMPOTENCY_CONFLICT'; end if;
   -- The current row can be pruned independently (FK ON DELETE SET NULL).
   -- The freshly authorized retained packet owns the original committed identity.
   if (saved.packet->>'resultId')::uuid is distinct from (p_payload->>'resultId')::uuid or saved.binding_hash is distinct from p_payload->>'expectedBindingHash' or saved.result_revision is distinct from (p_payload->>'expectedResultRevision')::bigint then raise exception 'PART_THREE_IDEMPOTENCY_CONFLICT'; end if;
   return jsonb_build_object('kind','saved','savedAssessmentId',saved.id,'resultRevision',saved.result_revision,'replayed',true);
  end if;
  select * into row from public.part_three_results where id=(p_payload->>'resultId')::uuid and owner_id=p_owner for update;
  if not found or row.state<>'ready' or row.expires_at<=now() or row.result_revision<>(p_payload->>'expectedResultRevision')::bigint or row.binding_hash is distinct from p_payload->>'expectedBindingHash' or not private.part_three_binding_current(p_owner,row.binding,row.pinned_snapshot_id) then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
  if (row.payload->'partFour' is not null and p_payload->>'expectedPacketHash' is null)
   or (p_payload->>'expectedPacketHash' is not null and encode(extensions.digest(private.part_one_canonical_json(row.payload),'sha256'),'hex') is distinct from p_payload->>'expectedPacketHash')
  then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
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
  if p_payload->>'event' in('skip','answer') and row.payload->'question' is not null and row.payload->'question'<>'null'::jsonb then
   packet:=jsonb_set(jsonb_set(row.payload,'{question}','null'::jsonb),'{resultRevision}',to_jsonb(row.result_revision+1));
   update public.part_three_results set payload=packet,result_revision=result_revision+1 where id=row.id;
  end if;
  update public.part_three_results set lease_token=null where id=row.id;
  return jsonb_build_object('kind','acknowledged');
 end if;
 raise exception 'PART_THREE_INVALID_ACTION';
end $$;
