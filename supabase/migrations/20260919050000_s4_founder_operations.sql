-- ============================================================================
-- Derive S4: Founder operations, audited privileged mutations, and least access
--
-- This migration is additive. The founder console never receives service-role
-- credentials and authenticated customers receive no access to these tables or
-- functions. Every privileged mutation is executed by the founder Edge Function
-- after it independently verifies both the JWT and an active founder allowlist.
-- ============================================================================

create table if not exists public.founder_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'operator',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founder_accounts_role_check check (role in ('founder', 'operator')),
  constraint founder_accounts_status_check check (status in ('active', 'disabled'))
);

create table if not exists public.founder_member_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  author_user_id uuid not null references public.founder_accounts(user_id),
  note_type text not null default 'operations',
  body text not null,
  created_at timestamptz not null default now(),
  constraint founder_member_notes_type_check
    check (note_type in ('operations', 'routine_review', 'safety_follow_up', 'member_feedback')),
  constraint founder_member_notes_body_check
    check (length(trim(body)) between 1 and 4000)
);

create table if not exists public.product_formula_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  reviewer_user_id uuid not null references public.founder_accounts(user_id),
  ingredients text[] not null,
  key_actives text[] not null default '{}',
  source_reference text not null,
  decision text not null,
  review_notes text,
  reviewed_at timestamptz not null default now(),
  constraint product_formula_reviews_ingredients_check check (cardinality(ingredients) > 0),
  constraint product_formula_reviews_source_check check (length(trim(source_reference)) between 1 and 500),
  constraint product_formula_reviews_decision_check check (decision in ('verified', 'rejected')),
  constraint product_formula_reviews_notes_check
    check (review_notes is null or length(review_notes) <= 2000)
);

create table if not exists public.founder_operation_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.founder_accounts(user_id),
  operation text not null,
  target_type text not null,
  target_id uuid not null,
  request_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint founder_operation_log_operation_check check (operation in (
    'routine_published',
    'refill_transitioned',
    'formula_verified',
    'formula_rejected',
    'note_added',
    'task_resolved'
  )),
  constraint founder_operation_log_target_type_check check (target_type in (
    'routine', 'refill_request', 'product', 'member_note', 'founder_review_task'
  )),
  constraint founder_operation_log_details_object_check check (jsonb_typeof(details) = 'object'),
  unique (actor_user_id, request_id)
);

create index if not exists founder_member_notes_user_created_idx
  on public.founder_member_notes (user_id, created_at desc);
create index if not exists product_formula_reviews_product_reviewed_idx
  on public.product_formula_reviews (product_id, reviewed_at desc);
create index if not exists founder_operation_log_target_created_idx
  on public.founder_operation_log (target_type, target_id, created_at desc);
create index if not exists founder_review_tasks_queue_idx
  on public.founder_review_tasks (status, priority, created_at);
create index if not exists refill_requests_ops_queue_idx
  on public.refill_requests (status, requested_at);

drop trigger if exists founder_accounts_set_updated_at on public.founder_accounts;
create trigger founder_accounts_set_updated_at
  before update on public.founder_accounts
  for each row execute function private.set_updated_at();

alter table public.founder_accounts enable row level security;
alter table public.founder_member_notes enable row level security;
alter table public.product_formula_reviews enable row level security;
alter table public.founder_operation_log enable row level security;

revoke all privileges on table public.founder_accounts from public, anon, authenticated;
revoke all privileges on table public.founder_member_notes from public, anon, authenticated;
revoke all privileges on table public.product_formula_reviews from public, anon, authenticated;
revoke all privileges on table public.founder_operation_log from public, anon, authenticated;
grant all privileges on table public.founder_accounts to service_role;
grant all privileges on table public.founder_member_notes to service_role;
grant all privileges on table public.product_formula_reviews to service_role;
grant all privileges on table public.founder_operation_log to service_role;

create or replace function private.assert_active_founder(p_actor_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_actor_user_id is null or not exists (
    select 1
    from public.founder_accounts
    where user_id = p_actor_user_id and status = 'active'
  ) then
    raise exception 'FOUNDER_ACCESS_REQUIRED';
  end if;
end;
$$;

revoke all on function private.assert_active_founder(uuid) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.assert_active_founder(uuid) to service_role;

create or replace function public.founder_publish_routine(
  p_actor_user_id uuid,
  p_source_routine_id uuid,
  p_summary_sentence text,
  p_items jsonb,
  p_founder_notes text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.routines;
  v_published public.routines;
  v_existing_log public.founder_operation_log;
begin
  perform private.assert_active_founder(p_actor_user_id);

  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  select * into v_existing_log
  from public.founder_operation_log
  where actor_user_id = p_actor_user_id and request_id = p_request_id;
  if found then
    return jsonb_build_object(
      'routine_id', v_existing_log.target_id,
      'version', v_existing_log.details ->> 'version',
      'replayed', true
    );
  end if;

  select * into v_source
  from public.routines
  where id = p_source_routine_id
  for update;

  if not found then raise exception 'ROUTINE_NOT_FOUND'; end if;
  if v_source.status <> 'awaiting_review' then raise exception 'ROUTINE_NOT_AWAITING_REVIEW'; end if;
  if nullif(trim(p_summary_sentence), '') is null then raise exception 'ROUTINE_SUMMARY_REQUIRED'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ROUTINE_ITEMS_REQUIRED';
  end if;
  if p_founder_notes is not null and length(p_founder_notes) > 4000 then
    raise exception 'FOUNDER_NOTES_TOO_LONG';
  end if;

  select * into v_published
  from public.create_routine_version(
    v_source.user_id,
    trim(p_summary_sentence),
    p_items,
    'published',
    nullif(trim(coalesce(p_founder_notes, '')), ''),
    now()
  );

  update public.routines
  set status = 'approved', founder_notes = nullif(trim(coalesce(p_founder_notes, '')), '')
  where id = v_source.id;

  update public.founder_review_tasks
  set status = 'completed'
  where user_id = v_source.user_id
    and task_type in ('initial_routine', 'routine_adjustment')
    and status = 'pending';

  insert into public.founder_operation_log (
    actor_user_id, operation, target_type, target_id, request_id, details
  ) values (
    p_actor_user_id,
    'routine_published',
    'routine',
    v_published.id,
    p_request_id,
    jsonb_build_object(
      'source_routine_id', v_source.id,
      'member_id', v_source.user_id,
      'version', v_published.version
    )
  );

  return jsonb_build_object(
    'routine_id', v_published.id,
    'version', v_published.version,
    'replayed', false
  );
end;
$$;

create or replace function public.founder_transition_refill(
  p_actor_user_id uuid,
  p_refill_id uuid,
  p_next_status text,
  p_carrier text,
  p_tracking_number text,
  p_tracking_url text,
  p_estimated_delivery timestamptz,
  p_request_id uuid
)
returns public.refill_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_refill public.refill_requests;
begin
  perform private.assert_active_founder(p_actor_user_id);
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;

  if exists (
    select 1 from public.founder_operation_log
    where actor_user_id = p_actor_user_id and request_id = p_request_id
  ) then
    select refill.* into v_refill
    from public.founder_operation_log as log
    join public.refill_requests as refill on refill.id = log.target_id
    where log.actor_user_id = p_actor_user_id and log.request_id = p_request_id;
    return v_refill;
  end if;

  select * into v_refill from public.refill_requests where id = p_refill_id for update;
  if not found then raise exception 'REFILL_NOT_FOUND'; end if;
  if p_next_status not in ('ordered', 'shipped', 'delivered') then raise exception 'INVALID_REFILL_STATUS'; end if;
  if not (
    (v_refill.status = 'requested' and p_next_status = 'ordered') or
    (v_refill.status = 'ordered' and p_next_status = 'shipped') or
    (v_refill.status = 'shipped' and p_next_status = 'delivered')
  ) then raise exception 'INVALID_REFILL_TRANSITION'; end if;

  if p_next_status = 'shipped' and (
    nullif(trim(coalesce(p_carrier, '')), '') is null or
    nullif(trim(coalesce(p_tracking_number, '')), '') is null
  ) then raise exception 'SHIPMENT_TRACKING_REQUIRED'; end if;
  if p_tracking_url is not null and (
    length(p_tracking_url) > 500 or p_tracking_url !~ '^https://[^[:space:]]+$'
  ) then
    raise exception 'INVALID_TRACKING_URL';
  end if;

  update public.refill_requests
  set status = p_next_status,
      carrier = case when p_next_status = 'shipped' then trim(p_carrier) else carrier end,
      tracking_number = case when p_next_status = 'shipped' then trim(p_tracking_number) else tracking_number end,
      tracking_url = case when p_next_status = 'shipped' then p_tracking_url else tracking_url end,
      estimated_delivery = case when p_next_status = 'shipped' then p_estimated_delivery else estimated_delivery end,
      shipped_at = case when p_next_status = 'shipped' then now() else shipped_at end,
      delivered_at = case when p_next_status = 'delivered' then now() else delivered_at end
  where id = v_refill.id
  returning * into v_refill;

  update public.founder_review_tasks
  set status = case when p_next_status = 'delivered' then 'completed' else status end
  where user_id = v_refill.user_id and task_type = 'refill' and status = 'pending';

  insert into public.founder_operation_log (
    actor_user_id, operation, target_type, target_id, request_id, details
  ) values (
    p_actor_user_id,
    'refill_transitioned',
    'refill_request',
    v_refill.id,
    p_request_id,
    jsonb_build_object('member_id', v_refill.user_id, 'status', v_refill.status)
  );
  return v_refill;
end;
$$;

create or replace function public.founder_review_formula(
  p_actor_user_id uuid,
  p_product_id uuid,
  p_decision text,
  p_ingredients text[],
  p_key_actives text[],
  p_source_reference text,
  p_review_notes text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product public.products;
  v_review public.product_formula_reviews;
begin
  perform private.assert_active_founder(p_actor_user_id);
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;

  if exists (
    select 1 from public.founder_operation_log
    where actor_user_id = p_actor_user_id and request_id = p_request_id
  ) then
    select product.* into v_product
    from public.founder_operation_log as log
    join public.products as product on product.id = log.target_id
    where log.actor_user_id = p_actor_user_id and log.request_id = p_request_id;
    return jsonb_build_object('product_id', v_product.id, 'decision', p_decision, 'replayed', true);
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if p_decision not in ('verified', 'rejected') then raise exception 'INVALID_FORMULA_DECISION'; end if;
  if nullif(trim(p_source_reference), '') is null or length(p_source_reference) > 500 then
    raise exception 'FORMULA_SOURCE_REQUIRED';
  end if;
  if p_decision = 'verified' and cardinality(coalesce(p_ingredients, '{}')) = 0 then
    raise exception 'VERIFIED_INGREDIENTS_REQUIRED';
  end if;

  insert into public.product_formula_reviews (
    product_id, reviewer_user_id, ingredients, key_actives,
    source_reference, decision, review_notes
  ) values (
    p_product_id, p_actor_user_id, coalesce(p_ingredients, '{}'),
    coalesce(p_key_actives, '{}'), trim(p_source_reference), p_decision,
    nullif(trim(coalesce(p_review_notes, '')), '')
  ) returning * into v_review;

  if p_decision = 'verified' then
    update public.products
    set full_ingredients = p_ingredients,
        key_actives = coalesce(p_key_actives, '{}'),
        is_catalog_standard = true
    where id = p_product_id;
  end if;

  insert into public.founder_operation_log (
    actor_user_id, operation, target_type, target_id, request_id, details
  ) values (
    p_actor_user_id,
    case when p_decision = 'verified' then 'formula_verified' else 'formula_rejected' end,
    'product',
    p_product_id,
    p_request_id,
    jsonb_build_object('review_id', v_review.id, 'decision', p_decision)
  );
  return jsonb_build_object(
    'product_id', p_product_id,
    'review_id', v_review.id,
    'decision', p_decision,
    'replayed', false
  );
end;
$$;

create or replace function public.founder_add_member_note(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_note_type text,
  p_body text,
  p_request_id uuid
)
returns public.founder_member_notes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_note public.founder_member_notes;
begin
  perform private.assert_active_founder(p_actor_user_id);
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;

  if exists (
    select 1 from public.founder_operation_log
    where actor_user_id = p_actor_user_id and request_id = p_request_id
  ) then
    select note.* into v_note
    from public.founder_operation_log as log
    join public.founder_member_notes as note on note.id = log.target_id
    where log.actor_user_id = p_actor_user_id and log.request_id = p_request_id;
    return v_note;
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'MEMBER_NOT_FOUND'; end if;
  if p_note_type not in ('operations', 'routine_review', 'safety_follow_up', 'member_feedback') then
    raise exception 'INVALID_NOTE_TYPE';
  end if;
  if length(trim(coalesce(p_body, ''))) not between 1 and 4000 then raise exception 'INVALID_NOTE_BODY'; end if;

  insert into public.founder_member_notes (user_id, author_user_id, note_type, body)
  values (p_user_id, p_actor_user_id, p_note_type, trim(p_body))
  returning * into v_note;

  insert into public.founder_operation_log (
    actor_user_id, operation, target_type, target_id, request_id, details
  ) values (
    p_actor_user_id, 'note_added', 'member_note', v_note.id, p_request_id,
    jsonb_build_object('member_id', p_user_id, 'note_type', p_note_type)
  );
  return v_note;
end;
$$;

create or replace function public.founder_resolve_task(
  p_actor_user_id uuid,
  p_task_id uuid,
  p_resolution text,
  p_request_id uuid
)
returns public.founder_review_tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.founder_review_tasks;
begin
  perform private.assert_active_founder(p_actor_user_id);
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  if p_resolution not in ('completed', 'dismissed') then raise exception 'INVALID_TASK_RESOLUTION'; end if;

  if exists (
    select 1 from public.founder_operation_log
    where actor_user_id = p_actor_user_id and request_id = p_request_id
  ) then
    select task.* into v_task
    from public.founder_operation_log as log
    join public.founder_review_tasks as task on task.id = log.target_id
    where log.actor_user_id = p_actor_user_id and log.request_id = p_request_id;
    return v_task;
  end if;

  select * into v_task from public.founder_review_tasks where id = p_task_id for update;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;
  if v_task.status <> 'pending' then raise exception 'TASK_ALREADY_RESOLVED'; end if;

  update public.founder_review_tasks set status = p_resolution where id = p_task_id returning * into v_task;
  insert into public.founder_operation_log (
    actor_user_id, operation, target_type, target_id, request_id, details
  ) values (
    p_actor_user_id, 'task_resolved', 'founder_review_task', p_task_id, p_request_id,
    jsonb_build_object('member_id', v_task.user_id, 'resolution', p_resolution)
  );
  return v_task;
end;
$$;

revoke all on function public.founder_publish_routine(uuid, uuid, text, jsonb, text, uuid)
  from public, anon, authenticated;
revoke all on function public.founder_transition_refill(uuid, uuid, text, text, text, text, timestamptz, uuid)
  from public, anon, authenticated;
revoke all on function public.founder_review_formula(uuid, uuid, text, text[], text[], text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.founder_add_member_note(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.founder_resolve_task(uuid, uuid, text, uuid)
  from public, anon, authenticated;

grant execute on function public.founder_publish_routine(uuid, uuid, text, jsonb, text, uuid) to service_role;
grant execute on function public.founder_transition_refill(uuid, uuid, text, text, text, text, timestamptz, uuid) to service_role;
grant execute on function public.founder_review_formula(uuid, uuid, text, text[], text[], text, text, uuid) to service_role;
grant execute on function public.founder_add_member_note(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.founder_resolve_task(uuid, uuid, text, uuid) to service_role;
