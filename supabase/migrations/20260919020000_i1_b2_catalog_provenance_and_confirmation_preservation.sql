-- 20260919020000_i1_b2_catalog_provenance_and_confirmation_preservation.sql
-- DERIVE I1-B2.2: Provider-Neutral Intelligence Boundary, Catalog Provenance & Trust Closure
-- Hardens commit_routine_proposal RPC:
-- 1. Catalog Provenance: Trusted products (is_catalog_standard = true) are immutable to provider metadata.
-- 2. New model-proposed products default to is_catalog_standard = false with empty unverified formula fields.
-- 3. Confirmation Provenance: An existing confirmed shelf product (is_confirmed_by_user = true) is never
--    downgraded to false when an AI proposal alters its action (e.g. PAUSE, REPLACE, STOP).

create or replace function public.commit_routine_proposal(
  p_user_id uuid,
  p_version int,
  p_summary_sentence text,
  p_founder_notes text default null,
  p_products jsonb default '[]'::jsonb,
  p_routine_items jsonb default '[]'::jsonb,
  p_user_products jsonb default '[]'::jsonb,
  p_task_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_routine_id uuid;
  v_existing_routine record;
  v_prod jsonb;
  v_item jsonb;
  v_up jsonb;
  v_resolved_prod_id uuid;
begin
  -- 1. Authorization & Role check: strictly service_role only
  if auth.role() <> 'service_role' then
    raise exception 'FORBIDDEN: commit_routine_proposal can only be executed by service_role';
  end if;

  if p_user_id is null then
    raise exception 'INVALID_ARGUMENT: p_user_id must not be null';
  end if;

  -- 2. Idempotency Check: if routine for (user_id, version) already exists, return existing
  select id, status, version
  into v_existing_routine
  from public.routines
  where user_id = p_user_id
    and version = p_version;

  if found then
    return jsonb_build_object(
      'routine_id', v_existing_routine.id,
      'status', v_existing_routine.status,
      'version', v_existing_routine.version,
      'replayed', true
    );
  end if;

  -- 3. Normalize & upsert catalog products with Catalog Provenance Invariants
  if p_products is not null and jsonb_array_length(p_products) > 0 then
    for v_prod in select * from jsonb_array_elements(p_products) loop
      insert into public.products (
        brand,
        name,
        category,
        key_actives,
        full_ingredients,
        retail_price_approx,
        is_catalog_standard
      ) values (
        trim(v_prod->>'brand'),
        trim(v_prod->>'name'),
        v_prod->>'category',
        coalesce((select array_agg(x) from jsonb_array_elements_text(v_prod->'key_actives') as x), '{}'::text[]),
        -- For new non-catalog products, do NOT promote unverified formula to verified full_ingredients
        case
          when coalesce((v_prod->>'is_catalog_standard')::boolean, false) = true then
            coalesce((select array_agg(x) from jsonb_array_elements_text(v_prod->'full_ingredients') as x), '{}'::text[])
          else '{}'::text[]
        end,
        case
          when coalesce((v_prod->>'is_catalog_standard')::boolean, false) = true then
            (v_prod->>'retail_price_approx')::numeric
          else null
        end,
        coalesce((v_prod->>'is_catalog_standard')::boolean, false)
      )
      on conflict (lower(trim(brand)), lower(trim(name)))
      do update set
        -- TRUSTED CATALOG PROTECTION: If the existing product is catalog standard, NEVER overwrite its formula or metadata!
        category = case when products.is_catalog_standard = true then products.category else excluded.category end,
        key_actives = case when products.is_catalog_standard = true then products.key_actives else excluded.key_actives end,
        full_ingredients = case when products.is_catalog_standard = true then products.full_ingredients else excluded.full_ingredients end,
        retail_price_approx = case when products.is_catalog_standard = true then products.retail_price_approx else excluded.retail_price_approx end,
        updated_at = now();
    end loop;
  end if;

  -- 4. Insert version-1 routine in 'awaiting_review' status
  insert into public.routines (
    user_id,
    version,
    status,
    summary_sentence,
    founder_notes,
    created_at,
    updated_at
  ) values (
    p_user_id,
    p_version,
    'awaiting_review',
    p_summary_sentence,
    p_founder_notes,
    now(),
    now()
  )
  returning id into v_routine_id;

  -- 5. Insert routine items with resolved product_id
  if p_routine_items is not null and jsonb_array_length(p_routine_items) > 0 then
    for v_item in select * from jsonb_array_elements(p_routine_items) loop
      -- Resolve product_id: either explicitly provided or via brand & name lookup in products
      v_resolved_prod_id := null;
      if (v_item->>'product_id') is not null and (v_item->>'product_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        select id into v_resolved_prod_id from public.products where id = (v_item->>'product_id')::uuid;
      end if;

      if v_resolved_prod_id is null then
        select id into v_resolved_prod_id
        from public.products
        where lower(trim(brand)) = lower(trim(v_item->>'brand'))
          and lower(trim(name)) = lower(trim(v_item->>'product_name'))
        limit 1;
      end if;

      if v_resolved_prod_id is null then
        raise exception 'PRODUCT_RESOLUTION_FAILED: Product % by % cannot be resolved in catalog',
          v_item->>'product_name', v_item->>'brand';
      end if;

      insert into public.routine_items (
        routine_id,
        order_index,
        timing,
        product_id,
        product_name,
        brand,
        category,
        amount,
        area,
        days,
        purpose,
        why_chosen,
        watch_for,
        created_at
      ) values (
        v_routine_id,
        (v_item->>'order_index')::int,
        v_item->>'timing',
        v_resolved_prod_id,
        v_item->>'product_name',
        v_item->>'brand',
        v_item->>'category',
        v_item->>'amount',
        v_item->>'area',
        coalesce((select array_agg(x) from jsonb_array_elements_text(v_item->'days') as x), '{}'::text[]),
        v_item->>'purpose',
        v_item->>'why_chosen',
        v_item->>'watch_for',
        now()
      );
    end loop;
  end if;

  -- 6. Insert / upsert user_products decisions with Provenance Preservation
  if p_user_products is not null and jsonb_array_length(p_user_products) > 0 then
    for v_up in select * from jsonb_array_elements(p_user_products) loop
      v_resolved_prod_id := null;
      if (v_up->>'product_id') is not null and (v_up->>'product_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        select id into v_resolved_prod_id from public.products where id = (v_up->>'product_id')::uuid;
      end if;

      if v_resolved_prod_id is null and (v_up->>'detected_brand') is not null and (v_up->>'detected_name') is not null then
        select id into v_resolved_prod_id
        from public.products
        where lower(trim(brand)) = lower(trim(v_up->>'detected_brand'))
          and lower(trim(name)) = lower(trim(v_up->>'detected_name'))
        limit 1;
      end if;

      insert into public.user_products (
        user_id,
        product_id,
        detected_brand,
        detected_name,
        action,
        action_reason,
        frequency_nights_per_week,
        is_confirmed_by_user,
        created_at
      ) values (
        p_user_id,
        v_resolved_prod_id,
        v_up->>'detected_brand',
        v_up->>'detected_name',
        v_up->>'action',
        v_up->>'action_reason',
        (v_up->>'frequency_nights_per_week')::int,
        coalesce((v_up->>'is_confirmed_by_user')::boolean, false),
        now()
      )
      on conflict (user_id, product_id) where product_id is not null
      do update set
        action = excluded.action,
        action_reason = excluded.action_reason,
        frequency_nights_per_week = excluded.frequency_nights_per_week,
        -- PROVENANCE PRESERVATION: If the product was already confirmed by the user (e.g. from onboarding),
        -- do NOT downgrade it to false just because an AI proposal changed the action!
        is_confirmed_by_user = case
          when user_products.is_confirmed_by_user = true then true
          else excluded.is_confirmed_by_user
        end;
    end loop;
  end if;

  -- 7. Update pending founder review task notes
  update public.founder_review_tasks
  set notes = p_task_notes
  where user_id = p_user_id
    and task_type = 'initial_routine'
    and status = 'pending';

  return jsonb_build_object(
    'routine_id', v_routine_id,
    'status', 'awaiting_review',
    'version', p_version,
    'replayed', false
  );
end;
$$;

-- 8. Server Runtime Configuration Table (Service Role Only)
-- Provides a secure, server-side configuration store for runtime intelligence providers and server policies.
-- Inaccessible to customer roles (anon, authenticated).
create table if not exists public.server_runtime_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.server_runtime_config enable row level security;

revoke all on public.server_runtime_config from anon, authenticated;
grant select, insert, update, delete on public.server_runtime_config to service_role;

