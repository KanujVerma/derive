-- Owner deletion must enter the same lifecycle fence before locking auth.users.
-- Canonical ordering preserves Part 1's existing 40203-first entrypoints:
--   40203 (capture/truth lifecycle), 40204 (Part 2 publication), then rows/owner.
-- Reentrant acquisition in nested helpers is deliberate; no authority/RLS gate changes.
create function private.part_two_owner_delete_lock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 return null;
end $$;
create trigger part_two_owner_delete_lock before delete on auth.users for each statement execute function private.part_two_owner_delete_lock();
revoke all on function private.part_two_owner_delete_lock() from public,anon,authenticated;
create or replace function private.part_two_assertion_policy_lock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 return null;
end $$;
revoke all on function private.part_two_assertion_policy_lock() from public,anon,authenticated;

create or replace function private.part_two_context(p_owner uuid,p_scan uuid,p_capture uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.part_one_scans; c private.part_one_captures; d private.part_one_records; snap private.part_one_records;
 r jsonb; bounded_ids uuid[]; roots uuid[]:='{}'; deps jsonb; observations jsonb; policies jsonb; expiry timestamptz; state text; valid boolean:=true;
 cfg private.part_two_config; rel private.part_two_releases; raw jsonb; digest text; capture_json jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 select * into s from private.part_one_scans where id=p_scan and owner_id=p_owner for update;
 if not found or not exists(select 1 from public.profiles where id=p_owner and deletion_started_at is null) then raise exception 'PART_TWO_FORBIDDEN' using errcode='42501'; end if;
 if p_capture is not null then
  select * into c from private.part_one_captures where id=p_capture and owner_id=p_owner and scan_id=s.id for update;
  if not found then raise exception 'PART_TWO_FORBIDDEN' using errcode='42501'; end if;
  capture_json:=jsonb_build_object('captureSessionId',c.id,'packageObservationId',c.package_observation_id,'captureRevision',c.capture_revision,'generation',c.generation,'deletionEpoch',c.deletion_epoch,'removed',c.removed_at is not null);
 end if;
 r:=s.result;
 if c.id is not null then
  -- Exact captured declaration, never silently join another capture's result.
  select rr.* into d from private.part_one_records rr where rr.owner_id=p_owner and rr.kind='declaration'
    and rr.payload->>'captureSessionId'=c.id::text and rr.id in(select unnest(cm.declaration_ids) from private.part_one_capture_commits cm where cm.capture_id=c.id and cm.deleted_at is null)
    order by rr.revision desc,rr.created_at desc,rr.id desc limit 1;
 else select * into d from private.part_one_records where id=nullif(s.result->>'declarationId','')::uuid and kind='declaration'; end if;
 select * into snap from private.part_one_records where id=nullif(r->>'snapshotId','')::uuid and kind='snapshot';
 if d.id is not null then roots:=array[d.id]; end if;
 if snap.id is not null then roots:=array_append(roots,snap.id); end if;
 if c.id is not null and d.id is null then
  select coalesce(array_agg(id),'{}') into roots from (select id from private.part_one_records where owner_id=p_owner and kind='observation'
    and payload->>'captureSessionId'=c.id::text and payload->>'role'='ingredients'
    and not exists(select 1 from private.part_one_records child where child.supersedes_id=part_one_records.id) limit 513) bounded_roots;
 end if;
 bounded_ids:=private.part_two_bounded_ancestry(roots);
 if cardinality(bounded_ids)>512 then state:='parse_limit'; deps:='[]'; r:='{}'; valid:=false;
 else
  -- Preserve the existing canonical ownership/rights checks after the early bound.
  r:=private.part_one_filter_result(s.result,p_owner);
  select coalesce(jsonb_agg(jsonb_build_object('id',rr.id,'kind',rr.kind,'revision',rr.revision,'policyId',rr.policy_id,'policyVersion',rr.policy_version,
   'ownerId',rr.owner_id,'scope',rr.scope,'payload',rr.payload,'dependencies',to_jsonb(rr.dependencies),'identityDependencies',to_jsonb(rr.identity_dependencies),
   'observedAt',private.part_one_utc(rr.observed_at),'expiresAt',private.part_one_utc(rr.expires_at),'status',coalesce(st.status,'active'),'statusRevision',coalesce(st.status_revision,1)) order by rr.id),'[]')
   into deps from private.part_one_records rr left join private.part_one_record_status st on st.record_id=rr.id where rr.id=any(bounded_ids);
 end if;
 if valid then
  foreach p_scan in array roots loop
   if p_scan=snap.id then valid:=valid and private.part_one_snapshot_identity_allowed(p_scan,p_owner);
   else valid:=valid and private.part_one_record_allowed(p_scan,p_owner); end if;
  end loop;
 end if;
 if c.id is not null and (c.removed_at is not null or c.deletion_epoch<>s.deletion_epoch) then valid:=false; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',pp.id,'version',pp.version,'retainAllowed',pp.retain_allowed,'displayAllowed',pp.display_allowed,'exportAllowed',pp.export_allowed,'labelAssertionKinds',to_jsonb(pp.label_assertion_kinds),'labelAssertionEpoch',pp.label_assertion_epoch,'epoch',coalesce((select epoch from private.part_two_policy_epochs pe where pe.policy_id=pp.id),0),'expiresAt',private.part_one_utc(pp.expires_at)) order by pp.id),'[]') into policies
 from private.part_one_policies pp where pp.id in(select value->>'policyId' from jsonb_array_elements(deps));
 select min((value->>'expiresAt')::timestamptz) into expiry from jsonb_array_elements(deps);
 select least(expiry,min(nullif(value->>'expiresAt','')::timestamptz)) into expiry from jsonb_array_elements(policies);
 expiry:=coalesce(expiry,nullif(r->'freshness'->>'expiresAt','')::timestamptz,s.created_at+interval '30 minutes');
 select coalesce(jsonb_agg(value order by value->>'id'),'[]') into observations from jsonb_array_elements(deps) where value->>'kind'='observation';
 select * into cfg from private.part_two_config where id=true for share;
 select * into rel from private.part_two_releases where id=cfg.release_id for share;
 if state is null then state:=case when not valid then 'blocked' when d.id is null and jsonb_array_length(observations)=0 then 'no_declaration'
   when rel.id is null or not rel.permitted or rel.revoked_at is not null then 'blocked' else 'pending' end; end if;
 -- Capture payload is source-only unless the immutable declaration matches the
 -- selected snapshot AND its stored association predicate actually passed.
 raw:=jsonb_build_object('ownerId',p_owner,'scanId',s.id,'capture',capture_json,'generation',s.generation,'evidenceRevision',s.result_revision,
  'bindingRevision',s.binding_revision,'withdrawnExplanationDependencies',(select coalesce(jsonb_agg(record_id order by record_id),'[]') from private.part_two_explanation_withdrawals),'policyEpoch',(select coalesce(sum((value->>'epoch')::integer+(value->>'labelAssertionEpoch')::integer),0) from jsonb_array_elements(policies))+(select count(*) from private.part_two_explanation_withdrawals),'deletionEpoch',s.deletion_epoch,'result',r,'declaration',case when valid and d.id is not null then to_jsonb(d) else null end,
  'snapshot',case when valid and snap.id is not null then to_jsonb(snap) else null end,'dependencies',case when valid then deps else '[]'::jsonb end,
  'observations',case when valid then observations else '[]'::jsonb end,'policies',policies,'expiresAt',private.part_one_utc(expiry),
  'state',state,'releaseId',rel.id,'releaseHash',rel.release_hash,'versions',rel.versions,'releaseEpoch',cfg.epoch);
 digest:=encode(extensions.digest(private.part_one_canonical_json(raw),'sha256'),'hex');
 return raw||jsonb_build_object('contextDigest',digest,'dependencyDigest',encode(extensions.digest(private.part_one_canonical_json(deps),'sha256'),'hex'),
  'bindingKey',encode(extensions.digest(p_owner::text||':'||s.id::text||':'||coalesce(c.id::text,'scan'),'sha256'),'hex'));
end $$;

create or replace function private.part_two_project_withdrawals(p_snapshot uuid,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare original private.part_two_snapshots; cur private.part_two_current; body jsonb; section jsonb; reading jsonb; facts jsonb; manifest jsonb; ids jsonb; withdrawals jsonb; sid uuid; rev integer; part text; changed boolean; label_ids jsonb; roots jsonb; permissions jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 select * into original from private.part_two_snapshots where id=p_snapshot and owner_id=p_owner;
 if not found then return null; end if;
 -- Hold every existing source/status/policy lifecycle row through publication.
 perform 1 from public.profiles where id=p_owner for share;
 perform 1 from private.part_one_records where id=any(original.dependencies) order by id for share;
 perform 1 from private.part_one_record_status where record_id=any(original.dependencies) order by record_id for share;
 perform 1 from private.part_one_policies where id in(select policy_id from private.part_one_records where id=any(original.dependencies)) order by id for share;
 perform 1 from private.part_one_captures where id=original.capture_id for share;
 perform 1 from private.part_two_releases where id=original.release_id for share;
 if original.expires_at<=now() or not exists(select 1 from public.profiles where id=p_owner and deletion_started_at is null)
  or exists(select 1 from unnest(original.dependencies) d where not private.part_one_record_allowed(d,p_owner))
  or not exists(select 1 from private.part_two_releases rr where rr.id=original.release_id and rr.permitted and rr.revoked_at is null)
  or original.capture_id is not null and not exists(select 1 from private.part_one_captures c where c.id=original.capture_id and c.owner_id=p_owner and c.removed_at is null)
 then return null; end if;
 body:=original.payload; reading:=body->'output'->'reading';
 select exists(select 1 from jsonb_array_elements(coalesce(reading->'facts','[]')) f where private.part_two_card_withdrawn(f,reading))
  or exists(select 1 from jsonb_array_elements(coalesce(body->'output'->'productFacts'->'facts','[]')) f where private.part_two_card_withdrawn(f,body->'output'->'productFacts')) or not private.part_two_assertion_snapshot_allowed(reading,p_owner)
  or not private.part_two_assertion_snapshot_allowed(body->'output'->'productFacts',p_owner) into changed;
 if not changed then return body; end if;
 select * into cur from private.part_two_current where binding_key=original.binding_key for update;
 rev:=greatest(cur.result_revision,original.result_revision)+1; sid:=gen_random_uuid();
 select coalesce(jsonb_agg(distinct dep order by dep),'[]') into ids from jsonb_array_elements(reading->'facts') f,
  lateral jsonb_array_elements_text(coalesce(f->'dictionaryDependencies','[]')) dep where not private.part_two_card_withdrawn(f,reading);
 select coalesce(jsonb_agg(distinct ew.record_id order by ew.record_id),'[]') into withdrawals from private.part_two_explanation_withdrawals ew
 where exists(select 1 from jsonb_array_elements(reading->'facts') f where f->>'kind'='reference_function' and (f->'dictionaryDependencies' ? ew.record_id or f->'value'->>'explanationId'=ew.record_id or f->'value'->>'policyId'=ew.record_id))
  or exists(select 1 from jsonb_array_elements(coalesce(reading->'dependencyManifest'->'explanationPolicies','[]')) ep where ep->'withdrawalDependencies' ? ew.record_id)
  or coalesce(reading->'dependencyManifest'->'withdrawnExplanationDependencies','[]') ? ew.record_id;
 foreach part in array array['reading','productFacts'] loop
  section:=body->'output'->part; if section is null then continue; end if;
  select coalesce(jsonb_agg(refreshed),'[]') into roots from jsonb_array_elements(coalesce(section->'labelAssertions','[]')) a cross join lateral (select private.part_two_current_label_root(a,p_owner) refreshed) refreshed_root where refreshed is not null and private.part_two_label_root_bound(refreshed,section,p_owner);
  section:=section||jsonb_build_object('labelAssertions',roots);
  select coalesce(jsonb_agg(f order by ord),'[]') into facts from jsonb_array_elements(section->'facts') with ordinality a(f,ord) where not private.part_two_card_withdrawn(f,section) and private.part_two_label_fact_allowed(f,section,p_owner);
  select coalesce(jsonb_agg(a->'fieldPermission'||jsonb_build_object('assertionId',a->>'assertionId')),'[]') into permissions from jsonb_array_elements(roots) a;
  manifest:=section->'dependencyManifest'||jsonb_build_object('labelAssertionPermissions',permissions,'dictionaryRecordIds',ids,'withdrawnExplanationDependencies',withdrawals);
  section:=section||jsonb_build_object('snapshotId',sid::text||case when part='productFacts' then ':product' else '' end,'createdAt',private.part_one_utc(now()),'facts',facts,'labelAssertions',roots,'versions',section->'versions','dependencyManifest',manifest);
  body:=jsonb_set(body,array['output',part],section);
 end loop;
 body:=body||jsonb_build_object('resultRevision',rev);
 insert into private.part_two_snapshots(id,binding_key,owner_id,capture_id,build_key,result_revision,release_id,payload,dependencies,private_payload,expires_at,lineage)
  values(sid,original.binding_key,p_owner,original.capture_id,original.build_key||':withdrawal:'||rev,rev,original.release_id,body,original.dependencies,original.private_payload,original.expires_at,
   original.lineage||jsonb_build_object('originalSnapshotId',coalesce(original.lineage->'originalSnapshotId',to_jsonb(original.id)), 'originalInterpretationId',coalesce(original.lineage->'originalInterpretationId',reading->'snapshotId'),'originalVersions',coalesce(original.lineage->'originalVersions',reading->'versions'),'originalReleaseId',original.release_id,'originalResultRevision',coalesce(original.lineage->'originalResultRevision',to_jsonb(original.result_revision)),'projectionOf',original.id,'originalLabelAssertionPermissions',coalesce(original.lineage->'originalLabelAssertionPermissions',reading->'dependencyManifest'->'labelAssertionPermissions'),'labelPermissionProjection',true,'withdrawnExplanationDependencies',withdrawals));
 update private.part_two_saves set snapshot_id=sid,result_revision=rev where snapshot_id=original.id;
 update private.part_two_capture_saves set snapshot_id=sid,result_revision=rev where snapshot_id=original.id;
 -- A recalled private card cannot remain copied in historical payload storage.
 -- Repoint links to the new immutable projection before deleting the old copy.
 delete from private.part_two_snapshots where id=original.id;
 update private.part_two_current set result=null,result_revision=rev,build_key=null,state='pending',lease_token=null,lease_expires_at=null where binding_key=original.binding_key;
 return body;
end $$;
revoke all on function private.part_two_project_withdrawals(uuid,uuid) from public,anon,authenticated;

create or replace function public.part_two_worker(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cur private.part_two_current; ctx jsonb; cfg private.part_two_config; rel private.part_two_releases; body jsonb; sid uuid; rev integer; recalled record;
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
 if cur.lease_token is distinct from nullif(p_payload->>'leaseToken','')::uuid or cur.lease_expires_at<=now()
  or cur.context_digest is distinct from p_payload->>'contextDigest' or ctx->>'contextDigest' is distinct from cur.context_digest
  or cur.result_revision is distinct from (p_payload->>'expectedResultRevision')::integer or ctx->>'state'<>'pending' then
  return jsonb_build_object('published',false,'reason','stale_work'); end if;
 body:=p_payload->'result';
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
revoke all on function public.part_two_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.part_two_worker(text,jsonb) to service_role;

create or replace function public.part_two_operation(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; ctx jsonb; cur private.part_two_current; key text; build text; token uuid; rev integer; expected boolean; saved jsonb; sid uuid; link private.part_two_saves; capture_link private.part_two_capture_saves;
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 u:=private.part_one_owner();
 -- Fence pin lookup and any recall-driven pointer movement in one transaction.
 if p_action in('saves/read','captures/saved-read') then perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204); end if;
 if p_action='captures/save' then
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in('captureSessionId','bindingKey','expectedPartTwoRevision')) then raise exception 'PART_TWO_INVALID_REQUEST'; end if;
  select * into cur from private.part_two_current where binding_key=p_payload->>'bindingKey' and owner_id=u and capture_id=(p_payload->>'captureSessionId')::uuid;
  if not found then raise exception 'PART_TWO_FORBIDDEN' using errcode='42501'; end if;
  ctx:=private.part_two_context(u,cur.scan_id,cur.capture_id);
  select * into cur from private.part_two_current where binding_key=p_payload->>'bindingKey' for update;
  if cur.state<>'ready' or cur.result_revision is distinct from (p_payload->>'expectedPartTwoRevision')::integer
   or ctx->>'contextDigest' is distinct from cur.context_digest or cur.result->'output'->'reading'->>'scope' is distinct from 'private_package' then
   return jsonb_build_object('state','conflict','code','part_two_details_changed');
  end if;
  select id into sid from private.part_two_snapshots where binding_key=cur.binding_key and result_revision=cur.result_revision and owner_id=u and capture_id=cur.capture_id;
  if sid is null then raise exception 'PART_TWO_INVALID_RESULT'; end if;
  insert into private.part_two_capture_saves(owner_id,capture_id,snapshot_id,binding_key,result_revision,snapshot_at_save_id,saved_versions)
   values(u,cur.capture_id,sid,cur.binding_key,cur.result_revision,sid,cur.result->'output'->'reading'->'versions') on conflict(owner_id,capture_id,snapshot_id) do nothing;
  select * into capture_link from private.part_two_capture_saves where owner_id=u and capture_id=cur.capture_id and snapshot_id=sid;
  return jsonb_build_object('state','saved','interpretationId',capture_link.id,'bindingKey',cur.binding_key,'resultRevision',cur.result_revision);
 elsif p_action='captures/saved-read' then
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in('captureSessionId','interpretationId')) then raise exception 'PART_TWO_INVALID_REQUEST'; end if;
  if not exists(select 1 from private.part_one_captures where id=(p_payload->>'captureSessionId')::uuid and owner_id=u) then raise exception 'PART_TWO_FORBIDDEN' using errcode='42501'; end if;
  select * into capture_link from private.part_two_capture_saves ps where ps.owner_id=u and ps.capture_id=(p_payload->>'captureSessionId')::uuid
   and (p_payload->>'interpretationId' is null or ps.id=nullif(p_payload->>'interpretationId','')::uuid) order by ps.created_at desc,ps.id desc limit 1;
  if not found then return jsonb_build_object('result',null,'withdrawn',false,'interpretationId',null); end if;
  saved:=private.part_two_project_withdrawals(capture_link.snapshot_id,u);
  return jsonb_build_object('result',saved,'withdrawn',saved is null,'interpretationId',capture_link.id);
 elsif p_action='saves/create' then
  if jsonb_typeof(p_payload->'save')<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in('save','bindingKey','expectedPartTwoRevision')) then raise exception 'PART_TWO_INVALID_REQUEST'; end if;
  select * into cur from private.part_two_current where binding_key=p_payload->>'bindingKey' and owner_id=u;
  if not found then raise exception 'PART_TWO_FORBIDDEN' using errcode='42501'; end if;
  ctx:=private.part_two_context(u,cur.scan_id,cur.capture_id);
  select * into cur from private.part_two_current where binding_key=p_payload->>'bindingKey' for update;
  if cur.state<>'ready' or cur.result_revision is distinct from (p_payload->>'expectedPartTwoRevision')::integer
   or ctx->>'contextDigest' is distinct from cur.context_digest or cur.result->'output'->>'kind'<>'bound'
   or p_payload->'save'->>'scanId' is distinct from cur.scan_id::text
   or p_payload->'save'->>'selectedSnapshotId' is distinct from cur.result->'output'->'reading'->'binding'->>'snapshotId'
   or p_payload->'save'->>'selectedDeclarationId' is distinct from cur.result->'output'->'reading'->'binding'->>'declarationId' then
   return jsonb_build_object('conflict',true,'code','part_two_details_changed','result',ctx->'result');
  end if;
  select id into sid from private.part_two_snapshots where binding_key=cur.binding_key and result_revision=cur.result_revision;
  if sid is null then raise exception 'PART_TWO_INVALID_RESULT'; end if;
  saved:=public.part_one_operation('saves/create',p_payload->'save');
  if saved->>'conflict'='true' then return saved; end if;
  select * into link from private.part_two_saves where save_id=(saved->>'saveId')::uuid;
  if found and (link.snapshot_id is distinct from sid or link.result_revision<>cur.result_revision) then raise exception 'PART_TWO_SAVE_REPLAY_CONFLICT'; end if;
  insert into private.part_two_saves(save_id,owner_id,snapshot_id,binding_key,result_revision,snapshot_at_save_id,saved_versions)
   values((saved->>'saveId')::uuid,u,sid,cur.binding_key,cur.result_revision,sid,cur.result->'output'->'reading'->'versions') on conflict(save_id) do nothing;
  return saved;
 elsif p_action='saves/read' then
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in('saveId')) then raise exception 'PART_TWO_INVALID_REQUEST'; end if;
  select * into link from private.part_two_saves ps where ps.save_id=(p_payload->>'saveId')::uuid and ps.owner_id=u
   and exists(select 1 from private.part_one_saves sv where sv.id=ps.save_id and sv.deleted_at is null);
  if not found then raise exception 'PART_TWO_FORBIDDEN' using errcode='42501'; end if;
  saved:=private.part_two_project_withdrawals(link.snapshot_id,u);
  return jsonb_build_object('result',saved,'resultRevision',coalesce((saved->>'resultRevision')::integer,link.result_revision),'withdrawn',saved is null);
 end if;
 if p_action<>'resolve'  or jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in('schemaVersion','requestId','scanId','captureSessionId','expectedGeneration','expectedEvidenceRevision'))
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
 if cur.build_key=build and cur.state='pending' and cur.lease_expires_at>now() then
  return jsonb_build_object('context',ctx,'resultRevision',cur.result_revision,'state','pending','reasonCodes','[]'::jsonb,'cached',null,'ticket',null);
 end if;
 rev:=cur.result_revision+1; token:=gen_random_uuid();
 update private.part_two_current set build_key=build,context_digest=build,result_revision=rev,generation=(ctx->>'generation')::integer,
  evidence_revision=(ctx->>'evidenceRevision')::integer,deletion_epoch=(ctx->>'deletionEpoch')::integer,release_id=ctx->>'releaseId',release_epoch=(ctx->>'releaseEpoch')::integer,
  state=ctx->>'state',lease_token=case when ctx->>'state'='pending' then token else null end,lease_expires_at=case when ctx->>'state'='pending' then now()+interval '30 seconds' else null end,
  result=null,dependencies=array(select (value->>'id')::uuid from jsonb_array_elements(ctx->'dependencies')),
  private_payload=coalesce((ctx->'capture' is not null and ctx->'capture'<>'null'::jsonb) or ctx->'declaration'->>'scope'='private_package',false),
  expires_at=nullif(ctx->>'expiresAt','')::timestamptz,updated_at=now() where binding_key=key;
 return jsonb_build_object('context',ctx,'resultRevision',rev,'state',ctx->>'state','reasonCodes',case when ctx->>'state'='blocked' then '["rights_or_evidence_unavailable"]'::jsonb else '[]'::jsonb end,'cached',null,
  'ticket',case when ctx->>'state'='pending' then jsonb_build_object('bindingKey',key,'leaseToken',token,'contextDigest',build,'expectedResultRevision',rev) else null end);
end $$;
revoke all on function public.part_two_operation(text,jsonb) from public,anon;
grant execute on function public.part_two_operation(text,jsonb) to authenticated;

-- Preserve exact authentication/profile gates while fencing before the per-owner lock.
create or replace function private.part_one_owner() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); begin
  if u is null then raise exception 'PART_ONE_UNAUTHORIZED' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(40203);
  perform pg_catalog.pg_advisory_xact_lock(40204);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text, 191027));
  if not exists(select 1 from public.profiles where id=u and deletion_started_at is null) then
    raise exception 'PART_ONE_OWNER_UNAVAILABLE' using errcode='42501';
  end if;
  return u;
end $$;

revoke all on function private.part_one_owner() from public,anon,authenticated;
