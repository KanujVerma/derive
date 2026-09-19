-- 20260919030000_i1_b2_restore_rpc_security_invoker_and_catalog_protection.sql
-- DERIVE I1-B2.3: Final Server Boundary Cleanup
-- 1. Restores commit_routine_proposal RPC to SECURITY INVOKER with least privilege (removes SECURITY DEFINER and deprecated auth.role() check).
-- 2. Hardens catalog provenance: untrusted provider model output cannot populate key_actives, full_ingredients, or retail_price_approx
--    for provisional (is_catalog_standard = false) products, neither on initial insert nor on conflict updates.
-- 3. Protects existing catalog standard products from metadata overwrites by untrusted provider output.
-- 4. Preserves member physical shelf confirmation (is_confirmed_by_user = true) across AI action changes.
-- 5. Explicit execution boundary: granted strictly to service_role; revoked from PUBLIC, anon, and authenticated.

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
security invoker
set search_path = ''
as $$
declare
  v_routine_id uuid;
  v_existing_routine record;
  v_prod jsonb;
  v_item jsonb;
  v_up jsonb;
  v_resolved_prod_id uuid;
begin
  if p_user_id is null then
    raise exception 'INVALID_ARGUMENT: p_user_id must not be null';
  end if;

  -- 1. Idempotency Check: if routine for (user_id, version) already exists, return existing
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

  -- 2. Normalize & upsert catalog products with Catalog Provenance Invariants
  -- Model outputs are untrusted. Only verified catalog standard items retain/populate formula fields.
  -- New/unverified proposed products persist brand, name, category, with empty key_actives, empty full_ingredients, and null price.
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
        -- Only catalog standard products may have key_actives; provisional proposed items persist empty array
        case
          when coalesce((v_prod->>'is_catalog_standard')::boolean, false) = true then
            coalesce((select array_agg(x) from jsonb_array_elements_text(v_prod->'key_actives') as x), '{}'::text[])
          else '{}'::text[]
        end,
        -- Only catalog standard products may have full_ingredients; provisional proposed items persist empty array
        case
          when coalesce((v_prod->>'is_catalog_standard')::boolean, false) = true then
            coalesce((select array_agg(x) from jsonb_array_elements_text(v_prod->'full_ingredients') as x), '{}'::text[])
          else '{}'::text[]
        end,
        -- Only catalog standard products may have retail_price_approx; provisional proposed items persist null
        case
          when coalesce((v_prod->>'is_catalog_standard')::boolean, false) = true then
            (v_prod->>'retail_price_approx')::numeric
          else null
        end,
        coalesce((v_prod->>'is_catalog_standard')::boolean, false)
      )
      on conflict (lower(trim(brand)), lower(trim(name)))
      do update set
        -- If existing product is catalog standard, preserve its category. Otherwise update if provided.
        category = case
          when products.is_catalog_standard = true then products.category
          else coalesce(excluded.category, products.category)
        end,
        -- Key Actives Protection:
        -- 1. If existing product is catalog standard, NEVER overwrite its verified key_actives with provider output.
        -- 2. If existing product is NOT catalog standard, NEVER accumulate provider key_actives into it!
        --    Only promote if excluded is explicitly catalog standard (via trusted founder/catalog promotion).
        key_actives = case
          when products.is_catalog_standard = true then products.key_actives
          when excluded.is_catalog_standard = true then excluded.key_actives
          else products.key_actives
        end,
        -- Full Ingredients Protection: same rule
        full_ingredients = case
          when products.is_catalog_standard = true then products.full_ingredients
          when excluded.is_catalog_standard = true then excluded.full_ingredients
          else products.full_ingredients
        end,
        -- Retail Price Protection: same rule
        retail_price_approx = case
          when products.is_catalog_standard = true then products.retail_price_approx
          when excluded.is_catalog_standard = true then excluded.retail_price_approx
          else products.retail_price_approx
        end,
        is_catalog_standard = products.is_catalog_standard or excluded.is_catalog_standard,
        updated_at = now();
    end loop;
  end if;

  -- 3. Insert version-1 routine in 'awaiting_review' status
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

  -- 4. Insert routine items with resolved product_id
  if p_routine_items is not null and jsonb_array_length(p_routine_items) > 0 then
    for v_item in select * from jsonb_array_elements(p_routine_items) loop
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

  -- 5. Insert / upsert user_products decisions with Provenance Preservation
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

  -- 6. Update pending founder review task notes
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

-- 7. Explicit ACL: Revoke from all non-service roles, grant strictly to service_role
revoke execute on function public.commit_routine_proposal(uuid, int, text, text, jsonb, jsonb, jsonb, text) from public;
revoke execute on function public.commit_routine_proposal(uuid, int, text, text, jsonb, jsonb, jsonb, text) from anon;
revoke execute on function public.commit_routine_proposal(uuid, int, text, text, jsonb, jsonb, jsonb, text) from authenticated;
grant execute on function public.commit_routine_proposal(uuid, int, text, text, jsonb, jsonb, jsonb, text) to service_role;
