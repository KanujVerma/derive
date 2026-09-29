begin;

select plan(14);

select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'products_identity_lookup_key_idx'),
  'exact product identity lookup has a dedicated expression index'
);
select ok(
  has_function_privilege('service_role', 'public.lookup_product_identity_exact_ids(text,text,boolean,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.lookup_product_identity_exact_ids(text,text,boolean,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.lookup_product_identity_exact_ids(text,text,boolean,uuid)', 'execute'),
  'exact identity RPC is service-only'
);
select is(private.product_identity_lookup_key('  Evidence-Lab  '), 'evidence lab',
  'key normalization retains hyphen/space equivalence');
select is(private.product_identity_lookup_key('Ｆｕｌｌｗｉｄｔｈ'), 'fullwidth',
  'key normalization performs NFKC before matching');

insert into public.products (id, brand, name, category, is_catalog_standard,
  catalog_source_reference, catalog_observed_at, catalog_verified_at)
values
  ('a1700000-0000-4000-8000-000000000001', 'Evidence-Lab', 'Barrier Wash', 'cleanser', true,
   'https://example.org/source-1', now(), now()),
  ('a1700000-0000-4000-8000-000000000002', 'Evidence Lab', 'Barrier-Wash', 'cleanser', true,
   'https://example.org/source-2', now(), now()),
  ('a1700000-0000-4000-8000-000000000003', 'Evidence Lab', 'Barrier Wash', 'cleanser', true,
   null, null, null);

insert into public.products (id, brand, name, category, is_catalog_standard)
values ('a1700000-0000-4000-8000-000000000004', 'Evidence  Lab', 'Barrier Wash', 'cleanser', false);

select is(
  cardinality(public.lookup_product_identity_exact_ids('evidence lab', 'barrier wash', true,
    'a1700000-0000-4000-8000-000000000099')),
  2,
  'free lookup returns every verified normalized duplicate, without choosing a winner'
);
select is(
  cardinality(public.lookup_product_identity_exact_ids('evidence lab', 'barrier wash', false,
    'a1700000-0000-4000-8000-000000000099')),
  3,
  'managed lookup retains standard provisional identities as candidates'
);
select is(
  cardinality(public.lookup_product_identity_exact_ids('evidence lab', 'other wash', true,
    'a1700000-0000-4000-8000-000000000099')),
  0,
  'unmatched exact identity has no fabricated candidate'
);
select ok(
  not ('a1700000-0000-4000-8000-000000000004'::uuid = any(
    public.lookup_product_identity_exact_ids('evidence lab', 'barrier wash', false,
      'a1700000-0000-4000-8000-000000000099'))),
  'an unlinked private product is not exposed to another managed member'
);
insert into auth.users (id, email) values
  ('a1700000-0000-4000-8000-000000000099', 'lookup-owner@example.test'),
  ('a1700000-0000-4000-8000-000000000098', 'lookup-other@example.test');
insert into auth.users (id, email, is_anonymous, raw_user_meta_data)
values ('a1700000-0000-4000-8000-000000000097', null, true, '{}'::jsonb);
insert into public.memberships (user_id, tier, status) values
  ('a1700000-0000-4000-8000-000000000099', 'founding_beta', 'active'),
  ('a1700000-0000-4000-8000-000000000098', 'founding_beta', 'active');
insert into public.user_products (user_id, product_id, action)
values ('a1700000-0000-4000-8000-000000000099',
  'a1700000-0000-4000-8000-000000000004', 'KEEP');
select ok(
  'a1700000-0000-4000-8000-000000000004'::uuid = any(
    public.lookup_product_identity_exact_ids('evidence lab', 'barrier wash', false,
      'a1700000-0000-4000-8000-000000000099')),
  'managed owner can resolve their own provisional product'
);

set local role authenticated;
set local request.jwt.claim.sub = 'a1700000-0000-4000-8000-000000000098';
select is((select count(*)::integer from public.products
  where id = 'a1700000-0000-4000-8000-000000000004'), 0,
  'active managed member cannot read another member private product through Data API');
select is((select count(*)::integer from public.products
  where id = 'a1700000-0000-4000-8000-000000000001'), 1,
  'active managed member retains shared standard product access');
set local request.jwt.claim.sub = 'a1700000-0000-4000-8000-000000000099';
select is((select count(*)::integer from public.products
  where id = 'a1700000-0000-4000-8000-000000000004'), 1,
  'managed owner retains their own private product Data API access');
set local request.jwt.claim.sub = 'a1700000-0000-4000-8000-000000000097';
select is((select count(*)::integer from public.products
  where id = 'a1700000-0000-4000-8000-000000000001'), 0,
  'guest still cannot read unrelated canonical raw product columns');
reset role;

insert into public.products (brand, name, category, is_catalog_standard)
select 'Overflow' || repeat(' ', n) || 'Brand', 'Overflow Product', 'cleanser', true
from generate_series(1, 102) n;
select is(
  cardinality(public.lookup_product_identity_exact_ids('overflow brand', 'overflow product', false,
    'a1700000-0000-4000-8000-000000000099')),
  101,
  'the 101st result explicitly signals overflow to the Edge caller'
);

select * from finish();
rollback;
