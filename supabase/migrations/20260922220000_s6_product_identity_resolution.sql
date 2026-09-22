-- ============================================================================
-- Derive S6: one provenance-preserving Product Identity Resolver for Scan/Shelf
--
-- This migration is additive. Visual/OCR/model resemblance remains candidate
-- evidence. Only explicit authoritative identifier and formula provenance may
-- become verified catalog truth.
-- ============================================================================

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_name text not null default 'Standard',
  region_code text,
  package_size text,
  packaging_markers text[] not null default '{}',
  lifecycle_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_name_check check (length(trim(variant_name)) between 1 and 180),
  constraint product_variants_region_check check (region_code is null or region_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,8})?$'),
  constraint product_variants_size_check check (package_size is null or length(trim(package_size)) between 1 and 80),
  constraint product_variants_status_check check (lifecycle_status in ('active', 'discontinued'))
);

create unique index product_variants_identity_idx
  on public.product_variants (
    product_id,
    lower(trim(variant_name)),
    coalesce(region_code, ''),
    coalesce(lower(trim(package_size)), '')
  );
create index product_variants_product_idx on public.product_variants (product_id);

create table public.product_formula_versions (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid references public.product_variants(id) on delete restrict,
  ingredients text[] not null,
  normalized_ingredient_fingerprint text not null,
  region_code text,
  packaging_markers text[] not null default '{}',
  provenance_type text not null,
  source_reference text not null,
  observed_at timestamptz not null,
  verification_status text not null default 'provisional',
  supersedes_id uuid references public.product_formula_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint product_formula_versions_ingredients_check check (cardinality(ingredients) between 1 and 300),
  constraint product_formula_versions_fingerprint_check check (length(normalized_ingredient_fingerprint) between 1 and 30000),
  constraint product_formula_versions_region_check check (region_code is null or region_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,8})?$'),
  constraint product_formula_versions_provenance_check check (provenance_type in ('manufacturer', 'package_label', 'regulator', 'founder_review', 'member_photo')),
  constraint product_formula_versions_source_check check (length(trim(source_reference)) between 1 and 1000),
  constraint product_formula_versions_status_check check (verification_status in ('provisional', 'verified', 'rejected', 'superseded')),
  constraint product_formula_versions_verified_provenance_check check (
    verification_status <> 'verified'
    or provenance_type in ('manufacturer', 'package_label', 'regulator', 'founder_review')
  ),
  constraint product_formula_versions_not_self_superseding_check check (supersedes_id is null or supersedes_id <> id)
);

create index product_formula_versions_variant_observed_idx
  on public.product_formula_versions (variant_id, observed_at desc);
create index product_formula_versions_fingerprint_idx
  on public.product_formula_versions (normalized_ingredient_fingerprint)
  where verification_status = 'verified';

create table public.product_identifiers (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  formula_version_id uuid references public.product_formula_versions(id) on delete restrict,
  identifier_type text not null,
  identifier_value text not null,
  source_authority text not null,
  source_reference text not null,
  observed_at timestamptz not null default now(),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint product_identifiers_type_check check (identifier_type in ('gtin_8', 'gtin_12', 'gtin_13', 'gtin_14', 'manufacturer_sku')),
  constraint product_identifiers_value_check check (
    (identifier_type = 'gtin_8' and identifier_value ~ '^[0-9]{8}$')
    or (identifier_type = 'gtin_12' and identifier_value ~ '^[0-9]{12}$')
    or (identifier_type = 'gtin_13' and identifier_value ~ '^[0-9]{13}$')
    or (identifier_type = 'gtin_14' and identifier_value ~ '^[0-9]{14}$')
    or (identifier_type = 'manufacturer_sku' and length(trim(identifier_value)) between 1 and 120)
  ),
  constraint product_identifiers_authority_check check (source_authority in ('manufacturer', 'gs1', 'founder', 'retailer', 'member')),
  constraint product_identifiers_source_check check (length(trim(source_reference)) between 1 and 1000),
  constraint product_identifiers_verified_authority_check check (
    verified_at is null or source_authority in ('manufacturer', 'gs1', 'founder')
  )
);

-- One GTIN can survive a reformulation. Preserve each observed linkage instead
-- of overwriting it; multiple current formula links intentionally resolve as
-- formula-unverified until package/ingredient evidence disambiguates them.
create unique index product_identifiers_identity_version_idx
  on public.product_identifiers (
    identifier_type, identifier_value, variant_id, formula_version_id
  ) nulls not distinct;
create index product_identifiers_variant_idx on public.product_identifiers (variant_id);

create or replace function private.validate_product_identifier_formula()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.formula_version_id is not null and not exists (
    select 1 from public.product_formula_versions
    where id = new.formula_version_id and variant_id = new.variant_id
  ) then
    raise exception 'IDENTIFIER_FORMULA_VARIANT_MISMATCH';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_product_identifier_formula() from public, anon, authenticated;
drop trigger if exists product_identifiers_validate_formula on public.product_identifiers;
create trigger product_identifiers_validate_formula
  before insert or update on public.product_identifiers
  for each row execute function private.validate_product_identifier_formula();

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function private.set_updated_at();

drop trigger if exists product_formula_versions_reject_update on public.product_formula_versions;
create trigger product_formula_versions_reject_update
  before update on public.product_formula_versions
  for each row execute function private.reject_immutable_snapshot_update();

drop trigger if exists product_identifiers_reject_update on public.product_identifiers;
create trigger product_identifiers_reject_update
  before update on public.product_identifiers
  for each row execute function private.reject_immutable_snapshot_update();

create table public.product_resolution_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  consumer text not null,
  resolution_state text not null,
  product_id uuid references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  formula_version_id uuid references public.product_formula_versions(id) on delete restrict,
  next_action text not null,
  requires_founder_review boolean not null default false,
  review_status text not null default 'not_needed',
  evidence_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint product_resolution_cases_request_unique unique (user_id, request_id),
  constraint product_resolution_cases_consumer_check check (consumer in ('scan', 'shelf')),
  constraint product_resolution_cases_state_check check (resolution_state in (
    'verified_product_formula', 'identified_formula_unverified', 'ambiguous_candidates',
    'formula_only', 'insufficient_evidence'
  )),
  constraint product_resolution_cases_action_check check (next_action in (
    'evaluate_product_fit', 'confirm_variant', 'photograph_ingredients', 'choose_candidate', 'manual_review'
  )),
  constraint product_resolution_cases_review_check check (review_status in ('not_needed', 'pending', 'resolved', 'dismissed')),
  constraint product_resolution_cases_evidence_object_check check (jsonb_typeof(evidence_snapshot) = 'object'),
  constraint product_resolution_cases_review_consistency_check check (
    (requires_founder_review and review_status in ('pending', 'resolved', 'dismissed'))
    or (not requires_founder_review and review_status = 'not_needed')
  ),
  constraint product_resolution_cases_state_payload_check check (
    (resolution_state = 'verified_product_formula'
      and product_id is not null and variant_id is not null and formula_version_id is not null)
    or (resolution_state = 'identified_formula_unverified'
      and product_id is not null and formula_version_id is null)
    or (resolution_state = 'formula_only'
      and product_id is null and variant_id is null and formula_version_id is not null)
    or (resolution_state in ('ambiguous_candidates', 'insufficient_evidence')
      and product_id is null and variant_id is null and formula_version_id is null)
  )
);

create index product_resolution_cases_user_created_idx
  on public.product_resolution_cases (user_id, created_at desc);
create index product_resolution_cases_review_idx
  on public.product_resolution_cases (review_status, created_at)
  where requires_founder_review;

create or replace function private.validate_product_resolution_selection()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.variant_id is not null and not exists (
    select 1 from public.product_variants
    where id = new.variant_id and product_id = new.product_id
  ) then raise exception 'PRODUCT_VARIANT_MISMATCH'; end if;
  if new.formula_version_id is not null and new.variant_id is not null and not exists (
    select 1 from public.product_formula_versions
    where id = new.formula_version_id and variant_id = new.variant_id
  ) then raise exception 'FORMULA_VARIANT_MISMATCH'; end if;
  if new.resolution_state = 'verified_product_formula' and not exists (
    select 1 from public.product_formula_versions
    where id = new.formula_version_id and verification_status = 'verified'
  ) then raise exception 'VERIFIED_RESOLUTION_REQUIRES_VERIFIED_FORMULA'; end if;
  return new;
end;
$$;

revoke all on function private.validate_product_resolution_selection() from public, anon, authenticated;
drop trigger if exists product_resolution_cases_validate_selection on public.product_resolution_cases;
create trigger product_resolution_cases_validate_selection
  before insert or update on public.product_resolution_cases
  for each row execute function private.validate_product_resolution_selection();

create table public.product_resolution_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.product_resolution_cases(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  evidence_type text not null,
  source_type text not null,
  storage_path text,
  extracted_text text,
  created_at timestamptz not null default now(),
  constraint product_resolution_evidence_type_check check (evidence_type in (
    'barcode', 'typed_identity', 'front_label', 'ingredients', 'packaging'
  )),
  constraint product_resolution_evidence_source_check check (source_type in (
    'device_barcode', 'member_input', 'trusted_ocr', 'founder_review'
  )),
  constraint product_resolution_evidence_path_check check (
    storage_path is null or storage_path like user_id::text || '/%'
  ),
  constraint product_resolution_evidence_content_check check (
    storage_path is not null or nullif(trim(coalesce(extracted_text, '')), '') is not null
  ),
  constraint product_resolution_evidence_text_check check (
    extracted_text is null or length(extracted_text) <= 30000
  )
);

create index product_resolution_evidence_case_idx on public.product_resolution_evidence (case_id);
create index product_resolution_evidence_user_idx on public.product_resolution_evidence (user_id, created_at desc);

create or replace function private.validate_product_resolution_evidence_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.product_resolution_cases
    where id = new.case_id and user_id = new.user_id
  ) then
    raise exception 'RESOLUTION_EVIDENCE_OWNER_MISMATCH';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_product_resolution_evidence_owner() from public, anon, authenticated;
drop trigger if exists product_resolution_evidence_validate_owner on public.product_resolution_evidence;
create trigger product_resolution_evidence_validate_owner
  before insert on public.product_resolution_evidence
  for each row execute function private.validate_product_resolution_evidence_owner();

create table public.product_resolution_candidates (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.product_resolution_cases(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  formula_version_id uuid references public.product_formula_versions(id) on delete restrict,
  rank_order integer not null,
  candidate_basis text not null,
  match_reasons text[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint product_resolution_candidates_rank_check check (rank_order between 1 and 8),
  constraint product_resolution_candidates_basis_check check (candidate_basis in (
    'authoritative_identifier', 'exact_typed_identity', 'label_text',
    'ingredient_fingerprint', 'packaging', 'combined_candidate_evidence'
  )),
  constraint product_resolution_candidates_target_check check (
    product_id is not null or variant_id is not null or formula_version_id is not null
  ),
  constraint product_resolution_candidates_unique_rank unique (case_id, rank_order)
);

create index product_resolution_candidates_case_idx on public.product_resolution_candidates (case_id, rank_order);

create or replace function private.validate_product_resolution_candidate_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.product_resolution_cases
    where id = new.case_id and user_id = new.user_id
  ) then
    raise exception 'RESOLUTION_CANDIDATE_OWNER_MISMATCH';
  end if;
  if new.variant_id is not null and new.product_id is not null and not exists (
    select 1 from public.product_variants
    where id = new.variant_id and product_id = new.product_id
  ) then raise exception 'RESOLUTION_CANDIDATE_PRODUCT_VARIANT_MISMATCH'; end if;
  if new.formula_version_id is not null and new.variant_id is not null and not exists (
    select 1 from public.product_formula_versions
    where id = new.formula_version_id and variant_id = new.variant_id
  ) then raise exception 'RESOLUTION_CANDIDATE_FORMULA_VARIANT_MISMATCH'; end if;
  return new;
end;
$$;

revoke all on function private.validate_product_resolution_candidate_owner() from public, anon, authenticated;
drop trigger if exists product_resolution_candidates_validate_owner on public.product_resolution_candidates;
create trigger product_resolution_candidates_validate_owner
  before insert on public.product_resolution_candidates
  for each row execute function private.validate_product_resolution_candidate_owner();

drop trigger if exists product_resolution_evidence_reject_update on public.product_resolution_evidence;
create trigger product_resolution_evidence_reject_update
  before update on public.product_resolution_evidence
  for each row execute function private.reject_immutable_snapshot_update();
drop trigger if exists product_resolution_candidates_reject_update on public.product_resolution_candidates;
create trigger product_resolution_candidates_reject_update
  before update on public.product_resolution_candidates
  for each row execute function private.reject_immutable_snapshot_update();

alter table public.founder_review_tasks
  add column product_resolution_case_id uuid references public.product_resolution_cases(id) on delete cascade;

alter table public.founder_review_tasks drop constraint founder_review_tasks_task_type_check;
alter table public.founder_review_tasks add constraint founder_review_tasks_task_type_check
  check (task_type in ('initial_routine', 'routine_adjustment', 'refill', 'safety_flag', 'product_identity'));
create unique index founder_review_tasks_product_identity_pending_idx
  on public.founder_review_tasks (product_resolution_case_id)
  where task_type = 'product_identity' and status = 'pending';

alter table public.founder_operation_log drop constraint founder_operation_log_operation_check;
alter table public.founder_operation_log add constraint founder_operation_log_operation_check check (operation in (
  'routine_published', 'refill_transitioned', 'formula_verified', 'formula_rejected',
  'note_added', 'task_resolved', 'product_identity_resolved'
));
alter table public.founder_operation_log drop constraint founder_operation_log_target_type_check;
alter table public.founder_operation_log add constraint founder_operation_log_target_type_check check (target_type in (
  'routine', 'refill_request', 'product', 'member_note', 'founder_review_task', 'product_resolution_case'
));

alter table public.product_variants enable row level security;
alter table public.product_formula_versions enable row level security;
alter table public.product_identifiers enable row level security;
alter table public.product_resolution_cases enable row level security;
alter table public.product_resolution_evidence enable row level security;
alter table public.product_resolution_candidates enable row level security;

revoke all privileges on table public.product_variants from public, anon, authenticated;
revoke all privileges on table public.product_formula_versions from public, anon, authenticated;
revoke all privileges on table public.product_identifiers from public, anon, authenticated;
revoke all privileges on table public.product_resolution_cases from public, anon, authenticated;
revoke all privileges on table public.product_resolution_evidence from public, anon, authenticated;
revoke all privileges on table public.product_resolution_candidates from public, anon, authenticated;
grant all privileges on table public.product_variants to service_role;
grant all privileges on table public.product_formula_versions to service_role;
grant all privileges on table public.product_identifiers to service_role;
grant all privileges on table public.product_resolution_cases to service_role;
grant all privileges on table public.product_resolution_evidence to service_role;
grant all privileges on table public.product_resolution_candidates to service_role;
grant select on table public.product_resolution_cases to authenticated;
grant select on table public.product_resolution_evidence to authenticated;
grant select on table public.product_resolution_candidates to authenticated;

create policy product_resolution_cases_select_own on public.product_resolution_cases
  for select to authenticated using ((select auth.uid()) = user_id);
create policy product_resolution_evidence_select_own on public.product_resolution_evidence
  for select to authenticated using ((select auth.uid()) = user_id);
create policy product_resolution_candidates_select_own on public.product_resolution_candidates
  for select to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-product-evidence',
  'customer-product-evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists customer_product_evidence_insert_own on storage.objects;
create policy customer_product_evidence_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'customer-product-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] in ('front_label', 'ingredients', 'packaging')
    and owner_id = (select auth.uid())::text
    and (select public.current_member_is_active())
  );

create or replace function public.record_product_resolution(
  p_user_id uuid,
  p_request_id uuid,
  p_consumer text,
  p_resolution_state text,
  p_next_action text,
  p_requires_founder_review boolean,
  p_product_id uuid,
  p_variant_id uuid,
  p_formula_version_id uuid,
  p_evidence_snapshot jsonb,
  p_evidence jsonb,
  p_candidates jsonb
)
returns public.product_resolution_cases
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_case public.product_resolution_cases;
  v_evidence jsonb;
  v_candidate jsonb;
  v_rank integer := 0;
begin
  if p_user_id is null or p_request_id is null then raise exception 'RESOLUTION_IDENTITY_REQUIRED'; end if;
  if jsonb_typeof(p_evidence_snapshot) is distinct from 'object' then raise exception 'INVALID_EVIDENCE_SNAPSHOT'; end if;
  if jsonb_typeof(p_evidence) is distinct from 'array' then raise exception 'INVALID_RESOLUTION_EVIDENCE'; end if;
  if jsonb_typeof(p_candidates) is distinct from 'array' or jsonb_array_length(p_candidates) > 8 then
    raise exception 'INVALID_RESOLUTION_CANDIDATES';
  end if;

  insert into public.product_resolution_cases (
    user_id, request_id, consumer, resolution_state, product_id, variant_id,
    formula_version_id, next_action, requires_founder_review, review_status,
    evidence_snapshot
  ) values (
    p_user_id, p_request_id, p_consumer, p_resolution_state, p_product_id,
    p_variant_id, p_formula_version_id, p_next_action,
    coalesce(p_requires_founder_review, false),
    case when coalesce(p_requires_founder_review, false) then 'pending' else 'not_needed' end,
    p_evidence_snapshot
  )
  on conflict on constraint product_resolution_cases_request_unique do nothing
  returning * into v_case;

  if not found then
    select * into v_case from public.product_resolution_cases
    where user_id = p_user_id and request_id = p_request_id;
    if not found then raise exception 'RESOLUTION_REPLAY_UNAVAILABLE'; end if;
    return v_case;
  end if;

  for v_evidence in select value from jsonb_array_elements(p_evidence)
  loop
    insert into public.product_resolution_evidence (
      case_id, user_id, evidence_type, source_type, storage_path, extracted_text
    ) values (
      v_case.id,
      p_user_id,
      v_evidence ->> 'evidence_type',
      v_evidence ->> 'source_type',
      nullif(v_evidence ->> 'storage_path', ''),
      nullif(v_evidence ->> 'extracted_text', '')
    );
  end loop;

  for v_candidate in select value from jsonb_array_elements(p_candidates)
  loop
    v_rank := v_rank + 1;
    insert into public.product_resolution_candidates (
      case_id, user_id, product_id, variant_id, formula_version_id,
      rank_order, candidate_basis, match_reasons
    ) values (
      v_case.id,
      p_user_id,
      nullif(v_candidate ->> 'product_id', '')::uuid,
      nullif(v_candidate ->> 'variant_id', '')::uuid,
      nullif(v_candidate ->> 'formula_version_id', '')::uuid,
      v_rank,
      v_candidate ->> 'candidate_basis',
      array(select jsonb_array_elements_text(coalesce(v_candidate -> 'match_reasons', '[]'::jsonb)))
    );
  end loop;

  if v_case.requires_founder_review then
    insert into public.founder_review_tasks (
      user_id, task_type, status, priority, notes, product_resolution_case_id
    ) values (
      p_user_id, 'product_identity', 'pending', 'normal',
      'Review unresolved product identity evidence.', v_case.id
    );
  end if;

  return v_case;
end;
$$;

revoke all on function public.record_product_resolution(
  uuid, uuid, text, text, text, boolean, uuid, uuid, uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.record_product_resolution(
  uuid, uuid, text, text, text, boolean, uuid, uuid, uuid, jsonb, jsonb, jsonb
) to service_role;

create or replace function public.founder_resolve_product_identity(
  p_actor_user_id uuid,
  p_case_id uuid,
  p_resolution_state text,
  p_product_id uuid,
  p_variant_id uuid,
  p_formula_version_id uuid,
  p_request_id uuid
)
returns public.product_resolution_cases
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_case public.product_resolution_cases;
  v_replay public.product_resolution_cases;
  v_formula public.product_formula_versions;
begin
  perform private.assert_active_founder(p_actor_user_id);
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;

  select resolution.* into v_replay
  from public.founder_operation_log as log
  join public.product_resolution_cases as resolution on resolution.id = log.target_id
  where log.actor_user_id = p_actor_user_id
    and log.request_id = p_request_id
    and log.operation = 'product_identity_resolved'
    and log.target_type = 'product_resolution_case';
  if found then return v_replay; end if;

  select * into v_case from public.product_resolution_cases where id = p_case_id for update;
  if not found then raise exception 'PRODUCT_RESOLUTION_NOT_FOUND'; end if;

  -- A concurrent retry can pass the first replay read while the original
  -- transaction is still uncommitted. Recheck after taking the case lock so
  -- it observes the winner and returns the same result instead of failing.
  select resolution.* into v_replay
  from public.founder_operation_log as log
  join public.product_resolution_cases as resolution on resolution.id = log.target_id
  where log.actor_user_id = p_actor_user_id
    and log.request_id = p_request_id
    and log.operation = 'product_identity_resolved'
    and log.target_type = 'product_resolution_case';
  if found then return v_replay; end if;

  if v_case.review_status <> 'pending' then raise exception 'PRODUCT_RESOLUTION_ALREADY_REVIEWED'; end if;
  if p_resolution_state not in ('verified_product_formula', 'identified_formula_unverified', 'formula_only', 'insufficient_evidence') then
    raise exception 'INVALID_PRODUCT_RESOLUTION_STATE';
  end if;

  if p_variant_id is not null and not exists (
    select 1 from public.product_variants where id = p_variant_id and product_id = p_product_id
  ) then raise exception 'PRODUCT_VARIANT_MISMATCH'; end if;

  if p_formula_version_id is not null then
    select * into v_formula from public.product_formula_versions where id = p_formula_version_id;
    if not found then raise exception 'FORMULA_VERSION_NOT_FOUND'; end if;
    if p_variant_id is not null and v_formula.variant_id is distinct from p_variant_id then
      raise exception 'FORMULA_VARIANT_MISMATCH';
    end if;
  end if;

  if p_resolution_state = 'verified_product_formula' and (
    p_product_id is null or p_variant_id is null or p_formula_version_id is null
    or v_formula.verification_status <> 'verified'
  ) then raise exception 'VERIFIED_RESOLUTION_REQUIRES_VERIFIED_FORMULA'; end if;

  if p_resolution_state = 'identified_formula_unverified' and p_product_id is null then
    raise exception 'IDENTIFIED_RESOLUTION_REQUIRES_PRODUCT';
  end if;
  if p_resolution_state = 'formula_only' and (
    p_formula_version_id is null or p_product_id is not null or p_variant_id is not null
  ) then raise exception 'FORMULA_ONLY_RESOLUTION_REQUIRES_FORMULA_ONLY'; end if;
  if p_resolution_state = 'insufficient_evidence' and (
    p_product_id is not null or p_variant_id is not null or p_formula_version_id is not null
  ) then raise exception 'INSUFFICIENT_RESOLUTION_CANNOT_SELECT_IDENTITY'; end if;

  update public.product_resolution_cases set
    resolution_state = p_resolution_state,
    product_id = p_product_id,
    variant_id = p_variant_id,
    formula_version_id = p_formula_version_id,
    next_action = case
      when p_resolution_state = 'verified_product_formula' then 'evaluate_product_fit'
      when p_resolution_state = 'identified_formula_unverified' then 'photograph_ingredients'
      else 'manual_review'
    end,
    review_status = 'resolved',
    resolved_at = now()
  where id = p_case_id
  returning * into v_case;

  update public.founder_review_tasks set status = 'completed'
  where product_resolution_case_id = p_case_id and task_type = 'product_identity' and status = 'pending';

  insert into public.founder_operation_log (
    actor_user_id, operation, target_type, target_id, request_id, details
  ) values (
    p_actor_user_id, 'product_identity_resolved', 'product_resolution_case',
    p_case_id, p_request_id,
    jsonb_build_object(
      'member_id', v_case.user_id,
      'resolution_state', v_case.resolution_state,
      'product_id', v_case.product_id,
      'variant_id', v_case.variant_id,
      'formula_version_id', v_case.formula_version_id
    )
  );
  return v_case;
end;
$$;

revoke all on function public.founder_resolve_product_identity(uuid,uuid,text,uuid,uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.founder_resolve_product_identity(uuid,uuid,text,uuid,uuid,uuid,uuid)
  to service_role;
