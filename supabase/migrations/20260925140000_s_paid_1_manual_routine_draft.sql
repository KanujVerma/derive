-- S-PAID-1 / F1: founder-authored initial routine when model generation is unavailable.
-- Service-role-only; the Edge function validates the proposed steps before this
-- atomic, idempotent write. It never grants a free guest managed access.

alter table public.founder_operation_log
  drop constraint founder_operation_log_operation_check;
alter table public.founder_operation_log
  add constraint founder_operation_log_operation_check check (operation in (
    'routine_published', 'manual_routine_draft_created', 'refill_transitioned',
    'formula_verified', 'formula_rejected', 'note_added', 'task_resolved',
    'product_identity_resolved'
  ));

create function private.verified_member_identity_is_permanent(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.is_anonymous is false from auth.users u where u.id = p_member_id), false);
$$;
revoke all on function private.verified_member_identity_is_permanent(uuid) from public, anon, authenticated;
grant execute on function private.verified_member_identity_is_permanent(uuid) to service_role;

create function public.founder_create_manual_routine_draft(
  p_actor_user_id uuid,
  p_member_id uuid,
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
  v_existing public.founder_operation_log;
  v_routine public.routines;
  v_status text;
  v_request_hash text;
begin
  perform private.assert_active_founder(p_actor_user_id);
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  if p_member_id is null then raise exception 'MEMBER_REQUIRED'; end if;
  v_request_hash := pg_catalog.md5(jsonb_build_array(
    trim(coalesce(p_summary_sentence, '')), p_items,
    nullif(trim(coalesce(p_founder_notes, '')), '')
  )::text);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_user_id::text || ':' || p_request_id::text, 0)
  );
  select * into v_existing from public.founder_operation_log
  where actor_user_id = p_actor_user_id and request_id = p_request_id;
  if found then
    if v_existing.operation <> 'manual_routine_draft_created'
       or v_existing.details ->> 'member_id' is distinct from p_member_id::text
       or v_existing.details ->> 'request_hash' is distinct from v_request_hash then
      raise exception 'REQUEST_CONFLICT';
    end if;
    return jsonb_build_object('routine_id', v_existing.target_id,
      'version', v_existing.details ->> 'version', 'replayed', true);
  end if;

  -- Use the same per-member transaction lock as create_routine_version so an AI
  -- proposal and a manual fallback cannot both become competing version ones.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_member_id::text, 0));
  if not private.verified_member_identity_is_permanent(p_member_id) then
    raise exception 'PERMANENT_ACCOUNT_REQUIRED';
  end if;
  select m.status into v_status from public.memberships m
  where m.user_id = p_member_id
  order by m.last_stripe_event_created_at desc nulls last, m.created_at desc limit 1;
  if v_status is distinct from 'active' then raise exception 'MEMBERSHIP_REQUIRED'; end if;
  if not exists (select 1 from public.skin_profiles s
      where s.user_id = p_member_id and s.onboarding_completed is true) then
    raise exception 'INTAKE_REQUIRED';
  end if;
  if exists (select 1 from public.routines r where r.user_id = p_member_id) then
    raise exception 'ROUTINE_ALREADY_EXISTS';
  end if;
  if nullif(trim(p_summary_sentence), '') is null then raise exception 'ROUTINE_SUMMARY_REQUIRED'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ROUTINE_ITEMS_REQUIRED';
  end if;
  if p_founder_notes is not null and length(p_founder_notes) > 4000 then
    raise exception 'FOUNDER_NOTES_TOO_LONG';
  end if;

  select * into v_routine from public.create_routine_version(
    p_member_id, trim(p_summary_sentence), p_items, 'awaiting_review',
    nullif(trim(coalesce(p_founder_notes, '')), ''), null
  );
  insert into public.founder_operation_log (
    actor_user_id, operation, target_type, target_id, request_id, details
  ) values (
    p_actor_user_id, 'manual_routine_draft_created', 'routine', v_routine.id,
    p_request_id, jsonb_build_object('member_id', p_member_id,
      'version', v_routine.version, 'request_hash', v_request_hash)
  );
  return jsonb_build_object('routine_id', v_routine.id,
    'version', v_routine.version, 'replayed', false);
end;
$$;

revoke all on function public.founder_create_manual_routine_draft(uuid, uuid, text, jsonb, text, uuid)
  from public, anon, authenticated;
grant execute on function public.founder_create_manual_routine_draft(uuid, uuid, text, jsonb, text, uuid)
  to service_role;
