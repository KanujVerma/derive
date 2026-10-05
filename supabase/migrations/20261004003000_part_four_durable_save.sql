-- One canonical P3 writer remains authoritative. The original receipt hash is
-- separate from the permitted historical projection, which may lose bytes.
update private.part_four_release set permitted=false,release_hash='9dbce69bf34c84033c3913d4bf702f90cc5b4b3928bab2b3a8b45033bdd24c06' where id=true;
-- Direct service-owned source mutations must fence before their row locks too.
-- Otherwise a source FK cascade could acquire the new locks after its row,
-- while a publication held the global fence and waited for that same row.
create function private.part_four_truth_lifecycle_fence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 perform pg_catalog.pg_advisory_xact_lock(40205);
 perform pg_catalog.pg_advisory_xact_lock(40206);
 return null;
end $$;
create trigger part_four_truth_records_fence before update or delete on private.part_one_records for each statement execute function private.part_four_truth_lifecycle_fence();
create trigger part_four_truth_status_fence before insert or update or delete on private.part_one_record_status for each statement execute function private.part_four_truth_lifecycle_fence();
create trigger part_four_truth_policy_fence before update or delete on private.part_one_policies for each statement execute function private.part_four_truth_lifecycle_fence();
create trigger part_four_truth_normalization_fence before update or delete on private.part_two_snapshots for each statement execute function private.part_four_truth_lifecycle_fence();
create trigger part_four_truth_products_fence before update or delete on public.products for each statement execute function private.part_four_truth_lifecycle_fence();
create trigger part_four_truth_variants_fence before update or delete on public.product_variants for each statement execute function private.part_four_truth_lifecycle_fence();
create trigger part_four_truth_formulas_fence before update or delete on public.product_formula_versions for each statement execute function private.part_four_truth_lifecycle_fence();
create trigger part_four_truth_profiles_fence before delete on public.profiles for each statement execute function private.part_four_truth_lifecycle_fence();
create trigger part_four_truth_private_config_fence before update or delete on private.part_one_private_config for each statement execute function private.part_four_truth_lifecycle_fence();
create trigger part_four_truth_release_fence before update or delete on private.part_four_release for each statement execute function private.part_four_truth_lifecycle_fence();
create trigger part_four_truth_part_three_release_fence before update or delete on private.part_three_release for each statement execute function private.part_four_truth_lifecycle_fence();
create trigger part_four_truth_part_two_release_fence before update or delete on private.part_two_releases for each statement execute function private.part_four_truth_lifecycle_fence();
create trigger part_four_truth_results_fence before update or delete on public.part_three_results for each statement execute function private.part_four_truth_lifecycle_fence();
create trigger part_four_truth_saved_fence before insert or update or delete on public.part_three_saved_assessments for each statement execute function private.part_four_truth_lifecycle_fence();
revoke all on function private.part_four_truth_lifecycle_fence() from public,anon,authenticated;
alter table public.part_three_saved_assessments add column original_packet_hash text
 check(original_packet_hash is null or original_packet_hash ~ '^[a-f0-9]{64}$');
update public.part_three_saved_assessments set original_packet_hash=encode(extensions.digest(private.part_one_canonical_json(packet),'sha256'),'hex') where packet is not null;

create function private.part_four_packet_basis_current(p_owner uuid,p_packet jsonb,p_current boolean default true)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare evidence jsonb;
begin
 if p_packet->'partFour' is null then return true; end if;
 if p_packet->'partFour'->'routineEvidence' is null then return true; end if;
 if jsonb_typeof(p_packet->'partFour'->'routineEvidence')<>'array' or jsonb_array_length(p_packet->'partFour'->'routineEvidence')>50 then return false; end if;
 for evidence in select value from jsonb_array_elements(p_packet->'partFour'->'routineEvidence') loop
  if evidence->>'state'='ready' and not private.part_four_routine_basis_current(p_owner,evidence,p_current) then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;

create function private.part_four_saved_routine_projection(p_owner uuid,p_packet jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare evidence jsonb; projected jsonb:='[]'; insights jsonb:='[]'; insight jsonb; changed boolean:=false;
begin
 if p_packet->'partFour'->'routineEvidence' is null then return p_packet; end if;
 for evidence in select value from jsonb_array_elements(p_packet->'partFour'->'routineEvidence') loop
  if evidence->>'state'='ready' and not private.part_four_routine_basis_current(p_owner,evidence,false) then
   changed:=true;
   evidence:=jsonb_build_object('version','routine-formula-evidence/v1','request',evidence->'request','state','denied','reasonCodes',jsonb_build_array('saved_formula_authority_unavailable'));
  end if;
  projected:=projected||jsonb_build_array(evidence);
 end loop;
 if not changed then return p_packet; end if;
 for insight in select value from jsonb_array_elements(p_packet->'partFour'->'insights') loop
  if insight->>'ruleId'='F07' then
   insight:=insight||jsonb_build_object('state','unknown','title','Saved routine evidence unavailable','explanation','Routine formula evidence was shown when this check was saved. Its current source permission or exact formula authority is unavailable; co-presence is no longer displayed.','action',null,'factIds','[]'::jsonb,'occurrenceIds','[]'::jsonb,'sourceIds','[]'::jsonb);
  end if;
  insights:=insights||jsonb_build_array(insight);
 end loop;
 return jsonb_set(p_packet,'{partFour}',p_packet->'partFour'||jsonb_build_object('routineEvidence',projected,'insights',insights,'decisionState','pending','action','Review the unavailable saved evidence before relying on this check.'));
end $$;

create function private.part_four_formula_current(p_packet jsonb) returns boolean
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare refs jsonb; deps uuid[]; actor uuid;
begin
 if p_packet->'partFour' is null then return true; end if;
 perform pg_advisory_xact_lock(40203);perform pg_advisory_xact_lock(40204);perform pg_advisory_xact_lock(40205);perform pg_advisory_xact_lock(40206);
 refs:=p_packet->'partFour'->'formula'->'sourceRefs';
 actor:=(p_packet->'binding'->>'ownerId')::uuid;
 -- Reauthorize live source deadlines, including reductions after publication.
 -- Copied source dates cannot extend current source rights. No mutable P2
 -- projector is called from saved-row or lifecycle projection triggers.
 with recursive ancestry(id) as (
  select (value->>'observationId')::uuid from jsonb_array_elements(coalesce(refs,'[]'))
  union select unnest(r.dependencies||r.identity_dependencies) from private.part_one_records r join ancestry a on r.id=a.id
 ) select array_agg(id order by id) into deps from ancestry;
 if coalesce(array_length(deps,1),0)>512 then return false; end if;
 perform 1 from private.part_one_records where id=any(deps) order by id for share;
 perform 1 from private.part_one_policies where id in(select policy_id from private.part_one_records where id=any(deps)) order by id for share;
 if exists(select 1 from unnest(deps) d left join private.part_one_records r on r.id=d left join private.part_one_policies pol on pol.id=r.policy_id
  where r.id is null or r.expires_at<=clock_timestamp() or pol.expires_at<=clock_timestamp() or not private.part_one_record_allowed(d,actor)) then return false; end if;
 if p_packet->'partFour'->'formula'->'versions' is not null and not exists(select 1 from private.part_two_releases rel where rel.versions=(p_packet->'partFour'->'formula'->'versions')-'partOneParser' and rel.permitted and rel.revoked_at is null) then return false; end if;
 if (p_packet->'partFour'->'formula'->>'expiresAt')::timestamptz<=clock_timestamp()
  or (p_packet->'partFour'->'formula'->'binding'->>'expiresAt')::timestamptz<=clock_timestamp()
  or exists(select 1 from jsonb_array_elements(p_packet->'partFour'->'formula'->'sourceRefs') s where s->>'permitted' is distinct from 'true' or (s->>'expiresAt')::timestamptz<=clock_timestamp())
  or exists(select 1 from jsonb_array_elements(p_packet->'partFour'->'formula'->'facts') f where (f->>'validUntil')::timestamptz<=clock_timestamp()) then return false; end if;
 return true;
exception when others then return false;
end $$;

create function private.part_four_saved_projection_trigger() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if new.packet is null then new.original_packet_hash:=null; return new; end if;
 if tg_op='INSERT' then new.original_packet_hash:=encode(extensions.digest(private.part_one_canonical_json(new.packet),'sha256'),'hex'); end if;
 if new.packet->'partFour' is not null then
  -- New receipts reauthorize the complete displayed basis at INSERT after
  -- possible lock waits. Historical replay may project an older receipt.
  if tg_op='INSERT' and (not private.part_four_packet_basis_current(new.owner_id,new.packet,true) or not private.part_four_packet_sources_current(new.packet)) then raise exception 'PART_FOUR_CHANGED_BASIS'; end if;
  if not private.part_four_formula_current(new.packet) then
   if tg_op='INSERT' then raise exception 'PART_FOUR_CHANGED_BASIS'; end if;
   new.packet:=null;new.original_packet_hash:=null;new.binding_hash:=null;new.result_revision:=null;return new;
  end if;
  new.packet:=private.part_four_saved_routine_projection(new.owner_id,new.packet);
  new.packet:=private.part_four_retained_packet(new.packet,'retain',clock_timestamp(),private.part_four_withdrawn_dependencies());
 end if;
 return new;
end $$;
create trigger part_four_saved_projection before insert or update of packet on public.part_three_saved_assessments for each row execute function private.part_four_saved_projection_trigger();

create function private.part_four_packet_sources_current(p_packet jsonb) returns boolean
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare retained jsonb; projected jsonb; brief jsonb; source jsonb; observation jsonb; withdrawn text[];
begin
 if p_packet->'partFour' is null then return true; end if;
 if (p_packet->>'validUntil')::timestamptz<=clock_timestamp() or not private.part_four_formula_current(p_packet) then return false; end if;
 if not exists(select 1 from private.part_four_release rel where id=true and permitted and not(rel.release_hash=any(rel.withdrawn_hashes)) and not(rel.knowledge_hash=any(rel.withdrawn_hashes))
  and p_packet->'binding'->'releases'->'partFour'=jsonb_build_object('releaseId',rel.release_id,'releaseHash',rel.release_hash,'knowledgeVersion',rel.knowledge_version,'knowledgeHash',rel.knowledge_hash)) then return false; end if;
 withdrawn:=private.part_four_withdrawn_dependencies();
 retained:=p_packet->'partFour'->'retainedEvidence';
 if retained is not null then
  if not private.part_four_retained_evidence_valid(retained) then return false; end if;
  projected:=private.part_four_reproject_retained_evidence(retained,'display',clock_timestamp(),withdrawn);
  if projected->'fields' is distinct from retained->'fields' then return false; end if;
  -- Current packets are persisted too: display permission cannot authorize a
  -- cache copy whose independent store grant or retention deadline forbids it.
  projected:=private.part_four_reproject_retained_evidence(retained,'retain',clock_timestamp(),withdrawn);
  if projected->'fields' is distinct from retained->'fields' then return false; end if;
 end if;
 if p_packet->'partFour'->'value'->>'state'='ready' then
  if retained is null or jsonb_array_length(p_packet->'partFour'->'value'->'sourceIds')=0 then return false; end if;
  for source in select value from jsonb_array_elements(p_packet->'partFour'->'value'->'sourceIds') loop
   if not exists(select 1 from jsonb_array_elements(retained->'fields') f where f->>'kind'='offer_price' and f->>'state'='retained' and f->'sourceIds' ? (source#>>'{}'))
    or exists(select 1 from jsonb_array_elements(retained->'fields') f where f->>'kind' like 'offer_%' and f->'sourceIds' ? (source#>>'{}') and f->>'state'<>'retained') then return false; end if;
  end loop;
 end if;
 brief:=p_packet->'partFour'->'reviews'->'brief';
 if brief is not null then
  if retained is null or (brief->>'validUntil')::timestamptz<=clock_timestamp()
   or exists(select 1 from unnest(withdrawn) d where d in(brief->>'revision',brief->>'contentHash',brief->>'productId',brief->>'variantId',brief->>'formulaVersionId',brief->>'reviewerId')) then return false; end if;
  for source in select value from jsonb_array_elements(brief->'sources') loop
   if (source->'permission'->>'validUntil')::timestamptz<=clock_timestamp() or source->'permission'->>'revoked' is distinct from 'false' or source->'permission'->>'store' is distinct from 'true'
    or exists(select 1 from unnest(withdrawn) d where d in(source->>'id',source->'permission'->>'grantId',source->'permission'->>'version'))
    or not exists(select 1 from jsonb_array_elements(retained->'fields') f where f->>'kind'='brief_source' and f->>'state'='retained' and f->'sourceIds' ? (source->>'id') and f->'value'->>'url'=source->>'url') then return false; end if;
  end loop;
  for observation in select value from jsonb_array_elements(brief->'observations') loop
   if not exists(select 1 from jsonb_array_elements(retained->'fields') f where f->>'kind'='brief_observation' and f->>'state'='retained' and f->'value'->>'text'=observation->>'text') then return false; end if;
  end loop;
 end if;
 return true;
exception when others then return false;
end $$;

create function private.part_four_purge_retained_sources() returns void
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare withdrawn text[];
begin
 withdrawn:=private.part_four_withdrawn_dependencies();
 perform pg_advisory_xact_lock(40206);
 -- Current packets are exact visible results, not editable historical copies.
 -- Retire their bytes and force a new revision rather than silently changing a
 -- packet that an outstanding Save hash still identifies.
 update public.part_three_results set payload=null,state='pending',lease_token=null,expires_at=clock_timestamp()
 where payload->'partFour' is not null and
  (not private.part_four_packet_basis_current(owner_id,payload,true) or not private.part_four_packet_sources_current(payload));
 update public.part_three_saved_assessments set packet=private.part_four_retained_packet(private.part_four_saved_routine_projection(owner_id,packet),'retain',clock_timestamp(),withdrawn)
 where packet->'partFour' is not null;
 update public.part_three_saved_assessments set packet=null,binding_hash=null,result_revision=null where packet->'partFour' is not null and
  not exists(select 1 from private.part_four_release rel where id=true and permitted and not(rel.release_hash=any(rel.withdrawn_hashes)) and not(rel.knowledge_hash=any(rel.withdrawn_hashes))
   and packet->'binding'->'releases'->'partFour'=jsonb_build_object('releaseId',rel.release_id,'releaseHash',rel.release_hash,'knowledgeVersion',rel.knowledge_version,'knowledgeHash',rel.knowledge_hash));
end $$;
create function private.part_four_truth_projection() returns trigger
language plpgsql security definer set search_path='' as $$
begin perform private.part_four_purge_retained_sources();return null;end $$;
create trigger part_four_products_projection after update on public.products for each statement execute function private.part_four_truth_projection();
create trigger part_four_variants_projection after update on public.product_variants for each statement execute function private.part_four_truth_projection();
create trigger part_four_formulas_projection after update on public.product_formula_versions for each statement execute function private.part_four_truth_projection();
create trigger part_four_release_projection after update or delete on private.part_four_release for each statement execute function private.part_four_truth_projection();
create trigger part_four_part_two_release_projection after update or delete on private.part_two_releases for each statement execute function private.part_four_truth_projection();
create trigger part_four_policy_projection after update or delete on private.part_one_policies for each statement execute function private.part_four_truth_projection();
create trigger part_four_status_projection after insert or update or delete on private.part_one_record_status for each statement execute function private.part_four_truth_projection();
create trigger part_four_private_config_projection after update or delete on private.part_one_private_config for each statement execute function private.part_four_truth_projection();
revoke all on function private.part_four_truth_projection() from public,anon,authenticated;

alter function public.part_three_worker(uuid,text,jsonb) rename to part_three_worker_foundation_v1;
create function public.part_three_worker(p_owner uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare result jsonb; packet jsonb; saved public.part_three_saved_assessments; original_hash text; withdrawn text[];
begin
 -- EXECUTE is granted only to service_role, preserving the existing worker ACL.
 -- Statement mutation guards take the same order before any source/receipt row after the inherited lifecycle fences.
 withdrawn:=private.part_four_withdrawn_dependencies();
 perform pg_advisory_xact_lock(40206);
 perform private.part_four_purge_retained_sources();
 if p_action='routine/formulas' then return public.part_four_routine_formula_worker(p_owner,p_payload->'requests'); end if;
 if p_action='retention/maintain' then perform private.part_four_purge_retained_sources();return jsonb_build_object('kind','acknowledged'); end if;
 if p_action='publish' then
  packet:=p_payload->'result';
  if not private.part_four_packet_basis_current(p_owner,packet,true) or not private.part_four_packet_sources_current(packet) then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
  if packet->'partFour'->'retainedEvidence' is not null and not private.part_four_retained_evidence_valid(packet->'partFour'->'retainedEvidence') then raise exception 'PART_FOUR_INVALID_RETENTION'; end if;
 elsif p_action='save' then
  select * into saved from public.part_three_saved_assessments where owner_id=p_owner and request_id=(p_payload->>'requestId')::uuid;
  if found and saved.packet is not null then
   original_hash:=saved.original_packet_hash;
   if saved.packet->'partFour' is not null and p_payload->>'expectedPacketHash' is distinct from original_hash then raise exception 'PART_THREE_IDEMPOTENCY_CONFLICT'; end if;
   -- The inherited writer still validates exact receipt, owner and binding.
   -- Only its projected-packet check is translated from the original hash.
   if p_payload->>'expectedPacketHash' is not null then p_payload:=jsonb_set(p_payload,'{expectedPacketHash}',to_jsonb(encode(extensions.digest(private.part_one_canonical_json(saved.packet),'sha256'),'hex'))); end if;
  else
   select payload into packet from public.part_three_results where id=(p_payload->>'resultId')::uuid and owner_id=p_owner;
   if packet is not null and not private.part_four_packet_basis_current(p_owner,packet,true) then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
  end if;
 elsif p_action='read' then
  select payload into packet from public.part_three_results where id=(p_payload->>'resultId')::uuid and owner_id=p_owner;
  if packet is not null and not private.part_four_packet_basis_current(p_owner,packet,true) then return jsonb_build_object('kind','unavailable','reason','changed_basis'); end if;
 elsif p_action in('read_saved','saved/input') then
  update public.part_three_saved_assessments sa set packet=private.part_four_retained_packet(private.part_four_saved_routine_projection(sa.owner_id,sa.packet),'retain',clock_timestamp(),withdrawn)
  where sa.id=(p_payload->>'savedAssessmentId')::uuid and sa.owner_id=p_owner and sa.packet->'partFour' is not null;
 end if;
 result:=public.part_three_worker_foundation_v1(p_owner,p_action,p_payload);
 packet:=case when result->>'kind'='result' then result->'result' else result->'cached' end;
 if packet is not null and (not private.part_four_packet_basis_current(p_owner,packet,true) or not private.part_four_packet_sources_current(packet)) then
  perform private.part_four_purge_retained_sources();return jsonb_build_object('kind','unavailable','reason','changed_basis');
 end if;
 if result->'assessmentWhenSaved'->'partFour'->'retainedEvidence' is not null then
  result:=jsonb_set(result,'{assessmentWhenSaved,partFour,retainedEvidence}',private.part_four_reproject_retained_evidence(result->'assessmentWhenSaved'->'partFour'->'retainedEvidence','display',clock_timestamp(),withdrawn));
 end if;
 return result;
end $$;
revoke all on function public.part_three_worker(uuid,text,jsonb),public.part_three_worker_foundation_v1(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.part_three_worker(uuid,text,jsonb) to service_role;
revoke all on function private.part_four_packet_basis_current(uuid,jsonb,boolean),private.part_four_saved_routine_projection(uuid,jsonb),private.part_four_formula_current(jsonb),private.part_four_saved_projection_trigger(),private.part_four_packet_sources_current(jsonb),private.part_four_purge_retained_sources() from public,anon,authenticated;
