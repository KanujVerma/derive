-- S-FREE-3: free Check memory is separate from managed-care Shelf/reactions.
-- An anonymous Auth identity owns rows exactly like a permanent identity.
create table public.free_saved_products (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  product_id uuid references public.products(id) on delete restrict,
  brand text,
  name text not null,
  source text not null check (source in ('catalog', 'user_reported')),
  state text not null check (state in ('using', 'considering', 'stopped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id),
  constraint free_saved_products_source_identity_check check (
    (source = 'catalog' and product_id is not null)
    or (source = 'user_reported' and product_id is null)
  ),
  constraint free_saved_products_name_check check (length(trim(name)) between 1 and 180),
  constraint free_saved_products_brand_check check (brand is null or length(trim(brand)) between 1 and 120)
);

create table public.free_check_history (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  resolution_case_id uuid references public.product_resolution_cases(id) on delete set null,
  product_id uuid references public.products(id) on delete restrict,
  brand text,
  product_name text not null,
  resolution_state text not null check (resolution_state in (
    'catalog_product', 'verified_product_formula', 'identified_formula_unverified',
    'ambiguous_candidates', 'formula_only', 'insufficient_evidence'
  )),
  checked_at timestamptz not null default now(),
  unique (user_id, request_id),
  constraint free_check_history_name_check check (length(trim(product_name)) between 1 and 180)
);

create table public.free_product_experiences (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  product_id uuid references public.products(id) on delete restrict,
  brand text,
  product_name text not null,
  source text not null check (source in ('catalog', 'user_reported')),
  kind text not null check (kind in ('tolerated', 'reacted', 'liked', 'finished')),
  note text,
  noted_at timestamptz not null default now(),
  unique (user_id, request_id),
  constraint free_product_experiences_source_identity_check check (
    (source = 'catalog' and product_id is not null)
    or (source = 'user_reported' and product_id is null)
  ),
  constraint free_product_experiences_name_check check (length(trim(product_name)) between 1 and 180),
  constraint free_product_experiences_note_check check (note is null or length(note) <= 500)
);

create trigger free_saved_products_updated_at before update on public.free_saved_products
  for each row execute function private.set_updated_at();

create or replace function private.validate_free_check_case_owner()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.resolution_case_id is not null and not exists (
    select 1 from public.product_resolution_cases as c
    where c.id = new.resolution_case_id and c.user_id = new.user_id and c.consumer = 'scan'
  ) then
    raise exception 'FREE_CHECK_CASE_OWNER_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_free_check_case_owner() from public, anon, authenticated;
create trigger free_check_history_case_owner before insert or update on public.free_check_history
  for each row execute function private.validate_free_check_case_owner();

create index free_saved_products_owner_page_idx on public.free_saved_products (user_id, seq desc);
create index free_check_history_owner_page_idx on public.free_check_history (user_id, seq desc);
create index free_product_experiences_owner_page_idx on public.free_product_experiences (user_id, seq desc);
create index free_product_experiences_owner_product_idx on public.free_product_experiences (user_id, product_id, seq desc)
  where product_id is not null;

alter table public.free_saved_products enable row level security;
alter table public.free_check_history enable row level security;
alter table public.free_product_experiences enable row level security;

-- Raw notes/history are not exposed through PostgREST. The JWT-gated Edge
-- adapter projects bounded responses after deriving the owner from Auth.
revoke all on public.free_saved_products, public.free_check_history, public.free_product_experiences
  from public, anon, authenticated;
grant select, insert, update, delete on public.free_saved_products to service_role;
grant select, insert, delete on public.free_check_history, public.free_product_experiences to service_role;
grant usage, select on sequence public.free_saved_products_seq_seq,
  public.free_check_history_seq_seq, public.free_product_experiences_seq_seq to service_role;
