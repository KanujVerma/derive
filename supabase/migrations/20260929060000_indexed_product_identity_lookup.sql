-- Bound exact typed identity lookup without dropping variants or formula versions.
-- The key mirrors the resolver's NFKC/case/three-hyphen/space normalization.
create or replace function private.product_identity_lookup_key(p_value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(
    replace(replace(replace(lower(normalize(p_value, NFKC)), '-', ' '), '‐', ' '), '‑', ' '),
    '[[:space:]]+', ' ', 'g'
  ));
$$;

revoke all on function private.product_identity_lookup_key(text) from public, anon, authenticated;
grant execute on function private.product_identity_lookup_key(text) to service_role;

create index products_identity_lookup_key_idx
  on public.products (
    private.product_identity_lookup_key(brand),
    private.product_identity_lookup_key(name),
    id
  );

-- Returning the 101st ID is an explicit overflow signal. The Edge caller
-- rejects the whole request rather than silently truncating ambiguous matches.
create or replace function public.lookup_product_identity_exact_ids(
  p_brand_key text,
  p_name_key text,
  p_free_only boolean,
  p_user_id uuid
)
returns uuid[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(m.id order by m.id), '{}'::uuid[])
  from (
    select p.id
    from public.products p
    where length(coalesce(p_brand_key, '')) between 1 and 120
      and length(coalesce(p_name_key, '')) between 1 and 180
      and private.product_identity_lookup_key(p.brand) = p_brand_key
      and private.product_identity_lookup_key(p.name) = p_name_key
      and case
        when p_free_only is true then p.is_catalog_standard = true and p.catalog_verified_at is not null
        when p_free_only is false then p.is_catalog_standard = true or exists (
          select 1 from public.user_products own_shelf
          where own_shelf.product_id = p.id and own_shelf.user_id = p_user_id
        )
        else false
      end
    order by p.id
    limit 101
  ) m;
$$;

revoke all on function public.lookup_product_identity_exact_ids(text,text,boolean,uuid)
  from public, anon, authenticated;
grant execute on function public.lookup_product_identity_exact_ids(text,text,boolean,uuid)
  to service_role;

-- S-FREE-1's managed-member predicate exposed every other member's private
-- provisional product through the Data API. Keep shared standard products
-- available to managed members while preserving shelf-linked owner reads.
drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated on public.products for select to authenticated
using (
  ((select public.current_member_is_active()) and is_catalog_standard is true)
  or exists (
    select 1 from public.user_products own_shelf
    where own_shelf.product_id = products.id
      and own_shelf.user_id = (select auth.uid())
  )
);
