-- Exact production root ItemSnapshot and historical nested shape share one whitelist.
-- Missing fields remain missing; this projection never constructs an association.
create function private.part_two_snapshot_item(s private.part_one_records,p_owner uuid,p_item uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare body jsonb; projected jsonb; key text; required text[]:=array['snapshotId','itemId','revision','name','variant','fieldEvidence','barcodeAssertions','requestedMarket','sourceMarkets','packageMarket','declarationIds','conflictIds','scope','supersedesId'];
begin
 if s.id is null or s.kind<>'snapshot' or s.item_id is distinct from p_item
  or s.scope='private_package' and s.owner_id is distinct from p_owner
  or not private.part_one_snapshot_identity_allowed(s.id,p_owner) then return null; end if;
 body:=case when jsonb_typeof(s.payload->'fullItem')='object' then s.payload->'fullItem' else s.payload end;
 if jsonb_typeof(body)<>'object' or not body ?& required then return null; end if;
 if body->>'snapshotId' is distinct from s.id::text or body->>'itemId' is distinct from s.item_id::text
  or body->>'revision' is distinct from s.revision::text or body->>'scope' is distinct from s.scope
  or jsonb_typeof(body->'name')<>'string' or jsonb_typeof(body->'variant')<>'object'
  or jsonb_typeof(body->'fieldEvidence')<>'object' or jsonb_typeof(body->'barcodeAssertions')<>'array'
  or jsonb_typeof(body->'sourceMarkets')<>'array' or jsonb_typeof(body->'declarationIds')<>'array'
  or jsonb_typeof(body->'conflictIds')<>'array' then return null; end if;
 if not body->'variant' ?& array['brand','line','form','scent','shade','spf','strength','size','unit','packCount','packagingLevel'] then return null; end if;
 foreach key in array array['brand','line','form','scent','shade','spf','strength','size','unit'] loop
  if jsonb_typeof(body->'variant'->key) not in('string','null') then return null; end if;
 end loop;
 foreach key in array array['requestedMarket','packageMarket','supersedesId'] loop
  if jsonb_typeof(body->key) not in('string','null') then return null; end if;
 end loop;
 select jsonb_object_agg(k,body->k) into projected from unnest(required) k;
 return projected;
end $$;
revoke all on function private.part_two_snapshot_item(private.part_one_records,uuid,uuid) from public,anon,authenticated;

-- This recursive working relation carries IDs only and stops discovering at 513.
-- UNION deduplicates cycles and diamonds; no sorting/aggregation of payloads precedes LIMIT.
create function private.part_two_bounded_ancestry(p_roots uuid[]) returns uuid[]
language sql stable security definer set search_path='' as $$
 with recursive closure(id) as (
  select unnest(p_roots)
  union
  select child.id from closure cc join private.part_one_records parent on parent.id=cc.id
   cross join lateral unnest(parent.dependencies||parent.identity_dependencies) child(id)
 ) select coalesce(array_agg(id),'{}'::uuid[]) from (select id from closure limit 513) bounded;
$$;
revoke all on function private.part_two_bounded_ancestry(uuid[]) from public,anon,authenticated;

create or replace function private.part_one_private_context(p_owner uuid,p_capture private.part_one_captures,p_scan private.part_one_scans,p_commit private.part_one_capture_commits,p_review uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare cfg private.part_one_private_config; pp private.part_one_policies; snap private.part_one_records; assets jsonb; current_observations jsonb; prior_observations jsonb;
 obs jsonb; ids jsonb; ns text; superseded uuid;
begin
 select * into cfg from private.part_one_private_config where id=true;
 select * into pp from private.part_one_policies where id='private_capture';
 select * into snap from private.part_one_records where id=nullif(p_scan.result->>'snapshotId','')::uuid;
 select coalesce(jsonb_agg(jsonb_build_object('ownerId',aa.owner_id,'captureSessionId',aa.capture_id,'packageObservationId',aa.package_observation_id,
  'generation',aa.generation,'deletionEpoch',aa.deletion_epoch,'evidenceId',pa.record_id,'clientEvidenceId',pa.client_evidence_id,'attestationId',aa.id,
  'storageObjectId',aa.storage_object_id,'contentHash',aa.content_hash,'objectVersion',aa.object_version,'width',aa.width,'height',aa.height,'metadataStripped',true,
  'sanitizerVersion',aa.sanitizer_version,'verificationEvidence',aa.verification_evidence,'observedAt',private.part_one_utc(aa.observed_at),
  'expiresAt',private.part_one_utc(least(aa.expires_at,private.part_one_record_expiry(pa.record_id))),'status','active') order by pa.record_id),'[]') into assets
 from private.part_one_private_assets pa join private.part_one_asset_attestations aa on aa.id=pa.attestation_id
 where pa.capture_id=p_capture.id and pa.owner_id=p_owner and private.part_one_record_allowed(pa.record_id,p_owner);
 select coalesce(jsonb_agg(private.part_one_observation_projection(rr)||jsonb_build_object('observedAt',private.part_one_utc(rr.observed_at),
  'expiresAt',private.part_one_utc(private.part_one_record_expiry(rr.id))) order by rr.id),'[]') into current_observations
 from private.part_one_records rr where rr.owner_id=p_owner and rr.scope='private_package' and rr.kind='observation'
  and rr.payload->>'captureSessionId'=p_capture.id::text and rr.payload->>'privateKind' in ('ocr','edit') and private.part_one_record_allowed(rr.id,p_owner)
  and not exists(select 1 from private.part_one_records child where child.owner_id=p_owner and child.kind='observation' and child.supersedes_id=rr.id);
 select coalesce(jsonb_agg(private.part_one_observation_projection(rr)||jsonb_build_object('observedAt',private.part_one_utc(rr.observed_at),
  'expiresAt',private.part_one_utc(private.part_one_record_expiry(rr.id))) order by rr.id),'[]') into prior_observations
 from private.part_one_records rr where rr.owner_id=p_owner and rr.scope='private_package' and rr.kind='observation'
  and rr.payload->>'captureSessionId'=p_capture.id::text and rr.payload->>'privateKind' in ('ocr','edit') and private.part_one_record_allowed(rr.id,p_owner)
  and exists(select 1 from private.part_one_records child where child.owner_id=p_owner and child.kind='observation' and child.supersedes_id=rr.id);
 superseded:=nullif(p_scan.result->>'declarationId','')::uuid;
 if not exists(select 1 from private.part_one_records where id=superseded and owner_id=p_owner and scope='private_package' and payload->>'captureSessionId'=p_capture.id::text) then superseded:=null; end if;
 ns:=encode(extensions.digest(p_commit.source_commit_id::text||':'||coalesce(p_review::text,'none'),'sha256'),'hex');
 ids:=jsonb_build_object('snapshotId',substr(ns,1,8)||'-'||substr(ns,9,4)||'-4'||substr(ns,14,3)||'-8'||substr(ns,18,3)||'-'||substr(ns,21,12),
  'declarationId',substr(ns,33,8)||'-'||substr(ns,41,4)||'-4'||substr(ns,46,3)||'-8'||substr(ns,50,3)||'-'||substr(ns,53,12));
 return jsonb_build_object('ownerId',p_owner,'capture',private.part_one_capture_projection(p_capture),'result',private.part_one_filter_result(p_scan.result,p_owner),
  'item',private.part_two_snapshot_item(snap,p_owner,p_capture.item_id),'assets',assets,'observations',current_observations,'priorObservations',prior_observations,'supersedesDeclarationId',superseded,
  'reviewRequest',case when p_review is null then null else jsonb_build_object('reviewId',p_review) end,
  'policy',jsonb_build_object('policyId',cfg.source_policy_id,'provider','private_capture','version',cfg.policy_version,'permissionEvidence',cfg.approval_evidence,
   'reviewedAt',private.part_one_utc(cfg.reviewed_at),'expiresAt',private.part_one_utc(least(cfg.expires_at,coalesce(pp.expires_at,'infinity'))),'revokedAt',null,
   'operations',jsonb_build_object('lookup',false,'process',cfg.process_allowed,'retain',pp.retain_allowed,'sharedDisplay',false,'privateDisplay',cfg.private_display_allowed,
    'ocr',cfg.ocr_allowed,'cropThumbnail',false,'rehost',false,'hotlink',false,'export',false),'retainedFields',jsonb_build_array('sanitized_private_images','private_ocr','attributed_edits','ingredients'),
   'attribution','Owner-private package evidence','purgeObligations',jsonb_build_array('private_capture_removal','source_expiry','owner_deletion')),
  'now',private.part_one_utc(now()),'ids',ids);
end $$;

-- A literal product assertion needs an independent, reviewed field grant.
alter table private.part_one_policies add column label_assertion_permission_evidence text, add column label_assertion_kinds text[] not null default '{}', add column label_assertion_epoch integer not null default 0 check(label_assertion_epoch>=0);
alter table private.part_one_policies add constraint part_one_label_assertion_kinds_check check(label_assertion_kinds <@ array['category','usage','purpose','claim']::text[] and cardinality(label_assertion_kinds)<=4 and array_position(label_assertion_kinds,null) is null and (cardinality(label_assertion_kinds)=0 or label_assertion_permission_evidence is not null));

create or replace function private.part_two_context(p_owner uuid,p_scan uuid,p_capture uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.part_one_scans; c private.part_one_captures; d private.part_one_records; snap private.part_one_records;
 r jsonb; bounded_ids uuid[]; roots uuid[]:='{}'; deps jsonb; observations jsonb; policies jsonb; expiry timestamptz; state text; valid boolean:=true;
 cfg private.part_two_config; rel private.part_two_releases; raw jsonb; digest text; capture_json jsonb;
begin
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

-- UTF-16 spans are checked against immutable original text, never SQL character offsets.
create function private.part_two_utf16_slice(t text,a integer,b integer) returns text
language plpgsql immutable set search_path='' as $$
declare ch text; n integer:=0; width integer; result text:='';
begin
 if a<0 or b<a or b-a>2000 or char_length(t)>262144 then return null; end if;
 foreach ch in array string_to_array(t,null) loop
  width:=case when ascii(ch)>65535 then 2 else 1 end;
  if (a>n and a<n+width) or (b>n and b<n+width) then return null; end if;
  if n>=a and n+width<=b then result:=result||ch; end if;
  n:=n+width; if n>=b then exit; end if;
 end loop;
 if n<b then return null; end if; return result;
end $$;
create function private.part_two_label_allowed(a jsonb,p_owner uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare pp private.part_one_policies; o private.part_one_records; perm jsonb:=a->'fieldPermission'; annotation jsonb;
begin
 select * into pp from private.part_one_policies where id=perm->>'policyId';
 if not found or not pp.retain_allowed or not pp.display_allowed or pp.version is distinct from perm->>'policyVersion'
  or not (a->>'assertionKind'=any(pp.label_assertion_kinds)) or perm->>'assertionKind' is distinct from a->>'assertionKind'
  or (perm->>'policyEpoch')::integer is distinct from pp.label_assertion_epoch
  or perm->>'permitted' is distinct from 'true' or (perm->>'expiresAt')::timestamptz<=now()
  or pp.expires_at is not null and pp.expires_at<(perm->>'expiresAt')::timestamptz then return false; end if;
 select * into o from private.part_one_records where id=(a->'span'->>'observationId')::uuid and kind='observation';
 if not found or o.policy_id is distinct from pp.id or o.policy_version is distinct from pp.version or o.revision is distinct from (a->'span'->>'sourceRevision')::integer
  or o.scope='private_package' and o.owner_id is distinct from p_owner or not private.part_one_record_allowed(o.id,p_owner)
  or o.expires_at<(perm->>'expiresAt')::timestamptz then return false; end if;
 -- Only the explicitly annotated exact raw text qualifies; metadata/category fields never do.
 if coalesce(o.payload->>'rawText',o.payload->'payload'->>'rawIngredients',o.payload->>'rawIngredients',o.payload->'observation'->>'text') is distinct from a->>'sourceText'
  or a->'span'->>'raw' is distinct from a->>'text'
  or private.part_two_utf16_slice(a->>'sourceText',(a->'span'->>'start')::integer,(a->'span'->>'end')::integer) is distinct from a->>'text' then return false; end if;
 for annotation in select value from jsonb_array_elements(coalesce(o.payload->'labelAssertions','[]')) loop
  if annotation->>'assertionId'=a->>'assertionId' and annotation->>'assertionKind'=a->>'assertionKind' and annotation->>'text'=a->>'text'
   and annotation->>'start'=a->'span'->>'start' and annotation->>'end'=a->'span'->>'end'
   and annotation->>'transcription'=a->>'transcription' and annotation->'conditional' is not distinct from a->'conditional' then return true; end if;
 end loop;
 return false;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;
-- A saved projection may refresh the independent permission epoch for kinds
-- that remain granted. Historical literal meaning/fact IDs are never rebuilt.
create function private.part_two_current_label_root(a jsonb,p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare pp private.part_one_policies; candidate jsonb;
begin
 select * into pp from private.part_one_policies where id=a->'fieldPermission'->>'policyId';
 if not found then return null; end if;
 candidate:=jsonb_set(a,'{fieldPermission,policyEpoch}',to_jsonb(pp.label_assertion_epoch));
 if private.part_two_label_allowed(candidate,p_owner) then return candidate; end if; return null;
end $$;
create function private.part_two_label_root_bound(a jsonb,snapshot jsonb,p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.part_one_records d where d.kind='declaration' and d.id::text=snapshot->'binding'->>'declarationId'
  and d.revision::text=snapshot->'binding'->>'declarationRevision' and d.item_id::text=snapshot->'binding'->>'itemId'
  and d.scope=snapshot->'binding'->>'scope' and d.owner_id::text is not distinct from snapshot->'binding'->>'ownerId'
  and (d.scope='public' or d.owner_id=p_owner) and private.part_one_record_allowed(d.id,p_owner)
  and d.payload->'predicate'->'association'->>'passed'='true' and d.payload->'observationIds' ? (a->'span'->>'observationId')
  and exists(select 1 from unnest(d.dependencies) dep where dep::text=a->'span'->>'observationId'))
  and exists(select 1 from jsonb_array_elements(coalesce(snapshot->'binding'->'observations','[]')) obs where obs->>'observationId'=a->'span'->>'observationId' and obs->>'revision'=a->'span'->>'sourceRevision')
  and exists(select 1 from jsonb_array_elements(coalesce(snapshot->'dependencyManifest'->'sourceRefs','[]')) ref where ref->>'observationId'=a->'span'->>'observationId' and ref->>'sourceRevision'=a->'span'->>'sourceRevision'
    and ref->>'sourceTextHash'=encode(extensions.digest(a->>'sourceText','sha256'),'hex'));
$$;
create function private.part_two_label_fact_allowed(f jsonb,snapshot jsonb,p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select f->>'kind'<>'product_label_assertion' or exists(select 1 from jsonb_array_elements(coalesce(snapshot->'labelAssertions','[]')) a
  where a->>'assertionId'=f->'subject'->>'assertionId' and private.part_two_label_allowed(a,p_owner) and private.part_two_label_root_bound(a,snapshot,p_owner)
  and f->'subject'->>'kind'='bound_label_assertion' and f->'subject'->>'declarationId'=snapshot->'binding'->>'declarationId'
  and f->'subject'->>'declarationRevision'=snapshot->'binding'->>'declarationRevision' and f->>'occurrenceId'=a->>'assertionId'
  and f->'value'->>'text'=a->>'text' and f->'value'->>'assertionKind'=a->>'assertionKind' and f->'value'->>'attribution'='label_says'
  and f->'spans'=jsonb_build_array(a->'span') and f->'sourceDependencies'=jsonb_build_array(a->'span'->>'observationId')
  and f->'dictionaryDependencies'='[]'::jsonb and f->'limitations' ?& array['label_claim_not_verified','no_ingredient_absence_inference']
  and a->>'transcription'='clear' and a->'conditional'='null'::jsonb);
$$;
create function private.part_two_assertion_snapshot_allowed(snapshot jsonb,p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from jsonb_array_elements(coalesce(snapshot->'labelAssertions','[]')) a where not private.part_two_label_allowed(a,p_owner) or not private.part_two_label_root_bound(a,snapshot,p_owner))
  and not exists(select 1 from jsonb_array_elements(coalesce(snapshot->'facts','[]')) f where not private.part_two_label_fact_allowed(f,snapshot,p_owner));
$$;
revoke all on function private.part_two_utf16_slice(text,integer,integer),private.part_two_label_allowed(jsonb,uuid),private.part_two_label_fact_allowed(jsonb,jsonb,uuid),private.part_two_assertion_snapshot_allowed(jsonb,uuid),private.part_two_current_label_root(jsonb,uuid),private.part_two_label_root_bound(jsonb,jsonb,uuid) from public,anon,authenticated;

create or replace function private.part_two_project_withdrawals(p_snapshot uuid,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare original private.part_two_snapshots; cur private.part_two_current; body jsonb; section jsonb; reading jsonb; facts jsonb; manifest jsonb; ids jsonb; withdrawals jsonb; sid uuid; rev integer; part text; changed boolean; label_ids jsonb; roots jsonb; permissions jsonb;
begin
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

create or replace function private.part_two_invalidate() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid; policy text; begin
 if tg_table_name='part_one_records' then target:=old.id;
 elsif tg_table_name='part_one_record_status' then
  if new.status not in('revoked','retracted') then return new; end if; target:=new.record_id;
 elsif tg_table_name='part_one_policies' then
  if (to_jsonb(new)-array['label_assertion_kinds','label_assertion_epoch','label_assertion_permission_evidence']) is not distinct from (to_jsonb(old)-array['label_assertion_kinds','label_assertion_epoch','label_assertion_permission_evidence']) then return new; end if;
  policy:=new.id;
  insert into private.part_two_policy_epochs(policy_id,epoch) values(policy,1) on conflict(policy_id) do update set epoch=part_two_policy_epochs.epoch+1;
 elsif tg_table_name='part_one_private_config' then policy:='private_capture';
  update private.part_two_policy_epochs set epoch=epoch+1 where policy_id=policy;
 end if;
 delete from private.part_two_snapshots ps where (ps.private_payload or tg_table_name='part_one_records' or policy is not null and exists(select 1 from private.part_one_policies pp where pp.id=policy and not pp.retain_allowed)) and (target=any(ps.dependencies) or policy is not null and exists(select 1 from private.part_one_records rr where rr.id=any(ps.dependencies) and rr.policy_id=policy));
 update private.part_two_current pc set result=null,state='expired',build_key=null,lease_token=null,lease_expires_at=null,result_revision=result_revision+1 where
  target=any(pc.dependencies) or policy is not null and exists(select 1 from private.part_one_records rr where rr.id=any(pc.dependencies) and rr.policy_id=policy);
 if tg_op='DELETE' then return old; else return new; end if;
end $$;

-- Consistent global lifecycle-lock ordering precedes policy row locks.
create function private.part_two_assertion_policy_lock() returns trigger language plpgsql security definer set search_path='' as $$
begin perform pg_catalog.pg_advisory_xact_lock(40204); return null; end $$;
create trigger part_two_assertion_policy_lock before update on private.part_one_policies for each statement execute function private.part_two_assertion_policy_lock();
create function private.part_two_assertion_policy_epoch() returns trigger language plpgsql set search_path='' as $$
begin
 if new.label_assertion_kinds is distinct from old.label_assertion_kinds or new.version is distinct from old.version or new.label_assertion_permission_evidence is distinct from old.label_assertion_permission_evidence then new.label_assertion_epoch:=old.label_assertion_epoch+1;
 else new.label_assertion_epoch:=old.label_assertion_epoch; end if; return new;
end $$;
create trigger part_two_assertion_policy_epoch before update on private.part_one_policies for each row execute function private.part_two_assertion_policy_epoch();
create function private.part_two_assertion_policy_projection() returns trigger language plpgsql security definer set search_path='' as $$
declare saved private.part_two_snapshots;
begin
 if new.label_assertion_epoch=old.label_assertion_epoch then return new; end if;
 for saved in select ps.* from private.part_two_snapshots ps where exists(select 1 from jsonb_array_elements(coalesce(ps.payload->'output'->'reading'->'labelAssertions','[]')) a where a->'fieldPermission'->>'policyId'=new.id) order by ps.id loop
  perform private.part_two_project_withdrawals(saved.id,saved.owner_id);
 end loop;
 update private.part_two_current pc set result=null,state='pending',build_key=null,lease_token=null,lease_expires_at=null,result_revision=result_revision+1
  where exists(select 1 from private.part_one_records rr where rr.id=any(pc.dependencies) and rr.policy_id=new.id);
 return new;
end $$;
create trigger part_two_assertion_policy_projection after update on private.part_one_policies for each row execute function private.part_two_assertion_policy_projection();
revoke all on function private.part_two_assertion_policy_lock(),private.part_two_assertion_policy_epoch(),private.part_two_assertion_policy_projection() from public,anon,authenticated;

create or replace function public.part_two_worker(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cur private.part_two_current; ctx jsonb; cfg private.part_two_config; rel private.part_two_releases; body jsonb; sid uuid; rev integer; recalled record;
begin
 if p_action='explanations/withdraw' then
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
