-- Indexed ingredient evidence, derived from actual ordered ingredients rather
-- than the separately supplied legacy fingerprint. This does not promote truth.
create or replace function private.ingredient_evidence_key(p_ingredients text[])
returns text[] language sql immutable strict parallel safe set search_path = ''
as $$
  select array_agg(btrim(regexp_replace(
    lower(normalize(i.value, NFKC) collate "und-x-icu"),
    U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+',
    ' ', 'g')) order by i.ordinality)
  from unnest(p_ingredients) with ordinality as i(value, ordinality);
$$;

create or replace function private.ingredient_evidence_digest(p_ingredients text[])
returns bytea language sql immutable strict parallel safe set search_path = ''
as $$
  select sha256(convert_to(array_to_json(private.ingredient_evidence_key(p_ingredients))::text, 'UTF8'));
$$;

revoke all on function private.ingredient_evidence_key(text[]) from public, anon, authenticated;
revoke all on function private.ingredient_evidence_digest(text[]) from public, anon, authenticated;
grant execute on function private.ingredient_evidence_key(text[]), private.ingredient_evidence_digest(text[]) to service_role;

create index product_formula_ingredient_evidence_idx
  on public.product_formula_versions (private.ingredient_evidence_digest(ingredients), id)
  where verification_status = 'verified';

create or replace function public.lookup_ingredient_candidate_ids(
  p_ingredients text[], p_free_only boolean, p_user_id uuid
)
returns uuid[] language sql stable security invoker set search_path = ''
as $$
  select coalesce(array_agg(m.id order by m.id), '{}'::uuid[])
  from (
    select f.id
    from public.product_formula_versions f
    left join public.product_variants v on v.id = f.variant_id
    left join public.products p on p.id = v.product_id
    where p_user_id is not null
      and cardinality(p_ingredients) between 1 and 300
      and array_position(p_ingredients, null) is null
      and octet_length(array_to_json(p_ingredients)::text) <= 180000
      and not ('' = any(private.ingredient_evidence_key(p_ingredients)))
      and f.verification_status = 'verified'
      and private.ingredient_evidence_digest(f.ingredients) = private.ingredient_evidence_digest(p_ingredients)
      -- Recheck the ordered array as well as its index digest.
      and private.ingredient_evidence_key(f.ingredients) = private.ingredient_evidence_key(p_ingredients)
      and (
        (f.variant_id is null and f.catalog_public_source_url is not null)
        or (v.lifecycle_status = 'active' and case
          when p_free_only is true then p.is_catalog_standard is true
            and p.catalog_verified_at is not null
            and v.catalog_verification_status = 'verified'
            and f.catalog_public_source_url is not null
          when p_free_only is false then p.is_catalog_standard is true or exists (
            select 1 from public.user_products own_shelf
            where own_shelf.product_id = p.id and own_shelf.user_id = p_user_id
          )
          else false end)
      )
      and p_free_only is not null
    order by f.id
    -- Visibility and equality precede this sentinel; never truncate to unique.
    limit 101
  ) m;
$$;
revoke all on function public.lookup_ingredient_candidate_ids(text[],boolean,uuid) from public, anon, authenticated;
grant execute on function public.lookup_ingredient_candidate_ids(text[],boolean,uuid) to service_role;
