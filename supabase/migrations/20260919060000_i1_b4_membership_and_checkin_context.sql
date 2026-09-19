-- I1-B4: price-neutral membership identity and optional weekly check-in context.
-- This migration is deliberately additive. The historical baseline remains immutable.

-- Membership identity describes the cohort/plan, never its current experiment price.
update public.memberships
set tier = 'founding_beta'
where tier = 'founding_beta_129';

alter table public.memberships
  alter column tier set default 'founding_beta';

comment on column public.memberships.tier is
  'Price-neutral membership/cohort identity. Monetary terms are managed by trusted server-side commerce configuration.';

-- Preserve the fast check-in while allowing optional, explicitly observational context.
alter table public.check_ins
  add column if not exists primary_goal text,
  add column if not exists adherence text,
  add column if not exists context_tags text[] not null default '{}'::text[],
  add column if not exists context_note text;

alter table public.check_ins
  drop constraint if exists check_ins_primary_goal_check,
  add constraint check_ins_primary_goal_check check (
    primary_goal is null or primary_goal in (
      'breakouts',
      'dark_spots',
      'dryness',
      'oiliness',
      'texture',
      'redness',
      'fine_lines',
      'simplify',
      'maintain'
    )
  ),
  drop constraint if exists check_ins_adherence_check,
  add constraint check_ins_adherence_check check (
    adherence is null or adherence in ('yes', 'mostly', 'not_really')
  ),
  drop constraint if exists check_ins_context_tags_check,
  add constraint check_ins_context_tags_check check (
    cardinality(context_tags) <= 10
    and context_tags <@ array[
      'diet',
      'sleep',
      'stress',
      'alcohol',
      'cycle',
      'travel_weather',
      'new_product',
      'medication_supplement',
      'routine_change',
      'other'
    ]::text[]
  ),
  drop constraint if exists check_ins_context_note_length_check,
  add constraint check_ins_context_note_length_check check (
    context_note is null or char_length(context_note) <= 2000
  );

comment on column public.check_ins.context_tags is
  'Optional member-reported context observations. Tags are not causal findings and cannot independently drive treatment changes.';
comment on column public.check_ins.context_note is
  'Optional member explanation spanning selected context tags; may be entered by text or dictation.';

-- Members can append their own observations under existing owner-scoped INSERT RLS.
-- Server-generated analysis remains outside the client INSERT grant.
grant insert (
  user_id,
  skin_state,
  irritation,
  notes,
  primary_goal,
  adherence,
  context_tags,
  context_note
) on table public.check_ins to authenticated;
