-- ============================================================================
-- Derive S2: Core domain persistence and immutable history
--
-- This migration is intentionally additive. The baseline schema is already
-- shared, so existing tables are extended in place and historical rows remain
-- valid. New sensitive history tables default to service-role writes and
-- owner-only reads.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Catalog and routine-version reconciliation
-- --------------------------------------------------------------------------

alter table public.products
  add column if not exists image_url text,
  add column if not exists cautions text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

alter table public.routines
  add column if not exists updated_at timestamptz not null default now();

update public.routines
set updated_at = coalesce(published_at, created_at, now());

drop trigger if exists routines_set_updated_at on public.routines;
create trigger routines_set_updated_at
  before update on public.routines
  for each row execute function private.set_updated_at();

alter table public.routine_items
  add column if not exists product_id uuid references public.products(id);

-- Backfill an unambiguous catalog match without guessing when duplicate catalog
-- names exist. Legacy unmatched steps remain readable but all S2 writes require
-- a canonical product reference through create_routine_version().
with unique_catalog_matches as (
  select lower(trim(brand)) as brand_key,
         lower(trim(name)) as name_key,
         (array_agg(id order by id))[1] as product_id
  from public.products
  group by lower(trim(brand)), lower(trim(name))
  having count(*) = 1
)
update public.routine_items as item
set product_id = match.product_id
from unique_catalog_matches as match
where item.product_id is null
  and lower(trim(item.brand)) = match.brand_key
  and lower(trim(item.product_name)) = match.name_key;

do $$
begin
  if exists (
    select 1
    from public.routines
    group by user_id, version
    having count(*) > 1
  ) then
    raise exception 'S2 cannot enforce routine history: duplicate (user_id, version) rows require review';
  end if;
end;
$$;

create unique index if not exists routines_user_version_unique_idx
  on public.routines (user_id, version);

create unique index if not exists routine_items_schedule_order_unique_idx
  on public.routine_items (routine_id, timing, order_index);

create index if not exists routine_items_product_id_idx
  on public.routine_items (product_id);

alter table public.routines
  drop constraint if exists routines_version_positive_check;
alter table public.routines
  add constraint routines_version_positive_check check (version > 0) not valid;
alter table public.routines validate constraint routines_version_positive_check;

-- Published routine content is a historical snapshot. Lifecycle state,
-- publication timestamp, and internal founder notes may progress in place, but
-- customer-facing content, ownership, and version identity may not be rewritten.
create or replace function private.guard_routine_snapshot_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.version is distinct from old.version
     or new.summary_sentence is distinct from old.summary_sentence
     or new.created_at is distinct from old.created_at then
    raise exception 'Routine snapshots are immutable; create a new routine version';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_routine_snapshot_update()
  from public, anon, authenticated;

drop trigger if exists routines_guard_snapshot_update on public.routines;
create trigger routines_guard_snapshot_update
  before update on public.routines
  for each row execute function private.guard_routine_snapshot_update();

create or replace function private.reject_immutable_snapshot_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% rows are immutable; append a new version instead', tg_table_name;
end;
$$;

revoke all on function private.reject_immutable_snapshot_update()
  from public, anon, authenticated;

drop trigger if exists routine_items_reject_update on public.routine_items;
create trigger routine_items_reject_update
  before update on public.routine_items
  for each row execute function private.reject_immutable_snapshot_update();

-- Atomic server-only append operation. A per-member advisory transaction lock
-- guarantees two concurrent writers cannot allocate the same next version.
create or replace function public.create_routine_version(
  p_user_id uuid,
  p_summary_sentence text,
  p_items jsonb,
  p_status text default 'draft',
  p_founder_notes text default null,
  p_published_at timestamptz default null
)
returns public.routines
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_routine public.routines;
  v_item jsonb;
  v_version integer;
  v_product_id uuid;
  v_days text[];
begin
  if p_user_id is null or not exists (
    select 1 from public.profiles where id = p_user_id
  ) then
    raise exception 'Unknown routine owner';
  end if;

  if nullif(trim(p_summary_sentence), '') is null then
    raise exception 'Routine summary is required';
  end if;

  if p_status not in ('draft', 'awaiting_review', 'approved', 'published') then
    raise exception 'Invalid routine status';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Routine items must be a non-empty JSON array';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  select coalesce(max(version), 0) + 1
  into v_version
  from public.routines
  where user_id = p_user_id;

  insert into public.routines (
    user_id,
    version,
    status,
    summary_sentence,
    founder_notes,
    published_at
  )
  values (
    p_user_id,
    v_version,
    p_status,
    trim(p_summary_sentence),
    p_founder_notes,
    p_published_at
  )
  returning * into v_routine;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'Routine item product_id must be a UUID';
    end;

    if v_product_id is null or not exists (
      select 1 from public.products where id = v_product_id
    ) then
      raise exception 'Every routine item must reference a canonical product';
    end if;

    if jsonb_typeof(coalesce(v_item -> 'days', '[]'::jsonb)) is distinct from 'array' then
      raise exception 'Routine item days must be an array';
    end if;

    select coalesce(array_agg(day_value), '{}')
    into v_days
    from jsonb_array_elements_text(coalesce(v_item -> 'days', '[]'::jsonb)) as day_value;

    if exists (
      select 1 from unnest(v_days) as day_value
      where day_value not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
    ) then
      raise exception 'Routine item contains an invalid day';
    end if;

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
      why_chosen,
      watch_for
    )
    values (
      v_routine.id,
      (v_item ->> 'order_index')::integer,
      v_item ->> 'timing',
      v_product_id,
      v_item ->> 'product_name',
      v_item ->> 'brand',
      v_item ->> 'category',
      v_item ->> 'amount',
      v_item ->> 'area',
      v_days,
      v_item ->> 'purpose',
      v_item ->> 'why_chosen',
      nullif(v_item ->> 'watch_for', '')
    );
  end loop;

  return v_routine;
end;
$$;

revoke all on function public.create_routine_version(uuid, text, jsonb, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.create_routine_version(uuid, text, jsonb, text, text, timestamptz)
  to service_role;

-- --------------------------------------------------------------------------
-- Formula, reaction, and ingredient-signal history
-- --------------------------------------------------------------------------

create table if not exists public.formula_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  brand text,
  ingredients text[] not null default '{}',
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint formula_snapshots_product_name_present_check
    check (length(trim(product_name)) > 0)
);

create table if not exists public.product_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id),
  formula_snapshot_id uuid not null references public.formula_snapshots(id),
  product_name_snapshot text not null,
  brand_snapshot text,
  symptoms text[] not null,
  body_area text not null,
  severity text not null,
  approximate_date text,
  notes text,
  created_at timestamptz not null default now(),
  constraint product_reactions_product_name_present_check
    check (length(trim(product_name_snapshot)) > 0),
  constraint product_reactions_symptoms_present_check
    check (cardinality(symptoms) > 0),
  constraint product_reactions_symptoms_check
    check (symptoms <@ array[
      'burning_stinging',
      'redness_rash',
      'itching',
      'breakouts',
      'dryness_peeling',
      'swelling',
      'other'
    ]::text[]),
  constraint product_reactions_body_area_check
    check (body_area in (
      'face', 'cheeks', 'around_eyes', 'forehead', 'jawline', 'neck',
      'scalp', 'underarms', 'chest', 'back', 'arms', 'legs', 'body', 'other'
    )),
  constraint product_reactions_severity_check
    check (severity in ('mild', 'moderate', 'severe', 'unknown'))
);

create table if not exists public.ingredient_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ingredient_name text not null,
  ingredient_key text generated always as (lower(trim(ingredient_name))) stored,
  version integer not null,
  confidence text not null,
  evidence_count integer not null,
  supporting_reaction_ids uuid[] not null default '{}',
  contradictory_tolerance_evidence jsonb not null default '[]'::jsonb,
  allergy_source text,
  notes text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ingredient_signals_name_present_check
    check (length(trim(ingredient_name)) > 0),
  constraint ingredient_signals_version_positive_check check (version > 0),
  constraint ingredient_signals_confidence_check
    check (confidence in (
      'confirmed_allergy',
      'strong_signal',
      'suspected_sensitivity',
      'weak_signal'
    )),
  constraint ingredient_signals_evidence_count_check check (evidence_count >= 0),
  constraint ingredient_signals_allergy_source_check
    check (allergy_source is null or allergy_source in ('user_reported', 'clinician_reported')),
  constraint ingredient_signals_tolerance_evidence_array_check
    check (jsonb_typeof(contradictory_tolerance_evidence) = 'array'),
  unique (user_id, ingredient_key, version)
);

create index if not exists formula_snapshots_user_captured_idx
  on public.formula_snapshots (user_id, captured_at desc);
create index if not exists formula_snapshots_product_idx
  on public.formula_snapshots (product_id, captured_at desc);
create index if not exists product_reactions_user_created_idx
  on public.product_reactions (user_id, created_at desc);
create index if not exists product_reactions_formula_snapshot_idx
  on public.product_reactions (formula_snapshot_id);
create index if not exists ingredient_signals_user_observed_idx
  on public.ingredient_signals (user_id, observed_at desc);

create or replace function private.validate_reaction_formula_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.formula_snapshots
    where id = new.formula_snapshot_id
      and user_id = new.user_id
      and product_id is not distinct from new.product_id
  ) then
    raise exception 'Reaction formula snapshot must belong to the same member and product';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_reaction_formula_owner()
  from public, anon, authenticated;

drop trigger if exists product_reactions_validate_formula_owner on public.product_reactions;
create trigger product_reactions_validate_formula_owner
  before insert on public.product_reactions
  for each row execute function private.validate_reaction_formula_owner();

create or replace function private.validate_ingredient_signal_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.evidence_count < cardinality(new.supporting_reaction_ids) then
    raise exception 'Evidence count cannot be lower than supporting reaction count';
  end if;

  if exists (
    select 1
    from unnest(new.supporting_reaction_ids) as reaction_id
    left join public.product_reactions as reaction
      on reaction.id = reaction_id
     and reaction.user_id = new.user_id
    where reaction.id is null
  ) then
    raise exception 'Ingredient signal evidence must reference reactions owned by the same member';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_ingredient_signal_evidence()
  from public, anon, authenticated;

drop trigger if exists ingredient_signals_validate_evidence on public.ingredient_signals;
create trigger ingredient_signals_validate_evidence
  before insert on public.ingredient_signals
  for each row execute function private.validate_ingredient_signal_evidence();

drop trigger if exists formula_snapshots_reject_update on public.formula_snapshots;
create trigger formula_snapshots_reject_update
  before update on public.formula_snapshots
  for each row execute function private.reject_immutable_snapshot_update();

drop trigger if exists product_reactions_reject_update on public.product_reactions;
create trigger product_reactions_reject_update
  before update on public.product_reactions
  for each row execute function private.reject_immutable_snapshot_update();

drop trigger if exists ingredient_signals_reject_update on public.ingredient_signals;
create trigger ingredient_signals_reject_update
  before update on public.ingredient_signals
  for each row execute function private.reject_immutable_snapshot_update();

-- Atomic server-only reaction recorder: the exact ingredient list is copied
-- into an immutable snapshot in the same transaction as the reaction.
create or replace function public.record_product_reaction(
  p_user_id uuid,
  p_product_id uuid,
  p_product_name text,
  p_brand text,
  p_ingredients text[],
  p_symptoms text[],
  p_body_area text,
  p_severity text,
  p_approximate_date text default null,
  p_notes text default null,
  p_formula_captured_at timestamptz default now()
)
returns public.product_reactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_formula public.formula_snapshots;
  v_reaction public.product_reactions;
begin
  if p_user_id is null or not exists (
    select 1 from public.profiles where id = p_user_id
  ) then
    raise exception 'Unknown reaction owner';
  end if;

  if p_product_id is not null and not exists (
    select 1 from public.products where id = p_product_id
  ) then
    raise exception 'Unknown reaction product';
  end if;

  insert into public.formula_snapshots (
    user_id,
    product_id,
    product_name,
    brand,
    ingredients,
    captured_at
  )
  values (
    p_user_id,
    p_product_id,
    p_product_name,
    p_brand,
    coalesce(p_ingredients, '{}'),
    coalesce(p_formula_captured_at, now())
  )
  returning * into v_formula;

  insert into public.product_reactions (
    user_id,
    product_id,
    formula_snapshot_id,
    product_name_snapshot,
    brand_snapshot,
    symptoms,
    body_area,
    severity,
    approximate_date,
    notes
  )
  values (
    p_user_id,
    p_product_id,
    v_formula.id,
    p_product_name,
    p_brand,
    p_symptoms,
    p_body_area,
    p_severity,
    p_approximate_date,
    p_notes
  )
  returning * into v_reaction;

  return v_reaction;
end;
$$;

revoke all on function public.record_product_reaction(
  uuid, uuid, text, text, text[], text[], text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_product_reaction(
  uuid, uuid, text, text, text[], text[], text, text, text, text, timestamptz
) to service_role;

-- --------------------------------------------------------------------------
-- Existing longitudinal records: additive provenance and contract fields
-- --------------------------------------------------------------------------

alter table public.check_ins
  add column if not exists routine_id uuid references public.routines(id),
  add column if not exists primary_goal text,
  add column if not exists goal_outcome text,
  add column if not exists adherence text,
  add column if not exists change_reason text,
  add column if not exists irritation_symptoms text[] not null default '{}',
  add column if not exists irritation_body_area text,
  add column if not exists adjustment_proposed boolean not null default false;

alter table public.check_ins
  drop constraint if exists check_ins_primary_goal_check;
alter table public.check_ins
  add constraint check_ins_primary_goal_check check (
    primary_goal is null or primary_goal in (
      'breakouts', 'dark_spots', 'dryness', 'oiliness', 'texture',
      'redness', 'fine_lines', 'simplify', 'maintain'
    )
  );
alter table public.check_ins
  drop constraint if exists check_ins_goal_outcome_check;
alter table public.check_ins
  add constraint check_ins_goal_outcome_check
    check (goal_outcome is null or goal_outcome in ('better', 'same', 'worse'));
alter table public.check_ins
  drop constraint if exists check_ins_adherence_check;
alter table public.check_ins
  add constraint check_ins_adherence_check
    check (adherence is null or adherence in ('yes', 'mostly', 'not_really'));
alter table public.check_ins
  drop constraint if exists check_ins_irritation_symptoms_check;
alter table public.check_ins
  add constraint check_ins_irritation_symptoms_check check (
    irritation_symptoms <@ array[
      'burning_stinging', 'redness_rash', 'itching', 'breakouts',
      'dryness_peeling', 'swelling', 'other'
    ]::text[]
  );

create index if not exists check_ins_user_created_idx
  on public.check_ins (user_id, created_at desc);
create index if not exists check_ins_routine_id_idx
  on public.check_ins (routine_id);

alter table public.user_photos
  add column if not exists capture_type text,
  add column if not exists angle text,
  add column if not exists capture_quality_passed boolean not null default false,
  add column if not exists member_approved boolean not null default false,
  add column if not exists captured_at timestamptz;

update public.user_photos
set capture_type = case
      when photo_type in ('front', 'left', 'right') then 'baseline'
      when photo_type = 'checkin' then 'progress'
      when photo_type = 'shelf' then 'shelf'
      else 'progress'
    end,
    angle = case
      when photo_type in ('front', 'left', 'right') then photo_type
      else angle
    end,
    captured_at = coalesce(captured_at, created_at, now())
where capture_type is null or captured_at is null;

alter table public.user_photos
  alter column capture_type set not null,
  alter column captured_at set not null;

create or replace function private.set_photo_provenance_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.capture_type := coalesce(
    new.capture_type,
    case
      when new.photo_type in ('front', 'left', 'right') then 'baseline'
      when new.photo_type = 'checkin' then 'progress'
      when new.photo_type = 'shelf' then 'shelf'
      else 'progress'
    end
  );
  new.angle := coalesce(
    new.angle,
    case when new.photo_type in ('front', 'left', 'right') then new.photo_type else null end
  );
  new.captured_at := coalesce(new.captured_at, new.created_at, now());
  return new;
end;
$$;

revoke all on function private.set_photo_provenance_defaults()
  from public, anon, authenticated;

drop trigger if exists user_photos_set_provenance_defaults on public.user_photos;
create trigger user_photos_set_provenance_defaults
  before insert on public.user_photos
  for each row execute function private.set_photo_provenance_defaults();

alter table public.user_photos
  drop constraint if exists user_photos_capture_type_check;
alter table public.user_photos
  add constraint user_photos_capture_type_check
    check (capture_type in ('baseline', 'progress', 'reaction_context', 'shelf'));
alter table public.user_photos
  drop constraint if exists user_photos_angle_check;
alter table public.user_photos
  add constraint user_photos_angle_check
    check (angle is null or angle in ('front', 'left', 'right'));
alter table public.user_photos
  drop constraint if exists user_photos_baseline_angle_check;
alter table public.user_photos
  add constraint user_photos_baseline_angle_check
    check (capture_type <> 'baseline' or angle is not null);

create index if not exists user_photos_user_captured_idx
  on public.user_photos (user_id, captured_at desc);

alter table public.refill_requests
  add column if not exists product_id uuid references public.products(id),
  add column if not exists request_note text,
  add column if not exists delivered_at timestamptz,
  add column if not exists estimated_delivery timestamptz,
  add column if not exists carrier text,
  add column if not exists tracking_url text;

create index if not exists refill_requests_product_id_idx
  on public.refill_requests (product_id);
create index if not exists refill_requests_user_requested_idx
  on public.refill_requests (user_id, requested_at desc);
create unique index if not exists refill_requests_one_open_product_idx
  on public.refill_requests (user_id, product_id)
  where product_id is not null and status in ('requested', 'ordered', 'shipped');

-- --------------------------------------------------------------------------
-- Least-privilege access for S2 additions
-- --------------------------------------------------------------------------

alter table public.formula_snapshots enable row level security;
alter table public.product_reactions enable row level security;
alter table public.ingredient_signals enable row level security;

revoke all privileges on table public.formula_snapshots from anon, authenticated;
revoke all privileges on table public.product_reactions from anon, authenticated;
revoke all privileges on table public.ingredient_signals from anon, authenticated;

grant all privileges on table public.formula_snapshots to service_role;
grant all privileges on table public.product_reactions to service_role;
grant all privileges on table public.ingredient_signals to service_role;

grant select on table public.formula_snapshots to authenticated;
grant select on table public.product_reactions to authenticated;
grant select on table public.ingredient_signals to authenticated;

drop policy if exists formula_snapshots_select_own on public.formula_snapshots;
create policy formula_snapshots_select_own
  on public.formula_snapshots for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists product_reactions_select_own on public.product_reactions;
create policy product_reactions_select_own
  on public.product_reactions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists ingredient_signals_select_own on public.ingredient_signals;
create policy ingredient_signals_select_own
  on public.ingredient_signals for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select (
  id, user_id, version, status, summary_sentence, created_at, updated_at, published_at
) on table public.routines to authenticated;

grant insert (
  user_id,
  skin_state,
  irritation,
  notes,
  routine_id,
  primary_goal,
  goal_outcome,
  adherence,
  change_reason,
  irritation_symptoms,
  irritation_body_area
) on table public.check_ins to authenticated;

grant insert (
  user_id,
  photo_type,
  storage_path,
  capture_type,
  angle,
  capture_quality_passed,
  member_approved,
  captured_at
) on table public.user_photos to authenticated;

grant insert (
  user_id,
  product_id,
  product_name,
  brand,
  request_note
) on table public.refill_requests to authenticated;
