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
create table private.part_one_candidate_bindings (
  scan_id uuid not null references private.part_one_scans(id) on delete cascade,
  generation integer not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  snapshot_id uuid not null references private.part_one_records(id),
  primary key(scan_id,generation,item_id)
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

-- No destination/retention is approved by this migration. The receipt boundary
-- is server-only; client metadataStripped/hash/dimensions never attest bytes.
create table private.part_one_private_config (
 id boolean primary key default true check(id),enabled boolean not null default false,
 policy_version text not null default 'retention-pending-1',
 process_allowed boolean not null default false,ocr_allowed boolean not null default false,
 upload_allowed boolean not null default false,private_display_allowed boolean not null default false,
 source_policy_id uuid not null default '00000000-0000-4000-8000-000000000006',
 bucket_id text references storage.buckets(id),retention_seconds integer check(retention_seconds between 1 and 31536000),
 deletion_deadline_seconds integer check(deletion_deadline_seconds between 1 and 86400),
 approval_evidence text,expires_at timestamptz,
 check(not enabled or (process_allowed and ocr_allowed and upload_allowed and private_display_allowed and bucket_id is not null and retention_seconds is not null and deletion_deadline_seconds is not null
   and approval_evidence is not null and expires_at is not null))
);
insert into private.part_one_private_config(id) values(true);
create table private.part_one_asset_attestations (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 capture_id uuid not null references private.part_one_captures(id) on delete cascade,
 package_observation_id uuid not null,generation integer not null,deletion_epoch integer not null,
 storage_object_id uuid not null references storage.objects(id) on delete cascade,
 object_version text not null,content_hash text not null,width integer not null check(width between 1 and 4096),
 height integer not null check(height between 1 and 4096),sanitizer_version text not null,verification_evidence text not null,
 metadata_stripped boolean not null check(metadata_stripped),observed_at timestamptz not null,expires_at timestamptz not null,
 check(expires_at>observed_at),unique(capture_id,storage_object_id)
);
create table private.part_one_asset_status (
 attestation_id uuid primary key references private.part_one_asset_attestations(id) on delete cascade,
 revoked_at timestamptz,reason text
);
create table private.part_one_private_assets (
 record_id uuid primary key references private.part_one_records(id) on delete cascade,
 attestation_id uuid not null references private.part_one_asset_attestations(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 capture_id uuid not null references private.part_one_captures(id) on delete cascade,
 client_evidence_id uuid not null,unique(capture_id,client_evidence_id)
);
create table private.part_one_capture_commits (
 owner_id uuid not null references auth.users(id) on delete cascade,
 capture_id uuid not null references private.part_one_captures(id) on delete cascade,
 idempotency_key text not null,request_hash text not null,package_observation_id uuid not null,
 generation integer not null,deletion_epoch integer not null,capture_revision integer not null,
 observation_ids uuid[] not null,declaration_ids uuid[] not null,asset_ids uuid[] not null,
 deleted_at timestamptz,created_at timestamptz not null default now(),primary key(owner_id,idempotency_key)
);
-- Storage objects must be removed through the Storage API, not SQL metadata
-- deletion. This durable outbox retains only the cleanup locator until ack.
create table private.part_one_private_cleanup (
 object_id uuid primary key,bucket_id text not null,object_name text not null,
 due_at timestamptz not null,reason text not null,created_at timestamptz not null default now()
);

-- Even service-role writes cannot mutate historical observations/declarations.
create function private.part_one_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'PART_ONE_IMMUTABLE'; end; $$;
create trigger part_one_records_no_update before update on private.part_one_records
  for each row execute function private.part_one_immutable();

create trigger part_one_attestations_no_update before update on private.part_one_asset_attestations for each row execute function private.part_one_immutable();
create trigger part_one_private_assets_no_update before update on private.part_one_private_assets for each row execute function private.part_one_immutable();

-- Tables are private to the server. Customer access is through checked RPCs.
do $$ declare t text; begin
  foreach t in array array['policies','records','record_status','jobs','worker_health','budgets','reservations','scans','candidate_bindings','subscriptions','saves','captures','private_config','asset_attestations','asset_status','private_assets','capture_commits','private_cleanup'] loop
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

create function private.part_one_private_record_allowed(p_id uuid,p_owner uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare rec private.part_one_records; cfg private.part_one_private_config; a private.part_one_asset_attestations; c private.part_one_captures;
begin
 select * into rec from private.part_one_records where id=p_id;
 if not found or rec.scope<>'private_package' or rec.owner_id is distinct from p_owner then return false; end if;
 select * into cfg from private.part_one_private_config where id=true;
 if not found or not cfg.enabled or cfg.expires_at<=now() or cfg.policy_version<>rec.policy_version then return false; end if;
 select * into c from private.part_one_captures where id=nullif(rec.payload->>'captureSessionId','')::uuid and owner_id=p_owner;
 if not found or c.package_observation_id::text is distinct from rec.payload->>'packageObservationId' then return false; end if;
 if rec.payload->>'privateKind'='sanitized_image' then
   select aa.* into a from private.part_one_private_assets pa join private.part_one_asset_attestations aa on aa.id=pa.attestation_id
     where pa.record_id=rec.id and pa.owner_id=p_owner and pa.capture_id=c.id;
   return found and a.expires_at>now() and not exists(select 1 from private.part_one_asset_status where attestation_id=a.id and revoked_at is not null)
     and exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.id=a.storage_object_id
       and o.owner_id=p_owner::text and o.bucket_id=cfg.bucket_id and not b.public and o.version=a.object_version
       and coalesce(o.is_delete_marker,false)=false and o.archived_at is null);
 end if;
 return rec.payload->>'privateKind' in ('ocr','edit','declaration');
exception when invalid_text_representation then return false;
end $$;

create function private.part_one_purge_capture(p_capture uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare c private.part_one_captures; cfg private.part_one_private_config; ids uuid[]; s private.part_one_scans; r jsonb;
begin
 select * into c from private.part_one_captures where id=p_capture for update;
 if not found then return; end if;
 select * into cfg from private.part_one_private_config where id=true;
 insert into private.part_one_private_cleanup(object_id,bucket_id,object_name,due_at,reason)
   select distinct o.id,o.bucket_id,o.name,now()+make_interval(secs=>coalesce(cfg.deletion_deadline_seconds,1)),p_reason
   from private.part_one_asset_attestations aa join storage.objects o on o.id=aa.storage_object_id
   where aa.capture_id=c.id and aa.owner_id=c.owner_id and o.owner_id=c.owner_id::text
     and o.version=aa.object_version
   on conflict(object_id) do update set due_at=least(private.part_one_private_cleanup.due_at,excluded.due_at);
 select coalesce(array_agg(id),'{}') into ids from private.part_one_records
   where owner_id=c.owner_id and scope='private_package' and payload->>'captureSessionId'=c.id::text;
 -- Erase copied transcripts as well as source rows. Snapshot-at-save identity
 -- remains; the removed private declaration cannot be inherited or replayed.
 update private.part_one_saves set declaration_id=null,saved_result=saved_result || jsonb_build_object('declarationId',null,
   'declarationState','conflict','scope',case when snapshot_at_save_id is null then null else 'public' end,
   'evidenceIds','[]'::jsonb,'reasonCodes',jsonb_build_array('private_proof_removed'),
   'display',(saved_result->'display') || jsonb_build_object('sections','[]'::jsonb,'sources','[]'::jsonb,'limitations',jsonb_build_array('Private proof removed')))
   where owner_id=c.owner_id and declaration_id=any(ids);
 update private.part_one_capture_commits set deleted_at=coalesce(deleted_at,now()),observation_ids='{}',declaration_ids='{}',asset_ids='{}'
   where capture_id=c.id;
 delete from private.part_one_private_assets where capture_id=c.id;
 delete from private.part_one_records where id=any(ids);
 delete from private.part_one_asset_attestations where capture_id=c.id;
 update private.part_one_captures set removed_at=coalesce(removed_at,now()),
   capture_revision=capture_revision+case when c.removed_at is null or cardinality(ids)>0 then 1 else 0 end where id=c.id;
 for s in select * from private.part_one_scans where owner_id=c.owner_id and nullif(result->>'declarationId','')::uuid=any(ids) for update loop
   r:=private.part_one_filter_result(s.result,c.owner_id) || jsonb_build_object('resultRevision',s.result_revision+1);
   r:=jsonb_set(r,'{display,resultRevision}',r->'resultRevision');
   update private.part_one_scans set result=r,result_revision=s.result_revision+1,binding_revision=binding_revision+1 where id=s.id;
 end loop;
end $$;

create function private.part_one_purge_expired_private() returns void
language plpgsql security definer set search_path='' as $$
declare cid uuid; begin
 for cid in
   select distinct (rr.payload->>'captureSessionId')::uuid from private.part_one_records rr
     where rr.scope='private_package' and rr.payload->>'privateKind'='sanitized_image' and not private.part_one_record_allowed(rr.id,rr.owner_id)
   union
   -- Trusted uploads can expire before any OCR commit creates a record. A
   -- committed historical package is independent of the capture-sheet TTL;
   -- an uncommitted upload also follows session expiry/cancel and current rights.
   select aa.capture_id from private.part_one_asset_attestations aa
     join private.part_one_captures c on c.id=aa.capture_id and c.owner_id=aa.owner_id
     cross join private.part_one_private_config cfg
     join private.part_one_policies pp on pp.id='private_capture'
     where aa.expires_at<=now()
       or exists(select 1 from private.part_one_asset_status ast where ast.attestation_id=aa.id and ast.revoked_at is not null)
       or (not exists(select 1 from private.part_one_capture_commits cm where cm.capture_id=c.id and cm.deleted_at is null)
         and (c.expires_at<=now() or c.removed_at is not null or not cfg.enabled or cfg.expires_at<=now()
           or cfg.policy_version<>pp.version or not pp.retain_allowed or not pp.display_allowed
           or (pp.expires_at is not null and pp.expires_at<=now())))
 loop perform private.part_one_purge_capture(cid,'private_evidence_expired_or_revoked'); end loop;
end $$;

create function private.part_one_before_owner_delete() returns trigger
language plpgsql security definer set search_path='' as $$
declare c uuid; begin
 for c in select id from private.part_one_captures where owner_id=old.id loop
   perform private.part_one_purge_capture(c,'account_deleted');
 end loop;
 return old;
end $$;
create trigger part_one_private_before_owner_delete before delete on auth.users for each row execute function private.part_one_before_owner_delete();

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
        or (d.scope='private_package' and not private.part_one_private_record_allowed(d.id,p_owner))
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

create function private.part_one_identity_expiry(p_id uuid) returns timestamptz
language sql stable security definer set search_path='' as $$
 with recursive snap as (select * from private.part_one_records where id=p_id and kind='snapshot'),
 explicit_ids as (
   select x.value::uuid id from snap, lateral jsonb_each(coalesce(payload->'fieldEvidence','{}')) f,
     lateral jsonb_array_elements_text(f.value) x
   union select (a->>'evidenceId')::uuid from snap,lateral jsonb_array_elements(coalesce(payload->'barcodeAssertions','[]')) a
 ), roots as (
   select id from explicit_ids
   union select r.id from private.part_one_records r,snap where r.id=any(snap.dependencies) and r.kind<>'declaration'
     and not exists(select 1 from explicit_ids)
 ), deps as (
   select r.* from private.part_one_records r join roots on roots.id=r.id
   union select r.* from private.part_one_records r join deps d on r.id=any(d.dependencies)
 ), all_identity as (select * from snap union select * from deps)
 select min(least(r.expires_at,coalesce(p.expires_at,'infinity'::timestamptz)))
 from all_identity r join private.part_one_policies p on p.id=r.policy_id;
$$;
create function private.part_one_record_expiry(p_id uuid) returns timestamptz
language sql stable security definer set search_path='' as $$
 with recursive d as (select * from private.part_one_records where id=p_id
   union select r.* from private.part_one_records r join d on r.id=any(d.dependencies))
 select min(least(d.expires_at,coalesce(p.expires_at,'infinity'::timestamptz))) from d
 join private.part_one_policies p on p.id=d.policy_id;
$$;
create function private.part_one_display_expiry(p_asset jsonb,p_kind text) returns timestamptz
language plpgsql stable security definer set search_path='' as $$
declare expires timestamptz := (p_asset->>'expiresAt')::timestamptz; ids uuid[]; id uuid; begin
 if p_kind='section' then ids := array(select value::uuid from jsonb_array_elements_text(coalesce(p_asset->'evidenceIds','[]')));
 elsif p_kind='source' then ids := array[nullif(p_asset->>'observationId','')::uuid];
 else ids := array[nullif(p_asset->>'evidenceId','')::uuid]; end if;
 foreach id in array ids loop expires := least(expires,private.part_one_record_expiry(id)); end loop;
 return expires;
end $$;
create function private.part_one_display_allowed(p_asset jsonb,p_owner uuid,p_kind text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare evidence uuid; obs private.part_one_records; ids uuid[]; begin
 if p_asset is null or p_asset='null'::jsonb or p_asset->>'expiresAt' is null
   or (p_asset->>'expiresAt')::timestamptz<=now() then return false; end if;
 if p_kind='section' then
   ids := array(select value::uuid from jsonb_array_elements_text(coalesce(p_asset->'evidenceIds','[]')));
 elsif p_kind='source' then ids := array[nullif(p_asset->>'observationId','')::uuid];
 else ids := array[nullif(p_asset->>'evidenceId','')::uuid]; end if;
 if cardinality(ids)=0 then return false; end if;
 foreach evidence in array ids loop
   if evidence is null or not private.part_one_record_allowed(evidence,p_owner) then return false; end if;
   select * into obs from private.part_one_records where id=evidence;
   if obs.payload ? 'policyId' and obs.payload->>'policyId' is distinct from p_asset->>'policyId' then return false; end if;
 end loop;
 return true;
exception when invalid_text_representation or datetime_field_overflow then return false;
end $$;
create function private.part_one_bind_candidates(p_scan uuid,p_generation integer,p_owner uuid,p_ids jsonb,p_key text,p_market jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare item uuid; snapshot uuid; begin
 for item in select value::uuid from jsonb_array_elements_text(coalesce(p_ids,'[]')) loop
   select r.id into snapshot from private.part_one_records r where r.item_id=item and r.kind='snapshot' and r.scope='public'
     and r.canonical_key=p_key and r.payload->'requestedMarket' is not distinct from p_market
     and private.part_one_snapshot_identity_allowed(r.id,p_owner) order by r.revision desc,r.created_at desc limit 1;
   if snapshot is not null then
     insert into private.part_one_candidate_bindings(scan_id,generation,owner_id,item_id,snapshot_id)
       values(p_scan,p_generation,p_owner,item,snapshot)
       on conflict(scan_id,generation,item_id) do update set snapshot_id=excluded.snapshot_id;
   end if;
 end loop;
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
declare r jsonb := p_result; snapshot uuid; declaration uuid; rec private.part_one_records;
  bound private.part_one_records; cand jsonb; asset jsonb; candidates jsonb := '[]'; candidate_ids jsonb := '[]';
  sections jsonb := '[]'; sources jsonb := '[]'; shortened boolean := false; deadline timestamptz; identity_deadline timestamptz;
begin
 snapshot := nullif(r->>'snapshotId','')::uuid; declaration := nullif(r->>'declarationId','')::uuid;
 if snapshot is not null and not private.part_one_snapshot_identity_allowed(snapshot,p_owner) then
   r := r || jsonb_build_object('snapshotId',null,'itemId',null,'identity','unresolved',
     'declarationId',null,'declarationState','none','scope',null,'candidateIds','[]'::jsonb,
     'display',jsonb_build_object('resultRevision',1,'selectedIdentity',null,'candidates','[]'::jsonb,'sections','[]'::jsonb,
       'sources','[]'::jsonb,'limitations',jsonb_build_array('Evidence is no longer available')),
     'evidenceIds','[]'::jsonb,'allowedActions',jsonb_build_array('rescan'),
     'reasonCodes',jsonb_build_array('expired_evidence'),
     'freshness',jsonb_build_object('observedAt',null,'expiresAt',null,'state','revoked'));
   snapshot := null; declaration := null;
 elsif (snapshot is not null and not private.part_one_record_allowed(snapshot,p_owner))
   or (declaration is not null and not private.part_one_record_allowed(declaration,p_owner)) then
   r := r || jsonb_build_object('declarationId',null,'declarationState','conflict','scope',case when snapshot is null then null else 'public' end,
     'reasonCodes',jsonb_build_array('expired_evidence'),'allowedActions',jsonb_build_array('save_partial','rescan'));
   r := jsonb_set(r,'{display,sections}','[]'); r := jsonb_set(r,'{display,sources}','[]');
   r := jsonb_set(r,'{display,limitations}',jsonb_build_array('Ingredient evidence is no longer available'));
   r := jsonb_set(r,'{evidenceIds}','[]'); declaration := null;
 end if;
 if snapshot is not null then
   select * into rec from private.part_one_records where id=snapshot;
   identity_deadline := private.part_one_identity_expiry(snapshot); deadline := identity_deadline;
   if r->'display'->'selectedIdentity' <> 'null'::jsonb then
     r := jsonb_set(r,'{display,selectedIdentity,expiresAt}',to_jsonb(identity_deadline));
     asset := r->'display'->'selectedIdentity'->'image';
     if asset is not null and asset<>'null'::jsonb then
       if not private.part_one_display_allowed(asset,p_owner,'image') then
         r := jsonb_set(r,'{display,selectedIdentity,image}','null');
       else r := jsonb_set(r,'{display,selectedIdentity,image,expiresAt}',to_jsonb(private.part_one_display_expiry(asset,'image'))); end if;
     end if;
   end if;
 end if;
 if snapshot is not null or declaration is not null then
   if declaration is not null then deadline := least(coalesce(deadline,'infinity'::timestamptz),private.part_one_record_expiry(declaration)); end if;
   for asset in select value from jsonb_array_elements(coalesce(r->'display'->'sections','[]')) loop
     if private.part_one_display_allowed(asset,p_owner,'section') then
       asset := asset || jsonb_build_object('expiresAt',private.part_one_display_expiry(asset,'section'));
       sections := sections || jsonb_build_array(asset); deadline := least(deadline,(asset->>'expiresAt')::timestamptz);
     else shortened := true; deadline := least(deadline,coalesce((asset->>'expiresAt')::timestamptz,now()),now()); end if;
   end loop;
   for asset in select value from jsonb_array_elements(coalesce(r->'display'->'sources','[]')) loop
     if private.part_one_display_allowed(asset,p_owner,'source') then
       asset := asset || jsonb_build_object('expiresAt',private.part_one_display_expiry(asset,'source'));
       sources := sources || jsonb_build_array(asset); deadline := least(deadline,(asset->>'expiresAt')::timestamptz);
     else shortened := true; deadline := least(deadline,coalesce((asset->>'expiresAt')::timestamptz,now()),now()); end if;
   end loop;
   r := jsonb_set(r,'{display,sections}',sections); r := jsonb_set(r,'{display,sources}',sources);
   if shortened and declaration is not null then
     r := r || jsonb_build_object('declarationState',case when jsonb_array_length(sections)>0 then 'partial' else 'uncertain' end,
       'allowedActions',jsonb_build_array('save_partial','rescan'),'reasonCodes',jsonb_build_array('expired_evidence'));
   end if;
   r := r || jsonb_build_object('freshness',jsonb_build_object('observedAt',
     case when declaration is null then to_jsonb(rec.observed_at) else (select to_jsonb(observed_at) from private.part_one_records where id=declaration) end,
     'expiresAt',deadline,'state',case when shortened or deadline<=now() then 'expired' else 'fresh' end));
 end if;
 -- Bind every copied candidate to the exact server-stored immutable snapshot.
 for cand in select value from jsonb_array_elements(coalesce(r->'display'->'candidates','[]')) loop
   select rr.* into bound from private.part_one_candidate_bindings cb join private.part_one_records rr on rr.id=cb.snapshot_id
     where cb.scan_id=(r->>'scanId')::uuid and cb.generation=(r->>'generation')::integer and cb.owner_id=p_owner
       and cb.item_id=(cand->>'id')::uuid;
   if found and private.part_one_snapshot_identity_allowed(bound.id,p_owner) then
     cand := jsonb_build_object('id',bound.item_id,'name',bound.payload->'name','brand',bound.payload->'brand',
       'variantText',bound.payload->'variantText','image',bound.payload->'image','expiresAt',private.part_one_identity_expiry(bound.id));
     asset := cand->'image';
     if asset is not null and asset<>'null'::jsonb then
       if not private.part_one_display_allowed(asset,p_owner,'image') then cand := cand || jsonb_build_object('image',null);
       else cand := jsonb_set(cand,'{image,expiresAt}',to_jsonb(private.part_one_display_expiry(asset,'image'))); end if;
     end if;
     candidates := candidates || jsonb_build_array(cand); candidate_ids := candidate_ids || jsonb_build_array(bound.item_id);
   end if;
 end loop;
 if r->'candidateIds' <> candidate_ids then
   r := r || jsonb_build_object('candidateIds',candidate_ids,'reasonCodes',jsonb_build_array('expired_evidence'));
   if snapshot is null then
     r := r || jsonb_build_object('identity',case when jsonb_array_length(candidate_ids)=0 then 'unresolved' else 'candidate' end,
       'allowedActions',case when jsonb_array_length(candidate_ids)=0 then jsonb_build_array('rescan','retry') else jsonb_build_array('choose_candidate','rescan') end);
   end if;
 end if;
 r := jsonb_set(r,'{display,candidates}',candidates);
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
   if expected is not null and length(native)<>expected and not (sym='ean13' and length(native)=12) then return null; end if;
 end if;
 n := length(native);
 if n not in (8,12,13,14) then return null; end if;
 for i in reverse n-1..1 loop
   total := total + substr(native,i,1)::integer * weight;
   weight := case weight when 3 then 1 else 3 end;
 end loop;
 if ((10 - total % 10) % 10) <> substr(native,n,1)::integer then return null; end if;
 native := lpad(native,14,'0');
 if native ~ '^00[24]' or native ~ '^02' then return null; end if;
 return 'gtin:' || native;
end $$;

create function private.part_one_commit_capture(p_payload jsonb,p_owner uuid,p_scan private.part_one_scans,p_capture private.part_one_captures) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare cfg private.part_one_private_config; policy private.part_one_policies; receipt private.part_one_capture_commits;
  att private.part_one_asset_attestations; asset_record private.part_one_records; prior private.part_one_records;
  value jsonb; observation jsonb; line jsonb; raw_text text; source_id uuid; observation_id uuid; declaration_id uuid; section_id uuid;
  source_revision integer; expiry timestamptz; image_ids uuid[] := '{}'; observation_ids uuid[] := '{}'; declaration_ids uuid[] := '{}';
  deps uuid[]; previous_declaration uuid; uncertainty jsonb; predicate jsonb; sections jsonb; entries jsonb;
  r jsonb:=p_scan.result; next_capture_revision integer; request_hash text; offset_value integer; line_order integer;
  selected_decl jsonb; selected_sources jsonb; source_image uuid; known_asset boolean; assoc boolean;
begin
 select * into cfg from private.part_one_private_config where id=true;
 select * into policy from private.part_one_policies where id='private_capture';
 if not cfg.enabled or not cfg.process_allowed or not cfg.ocr_allowed or not cfg.upload_allowed or not cfg.private_display_allowed or cfg.expires_at<=now() or cfg.policy_version<>policy.version or not policy.retain_allowed or not policy.display_allowed
   or policy.permission_evidence is null or (policy.expires_at is not null and policy.expires_at<=now())
   or not exists(select 1 from storage.buckets where id=cfg.bucket_id and not public) then
   raise exception 'PART_ONE_PRIVATE_RETENTION_DISABLED';
 end if;
 if p_capture.owner_id is distinct from p_owner or p_capture.scan_id<>p_scan.id or p_capture.removed_at is not null
   or p_capture.expires_at<=now() or p_capture.generation<>p_scan.generation or p_capture.deletion_epoch<>p_scan.deletion_epoch
   or p_capture.package_observation_id::text is distinct from p_payload->>'packageObservationId'
   or p_capture.deletion_epoch is distinct from (p_payload->>'expectedDeletionEpoch')::integer
   or p_capture.item_id is distinct from nullif(r->>'itemId','')::uuid then
   return jsonb_build_object('conflict',true,'code','stale_capture','result',r);
 end if;
 if length(p_payload->>'idempotencyKey') not between 1 and 200 or p_payload->>'idempotencyKey' is null
   or jsonb_typeof(p_payload->'assets')<>'array' or jsonb_typeof(p_payload->'observations')<>'array' or jsonb_typeof(p_payload->'edits')<>'array'
   or jsonb_array_length(p_payload->'assets')>6 then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
 -- Validate uniqueness independently of HTTP DTO validation: duplicate aliases
 -- must never produce a committed receipt rejected by the strict response DTO.
 if exists(select 1 from jsonb_array_elements(p_payload->'assets') a group by (a->>'evidenceId')::uuid having count(*)>1)
   or exists(select 1 from jsonb_array_elements(p_payload->'assets') a group by (a->>'storageObjectId')::uuid having count(*)>1) then
   raise exception 'PART_ONE_INVALID_PAYLOAD';
 end if;
 request_hash:=encode(extensions.digest(p_payload::text,'sha256'),'hex');
 select * into receipt from private.part_one_capture_commits where owner_id=p_owner and idempotency_key=p_payload->>'idempotencyKey';
 if found then
   if receipt.deleted_at is not null then raise exception 'PART_ONE_DELETED'; end if;
   if receipt.request_hash<>request_hash or receipt.capture_id<>p_capture.id then raise exception 'PART_ONE_IDEMPOTENCY_CONFLICT'; end if;
   return jsonb_build_object('schemaVersion',1,'capture',jsonb_build_object('schemaVersion',1,'captureSessionId',p_capture.id,
     'packageObservationId',p_capture.package_observation_id,'scanId',p_scan.id,'generation',p_capture.generation,
     'captureRevision',p_capture.capture_revision,'deletionEpoch',p_capture.deletion_epoch,'itemId',p_capture.item_id,'candidateId',null),
     'observationIds',to_jsonb(receipt.observation_ids),'declarationIds',to_jsonb(receipt.declaration_ids),'assetIds',to_jsonb(receipt.asset_ids),'result',r);
 end if;
 if (p_payload->>'expectedGeneration')::integer is distinct from p_scan.generation
   or (p_payload->>'expectedResultRevision')::integer is distinct from p_scan.result_revision
   or (p_payload->>'expectedCaptureRevision')::integer is distinct from p_capture.capture_revision then
   return jsonb_build_object('conflict',true,'code','stale_capture','result',r);
 end if;
 expiry:=least(now()+make_interval(secs=>cfg.retention_seconds),cfg.expires_at,coalesce(policy.expires_at,'infinity'::timestamptz));
 for value in select x from jsonb_array_elements(p_payload->'assets') x loop
   if jsonb_typeof(value)<>'object' or value->>'metadataStripped' is distinct from 'true'
     or exists(select 1 from jsonb_object_keys(value) k where k<>all(array['evidenceId','storageObjectId','contentHash','width','height','metadataStripped'])) then
     raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
   select aa.* into att from private.part_one_asset_attestations aa join storage.objects o on o.id=aa.storage_object_id
     join storage.buckets b on b.id=o.bucket_id where aa.storage_object_id=(value->>'storageObjectId')::uuid
       and aa.owner_id=p_owner and aa.capture_id=p_capture.id and aa.package_observation_id=p_capture.package_observation_id
       and aa.generation=p_capture.generation and aa.deletion_epoch=p_capture.deletion_epoch and aa.metadata_stripped
       and aa.content_hash=value->>'contentHash' and aa.width=(value->>'width')::integer and aa.height=(value->>'height')::integer
       and aa.expires_at>now() and o.owner_id=p_owner::text and o.bucket_id=cfg.bucket_id and not b.public
       and o.version=aa.object_version and coalesce(o.is_delete_marker,false)=false and o.archived_at is null
       and not exists(select 1 from private.part_one_asset_status where attestation_id=aa.id and revoked_at is not null)
       for update of o;
   if not found then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
   expiry:=least(expiry,att.expires_at);
   select rr.* into asset_record from private.part_one_private_assets pa join private.part_one_records rr on rr.id=pa.record_id
     where pa.capture_id=p_capture.id and pa.client_evidence_id=(value->>'evidenceId')::uuid;
   if found then
     if not exists(select 1 from private.part_one_private_assets where record_id=asset_record.id and attestation_id=att.id)
       then raise exception 'PART_ONE_IDEMPOTENCY_CONFLICT'; end if;
   else
     if (select count(*) from private.part_one_private_assets where capture_id=p_capture.id)>=6 then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
     insert into private.part_one_records(kind,item_id,revision,canonical_key,policy_id,policy_version,owner_id,scope,payload,observed_at,expires_at)
       values('observation',p_capture.item_id,1,private.part_one_code_key(p_scan.request->'code'),'private_capture',policy.version,p_owner,'private_package',
         jsonb_build_object('privateKind','sanitized_image','captureSessionId',p_capture.id,'packageObservationId',p_capture.package_observation_id,
           'generation',p_capture.generation,'deletionEpoch',p_capture.deletion_epoch,'policyId',cfg.source_policy_id,
           'asset',value,'attestationId',att.id,'sanitizerVersion',att.sanitizer_version),now(),expiry) returning * into asset_record;
     insert into private.part_one_record_status(record_id) values(asset_record.id);
     insert into private.part_one_private_assets(record_id,attestation_id,owner_id,capture_id,client_evidence_id)
       values(asset_record.id,att.id,p_owner,p_capture.id,(value->>'evidenceId')::uuid);
   end if;
   image_ids:=array_append(image_ids,asset_record.id);
 end loop;
 for observation in select entry from (select value as entry,0 as group_order,ordinality from jsonb_array_elements(p_payload->'observations') with ordinality
   union all select value,1,ordinality from jsonb_array_elements(p_payload->'edits') with ordinality) rows order by group_order,ordinality loop
   known_asset:=false; source_image:=null; uncertainty:='["full_panel_not_established","variant_market_unverified"]';
   if observation ? 'evidenceId' then
     observation_id:=(observation->>'evidenceId')::uuid; source_revision:=1;
     if observation->>'captureSessionId' is distinct from p_capture.id::text or (observation->>'generation')::integer is distinct from p_capture.generation
       or jsonb_typeof(observation->'lines')<>'array' or jsonb_typeof(observation->'languageConfig')<>'array'
       or jsonb_array_length(observation->'orientationTransform')<>9
       or observation->>'recognizer' is null or observation->>'recognizerVersion' is null
       or observation->>'status' not in ('recognized','no_text','unsupported_script','model_unavailable','cancelled','failed')
       or exists(select 1 from jsonb_object_keys(observation) k where k<>all(array['evidenceId','captureSessionId','generation','recognizer','recognizerVersion','languageConfig','correctionEnabled','sourceWidth','sourceHeight','orientationTransform','lines','status'])) then
       raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
     if observation->>'status'='recognized' and ((observation->>'sourceWidth')::integer not between 1 and 4096 or (observation->>'sourceHeight')::integer not between 1 and 4096)
       then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
     deps:=image_ids;
     if cardinality(deps)=0 then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
     for line in select value from jsonb_array_elements(observation->'lines') loop
       if jsonb_typeof(line->'text')<>'string' or jsonb_typeof(line->'alternatives')<>'array' or jsonb_array_length(line->'region')<>4
         or exists(select 1 from jsonb_object_keys(line) k where k<>all(array['text','alternatives','region','confidence'])) then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
       if jsonb_array_length(line->'alternatives')>0 then uncertainty:=uncertainty || '["recognition_alternatives_unresolved"]'; end if;
     end loop;
     select string_agg(value->>'text',E'\n' order by ordinality) into raw_text from jsonb_array_elements(observation->'lines') with ordinality;
     raw_text:=coalesce(raw_text,'');
     if cardinality(image_ids)=1 then source_image:=image_ids[1]; else uncertainty:=uncertainty || '["image_region_mapping_unresolved"]'; end if;
   else
     if exists(select 1 from jsonb_object_keys(observation) k where k<>all(array['observationId','supersedesId','revision','text','reason']))
       or jsonb_typeof(observation->'text')<>'string' or length(observation->>'reason')=0 then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
     observation_id:=(observation->>'observationId')::uuid;
     select * into prior from private.part_one_records where id=(observation->>'supersedesId')::uuid and kind='observation'
       and owner_id=p_owner and scope='private_package' and payload->>'captureSessionId'=p_capture.id::text and payload->>'privateKind' in ('ocr','edit');
     if not found or not private.part_one_record_allowed(prior.id,p_owner) then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
     source_revision:=(observation->>'revision')::integer;
     if source_revision<>prior.revision+1 or exists(select 1 from private.part_one_records where owner_id=p_owner and supersedes_id=prior.id and kind='observation')
       then raise exception 'PART_ONE_IDEMPOTENCY_CONFLICT'; end if;
     deps:=array_append(prior.dependencies,prior.id);raw_text:=observation->>'text';
     uncertainty:=uncertainty || '["user_edit_does_not_establish_missing_coverage"]';
   end if;
   if exists(select 1 from private.part_one_records where id=observation_id) then raise exception 'PART_ONE_IDEMPOTENCY_CONFLICT'; end if;
   for source_id in select unnest(deps) loop
     if not private.part_one_record_allowed(source_id,p_owner) then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
     expiry:=least(expiry,private.part_one_record_expiry(source_id));
   end loop;
   insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,owner_id,scope,payload,dependencies,supersedes_id,observed_at,expires_at)
     values(observation_id,'observation',p_capture.item_id,source_revision,private.part_one_code_key(p_scan.request->'code'),'private_capture',policy.version,p_owner,'private_package',
       jsonb_build_object('privateKind',case when observation ? 'evidenceId' then 'ocr' else 'edit' end,'captureSessionId',p_capture.id,
         'packageObservationId',p_capture.package_observation_id,'generation',p_capture.generation,'deletionEpoch',p_capture.deletion_epoch,
         'policyId',cfg.source_policy_id,'rawText',raw_text,'observation',observation,'uncertaintyReasons',uncertainty),deps,
       case when observation ? 'evidenceId' then null else (observation->>'supersedesId')::uuid end,now(),expiry);
   insert into private.part_one_record_status(record_id) values(observation_id);observation_ids:=array_append(observation_ids,observation_id);
   if raw_text='' or (observation ? 'status' and observation->>'status'<>'recognized') then continue; end if;
   section_id:=gen_random_uuid();declaration_id:=gen_random_uuid();offset_value:=0;line_order:=0;entries:='[]';
   -- No chemical token split occurs here. Complete verbatim lines have exact
   -- offsets and unresolved mapping; the grammar-aware parser may derive a new
   -- revision later. Coverage/category/variant proof is absent from this DTO.
   for line in select to_jsonb(x) from unnest(string_to_array(raw_text,E'\n')) x loop
     entries:=entries || jsonb_build_array(jsonb_build_object('entryId',gen_random_uuid(),'sectionId',section_id,'order',line_order,
       'rawToken',line#>>'{}','sourceSpans',jsonb_build_array(jsonb_build_object('observationId',observation_id,'imageId',source_image,
       'sourceRevision',source_revision,'start',offset_value,'end',offset_value+length(line#>>'{}'),'region',null,'transformation','[]'::jsonb)),
       'canonicalIngredientId',null,'aliasVersion','unmapped-1','mapping','unresolved','quantity',null,'conditional',null,
       'uncertaintyReasons',jsonb_build_array('line_not_chemically_tokenized')));
     offset_value:=offset_value+length(line#>>'{}')+1;line_order:=line_order+1;
   end loop;
   sections:=jsonb_build_array(jsonb_build_object('sectionId',section_id,'kind','ingredients','rawText',raw_text,'startCovered',false,'endCovered',false,'lineCoverageComplete',false,'entries',entries));
   assoc:=p_capture.item_id is not null and r->>'snapshotId' is not null;
   predicate:=jsonb_build_object('association',jsonb_build_object('passed',assoc,'evidenceIds',jsonb_build_array(observation_id),'reasons',case when assoc then '[]'::jsonb else '["no_association"]'::jsonb end),
     'noContradiction',jsonb_build_object('passed',jsonb_array_length(r->'conflictIds')=0,'evidenceIds',r->'conflictIds','reasons',case when jsonb_array_length(r->'conflictIds')=0 then '[]'::jsonb else '["identity_conflict"]'::jsonb end),
     'variantMarket',jsonb_build_object('passed',false,'evidenceIds','[]'::jsonb,'reasons','["private_variant_market_unverified"]'::jsonb),
     'completeness',jsonb_build_object('passed',false,'evidenceIds',jsonb_build_array(observation_id),'reasons',uncertainty),
     'rightsFreshness',jsonb_build_object('passed',true,'evidenceIds',to_jsonb(deps),'reasons','[]'::jsonb));
   select id into previous_declaration from private.part_one_records where owner_id=p_owner and kind='declaration'
     and payload->>'captureSessionId'=p_capture.id::text and payload->'observationIds' ? coalesce(observation->>'supersedesId','') order by revision desc limit 1;
   selected_decl:=jsonb_build_object('declarationId',declaration_id,'revision',source_revision,'itemId',p_capture.item_id,'snapshotId',r->'snapshotId',
     'observationIds',jsonb_build_array(observation_id),'dependencyIds',to_jsonb(array_append(deps,observation_id)),
     'rawText',raw_text,'textStructureHash',encode(extensions.digest(jsonb_build_object('rawText',raw_text,'sections',sections)::text,'sha256'),'hex'),
     'sections',sections,'category','unknown','completenessReasons',uncertainty,'transcriptionUncertainty',uncertainty,
     'parserVersion','private-verbatim-lines-1','aliasVersion','unmapped-1','sourceRevision',source_revision,'sourceUpdatedAt',null,
     'observedAt',now(),'expiresAt',expiry,'policyId',cfg.source_policy_id,'scope','private_package','ownerId',p_owner,
     'packageObservationId',p_capture.package_observation_id,'associationEvidenceIds',case when assoc then jsonb_build_array(observation_id) else '[]'::jsonb end,
     'variant','{"brand":null,"line":null,"form":null,"scent":null,"shade":null,"spf":null,"strength":null,"size":null,"unit":null,"packCount":null,"packagingLevel":null}'::jsonb,
     'sourceMarkets','[]'::jsonb,'packageMarket',null,'conflictIds',r->'conflictIds','supersedesId',previous_declaration,'formulaEquivalence','unknown',
     'privateKind','declaration','captureSessionId',p_capture.id,'generation',p_capture.generation,'deletionEpoch',p_capture.deletion_epoch,
     'predicate',predicate,'state',case when jsonb_array_length(r->'conflictIds')>0 then 'conflict' else 'partial' end,'structuredSections',sections);
   selected_decl:=selected_decl || jsonb_build_object('sections',jsonb_build_array(jsonb_build_object('sectionId',section_id,'kind','ingredients','text',raw_text,
     'evidenceIds',jsonb_build_array(observation_id),'policyId',cfg.source_policy_id,'observedAt',now(),'expiresAt',expiry)));
   selected_sources:=jsonb_build_array(jsonb_build_object('observationId',observation_id,'policyId',cfg.source_policy_id,'label',
     case when observation ? 'evidenceId' then 'Private on-device OCR; incomplete panel' else 'Private user correction; incomplete panel' end,
     'url',null,'observedAt',now(),'sourceUpdatedAt',null,'expiresAt',expiry));
   selected_decl:=selected_decl || jsonb_build_object('sources',selected_sources);
   insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,owner_id,scope,payload,dependencies,supersedes_id,observed_at,expires_at)
     values(declaration_id,'declaration',p_capture.item_id,source_revision,private.part_one_code_key(p_scan.request->'code'),'private_capture',policy.version,
       p_owner,'private_package',selected_decl,array_append(deps,observation_id),previous_declaration,now(),expiry);
   insert into private.part_one_record_status(record_id) values(declaration_id);declaration_ids:=array_append(declaration_ids,declaration_id);
 end loop;
 next_capture_revision:=p_capture.capture_revision+1;
 if selected_decl is not null then
   r:=r || jsonb_build_object('declarationId',selected_decl->'declarationId','declarationState',selected_decl->'state','scope','private_package',
     'evidenceIds',selected_decl->'dependencyIds','reasonCodes',selected_decl->'completenessReasons','allowedActions',
       case when r->>'snapshotId' is null then jsonb_build_array('add_photo','rescan','remove_draft') else jsonb_build_array('save_partial','add_photo','rescan','remove_draft') end,
     'freshness',jsonb_build_object('observedAt',now(),'expiresAt',expiry,'state','fresh'));
   r:=jsonb_set(r,'{display,sections}',selected_decl->'sections');r:=jsonb_set(r,'{display,sources}',selected_sources);
   r:=jsonb_set(r,'{display,limitations}','["Private package evidence; full panel, variant and market unverified"]');
 end if;
 r:=r || jsonb_build_object('resultRevision',p_scan.result_revision+1);
 r:=jsonb_set(r,'{display,resultRevision}',r->'resultRevision');r:=private.part_one_filter_result(r,p_owner);
 update private.part_one_captures set capture_revision=next_capture_revision where id=p_capture.id;
 update private.part_one_scans set result=r,result_revision=p_scan.result_revision+1,binding_revision=binding_revision+1 where id=p_scan.id;
 insert into private.part_one_capture_commits(owner_id,capture_id,idempotency_key,request_hash,package_observation_id,generation,deletion_epoch,capture_revision,observation_ids,declaration_ids,asset_ids)
   values(p_owner,p_capture.id,p_payload->>'idempotencyKey',request_hash,p_capture.package_observation_id,p_capture.generation,p_capture.deletion_epoch,next_capture_revision,observation_ids,declaration_ids,image_ids);
 return jsonb_build_object('schemaVersion',1,'capture',jsonb_build_object('schemaVersion',1,'captureSessionId',p_capture.id,
   'packageObservationId',p_capture.package_observation_id,'scanId',p_scan.id,'generation',p_capture.generation,'captureRevision',next_capture_revision,
   'deletionEpoch',p_capture.deletion_epoch,'itemId',p_capture.item_id,'candidateId',null),
   'observationIds',to_jsonb(observation_ids),'declarationIds',to_jsonb(declaration_ids),'assetIds',to_jsonb(image_ids),'result',r);
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
           'variantText',snap.payload->'variantText','image',snap.payload->'image','expiresAt',private.part_one_identity_expiry(snap.id)),'candidates','[]'::jsonb,'sections','[]'::jsonb,
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
         'brand',rr.payload->'brand','variantText',rr.payload->'variantText','image',rr.payload->'image','expiresAt',private.part_one_identity_expiry(rr.id)))
         from private.part_one_records rr where rr.id::text in (select x->>'snapshotId' from jsonb_array_elements(catalog) x)));
     end if;
     if r->>'declarationState'<>'accepted' then
       key := key || '|' || coalesce(p_payload->'request'->>'requestedMarket','?') || '|identity-declaration|part-one-1';
       select * into j from private.part_one_jobs where coalescing_key=key and state in ('queued','running','deferred_budget','retry_wait') for update;
       if not found then
         select exists(select 1 from private.part_one_worker_health where heartbeat_at>now()-interval '30 seconds') into worker_live;
         insert into private.part_one_jobs(coalescing_key,input,policy_version,state)
           values(key,p_payload->'request'->'code' || jsonb_build_object('canonicalKey',private.part_one_code_key(p_payload->'request'->'code'),'normalizationVersion','part-one-gtin-2',
             'requestedMarket',p_payload->'request'->'requestedMarket'),'part-one-1',case when worker_live then 'queued' else 'deferred_budget' end) returning * into j;
       end if;
       r := r || jsonb_build_object('jobId',j.id,'work',j.state,'nextCheckAfter',j.next_eligible_at);
     end if;
   end if;
   r := jsonb_set(r,'{display,resultRevision}',r->'resultRevision');
   insert into private.part_one_scans(id,owner_id,idempotency_key,request,generation,result,job_id)
     values(id,u,p_payload->>'idempotencyKey',p_payload->'request',(p_payload->'request'->>'generation')::integer,r,j.id) returning * into s;
   perform private.part_one_bind_candidates(s.id,s.generation,u,r->'candidateIds',private.part_one_code_key(s.request->'code'),s.request->'requestedMarket');
   r := private.part_one_filter_result(r,u);
   update private.part_one_scans set result=r where id=s.id;
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
 if p_action in ('captures/read','captures/delete') then
   select * into c from private.part_one_captures where id=(p_payload->>'id')::uuid and owner_id=u for update;
   if not found then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
   if p_action='captures/delete' then
     perform private.part_one_purge_capture(c.id,'explicit_private_proof_removal');
     return jsonb_build_object('deleted',true,'id',c.id);
   end if;
   if c.removed_at is not null or c.expires_at<=now() then raise exception 'PART_ONE_DELETED'; end if;
   return jsonb_build_object('schemaVersion',1,'captureSessionId',c.id,'packageObservationId',c.package_observation_id,
     'scanId',c.scan_id,'generation',c.generation,'captureRevision',c.capture_revision,'deletionEpoch',c.deletion_epoch,'itemId',c.item_id,'candidateId',null);
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
 if p_action='captures/observations' then return private.part_one_commit_capture(p_payload,u,s,c); end if;
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
   select rr.* into snap from private.part_one_records rr join private.part_one_candidate_bindings cb on cb.snapshot_id=rr.id
     where cb.scan_id=s.id and cb.generation=s.generation and cb.owner_id=u and cb.item_id=(p_payload->>'candidateId')::uuid
       and rr.kind='snapshot' and rr.scope='public' and rr.canonical_key=private.part_one_code_key(s.request->'code')
       and rr.payload->'requestedMarket' is not distinct from s.request->'requestedMarket'
       and private.part_one_snapshot_identity_allowed(rr.id,u);
   if not found then return jsonb_build_object('conflict',true,'code','expired_evidence','result',r); end if;
   s.generation := s.generation+1; s.result_revision := s.result_revision+1;
   r := r || jsonb_build_object('generation',s.generation,'resultRevision',s.result_revision,'identity','exact',
     'itemId',snap.item_id,'snapshotId',snap.id,'declarationId',null,'declarationState','none','scope','public',
     'packageConfirmation','user_bound','reasonCodes',jsonb_build_array('no_declaration'),'candidateIds','[]'::jsonb,
     'allowedActions',jsonb_build_array('save_partial','rescan'));
   r := jsonb_set(r,'{display}',jsonb_build_object('selectedIdentity',jsonb_build_object('id',snap.item_id,'name',snap.payload->'name',
     'brand',snap.payload->'brand','variantText',snap.payload->'variantText','image',snap.payload->'image','expiresAt',private.part_one_identity_expiry(snap.id)),
     'candidates','[]'::jsonb,'sections','[]'::jsonb,'sources','[]'::jsonb,'limitations',jsonb_build_array('Ingredients not verified yet')));
   r := jsonb_set(r,'{display,resultRevision}',r->'resultRevision');
   -- Immutable payload may contain an asset whose independent rights changed
   -- after candidate display. Refilter the newly selected projection atomically.
   r := private.part_one_filter_result(r,u);
   update private.part_one_scans set generation=s.generation,result_revision=s.result_revision,binding_revision=binding_revision+1,result=r,deletion_epoch=deletion_epoch+1 where id=s.id;
   update private.part_one_subscriptions set ended_at=now() where scan_id=s.id and ended_at is null;
   -- Uncommitted derivatives have no historical package to preserve; purge
   -- their attestations/cleanup locators before ending the generation. A saved
   -- committed package stays readable until explicit proof removal/expiry.
   for c in select cc.* from private.part_one_captures cc where cc.scan_id=s.id and cc.removed_at is null
     and not exists(select 1 from private.part_one_capture_commits cm where cm.capture_id=cc.id and cm.deleted_at is null)
   loop perform private.part_one_purge_capture(c.id,'capture_selection_cancelled'); end loop;
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
   select * into c from private.part_one_captures where id=(p_payload->>'captureSessionId')::uuid and owner_id=u and scan_id=s.id;
   if not found then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
   perform private.part_one_purge_capture(c.id,'explicit_private_proof_removal');
   return jsonb_build_object('removed',true);
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

-- Service-side catalog reread after dequeue. It uses the same immutable
-- association and rights gates as foreground scans; no owner profile is returned.
create function private.part_one_lookup_catalog(p_job private.part_one_jobs) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare snap private.part_one_records; dec private.part_one_records; r jsonb; candidates jsonb; count_items integer;
begin
 select count(distinct item_id)::integer into count_items from private.part_one_records
   where kind='snapshot' and scope='public' and canonical_key=p_job.input->>'canonicalKey'
     and payload->'requestedMarket' is not distinct from p_job.input->'requestedMarket'
     and private.part_one_snapshot_identity_allowed(id,null);
 if count_items=0 then return null; end if;
 r := private.part_one_empty_result(jsonb_build_object('schemaVersion',1,'requestId',p_job.id,'generation',0),p_job.id);
 if count_items>1 then
   select jsonb_agg(jsonb_build_object('id',rr.item_id,'name',rr.payload->'name','brand',rr.payload->'brand',
     'variantText',rr.payload->'variantText','image',null,'expiresAt',private.part_one_identity_expiry(rr.id))) into candidates
     from (select distinct on(item_id) * from private.part_one_records
       where kind='snapshot' and scope='public' and canonical_key=p_job.input->>'canonicalKey'
         and payload->'requestedMarket' is not distinct from p_job.input->'requestedMarket'
         and private.part_one_snapshot_identity_allowed(id,null) order by item_id,revision desc,created_at desc) rr;
   r := r || jsonb_build_object('identity','ambiguous','candidateIds',(select jsonb_agg(x->'id') from jsonb_array_elements(candidates) x),
     'reasonCodes',jsonb_build_array('identity_conflict'),'allowedActions',jsonb_build_array('choose_candidate','rescan'));
   r := jsonb_set(r,'{display,candidates}',candidates);
   return jsonb_build_object('resultPatch',r-array['schemaVersion','requestId','scanId','generation','resultRevision','work','jobId','subscriptionId','nextCheckAfter'],'item',null);
 end if;
 select * into snap from private.part_one_records
   where kind='snapshot' and scope='public' and canonical_key=p_job.input->>'canonicalKey'
     and payload->'requestedMarket' is not distinct from p_job.input->'requestedMarket'
     and private.part_one_snapshot_identity_allowed(id,null) order by revision desc,created_at desc limit 1;
 r := r || jsonb_build_object('identity','exact','itemId',snap.item_id,'snapshotId',snap.id,'scope','public',
   'reasonCodes',jsonb_build_array('no_declaration'),'allowedActions',jsonb_build_array('save_partial','scan_ingredients','rescan'),
   'freshness',jsonb_build_object('observedAt',snap.observed_at,'expiresAt',private.part_one_identity_expiry(snap.id),'state','fresh'));
 r := jsonb_set(r,'{display,selectedIdentity}',jsonb_build_object('id',snap.item_id,'name',snap.payload->'name',
   'brand',snap.payload->'brand','variantText',snap.payload->'variantText','image',snap.payload->'image','expiresAt',private.part_one_identity_expiry(snap.id)));
 select * into dec from private.part_one_records d where d.kind='declaration' and d.item_id=snap.item_id and d.scope='public'
   and d.id::text in (select jsonb_array_elements_text(coalesce(snap.payload->'declarationIds','[]')))
   and private.part_one_record_allowed(d.id,null) and private.part_one_record_allowed(snap.id,null)
   and ((d.payload->>'state' in ('partial','uncertain') and d.payload->'predicate' @> '{"association":{"passed":true},"noContradiction":{"passed":true}}'::jsonb)
     or (d.payload->>'state'='accepted' and d.payload->'predicate' @> '{"association":{"passed":true},"noContradiction":{"passed":true},"variantMarket":{"passed":true},"completeness":{"passed":true},"rightsFreshness":{"passed":true}}'::jsonb))
   order by (d.payload->>'state'='accepted') desc,d.revision desc limit 1;
 if found then
   r := r || jsonb_build_object('declarationId',dec.id,'declarationState',dec.payload->>'state','evidenceIds',to_jsonb(dec.dependencies),
     'reasonCodes',case when dec.payload->>'state'='accepted' then '[]'::jsonb else jsonb_build_array('missing_section') end,
     'allowedActions',case when dec.payload->>'state'='accepted' then jsonb_build_array('save','scan_ingredients','view_source','rescan') else jsonb_build_array('save_partial','scan_ingredients','view_source','rescan') end);
   r := jsonb_set(r,'{display,sections}',coalesce(dec.payload->'sections','[]'));
   r := jsonb_set(r,'{display,sources}',coalesce(dec.payload->'sources','[]'));
 end if;
 r := private.part_one_filter_result(r,null);
 return jsonb_build_object('resultPatch',r-array['schemaVersion','requestId','scanId','generation','resultRevision','work','jobId','subscriptionId','nextCheckAfter'],
   'item',case when snap.payload ? 'snapshotId' and snap.payload ? 'variant' then snap.payload else null end);
end $$;

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
   perform private.part_one_purge_expired_private();
   insert into private.part_one_worker_health(id,heartbeat_at,consumer_version) values(true,now(),p_payload->>'consumerVersion')
     on conflict(id) do update set heartbeat_at=excluded.heartbeat_at,consumer_version=excluded.consumer_version;
   return jsonb_build_object('alive',true);
 end if;
 if p_action='purge_private' then
   perform private.part_one_purge_expired_private();
   return jsonb_build_object('purged',true);
 end if;
 if p_action='revoke_policy' then
   update private.part_one_policies set lookup_allowed=false,retain_allowed=false,display_allowed=false,export_allowed=false
     where id=p_payload->>'policyId';
   if not found then raise exception 'PART_ONE_SOURCE_POLICY_DISABLED'; end if;
   for s in select * from private.part_one_scans for update loop
     perform private.part_one_refresh_scan(s.id,s.owner_id);
   end loop;
   perform private.part_one_purge_expired_private();
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
   perform private.part_one_purge_expired_private();
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
   select * into rec from private.part_one_records where id=nullif(p_payload->>'id','')::uuid;
   if found then
     if rec.kind is distinct from p_payload->>'kind' or rec.item_id is distinct from nullif(p_payload->>'itemId','')::uuid
       or rec.revision is distinct from (p_payload->>'revision')::integer or rec.canonical_key is distinct from p_payload->>'canonicalKey'
       or rec.policy_id<>policy.id or rec.policy_version<>policy.version or rec.scope<>'public'
       or rec.payload is distinct from p_payload->'payload'
       or rec.dependencies is distinct from array(select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'dependencies','[]')))
       or rec.supersedes_id is distinct from nullif(p_payload->>'supersedesId','')::uuid
       or rec.observed_at is distinct from (p_payload->>'observedAt')::timestamptz
       or rec.expires_at is distinct from least((p_payload->>'expiresAt')::timestamptz,coalesce(policy.expires_at,'infinity'::timestamptz)) then
       raise exception 'PART_ONE_ADMISSION_REPLAY_CONFLICT';
     end if;
     return jsonb_build_object('recordId',rec.id,'replay',true);
   end if;
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
 if p_action='catalog' then return private.part_one_lookup_catalog(j); end if;
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
     update private.part_one_jobs set state='deferred_budget',next_eligible_at=retry_at,attempts=greatest(0,attempts-1),lease_token=null,
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
     update private.part_one_reservations set state='settled',outcome=status,retry_after=nullif(coalesce(p_payload->'output'->>'retryAfter',p_payload->'output'->'reply'->>'retryAfter'),'')::timestamptz
       where id=(p_payload->>'reservationId')::uuid and job_id=j.id;
     if not found then raise exception 'PART_ONE_RESERVATION_NOT_FOUND'; end if;
     if status='rate_limited' then
       update private.part_one_budgets set reset_at=greatest(coalesce(reset_at,now()),
         coalesce(nullif(coalesce(p_payload->'output'->>'retryAfter',p_payload->'output'->'reply'->>'retryAfter'),'')::timestamptz,now()+interval '60 seconds'))
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
   for target in
     select value from jsonb_array_elements(coalesce(p_payload->'targets','[]'))
     union all
     select jsonb_build_object('scanId',ss.id,'generation',ss.generation,'bindingRevision',ss.binding_revision)
       from private.part_one_scans ss where ss.job_id=j.id and ss.binding_revision=1
         and ss.generation=(ss.request->>'generation')::integer
         and not exists(select 1 from jsonb_array_elements(coalesce(p_payload->'targets','[]')) t where t->>'scanId'=ss.id::text)
   loop
     -- Lock the deletion marker before the scan, matching deletion's profile-
     -- then-cascade order. A plain EXISTS snapshot can race a committed fence.
     select * into s from private.part_one_scans where id=(target->>'scanId')::uuid and job_id=j.id;
     if not found then continue; end if;
     perform 1 from public.profiles where id=s.owner_id and deletion_started_at is null for update;
     if not found then continue; end if;
     select * into s from private.part_one_scans where id=(target->>'scanId')::uuid and job_id=j.id for update;
     if found and s.generation=(target->>'generation')::integer and s.binding_revision=(target->>'bindingRevision')::integer
       and s.generation=(s.request->>'generation')::integer
       and exists(select 1 from public.profiles where id=s.owner_id and deletion_started_at is null)
       and s.result->>'scope' is distinct from 'private_package' then
       if r ? 'candidateIds' then
         perform private.part_one_bind_candidates(s.id,s.generation,s.owner_id,r->'candidateIds',j.input->>'canonicalKey',s.request->'requestedMarket');
       end if;
       s.result_revision := s.result_revision+1;
       update private.part_one_scans set result_revision=s.result_revision,binding_revision=binding_revision+1,
         result=private.part_one_filter_result(s.result || r || jsonb_build_object('identity',
           case when s.result->>'identity'='pending' and not r ? 'identity' then 'unresolved' else coalesce(r->>'identity',s.result->>'identity') end,
           'resultRevision',s.result_revision,
           'work',case when p_payload->>'terminalWork'='failed_final' then 'failed_final' when p_action='retry' and j.attempts<j.max_attempts then 'retry_wait'
             when p_action='retry' then 'failed_final' else 'complete' end),s.owner_id) where id=s.id;
     end if;
   end loop;
   update private.part_one_jobs set state=case when p_payload->>'terminalWork'='failed_final' then 'failed_final' when p_action='retry' and attempts<max_attempts then 'retry_wait'
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
revoke all on function private.part_one_private_record_allowed(uuid,uuid),private.part_one_purge_capture(uuid,text),
  private.part_one_purge_expired_private(),private.part_one_before_owner_delete(),
  private.part_one_commit_capture(jsonb,uuid,private.part_one_scans,private.part_one_captures),private.part_one_immutable(),private.part_one_owner(),private.part_one_record_allowed(uuid,uuid),
  private.part_one_snapshot_identity_allowed(uuid,uuid),private.part_one_identity_expiry(uuid),
  private.part_one_record_expiry(uuid),private.part_one_display_expiry(jsonb,text),private.part_one_display_allowed(jsonb,uuid,text),private.part_one_bind_candidates(uuid,integer,uuid,jsonb,text,jsonb),
  private.part_one_empty_result(jsonb,uuid),private.part_one_filter_result(jsonb,uuid),private.part_one_code_key(jsonb),
  private.part_one_lookup_catalog(private.part_one_jobs),private.part_one_refresh_scan(uuid,uuid),private.part_one_catalog_identity(text,jsonb) from public,anon,authenticated;
