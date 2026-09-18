-- Migration: onboarding_intake_submission_and_idempotency
-- DERIVE I1-B1 Authenticated Remote Onboarding Intake Commit & Private Photo Pipeline

create table if not exists public.onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'committed')),
  front_storage_path text not null,
  left_storage_path text not null,
  right_storage_path text not null,
  shelf_storage_path text,
  payload_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  committed_at timestamptz
);

-- Ensure only one active draft per member
create unique index if not exists onboarding_submissions_active_draft_idx
  on public.onboarding_submissions (user_id)
  where status = 'draft';

create index if not exists onboarding_submissions_user_status_idx
  on public.onboarding_submissions (user_id, status);

-- Auto-update updated_at on modification
drop trigger if exists onboarding_submissions_set_updated_at on public.onboarding_submissions;
create trigger onboarding_submissions_set_updated_at
  before update on public.onboarding_submissions
  for each row execute function private.set_updated_at();

-- Restrict to service_role only (same isolation pattern as founder_review_tasks)
alter table public.onboarding_submissions enable row level security;
revoke all on table public.onboarding_submissions from anon, authenticated;
grant all on table public.onboarding_submissions to service_role;

-- Ensure idempotency for pending initial_routine review task
create unique index if not exists founder_review_tasks_pending_initial_routine_idx
  on public.founder_review_tasks (user_id, task_type)
  where task_type = 'initial_routine' and status = 'pending';
