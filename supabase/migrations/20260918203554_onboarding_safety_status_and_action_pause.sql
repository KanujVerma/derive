-- ====================================================================
-- Derive Additive Migration: Onboarding Safety Status & Action PAUSE
--
-- 1. Adds explicit pregnancy_status and sensitivities_status to public.skin_profiles
--    preserving provenance-bearing safety disclosures alongside legacy fields.
-- 2. Backfills existing skin_profiles records conservatively without fabricating
--    explicit negative disclosures from historical booleans/empty arrays.
-- 3. Updates least-privilege authenticated column grants on public.skin_profiles.
-- 4. Aligns public.user_products.action CHECK constraint with canonical RoutineAction
--    superset (KEEP, PAUSE, REPLACE, ADD, STOP).
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Additive Safety Status Columns on public.skin_profiles
-- --------------------------------------------------------------------

alter table public.skin_profiles
  add column if not exists pregnancy_status text,
  add column if not exists sensitivities_status text;

-- --------------------------------------------------------------------
-- 2. Conservative Epistemic Backfill of Existing Rows
-- --------------------------------------------------------------------

update public.skin_profiles
set
  pregnancy_status = case
    when is_pregnant_or_nursing is true then 'yes'
    else 'unanswered'
  end,
  sensitivities_status = case
    when known_sensitivities is not null and array_length(known_sensitivities, 1) > 0 then 'reported'
    else 'unanswered'
  end
where pregnancy_status is null or sensitivities_status is null;

-- --------------------------------------------------------------------
-- 3. Apply Default, NOT NULL, and Check Constraints
-- --------------------------------------------------------------------

alter table public.skin_profiles
  alter column pregnancy_status set default 'unanswered',
  alter column pregnancy_status set not null,
  add constraint skin_profiles_pregnancy_status_check
    check (pregnancy_status in ('yes', 'no', 'prefer_not_to_say', 'unanswered'));

alter table public.skin_profiles
  alter column sensitivities_status set default 'unanswered',
  alter column sensitivities_status set not null,
  add constraint skin_profiles_sensitivities_status_check
    check (sensitivities_status in ('none_known', 'reported', 'unanswered'));

-- --------------------------------------------------------------------
-- 4. Update Authenticated Column Grants
-- --------------------------------------------------------------------

grant insert (
  pregnancy_status,
  sensitivities_status
) on table public.skin_profiles to authenticated;

grant update (
  pregnancy_status,
  sensitivities_status
) on table public.skin_profiles to authenticated;

-- --------------------------------------------------------------------
-- 5. Align user_products Action Check Constraint to Include PAUSE
-- --------------------------------------------------------------------

-- Drop existing inline check constraint if present and install canonical superset
alter table public.user_products
  drop constraint if exists user_products_action_check;

alter table public.user_products
  add constraint user_products_action_check
    check (action in ('KEEP', 'PAUSE', 'REPLACE', 'ADD', 'STOP'));
