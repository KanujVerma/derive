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
  identity_dependencies uuid[] not null default '{}',
  supersedes_id uuid references private.part_one_records(id),
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > observed_at),
  check ((scope = 'public' and owner_id is null) or (scope = 'private_package' and owner_id is not null))
);
create unique index part_one_snapshot_revision on private.part_one_records(item_id, revision)
  where kind = 'snapshot' and scope='public';
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
  original_snapshot_at_save_id uuid,
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
 approval_evidence text,reviewed_at timestamptz,expires_at timestamptz,
 check(not enabled or (process_allowed and ocr_allowed and upload_allowed and private_display_allowed and bucket_id is not null and retention_seconds is not null and deletion_deadline_seconds is not null
   and approval_evidence is not null and expires_at is not null))
);
insert into private.part_one_private_config(id) values(true);
-- Uploads reserve opaque non-reused names before Storage dispatch. Owner erasure
-- retains only a cancelled cleanup ticket, never bytes/text or an active binding.
create table private.part_one_upload_tickets (
 id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users(id) on delete set null,
 capture_id uuid references private.part_one_captures(id) on delete set null,scan_id uuid references private.part_one_scans(id) on delete set null,
 package_observation_id uuid,client_evidence_id uuid not null,idempotency_key text not null,
 generation integer not null,result_revision integer not null,capture_revision integer not null,deletion_epoch integer not null,
 content_hash text,byte_length integer not null check(byte_length between 1 and 2097152),width integer not null check(width between 1 and 4096),height integer not null check(height between 1 and 4096),
 policy_version text not null,bucket_id text not null references storage.buckets(id),object_name text not null unique,
 state text not null default 'reserved' check(state in ('reserved','dispatched','attested','cancelled','unknown','deleted')),
 object_id uuid,object_version text,attestation_id uuid,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '2 minutes',
 unique(owner_id,idempotency_key),unique(capture_id,client_evidence_id)
);
create table private.part_one_private_consumer (
 id boolean primary key default true check(id),consumer_version text not null,heartbeat_at timestamptz not null
);
create table private.part_one_private_reviews (
 review_id uuid primary key,owner_id uuid not null references auth.users(id) on delete cascade,
 capture_id uuid not null references private.part_one_captures(id) on delete cascade,
 source_commit_id uuid not null,request_hash text not null,authority_policy_id uuid not null,authority_policy_version text not null,
 payload jsonb not null,created_at timestamptz not null default now(),expires_at timestamptz not null,
 snapshot_id uuid not null,declaration_id uuid not null,review_record_id uuid not null,
 unique(owner_id,source_commit_id,review_id)
);
create table private.part_one_review_authorities (
 policy_id uuid primary key,version text not null,enabled boolean not null default false,
 mode text not null check(mode='synthetic_local_only'),permission_evidence text not null check(permission_evidence like 'Synthetic local fixture:%'),
 expires_at timestamptz not null,revoked_at timestamptz
);

create table private.part_one_asset_attestations (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 capture_id uuid not null references private.part_one_captures(id) on delete cascade,
 package_observation_id uuid not null,generation integer not null,deletion_epoch integer not null,
 storage_object_id uuid not null references storage.objects(id) on delete cascade,
 upload_ticket_id uuid references private.part_one_upload_tickets(id),
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
 source_commit_id uuid not null default gen_random_uuid() unique,bound_result jsonb,review_state jsonb,review_receipt_id uuid,
 review_context jsonb,evaluated_hash text,evaluated_review_id uuid,
 deleted_at timestamptz,created_at timestamptz not null default now(),primary key(owner_id,idempotency_key)
);
-- Storage objects must be removed through the Storage API, not SQL metadata
-- deletion. This durable outbox retains only the cleanup locator until ack.
create table private.part_one_private_cleanup (
 object_id uuid primary key,bucket_id text not null,object_name text not null,object_version text not null,
 due_at timestamptz not null,reason text not null,created_at timestamptz not null default now(),
 state text not null default 'queued' check(state in ('queued','running','deleted','blocked')),lease_token uuid,lease_expires_at timestamptz,
 attempts integer not null default 0,next_eligible_at timestamptz not null default now(),deleted_at timestamptz
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
  foreach t in array array['policies','records','record_status','jobs','worker_health','budgets','reservations','scans','candidate_bindings','subscriptions','saves','captures','private_config','asset_attestations','asset_status','private_assets','capture_commits','private_cleanup','upload_tickets','private_consumer','private_reviews','review_authorities'] loop
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
       and (o.owner_id=p_owner::text or (o.owner_id is null and a.upload_ticket_id is not null and exists(select 1 from private.part_one_upload_tickets ut
         where ut.id=a.upload_ticket_id and ut.owner_id=p_owner and ut.capture_id=c.id and ut.package_observation_id=c.package_observation_id
           and ut.state='attested' and ut.attestation_id=a.id and ut.object_id=o.id and ut.object_version=o.version and ut.content_hash=a.content_hash
           and ut.bucket_id=o.bucket_id and ut.object_name=o.name and ut.generation=a.generation and ut.deletion_epoch=a.deletion_epoch))) and o.bucket_id=cfg.bucket_id and not b.public and o.version=a.object_version
       and coalesce(o.is_delete_marker,false)=false and o.archived_at is null);
 end if;
 -- Review authority controls the validity of an assertion, not permission
 -- to retain an owner's original label or immutable correction history. All
 -- such history still follows private_capture retention/version/expiry/purge.
 if rec.payload->>'privateKind'='approved_review' then
  return exists(select 1 from private.part_one_review_authorities ra where ra.policy_id=(rec.payload->>'authorityPolicyId')::uuid
   and ra.version=rec.payload->>'authorityPolicyVersion' and ra.enabled and ra.revoked_at is null and ra.expires_at>now());
 end if;
 return rec.payload->>'privateKind' in ('ocr','edit','declaration','package_snapshot');
exception when invalid_text_representation then return false;
end $$;

create function private.part_one_purge_capture(p_capture uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare c private.part_one_captures; cfg private.part_one_private_config; ids uuid[]; s private.part_one_scans; r jsonb; sv private.part_one_saves; original private.part_one_records; pub private.part_one_records; pub_id uuid;
begin
 select * into c from private.part_one_captures where id=p_capture for update;
 if not found then return; end if;
 select * into cfg from private.part_one_private_config where id=true;
 insert into private.part_one_private_cleanup(object_id,bucket_id,object_name,object_version,due_at,reason)
   select distinct o.id,o.bucket_id,o.name,o.version,now()+make_interval(secs=>coalesce(cfg.deletion_deadline_seconds,1)),p_reason
   from private.part_one_asset_attestations aa join storage.objects o on o.id=aa.storage_object_id
   where aa.capture_id=c.id and aa.owner_id=c.owner_id and (o.owner_id=c.owner_id::text or (o.owner_id is null and exists(select 1 from private.part_one_upload_tickets ut
     where ut.id=aa.upload_ticket_id and ut.owner_id=c.owner_id and ut.capture_id=c.id and ut.object_id=o.id and ut.object_name=o.name and ut.bucket_id=o.bucket_id and ut.object_version=o.version)))
     and o.version=aa.object_version
   on conflict(object_id) do update set due_at=least(private.part_one_private_cleanup.due_at,excluded.due_at);
 update private.part_one_upload_tickets set state='cancelled' where capture_id=c.id and state<>'deleted';
 insert into private.part_one_private_cleanup(object_id,bucket_id,object_name,object_version,due_at,reason)
   select o.id,o.bucket_id,o.name,o.version,now()+make_interval(secs=>coalesce(cfg.deletion_deadline_seconds,1)),p_reason
   from private.part_one_upload_tickets ut join storage.objects o on o.bucket_id=ut.bucket_id and o.name=ut.object_name
   where ut.capture_id=c.id and (o.owner_id is null or o.owner_id=c.owner_id::text)
   on conflict(object_id) do update set due_at=least(private.part_one_private_cleanup.due_at,excluded.due_at);
 select coalesce(array_agg(id),'{}') into ids from private.part_one_records
   where owner_id=c.owner_id and scope='private_package' and payload->>'captureSessionId'=c.id::text;
 -- Erase copied transcripts as well as source rows. Snapshot-at-save identity
 -- remains; the removed private declaration cannot be inherited or replayed.
 -- A private snapshot at save has an internal FK. Keep its stable opaque ID
 -- as a tombstone, while retaining only the exact original public identity
 -- binding recorded by the private graph. No private name/variant/formula copy
 -- survives this removal. An unavailable public binding deletes the saved row.
 for sv in select * from private.part_one_saves where owner_id=c.owner_id and snapshot_at_save_id=any(ids) for update loop
  select * into original from private.part_one_records where id=sv.snapshot_at_save_id;
  pub_id:=nullif(original.payload->>'publicSnapshotId','')::uuid;
  select * into pub from private.part_one_records where id=pub_id and scope='public' and item_id=original.item_id;
  if not found or not private.part_one_snapshot_identity_allowed(pub.id,c.owner_id) then
   delete from private.part_one_saves where id=sv.id;
  else
   r:=sv.saved_result||jsonb_build_object('snapshotId',pub.id,'itemId',pub.item_id,'identity','exact','declarationId',null,'declarationState','conflict','scope','public',
    'packageConfirmation','unconfirmed','evidenceIds','[]'::jsonb,'conflictIds','[]'::jsonb,'reasonCodes',jsonb_build_array('private_proof_removed'),
    'allowedActions',jsonb_build_array('save_partial','rescan'),'display',jsonb_build_object('resultRevision',sv.saved_result->'resultRevision',
     'selectedIdentity',jsonb_build_object('id',pub.item_id,'name',pub.payload->'name','brand',pub.payload->'brand','variantText',pub.payload->'variantText','image',null,'expiresAt',private.part_one_identity_expiry(pub.id)),
     'candidates','[]'::jsonb,'sections','[]'::jsonb,'sources','[]'::jsonb,'limitations',jsonb_build_array('Private proof removed')));
   update private.part_one_saves set original_snapshot_at_save_id=coalesce(original_snapshot_at_save_id,snapshot_at_save_id),snapshot_at_save_id=pub.id,declaration_id=null,
    saved_result=private.part_one_filter_result(r,c.owner_id) where id=sv.id;
  end if;
 end loop;
 update private.part_one_saves set declaration_id=null,saved_result=saved_result || jsonb_build_object('declarationId',null,
   'declarationState','conflict','scope',case when snapshot_at_save_id is null then null else 'public' end,
   'evidenceIds','[]'::jsonb,'reasonCodes',jsonb_build_array('private_proof_removed'),
   'display',(saved_result->'display') || jsonb_build_object('sections','[]'::jsonb,'sources','[]'::jsonb,'limitations',jsonb_build_array('Private proof removed')))
   where owner_id=c.owner_id and declaration_id=any(ids);
 update private.part_one_capture_commits set deleted_at=coalesce(deleted_at,now()),observation_ids='{}',declaration_ids='{}',asset_ids='{}',bound_result=null,review_state=null,review_receipt_id=null,review_context=null,evaluated_hash=null,evaluated_review_id=null
   where capture_id=c.id;
 -- Refilter current copies while the private snapshot still carries its
 -- immutable original-public binding; erasure must not lose that independent
 -- identity. Readiness and private variant fields retract before rows vanish.
 update private.part_one_record_status set status='revoked',reason=p_reason,status_revision=status_revision+1,changed_at=now() where record_id=any(ids);
 for s in select * from private.part_one_scans where owner_id=c.owner_id and (nullif(result->>'declarationId','')::uuid=any(ids) or nullif(result->>'snapshotId','')::uuid=any(ids)) for update loop
  r:=private.part_one_filter_result(s.result,c.owner_id)||jsonb_build_object('resultRevision',s.result_revision+1);r:=jsonb_set(r,'{display,resultRevision}',r->'resultRevision');
  update private.part_one_scans set result=r,result_revision=s.result_revision+1,binding_revision=binding_revision+1 where id=s.id;
 end loop;
 delete from private.part_one_private_reviews where capture_id=c.id;
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
 perform pg_catalog.pg_advisory_xact_lock(40203);
 for c in select id from private.part_one_captures where owner_id=old.id loop
   perform private.part_one_purge_capture(c,'account_deleted');
 end loop;
 return old;
end $$;
create trigger part_one_private_before_owner_delete before delete on auth.users for each row execute function private.part_one_before_owner_delete();

-- Whole dependency closure is checked on reads/saves/publication. A text copy
-- cannot escape revocation of its source policy or evidence dependency.
create function private.part_one_record_allowed(p_id uuid, p_owner uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 return (with recursive dependencies as (
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
        or exists(select 1 from unnest(d.identity_dependencies) x where not private.part_one_snapshot_identity_allowed(x,p_owner))
    ));
end $$;

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
 foreach dep in array snap.identity_dependencies loop
   if dep=snap.id or not private.part_one_snapshot_identity_allowed(dep,p_owner) then return false; end if;
 end loop;
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
 select min(deadline) from (select least(r.expires_at,coalesce(p.expires_at,'infinity'::timestamptz)) deadline
 from all_identity r join private.part_one_policies p on p.id=r.policy_id union all
 select private.part_one_identity_expiry(x) from all_identity r,lateral unnest(r.identity_dependencies) x) limits;
$$;
create function private.part_one_record_expiry(p_id uuid) returns timestamptz
language sql stable security definer set search_path='' as $$
 with recursive d as (select * from private.part_one_records where id=p_id
   union select r.* from private.part_one_records r join d on r.id=any(d.dependencies))
 select min(deadline) from (select least(d.expires_at,coalesce(p.expires_at,'infinity'::timestamptz)) deadline from d
 join private.part_one_policies p on p.id=d.policy_id union all
 select private.part_one_identity_expiry(x) from d,lateral unnest(d.identity_dependencies) x) expiry;
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
 -- A package snapshot adds private variant/formula proof to an existing
 -- immutable public identity. Withdrawal of that proof returns ONLY the stored
 -- same-item public identity projection, never a replacement formula.
 if snapshot is not null and not private.part_one_snapshot_identity_allowed(snapshot,p_owner) then
  select * into rec from private.part_one_records where id=snapshot and owner_id=p_owner and scope='private_package' and payload->>'privateKind'='package_snapshot';
  if found then
   select * into bound from private.part_one_records where id=nullif(rec.payload->>'publicSnapshotId','')::uuid and scope='public' and item_id=rec.item_id
    and (rec.canonical_key is null or canonical_key=rec.canonical_key) and private.part_one_snapshot_identity_allowed(id,p_owner);
   if found then
    snapshot:=bound.id;declaration:=null;
    r:=r||jsonb_build_object('snapshotId',bound.id,'itemId',bound.item_id,'identity','exact','declarationId',null,'declarationState','conflict','scope','public',
     'packageConfirmation','unconfirmed','evidenceIds','[]'::jsonb,'conflictIds','[]'::jsonb,'reasonCodes',jsonb_build_array('private_evidence_unavailable'),
     'allowedActions',jsonb_build_array('save_partial','rescan'),'display',jsonb_build_object('resultRevision',r->'resultRevision',
      'selectedIdentity',jsonb_build_object('id',bound.item_id,'name',bound.payload->'name','brand',bound.payload->'brand','variantText',bound.payload->'variantText','image',bound.payload->'image','expiresAt',private.part_one_identity_expiry(bound.id)),
      'candidates','[]'::jsonb,'sections','[]'::jsonb,'sources','[]'::jsonb,'limitations',jsonb_build_array('Private package proof is no longer available')));
   end if;
  end if;
 end if;
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
  source_revision integer; source_ordinal integer; expiry timestamptz; image_ids uuid[] := '{}'; observation_ids uuid[] := '{}'; declaration_ids uuid[] := '{}';
  deps uuid[]; previous_declaration uuid; uncertainty jsonb; predicate jsonb; sections jsonb; entries jsonb;
  r jsonb:=p_scan.result; next_capture_revision integer; request_hash text; offset_value integer; line_order integer;
  selected_decl jsonb; selected_sources jsonb; source_image uuid; known_asset boolean; assoc boolean;
  input_entry record; source_entries jsonb; wrapper_role text; transcription_uncertainty jsonb; original_id uuid; owned_review jsonb; assembly jsonb; owned_assemblies jsonb:='[]'; owned_lines jsonb; base_snapshot uuid;
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
   or jsonb_typeof(p_payload->'assets') is distinct from 'array' or jsonb_typeof(case when p_payload->>'schemaVersion'='2' then p_payload->'sourceObservations' else p_payload->'observations' end) is distinct from 'array' or jsonb_typeof(p_payload->'edits') is distinct from 'array'
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
 if p_payload->>'schemaVersion'='2' then
   source_entries:=p_payload->'sourceObservations';
   if jsonb_array_length(source_entries)>36 or jsonb_array_length(p_payload->'edits')>100
    or exists(select 1 from jsonb_array_elements(source_entries) e where e->>'revision' is distinct from '1' or (e->>'role' is distinct from 'ingredients' and e->>'role' is distinct from 'package')
      or exists(select 1 from jsonb_object_keys(e) k where k<>all(array['observationId','revision','role','observation']))) then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
 else
   select coalesce(jsonb_agg(jsonb_build_object('observationId',e->'evidenceId','revision',1,'role','ingredients','observation',e)),'[]') into source_entries
    from jsonb_array_elements(p_payload->'observations') e;
 end if;
 if (select count(*) from private.part_one_records rr where rr.owner_id=p_owner and rr.payload->>'captureSessionId'=p_capture.id::text and rr.payload->>'privateKind'='ocr')+(select count(*) from jsonb_array_elements(source_entries) e where not exists(select 1 from private.part_one_records rr where rr.id=(e->>'observationId')::uuid))>36
  or (select count(*) from private.part_one_records rr where rr.owner_id=p_owner and rr.payload->>'captureSessionId'=p_capture.id::text and rr.payload->>'privateKind'='edit')+(select count(*) from jsonb_array_elements(p_payload->'edits') e where not exists(select 1 from private.part_one_records rr where rr.id=(e->>'observationId')::uuid))>100 then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
 if p_payload->>'schemaVersion'='2' and jsonb_array_length(source_entries)=0 and jsonb_array_length(p_payload->'edits')=0
  and not exists(select 1 from private.part_one_records rr where rr.owner_id=p_owner and rr.payload->>'captureSessionId'=p_capture.id::text and rr.payload->>'privateKind' in ('ocr','edit')) then
  raise exception 'PART_ONE_INVALID_PAYLOAD';end if;
 if exists(select 1 from (select (e->>'observationId')::uuid id from jsonb_array_elements(source_entries) e
    union all select (e->>'observationId')::uuid from jsonb_array_elements(p_payload->'edits') e) ids group by id having count(*)>1) then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
 -- A new source revision retracts old readiness and copied save readiness before
 -- the reviewed evaluator runs. Recover the original public identity binding;
 -- no ingredient formula from that public snapshot is inherited.
 if p_payload->>'schemaVersion'='2' and exists(select 1 from jsonb_array_elements(source_entries||(p_payload->'edits')) e where not exists(select 1 from private.part_one_records rr where rr.id=(e->>'observationId')::uuid)) then
   select nullif(payload->>'publicSnapshotId','')::uuid into base_snapshot from private.part_one_records where id=nullif(r->>'snapshotId','')::uuid and owner_id=p_owner and payload->>'privateKind'='package_snapshot';
   update private.part_one_record_status st set status='retracted',reason='private_source_revision',status_revision=status_revision+1,changed_at=now()
     from private.part_one_records rr where rr.id=st.record_id and rr.owner_id=p_owner and rr.kind='declaration' and rr.payload->>'captureSessionId'=p_capture.id::text and rr.payload->>'state'='accepted';
   if base_snapshot is not null and private.part_one_snapshot_identity_allowed(base_snapshot,p_owner) then r:=r||jsonb_build_object('snapshotId',base_snapshot); end if;
   r:=r||jsonb_build_object('declarationId',null,'declarationState','partial','scope','private_package','allowedActions',jsonb_build_array('save_partial','add_photo','rescan','remove_draft'));
   r:=jsonb_set(r,'{display,sections}','[]');r:=jsonb_set(r,'{display,sources}','[]');
 end if;
 owned_review:=case when p_payload->>'schemaVersion'='2' then p_payload->'review' else null end;
 if owned_review is not null and owned_review<>'null'::jsonb then
  for assembly in select value from jsonb_array_elements(owned_review->'reviewState'->'assemblies') loop
   select coalesce(jsonb_agg(value||jsonb_build_object('actorOwnerId',case when value->'actorOwnerId'='null'::jsonb then null else p_owner end) order by ordinality),'[]') into owned_lines from jsonb_array_elements(assembly->'lines') with ordinality;
   owned_assemblies:=owned_assemblies||jsonb_build_array(assembly||jsonb_build_object('sameDeclarationObservedBy',p_owner,'lines',owned_lines));
  end loop;
  owned_review:=jsonb_set(owned_review,'{reviewState,assemblies}',owned_assemblies);
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
       and aa.expires_at>now() and (o.owner_id=p_owner::text or (o.owner_id is null and aa.upload_ticket_id is not null and exists(select 1 from private.part_one_upload_tickets ut
         where ut.id=aa.upload_ticket_id and ut.owner_id=p_owner and ut.capture_id=p_capture.id and ut.package_observation_id=p_capture.package_observation_id
           and ut.state='attested' and ut.attestation_id=aa.id and ut.object_id=o.id and ut.object_version=o.version and ut.content_hash=aa.content_hash
           and ut.bucket_id=o.bucket_id and ut.object_name=o.name and ut.generation=aa.generation and ut.deletion_epoch=aa.deletion_epoch))) and o.bucket_id=cfg.bucket_id and not b.public
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
 for input_entry in select entry,is_edit from (select value as entry,false as is_edit,0 as group_order,ordinality from jsonb_array_elements(source_entries) with ordinality
   union all select value,true,1,ordinality from jsonb_array_elements(p_payload->'edits') with ordinality) rows order by group_order,ordinality loop
   observation:=case when input_entry.is_edit then input_entry.entry else input_entry.entry->'observation' end;
   wrapper_role:=case when input_entry.is_edit then null else input_entry.entry->>'role' end;
   -- A reopened v2 package submits its originals/edit lineage along with the
   -- delta. Reuse only the exact immutable same-owner row; never overwrite it or
   -- accept a changed payload under an existing evidence ID.
   if p_payload->>'schemaVersion'='2' then
    select * into prior from private.part_one_records where id=(input_entry.entry->>'observationId')::uuid;
    if found then
     if prior.owner_id is distinct from p_owner or prior.kind<>'observation' or prior.scope<>'private_package'
      or prior.payload->>'captureSessionId' is distinct from p_capture.id::text or prior.payload->>'packageObservationId' is distinct from p_capture.package_observation_id::text
      or prior.payload->'observation' is distinct from observation
      or (not input_entry.is_edit and (prior.revision<>1 or prior.payload->>'role' is distinct from wrapper_role or prior.payload->>'privateKind'<>'ocr'))
      or (input_entry.is_edit and (prior.revision is distinct from (observation->>'revision')::integer or prior.payload->>'privateKind'<>'edit'))
      or not private.part_one_record_allowed(prior.id,p_owner) then raise exception 'PART_ONE_IDEMPOTENCY_CONFLICT';end if;
     observation_ids:=array_append(observation_ids,prior.id);continue;
    end if;
   end if;
   known_asset:=false; source_image:=null; uncertainty:='["full_panel_not_established","variant_market_unverified"]';transcription_uncertainty:='[]';
   if observation ? 'evidenceId' then
     observation_id:=(input_entry.entry->>'observationId')::uuid; source_revision:=1;original_id:=observation_id;
     if observation->>'captureSessionId' is distinct from p_capture.id::text or (observation->>'generation')::integer is distinct from p_capture.generation
       or jsonb_typeof(observation->'lines')<>'array' or jsonb_typeof(observation->'languageConfig')<>'array'
       or jsonb_array_length(observation->'orientationTransform')<>9
       or observation->>'recognizer' is null or observation->>'recognizerVersion' is null
       or observation->>'status' not in ('recognized','no_text','unsupported_script','model_unavailable','cancelled','failed')
       or exists(select 1 from jsonb_object_keys(observation) k where k<>all(array['evidenceId','captureSessionId','generation','recognizer','recognizerVersion','languageConfig','correctionEnabled','sourceWidth','sourceHeight','orientationTransform','lines','status'])) then
       raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
     if observation->>'status'='recognized' and ((observation->>'sourceWidth')::integer not between 1 and 4096 or (observation->>'sourceHeight')::integer not between 1 and 4096)
       then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
     if p_payload->>'schemaVersion'='2' then
       select coalesce(array_agg(pa.record_id),'{}') into deps from private.part_one_private_assets pa where pa.capture_id=p_capture.id
        and pa.client_evidence_id=(observation->>'evidenceId')::uuid;
       if cardinality(deps)<>1 then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
       if not exists(select 1 from private.part_one_records rr join private.part_one_private_assets pa on pa.record_id=rr.id
         join private.part_one_asset_attestations aa on aa.id=pa.attestation_id where rr.id=deps[1]
          and aa.width=(observation->>'sourceWidth')::integer and aa.height=(observation->>'sourceHeight')::integer) then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
     else deps:=image_ids; end if;
     if cardinality(deps)=0 then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
     for line in select value from jsonb_array_elements(observation->'lines') loop
       if jsonb_typeof(line->'text')<>'string' or jsonb_typeof(line->'alternatives')<>'array' or jsonb_array_length(line->'region')<>4
         or exists(select 1 from jsonb_object_keys(line) k where k<>all(array['text','alternatives','region','confidence'])) then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
       if jsonb_array_length(line->'alternatives')>0 then uncertainty:=uncertainty || '["recognition_alternatives_unresolved"]';transcription_uncertainty:=transcription_uncertainty || '["recognition_alternatives_unresolved"]'; end if;
     end loop;
     select string_agg(value->>'text',E'\n' order by ordinality) into raw_text from jsonb_array_elements(observation->'lines') with ordinality;
     raw_text:=coalesce(raw_text,'');
     if cardinality(deps)=1 then source_image:=deps[1]; else uncertainty:=uncertainty || '["image_region_mapping_unresolved"]';transcription_uncertainty:=transcription_uncertainty || '["image_region_mapping_unresolved"]'; end if;
   else
     if exists(select 1 from jsonb_object_keys(observation) k where k<>all(array['observationId','supersedesId','revision','text','reason','sourceRef','replacementText']))
       or jsonb_typeof(observation->'text')<>'string' or length(observation->>'reason')=0 then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
     observation_id:=(observation->>'observationId')::uuid;
     select * into prior from private.part_one_records where id=(observation->>'supersedesId')::uuid and kind='observation'
       and owner_id=p_owner and scope='private_package' and payload->>'captureSessionId'=p_capture.id::text and payload->>'privateKind' in ('ocr','edit');
     if not found or not private.part_one_record_allowed(prior.id,p_owner) then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
     source_revision:=(observation->>'revision')::integer;
     if source_revision<>prior.revision+1 or exists(select 1 from private.part_one_records where owner_id=p_owner and supersedes_id=prior.id and kind='observation')
       then raise exception 'PART_ONE_IDEMPOTENCY_CONFLICT'; end if;
     deps:=array_append(prior.dependencies,prior.id);raw_text:=observation->>'text';
     wrapper_role:=coalesce(prior.payload->>'role','ingredients');original_id:=coalesce(nullif(prior.payload->>'originalObservationId','')::uuid,prior.id);
     uncertainty:=uncertainty || '["user_edit_does_not_establish_missing_coverage"]';
   end if;
   if exists(select 1 from private.part_one_records where id=observation_id) then raise exception 'PART_ONE_IDEMPOTENCY_CONFLICT'; end if;
   for source_id in select unnest(deps) loop
     if not private.part_one_record_allowed(source_id,p_owner) then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
     expiry:=least(expiry,private.part_one_record_expiry(source_id));
   end loop;
   if observation ? 'evidenceId' then
    select coalesce(max((rr.payload->>'sourceOrdinal')::integer)+1,count(*)::integer) into source_ordinal from private.part_one_records rr
     where rr.owner_id=p_owner and rr.payload->>'captureSessionId'=p_capture.id::text and rr.payload->>'privateKind'='ocr';
   else source_ordinal:=null;end if;
   insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,owner_id,scope,payload,dependencies,supersedes_id,observed_at,expires_at)
     values(observation_id,'observation',p_capture.item_id,source_revision,private.part_one_code_key(p_scan.request->'code'),'private_capture',policy.version,p_owner,'private_package',
       jsonb_build_object('privateKind',case when observation ? 'evidenceId' then 'ocr' else 'edit' end,'captureSessionId',p_capture.id,
         'packageObservationId',p_capture.package_observation_id,'generation',p_capture.generation,'deletionEpoch',p_capture.deletion_epoch,
         'policyId',cfg.source_policy_id,'rawText',raw_text,'observation',observation,'role',wrapper_role,'originalObservationId',original_id,'sourceOrdinal',source_ordinal,
         'uncertaintyReasons',case when p_payload->>'schemaVersion'='2' then transcription_uncertainty else uncertainty end),deps,
       case when observation ? 'evidenceId' then null else (observation->>'supersedesId')::uuid end,now(),expiry);
   insert into private.part_one_record_status(record_id) values(observation_id);observation_ids:=array_append(observation_ids,observation_id);
   if raw_text='' or wrapper_role='package' or (observation ? 'status' and observation->>'status'<>'recognized') then continue; end if;
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
 insert into private.part_one_capture_commits(owner_id,capture_id,idempotency_key,request_hash,package_observation_id,generation,deletion_epoch,capture_revision,observation_ids,declaration_ids,asset_ids,bound_result,review_state)
   values(p_owner,p_capture.id,p_payload->>'idempotencyKey',request_hash,p_capture.package_observation_id,p_capture.generation,p_capture.deletion_epoch,next_capture_revision,observation_ids,declaration_ids,image_ids,r,owned_review);
 return jsonb_build_object('schemaVersion',1,'capture',jsonb_build_object('schemaVersion',1,'captureSessionId',p_capture.id,
   'packageObservationId',p_capture.package_observation_id,'scanId',p_scan.id,'generation',p_capture.generation,'captureRevision',next_capture_revision,
   'deletionEpoch',p_capture.deletion_epoch,'itemId',p_capture.item_id,'candidateId',null),
   'observationIds',to_jsonb(observation_ids),'declarationIds',to_jsonb(declaration_ids),'assetIds',to_jsonb(image_ids),'result',r);
end $$;

-- One transaction owns operation creation, binding, subscription and save.
create function private.part_one_capture_projection(p_capture private.part_one_captures) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schemaVersion',1,'captureSessionId',p_capture.id,'packageObservationId',p_capture.package_observation_id,
  'scanId',p_capture.scan_id,'generation',p_capture.generation,'captureRevision',p_capture.capture_revision,'deletionEpoch',p_capture.deletion_epoch,'itemId',p_capture.item_id,'candidateId',null);
$$;
create function private.part_one_private_enabled(p_require_consumer boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.part_one_private_config cfg join private.part_one_policies pp on pp.id='private_capture'
  join storage.buckets b on b.id=cfg.bucket_id and not b.public
  where cfg.id=true and cfg.enabled and cfg.reviewed_at is not null and cfg.reviewed_at<=now() and cfg.process_allowed and cfg.ocr_allowed and cfg.upload_allowed and cfg.private_display_allowed
   and cfg.expires_at>now() and cfg.policy_version=pp.version and pp.retain_allowed and pp.display_allowed
   and pp.permission_evidence is not null and (pp.expires_at is null or pp.expires_at>now())
   and (not p_require_consumer or exists(select 1 from private.part_one_private_consumer h where h.id=true and h.heartbeat_at>now()-interval '60 seconds')));
$$;
create function private.part_one_upload_receipt(p_ticket private.part_one_upload_tickets) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c private.part_one_captures; s private.part_one_scans; aa private.part_one_asset_attestations;
begin
 select * into c from private.part_one_captures where id=p_ticket.capture_id and owner_id=p_ticket.owner_id;
 select * into s from private.part_one_scans where id=p_ticket.scan_id and owner_id=p_ticket.owner_id;
 select * into aa from private.part_one_asset_attestations where id=p_ticket.attestation_id;
 if c.id is null or s.id is null or aa.id is null or aa.expires_at<=now() or p_ticket.state<>'attested'
  or exists(select 1 from private.part_one_asset_status where attestation_id=aa.id and revoked_at is not null) then raise exception 'PART_ONE_DELETED'; end if;
 return jsonb_build_object('schemaVersion',1,'capture',private.part_one_capture_projection(c),'result',private.part_one_filter_result(s.result,p_ticket.owner_id),
  'asset',jsonb_build_object('evidenceId',p_ticket.client_evidence_id,'storageObjectId',p_ticket.object_id,'contentHash',p_ticket.content_hash,'width',p_ticket.width,'height',p_ticket.height,'metadataStripped',true),
  'attestationId',aa.id,'expiresAt',aa.expires_at);
end $$;
create function private.part_one_upload_operation(p_action text,p_payload jsonb,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare c private.part_one_captures; s private.part_one_scans; cfg private.part_one_private_config; ut private.part_one_upload_tickets; r jsonb;
begin
 if not private.part_one_private_enabled(false) then raise exception 'PART_ONE_PRIVATE_RETENTION_DISABLED'; end if;
 if not private.part_one_private_enabled(true) then return jsonb_build_object('conflict',true,'code','private_cleanup_worker_unavailable'); end if;
 select * into c from private.part_one_captures where id=(p_payload->>'captureSessionId')::uuid and owner_id=p_owner for update;
 if not found then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
 select * into s from private.part_one_scans where id=c.scan_id and owner_id=p_owner for update;
 r:=private.part_one_filter_result(s.result,p_owner);
 if c.removed_at is not null or c.expires_at<=now() or c.generation<>s.generation or c.deletion_epoch<>s.deletion_epoch or c.item_id is distinct from nullif(r->>'itemId','')::uuid
  or (p_payload->>'packageObservationId')::uuid is distinct from c.package_observation_id or (p_payload->>'expectedGeneration')::integer is distinct from s.generation
  or (p_payload->>'expectedResultRevision')::integer is distinct from s.result_revision or (p_payload->>'expectedCaptureRevision')::integer is distinct from c.capture_revision
  or (p_payload->>'expectedDeletionEpoch')::integer is distinct from c.deletion_epoch then return jsonb_build_object('conflict',true,'code','stale_capture','result',r); end if;
 if p_action='captures/upload-authorize' then return jsonb_build_object('allowed',true); end if;
 if p_payload->>'contentHash' is null or p_payload->>'contentHash' !~ '^[a-f0-9]{64}$' or p_payload->>'byteLength' is null or (p_payload->>'byteLength')::integer not between 1 and 2097152
  or p_payload->>'width' is null or p_payload->>'height' is null or (p_payload->>'width')::integer not between 1 and 4096 or (p_payload->>'height')::integer not between 1 and 4096
  or length(p_payload->>'idempotencyKey') not between 1 and 200 or p_payload->>'evidenceId' is null then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
 select * into ut from private.part_one_upload_tickets where owner_id=p_owner and idempotency_key=p_payload->>'idempotencyKey' for update;
 if found then
  if ut.capture_id<>c.id or ut.client_evidence_id is distinct from (p_payload->>'evidenceId')::uuid or ut.content_hash is distinct from p_payload->>'contentHash'
   or ut.byte_length<>(p_payload->>'byteLength')::integer or ut.width<>(p_payload->>'width')::integer or ut.height<>(p_payload->>'height')::integer
   or ut.generation<>c.generation or ut.deletion_epoch<>c.deletion_epoch then raise exception 'PART_ONE_IDEMPOTENCY_CONFLICT'; end if;
  if ut.state='attested' then return jsonb_build_object('replay',private.part_one_upload_receipt(ut)); end if;
  return jsonb_build_object('conflict',true,'code','upload_owned_or_cancelled','result',r);
 end if;
 if (select count(*) from private.part_one_upload_tickets where owner_id=p_owner and created_at>now()-interval '1 day')>=30
  or (select count(*) from private.part_one_upload_tickets where capture_id=c.id and state in ('reserved','dispatched','attested','unknown'))>=6
  or exists(select 1 from private.part_one_upload_tickets where capture_id=c.id and client_evidence_id=(p_payload->>'evidenceId')::uuid) then
  return jsonb_build_object('conflict',true,'code','private_upload_quota','result',r); end if;
 select * into cfg from private.part_one_private_config where id=true;
 insert into private.part_one_upload_tickets(owner_id,capture_id,scan_id,package_observation_id,client_evidence_id,idempotency_key,generation,result_revision,capture_revision,deletion_epoch,
  content_hash,byte_length,width,height,policy_version,bucket_id,object_name)
 values(p_owner,c.id,s.id,c.package_observation_id,(p_payload->>'evidenceId')::uuid,p_payload->>'idempotencyKey',c.generation,s.result_revision,c.capture_revision,c.deletion_epoch,
  p_payload->>'contentHash',(p_payload->>'byteLength')::integer,(p_payload->>'width')::integer,(p_payload->>'height')::integer,cfg.policy_version,cfg.bucket_id,
  'part-one/'||gen_random_uuid()::text||'.jpg') returning * into ut;
 return jsonb_build_object('ticketId',ut.id,'bucketId',ut.bucket_id,'objectName',ut.object_name,'expiresAt',ut.expires_at);
end $$;
create function private.part_one_queue_ticket(p_ticket uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare ut private.part_one_upload_tickets; cfg private.part_one_private_config;
begin
 select * into ut from private.part_one_upload_tickets where id=p_ticket for update;
 if not found then return; end if;
 select * into cfg from private.part_one_private_config where id=true;
 update private.part_one_upload_tickets set state=case when state='deleted' then state else 'cancelled' end where id=ut.id;
 insert into private.part_one_private_cleanup(object_id,bucket_id,object_name,object_version,due_at,reason)
  select o.id,o.bucket_id,o.name,o.version,now()+make_interval(secs=>coalesce(cfg.deletion_deadline_seconds,1)),p_reason from storage.objects o
   where o.bucket_id=ut.bucket_id and o.name=ut.object_name and (o.owner_id is null or o.owner_id=ut.owner_id::text)
  on conflict(object_id) do update set due_at=least(private.part_one_private_cleanup.due_at,excluded.due_at);
end $$;

create function private.part_one_saved_capture(p_save private.part_one_saves,p_owner uuid) returns uuid
language sql stable security definer set search_path='' as $$
 select nullif(rr.payload->>'captureSessionId','')::uuid from private.part_one_records rr
 where rr.id=p_save.declaration_id and rr.owner_id=p_owner and rr.scope='private_package' and private.part_one_record_allowed(rr.id,p_owner);
$$;
create function private.part_one_observation_projection(p_record private.part_one_records) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare images uuid[]; original uuid; state text;
begin
 with recursive deps as (select r.*,0 depth from private.part_one_records r where r.id=any(p_record.dependencies)
  union all select r.*,d.depth+1 from deps d join private.part_one_records r on r.id=any(d.dependencies) where d.depth<50)
 select coalesce(array_agg(distinct id),'{}') into images from deps where payload->>'privateKind'='sanitized_image';
 with recursive lineage as (select r.*,0 depth from private.part_one_records r where r.id=p_record.id
  union all select r.*,d.depth+1 from lineage d join private.part_one_records r on r.id=d.supersedes_id where d.depth<50)
 select id into original from lineage where payload->>'privateKind'='ocr' order by depth desc limit 1;
 select case when status='active' then 'active' else 'revoked' end into state from private.part_one_record_status where record_id=p_record.id;
 return jsonb_build_object('ownerId',p_record.owner_id,'captureSessionId',p_record.payload->'captureSessionId','packageObservationId',p_record.payload->'packageObservationId',
  'generation',p_record.payload->'generation','deletionEpoch',p_record.payload->'deletionEpoch','observationId',p_record.id,'revision',p_record.revision,
  'role',coalesce(p_record.payload->>'role','ingredients'),'kind',p_record.payload->'privateKind','rawText',p_record.payload->'rawText','assetEvidenceIds',to_jsonb(images),
  'originalObservationId',coalesce(original,p_record.id),'supersedesId',p_record.supersedes_id,'uncertaintyReasons',coalesce(p_record.payload->'uncertaintyReasons','[]'),
  'ocr',case when p_record.payload->>'privateKind'='ocr' then p_record.payload->'observation' else null end,
  'edit',case when p_record.payload->>'privateKind'='edit' then (p_record.payload->'observation')-'sourceRef'-'replacementText' else null end,
  'observedAt',p_record.observed_at,'expiresAt',p_record.expires_at,'status',coalesce(state,'active'));
end $$;
create function private.part_one_recover_capture(p_id uuid,p_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.part_one_captures; s private.part_one_scans; cm private.part_one_capture_commits; assets jsonb; observations jsonb; edits jsonb; declarations jsonb; editable boolean;
begin
 if not private.part_one_private_enabled(false) then raise exception 'PART_ONE_PRIVATE_RETENTION_DISABLED'; end if;
 perform private.part_one_purge_expired_private();
 select * into c from private.part_one_captures where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501'; end if;
 select * into cm from private.part_one_capture_commits where capture_id=c.id and owner_id=p_owner and deleted_at is null order by capture_revision desc,created_at desc,source_commit_id desc limit 1;
 if c.removed_at is not null and cm.source_commit_id is null or c.expires_at<=now() and cm.source_commit_id is null then raise exception 'PART_ONE_DELETED'; end if;
 select * into s from private.part_one_scans where id=c.scan_id and owner_id=p_owner for update;
 editable:=c.removed_at is null and c.expires_at>now() and c.generation=s.generation and c.deletion_epoch=s.deletion_epoch
  and c.item_id is not distinct from nullif(private.part_one_filter_result(s.result,p_owner)->>'itemId','')::uuid;
 select coalesce(jsonb_agg(jsonb_build_object('recordId',pa.record_id,'asset',jsonb_build_object('evidenceId',coalesce(pa.client_evidence_id,ut.client_evidence_id),
  'storageObjectId',aa.storage_object_id,'contentHash',aa.content_hash,'width',aa.width,'height',aa.height,'metadataStripped',true),
  'attestationId',aa.id,'expiresAt',least(aa.expires_at,cfg.expires_at,coalesce(pp.expires_at,'infinity')),'signedAccess',null,
  'storage',jsonb_build_object('bucketId',o.bucket_id,'objectName',o.name,'objectVersion',o.version)) order by aa.observed_at),'[]') into assets
 from private.part_one_asset_attestations aa join storage.objects o on o.id=aa.storage_object_id and o.version=aa.object_version
  cross join private.part_one_private_config cfg join private.part_one_policies pp on pp.id='private_capture'
  left join private.part_one_private_assets pa on pa.attestation_id=aa.id and pa.capture_id=c.id
  left join private.part_one_upload_tickets ut on ut.id=aa.upload_ticket_id and ut.capture_id=c.id and ut.owner_id=p_owner and ut.state='attested'
 where aa.capture_id=c.id and aa.owner_id=p_owner and aa.expires_at>now()
  and not exists(select 1 from private.part_one_asset_status ast where ast.attestation_id=aa.id and ast.revoked_at is not null)
  and ((pa.record_id is not null and private.part_one_record_allowed(pa.record_id,p_owner)) or
    (pa.record_id is null and editable and ut.object_id=o.id and ut.object_version=o.version and ut.content_hash=aa.content_hash
      and ut.package_observation_id=c.package_observation_id and ut.generation=c.generation and ut.deletion_epoch=c.deletion_epoch and o.owner_id is null));
 select coalesce(jsonb_agg(jsonb_build_object('observationId',rr.id,'revision',rr.revision,'role',coalesce(rr.payload->>'role','ingredients'),
  'observation',rr.payload->'observation') order by coalesce((rr.payload->>'sourceOrdinal')::integer,0),rr.created_at,rr.id),'[]') into observations from private.part_one_records rr
 where rr.owner_id=p_owner and rr.scope='private_package' and rr.payload->>'captureSessionId'=c.id::text and rr.payload->>'privateKind'='ocr' and private.part_one_record_allowed(rr.id,p_owner);
 select coalesce(jsonb_agg((rr.payload->'observation')||jsonb_build_object('actorOwnerId',p_owner) order by coalesce((original.payload->>'sourceOrdinal')::integer,0),rr.revision,rr.created_at,rr.id),'[]') into edits from private.part_one_records rr
 left join private.part_one_records original on original.id=nullif(rr.payload->>'originalObservationId','')::uuid
 where rr.owner_id=p_owner and rr.scope='private_package' and rr.payload->>'captureSessionId'=c.id::text and rr.payload->>'privateKind'='edit' and private.part_one_record_allowed(rr.id,p_owner);
 select coalesce(jsonb_agg(rr.id order by rr.created_at,rr.id),'[]') into declarations from private.part_one_records rr
 where rr.owner_id=p_owner and rr.scope='private_package' and rr.payload->>'captureSessionId'=c.id::text and rr.kind='declaration' and private.part_one_record_allowed(rr.id,p_owner);
 return jsonb_build_object('schemaVersion',1,'capture',private.part_one_capture_projection(c),'editable',editable,
  'result',private.part_one_filter_result(s.result,p_owner),'boundResult',case when cm.bound_result is null then null else private.part_one_filter_result(cm.bound_result,p_owner) end,
  'assets',assets,'sourceObservations',observations,'edits',edits,'declarationIds',declarations,'review',cm.review_state,'reviewReceiptId',cm.review_receipt_id);
end $$;

create function public.part_one_operation(p_action text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare u uuid := private.part_one_owner(); s private.part_one_scans; j private.part_one_jobs;
  saved private.part_one_saves; c private.part_one_captures; r jsonb; id uuid; sub uuid;
  key text; catalog jsonb; snap private.part_one_records; dec private.part_one_records;
  worker_live boolean; expected integer; cfg private.part_one_private_config;
begin
 -- Serialize with lifecycle/publication so save sees one rights/deletion revision.
 perform pg_catalog.pg_advisory_xact_lock(40203);
 if jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text)>(case when p_action='captures/observations' and p_payload->>'schemaVersion'='2' then 524288 else 65536 end) or p_payload ? 'ownerId' then
   raise exception 'PART_ONE_INVALID_PAYLOAD';
 end if;
 -- Reads as well as consumers erase private material whose actual source
 -- retention/display rights, sanitized assets or retention deadline expired.
 perform private.part_one_purge_expired_private();
 if p_action='captures/evidence' then return private.part_one_recover_capture((p_payload->>'captureSessionId')::uuid,u); end if;
 if p_action='captures/list' then
   if not private.part_one_private_enabled(false) then return jsonb_build_object('captures','[]'::jsonb); end if;
   perform private.part_one_purge_expired_private();
   return jsonb_build_object('captures',(select coalesce(jsonb_agg(jsonb_build_object('capture',private.part_one_capture_projection(cc),
    'editable',cc.removed_at is null and cc.expires_at>now() and cc.generation=ss.generation and cc.deletion_epoch=ss.deletion_epoch and cc.item_id is not distinct from nullif(private.part_one_filter_result(ss.result,u)->>'itemId','')::uuid,
    'boundResult',private.part_one_filter_result(cm.bound_result,u)) order by cm.created_at desc),'[]')
   from (select * from (select distinct on(capture_id) * from private.part_one_capture_commits where owner_id=u and deleted_at is null and bound_result is not null order by capture_id,capture_revision desc,created_at desc,source_commit_id desc) latest order by created_at desc limit 50) cm
    join private.part_one_captures cc on cc.id=cm.capture_id join private.part_one_scans ss on ss.id=cc.scan_id
   where exists(select 1 from private.part_one_records rr where rr.owner_id=u and rr.payload->>'captureSessionId'=cc.id::text and private.part_one_record_allowed(rr.id,u))));
 end if;
 if p_action='private/capability' then
   select * into cfg from private.part_one_private_config where id=true;
   return jsonb_build_object('schemaVersion',1,'enabled',private.part_one_private_enabled(true),'reasonCode',
     case when not private.part_one_private_enabled(false) then 'private_policy_disabled' when not private.part_one_private_enabled(true) then 'private_cleanup_worker_unavailable' else 'enabled' end,
     'policyVersion',case when cfg.enabled then cfg.policy_version else null end,'retentionSeconds',case when cfg.enabled then cfg.retention_seconds else null end,
     'deletionDeadlineSeconds',case when cfg.enabled then cfg.deletion_deadline_seconds else null end,'expiresAt',case when cfg.enabled then cfg.expires_at else null end);
 end if;
 if p_action in ('captures/upload-authorize','captures/upload-reserve') then return private.part_one_upload_operation(p_action,p_payload,u); end if;
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
     'snapshotAtSaveId',coalesce(ss.original_snapshot_at_save_id,ss.snapshot_at_save_id),'captureSessionId',private.part_one_saved_capture(ss,u),'createdAt',ss.created_at,
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
   return jsonb_build_object('saveId',saved.id,'snapshotAtSaveId',coalesce(saved.original_snapshot_at_save_id,saved.snapshot_at_save_id),'captureSessionId',private.part_one_saved_capture(saved,u),
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
     return jsonb_build_object('saveId',saved.id,'snapshotAtSaveId',coalesce(saved.original_snapshot_at_save_id,saved.snapshot_at_save_id),'captureSessionId',private.part_one_saved_capture(saved,u),'result',private.part_one_filter_result(saved.saved_result,u));
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
   return jsonb_build_object('saveId',saved.id,'snapshotAtSaveId',coalesce(saved.original_snapshot_at_save_id,saved.snapshot_at_save_id),'captureSessionId',private.part_one_saved_capture(saved,u),'result',r);
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

revoke all on function private.part_one_capture_projection(private.part_one_captures),private.part_one_private_enabled(boolean),private.part_one_upload_receipt(private.part_one_upload_tickets),private.part_one_upload_operation(text,jsonb,uuid),private.part_one_queue_ticket(uuid,text) from public,anon,authenticated;

create function private.part_one_utc(p_time timestamptz) returns text language sql immutable set search_path='' as $$
 select to_char(p_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
$$;
create function private.part_one_canonical_json(p_value jsonb) returns text
language plpgsql immutable set search_path='' as $$
declare kind text:=jsonb_typeof(p_value); rendered text; n numeric;
begin
 if kind='object' then
  select '{'||coalesce(string_agg(to_jsonb(key)::text||':'||private.part_one_canonical_json(value),',' order by key collate "C"),'')||'}' into rendered from jsonb_each(p_value);return rendered;
 elsif kind='array' then
  select '['||coalesce(string_agg(private.part_one_canonical_json(value),',' order by ordinality),'')||']' into rendered from jsonb_array_elements(p_value) with ordinality;return rendered;
 elsif kind='number' then
  n:=(p_value#>>'{}')::numeric;if n=0 then return '0'; end if;
  if abs(n)>=0.000001 and abs(n)<1000000000000000000000 then
   rendered:=n::text;if position('.' in rendered)>0 then rendered:=rtrim(rtrim(rendered,'0'),'.'); end if;return rendered;
  end if;
  rendered:=(n::double precision)::text;
  return regexp_replace(rendered,'e([+-]?)0+([0-9]+)$','e\1\2');
 end if;
 return p_value::text;
end $$;
create function private.part_one_private_context(p_owner uuid,p_capture private.part_one_captures,p_scan private.part_one_scans,p_commit private.part_one_capture_commits,p_review uuid) returns jsonb
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
  'item',snap.payload->'fullItem','assets',assets,'observations',current_observations,'priorObservations',prior_observations,'supersedesDeclarationId',superseded,
  'reviewRequest',case when p_review is null then null else jsonb_build_object('reviewId',p_review) end,
  'policy',jsonb_build_object('policyId',cfg.source_policy_id,'provider','private_capture','version',cfg.policy_version,'permissionEvidence',cfg.approval_evidence,
   'reviewedAt',private.part_one_utc(cfg.reviewed_at),'expiresAt',private.part_one_utc(least(cfg.expires_at,coalesce(pp.expires_at,'infinity'))),'revokedAt',null,
   'operations',jsonb_build_object('lookup',false,'process',cfg.process_allowed,'retain',pp.retain_allowed,'sharedDisplay',false,'privateDisplay',cfg.private_display_allowed,
    'ocr',cfg.ocr_allowed,'cropThumbnail',false,'rehost',false,'hotlink',false,'export',false),'retainedFields',jsonb_build_array('sanitized_private_images','private_ocr','attributed_edits','ingredients'),
   'attribution','Owner-private package evidence','purgeObligations',jsonb_build_array('private_capture_removal','source_expiry','owner_deletion')),
  'now',private.part_one_utc(now()),'ids',ids);
end $$;

-- Review service is not an owner RPC. The default server has no review authority.
-- Only a frozen, explicitly installed synthetic registry can approve local tests.
create function private.part_one_commit_receipt(p_commit private.part_one_capture_commits,p_capture private.part_one_captures,p_scan private.part_one_scans) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schemaVersion',1,'capture',private.part_one_capture_projection(p_capture),
  'observationIds',to_jsonb(p_commit.observation_ids),'declarationIds',to_jsonb(p_commit.declaration_ids),
  'assetIds',to_jsonb(p_commit.asset_ids),'result',private.part_one_filter_result(p_scan.result,p_capture.owner_id));
$$;
-- JS strings count UTF-16 code units; SQL strings count code points. Literal
-- source spans are compared without silently shifting astral punctuation.
create function private.part_one_js_slice(p_text text,p_start integer,p_end integer) returns text
language plpgsql immutable set search_path='' as $$
declare n integer; cursor integer:=0; units integer; result text:=''; ch text;
begin
 if p_start<0 or p_end<p_start then return null; end if;
 for n in 1..char_length(p_text) loop
  ch:=substr(p_text,n,1);units:=case when ascii(ch)>65535 then 2 else 1 end;
  if (cursor<p_start and cursor+units>p_start) or (cursor<p_end and cursor+units>p_end) then return null; end if;
  if cursor>=p_start and cursor<p_end then result:=result||ch;end if;cursor:=cursor+units;
 end loop;
 if p_end>cursor then return null;end if;return result;
end $$;
create function private.part_one_review_operation(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare c private.part_one_captures;s private.part_one_scans;cm private.part_one_capture_commits;cfg private.part_one_private_config;
 owner uuid:=(p_payload->>'ownerId')::uuid;review_id uuid:=nullif(p_payload->>'reviewId','')::uuid;
 context jsonb;ev jsonb;decl jsonb;snap jsonb;receipt jsonb;ap jsonb;r jsonb;projection jsonb;obs jsonb;binding jsonb;ref jsonb;section jsonb;
 deps uuid[];normal_deps uuid[];identity_deps uuid[];private_deps uuid[];expected_deps uuid[];sid uuid;did uuid;selected_snapshot uuid;
 expiry timestamptz;accepted boolean;evalhash text;expected_hash text;rowhash text;sections jsonb:='[]';sources jsonb:='[]';pub private.part_one_records;
 full_item jsonb;pk text;rev integer;capt_rev integer;declstate text;now_text text;authority private.part_one_review_authorities;
begin
 if not private.part_one_private_enabled(false) then raise exception 'PART_ONE_PRIVATE_RETENTION_DISABLED';end if;
 perform 1 from public.profiles where id=owner and deletion_started_at is null for update;
 if not found then raise exception 'PART_ONE_OWNER_UNAVAILABLE' using errcode='42501';end if;
 select * into c from private.part_one_captures where id=(p_payload->>'captureSessionId')::uuid and owner_id=owner for update;
 if not found then raise exception 'PART_ONE_NOT_FOUND' using errcode='42501';end if;
 select * into s from private.part_one_scans where id=c.scan_id and owner_id=owner for update;
 select * into cm from private.part_one_capture_commits where owner_id=owner and capture_id=c.id and idempotency_key=p_payload->>'idempotencyKey' for update;
 if not found then raise exception 'PART_ONE_NOT_FOUND';end if;
 if cm.deleted_at is not null then raise exception 'PART_ONE_DELETED';end if;
 r:=private.part_one_filter_result(s.result,owner);
 if c.removed_at is not null or c.expires_at<=now() or c.generation<>s.generation or c.deletion_epoch<>s.deletion_epoch
  or cm.package_observation_id<>c.package_observation_id or cm.generation<>c.generation or cm.deletion_epoch<>c.deletion_epoch
  or c.item_id is distinct from nullif(r->>'itemId','')::uuid then
  return jsonb_build_object('conflict',true,'code','stale_capture','result',r);end if;
 -- The final receipt is an exact source-commit/review replay. Return current
 -- rights-filtered result; a timeout does not create another immutable graph.
 if cm.evaluated_hash is not null then
  if cm.evaluated_review_id is distinct from review_id then raise exception 'PART_ONE_IDEMPOTENCY_CONFLICT';end if;
  if p_action='review/apply' and cm.evaluated_hash<>encode(extensions.digest(private.part_one_canonical_json(p_payload->'evaluation'),'sha256'),'hex') then raise exception 'PART_ONE_IDEMPOTENCY_CONFLICT';end if;
  projection:=private.part_one_commit_receipt(cm,c,s);
  if p_action='review/prepare' then return jsonb_build_object('replay',projection);end if;return projection;
 end if;
 if cm.capture_revision<>c.capture_revision then return jsonb_build_object('conflict',true,'code','stale_capture','result',r);end if;
 if p_action='review/prepare' then
  context:=private.part_one_private_context(owner,c,s,cm,review_id);
  update private.part_one_capture_commits set review_context=context where owner_id=owner and idempotency_key=cm.idempotency_key;
  return jsonb_build_object('context',context,'sourceCommitId',cm.source_commit_id,'captureRevision',c.capture_revision,'resultRevision',s.result_revision);
 end if;
 if p_action<>'review/apply' then raise exception 'PART_ONE_UNSUPPORTED_OPERATION';end if;
 if cm.source_commit_id is distinct from (p_payload->>'sourceCommitId')::uuid or c.capture_revision is distinct from (p_payload->>'expectedCaptureRevision')::integer
  or s.result_revision is distinct from (p_payload->>'expectedResultRevision')::integer or cm.review_context is null then
  return jsonb_build_object('conflict',true,'code','stale_capture','result',r);end if;
 context:=cm.review_context;ev:=p_payload->'evaluation';decl:=ev->'declaration';snap:=ev->'packageSnapshot';receipt:=ev->'reviewReceipt';ap:=p_payload->'authorityPolicy';
 select * into cfg from private.part_one_private_config where id=true;
 if ev->>'persistable' is distinct from 'true' or ev->>'acceptancePolicyVersion' is distinct from 'part-one-private-dec-1'
  or jsonb_typeof(decl)<>'object' or jsonb_typeof(ev->'dependencies')<>'array'
  or context->'result'->>'resultRevision' is distinct from r->>'resultRevision' or context->'policy'->>'version' is distinct from cfg.policy_version
  or context->'reviewRequest' is distinct from (case when review_id is null then 'null'::jsonb else jsonb_build_object('reviewId',review_id) end) then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
 did:=(decl->>'declarationId')::uuid;sid:=nullif(snap->>'snapshotId','')::uuid;selected_snapshot:=nullif(context->'result'->>'snapshotId','')::uuid;
 if decl->>'scope' is distinct from 'private_package' or decl->>'ownerId' is distinct from owner::text
  or decl->>'packageObservationId' is distinct from c.package_observation_id::text or decl->>'itemId' is distinct from context->'result'->>'itemId'
  or decl->>'declarationId' is distinct from context->'ids'->>'declarationId' or decl->>'snapshotId' is distinct from snap->>'snapshotId'
  or decl->>'policyId' is distinct from cfg.source_policy_id::text or decl->>'formulaEquivalence' is distinct from 'unknown'
  or decl->>'observedAt' is distinct from context->>'now' then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
 expiry:=(decl->>'expiresAt')::timestamptz;
 if expiry<=now() or expiry>least((context->'policy'->>'expiresAt')::timestamptz,(context->>'now')::timestamptz+interval '24 hours') then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
 select coalesce(array_agg(value::uuid),'{}') into deps from jsonb_array_elements_text(ev->'dependencies');
 select coalesce(array_agg(distinct id),'{}') into expected_deps from (
  select (a->>'evidenceId')::uuid id from jsonb_array_elements(context->'assets') a
  union select (o->>'observationId')::uuid from jsonb_array_elements((context->'observations')||(context->'priorObservations')) o
  union select selected_snapshot where selected_snapshot is not null
  union select (a->>'evidenceId')::uuid from jsonb_array_elements(coalesce(context->'item'->'barcodeAssertions','[]')) a
  union select x.value::uuid from jsonb_each(coalesce(context->'item'->'fieldEvidence','{}')) f,lateral jsonb_array_elements_text(f.value) x
  union select review_id where jsonb_typeof(receipt)='object') expected;
 if not deps @> expected_deps or not expected_deps @> deps or cardinality(deps)<>cardinality(expected_deps) then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
 identity_deps:=case when selected_snapshot is null then '{}'::uuid[] else array[selected_snapshot] end;
 normal_deps:=array(select d from unnest(deps) d where d is distinct from selected_snapshot and d is distinct from review_id and d is distinct from nullif(context->>'supersedesDeclarationId','')::uuid);
 foreach did in array normal_deps loop if not private.part_one_record_allowed(did,owner) then return jsonb_build_object('conflict',true,'code','private_evidence_expired','result',r);end if;end loop;
 did:=(decl->>'declarationId')::uuid;
 if selected_snapshot is not null and not private.part_one_snapshot_identity_allowed(selected_snapshot,owner) then return jsonb_build_object('conflict',true,'code','private_identity_expired','result',r);end if;
 for obs in select value from jsonb_array_elements(context->'assets') loop
  if (obs->>'expiresAt')::timestamptz<expiry then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
 end loop;
 for obs in select value from jsonb_array_elements((context->'observations')||(context->'priorObservations')) loop
  if (obs->>'expiresAt')::timestamptz<expiry then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
 end loop;
 accepted:=ev->'selection'->>'accepted'='true';declstate:=ev->'selection'->>'state';
 if accepted and (declstate<>'accepted' or ev->'selection'->'predicate' @> '{"association":{"passed":true},"noContradiction":{"passed":true},"variantMarket":{"passed":true},"completeness":{"passed":true},"rightsFreshness":{"passed":true}}'::jsonb is not true) then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
 if jsonb_typeof(receipt)='object' then
  select * into authority from private.part_one_review_authorities where policy_id=(receipt->>'authorityPolicyId')::uuid and version=receipt->>'authorityPolicyVersion' and enabled and revoked_at is null and expires_at>now();
  if not found or ap->>'enabled' is distinct from 'true' or ap->>'mode' is distinct from 'synthetic_local_only' or ap->>'policyId' is distinct from authority.policy_id::text
   or ap->>'version' is distinct from authority.version or ap->>'permissionEvidence' is distinct from authority.permission_evidence
   or receipt->>'permissionEvidence' is distinct from authority.permission_evidence or (receipt->>'reviewedAt')::timestamptz>now()
   or (receipt->>'expiresAt')::timestamptz<expiry or authority.expires_at<expiry
   or receipt->>'reviewId' is distinct from review_id::text or receipt->>'ownerId' is distinct from owner::text
   or receipt->>'captureSessionId' is distinct from c.id::text or receipt->>'packageObservationId' is distinct from c.package_observation_id::text
   or (receipt->>'generation')::integer is distinct from c.generation or (receipt->>'deletionEpoch')::integer is distinct from c.deletion_epoch
   or receipt->>'selectedItemId' is distinct from c.item_id::text or receipt->>'selectedSnapshotId' is distinct from selected_snapshot::text then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
  if jsonb_array_length(receipt->'assetBindings')<>jsonb_array_length(context->'assets') or jsonb_array_length(receipt->'observationBindings')<>jsonb_array_length(context->'observations') then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
  for binding in select value from jsonb_array_elements(receipt->'assetBindings') loop
   select value into obs from jsonb_array_elements(context->'assets') where value->>'evidenceId'=binding->>'evidenceId';
   if not found or obs->>'attestationId' is distinct from binding->>'attestationId' or obs->>'storageObjectId' is distinct from binding->>'storageObjectId'
    or obs->>'contentHash' is distinct from binding->>'contentHash' or obs->>'objectVersion' is distinct from binding->>'objectVersion' then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
  end loop;
  for binding in select value from jsonb_array_elements(receipt->'observationBindings') loop
   select value into obs from jsonb_array_elements(context->'observations') where value->>'observationId'=binding->>'observationId' and value->>'revision'=binding->>'revision';
   if not found then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
   expected_hash:=encode(extensions.digest(obs->>'rawText','sha256'),'hex');rowhash:=encode(extensions.digest(private.part_one_canonical_json(obs),'sha256'),'hex');
   if expected_hash is distinct from binding->>'textHash' or rowhash is distinct from binding->>'recordHash' then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
  end loop;
  for ref in select value from jsonb_array_elements((receipt->'packageIdentity'->'evidenceRefs')||(receipt->'categoryRefs')||(receipt->'marketRefs'))
    union all select x.value from jsonb_each(receipt->'variantRefs') f,lateral jsonb_array_elements(f.value) x
    union all select x.value from jsonb_array_elements(receipt->'sections') sec,lateral jsonb_array_elements(sec->'lineRefs') x loop
   select value into obs from jsonb_array_elements(context->'observations') where value->>'observationId'=ref->>'observationId' and value->>'revision'=ref->>'revision';
   if not found or private.part_one_js_slice(obs->>'rawText',(ref->>'start')::integer,(ref->>'end')::integer) is distinct from ref->>'text'
    or not obs->'assetEvidenceIds' @> jsonb_build_array(ref->>'assetEvidenceId') then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
  end loop;
  if accepted and (receipt->>'category'='unknown' or receipt->>'packageMarket' is null or private.part_one_code_key(receipt->'packageIdentity'->'code') is distinct from private.part_one_code_key(s.request->'code')
   or jsonb_array_length(receipt->'sections')=0 or exists(select 1 from jsonb_array_elements(receipt->'sections') sec where sec->>'startCovered' is distinct from 'true' or sec->>'endCovered' is distinct from 'true' or sec->>'lineCoverageComplete' is distinct from 'true')) then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
  insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,owner_id,scope,payload,dependencies,identity_dependencies,observed_at,expires_at)
   values(review_id,'observation',c.item_id,1,private.part_one_code_key(s.request->'code'),'private_capture',cfg.policy_version,owner,'private_package',
    receipt||jsonb_build_object('privateKind','approved_review','policyId',cfg.source_policy_id),normal_deps,identity_deps,now(),expiry);
  insert into private.part_one_record_status(record_id) values(review_id);
  normal_deps:=array_append(normal_deps,review_id);
 elsif accepted then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
 if jsonb_typeof(snap)='object' then
  if snap->>'snapshotId' is distinct from context->'ids'->>'snapshotId' or snap->>'scope' is distinct from 'private_package' or snap->>'itemId' is distinct from c.item_id::text
   or snap->>'supersedesId' is distinct from selected_snapshot::text then raise exception 'PART_ONE_INVALID_PRIVATE_REVIEW';end if;
  select * into pub from private.part_one_records where id=selected_snapshot;
  if pub.payload->>'privateKind'='package_snapshot' then pk:=pub.payload->>'publicSnapshotId';else pk:=pub.id::text;end if;
  -- Independent package revision counters cannot collide with another owner's
  -- private package. Public catalog revisions retain their original unique key.
  rev:=(snap->>'revision')::integer;
  projection:=jsonb_build_object('itemId',c.item_id,'name',snap->'name','brand',snap->'variant'->'brand','variantText',pub.payload->'variantText','image',null,
    'declarationIds',jsonb_build_array(did),'fullItem',snap,'fieldEvidence',snap->'fieldEvidence','barcodeAssertions',snap->'barcodeAssertions',
    'requestedMarket',snap->'requestedMarket','packageMarket',snap->'packageMarket','sourceMarkets',snap->'sourceMarkets','privateKind','package_snapshot',
    'captureSessionId',c.id,'packageObservationId',c.package_observation_id,'generation',c.generation,'deletionEpoch',c.deletion_epoch,'publicSnapshotId',pk);
  insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,owner_id,scope,payload,dependencies,identity_dependencies,supersedes_id,observed_at,expires_at)
   values(sid,'snapshot',c.item_id,rev,private.part_one_code_key(s.request->'code'),'private_capture',cfg.policy_version,owner,'private_package',projection,
    array_append(normal_deps,did),identity_deps,selected_snapshot,now(),expiry);
  insert into private.part_one_record_status(record_id) values(sid);
 end if;
 for section in select value from jsonb_array_elements(decl->'sections') loop
  sections:=sections||jsonb_build_array(jsonb_build_object('sectionId',section->'sectionId','kind',section->'kind','text',section->'rawText',
    'evidenceIds',decl->'observationIds','policyId',cfg.source_policy_id,'observedAt',decl->'observedAt','expiresAt',decl->'expiresAt'));
 end loop;
 for obs in select value from jsonb_array_elements(context->'observations') loop
  sources:=sources||jsonb_build_array(jsonb_build_object('observationId',obs->'observationId','policyId',cfg.source_policy_id,'label',
    case when obs->>'kind'='ocr' then 'Private on-device OCR' else 'Private attributed correction' end,'url',null,'observedAt',obs->'observedAt','sourceUpdatedAt',null,'expiresAt',decl->'expiresAt'));
 end loop;
 insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,owner_id,scope,payload,dependencies,identity_dependencies,supersedes_id,observed_at,expires_at)
  values(did,'declaration',c.item_id,(decl->>'revision')::integer,private.part_one_code_key(s.request->'code'),'private_capture',cfg.policy_version,owner,'private_package',
   decl||jsonb_build_object('structuredSections',decl->'sections','sections',sections,'sources',sources,'predicate',ev->'selection'->'predicate','state',declstate,
    'privateKind','declaration','captureSessionId',c.id,'generation',c.generation,'deletionEpoch',c.deletion_epoch),normal_deps,identity_deps,
    nullif(decl->>'supersedesId','')::uuid,(decl->>'observedAt')::timestamptz,expiry);
 insert into private.part_one_record_status(record_id) values(did);
 r:=r||jsonb_build_object('snapshotId',coalesce(sid,selected_snapshot),'declarationId',did,'declarationState',declstate,'scope','private_package',
  'packageConfirmation',case when accepted then 'photo_supported' else r->>'packageConfirmation' end,'evidenceIds',to_jsonb(deps),'conflictIds',decl->'conflictIds','reasonCodes',ev->'reasonCodes',
  'allowedActions',case when accepted then jsonb_build_array('save','add_photo','rescan','remove_draft') when c.item_id is null then jsonb_build_array('add_photo','rescan','remove_draft') else jsonb_build_array('save_partial','add_photo','rescan','remove_draft') end,
  'resultRevision',s.result_revision+1,'freshness',jsonb_build_object('observedAt',decl->'observedAt','expiresAt',decl->'expiresAt','state','fresh'));
 r:=jsonb_set(r,'{display,sections}',sections);r:=jsonb_set(r,'{display,sources}',sources);r:=jsonb_set(r,'{display,resultRevision}',r->'resultRevision');
 r:=jsonb_set(r,'{display,limitations}',case when accepted then '[]'::jsonb else jsonb_build_array('Private reviewed source remains incomplete or uncertain') end);
 r:=private.part_one_filter_result(r,owner);
 update private.part_one_scans set result=r,result_revision=s.result_revision+1,binding_revision=binding_revision+1 where id=s.id returning * into s;
 update private.part_one_captures set capture_revision=capture_revision+1 where id=c.id returning * into c;
 evalhash:=encode(extensions.digest(private.part_one_canonical_json(ev),'sha256'),'hex');
 update private.part_one_capture_commits set capture_revision=c.capture_revision,bound_result=r,declaration_ids=array[did],review_receipt_id=case when jsonb_typeof(receipt)='object' then review_id else null end,
  evaluated_hash=evalhash,evaluated_review_id=review_id,review_context=null where owner_id=owner and idempotency_key=cm.idempotency_key returning * into cm;
 if jsonb_typeof(receipt)='object' then
  insert into private.part_one_private_reviews(review_id,owner_id,capture_id,source_commit_id,request_hash,authority_policy_id,authority_policy_version,payload,expires_at,snapshot_id,declaration_id,review_record_id)
   values(review_id,owner,c.id,cm.source_commit_id,cm.request_hash,authority.policy_id,authority.version,receipt,expiry,sid,did,review_id);
 end if;
 return private.part_one_commit_receipt(cm,c,s);
end $$;
revoke all on function private.part_one_commit_receipt(private.part_one_capture_commits,private.part_one_captures,private.part_one_scans),private.part_one_js_slice(text,integer,integer),private.part_one_review_operation(text,jsonb) from public,anon,authenticated;

create function public.part_one_private_service(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare ut private.part_one_upload_tickets; c private.part_one_captures; s private.part_one_scans; cfg private.part_one_private_config;
 o storage.objects; aa private.part_one_asset_attestations; job private.part_one_private_cleanup; id uuid; valid boolean; expiry timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(40203);
 if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>524288 then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
 if p_action in ('review/prepare','review/apply') then return private.part_one_review_operation(p_action,p_payload);end if;
 if p_action='cleanup/heartbeat' then
  if length(p_payload->>'consumerVersion') not between 1 and 200 then raise exception 'PART_ONE_INVALID_PAYLOAD'; end if;
  insert into private.part_one_private_consumer(id,consumer_version,heartbeat_at) values(true,p_payload->>'consumerVersion',now())
   on conflict(id) do update set consumer_version=excluded.consumer_version,heartbeat_at=excluded.heartbeat_at;
  return jsonb_build_object('live',true);
 end if;
 if p_action in ('upload/dispatch','upload/attest','upload/abort') then
  select * into ut from private.part_one_upload_tickets where id=(p_payload->>'ticketId')::uuid for update;
  if not found then raise exception 'PART_ONE_NOT_FOUND'; end if;
  if ut.owner_id is distinct from nullif(p_payload->>'ownerId','')::uuid then
   perform private.part_one_queue_ticket(ut.id,'upload_owner_removed');return jsonb_build_object('conflict',true,'code','upload_cancelled');
  end if;
  if p_action='upload/abort' then
   perform private.part_one_queue_ticket(ut.id,'upload_outcome_unknown');return jsonb_build_object('queued',true);
  end if;
  perform 1 from public.profiles where id=ut.owner_id and deletion_started_at is null for update;
  valid:=found;
  select * into c from private.part_one_captures where id=ut.capture_id and owner_id=ut.owner_id for update;
  select * into s from private.part_one_scans where id=ut.scan_id and owner_id=ut.owner_id for update;
  select * into cfg from private.part_one_private_config where id=true;
  valid:=valid and c.id is not null and s.id is not null and c.removed_at is null and c.expires_at>now() and ut.expires_at>now()
   and ut.generation=c.generation and c.generation=s.generation and ut.deletion_epoch=c.deletion_epoch and c.deletion_epoch=s.deletion_epoch
   and ut.result_revision=s.result_revision and ut.capture_revision=c.capture_revision and ut.package_observation_id=c.package_observation_id
   and c.item_id is not distinct from nullif(private.part_one_filter_result(s.result,ut.owner_id)->>'itemId','')::uuid
   and private.part_one_private_enabled(true) and ut.policy_version=cfg.policy_version and ut.bucket_id=cfg.bucket_id;
  if not valid or ut.state not in ('reserved','dispatched','attested') then
   perform private.part_one_queue_ticket(ut.id,'upload_binding_or_policy_changed');return jsonb_build_object('conflict',true,'code','stale_capture');
  end if;
  if p_action='upload/dispatch' then
   if ut.state<>'reserved' then return jsonb_build_object('allowed',false); end if;
   update private.part_one_upload_tickets set state='dispatched' where id=ut.id;
   return jsonb_build_object('allowed',true);
  end if;
  if ut.state='attested' then return private.part_one_upload_receipt(ut); end if;
  select * into o from storage.objects where bucket_id=ut.bucket_id and name=ut.object_name for update;
  if not found or o.owner_id is not null or o.version is null or o.archived_at is not null or coalesce(o.is_delete_marker,false)
   or coalesce((o.metadata->>'size')::integer,-1)<>ut.byte_length or p_payload->>'contentHash' is distinct from ut.content_hash
   or (p_payload->>'width')::integer is distinct from ut.width or (p_payload->>'height')::integer is distinct from ut.height
   or (p_payload->>'byteLength')::integer is distinct from ut.byte_length or p_payload->>'sanitizerVersion' is distinct from 'part-one-jpeg-verified-1' then
   perform private.part_one_queue_ticket(ut.id,'upload_storage_or_attestation_mismatch');return jsonb_build_object('conflict',true,'code','upload_verification_failed');
  end if;
  expiry:=least(now()+make_interval(secs=>cfg.retention_seconds),cfg.expires_at,(select expires_at from private.part_one_policies where id='private_capture'));
  insert into private.part_one_asset_attestations(owner_id,capture_id,package_observation_id,generation,deletion_epoch,storage_object_id,upload_ticket_id,object_version,
   content_hash,width,height,sanitizer_version,verification_evidence,metadata_stripped,observed_at,expires_at)
   values(ut.owner_id,c.id,c.package_observation_id,c.generation,c.deletion_epoch,o.id,ut.id,o.version,ut.content_hash,ut.width,ut.height,
    'part-one-jpeg-verified-1','Server bounded actual JPEG decode; metadata marker allowlist; SHA-256 verified stream; immutable opaque service upload',true,now(),expiry) returning * into aa;
  update private.part_one_upload_tickets set state='attested',object_id=o.id,object_version=o.version,attestation_id=aa.id where id=ut.id returning * into ut;
  return private.part_one_upload_receipt(ut);
 end if;
 if p_action in ('storage/inspect','storage/sign-authorize','storage/delete-authorize') then
  if not exists(select 1 from private.part_one_upload_tickets where bucket_id=p_payload->>'bucketId' and object_name=p_payload->>'objectName')
   and not exists(select 1 from private.part_one_private_cleanup where bucket_id=p_payload->>'bucketId' and object_name=p_payload->>'objectName') then raise exception 'PART_ONE_NOT_FOUND'; end if;
  select * into o from storage.objects where bucket_id=p_payload->>'bucketId' and name=p_payload->>'objectName' for update;
  if p_action='storage/inspect' then
   if not found then return null; end if;
   return jsonb_build_object('id',o.id,'version',o.version,'size',coalesce((o.metadata->>'size')::integer,0));
  end if;
  if p_action='storage/delete-authorize' then
   if not found then return jsonb_build_object('allowed',false,'absent',true); end if;
   return jsonb_build_object('allowed',o.id is not distinct from (p_payload->>'objectId')::uuid and o.version is not distinct from p_payload->>'objectVersion'
    and exists(select 1 from private.part_one_private_cleanup q where q.object_id=o.id and q.object_version=o.version and q.state='running' and q.lease_expires_at>now()));
  end if;
  if not found then return jsonb_build_object('allowed',false); end if;
  select * into ut from private.part_one_upload_tickets where object_id=o.id and object_version=o.version and bucket_id=o.bucket_id and object_name=o.name and state='attested';
  select * into aa from private.part_one_asset_attestations where id=ut.attestation_id and upload_ticket_id=ut.id and owner_id=ut.owner_id;
  valid:=ut.id is not null and aa.id is not null and aa.expires_at>now() and private.part_one_private_enabled(false)
   and exists(select 1 from public.profiles where id=ut.owner_id and deletion_started_at is null)
   and not exists(select 1 from private.part_one_asset_status where attestation_id=aa.id and revoked_at is not null)
   and exists(select 1 from private.part_one_captures cc where cc.id=ut.capture_id and cc.owner_id=ut.owner_id and cc.package_observation_id=ut.package_observation_id
    and (cc.removed_at is null or exists(select 1 from private.part_one_capture_commits cm where cm.capture_id=cc.id and cm.deleted_at is null)));
  return jsonb_build_object('allowed',valid,'maxSeconds',greatest(0,least(60,floor(extract(epoch from aa.expires_at-now()))::integer)));
 end if;
 if p_action='cleanup/claim' then
  perform private.part_one_purge_expired_private();
  for ut in select * from private.part_one_upload_tickets where state in ('reserved','dispatched','unknown') and expires_at<=now()
   or state='cancelled' loop perform private.part_one_queue_ticket(ut.id,'cancelled_or_expired_upload'); end loop;
  select * into job from private.part_one_private_cleanup where (state='queued' or state='running' and lease_expires_at<=now()) and next_eligible_at<=now()
   order by due_at,created_at for update skip locked limit 1;
  if not found then return jsonb_build_object('claim',null); end if;
  update private.part_one_private_cleanup set state='running',lease_token=gen_random_uuid(),lease_expires_at=now()+interval '30 seconds',attempts=attempts+1
   where object_id=job.object_id returning * into job;
  return jsonb_build_object('claim',jsonb_build_object('objectId',job.object_id,'bucketId',job.bucket_id,'objectName',job.object_name,'objectVersion',job.object_version,
   'leaseToken',job.lease_token,'expiresAt',job.lease_expires_at));
 end if;
 if p_action in ('cleanup/dispatch','cleanup/ack','cleanup/retry','cleanup/blocked') then
  select * into job from private.part_one_private_cleanup where object_id=(p_payload->>'objectId')::uuid for update;
  if not found then return jsonb_build_object('deleted',not exists(select 1 from storage.objects where id=(p_payload->>'objectId')::uuid)); end if;
  if job.state='deleted' then return jsonb_build_object('deleted',true); end if;
  if job.state<>'running' or job.lease_token is distinct from (p_payload->>'leaseToken')::uuid or job.lease_expires_at<=now() then return jsonb_build_object('allowed',false,'deleted',false); end if;
  if p_action='cleanup/dispatch' then return jsonb_build_object('allowed',true); end if;
  if p_action='cleanup/ack' then
   if exists(select 1 from storage.objects where bucket_id=job.bucket_id and name=job.object_name) then return jsonb_build_object('deleted',false); end if;
   update private.part_one_private_cleanup set state='deleted',deleted_at=now(),lease_token=null,lease_expires_at=null where object_id=job.object_id;
   update private.part_one_upload_tickets set state='deleted',owner_id=null,capture_id=null,scan_id=null,package_observation_id=null,content_hash=null
    where object_id=job.object_id or bucket_id=job.bucket_id and object_name=job.object_name;
   perform private.part_one_purge_expired_private();return jsonb_build_object('deleted',true);
  end if;
  update private.part_one_private_cleanup set state=case when p_action='cleanup/blocked' then 'blocked' else 'queued' end,
   lease_token=null,lease_expires_at=null,next_eligible_at=now()+make_interval(secs=>least(3600,power(2,least(attempts,10))::integer)) where object_id=job.object_id;
  return jsonb_build_object('queued',p_action<>'cleanup/blocked','blocked',p_action='cleanup/blocked');
 end if;
 raise exception 'PART_ONE_UNSUPPORTED_OPERATION';
end $$;
revoke all on function public.part_one_private_service(text,jsonb) from public,anon,authenticated;
grant execute on function public.part_one_private_service(text,jsonb) to service_role;

revoke all on function private.part_one_saved_capture(private.part_one_saves,uuid),private.part_one_observation_projection(private.part_one_records),private.part_one_recover_capture(uuid,uuid) from public,anon,authenticated;

revoke all on function private.part_one_utc(timestamptz),private.part_one_canonical_json(jsonb),private.part_one_private_context(uuid,private.part_one_captures,private.part_one_scans,private.part_one_capture_commits,uuid) from public,anon,authenticated;
