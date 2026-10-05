-- Part 3: one bounded aggregate revision per setup transaction. V1 rows retain meaning.
alter table public.personal_context_revisions drop constraint personal_context_revisions_section_check;
alter table public.personal_context_revisions add constraint personal_context_revisions_section_check check(section in('profile','routine','experience','setup_v2'));
create table private.personal_context_erased_requests (
 user_id uuid not null references public.profiles(id) on delete cascade, request_id uuid not null, primary key(user_id,request_id)
);
create table private.personal_context_delete_receipts (
 user_id uuid not null references public.profiles(id) on delete cascade, request_id uuid not null, base_revision bigint not null,
 record_kind text not null, record_id uuid, revision bigint not null, deleted_revision_ids uuid[] not null, primary key(user_id,request_id)
);
revoke all on private.personal_context_erased_requests,private.personal_context_delete_receipts from public,anon,authenticated;
grant select,insert,delete on private.personal_context_erased_requests,private.personal_context_delete_receipts to service_role;
create function private.personal_context_owner_lock(p_owner uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 perform pg_catalog.pg_advisory_xact_lock(40204);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,191027));
 perform 1 from public.profiles where id=p_owner and deletion_started_at is null for share;
 if not found then raise exception 'CONTEXT_OWNER_UNAVAILABLE' using errcode='42501';end if;
 insert into public.personal_context_heads(user_id) values(p_owner) on conflict do nothing;
 perform 1 from public.personal_context_heads where user_id=p_owner for update;
end $$;
revoke all on function private.personal_context_owner_lock(uuid) from public,anon,authenticated;
grant execute on function private.personal_context_owner_lock(uuid) to service_role;
create function public.read_personal_context_v2(p_user_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;begin
 perform private.personal_context_owner_lock(p_user_id);
 result:=jsonb_build_object('v1',public.read_personal_context(p_user_id),'setupRevision',(select private.personal_context_revision_json(r) from public.personal_context_revisions r where user_id=p_user_id and section='setup_v2' order by revision desc limit 1));
 return result;
end $$;
create function public.save_personal_context_setup(p_user_id uuid,p_request_id uuid,p_base_revision bigint,p_setup jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare h bigint;r public.personal_context_revisions;item jsonb;refs jsonb;field text;
begin
 perform private.personal_context_owner_lock(p_user_id);
 if p_request_id is null or p_base_revision is null or p_base_revision<0 or jsonb_typeof(p_setup)<>'object' or octet_length(p_setup::text)>100000
 or jsonb_typeof(p_setup->'profile') is distinct from 'object' or jsonb_typeof(p_setup->'routine'->'items') is distinct from 'array'
 or jsonb_array_length(p_setup->'routine'->'items')>20 then raise exception 'INVALID_CONTEXT_WRITE';end if;
 foreach field in array array['experiences','preferences','assessments','notes'] loop
  if jsonb_typeof(p_setup->field) is distinct from 'array' or jsonb_array_length(p_setup->field)>20 then raise exception 'INVALID_CONTEXT_WRITE';end if;
 end loop;
 for item in select value from jsonb_array_elements(p_setup->'notes') loop if char_length(item->>'text')>2000 then raise exception 'INVALID_CONTEXT_WRITE';end if;end loop;
 if exists(select 1 from private.personal_context_erased_requests where user_id=p_user_id and request_id=p_request_id) then raise exception 'CONTEXT_REQUEST_ERASED';end if;
 if exists(select 1 from private.personal_context_delete_receipts where user_id=p_user_id and request_id=p_request_id) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 select * into r from public.personal_context_revisions where user_id=p_user_id and request_id=p_request_id;
 if found then
  if r.section<>'setup_v2' or r.base_revision<>p_base_revision or r.payload is distinct from p_setup then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 else
  select revision into h from public.personal_context_heads where user_id=p_user_id;
  if h<>p_base_revision then raise exception 'STALE_CONTEXT';end if;
  for item in select value from jsonb_array_elements(p_setup->'routine'->'items') union all select value from jsonb_array_elements(p_setup->'experiences') union all select value from jsonb_array_elements(p_setup->'assessments') loop perform private.validate_personal_context_reference(item->'reference');end loop;
  for item in select value from jsonb_array_elements(p_setup->'preferences') loop
   if item->'target'->>'kind'='product' then perform private.validate_personal_context_reference(item->'target'->'reference');end if;
   if item->'source'->>'kind'='note' and not exists(select 1 from public.personal_context_revisions old, lateral jsonb_array_elements(coalesce(old.payload->'notes','[]')) note(value) where old.user_id=p_user_id and old.section='setup_v2' and old.id=(item->'source'->>'noteRevisionId')::uuid and note.value->>'id'=item->'source'->>'noteId' and position(item->'source'->>'supportingSpan' in note.value->>'text')>0) then raise exception 'CONTEXT_NOTE_SOURCE_MISMATCH';end if;
  end loop;
  insert into public.personal_context_revisions(user_id,revision,request_id,base_revision,section,payload) values(p_user_id,h+1,p_request_id,p_base_revision,'setup_v2',p_setup) returning * into r;
  update public.personal_context_heads set revision=r.revision where user_id=p_user_id;
 end if;
 refs:=jsonb_build_object('setup',r.id,'profile',r.id,'routine',r.id);
 foreach field in array array['experiences','preferences','assessments','notes'] loop
  refs:=refs||jsonb_build_object(field,coalesce((select jsonb_object_agg(value->>'id',r.id) from jsonb_array_elements(r.payload->field)),'{}'::jsonb));
 end loop;
 return jsonb_build_object('contextRevision',r.revision,'revisionReferences',refs,'replayed',r.revision<=p_base_revision or h is null);
end $$;
-- Erasure edits permitted payloads by delete/reinsert rather than bypassing the immutable-update trigger.
-- Receipts contain only opaque IDs and operation names, never deleted report text or a payload hash.
create function public.delete_personal_context_record(p_user_id uuid,p_request_id uuid,p_base_revision bigint,p_kind text,p_record_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.personal_context_revisions;receipt private.personal_context_delete_receipts;payload jsonb;ids uuid[]:='{}';h bigint;field text;
begin
 perform private.personal_context_owner_lock(p_user_id);
 if p_request_id is null or p_base_revision is null or p_base_revision<0 or p_kind not in('profile','routine_item','experience','assessment','note','preference') or ((p_kind='profile')<>(p_record_id is null)) then raise exception 'INVALID_CONTEXT_WRITE';end if;
 select * into receipt from private.personal_context_delete_receipts where user_id=p_user_id and request_id=p_request_id;
 if found then
  if receipt.base_revision<>p_base_revision or receipt.record_kind<>p_kind or receipt.record_id is distinct from p_record_id then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('contextRevision',receipt.revision,'deletedRevisionIds',to_jsonb(receipt.deleted_revision_ids),'replayed',true);
 end if;
 if exists(select 1 from public.personal_context_revisions where user_id=p_user_id and request_id=p_request_id) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 select revision into h from public.personal_context_heads where user_id=p_user_id;
 if h<>p_base_revision then raise exception 'STALE_CONTEXT';end if;
 -- Purge original legacy records too; no old-health payload remains as a fallback.
 if p_kind='profile' then delete from public.free_skin_profiles where user_id=p_user_id;
 elsif p_kind='experience' then delete from public.free_product_experiences where user_id=p_user_id and id=p_record_id;
 elsif p_kind='routine_item' then delete from public.free_saved_products where user_id=p_user_id and id=p_record_id;end if;
 for r in select * from public.personal_context_revisions where user_id=p_user_id order by revision loop
  payload:=r.payload;
  if r.section='profile' and p_kind='profile' then payload:=null;
  elsif r.section='experience' and p_kind='experience' and r.experience_id=p_record_id then payload:=null;
  elsif r.section='routine' and p_kind='routine_item' then payload:=jsonb_set(payload,'{items}',coalesce((select jsonb_agg(value) from jsonb_array_elements(payload->'items') where value->>'id'<>p_record_id::text),'[]'));
  elsif r.section='setup_v2' then
   if p_kind='profile' then
    payload:=jsonb_set(payload,'{profile}','{"intent":"unanswered","primaryGoal":{"state":"unanswered"},"secondaryGoals":[],"skinBehavior":"unanswered","reactivity":"unanswered","reproductive":{"pregnancy":"unanswered","tryingToConceive":"unanswered","nursing":"unanswered"},"sensitivities":{"status":"unanswered","values":[]},"treatments":{"status":"unanswered","values":[]}}');
    payload:=jsonb_set(payload,'{notes}',coalesce((select jsonb_agg(value) from jsonb_array_elements(payload->'notes') where value->>'scope'<>'profile'),'[]'));
   else
    field:=case p_kind when 'routine_item' then 'items' when 'experience' then 'experiences' when 'assessment' then 'assessments' when 'note' then 'notes' else 'preferences' end;
    if p_kind='routine_item' then payload:=jsonb_set(payload,'{routine,items}',coalesce((select jsonb_agg(value) from jsonb_array_elements(payload->'routine'->'items') where value->>'id'<>p_record_id::text),'[]'));
    else payload:=jsonb_set(payload,array[field],coalesce((select jsonb_agg(value) from jsonb_array_elements(payload->field) where value->>'id'<>p_record_id::text),'[]'));end if;
    payload:=jsonb_set(payload,'{notes}',coalesce((select jsonb_agg(value) from jsonb_array_elements(payload->'notes') where value->>'targetRef' is distinct from p_record_id::text),'[]'));
   end if;
   payload:=jsonb_set(payload,'{preferences}',coalesce((select jsonb_agg(case when pref.value->'source'->>'kind'='note' and pref.value->'source'->>'adoptedIndependently'='true' and not exists(select 1 from jsonb_array_elements(payload->'notes') note(value) where note.value->>'id'=pref.value->'source'->>'noteId') then jsonb_set(pref.value,'{source}','{"kind":"structured"}') else pref.value end) from jsonb_array_elements(payload->'preferences') pref(value) where pref.value->'source'->>'kind'<>'note' or pref.value->'source'->>'adoptedIndependently'='true' or exists(select 1 from jsonb_array_elements(payload->'notes') note(value) where note.value->>'id'=pref.value->'source'->>'noteId')),'[]'));
  end if;
  if payload is distinct from r.payload then
   ids:=array_append(ids,r.id);
   insert into private.personal_context_erased_requests(user_id,request_id) values(p_user_id,r.request_id) on conflict do nothing;
   -- Deleting a correction parent cascades its child; process parent/child as one erasure.
   delete from public.personal_context_revisions where id=r.id;
   if payload is not null then
    insert into public.personal_context_revisions(id,user_id,revision,request_id,base_revision,section,payload,experience_id,supersedes_revision_id,provenance,recorded_at)
    values(r.id,r.user_id,r.revision,r.request_id,r.base_revision,r.section,payload,r.experience_id,null,r.provenance,r.recorded_at);
   end if;
  end if;
 end loop;
 delete from public.personal_decision_assessments where user_id=p_user_id;
 if pg_catalog.to_regprocedure('private.purge_part_three_context_dependents(uuid,uuid[])') is not null then execute 'select private.purge_part_three_context_dependents($1,$2)' using p_user_id,ids;end if;
 h:=h+1;update public.personal_context_heads set revision=h where user_id=p_user_id;
 insert into private.personal_context_delete_receipts values(p_user_id,p_request_id,p_base_revision,p_kind,p_record_id,h,ids);
 return jsonb_build_object('contextRevision',h,'deletedRevisionIds',to_jsonb(ids),'replayed',false);
end $$;
revoke all on function public.read_personal_context_v2(uuid),public.save_personal_context_setup(uuid,uuid,bigint,jsonb),public.delete_personal_context_record(uuid,uuid,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.read_personal_context_v2(uuid),public.save_personal_context_setup(uuid,uuid,bigint,jsonb),public.delete_personal_context_record(uuid,uuid,bigint,text,uuid) to service_role;
-- Fence legacy writes against account erasure and forbid replaying erased payloads.
alter function public.write_personal_context(uuid,uuid,bigint,text,jsonb,uuid) rename to write_personal_context_v1_unfenced;
revoke all on function public.write_personal_context_v1_unfenced(uuid,uuid,bigint,text,jsonb,uuid) from public,anon,authenticated;
create function public.write_personal_context(p_user_id uuid,p_request_id uuid,p_base_revision bigint,p_section text,p_payload jsonb,p_supersedes_revision_id uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 perform private.personal_context_owner_lock(p_user_id);
 if exists(select 1 from private.personal_context_erased_requests where user_id=p_user_id and request_id=p_request_id) then raise exception 'CONTEXT_REQUEST_ERASED';end if;
 if exists(select 1 from private.personal_context_delete_receipts where user_id=p_user_id and request_id=p_request_id) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
 return public.write_personal_context_v1_unfenced(p_user_id,p_request_id,p_base_revision,p_section,p_payload,p_supersedes_revision_id);
end $$;
revoke all on function public.write_personal_context(uuid,uuid,bigint,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.write_personal_context(uuid,uuid,bigint,text,jsonb,uuid) to service_role;
-- Pinned v2 history includes setup reports; corrections win by stable report ID.
create function public.read_personal_experience_history_v2(p_user_id uuid,p_at_revision bigint,p_limit integer default 50,p_cursor uuid default null,p_product_id uuid default null,p_manual_name text default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare rows jsonb;result jsonb;anchor integer:=0;head bigint;setup public.personal_context_revisions;
begin
 select coalesce((select revision from public.personal_context_heads where user_id=p_user_id),0) into head;
 if p_at_revision is null or p_at_revision<0 or p_at_revision>head or p_limit is null or p_limit<1 or p_limit>50 then raise exception 'INVALID_HISTORY_REVISION';end if;
 select * into setup from public.personal_context_revisions where user_id=p_user_id and section='setup_v2' and revision<=p_at_revision order by revision desc limit 1;
 with candidates as (
  select experience_id as eid,revision,private.personal_context_revision_json(r) as report from public.personal_context_revisions r where user_id=p_user_id and section='experience' and revision<=p_at_revision
  union all select (value->>'id')::uuid,setup.revision,private.personal_context_revision_json(setup)||jsonb_build_object('data',value) from jsonb_array_elements(coalesce(setup.payload->'experiences','[]'))
 ), active as (select distinct on(eid) * from candidates order by eid,revision desc), scoped as (
  select * from active where (p_product_id is null or report->'data'->'reference'->>'productId'=p_product_id::text) and (p_manual_name is null or (report->'data'->'reference'->>'kind'='manual' and report->'data'->'reference'->>'name'=p_manual_name))
 ) select coalesce(jsonb_agg(report order by revision desc,eid),'[]') into rows from scoped;
 if p_cursor is not null then select ord into anchor from jsonb_array_elements(rows) with ordinality e(value,ord) where value->'data'->>'id'=p_cursor::text;
  if anchor is null then raise exception 'HISTORY_CURSOR_NOT_FOUND';end if;
 end if;
 select coalesce(jsonb_agg(value order by ord),'[]') into result from jsonb_array_elements(rows) with ordinality e(value,ord) where ord>anchor and ord<=anchor+p_limit;
 return jsonb_build_object('items',result,'atRevision',p_at_revision,'nextCursor',case when jsonb_array_length(rows)>anchor+p_limit then result->(p_limit-1)->'data'->>'id' else null end);
end $$;
revoke all on function public.read_personal_experience_history_v2(uuid,bigint,integer,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.read_personal_experience_history_v2(uuid,bigint,integer,uuid,uuid,text) to service_role;
