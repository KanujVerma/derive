-- Exact candidate normalization authority is resolved from its persisted P2
-- binding/revision, including that snapshot's exact release_id. An alternate
-- release with identical versions cannot authorize an earlier recalled release.
create or replace function private.part_four_formula_current(p_packet jsonb) returns boolean
language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare snapshot_id uuid; actor uuid;
begin
 if p_packet->'partFour' is null then return true; end if;
 perform pg_advisory_xact_lock(40203);perform pg_advisory_xact_lock(40204);perform pg_advisory_xact_lock(40205);perform pg_advisory_xact_lock(40206);
 actor:=(p_packet->'binding'->>'ownerId')::uuid;
 select id into snapshot_id from private.part_two_snapshots where owner_id=actor
  and binding_key=p_packet->'partFour'->'formula'->>'partTwoBindingKey'
  and result_revision=(p_packet->'partFour'->'formula'->>'partTwoRevision')::bigint;
 if snapshot_id is null or not private.part_four_routine_normalization_allowed(snapshot_id,actor) then return false; end if;
 if (p_packet->'partFour'->'formula'->>'expiresAt')::timestamptz<=clock_timestamp()
  or (p_packet->'partFour'->'formula'->'binding'->>'expiresAt')::timestamptz<=clock_timestamp()
  or exists(select 1 from jsonb_array_elements(p_packet->'partFour'->'formula'->'sourceRefs') s where s->>'permitted' is distinct from 'true' or (s->>'expiresAt')::timestamptz<=clock_timestamp())
  or exists(select 1 from jsonb_array_elements(p_packet->'partFour'->'formula'->'facts') f where (f->>'validUntil')::timestamptz<=clock_timestamp()) then return false; end if;
 return true;
exception when others then return false;
end $$;
revoke all on function private.part_four_formula_current(jsonb) from public,anon,authenticated;
