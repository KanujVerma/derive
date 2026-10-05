-- Explicit service-owned catalog/formula -> retained P1/P2 associations. Empty
-- and default-off: catalog ingredient arrays, names and GTINs grant no authority.
create table private.part_four_routine_authority (
 id uuid primary key default gen_random_uuid(), revision bigint not null default 1 check(revision>0),
 singleton boolean not null default true unique check(singleton),
 evaluate_allowed boolean not null default false, display_allowed boolean not null default false,
 store_allowed boolean not null default false, revoked boolean not null default false,
 expires_at timestamptz not null, permission_evidence text,
 check(not(evaluate_allowed or display_allowed or store_allowed) or permission_evidence is not null)
);
insert into private.part_four_routine_authority(expires_at) values('2099-01-01T00:00:00Z');
create table private.part_four_routine_formula_associations (
 id uuid primary key default gen_random_uuid(), revision bigint not null default 1 check(revision>0),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 variant_id uuid not null references public.product_variants(id) on delete cascade,
 formula_version_id uuid not null references public.product_formula_versions(id) on delete cascade,
 part_one_item_id uuid not null,
 part_one_snapshot_id uuid not null references private.part_one_records(id) on delete cascade,
 declaration_id uuid not null references private.part_one_records(id) on delete cascade,
 declaration_revision integer not null check(declaration_revision>0),
 part_two_snapshot_id uuid not null references private.part_two_snapshots(id) on delete cascade,
 permitted boolean not null default false, revoked boolean not null default false,
 expires_at timestamptz not null, permission_evidence text,
 check(not permitted or permission_evidence is not null)
);
create index part_four_routine_formula_exact on private.part_four_routine_formula_associations(owner_id,product_id,variant_id,formula_version_id);
create table private.part_four_routine_source_grants (
 id uuid primary key default gen_random_uuid(), revision bigint not null default 1 check(revision>0),
 association_id uuid not null references private.part_four_routine_formula_associations(id) on delete cascade,
 observation_id uuid not null references private.part_one_records(id) on delete cascade,
 source_revision integer not null check(source_revision>0),
 policy_id text not null references private.part_one_policies(id), policy_version text not null,
 evaluate_allowed boolean not null default false, display_allowed boolean not null default false,
 store_allowed boolean not null default false, revoked boolean not null default false,
 expires_at timestamptz not null, permission_evidence text,
 unique(association_id,observation_id,source_revision),
 check(not(evaluate_allowed or display_allowed or store_allowed) or permission_evidence is not null)
);
alter table private.part_four_routine_authority enable row level security;
alter table private.part_four_routine_formula_associations enable row level security;
alter table private.part_four_routine_source_grants enable row level security;
revoke all on private.part_four_routine_authority,private.part_four_routine_formula_associations,private.part_four_routine_source_grants from public,anon,authenticated;
grant all on private.part_four_routine_authority,private.part_four_routine_formula_associations,private.part_four_routine_source_grants to service_role;

-- Statement locks precede row locks; reads/publication/save and authority edits
-- share the existing deletion/withdrawal fence. Revisions cannot be supplied by
-- an updater to conceal a change to the retained association or source grant.
create function private.part_four_routine_registry_lock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 perform pg_catalog.pg_advisory_xact_lock(40205);
 perform pg_catalog.pg_advisory_xact_lock(40206);
 return null;
end $$;
create function private.part_four_routine_registry_revision() returns trigger
language plpgsql security definer set search_path='' as $$
begin new.revision:=old.revision+1; return new; end $$;
create trigger part_four_routine_authority_fence before insert or update or delete on private.part_four_routine_authority for each statement execute function private.part_four_routine_registry_lock();
create trigger part_four_routine_association_fence before insert or update or delete on private.part_four_routine_formula_associations for each statement execute function private.part_four_routine_registry_lock();
create trigger part_four_routine_source_fence before insert or update or delete on private.part_four_routine_source_grants for each statement execute function private.part_four_routine_registry_lock();
create trigger part_four_routine_authority_revision before update on private.part_four_routine_authority for each row execute function private.part_four_routine_registry_revision();
create trigger part_four_routine_association_revision before update on private.part_four_routine_formula_associations for each row execute function private.part_four_routine_registry_revision();
create trigger part_four_routine_source_revision before update on private.part_four_routine_source_grants for each row execute function private.part_four_routine_registry_revision();
-- The composition migration owns packet projection. Invoke its maintenance
-- helper when installed; absence never enables this registry or source bytes.
create function private.part_four_routine_registry_project() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if pg_catalog.to_regprocedure('private.part_four_purge_retained_sources()') is not null then
  execute 'select private.part_four_purge_retained_sources()';
 end if;
 return null;
end $$;
create trigger part_four_routine_authority_project after insert or update or delete on private.part_four_routine_authority for each statement execute function private.part_four_routine_registry_project();
create trigger part_four_routine_association_project after insert or update or delete on private.part_four_routine_formula_associations for each statement execute function private.part_four_routine_registry_project();
create trigger part_four_routine_source_project after insert or update or delete on private.part_four_routine_source_grants for each statement execute function private.part_four_routine_registry_project();

-- Match projectPersonalContextV2's routine projection, including a later legacy
-- routine editor preserving dates/use meanings that v1 cannot represent.
create function private.part_four_routine_item(p_owner uuid,p_revision uuid,p_item uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.personal_context_revisions; setup public.personal_context_revisions; item jsonb; prior jsonb; field text; date_value jsonb;
begin
 select * into r from public.personal_context_revisions where user_id=p_owner and section in('routine','setup_v2') order by revision desc limit 1;
 if not found or r.id<>p_revision then return null; end if;
 select value into item from jsonb_array_elements(case when r.section='setup_v2' then r.payload->'routine'->'items' else r.payload->'items' end) where value->>'id'=p_item::text;
 if item is null or item->>'state' not in('current','occasional') then return null; end if;
 if r.section='setup_v2' then return item; end if;
 foreach field in array array['startedOn','stoppedOn'] loop
  date_value:=case when jsonb_typeof(item->field)='string' then jsonb_build_object('state','known','value',jsonb_build_object('value',item->>field,'precision','day')) else jsonb_build_object('state','unanswered') end;
  item:=jsonb_set(item,array[field],date_value);
 end loop;
 select * into setup from public.personal_context_revisions where user_id=p_owner and section='setup_v2' order by revision desc limit 1;
 if found then
  select value into prior from jsonb_array_elements(setup.payload->'routine'->'items') where value->>'id'=p_item::text and value->'reference'=item->'reference';
  if prior is not null then
   foreach field in array array['startedOn','stoppedOn'] loop
    if item->field->>'state'='unanswered' and (prior->field->>'state'<>'known' or prior->field->'value'->>'precision'<>'day') then item:=jsonb_set(item,array[field],prior->field); end if;
   end loop;
   foreach field in array array['reportedPurpose','applicationSite','useForm'] loop
    if prior ? field then item:=item||jsonb_build_object(field,prior->field); end if;
   end loop;
  end if;
 end if;
 return item;
end $$;

create function private.part_four_routine_refusal(p_request jsonb,p_state text,p_reason text) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('version','routine-formula-evidence/v1','request',p_request,'state',p_state,'reasonCodes',jsonb_build_array(p_reason));
$$;

-- Only the service worker may call this lookup. No caller-supplied grant,
-- formula bytes, catalog ingredient array or assertion is used as authority.
-- This predicate is intentionally read-only. A saved-packet trigger must not
-- call the P2 projector: its snapshot deletion can cascade into this registry
-- and recursively update the same saved tuple. P2 owns any new projection;
-- this retained exact association fails closed when its old bytes need repair.
create function private.part_four_routine_normalization_allowed(p_snapshot uuid,p_owner uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare original private.part_two_snapshots; body jsonb; deps uuid[];
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 perform pg_catalog.pg_advisory_xact_lock(40205);
 perform pg_catalog.pg_advisory_xact_lock(40206);
 select * into original from private.part_two_snapshots where id=p_snapshot and owner_id=p_owner for share;
 if not found then return false; end if;
 with recursive ancestry(id) as (
  select unnest(original.dependencies)
  union select unnest(r.dependencies||r.identity_dependencies) from private.part_one_records r join ancestry a on r.id=a.id
 ) select array_agg(id order by id) into deps from ancestry;
 perform 1 from public.profiles where id=p_owner for share;
 perform 1 from private.part_one_records where id=any(deps) order by id for share;
 perform 1 from private.part_one_record_status where record_id=any(deps) order by record_id for share;
 perform 1 from private.part_one_policies where id in(select policy_id from private.part_one_records where id=any(deps)) order by id for share;
 perform 1 from private.part_one_captures where id=original.capture_id for share;
 perform 1 from private.part_two_releases where id=original.release_id for share;
 if original.expires_at<=clock_timestamp() or not exists(select 1 from public.profiles where id=p_owner and deletion_started_at is null)
  or exists(select 1 from unnest(original.dependencies) d where not private.part_one_record_allowed(d,p_owner))
  or not exists(select 1 from private.part_two_releases rr where rr.id=original.release_id and rr.permitted and rr.revoked_at is null)
  or original.capture_id is not null and not exists(select 1 from private.part_one_captures c where c.id=original.capture_id and c.owner_id=p_owner and c.removed_at is null)
  or exists(select 1 from unnest(deps) d left join private.part_one_records r on r.id=d left join private.part_one_policies p on p.id=r.policy_id where r.id is null or r.expires_at<=clock_timestamp() or p.expires_at<=clock_timestamp())
 then return false; end if;
 body:=original.payload;
 return coalesce(private.part_two_client_result_containers(body),false)
  and not exists(select 1 from jsonb_array_elements(coalesce(body->'output'->'reading'->'facts','[]')) f where private.part_two_card_withdrawn(f,body->'output'->'reading'))
  and not exists(select 1 from jsonb_array_elements(coalesce(body->'output'->'productFacts'->'facts','[]')) f where private.part_two_card_withdrawn(f,body->'output'->'productFacts'))
  and coalesce(private.part_two_assertion_snapshot_allowed(body->'output'->'reading',p_owner),false)
  and coalesce(private.part_two_assertion_snapshot_allowed(body->'output'->'productFacts',p_owner),false);
end $$;

create function private.part_four_routine_formula_lookup(p_owner uuid,p_request jsonb,p_require_current_context boolean default true) returns jsonb
language plpgsql security definer set search_path='' as $$
declare rel private.part_four_release; authority private.part_four_routine_authority;
 assoc private.part_four_routine_formula_associations; snap private.part_two_snapshots;
 declaration private.part_one_records; identity_snapshot private.part_one_records; source private.part_one_records;
 grant_row private.part_four_routine_source_grants; policy private.part_one_policies;
 head bigint; item jsonb; body jsonb; binding jsonb; facts jsonb; ref jsonb; source_refs jsonb;
 permissions jsonb:='[]'; source_ids jsonb; assoc_json jsonb; authority_json jsonb; n integer; deadline timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 perform pg_catalog.pg_advisory_xact_lock(40205);
 perform pg_catalog.pg_advisory_xact_lock(40206);
 perform private.part_three_owner(p_owner);
 if jsonb_typeof(p_request) is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(p_request) k where k not in('version','ownerId','contextRevision','routineRevisionId','routineItemId','routineItemHash','reference','knowledgeVersion','knowledgeHash'))
  or p_request->>'version' is distinct from 'routine-formula-request/v1'
  or jsonb_typeof(p_request->'reference') is distinct from 'object'
  or exists(select 1 from jsonb_object_keys(p_request->'reference') k where k not in('kind','productId','variantId','formulaVersionId'))
  or p_request->'reference'->>'kind' is distinct from 'catalog'
  or coalesce(p_request->>'routineItemHash','') !~ '^[a-f0-9]{64}$' or coalesce(p_request->>'knowledgeHash','') !~ '^[a-f0-9]{64}$'
  or p_request->>'knowledgeVersion' is null or length(p_request->>'knowledgeVersion')>200
  or jsonb_typeof(p_request->'contextRevision') is distinct from 'number' or coalesce(p_request->>'contextRevision','') !~ '^[0-9]+$' or (p_request->>'contextRevision')::numeric>9007199254740991
 then raise exception 'PART_FOUR_INVALID_ROUTINE_REQUEST'; end if;
 -- Validate required UUIDs before emitting an envelope accepted by the contract.
 perform coalesce(p_request->>'ownerId','')::uuid,coalesce(p_request->>'routineRevisionId','')::uuid,coalesce(p_request->>'routineItemId','')::uuid,
  coalesce(p_request->'reference'->>'productId','')::uuid,coalesce(p_request->'reference'->>'variantId','')::uuid,coalesce(p_request->'reference'->>'formulaVersionId','')::uuid;
 if p_request->>'ownerId' is distinct from p_owner::text then return private.part_four_routine_refusal(p_request,'denied','routine_owner_mismatch'); end if;
 select * into rel from private.part_four_release where id=true for share;
 if not found or not rel.permitted or rel.release_hash=any(rel.withdrawn_hashes) or rel.knowledge_hash=any(rel.withdrawn_hashes)
  or rel.knowledge_version is distinct from p_request->>'knowledgeVersion' or rel.knowledge_hash is distinct from p_request->>'knowledgeHash'
 then return private.part_four_routine_refusal(p_request,'denied','shared_knowledge_unavailable'); end if;
 if p_require_current_context then
  select revision into head from public.personal_context_heads where user_id=p_owner for share;
  if coalesce(head,0) is distinct from (p_request->>'contextRevision')::bigint then return private.part_four_routine_refusal(p_request,'stale','routine_context_changed'); end if;
  item:=private.part_four_routine_item(p_owner,(p_request->>'routineRevisionId')::uuid,(p_request->>'routineItemId')::uuid);
  if item is null or item->'reference' is distinct from p_request->'reference'
   or encode(extensions.digest(private.part_one_canonical_json(item),'sha256'),'hex') is distinct from p_request->>'routineItemHash'
  then return private.part_four_routine_refusal(p_request,'conflict','routine_item_changed'); end if;
 end if;
 select * into authority from private.part_four_routine_authority where singleton for share;
 if not found or authority.revoked or not authority.evaluate_allowed or not authority.display_allowed or not authority.store_allowed
 then return private.part_four_routine_refusal(p_request,'denied','formula_authority_denied'); end if;
 if authority.expires_at<=clock_timestamp() then return private.part_four_routine_refusal(p_request,'stale','formula_authority_stale'); end if;
 -- Check immutable catalog relations, never infer a formula from its name.
 perform 1 from public.products p join public.product_variants v on v.product_id=p.id join public.product_formula_versions f on f.variant_id=v.id
  where p.id=(p_request->'reference'->>'productId')::uuid and v.id=(p_request->'reference'->>'variantId')::uuid and f.id=(p_request->'reference'->>'formulaVersionId')::uuid
  and p.is_catalog_standard and p.catalog_verified_at is not null and v.catalog_verification_status='verified' and v.lifecycle_status='active'
  and f.verification_status in('verified','superseded') and f.provenance_type in('manufacturer','package_label','regulator','founder_review') for share of p,v,f;
 if not found then return private.part_four_routine_refusal(p_request,'conflict','exact_catalog_formula_unavailable'); end if;
 select count(*) into n from private.part_four_routine_formula_associations a where a.owner_id=p_owner
  and a.product_id=(p_request->'reference'->>'productId')::uuid and a.variant_id=(p_request->'reference'->>'variantId')::uuid and a.formula_version_id=(p_request->'reference'->>'formulaVersionId')::uuid;
 if n=0 then return private.part_four_routine_refusal(p_request,'missing','authorized_formula_association_missing'); end if;
 if n<>1 then return private.part_four_routine_refusal(p_request,'conflict','multiple_formula_associations'); end if;
 select * into assoc from private.part_four_routine_formula_associations a where a.owner_id=p_owner
  and a.product_id=(p_request->'reference'->>'productId')::uuid and a.variant_id=(p_request->'reference'->>'variantId')::uuid and a.formula_version_id=(p_request->'reference'->>'formulaVersionId')::uuid for share;
 if not assoc.permitted or assoc.revoked then return private.part_four_routine_refusal(p_request,'denied','formula_association_denied'); end if;
 if assoc.expires_at<=clock_timestamp() then return private.part_four_routine_refusal(p_request,'stale','formula_association_stale'); end if;
 select * into declaration from private.part_one_records where id=assoc.declaration_id and kind='declaration' for share;
 select * into identity_snapshot from private.part_one_records where id=assoc.part_one_snapshot_id and kind='snapshot' for share;
 if declaration.id is null or identity_snapshot.id is null or declaration.item_id is distinct from assoc.part_one_item_id or identity_snapshot.item_id is distinct from assoc.part_one_item_id
  or declaration.revision<>assoc.declaration_revision or not coalesce(identity_snapshot.payload->'declarationIds' ? declaration.id::text,false)
  or declaration.scope is distinct from identity_snapshot.scope
 then return private.part_four_routine_refusal(p_request,'conflict','part_one_association_mismatch'); end if;
 if not private.part_one_record_allowed(declaration.id,p_owner) or not private.part_one_record_allowed(identity_snapshot.id,p_owner)
 then return private.part_four_routine_refusal(p_request,'denied','part_one_formula_unavailable'); end if;
 select * into snap from private.part_two_snapshots where id=assoc.part_two_snapshot_id and owner_id=p_owner;
 if not found then return private.part_four_routine_refusal(p_request,'unavailable','normalization_snapshot_missing'); end if;
 if snap.expires_at<=clock_timestamp() then return private.part_four_routine_refusal(p_request,'stale','normalization_expired'); end if;
 if not private.part_four_routine_normalization_allowed(snap.id,p_owner)
 then return private.part_four_routine_refusal(p_request,'unavailable','normalization_requires_authoritative_projection'); end if;
 body:=snap.payload;
 if body->>'state'='pending' then return private.part_four_routine_refusal(p_request,'pending','normalization_pending'); end if;
 if body->>'state'<>'ready' or body->'output'->>'kind'<>'bound' then return private.part_four_routine_refusal(p_request,'unavailable','normalization_not_bound'); end if;
 -- Saved P2 envelopes omit transport requestId; restore its existing literal
 -- binding only, without manufacturing a request or changing source visibility.
 if body->>'requestId' is null then body:=body||jsonb_build_object('requestId',body->'output'->'reading'->'binding'->>'requestId'); end if;
 facts:=body->'output'->'productFacts'; binding:=facts->'binding';
 if body->>'authenticatedOwnerId' is distinct from p_owner::text or body->>'bindingKey' is distinct from snap.binding_key
  or binding->>'kind' is distinct from 'declaration' or binding->>'itemId' is distinct from assoc.part_one_item_id::text
  or binding->>'snapshotId' is distinct from assoc.part_one_snapshot_id::text or binding->>'declarationId' is distinct from assoc.declaration_id::text
  or binding->>'declarationRevision' is distinct from assoc.declaration_revision::text
  or facts->>'scope' is distinct from declaration.scope or facts->>'scope'='private_package' and binding->>'ownerId' is distinct from p_owner::text
 then return private.part_four_routine_refusal(p_request,'conflict','normalization_association_mismatch'); end if;
 if facts->>'evidenceState'='conflict' or body->'output'->'reading'->>'evidenceState'='conflict' then return private.part_four_routine_refusal(p_request,'conflict','formula_evidence_conflict'); end if;
 if facts->>'evidenceState'='blocked' or body->'output'->'reading'->>'evidenceState'='blocked' then return private.part_four_routine_refusal(p_request,'denied','formula_evidence_blocked'); end if;
 source_refs:=facts->'dependencyManifest'->'sourceRefs';
 if jsonb_typeof(source_refs) is distinct from 'array' or jsonb_array_length(source_refs)=0 or jsonb_array_length(source_refs)>1000
 then return private.part_four_routine_refusal(p_request,'unavailable','formula_source_manifest_missing'); end if;
 if exists(select 1 from jsonb_array_elements(source_refs) r group by r->>'observationId',r->>'sourceRevision' having count(*)>1)
 then return private.part_four_routine_refusal(p_request,'conflict','duplicate_formula_source'); end if;
 if jsonb_array_length(source_refs)<>(select count(*) from private.part_four_routine_source_grants where association_id=assoc.id)
 then return private.part_four_routine_refusal(p_request,'denied','formula_source_authorization_missing'); end if;
 deadline:=least(authority.expires_at,assoc.expires_at,snap.expires_at);
 for ref in select value from jsonb_array_elements(source_refs) loop
  select * into grant_row from private.part_four_routine_source_grants where association_id=assoc.id and observation_id=(ref->>'observationId')::uuid and source_revision=(ref->>'sourceRevision')::integer for share;
  if not found or grant_row.policy_id is distinct from ref->>'policyId' or grant_row.policy_version is distinct from ref->>'policyVersion'
  then return private.part_four_routine_refusal(p_request,'denied','formula_source_authorization_mismatch'); end if;
  select * into source from private.part_one_records where id=grant_row.observation_id and kind='observation' for share;
  select * into policy from private.part_one_policies where id=grant_row.policy_id for share;
  if source.id is null or source.revision<>grant_row.source_revision or source.policy_id<>grant_row.policy_id or source.policy_version<>grant_row.policy_version
   or policy.version is distinct from grant_row.policy_version or not policy.retain_allowed or not policy.display_allowed
   or grant_row.revoked or not grant_row.evaluate_allowed or not grant_row.display_allowed or not grant_row.store_allowed
   or not private.part_one_record_allowed(grant_row.observation_id,p_owner)
  then return private.part_four_routine_refusal(p_request,'denied','formula_source_permission_denied'); end if;
  if grant_row.expires_at<=clock_timestamp() or (ref->>'expiresAt')::timestamptz<=clock_timestamp() then return private.part_four_routine_refusal(p_request,'stale','formula_source_expired'); end if;
  deadline:=least(deadline,grant_row.expires_at,source.expires_at,policy.expires_at,(ref->>'expiresAt')::timestamptz);
  permissions:=permissions||jsonb_build_array(jsonb_build_object('observationId',source.id,'sourceRevision',source.revision,'policyId',policy.id,'policyVersion',policy.version,'grantId',grant_row.id,'grantVersion',grant_row.revision::text,'evaluate',true,'display',true,'store',true,'revoked',false,'validUntil',private.part_one_utc(least(grant_row.expires_at,source.expires_at,policy.expires_at))));
 end loop;
 select jsonb_agg(distinct value->>'observationId' order by value->>'observationId') into source_ids from jsonb_array_elements(source_refs);
 assoc_json:=jsonb_build_object('id',assoc.id,'revision',assoc.revision,'reference',p_request->'reference','partOneItemId',assoc.part_one_item_id,'partOneSnapshotId',assoc.part_one_snapshot_id,'declarationId',assoc.declaration_id,'declarationRevision',assoc.declaration_revision,'partTwoSnapshotId',snap.id,'partTwoBindingKey',snap.binding_key,'partTwoRevision',snap.result_revision,'dependencyDigest',binding->>'dependencyDigest','sourceDependencies',source_ids,'validUntil',private.part_one_utc(assoc.expires_at),'revoked',false);
 -- Recheck after every catalog/source/grant lock wait using the wall clock.
 if deadline<=clock_timestamp() or not private.part_four_routine_normalization_allowed(snap.id,p_owner)
 then return private.part_four_routine_refusal(p_request,'stale','formula_basis_expired'); end if;
 authority_json:=jsonb_build_object('authorityId',authority.id,'authorityRevision',authority.revision,'checkedAt',private.part_one_utc(clock_timestamp()),'validUntil',private.part_one_utc(deadline),'evaluate',true,'display',true,'store',true,'revoked',false,'withdrawnDependencies',to_jsonb(rel.withdrawn_hashes),'sourcePermissions',permissions);
 return jsonb_build_object('version','routine-formula-evidence/v1','request',p_request,'state','ready','association',assoc_json,'authorization',authority_json,'partTwo',body);
exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
 raise exception 'PART_FOUR_INVALID_ROUTINE_REQUEST';
end $$;

create function public.part_four_routine_formula_worker(p_owner uuid,p_requests jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare request jsonb; result jsonb:='[]';
begin
 if jsonb_typeof(p_requests) is distinct from 'array' or jsonb_array_length(p_requests)>50 or octet_length(p_requests::text)>100000 then raise exception 'PART_FOUR_INVALID_ROUTINE_REQUEST'; end if;
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 perform pg_catalog.pg_advisory_xact_lock(40205);
 perform pg_catalog.pg_advisory_xact_lock(40206);
 perform private.part_three_owner(p_owner);
 if exists(select 1 from jsonb_array_elements(p_requests) r group by r->>'routineItemId' having count(*)>1) then raise exception 'PART_FOUR_DUPLICATE_ROUTINE_REQUEST'; end if;
 for request in select value from jsonb_array_elements(p_requests) loop result:=result||jsonb_build_array(private.part_four_routine_formula_lookup(p_owner,request,true)); end loop;
 return result;
end $$;

-- p_require_current_context=false is for immutable saved history only. It
-- skips routine-currentness, never owner/source/grant/catalog/knowledge checks.
-- Compare the entire authorized packet except the fresh check timestamp, so a
-- revision/expiry/source projection change cannot continue using copied bytes.
create function private.part_four_routine_basis_current(p_owner uuid,p_evidence jsonb,p_require_current_context boolean default true) returns boolean
language plpgsql security definer set search_path='' as $$
declare fresh jsonb;
begin
 if p_evidence->>'version' is distinct from 'routine-formula-evidence/v1' or p_evidence->>'state' is distinct from 'ready' then return false; end if;
 fresh:=private.part_four_routine_formula_lookup(p_owner,p_evidence->'request',p_require_current_context);
 return fresh->>'state'='ready' and (fresh#-'{authorization,checkedAt}')=(p_evidence#-'{authorization,checkedAt}');
exception when others then return false;
end $$;
revoke all on function private.part_four_routine_registry_lock(),private.part_four_routine_registry_revision(),private.part_four_routine_registry_project(),private.part_four_routine_item(uuid,uuid,uuid),private.part_four_routine_refusal(jsonb,text,text),private.part_four_routine_normalization_allowed(uuid,uuid),private.part_four_routine_formula_lookup(uuid,jsonb,boolean),private.part_four_routine_basis_current(uuid,jsonb,boolean),public.part_four_routine_formula_worker(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.part_four_routine_formula_worker(uuid,jsonb),private.part_four_routine_basis_current(uuid,jsonb,boolean) to service_role;
