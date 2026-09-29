-- One evidence continuation per Check attempt. Both S6 cases and their truth
-- snapshots remain immutable; this table only records their relationship.
create table public.product_resolution_continuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  root_case_id uuid not null unique references public.product_resolution_cases(id) on delete cascade,
  child_case_id uuid not null unique references public.product_resolution_cases(id) on delete cascade,
  parent_snapshot_id uuid not null references public.product_truth_snapshots(id) on delete cascade,
  request_id uuid not null,
  evidence_fingerprint text not null check (evidence_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (user_id, request_id),
  check (root_case_id <> child_case_id)
);
create index product_resolution_continuations_owner_idx
  on public.product_resolution_continuations(user_id, created_at desc);
alter table public.product_resolution_continuations enable row level security;
revoke all on public.product_resolution_continuations from public, anon, authenticated;
grant select, insert, delete on public.product_resolution_continuations to service_role;
create trigger product_resolution_continuations_no_update
  before update on public.product_resolution_continuations
  for each row execute function private.reject_immutable_snapshot_update();

-- A service-only, atomic reservation prevents competing evidence submissions
-- from branching one root attempt. The caller may not choose an owner, root
-- revision, selected catalog IDs, or a prebuilt truth snapshot.
create or replace function public.record_product_resolution_continuation(
  p_user_id uuid,
  p_root_case_id uuid,
  p_parent_snapshot_id uuid,
  p_request_id uuid,
  p_evidence_fingerprint text,
  p_resolution_state text,
  p_next_action text,
  p_product_id uuid,
  p_variant_id uuid,
  p_formula_version_id uuid,
  p_conflicts jsonb,
  p_evidence jsonb,
  p_candidates jsonb
) returns public.product_resolution_cases
language plpgsql security invoker set search_path = '' as $$
declare
  root_case public.product_resolution_cases;
  parent_snapshot public.product_truth_snapshots;
  existing public.product_resolution_continuations;
  child public.product_resolution_cases;
begin
  if p_user_id is null or p_root_case_id is null or p_parent_snapshot_id is null
    or p_request_id is null or p_evidence_fingerprint is null
    or p_evidence_fingerprint !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_conflicts) is distinct from 'array' then
    raise exception 'INVALID_CONTINUATION' using errcode = '23514';
  end if;
  select * into root_case from public.product_resolution_cases
    where id = p_root_case_id and user_id = p_user_id and consumer = 'scan' for update;
  if not found then raise exception 'CHECK_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into existing from public.product_resolution_continuations
    where root_case_id = root_case.id;
  if found then
    if existing.request_id <> p_request_id or existing.parent_snapshot_id <> p_parent_snapshot_id
      or existing.evidence_fingerprint <> p_evidence_fingerprint then
      raise exception 'CONTINUATION_CONFLICT' using errcode = '23505';
    end if;
    select * into child from public.product_resolution_cases
      where id = existing.child_case_id and user_id = p_user_id;
    return child;
  end if;
  select * into parent_snapshot from public.product_truth_snapshots
    where id = p_parent_snapshot_id and case_id = root_case.id and user_id = p_user_id
      and case_revision = root_case.truth_revision;
  if not found then raise exception 'PARENT_SNAPSHOT_CONFLICT' using errcode = '23514'; end if;
  if root_case.resolution_state <> 'identified_formula_unverified'
    or root_case.next_action <> 'photograph_ingredients'
    or root_case.product_id is null or root_case.variant_id is null
    or root_case.requires_founder_review
    or jsonb_array_length(coalesce(root_case.evidence_snapshot->'conflicts','[]'::jsonb)) > 0
    or exists (select 1 from public.product_resolution_evidence
      where case_id = root_case.id and user_id = p_user_id
        and evidence_type = 'ingredients' and extracted_text is not null) then
    raise exception 'CHECK_NOT_ELIGIBLE_FOR_INGREDIENTS' using errcode = '23514';
  end if;
  if p_product_id is distinct from root_case.product_id
    or p_variant_id is distinct from root_case.variant_id
    or p_resolution_state not in ('identified_formula_unverified', 'verified_product_formula')
    or (p_resolution_state = 'identified_formula_unverified' and p_formula_version_id is not null)
    or (p_resolution_state = 'verified_product_formula' and p_formula_version_id is null) then
    raise exception 'CONTINUATION_IDENTITY_CONFLICT' using errcode = '23514';
  end if;
  -- Existing record_product_resolution is the sole S6 writer for child evidence.
  child := public.record_product_resolution(
    p_user_id, p_request_id, 'scan', p_resolution_state, p_next_action, false,
    p_product_id, p_variant_id, p_formula_version_id,
    jsonb_build_object('requestFingerprint',p_evidence_fingerprint,
      'rootCaseId',root_case.id,'parentSnapshotId',parent_snapshot.id,
      'conflicts',p_conflicts,'hasIngredientList',exists (
        select 1 from jsonb_array_elements(p_evidence) as item(value)
        where value->>'evidence_type' = 'ingredients'
          and nullif(value->>'extracted_text','') is not null)),
    p_evidence, p_candidates
  );
  if child.evidence_snapshot->>'rootCaseId' is distinct from root_case.id::text
    or child.evidence_snapshot->>'parentSnapshotId' is distinct from parent_snapshot.id::text
    or child.evidence_snapshot->>'requestFingerprint' is distinct from p_evidence_fingerprint then
    raise exception 'CONTINUATION_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  insert into public.product_resolution_continuations
    (user_id, root_case_id, child_case_id, parent_snapshot_id, request_id, evidence_fingerprint)
  values (p_user_id, root_case.id, child.id, parent_snapshot.id, p_request_id, p_evidence_fingerprint);
  return child;
end;
$$;
revoke all on function public.record_product_resolution_continuation(
  uuid,uuid,uuid,uuid,text,text,text,uuid,uuid,uuid,jsonb,jsonb,jsonb
) from public, anon, authenticated;
grant execute on function public.record_product_resolution_continuation(
  uuid,uuid,uuid,uuid,text,text,text,uuid,uuid,uuid,jsonb,jsonb,jsonb
) to service_role;

-- Explicit My Stuff saves remain opt-in, but two saved rows cannot represent
-- the original and continuation as separate checks. No daily quota exists yet.
alter table public.free_check_history add column attempt_case_id uuid
  references public.product_resolution_cases(id) on delete set null;
-- Preserve any historical duplicate saves rather than deleting customer data.
with first_save as (
  select id, row_number() over (partition by user_id, resolution_case_id order by checked_at, id) as rank
  from public.free_check_history where resolution_case_id is not null
)
update public.free_check_history as history set attempt_case_id = history.resolution_case_id
  from first_save where history.id = first_save.id and first_save.rank = 1;
create unique index free_check_history_one_save_per_attempt
  on public.free_check_history(user_id, attempt_case_id)
  where attempt_case_id is not null;
create or replace function private.bind_free_check_attempt()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.resolution_case_id is null then
    new.attempt_case_id := null;
  else
    select coalesce((select root_case_id from public.product_resolution_continuations
      where child_case_id = new.resolution_case_id and user_id = new.user_id), new.resolution_case_id)
      into new.attempt_case_id;
  end if;
  return new;
end;
$$;
revoke all on function private.bind_free_check_attempt() from public, anon, authenticated;
create trigger free_check_history_bind_attempt before insert or update on public.free_check_history
  for each row execute function private.bind_free_check_attempt();
