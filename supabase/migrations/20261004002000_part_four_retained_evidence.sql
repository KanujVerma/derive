-- Pure source-retention helpers and opaque durable withdrawal authority.
-- No source acquisition, adapter or provider permission is activated.
-- Schema generated from src/contracts/RetainedEvidence.ts; semantic assertions
-- below mirror the contract refinements not represented in JSON Schema.
create function private.part_four_retention_schema() returns jsonb
language sql immutable set search_path='' as $fn$
 select $schema_doc${"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"version":{"$ref":"#/$defs/__schema0"},"savedAt":{"$ref":"#/$defs/__schema1"},"projectedAt":{"$ref":"#/$defs/__schema1"},"purpose":{"$ref":"#/$defs/__schema2"},"state":{"$ref":"#/$defs/__schema3"},"fields":{"$ref":"#/$defs/__schema4"}},"required":["version","savedAt","projectedAt","purpose","state","fields"],"additionalProperties":false,"$defs":{"__schema0":{"type":"string","const":"part-four-retained-evidence/v1"},"__schema1":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z))$"},"__schema2":{"type":"string","enum":["save","retain","display","export"]},"__schema3":{"type":"string","enum":["complete","partial","unavailable","empty"]},"__schema4":{"maxItems":1000,"type":"array","items":{"$ref":"#/$defs/__schema5"}},"__schema5":{"oneOf":[{"$ref":"#/$defs/__schema6"},{"$ref":"#/$defs/__schema17"},{"$ref":"#/$defs/__schema18"},{"$ref":"#/$defs/__schema19"},{"$ref":"#/$defs/__schema20"},{"$ref":"#/$defs/__schema21"},{"$ref":"#/$defs/__schema22"},{"$ref":"#/$defs/__schema23"},{"$ref":"#/$defs/__schema24"},{"$ref":"#/$defs/__schema25"},{"$ref":"#/$defs/__schema26"},{"$ref":"#/$defs/__schema27"}]},"__schema6":{"type":"object","properties":{"recordId":{"$ref":"#/$defs/__schema7"},"sourceIds":{"$ref":"#/$defs/__schema8"},"withdrawalIds":{"$ref":"#/$defs/__schema10"},"originallyVisible":{"$ref":"#/$defs/__schema11"},"state":{"$ref":"#/$defs/__schema12"},"reason":{"$ref":"#/$defs/__schema13"},"grants":{"$ref":"#/$defs/__schema14"},"kind":{"type":"string","const":"offer_identity"},"value":{"anyOf":[{"type":"object","properties":{"choiceId":{"$ref":"#/$defs/__schema9"},"offerId":{"$ref":"#/$defs/__schema9"},"sizeAmount":{"$ref":"#/$defs/__schema16"},"packCount":{"$ref":"#/$defs/__schema16"},"unit":{"type":"string","enum":["g","mL"]},"market":{"$ref":"#/$defs/__schema9"}},"required":["choiceId","offerId","sizeAmount","packCount","unit","market"],"additionalProperties":false},{"type":"null"}]}},"required":["recordId","sourceIds","withdrawalIds","originallyVisible","state","reason","grants","kind","value"],"additionalProperties":false},"__schema7":{"type":"string","pattern":"^[a-f0-9]{64}$"},"__schema8":{"maxItems":100,"type":"array","items":{"$ref":"#/$defs/__schema9"}},"__schema9":{"type":"string","minLength":1,"maxLength":200},"__schema10":{"maxItems":100,"type":"array","items":{"$ref":"#/$defs/__schema9"}},"__schema11":{"type":"boolean"},"__schema12":{"type":"string","enum":["retained","omitted","tombstoned","restricted","unavailable"]},"__schema13":{"anyOf":[{"type":"string","enum":["unknown_grant","source_withdrawn","grant_revoked","permission_expired","retention_expired","retention_omitted","source_tombstone","retention_restricted","storage_not_permitted","processing_not_permitted","display_not_permitted","export_not_permitted"]},{"type":"null"}]},"__schema14":{"maxItems":100,"type":"array","items":{"$ref":"#/$defs/__schema15"}},"__schema15":{"type":"object","properties":{"sourceId":{"$ref":"#/$defs/__schema9"},"field":{"type":"string","enum":["identity","merchant","seller","fulfillment","price","availability","conditions","dates","brief"]},"policyId":{"$ref":"#/$defs/__schema9"},"policyVersion":{"$ref":"#/$defs/__schema9"},"validUntil":{"$ref":"#/$defs/__schema1"},"operations":{"type":"object","properties":{"process":{"type":"boolean"},"store":{"type":"boolean"},"display":{"type":"boolean"},"export":{"type":"boolean"}},"required":["process","store","display","export"],"additionalProperties":false},"retention":{"type":"object","properties":{"mode":{"type":"string","enum":["retain_until","omit","tombstone","restricted"]},"until":{"anyOf":[{"$ref":"#/$defs/__schema1"},{"type":"null"}]}},"required":["mode","until"],"additionalProperties":false},"revoked":{"type":"boolean"}},"required":["sourceId","field","policyId","policyVersion","validUntil","operations","retention","revoked"],"additionalProperties":false},"__schema16":{"type":"string","minLength":1,"maxLength":4000},"__schema17":{"type":"object","properties":{"recordId":{"$ref":"#/$defs/__schema7"},"sourceIds":{"$ref":"#/$defs/__schema8"},"withdrawalIds":{"$ref":"#/$defs/__schema10"},"originallyVisible":{"$ref":"#/$defs/__schema11"},"state":{"$ref":"#/$defs/__schema12"},"reason":{"$ref":"#/$defs/__schema13"},"grants":{"$ref":"#/$defs/__schema14"},"kind":{"type":"string","const":"offer_price"},"value":{"anyOf":[{"type":"object","properties":{"amount":{"$ref":"#/$defs/__schema16"},"currency":{"$ref":"#/$defs/__schema9"}},"required":["amount","currency"],"additionalProperties":false},{"type":"null"}]}},"required":["recordId","sourceIds","withdrawalIds","originallyVisible","state","reason","grants","kind","value"],"additionalProperties":false},"__schema18":{"type":"object","properties":{"recordId":{"$ref":"#/$defs/__schema7"},"sourceIds":{"$ref":"#/$defs/__schema8"},"withdrawalIds":{"$ref":"#/$defs/__schema10"},"originallyVisible":{"$ref":"#/$defs/__schema11"},"state":{"$ref":"#/$defs/__schema12"},"reason":{"$ref":"#/$defs/__schema13"},"grants":{"$ref":"#/$defs/__schema14"},"kind":{"type":"string","const":"offer_merchant"},"value":{"anyOf":[{"type":"object","properties":{"merchantId":{"$ref":"#/$defs/__schema9"},"merchant":{"$ref":"#/$defs/__schema16"}},"required":["merchantId","merchant"],"additionalProperties":false},{"type":"null"}]}},"required":["recordId","sourceIds","withdrawalIds","originallyVisible","state","reason","grants","kind","value"],"additionalProperties":false},"__schema19":{"type":"object","properties":{"recordId":{"$ref":"#/$defs/__schema7"},"sourceIds":{"$ref":"#/$defs/__schema8"},"withdrawalIds":{"$ref":"#/$defs/__schema10"},"originallyVisible":{"$ref":"#/$defs/__schema11"},"state":{"$ref":"#/$defs/__schema12"},"reason":{"$ref":"#/$defs/__schema13"},"grants":{"$ref":"#/$defs/__schema14"},"kind":{"type":"string","const":"offer_seller"},"value":{"anyOf":[{"type":"object","properties":{"sellerId":{"$ref":"#/$defs/__schema9"},"sellerName":{"$ref":"#/$defs/__schema16"},"sellerRelationship":{"type":"string","enum":["retailer_direct","brand_authorized","marketplace","unknown"]}},"required":["sellerId","sellerName","sellerRelationship"],"additionalProperties":false},{"type":"null"}]}},"required":["recordId","sourceIds","withdrawalIds","originallyVisible","state","reason","grants","kind","value"],"additionalProperties":false},"__schema20":{"type":"object","properties":{"recordId":{"$ref":"#/$defs/__schema7"},"sourceIds":{"$ref":"#/$defs/__schema8"},"withdrawalIds":{"$ref":"#/$defs/__schema10"},"originallyVisible":{"$ref":"#/$defs/__schema11"},"state":{"$ref":"#/$defs/__schema12"},"reason":{"$ref":"#/$defs/__schema13"},"grants":{"$ref":"#/$defs/__schema14"},"kind":{"type":"string","const":"offer_fulfillment"},"value":{"anyOf":[{"type":"object","properties":{"fulfillment":{"anyOf":[{"type":"object","properties":{"id":{"$ref":"#/$defs/__schema16"},"name":{"$ref":"#/$defs/__schema16"},"shipsFrom":{"anyOf":[{"$ref":"#/$defs/__schema16"},{"type":"null"}]},"prime":{"type":"boolean"}},"required":["id","name","shipsFrom","prime"],"additionalProperties":false},{"type":"null"}]}},"required":["fulfillment"],"additionalProperties":false},{"type":"null"}]}},"required":["recordId","sourceIds","withdrawalIds","originallyVisible","state","reason","grants","kind","value"],"additionalProperties":false},"__schema21":{"type":"object","properties":{"recordId":{"$ref":"#/$defs/__schema7"},"sourceIds":{"$ref":"#/$defs/__schema8"},"withdrawalIds":{"$ref":"#/$defs/__schema10"},"originallyVisible":{"$ref":"#/$defs/__schema11"},"state":{"$ref":"#/$defs/__schema12"},"reason":{"$ref":"#/$defs/__schema13"},"grants":{"$ref":"#/$defs/__schema14"},"kind":{"type":"string","const":"offer_availability"},"value":{"anyOf":[{"type":"object","properties":{"condition":{"type":"string","const":"new"},"availability":{"type":"string","const":"in_stock"}},"required":["condition","availability"],"additionalProperties":false},{"type":"null"}]}},"required":["recordId","sourceIds","withdrawalIds","originallyVisible","state","reason","grants","kind","value"],"additionalProperties":false},"__schema22":{"type":"object","properties":{"recordId":{"$ref":"#/$defs/__schema7"},"sourceIds":{"$ref":"#/$defs/__schema8"},"withdrawalIds":{"$ref":"#/$defs/__schema10"},"originallyVisible":{"$ref":"#/$defs/__schema11"},"state":{"$ref":"#/$defs/__schema12"},"reason":{"$ref":"#/$defs/__schema13"},"grants":{"$ref":"#/$defs/__schema14"},"kind":{"type":"string","const":"offer_conditions"},"value":{"anyOf":[{"type":"object","properties":{"conditions":{"maxItems":100,"type":"array","items":{"$ref":"#/$defs/__schema16"}}},"required":["conditions"],"additionalProperties":false},{"type":"null"}]}},"required":["recordId","sourceIds","withdrawalIds","originallyVisible","state","reason","grants","kind","value"],"additionalProperties":false},"__schema23":{"type":"object","properties":{"recordId":{"$ref":"#/$defs/__schema7"},"sourceIds":{"$ref":"#/$defs/__schema8"},"withdrawalIds":{"$ref":"#/$defs/__schema10"},"originallyVisible":{"$ref":"#/$defs/__schema11"},"state":{"$ref":"#/$defs/__schema12"},"reason":{"$ref":"#/$defs/__schema13"},"grants":{"$ref":"#/$defs/__schema14"},"kind":{"type":"string","const":"offer_dates"},"value":{"anyOf":[{"type":"object","properties":{"observedAt":{"$ref":"#/$defs/__schema1"},"validUntil":{"$ref":"#/$defs/__schema1"},"qualifiedUntil":{"$ref":"#/$defs/__schema1"}},"required":["observedAt","validUntil","qualifiedUntil"],"additionalProperties":false},{"type":"null"}]}},"required":["recordId","sourceIds","withdrawalIds","originallyVisible","state","reason","grants","kind","value"],"additionalProperties":false},"__schema24":{"type":"object","properties":{"recordId":{"$ref":"#/$defs/__schema7"},"sourceIds":{"$ref":"#/$defs/__schema8"},"withdrawalIds":{"$ref":"#/$defs/__schema10"},"originallyVisible":{"$ref":"#/$defs/__schema11"},"state":{"$ref":"#/$defs/__schema12"},"reason":{"$ref":"#/$defs/__schema13"},"grants":{"$ref":"#/$defs/__schema14"},"kind":{"type":"string","const":"offer_source"},"value":{"anyOf":[{"type":"object","properties":{"url":{"type":"string","maxLength":4096,"format":"uri"}},"required":["url"],"additionalProperties":false},{"type":"null"}]}},"required":["recordId","sourceIds","withdrawalIds","originallyVisible","state","reason","grants","kind","value"],"additionalProperties":false},"__schema25":{"type":"object","properties":{"recordId":{"$ref":"#/$defs/__schema7"},"sourceIds":{"$ref":"#/$defs/__schema8"},"withdrawalIds":{"$ref":"#/$defs/__schema10"},"originallyVisible":{"$ref":"#/$defs/__schema11"},"state":{"$ref":"#/$defs/__schema12"},"reason":{"$ref":"#/$defs/__schema13"},"grants":{"$ref":"#/$defs/__schema14"},"kind":{"type":"string","const":"brief_header"},"value":{"anyOf":[{"type":"object","properties":{"revision":{"$ref":"#/$defs/__schema9"},"productId":{"$ref":"#/$defs/__schema9"},"variantId":{"$ref":"#/$defs/__schema9"},"formulaVersionId":{"anyOf":[{"$ref":"#/$defs/__schema9"},{"type":"null"}]},"coverageLimit":{"$ref":"#/$defs/__schema16"},"reviewedAt":{"$ref":"#/$defs/__schema1"},"reviewerId":{"$ref":"#/$defs/__schema9"},"reviewDecision":{"type":"string","enum":["approved_local_fixture","approved_source_brief"]},"validUntil":{"$ref":"#/$defs/__schema1"}},"required":["revision","productId","variantId","formulaVersionId","coverageLimit","reviewedAt","reviewerId","reviewDecision","validUntil"],"additionalProperties":false},{"type":"null"}]}},"required":["recordId","sourceIds","withdrawalIds","originallyVisible","state","reason","grants","kind","value"],"additionalProperties":false},"__schema26":{"type":"object","properties":{"recordId":{"$ref":"#/$defs/__schema7"},"sourceIds":{"$ref":"#/$defs/__schema8"},"withdrawalIds":{"$ref":"#/$defs/__schema10"},"originallyVisible":{"$ref":"#/$defs/__schema11"},"state":{"$ref":"#/$defs/__schema12"},"reason":{"$ref":"#/$defs/__schema13"},"grants":{"$ref":"#/$defs/__schema14"},"kind":{"type":"string","const":"brief_source"},"value":{"anyOf":[{"type":"object","properties":{"title":{"$ref":"#/$defs/__schema16"},"url":{"type":"string","maxLength":4096,"format":"uri"},"kind":{"type":"string","enum":["personal_anecdote","editorial","manufacturer"]},"retrievedAt":{"$ref":"#/$defs/__schema1"},"publishedAt":{"anyOf":[{"$ref":"#/$defs/__schema1"},{"type":"null"}]},"matching":{"type":"string","enum":["exact_variant","exact_formula"]},"productId":{"$ref":"#/$defs/__schema9"},"variantId":{"$ref":"#/$defs/__schema9"},"formulaVersionId":{"anyOf":[{"$ref":"#/$defs/__schema9"},{"type":"null"}]},"coverageLimit":{"$ref":"#/$defs/__schema16"}},"required":["title","url","kind","retrievedAt","publishedAt","matching","productId","variantId","formulaVersionId","coverageLimit"],"additionalProperties":false},{"type":"null"}]}},"required":["recordId","sourceIds","withdrawalIds","originallyVisible","state","reason","grants","kind","value"],"additionalProperties":false},"__schema27":{"type":"object","properties":{"recordId":{"$ref":"#/$defs/__schema7"},"sourceIds":{"$ref":"#/$defs/__schema8"},"withdrawalIds":{"$ref":"#/$defs/__schema10"},"originallyVisible":{"$ref":"#/$defs/__schema11"},"state":{"$ref":"#/$defs/__schema12"},"reason":{"$ref":"#/$defs/__schema13"},"grants":{"$ref":"#/$defs/__schema14"},"kind":{"type":"string","const":"brief_observation"},"value":{"anyOf":[{"type":"object","properties":{"text":{"maxLength":600,"$ref":"#/$defs/__schema16"},"kind":{"type":"string","enum":["reported_experience","editorial_observation"]},"scope":{"type":"string","enum":["feel_context","formula_context"]},"sourceIds":{"maxItems":100,"type":"array","items":{"$ref":"#/$defs/__schema9"}},"opposingSourceIds":{"maxItems":100,"type":"array","items":{"$ref":"#/$defs/__schema9"}}},"required":["text","kind","scope","sourceIds","opposingSourceIds"],"additionalProperties":false},{"type":"null"}]}},"required":["recordId","sourceIds","withdrawalIds","originallyVisible","state","reason","grants","kind","value"],"additionalProperties":false}}}$schema_doc$::jsonb;
$fn$;

-- Exact closed-object structural validation of the generated, non-recursive
-- retention schema. References are local-only; arbitrary schema/network refs
-- are not accepted. UTF-16 string lengths match the TypeScript contract.
create function private.part_four_retention_json_matches(v jsonb,s jsonb,root_schema jsonb,p_depth integer default 0) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb; child jsonb; k text; txt text; n integer; typ text; matches integer;
begin
 if p_depth>40 or s is null or v is null then return false; end if;
 if s ? '$ref' then
  if s->>'$ref' not like '#/%' then return false; end if;
  child:=root_schema #> string_to_array(substr(s->>'$ref',3),'/');
  if not private.part_four_retention_json_matches(v,child,root_schema,p_depth+1) then return false; end if;
 end if;
 if s ? 'oneOf' then
  matches:=0;
  for child in select value from jsonb_array_elements(s->'oneOf') loop
   if private.part_four_retention_json_matches(v,child,root_schema,p_depth+1) then matches:=matches+1; end if;
  end loop;
  if matches<>1 then return false; end if;
 end if;
 if s ? 'anyOf' then
  matches:=0;
  for child in select value from jsonb_array_elements(s->'anyOf') loop
   if private.part_four_retention_json_matches(v,child,root_schema,p_depth+1) then matches:=matches+1; end if;
  end loop;
  if matches=0 then return false; end if;
 end if;
 if s ? 'allOf' then
  for child in select value from jsonb_array_elements(s->'allOf') loop
   if not private.part_four_retention_json_matches(v,child,root_schema,p_depth+1) then return false; end if;
  end loop;
 end if;
 if s ? 'const' and v is distinct from s->'const' then return false; end if;
 if s ? 'enum' and not exists(select 1 from jsonb_array_elements(s->'enum') e where e.value=v) then return false; end if;
 typ:=s->>'type';
 if typ is not null and jsonb_typeof(v) is distinct from typ then return false; end if;
 typ:=coalesce(typ,jsonb_typeof(v));
 if typ='object' then
  for item in select value from jsonb_array_elements(coalesce(s->'required','[]'::jsonb)) loop
   if not (v ? (item #>> '{}')) then return false; end if;
  end loop;
  for k,item in select key,value from jsonb_each(v) loop
   child:=s->'properties'->k;
   if child is null then
    if s->'additionalProperties'='false'::jsonb then return false; end if;
   elsif not private.part_four_retention_json_matches(item,child,root_schema,p_depth+1) then return false;
   end if;
  end loop;
 elsif typ='array' then
  n:=jsonb_array_length(v);
  if s ? 'minItems' and n<(s->>'minItems')::integer or s ? 'maxItems' and n>(s->>'maxItems')::integer then return false; end if;
  if s ? 'items' then
   for item in select value from jsonb_array_elements(v) loop
    if not private.part_four_retention_json_matches(item,s->'items',root_schema,p_depth+1) then return false; end if;
   end loop;
  end if;
 elsif typ='string' then
  txt:=v #>> '{}';
  select coalesce(sum(case when octet_length(c)>3 then 2 else 1 end),0)::integer into n from regexp_split_to_table(txt,'') c;
  if s ? 'minLength' and n<(s->>'minLength')::integer or s ? 'maxLength' and n>(s->>'maxLength')::integer then return false; end if;
  if s ? 'pattern' and txt !~ (s->>'pattern') then return false; end if;
  if s->>'format'='date-time' then perform txt::timestamptz;
  elsif s->>'format'='uri' and txt !~ '^[A-Za-z][A-Za-z0-9+.-]*:[^[:space:]]+$' then return false;
  end if;
 end if;
 return true;
exception when others then return false;
end $$;

create function private.part_four_retained_evidence_valid(p_envelope jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare schema_doc jsonb:=private.part_four_retention_schema(); f jsonb; g jsonb; s jsonb; d text; name text; count_retained integer:=0; expected_state text; seen text[]:='{}'; key text; seen_grants jsonb:='{}';
begin
 if not private.part_four_retention_json_matches(p_envelope,schema_doc,schema_doc) then return false; end if;
 for f in select value from jsonb_array_elements(p_envelope->'fields') loop
  key:=(f->>'recordId')||':'||(f->>'kind');
  if key=any(seen) then return false; end if; seen:=array_append(seen,key);
  if f->>'state'='retained' then
   count_retained:=count_retained+1;
   if f->'value'='null'::jsonb or f->'reason'<>'null'::jsonb or jsonb_array_length(f->'grants')=0 then return false; end if;
  elsif f->'value'<>'null'::jsonb or f->'reason'='null'::jsonb then return false;
  end if;
  if exists(select 1 from jsonb_array_elements_text(f->'sourceIds') x where not exists(select 1 from jsonb_array_elements(f->'grants') q where q.value->>'sourceId'=x.value)) then return false; end if;
  if (select count(*) from jsonb_array_elements(f->'sourceIds')) is distinct from (select count(distinct q.value->>'sourceId') from jsonb_array_elements(f->'grants') q) then return false; end if;
  for g in select value from jsonb_array_elements(f->'grants') loop
   key:=jsonb_build_array(f->>'recordId',g->>'sourceId',g->>'field',g->>'policyId',g->>'policyVersion')::text;
   if seen_grants ? key and seen_grants->key is distinct from g then return false; end if;
   seen_grants:=seen_grants||jsonb_build_object(key,g);
   foreach d in array array[g->>'sourceId',g->>'policyId',g->>'policyVersion'] loop
    if not (f->'withdrawalIds' ? d) then return false; end if;
   end loop;
   if f->>'kind' like 'brief_%' and g->>'field'<>'brief' then return false; end if;
   if f->>'kind' like 'offer_%' and f->>'kind'<>'offer_source' and g->>'field'<>substr(f->>'kind',7) then return false; end if;
  end loop;
  if f->>'kind'='offer_source' and f->>'state'='retained' then
   foreach name in array array['identity','merchant','seller','fulfillment','price','availability','conditions','dates'] loop
    if not exists(select 1 from jsonb_array_elements(f->'grants') q where q.value->>'field'=name) then return false; end if;
   end loop;
  end if;
 end loop;
 expected_state:=case when jsonb_array_length(p_envelope->'fields')=0 then 'empty' when count_retained=jsonb_array_length(p_envelope->'fields') then 'complete' when count_retained>0 then 'partial' else 'unavailable' end;
 return p_envelope->>'state'=expected_state;
exception when others then return false;
end $$;

-- Opaque dependencies are durable revocations, not imported source content.
create table private.part_four_source_withdrawals (
 dependency_id text primary key check(length(dependency_id) between 1 and 200),
 withdrawn_at timestamptz not null default now()
);
alter table private.part_four_source_withdrawals enable row level security;
revoke all on private.part_four_source_withdrawals from public,anon,authenticated,service_role;
grant select,insert,update on private.part_four_source_withdrawals to service_role;

create function private.part_four_source_withdrawal_fence() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.dependency_id is distinct from old.dependency_id then raise exception 'PART_FOUR_WITHDRAWAL_IMMUTABLE'; end if;
  new.withdrawn_at:=least(old.withdrawn_at,new.withdrawn_at);
 end if;
 return new;
end $$;
create trigger part_four_source_withdrawal_fence before insert or update on private.part_four_source_withdrawals for each row execute function private.part_four_source_withdrawal_fence();

create function private.part_four_source_withdrawal_lock() returns trigger
language plpgsql set search_path='' as $$
begin
 -- Statement guard precedes registry row locks, matching the canonical writer's
 -- inherited release -> source -> routine order (40203 -> 40204 -> 40205 -> 40206).
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 perform pg_catalog.pg_advisory_xact_lock(40205);
 return null;
end $$;
create trigger part_four_source_withdrawal_lock before insert or update on private.part_four_source_withdrawals for each statement execute function private.part_four_source_withdrawal_lock();

create function private.part_four_withdrawn_dependencies() returns text[]
language plpgsql set search_path='' as $$
declare deps text[];
begin
 -- Match inherited lifecycle locks before fencing source phantom insertions.
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 perform pg_catalog.pg_advisory_xact_lock(40205);
 select coalesce(array_agg(dependency_id order by dependency_id),'{}'::text[]) into deps from private.part_four_source_withdrawals;
 return deps;
end $$;

create function private.part_four_source_withdrawal_maintenance() returns trigger
language plpgsql set search_path='' as $$
begin
 -- The root-owned worker migration supplies this one-writer maintenance hook.
 if to_regprocedure('private.part_four_purge_retained_sources()') is not null then
  execute 'select private.part_four_purge_retained_sources()';
 end if;
 return new;
end $$;
create trigger part_four_source_withdrawal_maintenance after insert or update on private.part_four_source_withdrawals for each row execute function private.part_four_source_withdrawal_maintenance();

create function private.part_four_reproject_retained_evidence(p_envelope jsonb,p_purpose text,p_now timestamptz,p_withdrawn text[] default '{}') returns jsonb
language plpgsql set search_path='' as $$
declare result jsonb; f jsonb; g jsonb; fields jsonb:='[]'; state text; reason text; retained integer:=0; all_withdrawn text[]; saved_at text;
begin
 if p_purpose not in('save','retain','display','export') or p_now is null or not isfinite(p_now) then raise exception 'PART_FOUR_RETENTION_ARGUMENT'; end if;
 all_withdrawn:=coalesce(p_withdrawn,'{}')||private.part_four_withdrawn_dependencies();
 saved_at:=private.part_one_utc(p_now);
 if private.part_four_retained_evidence_valid(p_envelope) then
  saved_at:=p_envelope->>'savedAt';
  for f in select value from jsonb_array_elements(p_envelope->'fields') order by value->>'recordId',value->>'kind' loop
   if f->>'state'='retained' then
    state:='retained';reason:=null;
    if exists(select 1 from jsonb_array_elements_text(f->'withdrawalIds') d where d.value=any(all_withdrawn)) then state:='tombstoned';reason:='source_withdrawn';
    else
     for g in select value from jsonb_array_elements(f->'grants') loop
      if g->>'revoked'='true' then state:='tombstoned';reason:='grant_revoked';
      elsif (g->>'validUntil')::timestamptz<=p_now then state:='tombstoned';reason:='permission_expired';
      elsif g->'operations'->>'process'<>'true' then state:='unavailable';reason:='processing_not_permitted';
      elsif g->'retention'->>'mode'='omit' then state:='omitted';reason:='retention_omitted';
      elsif g->'retention'->>'mode'='tombstone' then state:='tombstoned';reason:='source_tombstone';
      elsif g->'retention'->>'mode'='restricted' then state:='restricted';reason:='retention_restricted';
      elsif g->'operations'->>'store'<>'true' then state:='restricted';reason:='storage_not_permitted';
      elsif g->'retention'->'until'='null'::jsonb or (g->'retention'->>'until')::timestamptz>(g->>'validUntil')::timestamptz then state:='unavailable';reason:='unknown_grant';
      elsif (g->'retention'->>'until')::timestamptz<=p_now then state:='tombstoned';reason:='retention_expired';
      elsif p_purpose in('save','display') and g->'operations'->>'display'<>'true' then state:='restricted';reason:='display_not_permitted';
      elsif p_purpose='export' and g->'operations'->>'export'<>'true' then state:='restricted';reason:='export_not_permitted';
      end if;
      exit when state<>'retained';
     end loop;
    end if;
    if state<>'retained' then f:=f||jsonb_build_object('state',state,'reason',reason,'value',null); end if;
   end if;
   if f->>'state'='retained' then retained:=retained+1; end if;
   fields:=fields||jsonb_build_array(f);
  end loop;
 end if;
 state:=case when jsonb_array_length(fields)=0 then 'empty' when retained=jsonb_array_length(fields) then 'complete' when retained>0 then 'partial' else 'unavailable' end;
 result:=jsonb_build_object('version','part-four-retained-evidence/v1','savedAt',saved_at,'projectedAt',private.part_one_utc(p_now),'purpose',p_purpose,'state',state,'fields',fields);
 if not private.part_four_retained_evidence_valid(result) then raise exception 'PART_FOUR_RETENTION_PROJECTION'; end if;
 return result;
end $$;

create function private.part_four_retained_packet(p_packet jsonb,p_purpose text,p_now timestamptz,p_withdrawn text[] default '{}') returns jsonb
language plpgsql set search_path='' as $$
declare packet jsonb:=p_packet; p4 jsonb; projected jsonb; allowed text[]:=array['version','releaseId','formula','routineEvidence','insights','comparison','reviews','value','requiredEvidence','decisionState','action','contextRevision','retainedEvidence']; k text;
begin
 if jsonb_typeof(packet)<>'object' then return null; end if;
 if packet->'partFour' is null or packet->'partFour'='null'::jsonb then return packet; end if;
 p4:=packet->'partFour';
 if jsonb_typeof(p4)<>'object' then return packet-'partFour'; end if;
 -- Preserve canonical independent formula/science/routine fields; reject any
 -- undocumented source-container copy rather than retaining a second artifact.
 for k in select jsonb_object_keys(p4) loop
  if not (k=any(allowed)) then p4:=p4-k; end if;
 end loop;
 projected:=private.part_four_reproject_retained_evidence(p4->'retainedEvidence',p_purpose,p_now,p_withdrawn);
 p4:=jsonb_set(p4,'{retainedEvidence}',projected,true);
 p4:=jsonb_set(p4,'{reviews}',jsonb_build_object('state','unavailable','explanation','Saved source research is available only in currently permitted retained evidence fields.','sourceIds','[]'::jsonb),true);
 p4:=jsonb_set(p4,'{value}',jsonb_build_object('state','unavailable','explanation','Saved offer facts are available only in currently permitted retained evidence fields.','sourceIds','[]'::jsonb),true);
 return jsonb_set(packet,'{partFour}',p4,false);
end $$;

revoke all on function private.part_four_retention_schema(),private.part_four_retention_json_matches(jsonb,jsonb,jsonb,integer),private.part_four_retained_evidence_valid(jsonb),private.part_four_source_withdrawal_fence(),private.part_four_source_withdrawal_lock(),private.part_four_withdrawn_dependencies(),private.part_four_source_withdrawal_maintenance(),private.part_four_reproject_retained_evidence(jsonb,text,timestamptz,text[]),private.part_four_retained_packet(jsonb,text,timestamptz,text[]) from public,anon,authenticated;
grant execute on function private.part_four_retention_schema(),private.part_four_retention_json_matches(jsonb,jsonb,jsonb,integer),private.part_four_retained_evidence_valid(jsonb),private.part_four_withdrawn_dependencies(),private.part_four_reproject_retained_evidence(jsonb,text,timestamptz,text[]),private.part_four_retained_packet(jsonb,text,timestamptz,text[]) to service_role;
