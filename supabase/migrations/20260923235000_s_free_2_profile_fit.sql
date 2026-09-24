-- S-FREE-2: optional free Check context is distinct from the paid, long-form
-- skin_profiles intake. No existing managed rows or entitlements are changed.
create table public.free_skin_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  goals text[] not null default '{}',
  skin_behavior text not null default 'unsure',
  reactivity text not null default 'unsure',
  pregnancy_status text not null default 'unanswered',
  sensitivities_status text not null default 'unanswered',
  known_sensitivities text[] not null default '{}',
  treatment_status text not null default 'unanswered',
  current_treatments text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint free_skin_profiles_goals_check check (
    cardinality(goals) <= 3 and goals <@ array[
      'breakouts','dark_spots','dryness','oiliness','texture','redness','fine_lines','simplify','maintain'
    ]::text[]
  ),
  constraint free_skin_profiles_behavior_check check (
    skin_behavior in ('dry_tight','comfortable','oily_shiny','combination','unsure')
  ),
  constraint free_skin_profiles_reactivity_check check (
    reactivity in ('reacts_easily','generally_tolerates','unsure')
  ),
  constraint free_skin_profiles_pregnancy_check check (
    pregnancy_status in ('yes','no','prefer_not_to_say','unanswered')
  ),
  constraint free_skin_profiles_sensitivity_check check (
    sensitivities_status in ('none_known','reported','unanswered')
    and cardinality(known_sensitivities) <= 10
    and (sensitivities_status = 'reported') = (cardinality(known_sensitivities) > 0)
  ),
  constraint free_skin_profiles_treatment_check check (
    treatment_status in ('none','reported','unanswered')
    and cardinality(current_treatments) <= 4
    and current_treatments <@ array[
      'topical_retinoid','benzoyl_peroxide','exfoliating_acid','other_prescription'
    ]::text[]
    and (treatment_status = 'reported') = (cardinality(current_treatments) > 0)
  )
);

create trigger free_skin_profiles_set_updated_at before update on public.free_skin_profiles
  for each row execute function private.set_updated_at();

alter table public.free_skin_profiles enable row level security;
create policy free_skin_profiles_select_own on public.free_skin_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy free_skin_profiles_insert_own on public.free_skin_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy free_skin_profiles_update_own on public.free_skin_profiles
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Only the JWT-gated free-personal-fit Edge Function can write this table.
-- Keep the raw profile and exact sensitivities out of the Data API.
revoke all on public.free_skin_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.free_skin_profiles to service_role;
