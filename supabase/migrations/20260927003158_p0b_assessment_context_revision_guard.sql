-- P0-B provenance review: reject new assessments evaluated against changed context.
create or replace function public.persist_personal_decision_assessment(p_user_id uuid,p_request_id uuid,p_input jsonb,p_packet jsonb,p_profile_revision_id uuid,p_routine_revision_id uuid,p_history_revision_id uuid,p_truth_projection_ref text,p_schema_version text,p_engine_version text,p_policy_version text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.personal_decision_assessments; head_revision bigint; expected_revision bigint;
begin
  -- Same owner lock as context writes; concurrent retries cannot duplicate a result.
  insert into public.personal_context_heads(user_id) values(p_user_id) on conflict do nothing;
  select revision into head_revision from public.personal_context_heads where user_id=p_user_id for update;
  select * into r from public.personal_decision_assessments where user_id=p_user_id and request_id=p_request_id;
  if found then
    if r.input is distinct from p_input then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('assessmentId',r.id,'packet',r.packet,'replayed',true);
  end if;
  -- The producer evaluated this exact aggregate revision. Check after immutable replay.
  if jsonb_typeof(p_input->'expectedContextRevision') is distinct from 'number' then raise exception 'INVALID_CONTEXT_REVISION'; end if;
  if (p_input->>'expectedContextRevision') !~ '^[0-9]+$' then raise exception 'INVALID_CONTEXT_REVISION'; end if;
  if (p_input->>'expectedContextRevision')::numeric > 9007199254740991 then raise exception 'INVALID_CONTEXT_REVISION'; end if;
  expected_revision := (p_input->>'expectedContextRevision')::bigint;
  if head_revision <> expected_revision then raise exception 'STALE_CONTEXT'; end if;
  insert into public.personal_decision_assessments(user_id,request_id,input,packet,profile_revision_id,routine_revision_id,history_revision_id,truth_projection_ref,schema_version,engine_version,policy_version)
    values(p_user_id,p_request_id,p_input,p_packet,p_profile_revision_id,p_routine_revision_id,p_history_revision_id,p_truth_projection_ref,p_schema_version,p_engine_version,p_policy_version) returning * into r;
  return jsonb_build_object('assessmentId',r.id,'packet',r.packet,'replayed',false);
end;
$$;
