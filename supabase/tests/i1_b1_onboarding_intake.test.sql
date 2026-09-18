begin;

select plan(12);

-- 1. Invariants on public.onboarding_submissions
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.onboarding_submissions'::regclass
  ),
  'RLS is enabled on public.onboarding_submissions'
);

-- 2. Privileges on onboarding_submissions
select ok(
  not has_table_privilege('anon', 'public.onboarding_submissions', 'select')
    and not has_table_privilege('anon', 'public.onboarding_submissions', 'insert')
    and not has_table_privilege('anon', 'public.onboarding_submissions', 'update')
    and not has_table_privilege('anon', 'public.onboarding_submissions', 'delete'),
  'anon role has zero privileges on public.onboarding_submissions'
);

select ok(
  not has_table_privilege('authenticated', 'public.onboarding_submissions', 'select')
    and not has_table_privilege('authenticated', 'public.onboarding_submissions', 'insert')
    and not has_table_privilege('authenticated', 'public.onboarding_submissions', 'update')
    and not has_table_privilege('authenticated', 'public.onboarding_submissions', 'delete'),
  'authenticated role has zero privileges on public.onboarding_submissions'
);

select ok(
  has_table_privilege('service_role', 'public.onboarding_submissions', 'select')
    and has_table_privilege('service_role', 'public.onboarding_submissions', 'insert')
    and has_table_privilege('service_role', 'public.onboarding_submissions', 'update')
    and has_table_privilege('service_role', 'public.onboarding_submissions', 'delete'),
  'service_role has full table privileges on public.onboarding_submissions'
);

-- Setup test users
insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1111111-1111-1111-1111-111111111111', 'member_b1_1@example.test', '{"full_name":"Member B1 One"}'::jsonb),
  ('a2222222-2222-2222-2222-222222222222', 'member_b1_2@example.test', '{"full_name":"Member B1 Two"}'::jsonb);

-- 3. Draft insertion and uniqueness
select lives_ok(
  $$
    insert into public.onboarding_submissions (
      user_id,
      status,
      front_storage_path,
      left_storage_path,
      right_storage_path
    ) values (
      'a1111111-1111-1111-1111-111111111111',
      'draft',
      'a1111111-1111-1111-1111-111111111111/front/photo1.jpg',
      'a1111111-1111-1111-1111-111111111111/left/photo2.jpg',
      'a1111111-1111-1111-1111-111111111111/right/photo3.jpg'
    );
  $$,
  'service_role can insert initial draft onboarding submission'
);

select throws_ok(
  $$
    insert into public.onboarding_submissions (
      user_id,
      status,
      front_storage_path,
      left_storage_path,
      right_storage_path
    ) values (
      'a1111111-1111-1111-1111-111111111111',
      'draft',
      'a1111111-1111-1111-1111-111111111111/front/photo1_alt.jpg',
      'a1111111-1111-1111-1111-111111111111/left/photo2_alt.jpg',
      'a1111111-1111-1111-1111-111111111111/right/photo3_alt.jpg'
    );
  $$,
  '23505',
  null,
  'duplicate draft submission for same user violates partial unique index'
);

-- Commit the draft
update public.onboarding_submissions
set status = 'committed', committed_at = now()
where user_id = 'a1111111-1111-1111-1111-111111111111';

select lives_ok(
  $$
    insert into public.onboarding_submissions (
      user_id,
      status,
      front_storage_path,
      left_storage_path,
      right_storage_path
    ) values (
      'a1111111-1111-1111-1111-111111111111',
      'draft',
      'a1111111-1111-1111-1111-111111111111/front/photo1_new.jpg',
      'a1111111-1111-1111-1111-111111111111/left/photo2_new.jpg',
      'a1111111-1111-1111-1111-111111111111/right/photo3_new.jpg'
    );
  $$,
  'new draft can be inserted after previous submission committed'
);

-- 4. Founder review task pending initial_routine idempotency
select lives_ok(
  $$
    insert into public.founder_review_tasks (
      user_id,
      task_type,
      status
    ) values (
      'a1111111-1111-1111-1111-111111111111',
      'initial_routine',
      'pending'
    );
  $$,
  'first pending initial_routine review task inserts cleanly'
);

select throws_ok(
  $$
    insert into public.founder_review_tasks (
      user_id,
      task_type,
      status
    ) values (
      'a1111111-1111-1111-1111-111111111111',
      'initial_routine',
      'pending'
    );
  $$,
  '23505',
  null,
  'duplicate pending initial_routine task violates partial unique index'
);

select lives_ok(
  $$
    insert into public.founder_review_tasks (
      user_id,
      task_type,
      status
    ) values (
      'a1111111-1111-1111-1111-111111111111',
      'routine_adjustment',
      'pending'
    );
  $$,
  'different task_type allows pending status for same user'
);

select lives_ok(
  $$
    insert into public.founder_review_tasks (
      user_id,
      task_type,
      status
    ) values (
      'a2222222-2222-2222-2222-222222222222',
      'initial_routine',
      'pending'
    );
  $$,
  'different user can have pending initial_routine task'
);

-- 5. Trigger updates updated_at
select ok(
  (
    select count(*) = 1
    from pg_trigger
    where tgrelid = 'public.onboarding_submissions'::regclass
      and tgname = 'onboarding_submissions_set_updated_at'
  ),
  'updated_at trigger exists on public.onboarding_submissions'
);

rollback;
