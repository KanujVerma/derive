begin;
select plan(9);
insert into public.products(id,brand,name,category) values('d3333333-3333-4333-8333-333333333301','Synthetic','Identity only','moisturizer');
insert into public.product_variants(id,product_id,variant_name) values('d3333333-3333-4333-8333-333333333302','d3333333-3333-4333-8333-333333333301','Original package');
insert into public.product_identifiers(id,variant_id,identifier_type,identifier_value,source_authority,source_reference,verified_at) values('d3333333-3333-4333-8333-333333333303','d3333333-3333-4333-8333-333333333302','gtin_12','012345678905','founder','Original synthetic fixture only',now());
insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,observed_at,expires_at) values('d3333333-3333-4333-8333-333333333304','snapshot','d3333333-3333-4333-8333-333333333302',1,'gtin:00012345678905','derive_catalog','1','{"name":"Synthetic identity only"}',now(),now()+interval '1 hour');
select is(private.part_one_catalog_identity('gtin:00012345678905','{}')->0->>'snapshotId','d3333333-3333-4333-8333-333333333304','Actual verified GTIN lookup reuses authorized snapshot without ambiguous SQL payload');
select is(private.part_three_catalog_reference(null,'d3333333-3333-4333-8333-333333333304')->>'productId','d3333333-3333-4333-8333-333333333301','Admitted exact variant links the real catalog product');
select is(private.part_three_catalog_reference(null,'d3333333-3333-4333-8333-333333333304')->>'variantId','d3333333-3333-4333-8333-333333333302','Verified identifier establishes the genuine variant');
select ok(private.part_three_catalog_reference(null,'d3333333-3333-4333-8333-333333333304')->'formulaVersionId'='null'::jsonb,'Identity lookup never invents a formula association');
-- Both catalog identifiers and original snapshots are immutable. Negative
-- cases append independent original fixtures rather than mutating authority.
insert into public.product_identifiers(variant_id,identifier_type,identifier_value,source_authority,source_reference,verified_at) values('d3333333-3333-4333-8333-333333333302','gtin_12','098765432109','member','Original unverified synthetic fixture',null);
insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,observed_at,expires_at) values
 ('d3333333-3333-4333-8333-333333333305','snapshot','d3333333-3333-4333-8333-333333333302',2,'gtin:00098765432109','derive_catalog','1','{"name":"Synthetic unverified"}',now(),now()+interval '1 hour'),
 ('d3333333-3333-4333-8333-333333333306','snapshot','d3333333-3333-4333-8333-333333333302',3,'gtin:00999999999999','derive_catalog','1','{"name":"Synthetic unrelated"}',now(),now()+interval '1 hour'),
 ('d3333333-3333-4333-8333-333333333307','snapshot','d3333333-3333-4333-8333-333333333302',4,'gtin:00012345678905','derive_catalog','1','{"name":"Synthetic expired"}',now()-interval '1 hour',now()-interval '1 second');
select ok(private.part_three_catalog_reference(null,'d3333333-3333-4333-8333-333333333305') is null,'Unverified identifiers cannot establish candidate catalog scope');
select ok(private.part_three_catalog_reference(null,'d3333333-3333-4333-8333-333333333306') is null,'A catalog variant ID alone cannot prove an unrelated identifier');
select ok(private.part_three_catalog_reference(null,'d3333333-3333-4333-8333-333333333307') is null,'Expired original identity bytes lose derived identity scope');
insert into public.product_variants(id,product_id,variant_name,lifecycle_status) values('d3333333-3333-4333-8333-333333333312','d3333333-3333-4333-8333-333333333301','Discontinued package','discontinued');
insert into public.product_identifiers(variant_id,identifier_type,identifier_value,source_authority,source_reference,verified_at) values('d3333333-3333-4333-8333-333333333312','gtin_12','012345678905','founder','Original inactive fixture',now());
insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,observed_at,expires_at) values('d3333333-3333-4333-8333-333333333314','snapshot','d3333333-3333-4333-8333-333333333312',1,'gtin:00012345678905','derive_catalog','1','{"name":"Synthetic inactive"}',now(),now()+interval '1 hour');
select ok(private.part_three_catalog_reference(null,'d3333333-3333-4333-8333-333333333314') is null,'Inactive catalog authority cannot be reused');
select ok(not has_function_privilege('authenticated','private.part_three_catalog_reference(uuid,uuid)','EXECUTE'),'Client cannot bypass owned source identity resolution');
select * from finish();
rollback;
