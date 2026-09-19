-- ============================================================================
-- Derive S3: server-intelligence persistence boundaries
--
-- Model output is never written directly. Edge Functions validate structured
-- output first, then use these service-role-only transactional operations.
-- ============================================================================

do $$
begin
  if exists (
    select 1
    from public.user_products
    where product_id is not null
    group by user_id, product_id
    having count(*) > 1
  ) then
    raise exception 'S3 cannot enforce canonical shelf identity: duplicate user/product rows require review';
  end if;
end;
$$;

create unique index if not exists user_products_user_product_unique_idx
  on public.user_products (user_id, product_id);

alter table public.product_reactions
  add column if not exists source_key text;

create unique index if not exists product_reactions_user_source_unique_idx
  on public.product_reactions (user_id, source_key)
  where source_key is not null;

-- Idempotently normalize a reaction that was first captured in the sealed B1
-- onboarding snapshot. This keeps S2 formula provenance intact without asking
-- the client to resubmit or silently rewriting the intake contract.
create or replace function public.record_product_reaction_once(
  p_user_id uuid,
  p_source_key text,
  p_product_id uuid,
  p_product_name text,
  p_brand text,
  p_ingredients text[],
  p_symptoms text[],
  p_body_area text,
  p_severity text,
  p_approximate_date text default null,
  p_notes text default null,
  p_formula_captured_at timestamptz default now()
)
returns public.product_reactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.product_reactions;
  v_formula public.formula_snapshots;
  v_reaction public.product_reactions;
begin
  if nullif(trim(p_source_key), '') is null then
    raise exception 'Reaction source key is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || trim(p_source_key), 0)
  );

  select * into v_existing
  from public.product_reactions
  where user_id = p_user_id and source_key = trim(p_source_key);
  if found then
    return v_existing;
  end if;

  if p_user_id is null or not exists (
    select 1 from public.profiles where id = p_user_id
  ) then
    raise exception 'Unknown reaction owner';
  end if;

  if p_product_id is not null and not exists (
    select 1 from public.products where id = p_product_id
  ) then
    raise exception 'Unknown reaction product';
  end if;

  insert into public.formula_snapshots (
    user_id, product_id, product_name, brand, ingredients, captured_at
  ) values (
    p_user_id,
    p_product_id,
    p_product_name,
    p_brand,
    coalesce(p_ingredients, '{}'),
    coalesce(p_formula_captured_at, now())
  )
  returning * into v_formula;

  insert into public.product_reactions (
    user_id,
    product_id,
    formula_snapshot_id,
    product_name_snapshot,
    brand_snapshot,
    symptoms,
    body_area,
    severity,
    approximate_date,
    notes,
    source_key
  ) values (
    p_user_id,
    p_product_id,
    v_formula.id,
    p_product_name,
    p_brand,
    p_symptoms,
    p_body_area,
    p_severity,
    p_approximate_date,
    p_notes,
    trim(p_source_key)
  )
  returning * into v_reaction;

  return v_reaction;
end;
$$;

revoke all on function public.record_product_reaction_once(
  uuid, text, uuid, text, text, text[], text[], text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_product_reaction_once(
  uuid, text, uuid, text, text, text[], text[], text, text, text, text, timestamptz
) to service_role;

-- Resolve a user-reported historical product to one canonical identity. Formula
-- evidence remains in formula_snapshots; it is not promoted into catalog truth.
create or replace function public.resolve_catalog_product(
  p_brand text,
  p_name text,
  p_category text
)
returns public.products
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product public.products;
  v_identity text;
begin
  if nullif(trim(p_brand), '') is null or nullif(trim(p_name), '') is null then
    raise exception 'Catalog product brand and name are required';
  end if;

  if p_category not in (
    'cleanser', 'toner', 'treatment', 'serum', 'moisturizer', 'sunscreen',
    'oil', 'mask', 'deodorant', 'body_care', 'hair_care', 'other'
  ) then
    raise exception 'Invalid catalog product category';
  end if;

  v_identity := lower(trim(p_brand)) || ':' || lower(trim(p_name));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_identity, 0));

  select * into v_product
  from public.products
  where lower(trim(brand)) = lower(trim(p_brand))
    and lower(trim(name)) = lower(trim(p_name))
  order by created_at, id
  limit 1;

  if found then
    return v_product;
  end if;

  insert into public.products (
    brand,
    name,
    category,
    key_actives,
    full_ingredients,
    cautions,
    is_catalog_standard
  ) values (
    trim(p_brand),
    trim(p_name),
    p_category,
    '{}',
    '{}',
    '{}',
    false
  )
  returning * into v_product;

  return v_product;
end;
$$;

revoke all on function public.resolve_catalog_product(text, text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_catalog_product(text, text, text)
  to service_role;

-- Append only materially changed signal versions. Re-running inference against
-- unchanged evidence is idempotent; new overlap or tolerated exposure creates
-- a new immutable version.
create or replace function public.append_ingredient_signal_versions(
  p_user_id uuid,
  p_signals jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_signal jsonb;
  v_latest public.ingredient_signals;
  v_supporting_ids uuid[];
  v_tolerance jsonb;
  v_inserted integer := 0;
  v_next_version integer;
begin
  if p_user_id is null or not exists (
    select 1 from public.profiles where id = p_user_id
  ) then
    raise exception 'Unknown ingredient-signal owner';
  end if;

  if jsonb_typeof(p_signals) is distinct from 'array' then
    raise exception 'Ingredient signals must be an array';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ingredient-signals:' || p_user_id::text, 0)
  );

  for v_signal in select value from jsonb_array_elements(p_signals)
  loop
    if nullif(trim(v_signal ->> 'ingredient_name'), '') is null then
      raise exception 'Ingredient signal name is required';
    end if;

    begin
      select coalesce(array_agg(value::uuid), '{}')
      into v_supporting_ids
      from jsonb_array_elements_text(
        coalesce(v_signal -> 'supporting_reaction_ids', '[]'::jsonb)
      );
    exception when invalid_text_representation then
      raise exception 'Ingredient signal reaction identifiers must be UUIDs';
    end;

    v_tolerance := coalesce(v_signal -> 'contradictory_tolerance_evidence', '[]'::jsonb);
    if jsonb_typeof(v_tolerance) is distinct from 'array' then
      raise exception 'Contradictory tolerance evidence must be an array';
    end if;

    select * into v_latest
    from public.ingredient_signals
    where user_id = p_user_id
      and ingredient_key = lower(trim(v_signal ->> 'ingredient_name'))
    order by version desc
    limit 1;

    if found
       and v_latest.confidence = v_signal ->> 'confidence'
       and v_latest.evidence_count = (v_signal ->> 'evidence_count')::integer
       and v_latest.supporting_reaction_ids = v_supporting_ids
       and v_latest.contradictory_tolerance_evidence = v_tolerance
       and v_latest.allergy_source is not distinct from nullif(v_signal ->> 'allergy_source', '')
       and v_latest.notes is not distinct from nullif(v_signal ->> 'notes', '') then
      continue;
    end if;

    v_next_version := coalesce(v_latest.version, 0) + 1;
    insert into public.ingredient_signals (
      user_id,
      ingredient_name,
      version,
      confidence,
      evidence_count,
      supporting_reaction_ids,
      contradictory_tolerance_evidence,
      allergy_source,
      notes
    ) values (
      p_user_id,
      trim(v_signal ->> 'ingredient_name'),
      v_next_version,
      v_signal ->> 'confidence',
      (v_signal ->> 'evidence_count')::integer,
      v_supporting_ids,
      v_tolerance,
      nullif(v_signal ->> 'allergy_source', ''),
      nullif(v_signal ->> 'notes', '')
    );
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.append_ingredient_signal_versions(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.append_ingredient_signal_versions(uuid, jsonb)
  to service_role;
