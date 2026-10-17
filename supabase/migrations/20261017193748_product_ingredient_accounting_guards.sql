-- Forward correction for the merged, disabled scanner accounting foundation.
-- GRANT adds to creator/schema defaults. Remove inherited ALL before opting
-- the invoker RPCs into only their required operations. FK cascades perform
-- erasure as the referenced table owner; direct journal DELETE is unnecessary.
revoke all privileges on table public.product_ingredient_scan_sessions,
  public.product_ingredient_scan_aliases, public.product_ingredient_panel_attempts
  from service_role;
grant select, insert, update on table public.product_ingredient_scan_sessions,
  public.product_ingredient_panel_attempts to service_role;
-- Existing aliases can neither be rewritten nor deleted/reinserted by this role.
grant select, insert on table public.product_ingredient_scan_aliases to service_role;

create or replace function public.bind_product_ingredient_scan(
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
  -- Physical profile erasure takes the owner before cascading into cases.
  -- Admit this transaction before any root/scan/session lock to avoid the
  -- root -> profile-FK / profile -> root cascade wait cycle on first binding.
  perform 1 from public.profiles where id = p_user_id for key share;
  if not found then raise exception 'INGREDIENT_OWNER_UNAVAILABLE' using errcode = '23514'; end if;
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
