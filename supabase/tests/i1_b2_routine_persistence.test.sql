begin;

select plan(30);

-- 1. routines.updated_at exists and defaults correctly
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'routines'
      and column_name = 'updated_at'
      and data_type = 'timestamp with time zone'
  ),
  'public.routines.updated_at column exists with timestamptz type'
);

-- 2. routine_items.product_id FK exists
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'routine_items'
      and column_name = 'product_id'
      and data_type = 'uuid'
  ),
  'public.routine_items.product_id column exists with uuid type'
);

select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'routine_items'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) like '%REFERENCES products(id)%'
  ),
  'public.routine_items.product_id has foreign key reference to public.products(id)'
);

-- 3. Client roles do not gain unauthorized routine mutation rights
select ok(
  not has_table_privilege('anon', 'public.routines', 'insert')
    and not has_table_privilege('anon', 'public.routines', 'update')
    and not has_table_privilege('anon', 'public.routines', 'delete')
    and not has_table_privilege('authenticated', 'public.routines', 'insert')
    and not has_table_privilege('authenticated', 'public.routines', 'update')
    and not has_table_privilege('authenticated', 'public.routines', 'delete'),
  'Neither anon nor authenticated has insert, update, or delete privileges on public.routines'
);

select ok(
  not has_table_privilege('anon', 'public.routine_items', 'insert')
    and not has_table_privilege('anon', 'public.routine_items', 'update')
    and not has_table_privilege('anon', 'public.routine_items', 'delete')
    and not has_table_privilege('authenticated', 'public.routine_items', 'insert')
    and not has_table_privilege('authenticated', 'public.routine_items', 'update')
    and not has_table_privilege('authenticated', 'public.routine_items', 'delete'),
  'Neither anon nor authenticated has insert, update, or delete privileges on public.routine_items'
);

-- 4. Function execute privileges on public.commit_routine_proposal
select ok(
  not has_function_privilege('anon', 'public.commit_routine_proposal(uuid,integer,text,text,jsonb,jsonb,jsonb,text)', 'execute'),
  'anon role cannot execute public.commit_routine_proposal'
);

select ok(
  not has_function_privilege('authenticated', 'public.commit_routine_proposal(uuid,integer,text,text,jsonb,jsonb,jsonb,text)', 'execute'),
  'authenticated role cannot execute public.commit_routine_proposal'
);

select ok(
  has_function_privilege('service_role', 'public.commit_routine_proposal(uuid,integer,text,text,jsonb,jsonb,jsonb,text)', 'execute'),
  'service_role can execute public.commit_routine_proposal'
);

select ok(
  not has_function_privilege('public', 'public.commit_routine_proposal(uuid,integer,text,text,jsonb,jsonb,jsonb,text)', 'execute'),
  'public pseudo-role cannot execute public.commit_routine_proposal'
);

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'commit_routine_proposal'
      and not prosecdef
  ),
  'public.commit_routine_proposal is SECURITY INVOKER (not SECURITY DEFINER)'
);

-- Setup test user and catalog product
insert into auth.users (id, email, raw_user_meta_data)
values ('b2222222-2222-2222-2222-222222222222', 'member_b2@example.test', '{"full_name":"Member B2 Synthetic"}'::jsonb);

insert into public.products (id, brand, name, category, key_actives)
values ('c1111111-1111-1111-1111-111111111111', 'La Roche-Posay', 'Toleriane Hydrating Gentle Cleanser', 'cleanser', '{"Ceramides", "Niacinamide"}');

-- 5. Canonical server path can insert awaiting_review routine
select lives_ok(
  $$
    insert into public.routines (
      id,
      user_id,
      version,
      status,
      summary_sentence,
      created_at,
      updated_at
    ) values (
      'd1111111-1111-1111-1111-111111111111',
      'b2222222-2222-2222-2222-222222222222',
      1,
      'awaiting_review',
      'Gentle barrier-supportive routine focused on balancing midday oil.',
      now() - interval '1 hour',
      now() - interval '1 hour'
    );
  $$,
  'Server can insert routine in awaiting_review status'
);

-- 6. routines.updated_at trigger works
select lives_ok(
  $$
    update public.routines
    set summary_sentence = 'Updated barrier-supportive routine summary.'
    where id = 'd1111111-1111-1111-1111-111111111111';
  $$,
  'Can update routine row'
);

select ok(
  (
    select updated_at > created_at
    from public.routines
    where id = 'd1111111-1111-1111-1111-111111111111'
  ),
  'routines.updated_at trigger automatically advances updated_at on modification'
);

-- 7. Version-1 duplicate protection (unique user_id, version)
select throws_ok(
  $$
    insert into public.routines (
      user_id,
      version,
      status,
      summary_sentence
    ) values (
      'b2222222-2222-2222-2222-222222222222',
      1,
      'awaiting_review',
      'Duplicate version 1 proposal attempt'
    );
  $$,
  '23505', -- unique_violation
  NULL,
  'Duplicate (user_id, version) insertion is blocked by unique index'
);

-- 8. routine_items product FK integrity
select lives_ok(
  $$
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
      why_chosen
    ) values (
      'd1111111-1111-1111-1111-111111111111',
      1,
      'am',
      'c1111111-1111-1111-1111-111111111111',
      'Toleriane Hydrating Gentle Cleanser',
      'La Roche-Posay',
      'cleanser',
      '1 pump',
      'Entire face',
      '{"mon", "tue", "wed", "thu", "fri", "sat", "sun"}',
      'Gentle AM Cleanse',
      'Barrier-supportive formulation'
    );
  $$,
  'Can insert routine_item with valid product_id foreign key'
);

select throws_ok(
  $$
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
      why_chosen
    ) values (
      'd1111111-1111-1111-1111-111111111111',
      2,
      'am',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      'Nonexistent Product',
      'FakeBrand',
      'cleanser',
      '1 pump',
      'Entire face',
      '{}',
      'Invalid FK test',
      'Invalid rationale'
    );
  $$,
  '23503', -- foreign_key_violation
  NULL,
  'routine_items product_id foreign key constraint blocks non-existent catalog products'
);

-- 9. User products PAUSE, STOP, and invalid action rejection
select lives_ok(
  $$
    insert into public.user_products (
      user_id,
      product_id,
      action,
      action_reason
    ) values
      ('b2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'PAUSE', 'Paused to evaluate barrier recovery'),
      ('b2222222-2222-2222-2222-222222222222', null, 'STOP', 'Discontinued due to irritation');
  $$,
  'user_products accepts both PAUSE and STOP actions'
);

select throws_ok(
  $$
    insert into public.user_products (
      user_id,
      product_id,
      action,
      action_reason
    ) values (
      'b2222222-2222-2222-2222-222222222222',
      'c1111111-1111-1111-1111-111111111111',
      'INVALID_ACTION',
      'Testing invalid action check'
    );
  $$,
  '23514', -- check_violation
  NULL,
  'user_products rejects invalid action enum values'
);

-- 10. Founder review task allowed statuses remain unchanged
select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'founder_review_tasks'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%status = ANY (%pending%completed%dismissed%)%'
  ),
  'founder_review_tasks status constraint permits only pending, completed, dismissed'
);

-- 11. commit_routine_proposal: catalog provenance and confirmation preservation
insert into auth.users (id, email, raw_user_meta_data)
values ('b3333333-3333-3333-3333-333333333333', 'member_b2_commit@example.test', '{"full_name":"Member B2 Commit Test"}'::jsonb);

insert into public.products (id, brand, name, category, key_actives, full_ingredients, is_catalog_standard)
values (
  'c2222222-2222-2222-2222-222222222222',
  'SkinCeuticals',
  'C E Ferulic',
  'treatment',
  '{"Vitamin C", "Vitamin E", "Ferulic Acid"}',
  '{"Water", "Ethoxydiglycol", "L-Ascorbic Acid", "Propylene Glycol", "Glycerin", "Laureth-23", "Alpha Tocopherol", "Phenoxyethanol", "Triethanolamine", "Ferulic Acid", "Panthenol", "Sodium Hyaluronate"}',
  true
);

insert into public.user_products (
  user_id,
  product_id,
  detected_brand,
  detected_name,
  action,
  action_reason,
  is_confirmed_by_user
) values (
  'b3333333-3333-3333-3333-333333333333',
  'c2222222-2222-2222-2222-222222222222',
  'SkinCeuticals',
  'C E Ferulic',
  'KEEP',
  'Active morning antioxidant',
  true
);

set local role service_role;

select public.commit_routine_proposal(
  'b3333333-3333-3333-3333-333333333333'::uuid,
  1,
  'Barrier recovery proposal',
  'Test founder notes',
  '[
    {
      "brand": "SkinCeuticals",
      "name": "C E Ferulic",
      "category": "cleanser",
      "key_actives": ["Fake Active"],
      "full_ingredients": ["Fake Ingredient"],
      "is_catalog_standard": false
    },
    {
      "brand": "Brand X",
      "name": "Barrier Cream",
      "category": "moisturizer",
      "key_actives": ["Ceramides"],
      "full_ingredients": ["Unverified Formula"],
      "is_catalog_standard": false
    }
  ]'::jsonb,
  '[
    {
      "order_index": 1,
      "timing": "am",
      "brand": "SkinCeuticals",
      "product_name": "C E Ferulic",
      "category": "treatment",
      "amount": "4 drops",
      "area": "face",
      "days": ["mon", "wed", "fri"],
      "purpose": "Antioxidant protection",
      "why_chosen": "Proven efficacy"
    }
  ]'::jsonb,
  '[
    {
      "product_id": "c2222222-2222-2222-2222-222222222222",
      "detected_brand": "SkinCeuticals",
      "detected_name": "C E Ferulic",
      "action": "PAUSE",
      "action_reason": "Paused while healing",
      "frequency_nights_per_week": 0,
      "is_confirmed_by_user": false
    },
    {
      "detected_brand": "Brand X",
      "detected_name": "Barrier Cream",
      "action": "ADD",
      "action_reason": "Support barrier",
      "frequency_nights_per_week": 7,
      "is_confirmed_by_user": false
    }
  ]'::jsonb,
  'Pending review task notes'
);

-- 18. Check that user_products.is_confirmed_by_user was NOT downgraded to false for SkinCeuticals
select is(
  (
    select is_confirmed_by_user
    from public.user_products
    where user_id = 'b3333333-3333-3333-3333-333333333333'
      and product_id = 'c2222222-2222-2222-2222-222222222222'
  ),
  true,
  'Existing confirmed product maintains is_confirmed_by_user = true across action change to PAUSE'
);

-- 19. Check that new ADD product has is_confirmed_by_user = false
select is(
  (
    select is_confirmed_by_user
    from public.user_products
    where user_id = 'b3333333-3333-3333-3333-333333333333'
      and detected_brand = 'Brand X'
  ),
  false,
  'Newly proposed ADD product has is_confirmed_by_user = false'
);

-- 20. Check that SkinCeuticals category was NOT overwritten by provider
select is(
  (
    select category
    from public.products
    where id = 'c2222222-2222-2222-2222-222222222222'
  ),
  'treatment',
  'Trusted catalog standard product category is preserved and not overwritten'
);

-- 21. Check that Brand X was inserted with is_catalog_standard = false and empty full_ingredients
select ok(
  exists (
    select 1
    from public.products
    where brand = 'Brand X'
      and name = 'Barrier Cream'
      and is_catalog_standard = false
      and full_ingredients = '{}'::text[]
  ),
  'New model-proposed product is inserted with is_catalog_standard = false and empty full_ingredients'
);

-- 22. Check that SkinCeuticals key_actives was NOT overwritten by provider
select is(
  (
    select key_actives
    from public.products
    where id = 'c2222222-2222-2222-2222-222222222222'
  ),
  '{"Vitamin C", "Vitamin E", "Ferulic Acid"}'::text[],
  'Trusted catalog standard product key_actives is preserved and not overwritten'
);

-- 23. Check that SkinCeuticals full_ingredients was NOT overwritten by provider
select is(
  (
    select full_ingredients
    from public.products
    where id = 'c2222222-2222-2222-2222-222222222222'
  ),
  '{"Water", "Ethoxydiglycol", "L-Ascorbic Acid", "Propylene Glycol", "Glycerin", "Laureth-23", "Alpha Tocopherol", "Phenoxyethanol", "Triethanolamine", "Ferulic Acid", "Panthenol", "Sodium Hyaluronate"}'::text[],
  'Trusted catalog standard product full_ingredients is preserved and not overwritten'
);

-- 24. Check that Brand X key_actives was persisted as empty array (provider key_actives not promoted)
select ok(
  exists (
    select 1
    from public.products
    where brand = 'Brand X'
      and name = 'Barrier Cream'
      and key_actives = '{}'::text[]
  ),
  'New model-proposed product is persisted with empty key_actives array'
);

-- 25. Check that Brand X retail_price_approx is null
select ok(
  exists (
    select 1
    from public.products
    where brand = 'Brand X'
      and name = 'Barrier Cream'
      and retail_price_approx is null
  ),
  'New model-proposed product is persisted with null retail_price_approx'
);

-- 26. Subsequent proposal on existing provisional row does NOT accumulate model-generated facts
select public.commit_routine_proposal(
  'b3333333-3333-3333-3333-333333333333'::uuid,
  2,
  'Second proposal for test user',
  'Second notes',
  '[
    {
      "brand": "Brand X",
      "name": "Barrier Cream",
      "category": "treatment",
      "key_actives": ["Hallucinated Active 2"],
      "full_ingredients": ["Hallucinated Ingredient 2"],
      "retail_price_approx": 99.99,
      "is_catalog_standard": false
    }
  ]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Task notes 2'
);

select ok(
  exists (
    select 1
    from public.products
    where brand = 'Brand X'
      and name = 'Barrier Cream'
      and is_catalog_standard = false
      and key_actives = '{}'::text[]
      and full_ingredients = '{}'::text[]
      and retail_price_approx is null
  ),
  'Subsequent proposal does not accumulate hallucinated key_actives, ingredients, or price into provisional product'
);

-- 22. Client roles have zero access to public.server_runtime_config
select ok(
  not has_table_privilege('anon', 'public.server_runtime_config', 'select')
    and not has_table_privilege('anon', 'public.server_runtime_config', 'insert')
    and not has_table_privilege('anon', 'public.server_runtime_config', 'update')
    and not has_table_privilege('anon', 'public.server_runtime_config', 'delete')
    and not has_table_privilege('authenticated', 'public.server_runtime_config', 'select')
    and not has_table_privilege('authenticated', 'public.server_runtime_config', 'insert')
    and not has_table_privilege('authenticated', 'public.server_runtime_config', 'update')
    and not has_table_privilege('authenticated', 'public.server_runtime_config', 'delete'),
  'Neither anon nor authenticated has privileges on public.server_runtime_config'
);

-- 23. service_role has privileges on public.server_runtime_config
select ok(
  has_table_privilege('service_role', 'public.server_runtime_config', 'select')
    and has_table_privilege('service_role', 'public.server_runtime_config', 'insert')
    and has_table_privilege('service_role', 'public.server_runtime_config', 'update')
    and has_table_privilege('service_role', 'public.server_runtime_config', 'delete'),
  'service_role has full select, insert, update, delete on public.server_runtime_config'
);

select * from finish();
rollback;
