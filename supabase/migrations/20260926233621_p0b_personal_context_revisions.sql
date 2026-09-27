-- P0-B: immutable reported context. No inferred migration/backfill from legacy.
create table public.personal_context_heads (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0)
);
create table public.personal_context_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  revision bigint not null check (revision > 0),
  request_id uuid not null,
  base_revision bigint not null check (base_revision >= 0),
  section text not null check (section in ('profile','routine','experience')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 100000),
  experience_id uuid,
  supersedes_revision_id uuid references public.personal_context_revisions(id) on delete cascade,
  provenance text not null default 'self_report' check (provenance = 'self_report'),
  recorded_at timestamptz not null default now(),
  unique(user_id, revision), unique(user_id, request_id),
  check ((section = 'experience') = (experience_id is not null)),
  check (section = 'experience' or supersedes_revision_id is null)
);
create index personal_context_latest_section on public.personal_context_revisions(user_id, section, revision desc);
create index personal_context_experience_versions on public.personal_context_revisions(user_id, experience_id, revision desc) where experience_id is not null;
create unique index personal_context_one_correction on public.personal_context_revisions(supersedes_revision_id) where supersedes_revision_id is not null;
alter table public.personal_context_heads enable row level security;
alter table public.personal_context_revisions enable row level security;
revoke all on public.personal_context_heads, public.personal_context_revisions from public, anon, authenticated;
grant select, insert, update, delete on public.personal_context_heads to service_role;
grant select, insert, delete on public.personal_context_revisions to service_role;

create function private.prevent_personal_context_update() returns trigger
language plpgsql security invoker set search_path='' as $$
begin raise exception 'IMMUTABLE_CONTEXT_REVISION'; end;
$$;
revoke all on function private.prevent_personal_context_update() from public, anon, authenticated;
create trigger personal_context_immutable before update on public.personal_context_revisions
for each row execute function private.prevent_personal_context_update();

create function private.validate_personal_context_reference(p_reference jsonb) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_reference->>'kind' = 'manual' then return; end if;
  if p_reference->>'kind' is distinct from 'catalog' or not exists (
    select 1 from public.products p where p.id = (p_reference->>'productId')::uuid
    and p.is_catalog_standard and p.catalog_verified_at is not null
  ) then raise exception 'CONTEXT_PRODUCT_NOT_VERIFIED'; end if;
  if p_reference->>'variantId' is not null and not exists (
    select 1 from public.product_variants v where v.id=(p_reference->>'variantId')::uuid
    and v.product_id=(p_reference->>'productId')::uuid and v.catalog_verification_status='verified'
  ) then raise exception 'CONTEXT_VARIANT_MISMATCH'; end if;
  if p_reference->>'formulaVersionId' is not null and not exists (
    select 1 from public.product_formula_versions f where f.id=(p_reference->>'formulaVersionId')::uuid
    and f.variant_id=(p_reference->>'variantId')::uuid
    and f.verification_status in ('verified','superseded')
    and f.provenance_type in ('manufacturer','package_label','regulator','founder_review')
  ) then raise exception 'CONTEXT_FORMULA_NOT_VERIFIED'; end if;
end;
$$;
revoke all on function private.validate_personal_context_reference(jsonb) from public, anon, authenticated;
grant execute on function private.validate_personal_context_reference(jsonb) to service_role;

create function private.personal_context_revision_json(r public.personal_context_revisions) returns jsonb
language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('id',r.id,'ownerId',r.user_id,'revision',r.revision,
    'recordedAt',r.recorded_at,'provenance',r.provenance,'supersedesRevisionId',r.supersedes_revision_id,'data',r.payload);
$$;
revoke all on function private.personal_context_revision_json(public.personal_context_revisions) from public, anon, authenticated;
grant execute on function private.personal_context_revision_json(public.personal_context_revisions) to service_role;

create function public.write_personal_context(p_user_id uuid,p_request_id uuid,p_base_revision bigint,p_section text,p_payload jsonb,p_supersedes_revision_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare h public.personal_context_heads; r public.personal_context_revisions; prior public.personal_context_revisions; item jsonb; eid uuid;
begin
  if p_user_id is null or p_request_id is null or p_base_revision is null or p_base_revision < 0 or p_section not in ('profile','routine','experience')
    or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>100000 then raise exception 'INVALID_CONTEXT_WRITE'; end if;
  insert into public.personal_context_heads(user_id) values(p_user_id) on conflict do nothing;
  select * into h from public.personal_context_heads where user_id=p_user_id for update;
  select * into r from public.personal_context_revisions where user_id=p_user_id and request_id=p_request_id;
  if found then
    if r.base_revision is distinct from p_base_revision or r.section is distinct from p_section or r.payload is distinct from p_payload or r.supersedes_revision_id is distinct from p_supersedes_revision_id then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('revision',private.personal_context_revision_json(r),'replayed',true);
  end if;
  if h.revision <> p_base_revision then raise exception 'STALE_CONTEXT'; end if;
  if p_section='experience' then
    eid := (p_payload->>'id')::uuid;
    select * into prior from public.personal_context_revisions where user_id=p_user_id and experience_id=eid order by revision desc limit 1;
    if (prior.id is distinct from p_supersedes_revision_id) then raise exception 'EXPERIENCE_CORRECTION_CONFLICT'; end if;
    perform private.validate_personal_context_reference(p_payload->'reference');
  elsif p_section='routine' then
    if p_supersedes_revision_id is not null or jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items')>50 then raise exception 'INVALID_CONTEXT_WRITE'; end if;
    for item in select value from jsonb_array_elements(p_payload->'items') loop
      perform private.validate_personal_context_reference(item->'reference');
    end loop;
  elsif p_supersedes_revision_id is not null then raise exception 'INVALID_CONTEXT_WRITE';
  end if;
  insert into public.personal_context_revisions(user_id,revision,request_id,base_revision,section,payload,experience_id,supersedes_revision_id)
    values(p_user_id,h.revision+1,p_request_id,p_base_revision,p_section,p_payload,eid,p_supersedes_revision_id) returning * into r;
  update public.personal_context_heads set revision=r.revision where user_id=p_user_id;
  return jsonb_build_object('revision',private.personal_context_revision_json(r),'replayed',false);
end;
$$;
revoke all on function public.write_personal_context(uuid,uuid,bigint,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.write_personal_context(uuid,uuid,bigint,text,jsonb,uuid) to service_role;

-- One SQL statement sees a consistent context snapshot. Legacy remains a tagged observation.
create function public.read_personal_context(p_user_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  with current_experiences as (
    select distinct on (experience_id) * from public.personal_context_revisions where user_id=p_user_id and section='experience' order by experience_id,revision desc
  ), bounded_experiences as (select * from current_experiences order by revision desc limit 50),
  legacy_products as (select * from public.free_saved_products where user_id=p_user_id order by seq desc limit 50),
  legacy_experiences as (select * from public.free_product_experiences where user_id=p_user_id order by seq desc limit 50)
  select jsonb_build_object('version','personal-context-v1','ownerId',p_user_id,
    'revision',coalesce((select revision from public.personal_context_heads where user_id=p_user_id),0),
    'profile',(select private.personal_context_revision_json(r) from public.personal_context_revisions r where user_id=p_user_id and section='profile' order by revision desc limit 1),
    'routine',(select private.personal_context_revision_json(r) from public.personal_context_revisions r where user_id=p_user_id and section='routine' order by revision desc limit 1),
    'experiences',coalesce((select jsonb_agg(private.personal_context_revision_json(row(r.*)::public.personal_context_revisions) order by revision desc) from bounded_experiences r),'[]'::jsonb),
    'historyTruncated',(select count(*)>50 from current_experiences),
    'historyRevision',(select id from public.personal_context_revisions where user_id=p_user_id and section='experience' order by revision desc limit 1),
    'legacy',jsonb_build_object('source','legacy_free_context',
      'profile',(select jsonb_build_object('goalsUnordered',goals,'skinBehavior',skin_behavior,'reactivity',reactivity,'combinedReproductiveStatus',pregnancy_status,'sensitivitiesStatus',sensitivities_status,'knownSensitivities',known_sensitivities,'treatmentStatus',treatment_status,'currentTreatments',current_treatments,'recordedAt',updated_at) from public.free_skin_profiles where user_id=p_user_id),
      'products',coalesce((select jsonb_agg(jsonb_build_object('id',id,'productId',product_id,'name',name,'brand',brand,'state',state,'source',source,'formulaVersionId',null,'timing','unknown','frequency',jsonb_build_object('kind','unknown'),'recordedAt',updated_at) order by seq desc) from legacy_products),'[]'::jsonb),
      'experiences',coalesce((select jsonb_agg(jsonb_build_object('id',id,'productId',product_id,'productName',product_name,'brand',brand,'kind',kind,'note',note,'source',source,'formulaVersionId',null,'occurred',null,'recordedAt',noted_at) order by seq desc) from legacy_experiences),'[]'::jsonb),
      'truncated',(select count(*)>50 from public.free_saved_products where user_id=p_user_id) or (select count(*)>50 from public.free_product_experiences where user_id=p_user_id)));
$$;
revoke all on function public.read_personal_context(uuid) from public, anon, authenticated;
grant execute on function public.read_personal_context(uuid) to service_role;

create table public.personal_decision_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  input jsonb not null check(jsonb_typeof(input)='object' and octet_length(input::text)<=100000),
  packet jsonb not null check(jsonb_typeof(packet)='object' and octet_length(packet::text)<=200000),
  profile_revision_id uuid references public.personal_context_revisions(id) on delete cascade,
  routine_revision_id uuid references public.personal_context_revisions(id) on delete cascade,
  history_revision_id uuid references public.personal_context_revisions(id) on delete cascade,
  truth_projection_ref text not null check(length(trim(truth_projection_ref)) between 1 and 500),
  schema_version text not null check(length(schema_version) between 1 and 100),
  engine_version text not null check(length(engine_version) between 1 and 100),
  policy_version text not null check(length(policy_version) between 1 and 100),
  created_at timestamptz not null default now(),
  unique(user_id,request_id)
);
alter table public.personal_decision_assessments enable row level security;
revoke all on public.personal_decision_assessments from public,anon,authenticated;
grant select,insert,delete on public.personal_decision_assessments to service_role;
create trigger personal_assessments_immutable before update on public.personal_decision_assessments for each row execute function private.prevent_personal_context_update();

create function private.validate_personal_assessment_owner() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (new.profile_revision_id is not null and not exists(select 1 from public.personal_context_revisions where id=new.profile_revision_id and user_id=new.user_id and section='profile'))
    or (new.routine_revision_id is not null and not exists(select 1 from public.personal_context_revisions where id=new.routine_revision_id and user_id=new.user_id and section='routine'))
    or (new.history_revision_id is not null and not exists(select 1 from public.personal_context_revisions where id=new.history_revision_id and user_id=new.user_id and section='experience')) then raise exception 'ASSESSMENT_CONTEXT_OWNER_MISMATCH'; end if;
  return new;
end;
$$;
revoke all on function private.validate_personal_assessment_owner() from public,anon,authenticated;
create trigger personal_assessments_owner before insert on public.personal_decision_assessments for each row execute function private.validate_personal_assessment_owner();

create function public.persist_personal_decision_assessment(p_user_id uuid,p_request_id uuid,p_input jsonb,p_packet jsonb,p_profile_revision_id uuid,p_routine_revision_id uuid,p_history_revision_id uuid,p_truth_projection_ref text,p_schema_version text,p_engine_version text,p_policy_version text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.personal_decision_assessments;
begin
  -- Same owner lock as context writes; concurrent retries cannot duplicate a result.
  insert into public.personal_context_heads(user_id) values(p_user_id) on conflict do nothing;
  perform 1 from public.personal_context_heads where user_id=p_user_id for update;
  select * into r from public.personal_decision_assessments where user_id=p_user_id and request_id=p_request_id;
  if found then
    if r.input is distinct from p_input then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('assessmentId',r.id,'packet',r.packet,'replayed',true);
  end if;
  insert into public.personal_decision_assessments(user_id,request_id,input,packet,profile_revision_id,routine_revision_id,history_revision_id,truth_projection_ref,schema_version,engine_version,policy_version)
    values(p_user_id,p_request_id,p_input,p_packet,p_profile_revision_id,p_routine_revision_id,p_history_revision_id,p_truth_projection_ref,p_schema_version,p_engine_version,p_policy_version) returning * into r;
  return jsonb_build_object('assessmentId',r.id,'packet',r.packet,'replayed',false);
end;
$$;
revoke all on function public.persist_personal_decision_assessment(uuid,uuid,jsonb,jsonb,uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.persist_personal_decision_assessment(uuid,uuid,jsonb,jsonb,uuid,uuid,uuid,text,text,text,text) to service_role;

-- Effective history at a fixed context revision, filtered AFTER corrections.
-- Product filtering avoids dropping an older relevant reaction in a bounded snapshot.
create function public.read_personal_experience_history(p_user_id uuid,p_at_revision bigint,p_limit integer default 50,p_cursor uuid default null,p_product_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare anchor bigint; rows jsonb; result jsonb; head bigint;
begin
  select coalesce((select revision from public.personal_context_heads where user_id=p_user_id),0) into head;
  if p_at_revision is null or p_at_revision<0 or p_at_revision>head or p_limit is null or p_limit<1 or p_limit>50 then raise exception 'INVALID_HISTORY_REVISION'; end if;
  if p_cursor is not null then
    select r.revision into anchor from public.personal_context_revisions r where r.id=p_cursor and r.user_id=p_user_id and r.section='experience' and r.revision<=p_at_revision
      and (p_product_id is null or r.payload->'reference'->>'productId'=p_product_id::text)
      and not exists(select 1 from public.personal_context_revisions child where child.user_id=p_user_id and child.experience_id=r.experience_id and child.revision>r.revision and child.revision<=p_at_revision);
    if anchor is null then raise exception 'HISTORY_CURSOR_NOT_FOUND'; end if;
  end if;
  with effective as (
    select distinct on(experience_id) * from public.personal_context_revisions where user_id=p_user_id and section='experience' and revision<=p_at_revision order by experience_id,revision desc
  ), bounded as (
    select * from effective where (anchor is null or revision<anchor) and (p_product_id is null or payload->'reference'->>'productId'=p_product_id::text) order by revision desc limit p_limit+1
  ) select coalesce(jsonb_agg(private.personal_context_revision_json(row(r.*)::public.personal_context_revisions) order by revision desc),'[]'::jsonb) into rows from bounded r;
  select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into result from jsonb_array_elements(rows) with ordinality as entry(value,ord) where ord<=p_limit;
  return jsonb_build_object('items',result,'atRevision',p_at_revision,'nextCursor',case when jsonb_array_length(rows)>p_limit then result->(p_limit-1)->>'id' else null end);
end;
$$;
revoke all on function public.read_personal_experience_history(uuid,bigint,integer,uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_personal_experience_history(uuid,bigint,integer,uuid,uuid) to service_role;
