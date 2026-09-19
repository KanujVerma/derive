-- Migration: 20260919010000_i1_b2_routine_intelligence_and_persistence.sql
-- DERIVE I1-B2 Server-Side Initial Routine Intelligence, Canonical Product Normalization & Awaiting-Review Persistence

-- 1. Reconciliation: Add updated_at to public.routines with private.set_updated_at() trigger
alter table public.routines
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists routines_set_updated_at on public.routines;
create trigger routines_set_updated_at
  before update on public.routines
  for each row execute function private.set_updated_at();

-- 2. Idempotency: Enforce unique (user_id, version) on public.routines
drop index if exists public.routines_user_id_version_idx;
alter table public.routines
  drop constraint if exists routines_user_id_version_unique,
  add constraint routines_user_id_version_unique unique (user_id, version);

-- 3. Product Catalog: Add updated_at and unique index on (lower(trim(brand)), lower(trim(name)))
alter table public.products
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

create unique index if not exists products_brand_name_idx
  on public.products (lower(trim(brand)), lower(trim(name)));

-- 4. Reconciliation: Add product_id UUID REFERENCES public.products(id) to public.routine_items
alter table public.routine_items
  add column if not exists product_id uuid references public.products(id) on delete restrict;

create index if not exists routine_items_product_id_idx
  on public.routine_items (product_id);

-- 5. User Products: Ensure unique (user_id, product_id) when product_id is not null
create unique index if not exists user_products_user_product_idx
  on public.user_products (user_id, product_id)
  where product_id is not null;

create index if not exists user_products_user_id_idx
  on public.user_products (user_id);

-- 6. Atomic Routine Proposal Persistence RPC
create or replace function public.commit_routine_proposal(
  p_user_id uuid,
  p_version int,
  p_summary_sentence text,
  p_founder_notes text,
  p_products jsonb,
  p_routine_items jsonb,
  p_user_products jsonb,
  p_task_notes text default 'Initial routine generated (v1). Awaiting founder review.'
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_routine record;
  v_routine_id uuid;
  v_prod jsonb;
  v_item jsonb;
  v_up jsonb;
  v_resolved_prod_id uuid;
begin
  -- 1. Concurrency control: Lock user profile to serialize persistence attempts for this user
  perform id from public.profiles where id = p_user_id for update;

  -- 2. Replay idempotency: Check if routine for (user_id, version) already exists
  select id, status, version, summary_sentence, created_at, updated_at, published_at, founder_notes
  into v_existing_routine
  from public.routines
  where user_id = p_user_id and version = p_version;

  if found then
    return jsonb_build_object(
      'routine_id', v_existing_routine.id,
      'status', v_existing_routine.status,
      'version', v_existing_routine.version,
      'replayed', true
    );
  end if;

  -- 3. Normalize & upsert catalog products
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
        coalesce((select array_agg(x) from jsonb_array_elements_text(v_prod->'full_ingredients') as x), '{}'::text[]),
        (v_prod->>'retail_price_approx')::numeric,
        coalesce((v_prod->>'is_catalog_standard')::boolean, true)
      )
      on conflict (lower(trim(brand)), lower(trim(name)))
      do update set
        key_actives = case when array_length(excluded.key_actives, 1) > 0 then excluded.key_actives else products.key_actives end,
        category = excluded.category,
        full_ingredients = case when array_length(excluded.full_ingredients, 1) > 0 then excluded.full_ingredients else products.full_ingredients end,
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

  -- 6. Insert / upsert user_products decisions
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
        coalesce((v_up->>'is_confirmed_by_user')::boolean, true),
        now()
      )
      on conflict (user_id, product_id) where product_id is not null
      do update set
        action = excluded.action,
        action_reason = excluded.action_reason,
        frequency_nights_per_week = excluded.frequency_nights_per_week,
        is_confirmed_by_user = excluded.is_confirmed_by_user;
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

-- 7. Grant execution strictly to service_role; revoke from public, anon, authenticated
revoke all on function public.commit_routine_proposal from public, anon, authenticated;
grant execute on function public.commit_routine_proposal to service_role;

-- 8. Grant select on newly added routine columns to authenticated (founder_notes remains founder-only)
grant select (updated_at) on table public.routines to authenticated;
