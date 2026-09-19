begin;

select plan(71);

-- Schema, policy, privilege, auth-provisioning, and bucket invariants.
select results_eq(
  $$
    select relname::text collate "default"
    from pg_class
    where oid in (
      'public.profiles'::regclass,
      'public.memberships'::regclass,
      'public.skin_profiles'::regclass,
      'public.products'::regclass,
      'public.user_products'::regclass,
      'public.routines'::regclass,
      'public.routine_items'::regclass,
      'public.user_photos'::regclass,
      'public.check_ins'::regclass,
      'public.refill_requests'::regclass,
      'public.founder_review_tasks'::regclass
    )
      and relrowsecurity
    order by relname
  $$,
  array[
    'check_ins',
    'founder_review_tasks',
    'memberships',
    'products',
    'profiles',
    'refill_requests',
    'routine_items',
    'routines',
    'skin_profiles',
    'user_photos',
    'user_products'
  ],
  'RLS is enabled on every public application table'
);

select results_eq(
  $$
    select (tablename || '.' || policyname || ':' || cmd || ':' || array_to_string(roles, ',')) collate "default"
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'profiles',
        'memberships',
        'skin_profiles',
        'products',
        'user_products',
        'routines',
        'routine_items',
        'user_photos',
        'check_ins',
        'refill_requests',
        'founder_review_tasks'
      ])
    order by tablename, policyname
  $$,
  array[
    'check_ins.check_ins_insert_own:INSERT:authenticated',
    'check_ins.check_ins_select_own:SELECT:authenticated',
    'memberships.memberships_select_own:SELECT:authenticated',
    'products.products_select_authenticated:SELECT:authenticated',
    'profiles.profiles_select_own:SELECT:authenticated',
    'profiles.profiles_update_own:UPDATE:authenticated',
    'refill_requests.refill_requests_insert_own:INSERT:authenticated',
    'refill_requests.refill_requests_select_own:SELECT:authenticated',
    'routine_items.routine_items_select_own:SELECT:authenticated',
    'routines.routines_select_own:SELECT:authenticated',
    'skin_profiles.skin_profiles_insert_own:INSERT:authenticated',
    'skin_profiles.skin_profiles_select_own:SELECT:authenticated',
    'skin_profiles.skin_profiles_update_own:UPDATE:authenticated',
    'user_photos.user_photos_insert_own_path:INSERT:authenticated',
    'user_photos.user_photos_select_own:SELECT:authenticated',
    'user_products.user_products_delete_own:DELETE:authenticated',
    'user_products.user_products_insert_own:INSERT:authenticated',
    'user_products.user_products_select_own:SELECT:authenticated',
    'user_products.user_products_update_own:UPDATE:authenticated'
  ],
  'public application tables have exactly the audited policy set'
);

select results_eq(
  $$
    select (policyname || ':' || cmd || ':' || array_to_string(roles, ',')) collate "default"
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
    order by policyname
  $$,
  array['customer_skin_photos_insert_own:INSERT:authenticated'],
  'Storage has only the immutable member-path upload policy'
);

select results_eq(
  $$
    select tgname::text collate "default"
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
      and tgname like 'derive_profile_after_auth_%'
    order by tgname
  $$,
  array[
    'derive_profile_after_auth_identity_update',
    'derive_profile_after_auth_insert'
  ],
  'Derive installs namespaced auth lifecycle triggers without replacing unrelated triggers'
);

select ok(
  (
    select prosecdef
      and coalesce(array_to_string(proconfig, ','), '') like '%search_path=%'
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'private'
      and pg_proc.proname = 'handle_auth_user_change'
  ),
  'auth provisioning is SECURITY DEFINER with an explicitly pinned search path'
);

select ok(
  not has_function_privilege('anon', 'private.handle_auth_user_change()', 'execute')
    and not has_function_privilege('authenticated', 'private.handle_auth_user_change()', 'execute')
    and not has_function_privilege('anon', 'private.set_updated_at()', 'execute')
    and not has_function_privilege('authenticated', 'private.set_updated_at()', 'execute'),
  'client roles cannot invoke private trigger functions directly'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'owner@example.test',
    '{"full_name":"Owner Test"}'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'other@example.test',
    '{"full_name":"Other Test"}'::jsonb
  );

select results_eq(
  $$select email from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  array['owner@example.test'],
  'auth signup provisions a matching profile'
);

select results_eq(
  $$select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  array['Owner Test'],
  'auth signup copies non-authoritative display metadata'
);

update auth.users
set email = 'owner-updated@example.test'
where id = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$select email from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  array['owner-updated@example.test'],
  'auth identity updates synchronize profile email'
);

select results_eq(
  $$select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  array['Owner Test'],
  'auth identity synchronization does not overwrite a retained display name'
);

select results_eq(
  $$select public::text from storage.buckets where id = 'customer-skin-photos'$$,
  array['false'],
  'customer photo bucket is private'
);

select results_eq(
  $$select file_size_limit::bigint from storage.buckets where id = 'customer-skin-photos'$$,
  array[10485760::bigint],
  'customer photo bucket limits files to 10 MiB'
);

select results_eq(
  $$
    select mime_type
    from storage.buckets,
      unnest(allowed_mime_types) as mime_type
    where id = 'customer-skin-photos'
    order by mime_type
  $$,
  array['image/heic', 'image/heif', 'image/jpeg', 'image/png', 'image/webp'],
  'customer photo bucket accepts only the reviewed image MIME types'
);

select ok(
  not has_table_privilege('anon', 'public.profiles', 'select'),
  'anonymous role has no profile table privileges'
);

select ok(
  has_column_privilege('authenticated', 'public.memberships', 'tier', 'select'),
  'authenticated role can select the safe membership tier column'
);

select ok(
  not has_column_privilege('authenticated', 'public.memberships', 'stripe_customer_id', 'select')
    and not has_column_privilege('authenticated', 'public.memberships', 'stripe_subscription_id', 'select'),
  'authenticated role has no payment-identifier column privileges'
);

select ok(
  has_column_privilege('authenticated', 'public.routines', 'summary_sentence', 'select'),
  'authenticated role can select customer-facing routine fields'
);

select ok(
  not has_column_privilege('authenticated', 'public.routines', 'founder_notes', 'select'),
  'authenticated role has no founder-note column privilege'
);

select ok(
  not has_table_privilege('authenticated', 'public.user_photos', 'delete'),
  'authenticated role cannot delete photo metadata outside the server workflow'
);

select ok(
  not has_table_privilege('authenticated', 'public.founder_review_tasks', 'select'),
  'authenticated role has no founder-review task privileges'
);

select ok(
  not has_column_privilege(
    'authenticated',
    'public.skin_profiles',
    'onboarding_completed',
    'insert'
  )
    and not has_column_privilege(
      'authenticated',
      'public.skin_profiles',
      'onboarding_completed',
      'update'
    )
    and not has_column_privilege(
      'authenticated',
      'public.user_products',
      'user_id',
      'update'
    ),
  'authenticated role cannot forge server completion or reassign shelf ownership'
);

select ok(
  has_column_privilege('authenticated', 'public.skin_profiles', 'pregnancy_status', 'select')
    and has_column_privilege('authenticated', 'public.skin_profiles', 'pregnancy_status', 'insert')
    and has_column_privilege('authenticated', 'public.skin_profiles', 'pregnancy_status', 'update')
    and has_column_privilege('authenticated', 'public.skin_profiles', 'sensitivities_status', 'select')
    and has_column_privilege('authenticated', 'public.skin_profiles', 'sensitivities_status', 'insert')
    and has_column_privilege('authenticated', 'public.skin_profiles', 'sensitivities_status', 'update'),
  'authenticated role has select, insert, and update column privileges for pregnancy_status and sensitivities_status'
);

create function public.s1_default_privilege_probe()
returns integer
language sql
as $$ select 1 $$;

select ok(
  not has_function_privilege('anon', 'public.s1_default_privilege_probe()', 'execute')
    and not has_function_privilege(
      'authenticated',
      'public.s1_default_privilege_probe()',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.s1_default_privilege_probe()',
      'execute'
    ),
  'future postgres-owned functions default to server-only execution'
);

insert into public.memberships (
  user_id, tier, status, stripe_customer_id, stripe_subscription_id
)
values (
  '11111111-1111-1111-1111-111111111111',
  'founding_beta',
  'active',
  'cus_server_only',
  'sub_server_only'
);

insert into public.products (id, brand, name, category)
values (
  '33333333-3333-3333-3333-333333333333',
  'Test Brand',
  'Test Cleanser',
  'cleanser'
);

insert into public.routines (id, user_id, status, summary_sentence, founder_notes)
values (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  'awaiting_review',
  'Test routine',
  'server-only note'
);

insert into public.routine_items (
  routine_id,
  order_index,
  timing,
  product_name,
  brand,
  category,
  amount,
  area,
  purpose,
  why_chosen
)
values (
  '44444444-4444-4444-4444-444444444444',
  1,
  'am',
  'Test Cleanser',
  'Test Brand',
  'cleanser',
  'one pump',
  'face',
  'cleanse',
  'test fixture'
);

insert into public.founder_review_tasks (user_id, task_type, notes)
values (
  '11111111-1111-1111-1111-111111111111',
  'initial_routine',
  'server-only review note'
);

-- Anonymous role: no public application-table privileges.
set local role anon;

select throws_ok(
  $$select * from public.profiles$$,
  '42501',
  null,
  'anonymous users cannot read profiles'
);

select throws_ok(
  $$select * from public.products$$,
  '42501',
  null,
  'anonymous users cannot read the member catalog'
);

-- Authenticated owner: member operations and protected server fields.
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$select email from public.profiles$$,
  array['owner-updated@example.test'],
  'a member reads only their own profile'
);

select results_eq(
  $$update public.profiles set full_name = 'Updated Owner' returning full_name$$,
  array['Updated Owner'],
  'a member updates an allowed field on their own profile'
);

select throws_ok(
  $$update public.profiles set email = 'forged@example.test'$$,
  '42501',
  null,
  'a member cannot overwrite auth-owned email'
);

select results_eq(
  $$
    insert into public.skin_profiles (
      user_id, primary_goal, routine_complexity, cost_preference, midday_feel
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      'breakouts',
      'simple',
      'balanced',
      'balanced'
    )
    returning primary_goal
  $$,
  array['breakouts'],
  'a member creates their own skin profile'
);

select results_eq(
  $$select pregnancy_status, sensitivities_status from public.skin_profiles$$,
  $$values ('unanswered'::text, 'unanswered'::text)$$,
  'skin_profiles defaults pregnancy_status and sensitivities_status to unanswered'
);

select results_eq(
  $$
    update public.skin_profiles
    set pregnancy_status = 'prefer_not_to_say', sensitivities_status = 'none_known'
    returning pregnancy_status, sensitivities_status
  $$,
  $$values ('prefer_not_to_say'::text, 'none_known'::text)$$,
  'a member updates pregnancy_status and sensitivities_status on their own skin profile'
);

select throws_ok(
  $$update public.skin_profiles set pregnancy_status = 'maybe'$$,
  '23514',
  null,
  'skin_profiles rejects invalid pregnancy_status check constraint'
);

select throws_ok(
  $$update public.skin_profiles set sensitivities_status = 'invalid_val'$$,
  '23514',
  null,
  'skin_profiles rejects invalid sensitivities_status check constraint'
);

select throws_ok(
  $$
    insert into public.skin_profiles (
      user_id, primary_goal, routine_complexity, cost_preference, midday_feel
    )
    values (
      '22222222-2222-2222-2222-222222222222',
      'breakouts',
      'simple',
      'balanced',
      'balanced'
    )
  $$,
  '42501',
  null,
  'a member cannot create another member skin profile'
);

select results_eq(
  $$select primary_goal from public.skin_profiles$$,
  array['breakouts'],
  'a member reads their own skin profile'
);

select results_eq(
  $$select name from public.products$$,
  array['Test Cleanser'],
  'an authenticated member can read the catalog'
);

select throws_ok(
  $$insert into public.products (brand, name, category) values ('Bad', 'Write', 'test')$$,
  '42501',
  null,
  'a member cannot write the catalog'
);

select results_eq(
  $$select tier from public.memberships$$,
  array['founding_beta'],
  'a member reads their own non-secret membership fields'
);

select throws_ok(
  $$select stripe_customer_id from public.memberships$$,
  '42501',
  null,
  'a member cannot read server-only payment identifiers'
);

select results_eq(
  $$select summary_sentence from public.routines$$,
  array['Test routine'],
  'a member reads their own routine'
);

select throws_ok(
  $$select founder_notes from public.routines$$,
  '42501',
  null,
  'a member cannot read founder-only routine notes'
);

select throws_ok(
  $$update public.routines set status = 'published'$$,
  '42501',
  null,
  'a member cannot publish their own routine'
);

select results_eq(
  $$select product_name from public.routine_items$$,
  array['Test Cleanser'],
  'a member reads items from their own routine'
);

select throws_ok(
  $$select * from public.founder_review_tasks$$,
  '42501',
  null,
  'a member cannot access founder review tasks'
);

select results_eq(
  $$
    insert into public.user_products (user_id, product_id, action, action_reason)
    values (
      '11111111-1111-1111-1111-111111111111',
      '33333333-3333-3333-3333-333333333333',
      'KEEP',
      'test fixture'
    )
    returning action
  $$,
  array['KEEP'],
  'a member adds a product to their own shelf'
);

select throws_ok(
  $$
    insert into public.user_products (user_id, product_id, action)
    values (
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      'KEEP'
    )
  $$,
  '42501',
  null,
  'a member cannot add a product to another member shelf'
);

select results_eq(
  $$update public.user_products set action = 'REPLACE' returning action$$,
  array['REPLACE'],
  'a member updates a product on their own shelf'
);

select results_eq(
  $$update public.user_products set action = 'PAUSE' returning action$$,
  array['PAUSE'],
  'user_products accepts PAUSE action'
);

select throws_ok(
  $$update public.user_products set action = 'DISCARD' returning action$$,
  '23514',
  null,
  'user_products rejects invalid action'
);

select results_eq(
  $$
    insert into public.check_ins (user_id, skin_state, irritation, notes)
    values (
      '11111111-1111-1111-1111-111111111111',
      'same',
      'none',
      'member note'
    )
    returning skin_state
  $$,
  array['same'],
  'a member submits their own check-in inputs'
);

select throws_ok(
  $$update public.check_ins set ai_analysis_sentence = 'forged analysis'$$,
  '42501',
  null,
  'a member cannot write server analysis fields'
);

select throws_ok(
  $$
    insert into public.check_ins (user_id, skin_state, irritation)
    values (
      '22222222-2222-2222-2222-222222222222',
      'same',
      'none'
    )
  $$,
  '42501',
  null,
  'a member cannot submit a check-in for another member'
);

select results_eq(
  $$
    insert into public.refill_requests (user_id, product_name, brand)
    values (
      '11111111-1111-1111-1111-111111111111',
      'Test Cleanser',
      'Test Brand'
    )
    returning status
  $$,
  array['requested'],
  'a member requests their own refill with server defaults'
);

select throws_ok(
  $$update public.refill_requests set status = 'delivered'$$,
  '42501',
  null,
  'a member cannot advance fulfillment state'
);

select throws_ok(
  $$
    insert into public.refill_requests (user_id, product_name, brand)
    values (
      '22222222-2222-2222-2222-222222222222',
      'Test Cleanser',
      'Test Brand'
    )
  $$,
  '42501',
  null,
  'a member cannot request a refill for another member'
);

select results_eq(
  $$
    insert into public.user_photos (user_id, photo_type, storage_path)
    values (
      '11111111-1111-1111-1111-111111111111',
      'front',
      '11111111-1111-1111-1111-111111111111/front/test.jpg'
    )
    returning photo_type
  $$,
  array['front'],
  'photo metadata must use the member-owned path prefix'
);

select throws_ok(
  $$
    insert into public.user_photos (user_id, photo_type, storage_path)
    values (
      '11111111-1111-1111-1111-111111111111',
      'front',
      '22222222-2222-2222-2222-222222222222/front/stolen.jpg'
    )
  $$,
  '42501',
  null,
  'photo metadata cannot point at another member namespace'
);

select throws_ok(
  $$delete from public.user_photos$$,
  '42501',
  null,
  'photo metadata deletion is reserved for the trusted deletion workflow'
);

-- Rolled-back metadata policy unit test, not an object upload. Production must
-- use the Storage API with a unique path and upsert=false.
select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'customer-skin-photos',
      '11111111-1111-1111-1111-111111111111/front/object.jpg',
      '11111111-1111-1111-1111-111111111111'
    )
  $$,
  'the Storage insert policy accepts the member namespace'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'customer-skin-photos',
      '22222222-2222-2222-2222-222222222222/front/stolen.jpg',
      '11111111-1111-1111-1111-111111111111'
    )
  $$,
  '42501',
  null,
  'the Storage insert policy rejects another member namespace'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'customer-skin-photos',
      '11111111-1111-1111-1111-111111111111/front/spoofed-owner.jpg',
      '22222222-2222-2222-2222-222222222222'
    )
  $$,
  '42501',
  null,
  'the Storage insert policy rejects a spoofed object owner'
);

select is_empty(
  $$select name from storage.objects where bucket_id = 'customer-skin-photos'$$,
  'members cannot directly list or read private photo objects'
);

-- Authenticated stranger: every owner relation filters the first member rows.
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select is_empty(
  $$select tier from public.memberships$$,
  'another member cannot read the owner membership'
);

select is_empty(
  $$select summary_sentence from public.routines$$,
  'another member cannot read the owner routine'
);

select is_empty(
  $$select product_name from public.routine_items$$,
  'another member cannot read items from the owner routine'
);

select is_empty(
  $$select primary_goal from public.skin_profiles$$,
  'another member cannot read the owner skin profile'
);

select is_empty(
  $$select action from public.user_products$$,
  'another member cannot read the owner shelf'
);

select is_empty(
  $$select skin_state from public.check_ins$$,
  'another member cannot read the owner check-ins'
);

select is_empty(
  $$select status from public.refill_requests$$,
  'another member cannot read the owner refill requests'
);

select is_empty(
  $$select storage_path from public.user_photos$$,
  'another member cannot read owner photo metadata'
);

select is_empty(
  $$
    select email
    from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  'another member cannot read the owner profile'
);

select * from finish();
rollback;
