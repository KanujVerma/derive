-- Part 1: local, additive evidence/operation ledger. No provider permission or
-- private retention approval is inferred by this migration. No hosted trigger.
create table private.part_one_policies (
  id text primary key,
  version text not null,
  lookup_allowed boolean not null default false,
  retain_allowed boolean not null default false,
  display_allowed boolean not null default false,
  export_allowed boolean not null default false,
  expires_at timestamptz,
  permission_evidence text,
  check (not (lookup_allowed or retain_allowed or display_allowed or export_allowed)
    or permission_evidence is not null)
);
insert into private.part_one_policies(id, version) values
  ('open_facts', 'pending-1'), ('upcitemdb', 'pending-1'),
  ('manufacturer', 'pending-1'), ('private_capture', 'retention-pending-1');
insert into private.part_one_policies(id, version, lookup_allowed, retain_allowed,
  display_allowed, export_allowed, permission_evidence)
values ('derive_catalog', '1', true, true, true, true, 'Existing founder-reviewed identity identifiers only; no formula promotion');

create table private.part_one_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('observation','snapshot','declaration')),
  item_id uuid,
  revision integer not null default 1 check (revision > 0),
  canonical_key text,
  policy_id text not null references private.part_one_policies(id),
  policy_version text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  scope text not null default 'public' check (scope in ('public','private_package')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  dependencies uuid[] not null default '{}',
  supersedes_id uuid references private.part_one_records(id),
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > observed_at),
  check ((scope = 'public' and owner_id is null) or (scope = 'private_package' and owner_id is not null))
);
create unique index part_one_snapshot_revision on private.part_one_records(item_id, revision)
  where kind = 'snapshot';
create index part_one_catalog_key on private.part_one_records(canonical_key, revision desc)
  where kind = 'snapshot' and scope = 'public';
create table private.part_one_record_status (
  record_id uuid primary key references private.part_one_records(id) on delete cascade,
  status text not null default 'active' check (status in ('active','revoked','retracted','superseded')),
  reason text,
  status_revision integer not null default 1,
  changed_at timestamptz not null default now()
);
create table private.part_one_jobs (
  id uuid primary key default gen_random_uuid(),
  coalescing_key text not null,
  input jsonb not null,
  policy_version text not null,
  state text not null default 'queued' check (state in ('queued','running','deferred_budget','retry_wait','complete','failed_final','cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 4 check (max_attempts between 1 and 10),
  lease_token uuid,
  lease_expires_at timestamptz,
  next_eligible_at timestamptz not null default now(),
  checkpoints jsonb not null default '{}',
  output jsonb,
  publish_revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index part_one_shared_active_job on private.part_one_jobs(coalescing_key)
  where state in ('queued','running','deferred_budget','retry_wait');
create table private.part_one_worker_health (
  id boolean primary key default true check(id),
  heartbeat_at timestamptz not null,
  consumer_version text not null
);
create table private.part_one_budgets (
  provider text primary key,
  call_limit integer not null check (call_limit > 0),
  concurrency_limit integer not null check (concurrency_limit > 0),
  window_seconds integer not null check (window_seconds between 1 and 86400),
  reset_at timestamptz
);
create table private.part_one_reservations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references private.part_one_jobs(id),
  stage text not null,
  provider text not null references private.part_one_budgets(provider),
  policy_version text not null,
  state text not null default 'reserved' check (state in ('reserved','dispatched_unknown','settled','released')),
  reserved_at timestamptz not null default now(),
  retry_after timestamptz,
  outcome text,
  unique(job_id, stage)
);
create table private.part_one_scans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  request jsonb not null,
  generation integer not null check (generation >= 0),
  result_revision integer not null default 1 check (result_revision > 0),
  binding_revision integer not null default 1 check (binding_revision > 0),
  deletion_epoch integer not null default 0,
  result jsonb not null,
  job_id uuid references private.part_one_jobs(id),
  created_at timestamptz not null default now(),
  unique(owner_id, idempotency_key)
);
create table private.part_one_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  scan_id uuid not null references private.part_one_scans(id) on delete cascade,
  generation integer not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index part_one_current_interest on private.part_one_subscriptions(scan_id, generation)
  where ended_at is null;
create table private.part_one_saves (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  scan_id uuid not null references private.part_one_scans(id) on delete cascade,
  snapshot_at_save_id uuid not null references private.part_one_records(id),
  declaration_id uuid references private.part_one_records(id),
  saved_result jsonb not null,
  saved_request jsonb not null,
  deletion_epoch integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(owner_id, idempotency_key)
);
create table private.part_one_captures (
  id uuid primary key default gen_random_uuid(),
  package_observation_id uuid not null default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  scan_id uuid not null references private.part_one_scans(id) on delete cascade,
  generation integer not null,
  capture_revision integer not null default 0,
  deletion_epoch integer not null,
  item_id uuid,
  expires_at timestamptz not null default now() + interval '30 minutes',
  removed_at timestamptz
);

-- Even service-role writes cannot mutate historical observations/declarations.
create function private.part_one_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'PART_ONE_IMMUTABLE'; end; $$;
create trigger part_one_records_no_update before update on private.part_one_records
  for each row execute function private.part_one_immutable();

-- Tables are private to the server. Customer access is through checked RPCs.
do $$ declare t text; begin
  foreach t in array array['policies','records','record_status','jobs','worker_health','budgets','reservations','scans','subscriptions','saves','captures'] loop
    execute format('alter table private.part_one_%I enable row level security', t);
    execute format('revoke all on private.part_one_%I from public, anon, authenticated', t);
    execute format('grant all on private.part_one_%I to service_role', t);
  end loop;
end $$;

create function private.part_one_owner() returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); begin
  if u is null then raise exception 'PART_ONE_UNAUTHORIZED' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text, 191027));
  if not exists(select 1 from public.profiles where id=u and deletion_started_at is null) then
    raise exception 'PART_ONE_OWNER_UNAVAILABLE' using errcode='42501';
  end if;
  return u;
end $$;

-- Whole dependency closure is checked on reads/saves/publication. A text copy
-- cannot escape revocation of its source policy or evidence dependency.
create function private.part_one_record_allowed(p_id uuid, p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
  with recursive dependencies as (
    select r.* from private.part_one_records r where r.id=p_id
    union
    select r.* from private.part_one_records r join dependencies d on r.id=any(d.dependencies)
  )
  select exists(select 1 from dependencies where id=p_id)
    and not exists(
      select 1 from dependencies d
      left join private.part_one_record_status s on s.record_id=d.id
      join private.part_one_policies p on p.id=d.policy_id
      where (d.owner_id is not null and d.owner_id is distinct from p_owner)
        or coalesce(s.status,'active') in ('revoked','retracted')
        or d.expires_at <= now() or not p.retain_allowed or not p.display_allowed
        or p.version <> d.policy_version or (p.expires_at is not null and p.expires_at <= now())
        or exists(select 1 from unnest(d.dependencies) x where not exists(select 1 from private.part_one_records r where r.id=x))
    );
$$;

-- A snapshot retains its complete provenance closure. Identity is a narrower
-- projection: declaration-only dependencies cannot revoke independently sourced
-- identity fields. Explicit field/barcode evidence is checked recursively with
-- its own policy/status/expiry; legacy identity snapshots use direct non-
-- declaration dependencies. A retracted identity observation still hides it.
create function private.part_one_snapshot_identity_allowed(p_id uuid, p_owner uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare snap private.part_one_records; policy private.part_one_policies; status text;
  explicit_ids uuid[] := '{}'; identity_ids uuid[] := '{}'; dep uuid;
begin
 select * into snap from private.part_one_records where id=p_id and kind='snapshot';
 if not found or (snap.owner_id is not null and snap.owner_id is distinct from p_owner) or snap.expires_at<=now() then return false; end if;
 select * into policy from private.part_one_policies where id=snap.policy_id;
 if not found or not policy.retain_allowed or not policy.display_allowed or policy.version<>snap.policy_version
   or (policy.expires_at is not null and policy.expires_at<=now()) then return false; end if;
 select rs.status into status from private.part_one_record_status rs where rs.record_id=snap.id;
 if status in ('revoked','retracted') then return false; end if;
 if jsonb_typeof(snap.payload->'fieldEvidence')='object' then
   select coalesce(array_agg(distinct x.value::uuid),'{}') into explicit_ids
     from jsonb_each(snap.payload->'fieldEvidence') field,
       lateral jsonb_array_elements_text(field.value) x;
 end if;
 if jsonb_typeof(snap.payload->'barcodeAssertions')='array' then
   explicit_ids := explicit_ids || array(select (a->>'evidenceId')::uuid
     from jsonb_array_elements(snap.payload->'barcodeAssertions') a);
 end if;
 if cardinality(explicit_ids)>0 then
   identity_ids := explicit_ids;
 else
   -- Missing dependency records cannot be assumed ingredient-only.
   if exists(select 1 from unnest(snap.dependencies) d where not exists(select 1 from private.part_one_records rr where rr.id=d)) then return false; end if;
   identity_ids := array(select rr.id from private.part_one_records rr
     where rr.id=any(snap.dependencies) and rr.kind<>'declaration');
   if cardinality(snap.dependencies)>0 and cardinality(identity_ids)=0 then return false; end if;
 end if;
 foreach dep in array identity_ids loop
   if dep<>all(snap.dependencies) or not private.part_one_record_allowed(dep,p_owner) then return false; end if;
 end loop;
 return true;
end $$;

create function private.part_one_empty_result(p_request jsonb, p_scan uuid) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('schemaVersion',1,'requestId',p_request->>'requestId','scanId',p_scan,
   'generation',(p_request->>'generation')::integer,'resultRevision',1,
   'identity','pending','itemId',null,'candidateIds','[]'::jsonb,'snapshotId',null,
   'declarationId',null,'declarationState','none','scope',null,'packageConfirmation','unconfirmed',
   'work','deferred_budget','jobId',null,'subscriptionId',null,'nextCheckAfter',null,
   'display',jsonb_build_object('resultRevision',1,'selectedIdentity',null,'candidates','[]'::jsonb,'sections','[]'::jsonb,
      'sources','[]'::jsonb,'limitations',jsonb_build_array('Background worker is not running')),
   'reasonCodes',jsonb_build_array('worker_unavailable'),'conflictIds','[]'::jsonb,
   'evidenceIds','[]'::jsonb,'allowedActions',jsonb_build_array('rescan','retry'),
   'freshness',jsonb_build_object('observedAt',null,'expiresAt',null,'state','unknown'));
$$;

create function private.part_one_filter_result(p_result jsonb, p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb := p_result; snapshot uuid; declaration uuid; begin
  snapshot := nullif(r->>'snapshotId','')::uuid;
  declaration := nullif(r->>'declarationId','')::uuid;
  if snapshot is not null and not private.part_one_snapshot_identity_allowed(snapshot,p_owner) then
    r := r || jsonb_build_object('snapshotId',null,'itemId',null,'identity','unresolved',
      'declarationId',null,'declarationState','none','scope',null,'candidateIds','[]'::jsonb,
      'display',jsonb_build_object('resultRevision',1,'selectedIdentity',null,'candidates','[]'::jsonb,'sections','[]'::jsonb,
        'sources','[]'::jsonb,'limitations',jsonb_build_array('Evidence is no longer available')),
      'evidenceIds','[]'::jsonb,'allowedActions',jsonb_build_array('rescan'),
      'reasonCodes',jsonb_build_array('expired_evidence'),
      'freshness',jsonb_build_object('observedAt',null,'expiresAt',null,'state','revoked'));
  elsif (snapshot is not null and not private.part_one_record_allowed(snapshot,p_owner))
    or (declaration is not null and not private.part_one_record_allowed(declaration,p_owner)) then
    r := r || jsonb_build_object('declarationId',null,'declarationState','conflict','scope','public',
      'reasonCodes',jsonb_build_array('identity_conflict'),'allowedActions',jsonb_build_array('save_partial','rescan'));
    r := jsonb_set(r,'{display,sections}','[]'::jsonb);
    r := jsonb_set(r,'{display,sources}','[]'::jsonb);
    r := jsonb_set(r,'{display,limitations}',jsonb_build_array('Ingredient evidence was retracted'));
    r := jsonb_set(r,'{evidenceIds}','[]'::jsonb);
  end if;
  return jsonb_set(r,'{display,resultRevision}',r->'resultRevision');
end $$;

create function private.part_one_refresh_scan(p_id uuid, p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.part_one_scans; r jsonb; j private.part_one_jobs; evidence_changed boolean; begin
 select * into s from private.part_one_scans where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
 r := private.part_one_filter_result(s.result,p_owner);
 evidence_changed := r is distinct from s.result;
 if s.job_id is not null then
   select * into j from private.part_one_jobs where id=s.job_id;
   r := r || jsonb_build_object('work', j.state,'nextCheckAfter',case when j.state in ('retry_wait','deferred_budget') then j.next_eligible_at else null end);
   if j.state='failed_final' and r->>'identity'='pending' then
     r := r || jsonb_build_object('identity','unresolved','reasonCodes',jsonb_build_array('source_error'),
       'allowedActions',jsonb_build_array('rescan'));
   end if;
 end if;
 if r is distinct from s.result then
   s.result_revision := s.result_revision + 1;
   r := r || jsonb_build_object('resultRevision',s.result_revision);
   r := jsonb_set(r,'{display,resultRevision}',r->'resultRevision');
   update private.part_one_scans set result=r,result_revision=s.result_revision,
     binding_revision=binding_revision+case when evidence_changed then 1 else 0 end where id=p_id;
 end if;
 return r;
end $$;

-- Verified legacy identifiers are reused only as identity. Existing formula
-- arrays have no DEC-01 panel boundaries and are deliberately not promoted.
create function private.part_one_catalog_identity(p_key text, p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v record; rid uuid; payload jsonb; results jsonb := '[]'; begin
 for v in select distinct pv.id as item_id,p.name,p.brand,pv.variant_name,pv.package_size,pv.region_code
   from public.product_identifiers i join public.product_variants pv on pv.id=i.variant_id
   join public.products p on p.id=pv.product_id
   where i.verified_at is not null and pv.lifecycle_status='active'
     and i.identifier_type like 'gtin_%' and 'gtin:' || lpad(i.identifier_value,14,'0')=p_key
 loop
   select id into rid from private.part_one_records where kind='snapshot' and item_id=v.item_id
     and canonical_key=p_key and private.part_one_snapshot_identity_allowed(id,null)
     and payload->'requestedMarket' is not distinct from p_request->'requestedMarket' order by revision desc limit 1;
   if rid is null then
     rid := gen_random_uuid();
     payload := jsonb_build_object('itemId',v.item_id,'name',v.name,'brand',v.brand,
       'variantText',concat_ws(' · ',v.variant_name,v.package_size),'image',null,
       'declarationIds','[]'::jsonb,'sourceMarkets',case when v.region_code is null then '[]'::jsonb else jsonb_build_array(v.region_code) end,
       'packageMarket',null,'requestedMarket',p_request->'requestedMarket');
     insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,observed_at,expires_at)
       values(rid,'snapshot',v.item_id,coalesce((select max(revision)+1 from private.part_one_records where kind='snapshot' and item_id=v.item_id),1),
       p_key,'derive_catalog','1',payload,now(),now()+interval '24 hours');
   end if;
   results := results || jsonb_build_array(jsonb_build_object('itemId',v.item_id,'snapshotId',rid));
 end loop;
 return results;
end $$;

-- Revalidate at the authenticated RPC boundary too: direct callers cannot
-- supply a canonical key unrelated to the retained native barcode.
create function private.part_one_code_key(p_code jsonb) returns text
language plpgsql immutable set search_path='' as $$
declare raw text := p_code->>'raw'; sym text := regexp_replace(lower(p_code->>'symbology'),'[-_ ]','','g');
  native text; expected integer; n integer; i integer; total integer := 0; weight integer := 3; f text;
begin
 if p_code->>'namespace' is distinct from 'gtin' or raw is null or raw !~ '^[0-9]+$' then return null; end if;
 if sym is not null and sym not in ('upca','upce','ean13','ean8','itf14','gtin14') then return null; end if;
 if length(raw)=8 and sym is null then return null; end if;
 native := raw;
 if sym='upce' then
   if raw !~ '^[01][0-9]{7}$' then return null; end if;
   f := substr(raw,7,1);
   native := case
     when f in ('0','1','2') then substr(raw,1,3)||f||'0000'||substr(raw,4,3)
     when f='3' then substr(raw,1,4)||'00000'||substr(raw,5,2)
     when f='4' then substr(raw,1,5)||'00000'||substr(raw,6,1)
     else substr(raw,1,6)||'0000'||f end || substr(raw,8,1);
 else
   expected := case sym when 'upca' then 12 when 'ean13' then 13 when 'ean8' then 8 when 'itf14' then 14 when 'gtin14' then 14 end;
   if expected is not null and length(native)<>expected then return null; end if;
 end if;
 n := length(native);
 if n not in (8,12,13,14) then return null; end if;
 if (n=12 and native ~ '^[24]') or (n=13 and native ~ '^2') then return null; end if;
 for i in reverse n-1..1 loop
   total := total + substr(native,i,1)::integer * weight;
   weight := case weight when 3 then 1 else 3 end;
 end loop;
 if ((10 - total % 10) % 10) <> substr(native,n,1)::integer then return null; end if;
 return 'gtin:' || lpad(native,14,'0');
end $$;

-- One transaction owns operation creation, binding, subscription and save.
create function public.part_one_operation(p_action text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare u uuid := private.part_one_owner(); s private.part_one_scans; j private.part_one_jobs;
  saved private.part_one_saves; c private.part_one_captures; r jsonb; id uuid; sub uuid;
  key text; catalog jsonb; snap private.part_one_records; dec private.part_one_records;
  worker_live boolean; expected integer;
begin
 -- Serialize with lifecycle/publication so save sees one rights/deletion revision.
 perform pg_catalog.pg_advisory_xact_lock(40203);
 if jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text)>65536 or p_payload ? 'ownerId' then
   raise exception 'PART_ONE_INVALID_PAYLOAD';
 end if;
 if p_action='scans/create' then
   if p_payload->>'idempotencyKey' is null or length(p_payload->>'idempotencyKey') not between 1 and 200
      or p_payload->'request'->>'schemaVersion' is distinct from '1' or p_payload->'request'->>'generation' is null
      or p_payload->'request'->>'requestId' is null then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(u::text || ':' || (p_payload->>'idempotencyKey'), 40201));
   select * into s from private.part_one_scans where owner_id=u and idempotency_key=p_payload->>'idempotencyKey' for update;
   if found then
     if s.request is distinct from p_payload->'request' then raise exception 'PART_ONE_IDEMPOTENCY_CONFLICT'; end if;
     return private.part_one_refresh_scan(s.id,u);
   end if;
   id := gen_random_uuid(); key := private.part_one_code_key(p_payload->'request'->'code');
   p_payload := p_payload || jsonb_build_object('canonicalKey',key);
   r := private.part_one_empty_result(p_payload->'request',id);
   if key is null then
     r := r || jsonb_build_object('identity','unresolved','work','complete','reasonCodes',case when jsonb_array_length(coalesce(p_payload->'reasonCodes','[]'))>0 then p_payload->'reasonCodes' else jsonb_build_array('unsupported_namespace') end,
       'allowedActions',jsonb_build_array('rescan'));
     r := jsonb_set(r,'{display,limitations}',jsonb_build_array('Barcode format or namespace is unsupported'));
   else
     perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(key,40202));
     catalog := private.part_one_catalog_identity(key,p_payload->'request');
     select coalesce(jsonb_agg(jsonb_build_object('itemId',c.item_id,'snapshotId',c.id)),'[]') into catalog
       from (select distinct on (item_id) id,item_id from private.part_one_records
         where kind='snapshot' and canonical_key=key and scope='public'
           and private.part_one_snapshot_identity_allowed(id,u)
           and payload->'requestedMarket' is not distinct from p_payload->'request'->'requestedMarket'
         order by item_id,revision desc,created_at desc) c;
     -- Current permitted Part 1 snapshots take precedence over legacy identity.
     select * into snap from private.part_one_records where kind='snapshot' and canonical_key=key
       and scope='public' and private.part_one_snapshot_identity_allowed(id,u)
       and (payload->'requestedMarket' is not distinct from (p_payload->'request'->'requestedMarket'))
       order by revision desc,created_at desc limit 1;
     if found and jsonb_array_length(catalog)<=1 then
       r := r || jsonb_build_object('identity','exact','itemId',snap.item_id,'snapshotId',snap.id,
         'scope','public','reasonCodes',jsonb_build_array('no_declaration'),
         'display',jsonb_build_object('selectedIdentity',jsonb_build_object('id',snap.item_id,'name',snap.payload->'name','brand',snap.payload->'brand',
           'variantText',snap.payload->'variantText','image',snap.payload->'image'),'candidates','[]'::jsonb,'sections','[]'::jsonb,
           'sources','[]'::jsonb,'limitations',jsonb_build_array('Ingredients not verified yet')),
         'allowedActions',jsonb_build_array('save_partial','rescan'),
         'freshness',jsonb_build_object('observedAt',snap.observed_at,'expiresAt',snap.expires_at,'state','fresh'));
       -- Select one whole declaration only when its own stored predicate passes.
       select * into dec from private.part_one_records d where d.kind='declaration' and d.item_id=snap.item_id
         and d.id::text in (select jsonb_array_elements_text(coalesce(snap.payload->'declarationIds','[]')))
         and private.part_one_record_allowed(d.id,u) and d.scope='public'
         and ((d.payload->>'state' in ('partial','uncertain')
           and d.payload->'predicate' @> '{"association":{"passed":true},"noContradiction":{"passed":true}}'::jsonb)
           or (d.payload->>'state'='accepted' and d.payload->'predicate' @> '{"association":{"passed":true},"noContradiction":{"passed":true},"variantMarket":{"passed":true},"completeness":{"passed":true},"rightsFreshness":{"passed":true}}'::jsonb))
         order by (d.payload->>'state'='accepted') desc,d.revision desc limit 1;
       if found then
         r := r || jsonb_build_object('declarationId',dec.id,'declarationState',dec.payload->>'state',
           'work',case when dec.payload->>'state'='accepted' then 'complete' else 'deferred_budget' end,
           'reasonCodes',case when dec.payload->>'state'='accepted' then '[]'::jsonb else jsonb_build_array('missing_section') end,
           'evidenceIds',to_jsonb(dec.dependencies),'allowedActions',
             case when dec.payload->>'state'='accepted' then jsonb_build_array('save','rescan') else jsonb_build_array('save_partial','rescan') end);
         r := jsonb_set(r,'{display,sections}',dec.payload->'sections');
         r := jsonb_set(r,'{display,sources}',coalesce(dec.payload->'sources','[]'));
         r := jsonb_set(r,'{display,limitations}',jsonb_build_array(
           case when dec.payload->>'state'='accepted' then 'Published evidence; package is unconfirmed' else 'Published incomplete evidence; full ingredient list is not verified' end));
       end if;
     elsif jsonb_array_length(catalog)>1 then
       r := r || jsonb_build_object('identity','ambiguous','candidateIds',(select jsonb_agg(x->'itemId') from jsonb_array_elements(catalog) x),
         'allowedActions',jsonb_build_array('choose_candidate','rescan'),'reasonCodes',jsonb_build_array('identity_conflict'));
       r := jsonb_set(r,'{display,candidates}',(select jsonb_agg(jsonb_build_object('id',rr.item_id,'name',rr.payload->'name',
         'brand',rr.payload->'brand','variantText',rr.payload->'variantText','image',rr.payload->'image'))
         from private.part_one_records rr where rr.id::text in (select x->>'snapshotId' from jsonb_array_elements(catalog) x)));
     end if;
     if r->>'declarationState'<>'accepted' then
       key := key || '|' || coalesce(p_payload->'request'->>'requestedMarket','?') || '|identity-declaration|part-one-1';
       select * into j from private.part_one_jobs where coalescing_key=key and state in ('queued','running','deferred_budget','retry_wait') for update;
       if not found then
         select exists(select 1 from private.part_one_worker_health where heartbeat_at>now()-interval '30 seconds') into worker_live;
         insert into private.part_one_jobs(coalescing_key,input,policy_version,state)
           values(key,p_payload->'request'->'code' || jsonb_build_object('canonicalKey',p_payload->>'canonicalKey',
             'requestedMarket',p_payload->'request'->'requestedMarket'),'part-one-1',case when worker_live then 'queued' else 'deferred_budget' end) returning * into j;
       end if;
       r := r || jsonb_build_object('jobId',j.id,'work',j.state,'nextCheckAfter',j.next_eligible_at);
     end if;
   end if;
   r := jsonb_set(r,'{display,resultRevision}',r->'resultRevision');
   insert into private.part_one_scans(id,owner_id,idempotency_key,request,generation,result,job_id)
     values(id,u,p_payload->>'idempotencyKey',p_payload->'request',(p_payload->'request'->>'generation')::integer,r,j.id) returning * into s;
   return r;
 end if;
 if p_action='saves/list' then
   return jsonb_build_object('saves',(select coalesce(jsonb_agg(jsonb_build_object('saveId',ss.id,
     'snapshotAtSaveId',ss.snapshot_at_save_id,'createdAt',ss.created_at,
     'result',private.part_one_filter_result(ss.saved_result,u)) order by ss.created_at desc),'[]')
     from private.part_one_saves ss where ss.owner_id=u and ss.deleted_at is null));
 end if;
 if p_action in ('saves/read','saves/delete') then
   select * into saved from private.part_one_saves where id=(p_payload->>'id')::uuid and owner_id=u for update;
   if not found then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
   if p_action='saves/delete' then
     if saved.deleted_at is null then
       update private.part_one_saves set deleted_at=now(),deletion_epoch=deletion_epoch+1,saved_result='{}',saved_request='{}' where id=saved.id;
       update private.part_one_scans set result_revision=result_revision+1,binding_revision=binding_revision+1,
         result=jsonb_set(result,'{resultRevision}',to_jsonb(result_revision+1)) where id=saved.scan_id;
     end if;
     return jsonb_build_object('deleted',true,'saveId',saved.id);
   end if;
   if saved.deleted_at is not null then raise exception 'PART_ONE_DELETED'; end if;
   return jsonb_build_object('saveId',saved.id,'snapshotAtSaveId',saved.snapshot_at_save_id,
     'createdAt',saved.created_at,'result',private.part_one_filter_result(saved.saved_result,u));
 end if;
 if p_action='subscriptions/delete' then
   update private.part_one_subscriptions set ended_at=coalesce(ended_at,now()) where id=(p_payload->>'id')::uuid and owner_id=u;
   if not found then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
   return jsonb_build_object('ended',true);
 end if;
 if p_action='captures/observations' then
   select * into c from private.part_one_captures where id=(p_payload->>'captureSessionId')::uuid and owner_id=u for update;
   if not found then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
   p_payload := p_payload || jsonb_build_object('scanId',c.scan_id);
 end if;
 select * into s from private.part_one_scans where id=(p_payload->>'scanId')::uuid and owner_id=u for update;
 if not found then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
 r := private.part_one_refresh_scan(s.id,u);
 select * into s from private.part_one_scans where id=s.id;
 if p_action='scans/read' then return r; end if;
 if p_action='subscriptions/create' then
   select id into sub from private.part_one_subscriptions where scan_id=s.id and generation=s.generation and ended_at is null;
   if sub is null then insert into private.part_one_subscriptions(owner_id,scan_id,generation) values(u,s.id,s.generation) returning id into sub; end if;
   r := r || jsonb_build_object('subscriptionId',sub);
   update private.part_one_scans set result=r where id=s.id;
   return r;
 end if;
 if p_action='saves/create' then
   select * into saved from private.part_one_saves where owner_id=u and idempotency_key=p_payload->>'idempotencyKey';
   if found then
     if saved.deleted_at is not null then raise exception 'PART_ONE_DELETED'; end if;
     if saved.saved_request is distinct from p_payload then raise exception 'PART_ONE_IDEMPOTENCY_CONFLICT'; end if;
     return jsonb_build_object('saveId',saved.id,'snapshotAtSaveId',saved.snapshot_at_save_id,'result',private.part_one_filter_result(saved.saved_result,u));
   end if;
 end if;
 if (p_payload->>'expectedGeneration')::integer is distinct from s.generation or
    (p_payload->>'expectedResultRevision')::integer is distinct from s.result_revision then
   return jsonb_build_object('conflict',true,'code','stale_result','result',r);
 end if;
 if p_action='selection' then
   if not (r->'candidateIds') ? (p_payload->>'candidateId') then raise exception 'PART_ONE_INVALID_CANDIDATE'; end if;
   select * into snap from private.part_one_records where item_id=(p_payload->>'candidateId')::uuid and kind='snapshot'
     and scope='public' and canonical_key=private.part_one_code_key(s.request->'code')
     and payload->'requestedMarket' is not distinct from s.request->'requestedMarket'
     and private.part_one_snapshot_identity_allowed(id,u) order by revision desc limit 1;
   if not found then return jsonb_build_object('conflict',true,'code','expired_evidence','result',r); end if;
   s.generation := s.generation+1; s.result_revision := s.result_revision+1;
   r := r || jsonb_build_object('generation',s.generation,'resultRevision',s.result_revision,'identity','exact',
     'itemId',snap.item_id,'snapshotId',snap.id,'declarationId',null,'declarationState','none','scope','public',
     'packageConfirmation','user_bound','reasonCodes',jsonb_build_array('no_declaration'),'candidateIds','[]'::jsonb,
     'allowedActions',jsonb_build_array('save_partial','rescan'));
   r := jsonb_set(r,'{display}',jsonb_build_object('selectedIdentity',jsonb_build_object('id',snap.item_id,'name',snap.payload->'name',
     'brand',snap.payload->'brand','variantText',snap.payload->'variantText','image',snap.payload->'image'),
     'candidates','[]'::jsonb,'sections','[]'::jsonb,'sources','[]'::jsonb,'limitations',jsonb_build_array('Ingredients not verified yet')));
   r := jsonb_set(r,'{display,resultRevision}',r->'resultRevision');
   update private.part_one_scans set generation=s.generation,result_revision=s.result_revision,binding_revision=binding_revision+1,result=r,deletion_epoch=deletion_epoch+1 where id=s.id;
   update private.part_one_subscriptions set ended_at=now() where scan_id=s.id and ended_at is null;
   update private.part_one_captures set removed_at=now() where scan_id=s.id and removed_at is null;
   return r;
 end if;
 if p_action='captures/create' then
   insert into private.part_one_captures(owner_id,scan_id,generation,deletion_epoch,item_id)
     values(u,s.id,s.generation,s.deletion_epoch,nullif(r->>'itemId','')::uuid) returning * into c;
   return jsonb_build_object('captureSessionId',c.id,'packageObservationId',c.package_observation_id,'scanId',s.id,
     'generation',c.generation,'captureRevision',c.capture_revision,'deletionEpoch',c.deletion_epoch,
     'schemaVersion',1,'itemId',c.item_id,'candidateId',null);
 end if;
 if p_action='captures/remove' then
   update private.part_one_captures set removed_at=coalesce(removed_at,now()),capture_revision=capture_revision+1
     where id=(p_payload->>'captureSessionId')::uuid and owner_id=u and scan_id=s.id;
   if not found then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
   return jsonb_build_object('removed',true);
 end if;
 if p_action='captures/observations' then
   if c.removed_at is not null or c.expires_at<=now() or c.generation<>s.generation or c.deletion_epoch<>s.deletion_epoch
     or c.capture_revision is distinct from (p_payload->>'expectedCaptureRevision')::integer
     or c.package_observation_id is distinct from (p_payload->>'packageObservationId')::uuid
     or c.deletion_epoch is distinct from (p_payload->>'expectedDeletionEpoch')::integer then
     return jsonb_build_object('conflict',true,'code','stale_capture','result',r);
   end if;
   -- No OCR text, assets or edits enter persistence until privacy approval.
   raise exception 'PART_ONE_PRIVATE_RETENTION_DISABLED';
 end if;
 if p_action='saves/create' then
   if p_payload->>'selectedSnapshotId' is distinct from r->>'snapshotId' or
      p_payload->>'selectedDeclarationId' is distinct from r->>'declarationId' or r->>'snapshotId' is null then
      return jsonb_build_object('conflict',true,'code','binding_changed','result',r);
   end if;
   if not private.part_one_snapshot_identity_allowed((r->>'snapshotId')::uuid,u) then
     return jsonb_build_object('conflict',true,'code','expired_evidence','result',r);
   end if;
   if r->>'declarationId' is not null then
     select * into dec from private.part_one_records where id=(r->>'declarationId')::uuid;
     if not private.part_one_record_allowed((r->>'snapshotId')::uuid,u)
       or not private.part_one_record_allowed(dec.id,u) or dec.item_id::text is distinct from r->>'itemId'
       or (r->>'declarationState'='accepted' and not dec.payload->'predicate' @> '{"association":{"passed":true},"noContradiction":{"passed":true},"variantMarket":{"passed":true},"completeness":{"passed":true},"rightsFreshness":{"passed":true}}'::jsonb) then
       return jsonb_build_object('conflict',true,'code','declaration_retracted','result',r);
     end if;
   end if;
   insert into private.part_one_saves(owner_id,idempotency_key,scan_id,snapshot_at_save_id,declaration_id,saved_result,saved_request)
     values(u,p_payload->>'idempotencyKey',s.id,(r->>'snapshotId')::uuid,nullif(r->>'declarationId','')::uuid,r,p_payload) returning * into saved;
   return jsonb_build_object('saveId',saved.id,'snapshotAtSaveId',saved.snapshot_at_save_id,'result',r);
 end if;
 raise exception 'PART_ONE_UNSUPPORTED_OPERATION';
end $$;
revoke all on function public.part_one_operation(text,jsonb) from public,anon;
grant execute on function public.part_one_operation(text,jsonb) to authenticated;

-- Service-only durable consumer actions. Transactions serialize provider budget
-- changes; leases/CAS protect checkpoints and publication after process loss.
create function public.part_one_worker(p_action text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private.part_one_jobs; b private.part_one_budgets; policy private.part_one_policies;
  reservation private.part_one_reservations; rec private.part_one_records; dec private.part_one_records; s private.part_one_scans;
  token uuid; r jsonb; targets jsonb; target jsonb; retry_at timestamptz; sid uuid; did uuid;
  calls integer; active integer; status text;
begin
 if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>262144 then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
 perform pg_catalog.pg_advisory_xact_lock(40203);
 if p_action='heartbeat' then
   insert into private.part_one_worker_health(id,heartbeat_at,consumer_version) values(true,now(),p_payload->>'consumerVersion')
     on conflict(id) do update set heartbeat_at=excluded.heartbeat_at,consumer_version=excluded.consumer_version;
   return jsonb_build_object('alive',true);
 end if;
 if p_action='revoke_policy' then
   update private.part_one_policies set lookup_allowed=false,retain_allowed=false,display_allowed=false,export_allowed=false
     where id=p_payload->>'policyId';
   if not found then raise exception 'PART_ONE_SOURCE_POLICY_DISABLED'; end if;
   for s in select * from private.part_one_scans for update loop
     perform private.part_one_refresh_scan(s.id,s.owner_id);
   end loop;
   return jsonb_build_object('revoked',true);
 end if;
 if p_action='revoke' then
   update private.part_one_record_status set status=p_payload->>'status',reason=p_payload->>'reason',
     status_revision=status_revision+1,changed_at=now() where record_id=(p_payload->>'recordId')::uuid;
   if not found then
     insert into private.part_one_record_status(record_id,status,reason) values((p_payload->>'recordId')::uuid,p_payload->>'status',p_payload->>'reason');
   end if;
   -- A read-side filter also invalidates a save, never substitutes new evidence.
   for s in select * from private.part_one_scans for update loop
     perform private.part_one_refresh_scan(s.id,s.owner_id);
   end loop;
   return jsonb_build_object('revoked',true);
 end if;
 if p_action='admit' then
   select * into policy from private.part_one_policies where id=p_payload->>'policyId';
   if not found or not policy.retain_allowed or not policy.display_allowed or policy.version<>p_payload->>'policyVersion'
     or (policy.expires_at is not null and policy.expires_at<=now()) then raise exception 'PART_ONE_SOURCE_POLICY_DISABLED'; end if;
   if p_payload->>'scope'='private_package' then raise exception 'PART_ONE_PRIVATE_RETENTION_DISABLED'; end if;
   for sid in select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'dependencies','[]')) loop
     if not private.part_one_record_allowed(sid,null) then raise exception 'PART_ONE_DEPENDENCY_UNAVAILABLE'; end if;
   end loop;
   insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,scope,
       payload,dependencies,supersedes_id,observed_at,expires_at)
     values(coalesce(nullif(p_payload->>'id','')::uuid,gen_random_uuid()),p_payload->>'kind',nullif(p_payload->>'itemId','')::uuid,
       (p_payload->>'revision')::integer,p_payload->>'canonicalKey',policy.id,policy.version,'public',p_payload->'payload',
       array(select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'dependencies','[]'))),
       nullif(p_payload->>'supersedesId','')::uuid,(p_payload->>'observedAt')::timestamptz,
       least((p_payload->>'expiresAt')::timestamptz,coalesce(policy.expires_at,'infinity'::timestamptz))) returning * into rec;
   insert into private.part_one_record_status(record_id) values(rec.id);
   return jsonb_build_object('recordId',rec.id);
 end if;
 if p_action='claim' then
   -- Reservations dispatched before a crash stay unknown. They are never
   -- released or re-dispatched automatically by lease expiration.
   update private.part_one_jobs set state='failed_final',lease_token=null,lease_expires_at=null
     where state='running' and lease_expires_at<=now() and attempts>=max_attempts;
   select * into j from private.part_one_jobs where
     ((state in ('queued','deferred_budget','retry_wait') and next_eligible_at<=now())
       or (state='running' and lease_expires_at<=now())) and attempts<max_attempts
     order by case when state='running' then 0 else 1 end,created_at,id for update skip locked limit 1;
   if not found then return jsonb_build_object('job',null); end if;
   token := gen_random_uuid();
   update private.part_one_jobs set state='running',lease_token=token,lease_expires_at=now()+interval '30 seconds',
     attempts=attempts+1,updated_at=now() where id=j.id returning * into j;
   select coalesce(jsonb_agg(jsonb_build_object('scanId',id,'generation',generation,'resultRevision',result_revision,'bindingRevision',binding_revision)), '[]')
     into targets from private.part_one_scans where job_id=j.id and generation=(request->>'generation')::integer;
   return jsonb_build_object('job',jsonb_build_object('id',j.id,'input',j.input,'leaseToken',token,
     'leaseExpiresAt',j.lease_expires_at,'attempts',j.attempts,'maxAttempts',j.max_attempts,
     'checkpoints',j.checkpoints,'publishRevision',j.publish_revision,'targets',targets,
     'unknownReservations',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'provider',provider,'stage',stage)),'[]')
       from private.part_one_reservations where job_id=j.id and state='dispatched_unknown')));
 end if;
 select * into j from private.part_one_jobs where id=(p_payload->>'jobId')::uuid for update;
 if not found or j.state<>'running' or j.lease_token is distinct from (p_payload->>'leaseToken')::uuid
   or j.lease_expires_at<=now() then raise exception 'PART_ONE_STALE_LEASE'; end if;
 if p_action='renew' then
   update private.part_one_jobs set lease_expires_at=now()+interval '30 seconds',updated_at=now() where id=j.id;
   return jsonb_build_object('renewed',true);
 end if;
 if p_action='reserve' then
   select * into policy from private.part_one_policies where id=p_payload->>'provider';
   if not found or not policy.lookup_allowed or (policy.expires_at is not null and policy.expires_at<=now()) then
     raise exception 'PART_ONE_SOURCE_POLICY_DISABLED'; end if;
   select * into reservation from private.part_one_reservations where job_id=j.id and stage=p_payload->>'stage';
   if found then
     return jsonb_build_object('reservationId',reservation.id,'state',reservation.state,'replay',true,
       'mayDispatch',reservation.state='reserved');
   end if;
   select * into b from private.part_one_budgets where provider=p_payload->>'provider' for update;
   if not found then raise exception 'PART_ONE_BUDGET_CONFIGURATION_REQUIRED'; end if;
   select count(*)::integer into calls from private.part_one_reservations where provider=b.provider
     and state<>'released' and reserved_at>now()-make_interval(secs=>b.window_seconds);
   select count(*)::integer into active from private.part_one_reservations where provider=b.provider
     and state in ('reserved','dispatched_unknown');
   if calls>=b.call_limit or active>=b.concurrency_limit or b.reset_at>now() then
     retry_at := greatest(now()+make_interval(secs=>b.window_seconds),coalesce(b.reset_at,now()));
     update private.part_one_jobs set state='deferred_budget',next_eligible_at=retry_at,lease_token=null,
       lease_expires_at=null,updated_at=now() where id=j.id;
     return jsonb_build_object('deferred',true,'nextCheckAfter',retry_at,'reason','quota_wait');
   end if;
   insert into private.part_one_reservations(job_id,stage,provider,policy_version) values(j.id,p_payload->>'stage',b.provider,policy.version) returning * into reservation;
   return jsonb_build_object('reservationId',reservation.id,'state','reserved','replay',false,'mayDispatch',true);
 end if;
 if p_action='release' then
   update private.part_one_reservations set state='released' where id=(p_payload->>'reservationId')::uuid
     and job_id=j.id and state='reserved';
   return jsonb_build_object('released',found);
 end if;
 if p_action='dispatch' then
   if not exists(select 1 from private.part_one_reservations rr join private.part_one_policies pp on pp.id=rr.provider
     where rr.id=(p_payload->>'reservationId')::uuid and rr.job_id=j.id and pp.lookup_allowed
       and pp.version=rr.policy_version and (pp.expires_at is null or pp.expires_at>now())) then
     raise exception 'PART_ONE_SOURCE_POLICY_DISABLED'; end if;
   update private.part_one_reservations set state='dispatched_unknown' where id=(p_payload->>'reservationId')::uuid
     and job_id=j.id and state='reserved';
   return jsonb_build_object('mayDispatch',found);
 end if;
 if p_action='checkpoint' then
   -- A completed stage is immutable and is reused on resume, including a true
   -- parsed miss. Missing ingredient fields and outages are never true misses.
   if j.checkpoints ? (p_payload->>'stage') then
     if j.checkpoints->(p_payload->>'stage') is distinct from p_payload->'output' then raise exception 'PART_ONE_CHECKPOINT_CONFLICT'; end if;
     return jsonb_build_object('checkpointed',true,'replay',true);
   end if;
   status := p_payload->'output'->>'status';
   if status is null or status not in ('found','not_found','unsupported','ambiguous','rate_limited','unavailable',
       'malformed_response','configuration_required','disallowed_by_source_policy') then raise exception 'PART_ONE_INVALID_PROVIDER_STATUS'; end if;
   if status='not_found' and not coalesce((p_payload->'output'->>'parsedNegative')::boolean,false) then
     raise exception 'PART_ONE_UNPROVEN_NEGATIVE'; end if;
   update private.part_one_jobs set checkpoints=checkpoints || jsonb_build_object(p_payload->>'stage',p_payload->'output'),updated_at=now() where id=j.id;
   if p_payload->>'reservationId' is not null then
     update private.part_one_reservations set state='settled',outcome=status,retry_after=nullif(p_payload->'output'->>'retryAfter','')::timestamptz
       where id=(p_payload->>'reservationId')::uuid and job_id=j.id;
     if not found then raise exception 'PART_ONE_RESERVATION_NOT_FOUND'; end if;
     if status='rate_limited' then
       update private.part_one_budgets set reset_at=greatest(coalesce(reset_at,now()),
         coalesce(nullif(p_payload->'output'->>'retryAfter','')::timestamptz,now()+interval '60 seconds'))
         where provider=(select provider from private.part_one_reservations where id=(p_payload->>'reservationId')::uuid);
     end if;
   end if;
   return jsonb_build_object('checkpointed',true);
 end if;
 if p_action in ('finish','retry') then
   if (p_payload->>'expectedPublishRevision')::integer is distinct from j.publish_revision then raise exception 'PART_ONE_STALE_PUBLICATION'; end if;
   r := coalesce(p_payload->'resultPatch','{}'::jsonb);
   sid := nullif(r->>'snapshotId','')::uuid; did := nullif(r->>'declarationId','')::uuid;
   if sid is not null then
     select * into rec from private.part_one_records where id=sid and kind='snapshot';
     if not found or rec.scope<>'public' or rec.canonical_key is distinct from j.input->>'canonicalKey'
       or rec.item_id::text is distinct from r->>'itemId' or not private.part_one_snapshot_identity_allowed(sid,null) then
       raise exception 'PART_ONE_INVALID_PUBLICATION'; end if;
     if did is not null then
       select * into dec from private.part_one_records where id=did and kind='declaration';
       if not found or not private.part_one_record_allowed(sid,null) or dec.scope<>'public' or dec.item_id is distinct from rec.item_id or
         not private.part_one_record_allowed(did,null) or not (rec.payload->'declarationIds') ? did::text or
         (r->>'declarationState'='accepted' and not dec.payload->'predicate' @> '{"association":{"passed":true},"noContradiction":{"passed":true},"variantMarket":{"passed":true},"completeness":{"passed":true},"rightsFreshness":{"passed":true}}'::jsonb) then
         raise exception 'PART_ONE_INVALID_PUBLICATION'; end if;
     end if;
   elsif did is not null then raise exception 'PART_ONE_INVALID_PUBLICATION'; end if;
   -- Provider output cannot alter operation IDs, generations, ownership or
   -- subscriptions. Only explicit evidence fields are projected.
   r := r - array['ownerId','scanId','requestId','generation','resultRevision','subscriptionId','jobId','schemaVersion'];
   for target in select value from jsonb_array_elements(coalesce(p_payload->'targets','[]')) loop
     select * into s from private.part_one_scans where id=(target->>'scanId')::uuid and job_id=j.id for update;
     if found and s.generation=(target->>'generation')::integer and s.binding_revision=(target->>'bindingRevision')::integer
       and s.generation=(s.request->>'generation')::integer
       and exists(select 1 from public.profiles where id=s.owner_id and deletion_started_at is null)
       and s.result->>'scope' is distinct from 'private_package' then
       s.result_revision := s.result_revision+1;
       update private.part_one_scans set result_revision=s.result_revision,binding_revision=binding_revision+1,
         result=private.part_one_filter_result(s.result || r || jsonb_build_object('identity',
           case when s.result->>'identity'='pending' and not r ? 'identity' then 'unresolved' else coalesce(r->>'identity',s.result->>'identity') end,
           'resultRevision',s.result_revision,
           'work',case when p_action='retry' and j.attempts<j.max_attempts then 'retry_wait'
             when p_action='retry' then 'failed_final' else 'complete' end),s.owner_id) where id=s.id;
     end if;
   end loop;
   update private.part_one_jobs set state=case when p_action='retry' and attempts<max_attempts then 'retry_wait'
       when p_action='retry' then 'failed_final' else 'complete' end,
     next_eligible_at=case when p_action='retry' then greatest(now()+interval '1 second',coalesce(nullif(p_payload->>'nextEligibleAt','')::timestamptz,
       now()+make_interval(secs=>least(300,power(2,attempts)::integer)))) else now() end,
     output=r,publish_revision=publish_revision+1,lease_token=null,lease_expires_at=null,updated_at=now() where id=j.id;
   return jsonb_build_object('finished',true);
 end if;
 raise exception 'PART_ONE_UNSUPPORTED_OPERATION';
end $$;
revoke all on function public.part_one_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.part_one_worker(text,jsonb) to service_role;
-- Private helpers must never be RPC entry points.
revoke all on function private.part_one_immutable(),private.part_one_owner(),private.part_one_record_allowed(uuid,uuid),
  private.part_one_snapshot_identity_allowed(uuid,uuid),
  private.part_one_empty_result(jsonb,uuid),private.part_one_filter_result(jsonb,uuid),private.part_one_code_key(jsonb),
  private.part_one_refresh_scan(uuid,uuid),private.part_one_catalog_identity(text,jsonb) from public,anon,authenticated;
