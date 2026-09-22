begin;

select plan(18);

select has_table('public', 'product_search_aliases', 'sourced catalog aliases are stored separately');
select ok((select count(*) from pg_indexes where schemaname='public' and indexname in ('products_catalog_brand_prefix_idx','products_catalog_name_prefix_idx','products_catalog_full_prefix_idx','products_catalog_brand_trgm_idx','products_catalog_name_trgm_idx','products_catalog_full_trgm_idx','product_search_aliases_prefix_idx','product_search_aliases_trgm_idx'))=8,'catalog has dedicated prefix and trigram indexes');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.product_search_aliases'::regclass),
  'alias table has RLS enabled'
);
select ok(
  not has_table_privilege('authenticated', 'public.product_search_aliases', 'insert')
  and not has_table_privilege('authenticated', 'public.product_search_aliases', 'update')
  and not has_table_privilege('authenticated', 'public.product_search_aliases', 'delete'),
  'customers cannot mutate canonical aliases'
);
select ok(
  has_function_privilege('service_role', 'public.search_product_catalog(text,integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.search_product_catalog(text,integer)', 'execute')
  and not has_function_privilege('anon', 'public.search_product_catalog(text,integer)', 'execute'),
  'search RPC is service-only behind authenticated Edge function'
);

insert into public.products (id,brand,name,category,is_catalog_standard,catalog_source_reference,catalog_observed_at,catalog_verified_at)
values
 ('a1100000-0000-4000-8000-000000000001','CeraVe','Renewing SA Cleanser','cleanser',true,'https://manufacturer.example/sa',now(),now()),
 ('a1100000-0000-4000-8000-000000000002','CeraVe','Hydrating Cleanser','cleanser',true,'https://manufacturer.example/hydrating',now(),now()),
 ('a1100000-0000-4000-8000-000000000003','Private Member','Secret Serum','serum',false,null,null,null);
insert into public.product_search_aliases (product_id,alias,source_reference,observed_at)
values ('a1100000-0000-4000-8000-000000000001','CeraVe SA Cleanser','https://manufacturer.example/sa',now());

select is(
 (select product_id from public.search_product_catalog('CeraVe Renewing SA Cleanser',10) limit 1),
 'a1100000-0000-4000-8000-000000000001'::uuid,
 'exact brand and product name ranks first'
);
select results_eq(
 $$select product_id from public.search_product_catalog('cera',10)$$,
 array['a1100000-0000-4000-8000-000000000002'::uuid,'a1100000-0000-4000-8000-000000000001'::uuid],
 'prefix results are stable by canonical name'
);
select is(
 (select count(*)::integer from public.search_product_catalog('CERAVE',10)),
 2,
 'search is case-insensitive'
);
select is(
 (select product_id from public.search_product_catalog('CeraVe SA Cleanser',10) limit 1),
 'a1100000-0000-4000-8000-000000000001'::uuid,
 'alias returns canonical product id'
);
select is(
 (select product_id from public.search_product_catalog('Renwing',10) limit 1),
 'a1100000-0000-4000-8000-000000000001'::uuid,
 'fuzzy typo still finds the canonical product deterministically'
);
select is(
 (select count(*)::integer from public.search_product_catalog('cera',1)),
 1,
 'caller result limit is honored'
);
select is(
 (select count(*)::integer from public.search_product_catalog('x',10)),
 0,
 'below-minimum query returns no products'
);
select is(
 (select count(*)::integer from public.search_product_catalog('Secret',10)),
 0,
 'provisional member-created product does not leak into canonical search'
);


insert into auth.users(id,email) values
 ('a1400000-0000-4000-8000-000000000001','catalog-owner@example.test'),
 ('a1400000-0000-4000-8000-000000000002','catalog-other@example.test');
insert into public.user_products(user_id,product_id,action)
values ('a1400000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000003','KEEP');
set local role authenticated;
set local request.jwt.claim.sub = 'a1400000-0000-4000-8000-000000000002';
select is(
 (select count(*)::integer from public.products where id='a1100000-0000-4000-8000-000000000003'),
 0,
 'another member cannot read a provisional product through the Data API'
);
select throws_ok(
  $$select catalog_source_reference from public.products$$,
  '42501', null,
  'internal product provenance is not directly selectable by a customer'
);
select throws_ok(
  $$select catalog_public_source_url from public.products$$,
  '42501', null,
  'public source URL is only projected through the bounded catalog API'
);
set local request.jwt.claim.sub = 'a1400000-0000-4000-8000-000000000001';
select is(
 (select count(*)::integer from public.products where id='a1100000-0000-4000-8000-000000000003'),
 1,
 'owner can still read their linked provisional shelf product'
);
select is(
 (select count(*)::integer from public.user_products shelf
  join public.products product on product.id = shelf.product_id
  where shelf.user_id = (select auth.uid())
    and product.id = 'a1100000-0000-4000-8000-000000000003'),
 1,
 'owner-bound Shelf join still reads its provisional product through column grants'
);
reset role;

select * from finish();
rollback;
