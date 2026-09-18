begin;

select plan(25);

-- 1. Invariants on public.onboarding_submissions
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.onboarding_submissions'::regclass
  ),
  'RLS is enabled on public.onboarding_submissions'
);

-- 2. Privileges on onboarding_submissions (private table, service_role only)
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

-- 3. Function execute privileges on public.commit_onboarding_intake
select ok(
  not has_function_privilege('anon', 'public.commit_onboarding_intake(uuid,uuid,jsonb,jsonb,jsonb,text)', 'execute'),
  'anon role cannot execute public.commit_onboarding_intake'
);

select ok(
  not has_function_privilege('authenticated', 'public.commit_onboarding_intake(uuid,uuid,jsonb,jsonb,jsonb,text)', 'execute'),
  'authenticated role cannot execute public.commit_onboarding_intake'
);

select ok(
  has_function_privilege('service_role', 'public.commit_onboarding_intake(uuid,uuid,jsonb,jsonb,jsonb,text)', 'execute'),
  'service_role can execute public.commit_onboarding_intake'
);

-- Setup test users
insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1111111-1111-1111-1111-111111111111', 'member_b1_1@example.test', '{"full_name":"Member B1 One"}'::jsonb),
  ('a2222222-2222-2222-2222-222222222222', 'member_b1_2@example.test', '{"full_name":"Member B1 Two"}'::jsonb);

-- 4. Draft insertion and uniqueness
select lives_ok(
  $$
    insert into public.onboarding_submissions (
      id,
      user_id,
      status,
      front_storage_path,
      left_storage_path,
      right_storage_path
    ) values (
      'd1111111-1111-1111-1111-111111111111',
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

-- 5. Photo path category & user prefix defense in depth check constraints
select throws_ok(
  $$
    insert into public.onboarding_submissions (
      user_id,
      status,
      front_storage_path,
      left_storage_path,
      right_storage_path
    ) values (
      'a2222222-2222-2222-2222-222222222222',
      'draft',
      'wrong-user/front/photo.jpg',
      'a2222222-2222-2222-2222-222222222222/left/photo.jpg',
      'a2222222-2222-2222-2222-222222222222/right/photo.jpg'
    );
  $$,
  '23514',
  null,
  'front_storage_path not matching user_id/front/ violates check constraint'
);

-- 6. Canonical Storage path uniqueness on user_photos
select lives_ok(
  $$
    insert into public.user_photos (user_id, photo_type, storage_path)
    values ('a1111111-1111-1111-1111-111111111111', 'front', 'a1111111-1111-1111-1111-111111111111/front/unique_path.jpg');
  $$,
  'can insert photo with canonical storage path'
);

select throws_ok(
  $$
    insert into public.user_photos (user_id, photo_type, storage_path)
    values ('a2222222-2222-2222-2222-222222222222', 'front', 'a1111111-1111-1111-1111-111111111111/front/unique_path.jpg');
  $$,
  '23505',
  null,
  'duplicate storage_path on user_photos violates unique index'
);

-- 7. Founder review task pending initial_routine idempotency
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

-- Clean up the test task to prepare for RPC testing
delete from public.founder_review_tasks where user_id = 'a1111111-1111-1111-1111-111111111111';

-- 8. Atomic Transactional Commit RPC: Execution and Commit Verification
select lives_ok(
  $$
    select public.commit_onboarding_intake(
      'd1111111-1111-1111-1111-111111111111'::uuid,
      'a1111111-1111-1111-1111-111111111111'::uuid,
      '{"primaryGoal":"breakouts"}'::jsonb,
      '{"primary_goal":"breakouts","routine_complexity":"simple","cost_preference":"balanced","midday_feel":"combination","pregnancy_status":"unanswered","sensitivities_status":"unanswered"}'::jsonb,
      '[{"photo_type":"front","storage_path":"a1111111-1111-1111-1111-111111111111/front/photo1.jpg"},{"photo_type":"left","storage_path":"a1111111-1111-1111-1111-111111111111/left/photo2.jpg"},{"photo_type":"right","storage_path":"a1111111-1111-1111-1111-111111111111/right/photo3.jpg"}]'::jsonb,
      'Test intake notes'
    );
  $$,
  'commit_onboarding_intake executes successfully'
);

select ok(
  (
    select status = 'committed'
    from public.onboarding_submissions
    where id = 'd1111111-1111-1111-1111-111111111111'
  ),
  'submission status updated to committed'
);

select ok(
  (
    select onboarding_completed
    from public.skin_profiles
    where user_id = 'a1111111-1111-1111-1111-111111111111'
  ),
  'skin profile onboarding_completed set to true'
);

select is(
  (
    select count(*)::integer
    from public.founder_review_tasks
    where user_id = 'a1111111-1111-1111-1111-111111111111'
      and task_type = 'initial_routine'
      and status = 'pending'
  ),
  1,
  'exactly one pending initial_routine task created'
);

-- 9. Committed Initial Submission Uniqueness: only one committed initial submission per user
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
      'committed',
      'a1111111-1111-1111-1111-111111111111/front/photo1_dup.jpg',
      'a1111111-1111-1111-1111-111111111111/left/photo2_dup.jpg',
      'a1111111-1111-1111-1111-111111111111/right/photo3_dup.jpg'
    );
  $$,
  '23505',
  null,
  'second committed submission for same user violates unique committed index'
);

-- 10. Replay-safe / Idempotent execution of commit_onboarding_intake
select lives_ok(
  $$
    select public.commit_onboarding_intake(
      'd1111111-1111-1111-1111-111111111111'::uuid,
      'a1111111-1111-1111-1111-111111111111'::uuid,
      '{"primaryGoal":"breakouts"}'::jsonb,
      '{"primary_goal":"breakouts","routine_complexity":"simple","cost_preference":"balanced","midday_feel":"combination","pregnancy_status":"unanswered","sensitivities_status":"unanswered"}'::jsonb,
      '[{"photo_type":"front","storage_path":"a1111111-1111-1111-1111-111111111111/front/photo1.jpg"},{"photo_type":"left","storage_path":"a1111111-1111-1111-1111-111111111111/left/photo2.jpg"},{"photo_type":"right","storage_path":"a1111111-1111-1111-1111-111111111111/right/photo3.jpg"}]'::jsonb
    );
  $$,
  'replaying commit_onboarding_intake on already-committed submission succeeds'
);

select is(
  (
    select count(*)::integer
    from public.founder_review_tasks
    where user_id = 'a1111111-1111-1111-1111-111111111111'
      and task_type = 'initial_routine'
      and status = 'pending'
  ),
  1,
  'replay does not duplicate founder review tasks'
);

-- 11. Transactional rollback on invalid relational input
-- Setup a draft for member 2
insert into public.onboarding_submissions (
  id,
  user_id,
  status,
  front_storage_path,
  left_storage_path,
  right_storage_path
) values (
  'd2222222-2222-2222-2222-222222222222',
  'a2222222-2222-2222-2222-222222222222',
  'draft',
  'a2222222-2222-2222-2222-222222222222/front/photo1.jpg',
  'a2222222-2222-2222-2222-222222222222/left/photo2.jpg',
  'a2222222-2222-2222-2222-222222222222/right/photo3.jpg'
);

-- Calling RPC with invalid routine_complexity violates table check constraint
select throws_ok(
  $$
    select public.commit_onboarding_intake(
      'd2222222-2222-2222-2222-222222222222'::uuid,
      'a2222222-2222-2222-2222-222222222222'::uuid,
      '{"primaryGoal":"breakouts"}'::jsonb,
      '{"primary_goal":"breakouts","routine_complexity":"INVALID_COMPLEXITY","cost_preference":"balanced","midday_feel":"combination"}'::jsonb,
      '[{"photo_type":"front","storage_path":"a2222222-2222-2222-2222-222222222222/front/photo1.jpg"}]'::jsonb
    );
  $$,
  '23514',
  null,
  'invalid routine_complexity throws check_violation and rolls back'
);

-- Verify that all tables rolled back for member 2:
select ok(
  (
    select status = 'draft'
    from public.onboarding_submissions
    where id = 'd2222222-2222-2222-2222-222222222222'
  ),
  'onboarding submission status remains draft after rollback'
);

select is(
  (
    select count(*)::integer
    from public.skin_profiles
    where user_id = 'a2222222-2222-2222-2222-222222222222'
  ),
  0,
  'skin profile was rolled back completely'
);

select is(
  (
    select count(*)::integer
    from public.founder_review_tasks
    where user_id = 'a2222222-2222-2222-2222-222222222222'
  ),
  0,
  'founder review task was rolled back completely'
);

rollback;
