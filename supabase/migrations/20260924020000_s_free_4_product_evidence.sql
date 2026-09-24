-- S-FREE-4: bounded, owner-scoped private evidence for free Check.
-- Managed Shelf keeps its existing direct-upload policy and 10 MB allowance.
create table public.free_product_evidence_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  role text not null check (role in ('front_label', 'ingredients', 'packaging')),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  unique (user_id, request_id),
  constraint free_product_evidence_path_check check (
    storage_path ~ ('^' || user_id::text || '/free_scan/(front_label|ingredients|packaging)/[0-9a-f-]{36}[.](jpg|png|webp|heic|heif)$')
  )
);
create index free_product_evidence_grants_user_created_idx
  on public.free_product_evidence_grants (user_id, created_at desc);
alter table public.free_product_evidence_grants enable row level security;
revoke all on public.free_product_evidence_grants from public, anon, authenticated;
grant select on public.free_product_evidence_grants to authenticated;
create policy free_product_evidence_grants_select_own on public.free_product_evidence_grants
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.issue_free_product_evidence_grant(
  p_user_id uuid, p_request_id uuid, p_role text, p_mime_type text
)
returns public.free_product_evidence_grants
language plpgsql security invoker set search_path = ''
as $$
declare
  v_existing public.free_product_evidence_grants;
  v_extension text;
  v_path text;
begin
  if p_user_id is null or p_request_id is null or p_role is null
      or p_role not in ('front_label', 'ingredients', 'packaging') then
    raise exception 'INVALID_FREE_EVIDENCE_REQUEST';
  end if;
  v_extension := case p_mime_type
    when 'image/jpeg' then 'jpg' when 'image/png' then 'png'
    when 'image/webp' then 'webp' when 'image/heic' then 'heic'
    when 'image/heif' then 'heif' else null end;
  if v_extension is null then raise exception 'INVALID_FREE_EVIDENCE_MIME'; end if;
  -- Serialize quota/replay for this owner, including simultaneous devices.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 78146));
  select * into v_existing from public.free_product_evidence_grants
    where user_id = p_user_id and request_id = p_request_id;
  if found then
    if v_existing.role <> p_role or v_existing.mime_type <> p_mime_type then
      raise exception 'FREE_EVIDENCE_REQUEST_CONFLICT';
    end if;
    return v_existing;
  end if;
  if (select count(*) from public.free_product_evidence_grants
      where user_id = p_user_id and created_at > now() - interval '24 hours') >= 6 then
    raise exception 'FREE_EVIDENCE_DAILY_LIMIT';
  end if;
  v_path := p_user_id::text || '/free_scan/' || p_role || '/' || gen_random_uuid()::text || '.' || v_extension;
  insert into public.free_product_evidence_grants (user_id, request_id, role, mime_type, storage_path)
  values (p_user_id, p_request_id, p_role, p_mime_type, v_path)
  returning * into v_existing;
  return v_existing;
end;
$$;
revoke all on function public.issue_free_product_evidence_grant(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.issue_free_product_evidence_grant(uuid, uuid, text, text)
  to service_role;

-- New guests get no access to legacy managed paths. The caller must first
-- obtain an opaque, owner-bound path through the Edge endpoint.
create policy customer_product_evidence_free_insert_granted on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'customer-product-evidence'
    and owner_id = (select auth.uid())::text
    and exists (
      select 1 from public.free_product_evidence_grants g
      where g.user_id = (select auth.uid())
        and g.storage_path = name
        and g.created_at > now() - interval '24 hours'
    )
  );
