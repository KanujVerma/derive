-- A bounded reviewed-original branch on the existing service-only registry.
-- Applying this migration does not select or enable any release or provider.
do $migration$
declare definition text; original_guard text; reviewed_guard text;
begin
 original_guard := $original$if p_payload->>'releaseHash' !~ '^[a-f0-9]{64}$' or p_payload->>'localFixture' is distinct from 'true' then raise exception 'PART_THREE_INVALID_RELEASE'; end if;$original$;
 reviewed_guard := $reviewed$if p_payload->>'releaseHash' !~ '^[a-f0-9]{64}$' then raise exception 'PART_THREE_INVALID_RELEASE'; end if;
  if p_payload->>'localFixture' is distinct from 'true' then
   if p_payload is distinct from '{"releaseHash":"1eefe0869935387cd8bfb8adfebb68e673a6517b1f0411137cc0282eebf9132d","releaseId":"derive-original-personal-v1","reviewMode":"automated","reviewEvidence":"derive-original-lexical-and-semantics-review-v1","reviewRecordHash":"71d90937737e200c8dab2bbc242cc59187bc9cb01b9e7b535953b1373492753b"}'::jsonb then raise exception 'PART_THREE_INVALID_REVIEWED_RELEASE'; end if;
   if exists(select 1 from private.part_three_release where id=true and p_payload->>'releaseHash'=any(withdrawn_hashes)) then raise exception 'PART_THREE_WITHDRAWN_RELEASE'; end if;
  end if;$reviewed$;
 definition := pg_catalog.pg_get_functiondef('public.part_three_worker_foundation_v1(uuid,text,jsonb)'::regprocedure);
 if strpos(definition,original_guard)=0 or strpos(substring(definition from strpos(definition,original_guard)+length(original_guard)),original_guard)>0 then raise exception 'PART_THREE_REVIEWED_REGISTRATION_PATCH_MISMATCH'; end if;
 execute replace(definition,original_guard,reviewed_guard);
end $migration$;
-- Preserve the outer service-only entrypoint and inaccessible implementation.
revoke all on function public.part_three_worker_foundation_v1(uuid,text,jsonb) from public,anon,authenticated,service_role;
