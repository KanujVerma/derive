-- I1-B4B: additive weekly check-in context, adherence, and historical primary goal.
-- Never rewrite 20260915_init.sql. Context tags are CONTEXT, not proven causes.

alter table public.check_ins
  add column if not exists context_tags text[] not null default '{}',
  add column if not exists context_note text,
  add column if not exists adherence text,
  add column if not exists primary_goal text;

alter table public.check_ins
  drop constraint if exists check_ins_context_tags_allowed,
  drop constraint if exists check_ins_context_tags_no_null,
  drop constraint if exists check_ins_context_note_length,
  drop constraint if exists check_ins_notes_length,
  drop constraint if exists check_ins_adherence_check,
  drop constraint if exists check_ins_primary_goal_check;

alter table public.check_ins
  add constraint check_ins_context_tags_allowed
    check (
      context_tags <@ array[
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
  add constraint check_ins_context_tags_no_null
    check (array_position(context_tags, null) is null),
  add constraint check_ins_context_note_length
    check (context_note is null or char_length(context_note) <= 4000),
  add constraint check_ins_notes_length
    check (notes is null or char_length(notes) <= 4000),
  add constraint check_ins_adherence_check
    check (adherence is null or adherence in ('yes', 'mostly', 'not_really')),
  add constraint check_ins_primary_goal_check
    check (
      primary_goal is null
      or primary_goal in (
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
    );

-- Additive column grants for user-reported fields. ai_analysis_sentence stays server-owned.
grant insert (context_tags, context_note, adherence, primary_goal)
  on table public.check_ins to authenticated;
