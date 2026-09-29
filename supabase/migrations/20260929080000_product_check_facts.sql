-- Owner-bound, immutable factual Check companion; not canonical catalog truth.
create table public.product_check_fact_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id uuid not null references public.product_resolution_cases(id) on delete cascade,
  snapshot_id uuid not null unique references public.product_truth_snapshots(id) on delete cascade,
  schema_version text not null default 'product-check-facts/v1' check (schema_version = 'product-check-facts/v1'),
  packet jsonb not null check (jsonb_typeof(packet) = 'object' and octet_length(packet::text) <= 65536),
  created_at timestamptz not null default now()
);
create index product_check_fact_assessments_owner_created_idx on public.product_check_fact_assessments (user_id, created_at desc);
alter table public.product_check_fact_assessments enable row level security;
revoke all on public.product_check_fact_assessments from public, anon, authenticated;
grant select on public.product_check_fact_assessments to authenticated;
grant all on public.product_check_fact_assessments to service_role;
create policy product_check_fact_assessments_owner_read on public.product_check_fact_assessments
  for select to authenticated using ((select auth.uid()) = user_id);
create trigger product_check_fact_assessments_no_update before update on public.product_check_fact_assessments
  for each row execute function private.reject_immutable_snapshot_update();

create or replace function public.persist_product_check_facts(p_user_id uuid, p_case_id uuid, p_snapshot_id uuid, p_packet jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing jsonb; snapshot_revision integer;
begin
  if p_user_id is null or p_case_id is null or p_snapshot_id is null
    or jsonb_typeof(p_packet) is distinct from 'object' or octet_length(p_packet::text) > 65536
    or p_packet->>'schemaVersion' is distinct from 'product-check-facts/v1'
    or p_packet->>'caseId' is distinct from p_case_id::text
    or p_packet->>'snapshotId' is distinct from p_snapshot_id::text then
    raise exception 'INVALID_PRODUCT_FACTS_PACKET';
  end if;
  if not exists (select 1 from public.product_resolution_cases c where c.id = p_case_id and c.user_id = p_user_id and c.consumer = 'scan') then
    raise exception 'PRODUCT_FACTS_CASE_NOT_FOUND';
  end if;
  select s.case_revision into snapshot_revision from public.product_truth_snapshots s
    where s.id = p_snapshot_id and s.case_id = p_case_id and s.user_id = p_user_id;
  if not found or p_packet->>'caseRevision' is distinct from snapshot_revision::text then
    raise exception 'PRODUCT_FACTS_SNAPSHOT_MISMATCH';
  end if;
  select packet into existing from public.product_check_fact_assessments
    where snapshot_id = p_snapshot_id and user_id = p_user_id and case_id = p_case_id;
  if found then return existing; end if;
  insert into public.product_check_fact_assessments (user_id, case_id, snapshot_id, packet)
    values (p_user_id, p_case_id, p_snapshot_id, p_packet) on conflict (snapshot_id) do nothing;
  select packet into existing from public.product_check_fact_assessments
    where snapshot_id = p_snapshot_id and user_id = p_user_id and case_id = p_case_id;
  if not found then raise exception 'PRODUCT_FACTS_CONFLICT'; end if;
  return existing;
end;
$$;
revoke all on function public.persist_product_check_facts(uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.persist_product_check_facts(uuid,uuid,uuid,jsonb) to service_role;
