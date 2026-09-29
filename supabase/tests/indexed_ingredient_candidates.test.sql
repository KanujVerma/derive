begin;
select plan(23);
select ok(exists(select 1 from pg_indexes where schemaname='public'
  and indexname='product_formula_ingredient_evidence_idx'), 'dedicated verified ingredient digest index exists');
select ok(has_function_privilege('service_role','public.lookup_ingredient_candidate_ids(text[],boolean,uuid)','execute')
  and not has_function_privilege('anon','public.lookup_ingredient_candidate_ids(text[],boolean,uuid)','execute')
  and not has_function_privilege('authenticated','public.lookup_ingredient_candidate_ids(text[],boolean,uuid)','execute'),
  'candidate RPC is service-only');
select ok(not has_function_privilege('authenticated','private.ingredient_evidence_key(text[])','execute'),
  'normalization helper is not a customer evidence oracle');
select is(private.ingredient_evidence_key(array[' ＷＡＴＥＲ ', U&'Niacinamide\00A0 2.5%']),
  array['water','niacinamide 2.5%'], 'NFKC, whitespace and case mirror conservative evidence equality');
select is(private.ingredient_evidence_key(array['ΟΣ']),array['ος'],'Unicode contextual lowercase matches JavaScript');
select isnt(private.ingredient_evidence_digest(array['Water','Glycerin']),
  private.ingredient_evidence_digest(array['Water','Glycerin.']), 'punctuation remains evidence');

insert into auth.users(id,email) values
 ('a1900000-0000-4000-8000-000000000099','ingredient-owner@example.test'),
 ('a1900000-0000-4000-8000-000000000098','ingredient-other@example.test');
insert into public.products(id,brand,name,category,is_catalog_standard,catalog_source_reference,catalog_observed_at,catalog_verified_at)
values ('a1910000-0000-4000-8000-000000000001','Synthetic','Public wash','cleanser',true,'https://example.org/wash',now(),now()),
 ('a1910000-0000-4000-8000-000000000002','Synthetic','Private wash','cleanser',false,null,null,null);
insert into public.user_products(user_id,product_id,action) values
 ('a1900000-0000-4000-8000-000000000099','a1910000-0000-4000-8000-000000000002','KEEP');
insert into public.product_variants(id,product_id,variant_name,region_code,lifecycle_status,
 catalog_verification_status,catalog_source_reference,catalog_observed_at) values
 ('a1920000-0000-4000-8000-000000000001','a1910000-0000-4000-8000-000000000001','Public','CA','active','verified','https://example.org/wash',now()),
 ('a1920000-0000-4000-8000-000000000002','a1910000-0000-4000-8000-000000000002','Private','US','active','provisional',null,null),
 ('a1920000-0000-4000-8000-000000000003','a1910000-0000-4000-8000-000000000001','Old','US','discontinued','verified','https://example.org/old',now());
insert into public.product_formula_versions(id,variant_id,ingredients,normalized_ingredient_fingerprint,
 region_code,provenance_type,source_reference,catalog_public_source_url,observed_at,verification_status) values
 ('a1930000-0000-4000-8000-000000000001','a1920000-0000-4000-8000-000000000001',array['Water','Glycerin'],'deliberately-wrong','CA','manufacturer','https://example.org/1','https://example.org/1',now(),'verified'),
 ('a1930000-0000-4000-8000-000000000002','a1920000-0000-4000-8000-000000000002',array['Water','Glycerin'],'wrong', 'US','founder_review','internal://private',null,now(),'verified'),
 ('a1930000-0000-4000-8000-000000000003',null,array['Water','Glycerin'],'wrong','US','manufacturer','https://example.org/3','https://example.org/3',now(),'verified'),
 ('a1930000-0000-4000-8000-000000000004',null,array['Water','Glycerin'],'wrong',null,'founder_review','internal://private-detached',null,now(),'verified'),
 ('a1930000-0000-4000-8000-000000000005',null,array['Water/Glycerin'],'wrong',null,'manufacturer','https://example.org/5','https://example.org/5',now(),'verified'),
 ('a1930000-0000-4000-8000-000000000006',null,array['Glycerin','Water'],'wrong',null,'manufacturer','https://example.org/6','https://example.org/6',now(),'verified'),
 ('a1930000-0000-4000-8000-000000000007',null,array['Water','Glycerin','Glycerin'],'wrong',null,'manufacturer','https://example.org/7','https://example.org/7',now(),'verified'),
 ('a1930000-0000-4000-8000-000000000008',null,array['Water','Glycerin'],'wrong',null,'member_photo','https://example.org/8','https://example.org/8',now(),'provisional'),
 ('a1930000-0000-4000-8000-000000000009','a1920000-0000-4000-8000-000000000003',array['Water','Glycerin'],'wrong','US','manufacturer','https://example.org/9','https://example.org/9',now(),'verified');
select is(cardinality(public.lookup_ingredient_candidate_ids(array['water','glycerin'],true,'a1900000-0000-4000-8000-000000000099')),2,
 'free lookup returns all public exact evidence without choosing a winner');
select is(cardinality(public.lookup_ingredient_candidate_ids(array['water','glycerin'],false,'a1900000-0000-4000-8000-000000000098')),2,
 'other owner cannot retrieve a private or ownerless-private formula');
select is(cardinality(public.lookup_ingredient_candidate_ids(array['water','glycerin'],false,'a1900000-0000-4000-8000-000000000099')),3,
 'managed owner retains their verified private formula');
select ok(not('a1930000-0000-4000-8000-000000000004'::uuid=any(public.lookup_ingredient_candidate_ids(array['water','glycerin'],false,'a1900000-0000-4000-8000-000000000099'))),
 'detached private evidence is never attributed to an owner');
select ok('a1930000-0000-4000-8000-000000000001'::uuid=any(public.lookup_ingredient_candidate_ids(array['water','glycerin'],true,'a1900000-0000-4000-8000-000000000099')),
 'different-market exact evidence remains available for region-mismatch abstention');
select is(public.lookup_ingredient_candidate_ids(array['glycerin','water'],true,'a1900000-0000-4000-8000-000000000099'),
 array['a1930000-0000-4000-8000-000000000006'::uuid], 'ingredient order cannot silently match');
select is(public.lookup_ingredient_candidate_ids(array['water/glycerin'],true,'a1900000-0000-4000-8000-000000000099'),
 array['a1930000-0000-4000-8000-000000000005'::uuid], 'slash-separated ingredient is not two ingredients');
select is(public.lookup_ingredient_candidate_ids(array['water','glycerin','glycerin'],true,'a1900000-0000-4000-8000-000000000099'),
 array['a1930000-0000-4000-8000-000000000007'::uuid], 'duplicates remain ordered evidence');
select ok(not('a1930000-0000-4000-8000-000000000008'::uuid=any(public.lookup_ingredient_candidate_ids(array['water','glycerin'],true,'a1900000-0000-4000-8000-000000000099')))
 and not('a1930000-0000-4000-8000-000000000009'::uuid=any(public.lookup_ingredient_candidate_ids(array['water','glycerin'],true,'a1900000-0000-4000-8000-000000000099'))),
 'unverified formulas and discontinued variants remain outside candidates');
select is(cardinality(public.lookup_ingredient_candidate_ids('{}',true,'a1900000-0000-4000-8000-000000000099')),0,'empty evidence abstains');
select is(cardinality(public.lookup_ingredient_candidate_ids(array['Water','Glycerin'],true,null)),0,'missing owner abstains');
select is(cardinality(public.lookup_ingredient_candidate_ids(array[' '],true,'a1900000-0000-4000-8000-000000000099')),0,'blank ingredient abstains');
select ok('a1930000-0000-4000-8000-000000000001'::uuid=any(public.lookup_ingredient_candidate_ids(array[' Ｗａｔｅｒ ','GLYCERIN'],true,'a1900000-0000-4000-8000-000000000099')),
 'actual normalized ingredients match despite deliberately false legacy fingerprint');
set local role service_role;
select is(cardinality(public.lookup_ingredient_candidate_ids(array['water','glycerin'],true,'a1900000-0000-4000-8000-000000000099')),2,
 'service role can execute the bounded lookup under actual table/schema grants');
reset role;
set local role authenticated;
select throws_ok($$select public.lookup_ingredient_candidate_ids(array['Water'],true,'a1900000-0000-4000-8000-000000000099')$$,
 '42501',null,'customer cannot use privileged candidate RPC');
reset role;
insert into public.product_formula_versions(ingredients,normalized_ingredient_fingerprint,provenance_type,source_reference,observed_at,verification_status)
 select array['Water','Glycerin'],'wrong','founder_review','internal://private-overflow',now(),'verified' from generate_series(1,150);
select is(cardinality(public.lookup_ingredient_candidate_ids(array['Water','Glycerin'],true,'a1900000-0000-4000-8000-000000000099')),2,
 'invisible duplicates do not consume the candidate limit');
insert into public.product_formula_versions(ingredients,normalized_ingredient_fingerprint,provenance_type,source_reference,catalog_public_source_url,observed_at,verification_status)
 select array['Water','Glycerin'],'wrong','manufacturer','https://example.org/overflow','https://example.org/overflow',now(),'verified' from generate_series(1,102);
select is(cardinality(public.lookup_ingredient_candidate_ids(array['Water','Glycerin'],true,'a1900000-0000-4000-8000-000000000099')),101,
 '101st visible exact candidate signals overflow rather than a false unique match');
select * from finish();
rollback;
