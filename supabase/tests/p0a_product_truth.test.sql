begin;
select plan(25);
select ok((select relrowsecurity from pg_class where oid = 'public.product_truth_snapshots'::regclass), 'snapshot RLS enabled');
select ok(not has_table_privilege('anon','public.product_truth_snapshots','select'), 'public anon cannot read snapshots');
select ok(not has_table_privilege('authenticated','public.product_truth_snapshots','insert'), 'customers cannot forge snapshots');
select ok(not has_function_privilege('authenticated','public.seal_product_truth_snapshot(uuid,uuid)','execute'), 'customers cannot seal truth');
insert into auth.users(id,is_anonymous,raw_user_meta_data) values
  ('a7100000-0000-4000-8000-000000000001',true,'{}'),
  ('a7100000-0000-4000-8000-000000000002',true,'{}');
insert into public.product_resolution_cases(id,user_id,request_id,consumer,resolution_state,next_action,evidence_snapshot)
values ('a7200000-0000-4000-8000-000000000001','a7100000-0000-4000-8000-000000000001',
  'a7300000-0000-4000-8000-000000000001','scan','insufficient_evidence','manual_review',
  '{"conflicts":["identity_mismatch"]}');
insert into public.product_resolution_evidence(case_id,user_id,evidence_type,source_type,storage_path,extracted_text)
values ('a7200000-0000-4000-8000-000000000001','a7100000-0000-4000-8000-000000000001',
  'front_label','member_input','a7100000-0000-4000-8000-000000000001/front_label/private.jpg','Private OCR');
select is(public.seal_product_truth_snapshot('a7100000-0000-4000-8000-000000000001','a7200000-0000-4000-8000-000000000001')->>'schemaVersion','1','schema V1');
select is((select count(*)::int from public.product_truth_snapshots),1,'one sealed snapshot');
select is(public.seal_product_truth_snapshot('a7100000-0000-4000-8000-000000000001','a7200000-0000-4000-8000-000000000001'),
  (select snapshot from public.product_truth_snapshots),'retry reuses exact snapshot');
select ok((select snapshot::text not like '%Private OCR%' and snapshot::text not like '%private.jpg%' from public.product_truth_snapshots),'no raw OCR or private path');
select is((select snapshot->>'identityStatus' from public.product_truth_snapshots),'unresolved','missing identity remains unknown');
select is((select snapshot->'conflicts'->0->>'status' from public.product_truth_snapshots),'unresolved','conflict remains inspectable');
select throws_ok($$select public.seal_product_truth_snapshot('a7100000-0000-4000-8000-000000000002','a7200000-0000-4000-8000-000000000001')$$,
  'P0001','PRODUCT_TRUTH_CASE_NOT_FOUND','cannot seal another owner case');
select throws_ok($$update public.product_truth_snapshots set snapshot = '{}'$$,'P0001',null,'snapshot cannot be rewritten');
set local role authenticated;
set local request.jwt.claim.sub = 'a7100000-0000-4000-8000-000000000002';
select is((select count(*)::int from public.product_truth_snapshots),0,'another owner sees no snapshots');
set local request.jwt.claim.sub = 'a7100000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.product_truth_snapshots),1,'owner can inspect sealed truth');
select throws_ok($$delete from public.product_truth_snapshots$$,'42501',null,'owner cannot delete history directly');
reset role;
update public.product_resolution_cases set next_action = 'photograph_ingredients'
  where id = 'a7200000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.product_truth_snapshots),2,'review changes append a new revision');
-- Exercise the actual existing founder promotion RPC, not just a direct update.
insert into auth.users(id,raw_user_meta_data) values ('a7100000-0000-4000-8000-000000000003','{}');
insert into public.founder_accounts(user_id,role,status) values ('a7100000-0000-4000-8000-000000000003','founder','active');
insert into public.products(id,brand,name,category,is_catalog_standard)
values ('a7400000-0000-4000-8000-000000000001','Synthetic','Truth fixture','cleanser',true);
insert into public.product_variants(id,product_id,variant_name,region_code)
values ('a7500000-0000-4000-8000-000000000001','a7400000-0000-4000-8000-000000000001','Exact','US');
insert into public.product_formula_versions(id,variant_id,ingredients,normalized_ingredient_fingerprint,region_code,
  provenance_type,source_reference,observed_at,verification_status)
values ('a7600000-0000-4000-8000-000000000001','a7500000-0000-4000-8000-000000000001',
  array['Water','Glycerin'],'water|glycerin','US','manufacturer','internal://synthetic-private-proof',now(),'verified');
insert into public.product_resolution_cases(id,user_id,request_id,consumer,resolution_state,next_action,
  requires_founder_review,review_status,evidence_snapshot)
values ('a7200000-0000-4000-8000-000000000002','a7100000-0000-4000-8000-000000000001',
  'a7300000-0000-4000-8000-000000000002','shelf','insufficient_evidence','manual_review',true,'pending',
  '{"conflicts":["ingredient_mismatch"]}');
select lives_ok($$select public.founder_resolve_product_identity('a7100000-0000-4000-8000-000000000003',
  'a7200000-0000-4000-8000-000000000002','verified_product_formula','a7400000-0000-4000-8000-000000000001',
  'a7500000-0000-4000-8000-000000000001','a7600000-0000-4000-8000-000000000001',
  'a7300000-0000-4000-8000-000000000003')$$,'founder promotion seals both original and reviewed truth');
select is((select count(*)::int from public.product_truth_snapshots where case_id='a7200000-0000-4000-8000-000000000002'),2,'two immutable promotion revisions');
select is((select snapshot->>'state' from public.product_truth_snapshots where case_id='a7200000-0000-4000-8000-000000000002' and case_revision=1),
  'insufficient_evidence','original unresolved truth retained');
select is((select snapshot->'formula'->'ingredients' from public.product_truth_snapshots where case_id='a7200000-0000-4000-8000-000000000002' and case_revision=2),
  '["Water","Glycerin"]'::jsonb,'ordered authoritative ingredients preserved');
select is((select snapshot->'conflicts'->0->>'status' from public.product_truth_snapshots where case_id='a7200000-0000-4000-8000-000000000002' and case_revision=2),
  'reviewed','review disposition distinct from customer confirmation');
select ok((select snapshot::text not like '%synthetic-private-proof%' and snapshot->'formula'->'publicSourceUrl'='null'::jsonb
  from public.product_truth_snapshots where case_id='a7200000-0000-4000-8000-000000000002' and case_revision=2),'private source excluded and unknown public URL explicit');
select lives_ok($$select public.founder_resolve_product_identity('a7100000-0000-4000-8000-000000000003',
  'a7200000-0000-4000-8000-000000000002','verified_product_formula','a7400000-0000-4000-8000-000000000001',
  'a7500000-0000-4000-8000-000000000001','a7600000-0000-4000-8000-000000000001',
  'a7300000-0000-4000-8000-000000000003')$$,'promotion retry reuses review');
select is((select count(*)::int from public.product_truth_snapshots where case_id='a7200000-0000-4000-8000-000000000002'),2,'review retry creates no extra snapshot');
delete from auth.users where id = 'a7100000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.product_truth_snapshots),0,'account deletion cascades snapshots');
select * from finish();
rollback;
