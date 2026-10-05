-- Withdrawal-safe client literal roots: full observation text stays server-side.
-- A projected root retains exact source SHA256/global UTF16 authority, never all
-- label fields copied under another still-permitted grant. Historical saved
-- copies are sanitized into new immutable higher-revision projections on read.
create or replace function private.part_two_label_allowed(a jsonb,p_owner uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare pp private.part_one_policies; o private.part_one_records; perm jsonb:=a->'fieldPermission'; annotation jsonb; raw_text text;
begin
 -- Client roots are finite literal projections, never complete source copies.
 if jsonb_typeof(a)<>'object' or not a ?& array['assertionId','assertionKind','text','span','sourceTextHash','transcription','conditional','fieldPermission']
  or a-array['assertionId','assertionKind','text','span','sourceTextHash','transcription','conditional','fieldPermission']<>'{}'::jsonb
  or jsonb_typeof(a->'span')<>'object' or not (a->'span') ?& array['observationId','sourceRevision','sectionId','entryId','start','end','raw']
  or (a->'span')-array['observationId','sourceRevision','sectionId','entryId','start','end','raw']<>'{}'::jsonb
  or jsonb_typeof(perm)<>'object' or not perm ?& array['policyId','policyVersion','assertionKind','policyEpoch','expiresAt','permitted']
  or perm-array['policyId','policyVersion','assertionKind','policyEpoch','expiresAt','permitted']<>'{}'::jsonb
  or jsonb_typeof(perm->'permitted')<>'boolean' or jsonb_typeof(perm->'policyEpoch')<>'number'
  or jsonb_typeof(a->'span'->'sourceRevision')<>'number' or jsonb_typeof(a->'span'->'start')<>'number' or jsonb_typeof(a->'span'->'end')<>'number'
  or coalesce(a->>'sourceTextHash','')!~'^[a-f0-9]{64}$' or a->'conditional' not in ('null'::jsonb,'"conditional"'::jsonb) then return false; end if;
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
 raw_text:=coalesce(o.payload->>'rawText',o.payload->'payload'->>'rawIngredients',o.payload->>'rawIngredients',o.payload->'observation'->>'text');
 if raw_text is null or encode(extensions.digest(raw_text,'sha256'),'hex') is distinct from a->>'sourceTextHash'
  or a->'span'->>'raw' is distinct from a->>'text'
  or a->'span'->>'sectionId' is distinct from 'label:'||o.id::text
  or a->'span'->'entryId'<>'null'::jsonb and a->'span'->>'entryId' is distinct from a->>'assertionId'
  or private.part_two_utf16_slice(raw_text,(a->'span'->>'start')::integer,(a->'span'->>'end')::integer) is distinct from a->>'text' then return false; end if;
 for annotation in select value from jsonb_array_elements(coalesce(o.payload->'labelAssertions','[]')) loop
  if annotation->>'assertionId'=a->>'assertionId' and annotation->>'assertionKind'=a->>'assertionKind' and annotation->>'text'=a->>'text'
   and annotation->>'start'=a->'span'->>'start' and annotation->>'end'=a->'span'->>'end'
   and annotation->>'transcription'=a->>'transcription' and (case when annotation->'conditional'='null'::jsonb then 'null'::jsonb else '"conditional"'::jsonb end) is not distinct from a->'conditional' then return true; end if;
 end loop;
 return false;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value or invalid_datetime_format or datetime_field_overflow then return false;
end $$;
create or replace function private.part_two_current_label_root(a jsonb,p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare pp private.part_one_policies; o private.part_one_records; candidate jsonb; raw_text text; hash text; annotation jsonb; marker jsonb;
begin
 select * into pp from private.part_one_policies where id=a->'fieldPermission'->>'policyId';
 if not found then return null; end if;
 select * into o from private.part_one_records where id=(a->'span'->>'observationId')::uuid and kind='observation';
 if not found then return null; end if;
 raw_text:=coalesce(o.payload->>'rawText',o.payload->'payload'->>'rawIngredients',o.payload->>'rawIngredients',o.payload->'observation'->>'text');
 if raw_text is null then return null; end if; hash:=encode(extensions.digest(raw_text,'sha256'),'hex');
 -- Historical full-source roots are verified against the original retained bytes
 -- before projection. No client-provided replacement text or default can qualify.
 if a ? 'sourceText' and (jsonb_typeof(a->'sourceText')<>'string' or a->>'sourceText' is distinct from raw_text) then return null; end if;
 if a ? 'sourceTextHash' and a->>'sourceTextHash' is distinct from hash then return null; end if;
 if not a ? 'sourceText' and not a ? 'sourceTextHash' then return null; end if;
 select value into annotation from jsonb_array_elements(coalesce(o.payload->'labelAssertions','[]')) value
  where value->>'assertionId'=a->>'assertionId' and value->>'assertionKind'=a->>'assertionKind' and value->>'text'=a->>'text'
   and value->>'start'=a->'span'->>'start' and value->>'end'=a->'span'->>'end' and value->>'transcription'=a->>'transcription' limit 1;
 if not found then return null; end if;
 marker:=case when annotation->'conditional'='null'::jsonb then 'null'::jsonb else '"conditional"'::jsonb end;
 if a ? 'sourceText' then
  if a->'conditional' is distinct from annotation->'conditional' then return null; end if;
 elsif a->'conditional' is distinct from marker then return null; end if;

 candidate:=jsonb_build_object('assertionId',a->'assertionId','assertionKind',a->'assertionKind','text',a->'text','span',jsonb_build_object('observationId',a->'span'->'observationId','sourceRevision',a->'span'->'sourceRevision',
   'sectionId','label:'||o.id::text,'entryId',case when a->'span'->'entryId'='null'::jsonb then 'null'::jsonb else a->'assertionId' end,
   'start',a->'span'->'start','end',a->'span'->'end','raw',a->'span'->'raw'),
  'sourceTextHash',hash,'transcription',a->'transcription','conditional',marker,'fieldPermission',
  jsonb_build_object('policyId',a->'fieldPermission'->'policyId','policyVersion',a->'fieldPermission'->'policyVersion',
   'assertionKind',a->'fieldPermission'->'assertionKind','policyEpoch',pp.label_assertion_epoch,
   'expiresAt',a->'fieldPermission'->'expiresAt','permitted',a->'fieldPermission'->'permitted'));
 if private.part_two_label_allowed(candidate,p_owner) then return candidate; end if; return null;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return null;
end $$;
create or replace function private.part_two_label_root_bound(a jsonb,snapshot jsonb,p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not a ? 'sourceText' and exists(select 1 from private.part_one_records d where d.kind='declaration' and d.id::text=snapshot->'binding'->>'declarationId'
  and d.revision::text=snapshot->'binding'->>'declarationRevision' and d.item_id::text=snapshot->'binding'->>'itemId'
  and d.scope=snapshot->'binding'->>'scope' and d.owner_id::text is not distinct from snapshot->'binding'->>'ownerId'
  and (d.scope='public' or d.owner_id=p_owner) and private.part_one_record_allowed(d.id,p_owner)
  and d.payload->'predicate'->'association'->>'passed'='true' and d.payload->'observationIds' ? (a->'span'->>'observationId')
  and exists(select 1 from unnest(d.dependencies) dep where dep::text=a->'span'->>'observationId'))
  and exists(select 1 from jsonb_array_elements(coalesce(snapshot->'binding'->'observations','[]')) obs where obs->>'observationId'=a->'span'->>'observationId' and obs->>'revision'=a->'span'->>'sourceRevision')
  and exists(select 1 from jsonb_array_elements(coalesce(snapshot->'dependencyManifest'->'sourceRefs','[]')) ref where ref->>'observationId'=a->'span'->>'observationId' and ref->>'sourceRevision'=a->'span'->>'sourceRevision'
    and ref->>'sourceTextHash'=a->>'sourceTextHash');
$$;
create function private.part_two_projection_keys(value jsonb,keys text[]) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(key,val),'{}') from jsonb_each(value) entries(key,val) where key=any(keys);
$$;
create function private.part_two_client_manifest(value jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select private.part_two_projection_keys(value,array['sourceRefs','dictionaryRecordIds','dictionaryHash','labelAssertionPermissions','withdrawnExplanationDependencies','explanationPolicies','dependencyDigest','deletionEpoch','policyEpoch','dictionaryEpoch'])
  ||jsonb_build_object('sourceRefs',(select coalesce(jsonb_agg(private.part_two_projection_keys(ref,array['observationId','sourceRevision','contentHash','sourceTextHash','policyId','policyVersion','evidenceBasis','observedAt','sourceUpdatedAt','expiresAt','permitted','sourceUrl','attribution']) order by ord),'[]') from jsonb_array_elements(coalesce(value->'sourceRefs','[]')) with ordinality entries(ref,ord)));
$$;
create function private.part_two_utf16_length(value text) returns integer
language sql immutable set search_path='' as $$select coalesce(sum(case when octet_length(ch)>3 then 2 else 1 end),0)::integer from regexp_split_to_table(value,'') ch where ch<>'';$$;
create function private.part_two_literal_slice(t text,a integer,b integer) returns text
language plpgsql immutable set search_path='' as $$
declare ch text; n integer:=0; width integer; result text:='';
begin
 if a<0 or b<a or b-a>262144 or char_length(t)>262144 then return null; end if;
 foreach ch in array string_to_array(t,null) loop
  width:=case when ascii(ch)>65535 then 2 else 1 end;
  if (a>n and a<n+width) or (b>n and b<n+width) then return null; end if;
  if n>=a and n+width<=b then result:=result||ch; end if;
  n:=n+width; if n>=b then exit; end if;
 end loop;
 if n<b then return null; end if;return result;
end $$;
create function private.part_two_current_literal(literal jsonb,snapshot jsonb,p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d private.part_one_records; o private.part_one_records; section jsonb; first_entry jsonb; first_span jsonb; raw_text text; candidate jsonb; source_offset integer;
begin
 if snapshot->'binding'->>'kind'='declaration' then
  select * into d from private.part_one_records where kind='declaration' and id::text=snapshot->'binding'->>'declarationId' and revision::text=snapshot->'binding'->>'declarationRevision';
  if not found or not private.part_one_record_allowed(d.id,p_owner) then return null; end if;
  select value into section from jsonb_array_elements(coalesce(d.payload->'structuredSections',d.payload->'sections','[]')) value where value->>'sectionId'=literal->>'sectionId' and jsonb_array_length(coalesce(value->'entries','[]'))>0 limit 1;
  if not found then return null; end if;
  first_entry:=section->'entries'->0;first_span:=first_entry->'sourceSpans'->0;
  if first_span->>'observationId' is distinct from literal->>'observationId' or first_span->>'sourceRevision' is distinct from literal->>'sourceRevision' or position(first_entry->>'rawToken' in section->>'rawText')=0 then return null; end if;
  source_offset:=(first_span->>'start')::integer-private.part_two_utf16_length(substring(section->>'rawText' from 1 for position(first_entry->>'rawToken' in section->>'rawText')-1));
  candidate:=jsonb_build_object('sectionId',section->'sectionId','kind',section->'kind','rawText',section->'rawText','sourceOffset',source_offset,'observationId',first_span->'observationId','sourceRevision',first_span->'sourceRevision');
 else
  if snapshot->'binding'->>'kind'<>'capture' then return null; end if;
  candidate:=private.part_two_projection_keys(literal,array['sectionId','kind','rawText','sourceOffset','observationId','sourceRevision']);
 end if;
 select * into o from private.part_one_records where id::text=candidate->>'observationId' and revision::text=candidate->>'sourceRevision' and kind='observation';
 if not found or not private.part_one_record_allowed(o.id,p_owner) or o.scope='private_package' and o.owner_id is distinct from p_owner
  or not exists(select 1 from jsonb_array_elements(coalesce(snapshot->'binding'->'observations','[]')) ref where ref->>'observationId'=o.id::text and ref->>'revision'=o.revision::text) then return null; end if;
 raw_text:=coalesce(o.payload->>'rawText',o.payload->'payload'->>'rawIngredients',o.payload->>'rawIngredients',o.payload->'observation'->>'text');
 if private.part_two_literal_slice(raw_text,(candidate->>'sourceOffset')::integer,(candidate->>'sourceOffset')::integer+private.part_two_utf16_length(candidate->>'rawText')) is distinct from candidate->>'rawText' then return null; end if;
 return candidate;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return null;
end $$;
create function private.part_two_literal_snapshot_allowed(snapshot jsonb,p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from jsonb_array_elements(coalesce(snapshot->'literalSections','[]')) literal where private.part_two_current_literal(literal,snapshot,p_owner) is distinct from literal);
$$;
create function private.part_two_client_fact_value(f jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select private.part_two_projection_keys(f->'value',case f->>'kind'
 when 'declared_ingredient' then array['rawName','order','sectionKind','modality']
 when 'resolved_ingredient_identity' then array['ingredientId','aliasRecordId']
 when 'declared_quantity' then array['span','value','min','max','operator','unit','basis','subject','status','reasons','convertedPercentWw']
 when 'product_label_assertion' then array['text','attribution','assertionKind']
 when 'reference_function' then array['roleId','explanationId','explanationRevision','sentence','reviewDate','evidenceKind','sourceUrl','sourceAttribution','licenseUrl','roleDefinitionUrl','reviewOwner','policyId','policyHash','sourceInventoryHash']
 else '{}'::text[] end);
$$;

create function private.part_two_client_snapshot_containers(snapshot jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select snapshot is null or snapshot= 'null'::jsonb or (
  snapshot-array['schemaVersion','snapshotId','binding','scope','evidenceState','evidenceBasis','packageConfirmation','claimLimits','literalSections','labelAssertions','occurrences','facts','unresolvedSpans','blockers','versions','dependencyManifest','observedAt','sourceUpdatedAt','createdAt','expiresAt']='{}'::jsonb
  and coalesce(snapshot->'dependencyManifest','{}')=private.part_two_client_manifest(coalesce(snapshot->'dependencyManifest','{}'))
  and coalesce(snapshot->'dependencyManifest'->'labelAssertionPermissions','[]')=(select coalesce(jsonb_agg(a->'fieldPermission'||jsonb_build_object('assertionId',a->>'assertionId') order by ord),'[]') from jsonb_array_elements(coalesce(snapshot->'labelAssertions','[]')) with ordinality entries(a,ord))
  and not exists(select 1 from jsonb_array_elements(coalesce(snapshot->'literalSections','[]')) literal where literal-array['sectionId','kind','rawText','sourceOffset','observationId','sourceRevision']<>'{}'::jsonb)
  and not exists(select 1 from jsonb_array_elements(coalesce(snapshot->'facts','[]')) f where f->'value' is distinct from private.part_two_client_fact_value(f) or f-array['factId','occurrenceId','spans','rule','sourceDependencies','dictionaryDependencies','limitations','validUntil','kind','subject','value']<>'{}'::jsonb));
$$;
create function private.part_two_client_result_containers(body jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select body-array['schemaVersion','requestId','authenticatedOwnerId','scanId','captureSessionId','bindingKey','generation','evidenceRevision','resultRevision','expiresAt','state','output','reasonCodes','permittedText']='{}'::jsonb
  and (body->>'state'<>'ready' or (not body ? 'permittedText' and not body ? 'reasonCodes' and (body->'output')-array['kind','reading','productFacts']='{}'::jsonb and private.part_two_client_snapshot_containers(body->'output'->'reading') and private.part_two_client_snapshot_containers(body->'output'->'productFacts')));
$$;

create or replace function private.part_two_label_fact_allowed(f jsonb,snapshot jsonb,p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select f->>'kind'<>'product_label_assertion' or exists(select 1 from jsonb_array_elements(coalesce(snapshot->'labelAssertions','[]')) a
  where (f->'subject')-array['kind','assertionId','declarationId','declarationRevision']='{}'::jsonb
  and (f->'value')-array['text','attribution','assertionKind']='{}'::jsonb
  and a->>'assertionId'=f->'subject'->>'assertionId' and private.part_two_label_allowed(a,p_owner) and private.part_two_label_root_bound(a,snapshot,p_owner)
  and f->'subject'->>'kind'='bound_label_assertion' and f->'subject'->>'declarationId'=snapshot->'binding'->>'declarationId'
  and f->'subject'->>'declarationRevision'=snapshot->'binding'->>'declarationRevision' and f->>'occurrenceId'=a->>'assertionId'
  and f->'value'->>'text'=a->>'text' and f->'value'->>'assertionKind'=a->>'assertionKind' and f->'value'->>'attribution'='label_says'
  and f->'spans'=jsonb_build_array(a->'span') and f->'sourceDependencies'=jsonb_build_array(a->'span'->>'observationId')
  and f->'dictionaryDependencies'='[]'::jsonb and f->'limitations' ?& array['label_claim_not_verified','no_ingredient_absence_inference']
  and a->>'transcription'='clear' and a->'conditional'='null'::jsonb);
$$;
create or replace function private.part_two_assertion_snapshot_allowed(snapshot jsonb,p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.part_two_client_snapshot_containers(snapshot) and private.part_two_literal_snapshot_allowed(snapshot,p_owner) and not exists(select 1 from jsonb_array_elements(coalesce(snapshot->'labelAssertions','[]')) a where not private.part_two_label_allowed(a,p_owner) or not private.part_two_label_root_bound(a,snapshot,p_owner))
  and not exists(select 1 from jsonb_array_elements(coalesce(snapshot->'facts','[]')) f where not private.part_two_label_fact_allowed(f,snapshot,p_owner));
$$;

create function private.part_two_current_label_fact(f jsonb,original_snapshot jsonb,projected_snapshot jsonb,p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a jsonb; root jsonb; candidate jsonb;
begin
 if f->>'kind'<>'product_label_assertion' then return private.part_two_projection_keys(f,array['factId','occurrenceId','spans','rule','sourceDependencies','dictionaryDependencies','limitations','validUntil','kind','subject','value'])||jsonb_build_object('value',private.part_two_client_fact_value(f)); end if;
 select value into a from jsonb_array_elements(coalesce(original_snapshot->'labelAssertions','[]')) value where value->>'assertionId'=f->'subject'->>'assertionId' and f->'spans'=jsonb_build_array(value->'span') limit 1;
 if not found then return null; end if; root:=private.part_two_current_label_root(a,p_owner); if root is null then return null; end if;
 candidate:=private.part_two_projection_keys(f,array['factId','occurrenceId','spans','rule','sourceDependencies','dictionaryDependencies','limitations','validUntil','kind','subject','value'])||jsonb_build_object('spans',jsonb_build_array(root->'span'),
  'subject',private.part_two_projection_keys(f->'subject',array['kind','assertionId','declarationId','declarationRevision']),'value',private.part_two_projection_keys(f->'value',array['text','attribution','assertionKind']));
 if private.part_two_label_fact_allowed(candidate,projected_snapshot,p_owner) then return candidate; end if;return null;
end $$;

create or replace function private.part_two_project_withdrawals(p_snapshot uuid,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare original private.part_two_snapshots; cur private.part_two_current; body jsonb; section jsonb; reading jsonb; facts jsonb; manifest jsonb; ids jsonb; withdrawals jsonb; sid uuid; rev integer; part text; changed boolean; original_section jsonb; label_ids jsonb; roots jsonb; permissions jsonb;
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
 select not private.part_two_client_result_containers(body) or exists(select 1 from jsonb_array_elements(coalesce(reading->'facts','[]')) f where private.part_two_card_withdrawn(f,reading))
  or exists(select 1 from jsonb_array_elements(coalesce(body->'output'->'productFacts'->'facts','[]')) f where private.part_two_card_withdrawn(f,body->'output'->'productFacts')) or not private.part_two_assertion_snapshot_allowed(reading,p_owner)
  or not private.part_two_assertion_snapshot_allowed(body->'output'->'productFacts',p_owner) into changed;
 if not changed then return body; end if;
 body:=private.part_two_projection_keys(body,array['schemaVersion','requestId','authenticatedOwnerId','scanId','captureSessionId','bindingKey','generation','evidenceRevision','resultRevision','expiresAt','state','output']);
 body:=jsonb_set(body,'{output}',private.part_two_projection_keys(body->'output',array['kind','reading','productFacts']));
 select * into cur from private.part_two_current where binding_key=original.binding_key for update;
 rev:=greatest(cur.result_revision,original.result_revision)+1; sid:=gen_random_uuid();
 select coalesce(jsonb_agg(distinct dep order by dep),'[]') into ids from jsonb_array_elements(reading->'facts') f,
  lateral jsonb_array_elements_text(coalesce(f->'dictionaryDependencies','[]')) dep where not private.part_two_card_withdrawn(f,reading);
 select coalesce(jsonb_agg(distinct ew.record_id order by ew.record_id),'[]') into withdrawals from private.part_two_explanation_withdrawals ew
 where exists(select 1 from jsonb_array_elements(reading->'facts') f where f->>'kind'='reference_function' and (f->'dictionaryDependencies' ? ew.record_id or f->'value'->>'explanationId'=ew.record_id or f->'value'->>'policyId'=ew.record_id))
  or exists(select 1 from jsonb_array_elements(coalesce(reading->'dependencyManifest'->'explanationPolicies','[]')) ep where ep->'withdrawalDependencies' ? ew.record_id)
  or coalesce(reading->'dependencyManifest'->'withdrawnExplanationDependencies','[]') ? ew.record_id;
 foreach part in array array['reading','productFacts'] loop
  section:=body->'output'->part; if section is null then continue; end if; original_section:=section;
  section:=private.part_two_projection_keys(section,array['schemaVersion','snapshotId','binding','scope','evidenceState','evidenceBasis','packageConfirmation','claimLimits','literalSections','labelAssertions','occurrences','facts','unresolvedSpans','blockers','versions','dependencyManifest','observedAt','sourceUpdatedAt','createdAt','expiresAt']);
  select coalesce(jsonb_agg(refreshed),'[]') into roots from jsonb_array_elements(coalesce(section->'labelAssertions','[]')) a cross join lateral (select private.part_two_current_label_root(a,p_owner) refreshed) refreshed_root where refreshed is not null and private.part_two_label_root_bound(refreshed,section,p_owner);
  section:=section||jsonb_build_object('labelAssertions',roots);
  section:=jsonb_set(section,'{literalSections}',(select coalesce(jsonb_agg(projected order by ord),'[]') from jsonb_array_elements(coalesce(original_section->'literalSections','[]')) with ordinality entries(literal,ord) cross join lateral (select private.part_two_current_literal(literal,section,p_owner) projected) projection where projected is not null));
  select coalesce(jsonb_agg(projected order by ord),'[]') into facts from jsonb_array_elements(section->'facts') with ordinality a(f,ord) cross join lateral (select private.part_two_current_label_fact(f,original_section,section,p_owner) projected) projection where projected is not null and not private.part_two_card_withdrawn(projected,section);
  select coalesce(jsonb_agg(a->'fieldPermission'||jsonb_build_object('assertionId',a->>'assertionId')),'[]') into permissions from jsonb_array_elements(roots) a;
  manifest:=private.part_two_client_manifest(section->'dependencyManifest')||jsonb_build_object('labelAssertionPermissions',permissions,'dictionaryRecordIds',ids,'withdrawnExplanationDependencies',withdrawals);
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

revoke all on function private.part_two_label_allowed(jsonb,uuid),private.part_two_current_label_root(jsonb,uuid),private.part_two_label_root_bound(jsonb,jsonb,uuid),private.part_two_project_withdrawals(uuid,uuid) from public,anon,authenticated;

-- Only an authenticated server may request complete retained validation input.
-- The owner argument comes from verified Auth, never customer claim substitution.
create function public.part_two_resolve(p_owner uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=p_owner; ctx jsonb; cur private.part_two_current; key text; build text; token uuid; rev integer; expected boolean;
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
revoke all on function public.part_two_resolve(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.part_two_resolve(uuid,jsonb) to service_role;

create or replace function public.part_two_operation(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; ctx jsonb; cur private.part_two_current; key text; build text; token uuid; rev integer; expected boolean; saved jsonb; sid uuid; link private.part_two_saves; capture_link private.part_two_capture_saves;
begin
 if p_action='resolve' then raise exception 'PART_TWO_SERVER_RESOLVE_ONLY' using errcode='42501'; end if;
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
 raise exception 'PART_TWO_INVALID_REQUEST';
end $$;
revoke all on function public.part_two_operation(text,jsonb) from public,anon;
grant execute on function public.part_two_operation(text,jsonb) to authenticated;


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
revoke all on function public.part_two_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.part_two_worker(text,jsonb) to service_role;


revoke all on function private.part_two_projection_keys(jsonb,text[]),private.part_two_client_manifest(jsonb),private.part_two_client_snapshot_containers(jsonb),private.part_two_client_result_containers(jsonb),private.part_two_current_label_fact(jsonb,jsonb,jsonb,uuid),private.part_two_label_fact_allowed(jsonb,jsonb,uuid),private.part_two_assertion_snapshot_allowed(jsonb,uuid) from public,anon,authenticated;

revoke all on function private.part_two_utf16_length(text),private.part_two_current_literal(jsonb,jsonb,uuid),private.part_two_literal_snapshot_allowed(jsonb,uuid),private.part_two_client_fact_value(jsonb) from public,anon,authenticated;

revoke all on function private.part_two_literal_slice(text,integer,integer) from public,anon,authenticated;
