begin;
select plan(21);

select ok(
  has_function_privilege('service_role', 'private.ingest_catalog_product(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'private.ingest_catalog_product(jsonb)', 'execute')
  and not has_function_privilege('anon', 'private.ingest_catalog_product(jsonb)', 'execute'),
  'catalog ingestion is trusted-operator only'
);

create temp table catalog_ingest_first as
select private.ingest_catalog_product('{
  "product": {
    "brand": "CeraVe", "name": "Renewing SA Cleanser", "category": "cleanser",
    "sourceReference": "https://manufacturer.example/sa", "observedAt": "2026-09-22T00:00:00Z"
  },
  "aliases": [{"name": "CeraVe SA Cleanser", "sourceReference": "https://manufacturer.example/sa", "observedAt": "2026-09-22T00:00:00Z"}]
}'::jsonb) as result;

select is((select count(*)::integer from public.products where brand='CeraVe' and name='Renewing SA Cleanser' and is_catalog_standard=true and catalog_verified_at is not null),1,'product-only entry creates sourced catalog identity');
select is((select count(*)::integer from public.product_search_aliases where alias='CeraVe SA Cleanser'),1,'operator adds sourced alias');
select is((select count(*)::integer from public.product_variants where product_id=((select result->>'productId' from catalog_ingest_first)::uuid)),0,'product-only record does not invent a variant');
select is((select product_id from public.search_product_catalog('CeraVe SA Cleanser',10) limit 1),(select (result->>'productId')::uuid from catalog_ingest_first),'ingested alias resolves to canonical id');

select is(
  (private.ingest_catalog_product('{
    "product": {"brand":"CeraVe","name":"Renewing SA Cleanser","category":"cleanser","sourceReference":"https://manufacturer.example/sa","observedAt":"2026-09-22T00:00:00Z"},
    "aliases": [{"name":"CeraVe SA Cleanser","sourceReference":"https://manufacturer.example/sa","observedAt":"2026-09-22T00:00:00Z"}]
  }'::jsonb)->>'productId')::uuid,
  (select (result->>'productId')::uuid from catalog_ingest_first),
  'replaying a sourced product returns the same canonical id'
);
select is((select count(*)::integer from public.product_search_aliases where alias='CeraVe SA Cleanser'),1,'replay does not duplicate aliases');

create temp table catalog_ingest_extended as
select private.ingest_catalog_product('{
  "product": {"brand":"CeraVe","name":"Renewing SA Cleanser","category":"cleanser","sourceReference":"https://manufacturer.example/sa","observedAt":"2026-09-22T00:00:00Z"},
  "variant": {"name":"US 237 mL","regionCode":"US","packageSize":"237 mL","packagingMarkers":["blue bottle"],"sourceReference":"https://manufacturer.example/sa-variant","observedAt":"2026-09-22T00:00:00Z","verificationStatus":"verified"},
  "formula": {"ingredients":["Water","Glycerin"],"normalizedIngredientFingerprint":"water|glycerin","provenanceType":"manufacturer","sourceReference":"https://manufacturer.example/sa-ingredients","observedAt":"2026-09-22T00:00:00Z","verificationStatus":"verified"},
  "identifier": {"type":"gtin_12","value":"036000291452","sourceAuthority":"manufacturer","sourceReference":"https://manufacturer.example/sa-gtin","observedAt":"2026-09-22T00:00:00Z","verifiedAt":"2026-09-22T00:00:00Z","linkFormula":true}
}'::jsonb) as result;

select ok((select catalog_source_reference='https://manufacturer.example/sa-variant' and catalog_observed_at='2026-09-22T00:00:00Z'::timestamptz and catalog_verification_status='verified' from public.product_variants where id=(select (result->>'variantId')::uuid from catalog_ingest_extended)),'variant source, date, and verification state are preserved');

select ok(
  (select count(*) from public.product_variants where product_id=(select (result->>'productId')::uuid from catalog_ingest_extended))=1
  and (select count(*) from public.product_formula_versions where id=(select (result->>'formulaVersionId')::uuid from catalog_ingest_extended) and verification_status='verified')=1
  and (select count(*) from public.product_identifiers where id=(select (result->>'identifierId')::uuid from catalog_ingest_extended) and formula_version_id=(select (result->>'formulaVersionId')::uuid from catalog_ingest_extended) and verified_at is not null)=1,
  'operator preserves variant, verified formula, and authoritative GTIN linkage in S6 tables'
);
select throws_ok(
  $$select private.ingest_catalog_product('{"product":{"brand":"Unknown","name":"No Source","category":"cleanser"}}'::jsonb)$$,
  'CATALOG_SOURCE_REQUIRED',
  'source-free canonical identity is refused'
);


select ok(
  (private.ingest_catalog_product('{
    "product":{"brand":"CeraVe","name":"Renewing SA Cleanser","category":"cleanser","sourceReference":"https://manufacturer.example/sa","observedAt":"2026-09-22T00:00:00Z"},
    "variant":{"name":"Test Mini","regionCode":"US","sourceReference":"https://manufacturer.example/sa-variant","observedAt":"2026-09-22T00:00:00Z","verificationStatus":"verified"},
    "identifier":{"type":"gtin_8","value":"96385074","sourceAuthority":"manufacturer","sourceReference":"https://manufacturer.example/gtin8","observedAt":"2026-09-22T00:00:00Z","verifiedAt":"2026-09-22T00:00:00Z"}
  }'::jsonb)->>'identifierId') is not null,
  'valid GTIN-8 with exact type can be recorded without a formula claim'
);
select throws_ok(
  $$select private.ingest_catalog_product('{"product":{"brand":"CeraVe","name":"Renewing SA Cleanser","category":"cleanser","sourceReference":"https://manufacturer.example/sa","observedAt":"2026-09-22T00:00:00Z"},"variant":{"name":"Bad Barcode","sourceReference":"https://manufacturer.example/sa-variant","observedAt":"2026-09-22T00:00:00Z","verificationStatus":"verified"},"identifier":{"type":"gtin_12","value":"036000291453","sourceAuthority":"manufacturer","sourceReference":"https://manufacturer.example/bad","observedAt":"2026-09-22T00:00:00Z"}}'::jsonb)$$,
  'CATALOG_INVALID_IDENTIFIER',
  'incorrect GTIN check digit is refused'
);
select throws_ok(
  $$select private.ingest_catalog_product('{"product":{"brand":"CeraVe","name":"Renewing SA Cleanser","category":"cleanser","sourceReference":"https://manufacturer.example/sa","observedAt":"2026-09-22T00:00:00Z"},"variant":{"name":"Bad Formula","sourceReference":"https://manufacturer.example/sa-variant","observedAt":"2026-09-22T00:00:00Z","verificationStatus":"verified"},"formula":{"ingredients":["Water"],"normalizedIngredientFingerprint":"water","provenanceType":"member_photo","sourceReference":"member photo","observedAt":"2026-09-22T00:00:00Z","verificationStatus":"verified"}}'::jsonb)$$,
  'CATALOG_UNSUPPORTED_FORMULA_PROVENANCE',
  'member photo alone cannot verify formula truth'
);


insert into public.products(id,brand,name,category,key_actives,full_ingredients,is_catalog_standard)
values ('a1500000-0000-4000-8000-000000000001','Evidence Lab','Candidate Wash','other',array['Unverified claim'],array['Unknown formula'],false);
insert into auth.users(id,email) values ('a1600000-0000-4000-8000-000000000001','catalog-promotion-owner@example.test');
insert into public.user_products(user_id,product_id,action) values ('a1600000-0000-4000-8000-000000000001','a1500000-0000-4000-8000-000000000001','KEEP');
create temp table catalog_promoted as
select private.ingest_catalog_product('{"product":{"brand":"Evidence Lab","name":"Candidate Wash","category":"cleanser","sourceReference":"https://manufacturer.example/candidate","observedAt":"2026-09-22T00:00:00Z"}}'::jsonb) as result;
select is((select (result->>'productId')::uuid from catalog_promoted),'a1500000-0000-4000-8000-000000000001'::uuid,'sourced ingest reuses matching provisional product id');
select ok((select is_catalog_standard and category='cleanser' and key_actives='{}'::text[] and full_ingredients='{}'::text[] and catalog_source_reference='https://manufacturer.example/candidate' from public.products where id='a1500000-0000-4000-8000-000000000001'),'promotion clears unverified chemistry and records source');
select is((select count(*)::integer from public.user_products where user_id='a1600000-0000-4000-8000-000000000001' and product_id='a1500000-0000-4000-8000-000000000001'),1,'promotion preserves the member shelf link');

select throws_ok(
  $$select private.ingest_catalog_product('{"product":{"brand":"CeraVe","name":"Renewing SA Cleanser","category":"cleanser","sourceReference":"https://manufacturer.example/sa","observedAt":"2026-09-22T00:00:00Z"},"aliases":[{"name":"CeraVe SA Cleanser","sourceReference":"https://different.example/alias","observedAt":"2026-09-22T00:00:00Z"}]}'::jsonb)$$,
  'CATALOG_ALIAS_PROVENANCE_CONFLICT',
  'alias replay with changed source is refused'
);
select throws_ok(
  $$select private.ingest_catalog_product('{"product":{"brand":"CeraVe","name":"Renewing SA Cleanser","category":"cleanser","sourceReference":"https://manufacturer.example/sa","observedAt":"2026-09-22T00:00:00Z"},"variant":{"name":"US 237 mL","regionCode":"US","packageSize":"237 mL","sourceReference":"https://manufacturer.example/sa-variant","observedAt":"2026-09-22T00:00:00Z","verificationStatus":"verified"},"formula":{"ingredients":["Water","Glycerin"],"normalizedIngredientFingerprint":"water|glycerin","provenanceType":"founder_review","sourceReference":"https://manufacturer.example/sa-ingredients","observedAt":"2026-09-22T00:00:00Z","verificationStatus":"verified"}}'::jsonb)$$,
  'CATALOG_FORMULA_PROVENANCE_CONFLICT',
  'formula replay cannot silently replace immutable provenance'
);
select throws_ok(
  $$select private.ingest_catalog_product('{"product":{"brand":"CeraVe","name":"Renewing SA Cleanser","category":"cleanser","sourceReference":"https://manufacturer.example/sa","observedAt":"2026-09-22T00:00:00Z"},"variant":{"name":"US 237 mL","regionCode":"US","packageSize":"237 mL","sourceReference":"https://manufacturer.example/sa-variant","observedAt":"2026-09-22T00:00:00Z","verificationStatus":"verified"},"formula":{"ingredients":["Water","Glycerin"],"normalizedIngredientFingerprint":"water|glycerin","provenanceType":"manufacturer","sourceReference":"https://manufacturer.example/sa-ingredients","observedAt":"2026-09-22T00:00:00Z","verificationStatus":"verified"},"identifier":{"type":"gtin_12","value":"036000291452","sourceAuthority":"manufacturer","sourceReference":"https://manufacturer.example/sa-gtin","observedAt":"2026-09-22T00:00:00Z","verifiedAt":"2026-09-23T00:00:00Z","linkFormula":true}}'::jsonb)$$,
  'CATALOG_IDENTIFIER_PROVENANCE_CONFLICT',
  'identifier replay cannot silently claim a new verification date'
);

select throws_ok(
  $$select private.ingest_catalog_product('{"product":{"brand":"CeraVe","name":"Renewing SA Cleanser","category":"cleanser","sourceReference":"https://manufacturer.example/sa","observedAt":"2026-09-22T00:00:00Z"},"variant":{"name":"US 237 mL","regionCode":"US","packageSize":"237 mL","packagingMarkers":["red bottle"],"sourceReference":"https://manufacturer.example/sa-variant","observedAt":"2026-09-22T00:00:00Z","verificationStatus":"verified"}}'::jsonb)$$,
  'CATALOG_VARIANT_PROVENANCE_CONFLICT',
  'operator cannot silently replace sourced package markers'
);

insert into public.product_variants(id,product_id,variant_name,region_code,package_size,packaging_markers)
values ('a1700000-0000-4000-8000-000000000001',(select (result->>'productId')::uuid from catalog_ingest_first),'Legacy Bottle','US','50 mL',array['original blue cap']);
select private.ingest_catalog_product('{"product":{"brand":"CeraVe","name":"Renewing SA Cleanser","category":"cleanser","sourceReference":"https://manufacturer.example/sa","observedAt":"2026-09-22T00:00:00Z"},"variant":{"name":"Legacy Bottle","regionCode":"US","packageSize":"50 mL","sourceReference":"https://manufacturer.example/legacy","observedAt":"2026-09-22T00:00:00Z","verificationStatus":"provisional"}}'::jsonb);
select is((select packaging_markers from public.product_variants where id='a1700000-0000-4000-8000-000000000001'),array['original blue cap'],'adding provenance to a legacy variant does not erase omitted package markers');

select * from finish();
rollback;
