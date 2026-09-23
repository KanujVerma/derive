-- Shared, sourced product catalog search over the existing product and S6 identity tables.
create extension if not exists pg_trgm with schema extensions;

alter table public.products
  add column catalog_source_reference text,
  add column catalog_public_source_url text,
  add column catalog_observed_at timestamptz,
  add column catalog_verified_at timestamptz;
alter table public.products
  add constraint products_catalog_provenance_check check (
    catalog_verified_at is null or (
      catalog_source_reference is not null
      and length(trim(catalog_source_reference)) between 1 and 1000
      and catalog_observed_at is not null
    )
  );
alter table public.products
  add constraint products_catalog_public_url_check check (
    catalog_public_source_url is null or (
      catalog_public_source_url ~ '^https://[^/@?#]+(/[^?#]*)?$'
      and catalog_public_source_url !~ '[?@#]'
    )
  );

create unique index products_catalog_identity_unique_idx
  on public.products (lower(trim(brand)), lower(trim(name)))
  where is_catalog_standard = true and catalog_verified_at is not null;
create index products_catalog_brand_prefix_idx
  on public.products (lower(brand) text_pattern_ops)
  where is_catalog_standard = true and catalog_verified_at is not null;
create index products_catalog_name_prefix_idx
  on public.products (lower(name) text_pattern_ops)
  where is_catalog_standard = true and catalog_verified_at is not null;
create index products_catalog_full_prefix_idx
  on public.products (lower(brand || ' ' || name) text_pattern_ops)
  where is_catalog_standard = true and catalog_verified_at is not null;
create index products_catalog_brand_trgm_idx
  on public.products using gin (lower(brand) extensions.gin_trgm_ops)
  where is_catalog_standard = true and catalog_verified_at is not null;
create index products_catalog_name_trgm_idx
  on public.products using gin (lower(name) extensions.gin_trgm_ops)
  where is_catalog_standard = true and catalog_verified_at is not null;
create index products_catalog_full_trgm_idx
  on public.products using gin (lower(brand || ' ' || name) extensions.gin_trgm_ops)
  where is_catalog_standard = true and catalog_verified_at is not null;

create table public.product_search_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  alias text not null,
  source_reference text not null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint product_search_aliases_name_check check (length(trim(alias)) between 2 and 180),
  constraint product_search_aliases_source_check check (length(trim(source_reference)) between 1 and 1000)
);
create unique index product_search_aliases_identity_idx
  on public.product_search_aliases (product_id, lower(trim(alias)));
create index product_search_aliases_product_idx
  on public.product_search_aliases (product_id);
create index product_search_aliases_prefix_idx
  on public.product_search_aliases (lower(alias) text_pattern_ops);
create index product_search_aliases_trgm_idx
  on public.product_search_aliases using gin (lower(alias) extensions.gin_trgm_ops);
alter table public.product_search_aliases enable row level security;
revoke all privileges on table public.product_search_aliases from public, anon, authenticated;
grant select, insert, update, delete on table public.product_search_aliases to service_role;

create or replace function public.search_product_catalog(p_query text, p_limit integer default 10)
returns table (
  product_id uuid,
  brand text,
  name text,
  category text,
  image_url text,
  is_catalog_standard boolean,
  variant_count integer,
  formula_state text
)
language sql
stable
security invoker
set search_path = ''
set pg_trgm.word_similarity_threshold = '0.45'
as $$
  with normalized as (
    select trim(regexp_replace(
      regexp_replace(lower(trim(coalesce(p_query, ''))), '[^[:alnum:] ]+', ' ', 'g'),
      '[[:space:]]+', ' ', 'g'
    )) as q
  ),
  product_matches as (
    select p.id as product_id,
      case
        when lower(p.brand || ' ' || p.name) = n.q then 0
        when lower(p.name) = n.q then 1
        when lower(p.brand || ' ' || p.name) like n.q || '%' then 3
        when lower(p.name) like n.q || '%' then 3
        when lower(p.brand) like n.q || '%' then 3
        when length(n.q) >= 3 and (
          lower(p.name) like '%' || n.q || '%'
          or lower(p.brand || ' ' || p.name) like '%' || n.q || '%'
        ) then 5
        else 6
      end as match_rank,
      greatest(
        extensions.word_similarity(n.q, lower(p.name)),
        extensions.word_similarity(n.q, lower(p.brand || ' ' || p.name))
      ) as fuzzy_score
    from public.products p cross join normalized n
    where p.is_catalog_standard = true and p.catalog_verified_at is not null
      and length(n.q) between 2 and 80
      and (
        lower(p.brand) like n.q || '%'
        or lower(p.name) like n.q || '%'
        or lower(p.brand || ' ' || p.name) like n.q || '%'
        or (length(n.q) >= 3 and (
          lower(p.name) like '%' || n.q || '%'
          or lower(p.brand || ' ' || p.name) like '%' || n.q || '%'
          or n.q operator(extensions.<%) lower(p.name)
          or n.q operator(extensions.<%) lower(p.brand)
        ))
      )
  ),
  alias_matches as (
    select a.product_id,
      case
        when lower(a.alias) = n.q then 2
        when lower(a.alias) like n.q || '%' then 4
        when length(n.q) >= 3 and lower(a.alias) like '%' || n.q || '%' then 5
        else 6
      end as match_rank,
      extensions.word_similarity(n.q, lower(a.alias)) as fuzzy_score
    from public.product_search_aliases a
    join public.products p on p.id = a.product_id
    cross join normalized n
    where p.is_catalog_standard = true and p.catalog_verified_at is not null
      and length(n.q) between 2 and 80
      and (
        lower(a.alias) like n.q || '%'
        or (length(n.q) >= 3 and (
          lower(a.alias) like '%' || n.q || '%'
          or n.q operator(extensions.<%) lower(a.alias)
        ))
      )
  ),
  all_matches as (
    select * from product_matches
    union all
    select * from alias_matches
  ),
  best as (
    select distinct on (product_id) product_id, match_rank, fuzzy_score
    from all_matches
    order by product_id, match_rank, fuzzy_score desc
  )
  select p.id, p.brand, p.name, p.category,
    null::text, -- Image URLs have no public-source provenance yet.
    true,
    (select count(*)::integer from public.product_variants v
      where v.product_id = p.id and v.lifecycle_status = 'active'),
    case (
      select count(distinct f.id)
      from public.product_variants v
      join public.product_identifiers i on i.variant_id = v.id
      join public.product_formula_versions f on f.id = i.formula_version_id and f.variant_id = v.id
      where v.product_id = p.id and v.lifecycle_status = 'active'
        and i.verified_at is not null
        and i.source_authority in ('manufacturer', 'gs1', 'founder')
        and f.verification_status = 'verified'
        and f.provenance_type in ('manufacturer', 'package_label', 'regulator', 'founder_review')
    ) when 0 then 'unverified' when 1 then 'verified_variant_available' else 'multiple_versions' end
  from best b join public.products p on p.id = b.product_id
  order by b.match_rank, case when b.match_rank = 6 then b.fuzzy_score end desc nulls last,
    lower(p.brand), lower(p.name), p.id
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
$$;

revoke all on function public.search_product_catalog(text,integer) from public, anon, authenticated;
grant execute on function public.search_product_catalog(text,integer) to service_role;

-- Existing global product reads included member-specific provisional products.
-- Keep canonical catalog visible, but scope provisional rows to the member's shelf.
drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated on public.products for select to authenticated
using (
  is_catalog_standard is true
  or exists (
    select 1 from public.user_products own_shelf
    where own_shelf.product_id = products.id
      and own_shelf.user_id = (select auth.uid())
  )
);

-- Keep operator provenance private while preserving the pre-existing safe
-- product fields used by member Shelf and routine projections.
revoke select on table public.products from authenticated;
grant select (
  id, brand, name, category, key_actives, full_ingredients,
  retail_price_approx, is_catalog_standard, created_at, updated_at,
  image_url, cautions
) on table public.products to authenticated;
