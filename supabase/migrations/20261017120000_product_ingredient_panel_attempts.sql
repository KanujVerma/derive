-- Processing accounting only. These rows never establish catalog/formula truth.
-- A standalone scan uses its stable scan UUID. Binding its first Check root
-- adopts that existing budget; later client UUIDs find the same root budget.
create table public.product_ingredient_scan_sessions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope_id uuid not null,
  root_case_id uuid references public.product_resolution_cases(id) on delete cascade,
  parent_snapshot_id uuid references public.product_truth_snapshots(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, scope_id),
  check ((root_case_id is null and parent_snapshot_id is null)
    or (root_case_id is not null and parent_snapshot_id is not null))
);
create unique index product_ingredient_sessions_root_idx on public.product_ingredient_scan_sessions(root_case_id)
  where root_case_id is not null;
create index product_ingredient_sessions_parent_idx on public.product_ingredient_scan_sessions(parent_snapshot_id)
  where parent_snapshot_id is not null;

-- Immutable aliases keep a re-opened Check's client UUID and root-free calls on
-- the same budget. The RPC locks each owner/scan key before reading or adding it.
create table public.product_ingredient_scan_aliases (
  user_id uuid not null,
  scan_session_id uuid not null,
  scope_id uuid not null,
  primary key (user_id, scan_session_id),
  foreign key (user_id, scope_id) references public.product_ingredient_scan_sessions(user_id, scope_id) on delete cascade
);
create index product_ingredient_alias_scope_idx on public.product_ingredient_scan_aliases(user_id, scope_id);
alter table public.product_ingredient_scan_aliases enable row level security;
revoke all on public.product_ingredient_scan_aliases from public, anon, authenticated;
grant select, insert, delete on public.product_ingredient_scan_aliases to service_role;

create table public.product_ingredient_panel_attempts (
  user_id uuid not null,
  scope_id uuid not null,
  attempt_number smallint not null check (attempt_number between 1 and 2),
  request_id uuid not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  evidence_fingerprint text not null check (evidence_fingerprint ~ '^[0-9a-f]{64}$'),
  lease_id uuid not null unique default gen_random_uuid(),
  lease_expires_at timestamptz not null default (clock_timestamp() + interval '60 seconds'),
  status text not null default 'processing' check (status in ('processing', 'settled')),
  reason text check (reason in ('unreadable','conflicting_evidence','no_product_evidence','incomplete_panel','unconfirmed','unavailable')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  primary key (user_id, scope_id, attempt_number),
  foreign key (user_id, scope_id) references public.product_ingredient_scan_sessions(user_id, scope_id) on delete cascade,
  unique (user_id, request_id),
  unique (user_id, scope_id, evidence_fingerprint),
  check ((status = 'processing' and reason is null and settled_at is null)
    or (status = 'settled' and reason is not null and settled_at is not null))
);
alter table public.product_ingredient_scan_sessions enable row level security;
alter table public.product_ingredient_panel_attempts enable row level security;
revoke all on public.product_ingredient_scan_sessions, public.product_ingredient_panel_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.product_ingredient_scan_sessions, public.product_ingredient_panel_attempts to service_role;

-- Case and panel writers share one owner/request namespace. The trigger also
-- covers the existing immutable text-continuation writer without replacing it.
create function private.guard_product_ingredient_request_namespace()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('ingredient-request:' || new.user_id::text || ':' || new.request_id::text, 0));
  if exists (select 1 from public.product_ingredient_panel_attempts
    where user_id = new.user_id and request_id = new.request_id) then
    raise exception 'INGREDIENT_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_product_ingredient_request_namespace() from public, anon, authenticated;
grant execute on function private.guard_product_ingredient_request_namespace() to service_role;
create trigger product_resolution_ingredient_request_guard before insert on public.product_resolution_cases
  for each row execute function private.guard_product_ingredient_request_namespace();

-- Register scan/root continuity before returning an eligible identity result.
-- This reserves no ingredient slot. Reservation calls the same binder so the
-- lock order and alias handling stay identical on every entry path.
create function public.bind_product_ingredient_scan(
  p_user_id uuid, p_scan_session_id uuid, p_root_case_id uuid, p_parent_snapshot_id uuid
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  scope uuid;
  alias_scope uuid;
  root_scope uuid;
  origin_scan_id uuid;
  trusted_origin boolean := false;
  origin_scope uuid;
  request_lock bigint;
  origin_lock bigint;
  session_row public.product_ingredient_scan_sessions;
begin
  if p_user_id is null or p_scan_session_id is null
    or (p_root_case_id is null) <> (p_parent_snapshot_id is null) then
    raise exception 'INVALID_INGREDIENT_BINDING' using errcode = '23514';
  end if;
  if p_root_case_id is not null then
    -- Same lock order as the immutable continuation writer, before the session.
    perform 1 from public.product_resolution_cases as root
      join public.product_truth_snapshots as parent on parent.case_id = root.id and parent.user_id = root.user_id
      where root.id = p_root_case_id and root.user_id = p_user_id and root.consumer = 'scan'
        and root.resolution_state = 'identified_formula_unverified' and root.next_action = 'photograph_ingredients'
        and root.product_id is not null and root.variant_id is not null and not root.requires_founder_review
        and parent.id = p_parent_snapshot_id and parent.case_revision = root.truth_revision
        and jsonb_array_length(coalesce(root.evidence_snapshot->'conflicts','[]'::jsonb)) = 0
      for update of root;
    if not found then raise exception 'INGREDIENT_PARENT_CONFLICT' using errcode = '23514'; end if;
    -- The trusted S6 writer records the scan at identity creation, before its
    -- separate noncharging bind can complete. A restart before the first panel
    -- continuation must still adopt those earlier standalone charges.
    select (evidence_snapshot->>'ingredientScanSessionId')::uuid into origin_scan_id
      from public.product_resolution_cases where id = p_root_case_id and user_id = p_user_id;
  end if;
  trusted_origin := origin_scan_id is not null;
  origin_scan_id := coalesce(origin_scan_id, p_scan_session_id);
  -- This key also covers an alias that has not been inserted yet. A root-bound
  -- request and a root-free request for the same client UUID cannot race to
  -- create two journals. Hash collisions merely serialize unrelated scans.
  request_lock := hashtextextended('ingredient:' || p_user_id::text || ':' || p_scan_session_id::text, 0);
  origin_lock := hashtextextended('ingredient:' || p_user_id::text || ':' || origin_scan_id::text, 0);
  perform pg_advisory_xact_lock(least(request_lock, origin_lock));
  if request_lock <> origin_lock then perform pg_advisory_xact_lock(greatest(request_lock, origin_lock)); end if;
  select scope_id into alias_scope from public.product_ingredient_scan_aliases
    where user_id = p_user_id and scan_session_id = p_scan_session_id;
  select scope_id into origin_scope from public.product_ingredient_scan_aliases
    where user_id = p_user_id and scan_session_id = origin_scan_id;
  if p_root_case_id is not null then
    select scope_id into root_scope from public.product_ingredient_scan_sessions
      where user_id = p_user_id and root_case_id = p_root_case_id;
  end if;
  if (root_scope is not null and alias_scope is not null and root_scope <> alias_scope)
    or (root_scope is not null and origin_scope is not null and root_scope <> origin_scope)
    or (alias_scope is not null and origin_scope is not null and alias_scope <> origin_scope) then
    -- Never discard an already-started scan's charges to adopt another budget.
    raise exception 'INGREDIENT_SESSION_CONFLICT' using errcode = '23505';
  end if;
  scope := coalesce(root_scope, origin_scope, alias_scope, origin_scan_id);
  insert into public.product_ingredient_scan_sessions (user_id, scope_id, root_case_id, parent_snapshot_id)
    values (p_user_id, scope, p_root_case_id, p_parent_snapshot_id) on conflict do nothing;
  select * into session_row from public.product_ingredient_scan_sessions
    where user_id = p_user_id and scope_id = scope for update;
  if p_root_case_id is not null then
    if session_row.root_case_id is null then
      update public.product_ingredient_scan_sessions set root_case_id = p_root_case_id, parent_snapshot_id = p_parent_snapshot_id
        where user_id = p_user_id and scope_id = scope returning * into session_row;
    elsif session_row.root_case_id = p_root_case_id then
      if session_row.parent_snapshot_id <> p_parent_snapshot_id then
        raise exception 'INGREDIENT_SESSION_CONFLICT' using errcode = '23505';
      end if;
    elsif not trusted_origin or origin_scope is distinct from scope then
      raise exception 'INGREDIENT_SESSION_CONFLICT' using errcode = '23505';
    end if;
    -- A link/catalog fallback can produce another eligible identity in the
    -- same logical Check. Its immutable S6 origin must identify this exact
    -- existing budget. Keep the original root as the canonical deletion anchor.

  end if;
  insert into public.product_ingredient_scan_aliases (user_id, scan_session_id, scope_id)
    values (p_user_id, p_scan_session_id, scope), (p_user_id, origin_scan_id, scope) on conflict do nothing;
  return scope;
end;
$$;

create function public.reserve_product_ingredient_panel(
  p_user_id uuid, p_scan_session_id uuid, p_root_case_id uuid, p_parent_snapshot_id uuid,
  p_request_id uuid, p_request_fingerprint text, p_evidence_fingerprint text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  scope uuid;
  prior public.product_ingredient_panel_attempts;
  used integer;
begin
  if p_request_id is null or p_request_fingerprint is null or p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or p_evidence_fingerprint is null or p_evidence_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_INGREDIENT_ATTEMPT' using errcode = '23514';
  end if;
  scope := public.bind_product_ingredient_scan(p_user_id,p_scan_session_id,p_root_case_id,p_parent_snapshot_id);
  -- Root -> scan/session -> request matches the continuation writer's order.
  perform pg_advisory_xact_lock(hashtextextended('ingredient-request:' || p_user_id::text || ':' || p_request_id::text, 0));
  if p_root_case_id is not null and (
    exists (select 1 from public.product_resolution_continuations where root_case_id = p_root_case_id)
    or exists (select 1 from public.product_resolution_evidence where case_id = p_root_case_id
      and user_id = p_user_id and evidence_type = 'ingredients' and extracted_text is not null)) then
    raise exception 'INGREDIENT_PARENT_CONFLICT' using errcode = '23514';
  end if;
  if exists (select 1 from public.product_resolution_cases where user_id = p_user_id and request_id = p_request_id) then
    raise exception 'INGREDIENT_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  -- An interrupted worker cannot leave a session permanently busy or regain a
  -- refunded slot. Its token can never replace the terminal unavailable reason.
  update public.product_ingredient_panel_attempts set status = 'settled', reason = 'unavailable', settled_at = clock_timestamp()
    where user_id = p_user_id and scope_id = scope and status = 'processing' and lease_expires_at <= clock_timestamp();
  select count(*) into used from public.product_ingredient_panel_attempts where user_id = p_user_id and scope_id = scope;
  select * into prior from public.product_ingredient_panel_attempts where user_id = p_user_id and request_id = p_request_id;
  if found then
    if prior.scope_id <> scope or prior.request_fingerprint <> p_request_fingerprint
      or prior.evidence_fingerprint <> p_evidence_fingerprint then
      raise exception 'INGREDIENT_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return jsonb_build_object('decision', case when prior.status = 'processing' then 'busy' else 'replayed' end,
      'attemptsUsed', used, 'reason', prior.reason);
  end if;
  select * into prior from public.product_ingredient_panel_attempts
    where user_id = p_user_id and scope_id = scope and evidence_fingerprint = p_evidence_fingerprint;
  if found then
    return jsonb_build_object('decision', case when prior.status = 'processing' then 'busy' else 'replayed' end,
      'attemptsUsed', used, 'reason', prior.reason);
  end if;
  if exists (select 1 from public.product_ingredient_panel_attempts
    where user_id = p_user_id and scope_id = scope and status = 'processing') then
    return jsonb_build_object('decision','busy','attemptsUsed',used);
  end if;
  if used >= 2 then return jsonb_build_object('decision','exhausted','attemptsUsed',2); end if;
  insert into public.product_ingredient_panel_attempts
    (user_id,scope_id,attempt_number,request_id,request_fingerprint,evidence_fingerprint)
    values (p_user_id,scope,used+1,p_request_id,p_request_fingerprint,p_evidence_fingerprint) returning * into prior;
  return jsonb_build_object('decision','reserved','attemptsUsed',used+1,'leaseId',prior.lease_id);
end;
$$;

create function public.settle_product_ingredient_panel(
  p_user_id uuid, p_scan_session_id uuid, p_root_case_id uuid, p_parent_snapshot_id uuid,
  p_lease_id uuid, p_reason text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  scope uuid;
  session_row public.product_ingredient_scan_sessions;
  root_row public.product_resolution_cases;
  prior public.product_ingredient_panel_attempts;
  used integer;
begin
  if p_user_id is null or p_scan_session_id is null or p_lease_id is null
    or (p_root_case_id is null) <> (p_parent_snapshot_id is null)
    or p_reason is null or p_reason not in ('unreadable','conflicting_evidence','no_product_evidence','incomplete_panel','unconfirmed','unavailable') then
    raise exception 'INVALID_INGREDIENT_SETTLEMENT' using errcode = '23514';
  end if;
  if p_root_case_id is not null then
    select * into root_row from public.product_resolution_cases
      where id = p_root_case_id and user_id = p_user_id for update;
    if not found then raise exception 'INGREDIENT_PARENT_CONFLICT' using errcode = '23514'; end if;
  end if;
  select scope_id into scope from public.product_ingredient_scan_aliases
    where user_id = p_user_id and scan_session_id = p_scan_session_id;
  if not found then raise exception 'INGREDIENT_SESSION_CONFLICT' using errcode = '23514'; end if;
  select * into session_row from public.product_ingredient_scan_sessions
    where user_id = p_user_id and scope_id = scope for update;
  if not found then raise exception 'INGREDIENT_SESSION_CONFLICT' using errcode = '23514'; end if;
  if p_root_case_id is not null and (session_row.root_case_id is distinct from p_root_case_id
    or session_row.parent_snapshot_id is distinct from p_parent_snapshot_id) then
    if session_row.root_case_id is null or session_row.root_case_id = p_root_case_id or not exists (
      select 1 from public.product_truth_snapshots as parent
        join public.product_ingredient_scan_aliases as origin on origin.user_id = p_user_id
          and origin.scan_session_id::text = lower(root_row.evidence_snapshot->>'ingredientScanSessionId')
          and origin.scope_id = scope
        where parent.id = p_parent_snapshot_id and parent.case_id = root_row.id
          and parent.user_id = p_user_id and parent.case_revision = root_row.truth_revision
    ) then raise exception 'INGREDIENT_SESSION_CONFLICT' using errcode = '23514'; end if;
  end if;
  select * into prior from public.product_ingredient_panel_attempts
    where user_id = p_user_id and scope_id = scope and lease_id = p_lease_id;
  if not found then raise exception 'INGREDIENT_LEASE_CONFLICT' using errcode = '23514'; end if;
  if prior.status = 'processing' then
    update public.product_ingredient_panel_attempts set status = 'settled', settled_at = clock_timestamp(),
      reason = case when lease_expires_at <= clock_timestamp() then 'unavailable' else p_reason end
      where user_id = p_user_id and scope_id = scope and lease_id = p_lease_id returning * into prior;
  end if;
  select count(*) into used from public.product_ingredient_panel_attempts where user_id = p_user_id and scope_id = scope;
  return jsonb_build_object('decision','settled','attemptsUsed',used,'reason',prior.reason);
end;
$$;
revoke all on function public.reserve_product_ingredient_panel(uuid,uuid,uuid,uuid,uuid,text,text),
  public.settle_product_ingredient_panel(uuid,uuid,uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.reserve_product_ingredient_panel(uuid,uuid,uuid,uuid,uuid,text,text),
  public.settle_product_ingredient_panel(uuid,uuid,uuid,uuid,uuid,text) to service_role;

revoke all on function public.bind_product_ingredient_scan(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.bind_product_ingredient_scan(uuid,uuid,uuid,uuid) to service_role;
