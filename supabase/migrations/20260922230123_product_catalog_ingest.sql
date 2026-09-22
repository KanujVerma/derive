-- Trusted, transactional operator ingestion into public.products and S6 identity tables.
alter table public.product_variants
  add column catalog_source_reference text,
  add column catalog_public_source_url text,
  add column catalog_observed_at timestamptz,
  add column catalog_verification_status text not null default 'provisional';
alter table public.product_variants
  add constraint product_variants_catalog_public_url_check check (
    catalog_public_source_url is null or (
      catalog_public_source_url ~ '^https://[^/@?#]+(/[^?#]*)?$'
      and catalog_public_source_url !~ '[?@#]'
    )
  ),
  add constraint product_variants_catalog_status_check
    check (catalog_verification_status in ('provisional','verified')),
  add constraint product_variants_catalog_source_check check (
    catalog_verification_status <> 'verified' or (
      catalog_source_reference is not null
      and length(trim(catalog_source_reference)) between 1 and 1000
      and catalog_observed_at is not null
    )
  );

alter table public.product_formula_versions
  add column catalog_public_source_url text;
alter table public.product_formula_versions
  add constraint product_formula_versions_catalog_public_url_check check (
    catalog_public_source_url is null or (
      catalog_public_source_url ~ '^https://[^/@?#]+(/[^?#]*)?$'
      and catalog_public_source_url !~ '[?@#]'
    )
  );

create or replace function private.catalog_valid_gtin(p_value text)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare
  v_length integer := length(p_value);
  v_sum integer := 0;
  v_digit integer;
  v_index integer;
begin
  if v_length not in (8, 12, 13, 14) or p_value !~ '^[0-9]+$' then return false; end if;
  for v_index in 1..v_length - 1 loop
    v_digit := substr(p_value, v_length - v_index, 1)::integer;
    v_sum := v_sum + v_digit * case when v_index % 2 = 1 then 3 else 1 end;
  end loop;
  return substr(p_value, v_length, 1)::integer = (10 - (v_sum % 10)) % 10;
end;
$$;
revoke all on function private.catalog_valid_gtin(text) from public, anon, authenticated;
grant execute on function private.catalog_valid_gtin(text) to service_role;

create or replace function private.ingest_catalog_product(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product jsonb := p_payload->'product';
  v_variant jsonb := p_payload->'variant';
  v_formula jsonb := p_payload->'formula';
  v_identifier jsonb := p_payload->'identifier';
  v_alias jsonb;
  v_brand text;
  v_name text;
  v_category text;
  v_source text;
  v_product_public_url text;
  v_variant_public_url text;
  v_formula_public_url text;
  v_existing_formula_public_url text;
  v_observed timestamptz;
  v_product_id uuid;
  v_existing_catalog boolean;
  v_existing_verified timestamptz;
  v_existing_product_public_url text;
  v_alias_id uuid;
  v_alias_source text;
  v_alias_observed timestamptz;
  v_alias_time timestamptz;
  v_existing_ingredients text[];
  v_existing_provenance text;
  v_existing_supersedes uuid;
  v_existing_identifier_authority text;
  v_existing_identifier_source text;
  v_existing_identifier_observed timestamptz;
  v_existing_identifier_verified timestamptz;
  v_variant_id uuid;
  v_formula_id uuid;
  v_identifier_id uuid;
  v_variant_name text;
  v_variant_source text;
  v_variant_observed timestamptz;
  v_variant_status text;
  v_existing_variant_source text;
  v_existing_variant_public_url text;
  v_existing_variant_observed timestamptz;
  v_existing_variant_status text;
  v_existing_variant_markers text[];
  v_region text;
  v_package_size text;
  v_markers text[];
  v_ingredients text[];
  v_fingerprint text;
  v_formula_source text;
  v_formula_observed timestamptz;
  v_formula_status text;
  v_formula_provenance text;
  v_supersedes uuid;
  v_identifier_type text;
  v_identifier_value text;
  v_identifier_authority text;
  v_identifier_source text;
  v_identifier_observed timestamptz;
  v_identifier_verified timestamptz;
  v_identifier_formula_id uuid;
begin
  if jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(v_product) <> 'object' then
    raise exception 'CATALOG_INVALID_PAYLOAD';
  end if;
  v_brand := trim(v_product->>'brand');
  v_name := trim(v_product->>'name');
  v_category := trim(v_product->>'category');
  v_source := trim(v_product->>'sourceReference');
  v_product_public_url := nullif(trim(v_product->>'publicSourceUrl'),'');
  if v_product_public_url is not null and (
    v_product_public_url !~ '^https://[^/@?#]+(/[^?#]*)?$'
    or v_product_public_url ~ '[?@#]'
  ) then raise exception 'CATALOG_INVALID_PUBLIC_SOURCE'; end if;
  if coalesce(length(v_brand), 0) not between 1 and 120
    or coalesce(length(v_name), 0) not between 1 and 180
    or coalesce(v_category,'') not in (
      'cleanser','toner','treatment','serum','moisturizer','sunscreen','oil',
      'mask','deodorant','body_care','hair_care','other'
    ) then raise exception 'CATALOG_INVALID_PRODUCT'; end if;
  if coalesce(length(v_source), 0) not between 1 and 1000
    or nullif(v_product->>'observedAt','') is null then
    raise exception 'CATALOG_SOURCE_REQUIRED';
  end if;
  v_observed := (v_product->>'observedAt')::timestamptz;
  if v_observed > now() + interval '1 day' then raise exception 'CATALOG_INVALID_OBSERVATION'; end if;
  if p_payload ? 'aliases' and jsonb_typeof(p_payload->'aliases') <> 'array' then
    raise exception 'CATALOG_INVALID_ALIASES';
  end if;
  if jsonb_array_length(coalesce(p_payload->'aliases', '[]'::jsonb)) > 30 then
    raise exception 'CATALOG_INVALID_ALIASES';
  end if;
  if (v_formula is not null or v_identifier is not null) and v_variant is null then
    raise exception 'CATALOG_VARIANT_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(lower(v_brand || '|' || v_name)));
  select p.id, p.is_catalog_standard, p.catalog_verified_at, p.catalog_public_source_url
    into v_product_id, v_existing_catalog, v_existing_verified, v_existing_product_public_url
  from public.products p
  where lower(trim(p.brand)) = lower(v_brand) and lower(trim(p.name)) = lower(v_name)
  for update;
  if v_product_id is null then
    insert into public.products (
      brand, name, category, key_actives, full_ingredients, is_catalog_standard,
      catalog_source_reference, catalog_public_source_url, catalog_observed_at, catalog_verified_at
    ) values (v_brand, v_name, v_category, '{}'::text[], '{}'::text[], true,
      v_source, v_product_public_url, v_observed, now())
    returning id into v_product_id;
  elsif v_existing_catalog is true and v_existing_verified is not null then
    if not exists (
      select 1 from public.products where id = v_product_id and category = v_category
        and catalog_source_reference = v_source
        and catalog_public_source_url is not distinct from v_product_public_url
    ) then raise exception 'CATALOG_IDENTITY_CONFLICT'; end if;
  else
    -- The legacy global brand/name key makes provisional and catalog identities
    -- one row. Promotion preserves member references while clearing unverified facts.
    update public.products set
      brand = v_brand, name = v_name, category = v_category,
      key_actives = '{}'::text[], full_ingredients = '{}'::text[],
      retail_price_approx = null, image_url = null, cautions = '{}'::text[],
      is_catalog_standard = true,
      catalog_source_reference = v_source,
      catalog_public_source_url = v_product_public_url,
      catalog_observed_at = v_observed,
      catalog_verified_at = now()
    where id = v_product_id;
  end if;

  for v_alias in select value from jsonb_array_elements(coalesce(p_payload->'aliases','[]'::jsonb)) loop
    if jsonb_typeof(v_alias) <> 'object'
      or coalesce(length(trim(v_alias->>'name')), 0) not between 2 and 180
      or coalesce(length(trim(v_alias->>'sourceReference')), 0) not between 1 and 1000
      or nullif(v_alias->>'observedAt','') is null then
      raise exception 'CATALOG_INVALID_ALIAS';
    end if;
    v_alias_time := (v_alias->>'observedAt')::timestamptz;
    select id, source_reference, observed_at into v_alias_id, v_alias_source, v_alias_observed
    from public.product_search_aliases
    where product_id = v_product_id and lower(trim(alias)) = lower(trim(v_alias->>'name'))
    for update;
    if v_alias_id is null then
      insert into public.product_search_aliases(product_id,alias,source_reference,observed_at)
      values (v_product_id,trim(v_alias->>'name'),trim(v_alias->>'sourceReference'),v_alias_time);
    elsif v_alias_source <> trim(v_alias->>'sourceReference') or v_alias_observed <> v_alias_time then
      raise exception 'CATALOG_ALIAS_PROVENANCE_CONFLICT';
    end if;
  end loop;

  if v_variant is not null then
    if jsonb_typeof(v_variant) <> 'object'
      or coalesce(length(trim(v_variant->>'name')),0) not between 1 and 180 then
      raise exception 'CATALOG_INVALID_VARIANT';
    end if;
    v_variant_name := trim(v_variant->>'name');
    v_variant_source := trim(v_variant->>'sourceReference');
    v_variant_public_url := nullif(trim(v_variant->>'publicSourceUrl'),'');
    if v_variant_public_url is not null and (
      v_variant_public_url !~ '^https://[^/@?#]+(/[^?#]*)?$'
      or v_variant_public_url ~ '[?@#]'
    ) then raise exception 'CATALOG_INVALID_PUBLIC_SOURCE'; end if;
    v_variant_status := trim(v_variant->>'verificationStatus');
    if coalesce(length(v_variant_source),0) not between 1 and 1000
      or nullif(v_variant->>'observedAt','') is null
      or coalesce(v_variant_status,'') not in ('provisional','verified') then
      raise exception 'CATALOG_VARIANT_SOURCE_REQUIRED';
    end if;
    v_variant_observed := (v_variant->>'observedAt')::timestamptz;
    if v_variant_observed > now() + interval '1 day' then raise exception 'CATALOG_INVALID_OBSERVATION'; end if;
    v_region := nullif(trim(v_variant->>'regionCode'),'');
    v_package_size := nullif(trim(v_variant->>'packageSize'),'');
    if v_variant ? 'packagingMarkers' and jsonb_typeof(v_variant->'packagingMarkers') <> 'array' then
      raise exception 'CATALOG_INVALID_VARIANT';
    end if;
    select coalesce(array_agg(value), '{}'::text[]) into v_markers
      from jsonb_array_elements_text(coalesce(v_variant->'packagingMarkers','[]'::jsonb));
    select id, catalog_source_reference, catalog_public_source_url, catalog_observed_at,
      catalog_verification_status, packaging_markers
      into v_variant_id, v_existing_variant_source, v_existing_variant_public_url, v_existing_variant_observed,
        v_existing_variant_status, v_existing_variant_markers
    from public.product_variants
    where product_id = v_product_id and lower(trim(variant_name)) = lower(v_variant_name)
      and coalesce(region_code,'') = coalesce(v_region,'')
      and coalesce(lower(trim(package_size)),'') = coalesce(lower(v_package_size),'')
    for update;
    if v_variant_id is null then
      insert into public.product_variants(
        product_id,variant_name,region_code,package_size,packaging_markers,
        catalog_source_reference,catalog_public_source_url,catalog_observed_at,catalog_verification_status
      ) values (
        v_product_id,v_variant_name,v_region,v_package_size,v_markers,
        v_variant_source,v_variant_public_url,v_variant_observed,v_variant_status
      ) returning id into v_variant_id;
    elsif v_existing_variant_source is null then
      if v_variant ? 'packagingMarkers'
        and cardinality(v_existing_variant_markers) > 0
        and v_existing_variant_markers <> v_markers then
        raise exception 'CATALOG_VARIANT_PROVENANCE_CONFLICT';
      end if;
      update public.product_variants set
        packaging_markers = case
          when cardinality(v_existing_variant_markers) = 0 and v_variant ? 'packagingMarkers'
            then v_markers else v_existing_variant_markers end,
        catalog_source_reference = v_variant_source,
        catalog_public_source_url = v_variant_public_url,
        catalog_observed_at = v_variant_observed,
        catalog_verification_status = v_variant_status
      where id = v_variant_id;
    elsif v_existing_variant_source <> v_variant_source
      or v_existing_variant_public_url is distinct from v_variant_public_url
      or v_existing_variant_observed is distinct from v_variant_observed
      or v_existing_variant_status <> v_variant_status
      or (v_variant ? 'packagingMarkers' and v_existing_variant_markers <> v_markers) then
      raise exception 'CATALOG_VARIANT_PROVENANCE_CONFLICT';
    end if;
  end if;

  if v_formula is not null then
    if jsonb_typeof(v_formula) <> 'object' or jsonb_typeof(v_formula->'ingredients') <> 'array'
      or jsonb_array_length(v_formula->'ingredients') not between 1 and 300 then
      raise exception 'CATALOG_INVALID_FORMULA';
    end if;
    select array_agg(trim(value)) into v_ingredients
      from jsonb_array_elements_text(v_formula->'ingredients');
    if exists (select 1 from unnest(v_ingredients) ingredient where ingredient = '') then
      raise exception 'CATALOG_INVALID_FORMULA';
    end if;
    v_fingerprint := trim(v_formula->>'normalizedIngredientFingerprint');
    v_formula_source := trim(v_formula->>'sourceReference');
    v_formula_public_url := nullif(trim(v_formula->>'publicSourceUrl'),'');
    if v_formula_public_url is not null and (
      v_formula_public_url !~ '^https://[^/@?#]+(/[^?#]*)?$'
      or v_formula_public_url ~ '[?@#]'
    ) then raise exception 'CATALOG_INVALID_PUBLIC_SOURCE'; end if;
    v_formula_provenance := trim(v_formula->>'provenanceType');
    v_formula_status := trim(v_formula->>'verificationStatus');
    if coalesce(length(v_fingerprint),0) not between 1 and 30000
      or coalesce(length(v_formula_source),0) not between 1 and 1000
      or nullif(v_formula->>'observedAt','') is null
      or coalesce(v_formula_status,'') not in ('provisional','verified') then
      raise exception 'CATALOG_INVALID_FORMULA';
    end if;
    v_formula_observed := (v_formula->>'observedAt')::timestamptz;
    if v_formula_status = 'verified' and v_formula_provenance not in (
      'manufacturer','package_label','regulator','founder_review'
    ) then raise exception 'CATALOG_UNSUPPORTED_FORMULA_PROVENANCE'; end if;
    v_supersedes := nullif(v_formula->>'supersedesId','')::uuid;
    if v_supersedes is not null and not exists (
      select 1 from public.product_formula_versions
      where id = v_supersedes and variant_id = v_variant_id
    ) then raise exception 'CATALOG_FORMULA_LINEAGE_MISMATCH'; end if;
    select id, ingredients, provenance_type, supersedes_id, catalog_public_source_url
      into v_formula_id, v_existing_ingredients, v_existing_provenance, v_existing_supersedes, v_existing_formula_public_url
    from public.product_formula_versions
    where variant_id = v_variant_id and normalized_ingredient_fingerprint = v_fingerprint
      and source_reference = v_formula_source and observed_at = v_formula_observed
      and verification_status = v_formula_status
    order by id limit 1;
    if v_formula_id is not null and (
      v_existing_ingredients <> v_ingredients
      or v_existing_provenance <> v_formula_provenance
      or v_existing_supersedes is distinct from v_supersedes
      or v_existing_formula_public_url is distinct from v_formula_public_url
    ) then raise exception 'CATALOG_FORMULA_PROVENANCE_CONFLICT'; end if;
    if v_formula_id is null then
      insert into public.product_formula_versions (
        variant_id, ingredients, normalized_ingredient_fingerprint, provenance_type,
        source_reference, catalog_public_source_url, observed_at, verification_status, supersedes_id
      ) values (
        v_variant_id, v_ingredients, v_fingerprint, v_formula_provenance,
        v_formula_source, v_formula_public_url, v_formula_observed, v_formula_status, v_supersedes
      ) returning id into v_formula_id;
    end if;
  end if;

  if v_identifier is not null then
    if jsonb_typeof(v_identifier) <> 'object' then raise exception 'CATALOG_INVALID_IDENTIFIER'; end if;
    v_identifier_type := trim(v_identifier->>'type');
    v_identifier_value := trim(v_identifier->>'value');
    v_identifier_authority := trim(v_identifier->>'sourceAuthority');
    v_identifier_source := trim(v_identifier->>'sourceReference');
    if coalesce(v_identifier_type,'') not in ('gtin_8','gtin_12','gtin_13','gtin_14')
      or coalesce(length(v_identifier_value),0) <> split_part(v_identifier_type,'_',2)::integer
      or not private.catalog_valid_gtin(v_identifier_value)
      or coalesce(v_identifier_authority,'') not in ('manufacturer','gs1','founder','retailer','member')
      or coalesce(length(v_identifier_source),0) not between 1 and 1000
      or nullif(v_identifier->>'observedAt','') is null then
      raise exception 'CATALOG_INVALID_IDENTIFIER';
    end if;
    v_identifier_observed := (v_identifier->>'observedAt')::timestamptz;
    v_identifier_verified := nullif(v_identifier->>'verifiedAt','')::timestamptz;
    if v_identifier_verified is not null
      and v_identifier_authority not in ('manufacturer','gs1','founder') then
      raise exception 'CATALOG_UNSUPPORTED_IDENTIFIER_AUTHORITY';
    end if;
    if coalesce((v_identifier->>'linkFormula')::boolean,false) then
      if v_formula_id is null or v_formula_status <> 'verified' or v_identifier_verified is null then
        raise exception 'CATALOG_FORMULA_LINK_UNVERIFIED';
      end if;
      v_identifier_formula_id := v_formula_id;
    end if;
    select id, source_authority, source_reference, observed_at, verified_at
      into v_identifier_id, v_existing_identifier_authority, v_existing_identifier_source,
        v_existing_identifier_observed, v_existing_identifier_verified
    from public.product_identifiers
    where variant_id = v_variant_id and identifier_type = v_identifier_type
      and identifier_value = v_identifier_value
      and formula_version_id is not distinct from v_identifier_formula_id
    for update;
    if v_identifier_id is not null and (
      v_existing_identifier_authority <> v_identifier_authority
      or v_existing_identifier_source <> v_identifier_source
      or v_existing_identifier_observed <> v_identifier_observed
      or v_existing_identifier_verified is distinct from v_identifier_verified
    ) then raise exception 'CATALOG_IDENTIFIER_PROVENANCE_CONFLICT'; end if;
    if v_identifier_id is null then
      insert into public.product_identifiers (
        variant_id,formula_version_id,identifier_type,identifier_value,
        source_authority,source_reference,observed_at,verified_at
      ) values (
        v_variant_id,v_identifier_formula_id,v_identifier_type,v_identifier_value,
        v_identifier_authority,v_identifier_source,v_identifier_observed,v_identifier_verified
      ) returning id into v_identifier_id;
    end if;
  end if;

  return jsonb_build_object(
    'productId',v_product_id,'variantId',v_variant_id,
    'formulaVersionId',v_formula_id,'identifierId',v_identifier_id
  );
end;
$$;

revoke all on function private.ingest_catalog_product(jsonb) from public, anon, authenticated;
grant execute on function private.ingest_catalog_product(jsonb) to service_role;
