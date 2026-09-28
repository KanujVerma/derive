-- Explicit, private customer proposals. This table is not a catalog source.
-- There is deliberately no retention timer or founder photo-read policy here.
create table public.catalog_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  status text not null default 'submitted' check (status in ('submitted', 'withdrawn')),
  payload jsonb,
  candidate_key text,
  request_fingerprint text,
  consent_version integer not null check (consent_version = 1),
  consent_purpose text not null default 'catalog_review' check (consent_purpose = 'catalog_review'),
  consented_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, request_id),
  constraint catalog_contributions_state_check check (
    (status = 'submitted' and payload is not null and jsonb_typeof(payload) = 'object'
      and candidate_key is not null and request_fingerprint ~ '^[0-9a-f]{64}$' and withdrawn_at is null)
    or (status = 'withdrawn' and payload is null and candidate_key is null
      and request_fingerprint is null and withdrawn_at is not null)
  )
);
create index catalog_contributions_demand_idx
  on public.catalog_contributions (candidate_key, user_id) where status = 'submitted';
create index catalog_contributions_owner_created_idx
  on public.catalog_contributions (user_id, created_at desc);
alter table public.catalog_contributions enable row level security;
revoke all on public.catalog_contributions from public, anon, authenticated;
grant select on public.catalog_contributions to authenticated;
create policy catalog_contributions_owner_read on public.catalog_contributions
  for select to authenticated using (user_id = (select auth.uid()));

-- Trusted Edge code supplies the verified JWT owner. The RPC rechecks evidence,
-- replay and the durable account-deletion fence atomically under the owner lock.
create function public.submit_catalog_contribution(
  p_user_id uuid, p_request_id uuid, p_payload jsonb,
  p_candidate_key text, p_request_fingerprint text, p_consent_version integer
)
returns public.catalog_contributions
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_existing public.catalog_contributions;
  v_evidence jsonb;
  v_entry jsonb;
  v_evidence_id uuid;
  v_role text;
  v_count integer := 0;
begin
  if p_user_id is null or p_request_id is null or p_payload is null
     or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 4096
     or p_consent_version is distinct from 1
     or p_candidate_key is null or length(p_candidate_key) > 1000
     or p_request_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_CATALOG_CONTRIBUTION';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 191027));
  if not exists (select 1 from public.profiles where id = p_user_id and deletion_started_at is null) then
    raise exception 'CATALOG_CONTRIBUTION_OWNER_UNAVAILABLE';
  end if;
  select * into v_existing from public.catalog_contributions
    where user_id = p_user_id and request_id = p_request_id;
  if found then
    if v_existing.status = 'withdrawn' then return v_existing; end if;
    if v_existing.payload <> p_payload or v_existing.candidate_key <> p_candidate_key
       or v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception 'CATALOG_CONTRIBUTION_REQUEST_CONFLICT';
    end if;
    return v_existing;
  end if;
  if (select count(*) from public.catalog_contributions
      where user_id = p_user_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'CATALOG_CONTRIBUTION_DAILY_LIMIT';
  end if;
  v_evidence := coalesce(p_payload -> 'evidence', '[]'::jsonb);
  if jsonb_typeof(v_evidence) <> 'array' or jsonb_array_length(v_evidence) > 3 then
    raise exception 'INVALID_CATALOG_CONTRIBUTION_EVIDENCE';
  end if;
  for v_entry in select value from jsonb_array_elements(v_evidence) loop
    if jsonb_typeof(v_entry) <> 'object'
       or (v_entry ->> 'evidenceId') !~ '^[0-9a-f-]{36}$'
       or v_entry ->> 'role' not in ('front_label', 'ingredients', 'packaging') then
      raise exception 'INVALID_CATALOG_CONTRIBUTION_EVIDENCE';
    end if;
    v_evidence_id := (v_entry ->> 'evidenceId')::uuid;
    v_role := v_entry ->> 'role';
    if not exists (
      select 1 from public.free_product_evidence_grants g
      join storage.objects o on o.bucket_id = 'customer-product-evidence'
        and o.name = g.storage_path and o.owner_id = p_user_id::text
      where g.id = v_evidence_id and g.user_id = p_user_id and g.role = v_role
    ) then
      raise exception 'CATALOG_CONTRIBUTION_EVIDENCE_UNAVAILABLE';
    end if;
    v_count := v_count + 1;
  end loop;
  if v_count <> (select count(distinct value ->> 'role') from jsonb_array_elements(v_evidence)) then
    raise exception 'INVALID_CATALOG_CONTRIBUTION_EVIDENCE';
  end if;
  insert into public.catalog_contributions
    (user_id, request_id, payload, candidate_key, request_fingerprint, consent_version)
  values (p_user_id, p_request_id, p_payload, p_candidate_key, p_request_fingerprint, p_consent_version)
  returning * into v_existing;
  return v_existing;
end;
$$;
revoke all on function public.submit_catalog_contribution(uuid,uuid,jsonb,text,text,integer)
  from public, anon, authenticated;
grant execute on function public.submit_catalog_contribution(uuid,uuid,jsonb,text,text,integer)
  to service_role;

create function public.withdraw_catalog_contribution(p_user_id uuid, p_contribution_id uuid)
returns public.catalog_contributions
language plpgsql volatile security invoker set search_path = ''
as $$
declare v_row public.catalog_contributions;
begin
  if p_user_id is null or p_contribution_id is null then
    raise exception 'INVALID_CATALOG_CONTRIBUTION';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 191027));
  update public.catalog_contributions
    set status = 'withdrawn', payload = null, candidate_key = null,
      request_fingerprint = null, withdrawn_at = now()
    where id = p_contribution_id and user_id = p_user_id and status = 'submitted'
    returning * into v_row;
  if found then return v_row; end if;
  select * into v_row from public.catalog_contributions
    where id = p_contribution_id and user_id = p_user_id;
  if not found then raise exception 'CATALOG_CONTRIBUTION_NOT_FOUND'; end if;
  return v_row;
end;
$$;
revoke all on function public.withdraw_catalog_contribution(uuid,uuid) from public, anon, authenticated;
grant execute on function public.withdraw_catalog_contribution(uuid,uuid) to service_role;
