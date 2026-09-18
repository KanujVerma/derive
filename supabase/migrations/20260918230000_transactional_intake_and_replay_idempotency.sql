-- Migration: transactional_intake_and_replay_idempotency
-- DERIVE I1-B1.1 Transactional Intake Finalization, Auth Gate & Canonical Post-Commit Routing

-- 1. Enforce at most one committed initial onboarding submission per user
create unique index if not exists onboarding_submissions_committed_user_idx
  on public.onboarding_submissions (user_id)
  where status = 'committed';

-- 2. Enforce canonical Storage path uniqueness on user_photos for idempotent retries
create unique index if not exists user_photos_storage_path_idx
  on public.user_photos (storage_path);

-- 3. Enforce photo path defense in depth (matching user_id prefix and expected category)
alter table public.onboarding_submissions
  drop constraint if exists onboarding_submissions_front_path_check,
  add constraint onboarding_submissions_front_path_check
    check (front_storage_path like (user_id::text || '/front/%'));

alter table public.onboarding_submissions
  drop constraint if exists onboarding_submissions_left_path_check,
  add constraint onboarding_submissions_left_path_check
    check (left_storage_path like (user_id::text || '/left/%'));

alter table public.onboarding_submissions
  drop constraint if exists onboarding_submissions_right_path_check,
  add constraint onboarding_submissions_right_path_check
    check (right_storage_path like (user_id::text || '/right/%'));

alter table public.onboarding_submissions
  drop constraint if exists onboarding_submissions_shelf_path_check,
  add constraint onboarding_submissions_shelf_path_check
    check (shelf_storage_path is null or shelf_storage_path like (user_id::text || '/shelf/%'));

-- 4. Atomic Transactional Intake Commit RPC
create or replace function public.commit_onboarding_intake(
  p_submission_id uuid,
  p_user_id uuid,
  p_payload_snapshot jsonb,
  p_skin_profile jsonb,
  p_photos jsonb,
  p_task_notes text default 'Intake committed. Initial routine pending review.'
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_submission record;
  v_skin_profile record;
  v_photo jsonb;
begin
  -- 1. Lock and verify onboarding submission row for authenticated caller
  select id, status, front_storage_path, left_storage_path, right_storage_path, shelf_storage_path
  into v_submission
  from public.onboarding_submissions
  where id = p_submission_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'SUBMISSION_NOT_FOUND: Submission % does not exist or does not belong to user %', p_submission_id, p_user_id;
  end if;

  -- 2. Replay idempotency: if already committed, return the existing canonical skin profile
  if v_submission.status = 'committed' then
    select * into v_skin_profile
    from public.skin_profiles
    where user_id = p_user_id;

    if not found or not v_skin_profile.onboarding_completed then
      raise exception 'INVALID_COMMITTED_STATE: Submission is committed but skin profile is incomplete';
    end if;

    return to_jsonb(v_skin_profile);
  end if;

  -- 3. Upsert skin_profiles with onboarding_completed = false
  insert into public.skin_profiles (
    user_id,
    primary_goal,
    secondary_goals,
    routine_complexity,
    cost_preference,
    midday_feel,
    post_cleanse_tightness,
    known_sensitivities,
    sensitivities_status,
    active_prescriptions,
    is_pregnant_or_nursing,
    pregnancy_status,
    additional_notes,
    onboarding_completed
  ) values (
    p_user_id,
    p_skin_profile->>'primary_goal',
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_skin_profile->'secondary_goals') as x), '{}'::text[]),
    p_skin_profile->>'routine_complexity',
    p_skin_profile->>'cost_preference',
    p_skin_profile->>'midday_feel',
    coalesce((p_skin_profile->>'post_cleanse_tightness')::boolean, false),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_skin_profile->'known_sensitivities') as x), '{}'::text[]),
    coalesce(p_skin_profile->>'sensitivities_status', 'unanswered'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_skin_profile->'active_prescriptions') as x), '{}'::text[]),
    coalesce((p_skin_profile->>'is_pregnant_or_nursing')::boolean, false),
    coalesce(p_skin_profile->>'pregnancy_status', 'unanswered'),
    p_skin_profile->>'additional_notes',
    false
  )
  on conflict (user_id) do update set
    primary_goal = excluded.primary_goal,
    secondary_goals = excluded.secondary_goals,
    routine_complexity = excluded.routine_complexity,
    cost_preference = excluded.cost_preference,
    midday_feel = excluded.midday_feel,
    post_cleanse_tightness = excluded.post_cleanse_tightness,
    known_sensitivities = excluded.known_sensitivities,
    sensitivities_status = excluded.sensitivities_status,
    active_prescriptions = excluded.active_prescriptions,
    is_pregnant_or_nursing = excluded.is_pregnant_or_nursing,
    pregnancy_status = excluded.pregnancy_status,
    additional_notes = excluded.additional_notes,
    onboarding_completed = false;

  -- 4. Idempotently insert photo metadata into public.user_photos
  for v_photo in select * from jsonb_array_elements(p_photos) loop
    insert into public.user_photos (
      user_id,
      photo_type,
      storage_path
    ) values (
      p_user_id,
      v_photo->>'photo_type',
      v_photo->>'storage_path'
    )
    on conflict (storage_path) do nothing;
  end loop;

  -- 5. Idempotently insert pending initial_routine founder review task
  if not exists (
    select 1 from public.founder_review_tasks
    where user_id = p_user_id
      and task_type = 'initial_routine'
      and status = 'pending'
  ) then
    insert into public.founder_review_tasks (
      user_id,
      task_type,
      status,
      priority,
      notes
    ) values (
      p_user_id,
      'initial_routine',
      'pending',
      'normal',
      p_task_notes
    );
  end if;

  -- 6. Set onboarding_completed = true strictly last on skin_profiles
  update public.skin_profiles
  set onboarding_completed = true,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_skin_profile;

  -- 7. Mark onboarding submission committed
  update public.onboarding_submissions
  set status = 'committed',
      payload_snapshot = p_payload_snapshot,
      committed_at = coalesce(committed_at, now()),
      updated_at = now()
  where id = p_submission_id;

  return to_jsonb(v_skin_profile);
end;
$$;

-- 5. Revoke execution from public, anon, authenticated; grant only to service_role
revoke all on function public.commit_onboarding_intake from public, anon, authenticated;
grant execute on function public.commit_onboarding_intake to service_role;
