begin;

select plan(17);

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

select * from finish();
rollback;
