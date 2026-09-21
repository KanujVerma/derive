begin;

select plan(38);

select has_table('public', 'product_variants', 'product variants retain packaging and region identity');
select has_table('public', 'product_formula_versions', 'formula versions retain reformulation provenance');
select has_table('public', 'product_identifiers', 'authoritative product identifiers exist');
select has_table('public', 'product_resolution_cases', 'member resolution cases exist');
select has_table('public', 'product_resolution_evidence', 'resolution evidence is preserved');
select has_table('public', 'product_resolution_candidates', 'candidate evidence is preserved');

select results_eq(
  $$
    select relname::text collate "default"
    from pg_class
    where oid in (
      'public.product_variants'::regclass,
      'public.product_formula_versions'::regclass,
      'public.product_identifiers'::regclass,
      'public.product_resolution_cases'::regclass,
      'public.product_resolution_evidence'::regclass,
      'public.product_resolution_candidates'::regclass
    ) and relrowsecurity
    order by relname
  $$,
  array[
    'product_formula_versions', 'product_identifiers', 'product_resolution_candidates',
    'product_resolution_cases', 'product_resolution_evidence', 'product_variants'
  ],
  'every S6 table enforces RLS'
);

select ok(
  not has_table_privilege('authenticated', 'public.product_variants', 'select')
    and not has_table_privilege('authenticated', 'public.product_formula_versions', 'select')
    and not has_table_privilege('authenticated', 'public.product_identifiers', 'select'),
  'members cannot directly enumerate the global identity catalog'
);

select ok(
  has_table_privilege('authenticated', 'public.product_resolution_cases', 'select')
    and has_table_privilege('authenticated', 'public.product_resolution_evidence', 'select')
    and has_table_privilege('authenticated', 'public.product_resolution_candidates', 'select')
    and not has_table_privilege('authenticated', 'public.product_resolution_cases', 'insert'),
  'members may read only policy-filtered results and cannot manufacture them'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.record_product_resolution(uuid,uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb,jsonb)',
    'execute'
  ) and not has_function_privilege(
    'authenticated',
    'public.record_product_resolution(uuid,uuid,text,text,text,boolean,uuid,uuid,uuid,jsonb,jsonb,jsonb)',
    'execute'
  ),
  'atomic resolver persistence is service-only'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.founder_resolve_product_identity(uuid,uuid,text,uuid,uuid,uuid,uuid)',
    'execute'
  ) and not has_function_privilege(
    'authenticated',
    'public.founder_resolve_product_identity(uuid,uuid,text,uuid,uuid,uuid,uuid)',
    'execute'
  ),
  'founder resolution is service-only'
);

select ok(
  exists (
    select 1 from storage.buckets
    where id = 'customer-product-evidence'
      and public = false
      and file_size_limit = 10485760
  ),
  'product evidence bucket is private and size-bounded'
);

select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'customer_product_evidence_insert_own'),
  1,
  'product evidence has one explicit owner-bound insert policy'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('61000000-0000-4000-8000-000000000001', 's6-founder@example.test', '{"full_name":"S6 Founder"}'::jsonb),
  ('61000000-0000-4000-8000-000000000002', 's6-member@example.test', '{"full_name":"S6 Member"}'::jsonb),
  ('61000000-0000-4000-8000-000000000003', 's6-other@example.test', '{"full_name":"S6 Other"}'::jsonb);

insert into public.founder_accounts (user_id, role, status)
values ('61000000-0000-4000-8000-000000000001', 'founder', 'active');

insert into public.memberships (user_id, tier, status)
values
  ('61000000-0000-4000-8000-000000000002', 'founding_beta', 'active'),
  ('61000000-0000-4000-8000-000000000003', 'founding_beta', 'active');

insert into public.products (id, brand, name, category, is_catalog_standard)
values ('61100000-0000-4000-8000-000000000001', 'Evidence Lab', 'Barrier Wash', 'cleanser', true);

insert into public.product_variants (
  id, product_id, variant_name, region_code, package_size, packaging_markers
) values (
  '61200000-0000-4000-8000-000000000001',
  '61100000-0000-4000-8000-000000000001',
  'Fragrance Free', 'US', '200 mL', array['white pump', 'blue label']
);

insert into public.product_formula_versions (
  id, variant_id, ingredients, normalized_ingredient_fingerprint,
  provenance_type, source_reference, observed_at, verification_status
) values (
  '61300000-0000-4000-8000-000000000001',
  '61200000-0000-4000-8000-000000000001',
  array['Water', 'Glycerin', 'Ceramide NP'],
  'water|glycerin|ceramide np',
  'manufacturer', 'https://manufacturer.example/barrier-wash', now(), 'verified'
);

select lives_ok(
  $$
    insert into public.founder_review_tasks (
      user_id, task_type, status, priority, notes
    ) values (
      '61000000-0000-4000-8000-000000000002', 'product_identity',
      'completed', 'normal', 'Constraint acceptance check.'
    )
  $$,
  'founder queue accepts the S6 product_identity task type'
);

select throws_ok(
  $$
    insert into public.product_identifiers (
      variant_id, formula_version_id, identifier_type, identifier_value,
      source_authority, source_reference, verified_at
    ) values (
      '61200000-0000-4000-8000-000000000001',
      null, 'gtin_12', '036000291452', 'gs1', 'https://gs1.example/036000291452', now()
    );
    update public.product_identifiers
    set formula_version_id = '61300000-0000-4000-8000-000000000001'
    where identifier_value = '036000291452';
  $$,
  'P0001',
  'product_identifiers rows are immutable; append a new version instead',
  'identifier records cannot be rewritten after capture'
);

delete from public.product_identifiers where identifier_value = '036000291452';
insert into public.product_identifiers (
  id, variant_id, formula_version_id, identifier_type, identifier_value,
  source_authority, source_reference, verified_at
) values (
  '61400000-0000-4000-8000-000000000001',
  '61200000-0000-4000-8000-000000000001',
  '61300000-0000-4000-8000-000000000001',
  'gtin_12', '036000291452', 'gs1', 'https://gs1.example/036000291452', now()
);

select lives_ok(
  $$
    with new_formula as (
      insert into public.product_formula_versions (
        id, variant_id, ingredients, normalized_ingredient_fingerprint,
        provenance_type, source_reference, observed_at, verification_status,
        supersedes_id
      ) values (
        '61300000-0000-4000-8000-000000000002',
        '61200000-0000-4000-8000-000000000001',
        array['Water', 'Glycerin', 'Ceramide AP'],
        'water|glycerin|ceramide ap',
        'manufacturer', 'https://manufacturer.example/barrier-wash-v2',
        now(), 'verified', '61300000-0000-4000-8000-000000000001'
      ) returning id
    )
    insert into public.product_identifiers (
      variant_id, formula_version_id, identifier_type, identifier_value,
      source_authority, source_reference, verified_at
    ) select
      '61200000-0000-4000-8000-000000000001', id,
      'gtin_12', '036000291452', 'manufacturer',
      'https://manufacturer.example/barrier-wash-v2', now()
    from new_formula
  $$,
  'one barcode can retain multiple reformulation observations without overwrite'
);

select throws_ok(
  $$ update public.product_formula_versions set ingredients = array['Changed'] where id = '61300000-0000-4000-8000-000000000001' $$,
  'P0001',
  'product_formula_versions rows are immutable; append a new version instead',
  'formula history is append-only'
);

set local role service_role;

select lives_ok(
  $$
    select public.record_product_resolution(
      '61000000-0000-4000-8000-000000000002',
      '61500000-0000-4000-8000-000000000001',
      'scan', 'verified_product_formula', 'evaluate_product_fit', false,
      '61100000-0000-4000-8000-000000000001',
      '61200000-0000-4000-8000-000000000001',
      '61300000-0000-4000-8000-000000000001',
      '{"hasBarcode":true}'::jsonb,
      '[{"evidence_type":"barcode","source_type":"device_barcode","extracted_text":"036000291452"}]'::jsonb,
      '[{"product_id":"61100000-0000-4000-8000-000000000001","variant_id":"61200000-0000-4000-8000-000000000001","formula_version_id":"61300000-0000-4000-8000-000000000001","candidate_basis":"authoritative_identifier","match_reasons":["exact authoritative identifier"]}]'::jsonb
    )
  $$,
  'trusted resolver result persists atomically'
);

select is(
  (select resolution_state from public.product_resolution_cases
   where request_id = '61500000-0000-4000-8000-000000000001'),
  'verified_product_formula',
  'verified state retains distinct product and formula identity'
);

select is(
  (select count(*)::integer from public.product_resolution_evidence
   where user_id = '61000000-0000-4000-8000-000000000002'),
  1,
  'resolution evidence is retained'
);

select is(
  (select count(*)::integer from public.product_resolution_candidates
   where user_id = '61000000-0000-4000-8000-000000000002'),
  1,
  'candidate basis is retained'
);

select is(
  (select count(*)::integer from public.founder_review_tasks
   where task_type = 'product_identity' and status = 'pending'),
  0,
  'verified evidence does not create unnecessary founder work'
);

select lives_ok(
  $$
    select public.record_product_resolution(
      '61000000-0000-4000-8000-000000000002',
      '61500000-0000-4000-8000-000000000001',
      'scan', 'insufficient_evidence', 'manual_review', true,
      null, null, null, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb
    )
  $$,
  'request retry safely replays the original case'
);

select is(
  (select count(*)::integer from public.product_resolution_cases
   where user_id = '61000000-0000-4000-8000-000000000002'
     and request_id = '61500000-0000-4000-8000-000000000001'),
  1,
  'request retry creates no duplicate case'
);

select lives_ok(
  $$
    select public.record_product_resolution(
      '61000000-0000-4000-8000-000000000002',
      '61500000-0000-4000-8000-000000000002',
      'shelf', 'insufficient_evidence', 'manual_review', true,
      null, null, null,
      '{"photoRoles":["front_label"]}'::jsonb,
      '[{"evidence_type":"front_label","source_type":"member_input","storage_path":"61000000-0000-4000-8000-000000000002/front_label/opaque.jpg"}]'::jsonb,
      '[]'::jsonb
    )
  $$,
  'insufficient evidence persists without inventing identity'
);

select is(
  (select count(*)::integer from public.founder_review_tasks
   where task_type = 'product_identity' and status = 'pending'),
  1,
  'unresolved evidence creates exactly one founder review task'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '61000000-0000-4000-8000-000000000002';

select is(
  (select count(*)::integer from public.product_resolution_cases),
  2,
  'member can read their own resolution history'
);

set local request.jwt.claim.sub = '61000000-0000-4000-8000-000000000003';

select is(
  (select count(*)::integer from public.product_resolution_cases),
  0,
  'another member cannot read resolution history'
);

reset role;
set local role service_role;

select throws_ok(
  $$ update public.product_resolution_evidence set extracted_text = 'rewritten' where user_id = '61000000-0000-4000-8000-000000000002' $$,
  'P0001',
  'product_resolution_evidence rows are immutable; append a new version instead',
  'captured evidence cannot be silently rewritten'
);

select throws_ok(
  $$
    insert into public.product_resolution_evidence (
      case_id, user_id, evidence_type, source_type, extracted_text
    ) values (
      (select id from public.product_resolution_cases where request_id = '61500000-0000-4000-8000-000000000002'),
      '61000000-0000-4000-8000-000000000003',
      'typed_identity', 'member_input', 'cross owner'
    )
  $$,
  'P0001',
  'RESOLUTION_EVIDENCE_OWNER_MISMATCH',
  'case evidence cannot cross member ownership boundaries'
);

select lives_ok(
  $$
    select public.founder_resolve_product_identity(
      '61000000-0000-4000-8000-000000000001',
      (select id from public.product_resolution_cases where request_id = '61500000-0000-4000-8000-000000000002'),
      'verified_product_formula',
      '61100000-0000-4000-8000-000000000001',
      '61200000-0000-4000-8000-000000000001',
      '61300000-0000-4000-8000-000000000001',
      '61600000-0000-4000-8000-000000000001'
    )
  $$,
  'founder can resolve ambiguous evidence against verified provenance'
);

select is(
  (select resolution_state || ':' || review_status from public.product_resolution_cases
   where request_id = '61500000-0000-4000-8000-000000000002'),
  'verified_product_formula:resolved',
  'founder resolution persists the reviewed trust state'
);

select is(
  (select status from public.founder_review_tasks
   where product_resolution_case_id = (
     select id from public.product_resolution_cases where request_id = '61500000-0000-4000-8000-000000000002'
   )),
  'completed',
  'founder resolution completes its review task'
);

select is(
  (select count(*)::integer from public.founder_operation_log
   where operation = 'product_identity_resolved'),
  1,
  'founder resolution creates an audit record'
);

select lives_ok(
  $$
    select public.founder_resolve_product_identity(
      '61000000-0000-4000-8000-000000000001',
      (select id from public.product_resolution_cases where request_id = '61500000-0000-4000-8000-000000000002'),
      'verified_product_formula',
      '61100000-0000-4000-8000-000000000001',
      '61200000-0000-4000-8000-000000000001',
      '61300000-0000-4000-8000-000000000001',
      '61600000-0000-4000-8000-000000000001'
    )
  $$,
  'founder resolution retry is idempotent'
);

select is(
  (select count(*)::integer from public.founder_operation_log
   where operation = 'product_identity_resolved'),
  1,
  'founder retry creates no duplicate audit record'
);

reset role;

select lives_ok(
  $$ delete from auth.users where id = '61000000-0000-4000-8000-000000000002' $$,
  'member relational identity can still be deleted after S6 evidence exists'
);

select is(
  (select count(*)::integer from public.product_resolution_cases
   where user_id = '61000000-0000-4000-8000-000000000002'),
  0,
  'account deletion cascades S6 relational evidence'
);

select * from finish();
rollback;
