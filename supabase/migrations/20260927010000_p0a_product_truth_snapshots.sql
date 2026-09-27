-- Immutable owner-bound product truth. No guest activation or catalog promotion.
alter table public.product_resolution_cases
  add column truth_revision integer not null default 1 check (truth_revision > 0);

create table public.product_truth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id uuid not null references public.product_resolution_cases(id) on delete cascade,
  case_revision integer not null check (case_revision > 0),
  schema_version integer not null default 1 check (schema_version = 1),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (case_id, case_revision)
);
alter table public.product_truth_snapshots enable row level security;
revoke all on public.product_truth_snapshots from anon, authenticated;
grant select on public.product_truth_snapshots to authenticated;
grant all on public.product_truth_snapshots to service_role;
create policy product_truth_snapshots_owner_read on public.product_truth_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create index product_truth_snapshots_owner_created_idx
  on public.product_truth_snapshots(user_id, created_at desc);
create trigger product_truth_snapshots_no_update before update on public.product_truth_snapshots
  for each row execute function private.reject_immutable_snapshot_update();

-- Caller cannot supply ingredients, sources, IDs or a prebuilt snapshot.
create or replace function public.seal_product_truth_snapshot(p_user_id uuid, p_case_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  c public.product_resolution_cases;
  p public.products;
  v public.product_variants;
  f public.product_formula_versions;
  snapshot_id uuid := gen_random_uuid();
  snapshot_time timestamptz := now();
  result jsonb;
  existing jsonb;
  product_json jsonb := 'null'::jsonb;
  formula_json jsonb := 'null'::jsonb;
  evidence_json jsonb;
  identifiers_json jsonb;
  conflicts_json jsonb;
  unknowns text[] := '{}';
begin
  select * into c from public.product_resolution_cases
    where id = p_case_id and user_id = p_user_id for update;
  if not found then raise exception 'PRODUCT_TRUTH_CASE_NOT_FOUND'; end if;
  select snapshot into existing from public.product_truth_snapshots
    where case_id = c.id and case_revision = c.truth_revision;
  if found then return existing; end if;

  if c.product_id is not null then
    select * into p from public.products where id = c.product_id;
    if not found then raise exception 'PRODUCT_TRUTH_PRODUCT_MISSING'; end if;
    if c.variant_id is not null then
      select * into v from public.product_variants where id = c.variant_id and product_id = c.product_id;
      if not found then raise exception 'PRODUCT_TRUTH_VARIANT_MISMATCH'; end if;
    end if;
    product_json := jsonb_strip_nulls(jsonb_build_object(
      'productId', p.id, 'brand', p.brand, 'name', p.name,
      'variantId', v.id, 'variantName', v.variant_name, 'regionCode', v.region_code));
  else unknowns := array_append(unknowns, 'product'); end if;
  if c.variant_id is null then unknowns := array_append(unknowns, 'variant'); end if;
  if v.region_code is null then unknowns := array_append(unknowns, 'region'); end if;

  if c.formula_version_id is not null then
    select * into f from public.product_formula_versions where id = c.formula_version_id;
    if not found or f.verification_status <> 'verified' then
      raise exception 'PRODUCT_TRUTH_FORMULA_UNVERIFIED';
    end if;
    if c.variant_id is not null and f.variant_id is distinct from c.variant_id then
      raise exception 'PRODUCT_TRUTH_FORMULA_MISMATCH';
    end if;
    if c.variant_id is not null and f.region_code is not null and v.region_code is not null
      and f.region_code <> v.region_code then raise exception 'PRODUCT_TRUTH_FORMULA_REGION_MISMATCH'; end if;
    formula_json := jsonb_build_object(
      'formulaVersionId', f.id, 'verificationStatus', 'verified',
      'appliesToSelectedVariant', c.resolution_state = 'verified_product_formula',
      'ingredients', to_jsonb(f.ingredients), 'observedAt', f.observed_at,
      'provenanceType', f.provenance_type, 'publicSourceUrl', f.catalog_public_source_url);
    if f.catalog_public_source_url is null then unknowns := array_append(unknowns, 'public_source'); end if;
  else
    unknowns := array_append(unknowns, 'formula');
    unknowns := array_append(unknowns, 'public_source');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'evidenceId', id, 'type', evidence_type, 'source', source_type, 'authority', 'candidate')
    order by created_at, id), '[]'::jsonb) into evidence_json
    from public.product_resolution_evidence where case_id = c.id and user_id = c.user_id;
  -- The normalized observed identifier is NOT asserted to be catalog authority.
  select coalesce(jsonb_agg(jsonb_build_object('type', 'gtin', 'value', extracted_text,
    'status', 'customer_observed') order by id), '[]'::jsonb) into identifiers_json
    from public.product_resolution_evidence where case_id = c.id and user_id = c.user_id
      and evidence_type = 'barcode' and extracted_text ~ '^[0-9]{8,14}$';
  select coalesce(jsonb_agg(jsonb_build_object('code', code,
    'status', case when c.review_status = 'resolved' then 'reviewed' else 'unresolved' end)), '[]'::jsonb)
    into conflicts_json from jsonb_array_elements_text(coalesce(c.evidence_snapshot->'conflicts', '[]'::jsonb)) code
    where code in ('identity_mismatch','region_mismatch','ingredient_mismatch','identifier_conflict');

  result := jsonb_build_object(
    'schemaVersion', 1, 'snapshotId', snapshot_id, 'createdAt', snapshot_time,
    'resolutionCaseId', c.id, 'caseRevision', c.truth_revision, 'resolverVersion', 's6-p0a-1',
    'state', c.resolution_state, 'product', product_json,
    'identityStatus', case when c.product_id is null then 'unresolved' else 'identified' end,
    'formula', formula_json, 'identifiers', identifiers_json, 'evidence', evidence_json,
    'catalogReferences', jsonb_build_object('productId', c.product_id, 'variantId', c.variant_id,
      'formulaVersionId', c.formula_version_id),
    'unknownFields', to_jsonb(unknowns), 'conflicts', conflicts_json,
    'nextRequiredEvidence', case c.next_action
      when 'evaluate_product_fit' then 'none' when 'choose_candidate' then 'variant_selection'
      when 'confirm_variant' then 'variant_selection' when 'photograph_ingredients' then 'ingredients'
      else case when c.requires_founder_review then 'manual_review' else 'front_label' end end,
    'customerConfirmation', case when c.next_action in ('choose_candidate','confirm_variant')
      then 'required' else 'not_required' end,
    'founderReview', c.review_status);
  insert into public.product_truth_snapshots(id, user_id, case_id, case_revision, snapshot, created_at)
    values(snapshot_id, c.user_id, c.id, c.truth_revision, result, snapshot_time);
  return result;
end;
$$;
revoke all on function public.seal_product_truth_snapshot(uuid,uuid) from public, anon, authenticated;
grant execute on function public.seal_product_truth_snapshot(uuid,uuid) to service_role;

-- Any reviewed conclusion gets an append-only revision; old snapshots remain untouched.
create or replace function private.advance_product_truth_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id or new.request_id is distinct from old.request_id
    or new.consumer is distinct from old.consumer or new.evidence_snapshot is distinct from old.evidence_snapshot then
    raise exception 'PRODUCT_TRUTH_CASE_EVIDENCE_IMMUTABLE';
  end if;
  if row(new.resolution_state,new.product_id,new.variant_id,new.formula_version_id,new.review_status,new.next_action)
    is distinct from row(old.resolution_state,old.product_id,old.variant_id,old.formula_version_id,old.review_status,old.next_action) then
    -- Preserve the pre-review conclusion even if it was never delivered to the client.
    perform public.seal_product_truth_snapshot(old.user_id,old.id);
    new.truth_revision := old.truth_revision + 1;
  elsif new.truth_revision <> old.truth_revision then raise exception 'PRODUCT_TRUTH_REVISION_SERVER_ONLY';
  end if;
  return new;
end;
$$;
create trigger product_resolution_advance_truth_revision before update on public.product_resolution_cases
  for each row execute function private.advance_product_truth_revision();
create or replace function private.seal_reviewed_product_truth()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.truth_revision <> old.truth_revision then
    perform public.seal_product_truth_snapshot(new.user_id,new.id);
  end if;
  return new;
end;
$$;
create trigger product_resolution_seal_reviewed_truth after update on public.product_resolution_cases
  for each row execute function private.seal_reviewed_product_truth();
revoke all on function private.advance_product_truth_revision() from public,anon,authenticated;
revoke all on function private.seal_reviewed_product_truth() from public,anon,authenticated;
