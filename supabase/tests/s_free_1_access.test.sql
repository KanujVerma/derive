begin;
select plan(22);

select ok(
  not has_function_privilege('anon', 'private.current_auth_identity_is_permanent()', 'execute')
  and not has_function_privilege('authenticated', 'private.current_auth_identity_is_permanent()', 'execute'),
  'private identity helper is not callable through the Data API'
);
select ok(
  not has_column_privilege('authenticated', 'public.products', 'catalog_source_reference', 'select'),
  'operator catalog provenance stays private'
);
select ok(
  not has_table_privilege('authenticated', 'public.product_identifiers', 'select'),
  'verified identifier records remain server-only'
);
select ok(
  (select count(*) = 1 from pg_policies
   where schemaname = 'public' and tablename = 'products'
     and policyname = 'products_select_authenticated'
     and qual not like '%catalog_verified_at%'
     and qual like '%current_member_is_active%'),
  'one product read policy reserves raw product fields for managed access'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.current_member_is_active()'::regprocedure)
  and not has_function_privilege('anon', 'public.current_member_is_active()', 'execute'),
  'managed predicate uses a pinned trusted identity read and denies public anon role'
);
select ok(
  (select is_nullable = 'YES' from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'),
  'profiles can truthfully represent a guest without email'
);

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('f1100000-0000-4000-8000-000000000001', null, true, '{}'::jsonb),
  ('f1100000-0000-4000-8000-000000000002', null, true, '{}'::jsonb),
  ('f1100000-0000-4000-8000-000000000003', 'member@example.test', false, '{}'::jsonb);

select is((select email from public.profiles where id = 'f1100000-0000-4000-8000-000000000001'), null::text,
  'guest profile is provisioned without a fabricated email');
select is((select count(*)::integer from public.memberships where user_id = 'f1100000-0000-4000-8000-000000000001'), 0,
  'guest profile provisioning creates no membership');
select is((select email from public.profiles where id = 'f1100000-0000-4000-8000-000000000003'), 'member@example.test',
  'permanent profile provisioning is unchanged');

insert into public.memberships (user_id, tier, status) values
  ('f1100000-0000-4000-8000-000000000001', 'founding_beta', 'active'),
  ('f1100000-0000-4000-8000-000000000003', 'founding_beta', 'active');

insert into public.products (
  id, brand, name, category, is_catalog_standard,
  catalog_source_reference, catalog_observed_at, catalog_verified_at
) values
  ('f1200000-0000-4000-8000-000000000001', 'Source', 'Public Wash', 'cleanser', true,
   'private-source', now(), now()),
  ('f1200000-0000-4000-8000-000000000002', 'Private', 'Provisional Wash', 'cleanser', false,
   null, null, null),
  ('f1200000-0000-4000-8000-000000000003', 'Standard', 'Unsourced Wash', 'cleanser', true,
   null, null, null);

set local role authenticated;
set local request.jwt.claim.sub = 'f1100000-0000-4000-8000-000000000001';
select is((select public.current_member_is_active()), false,
  'synthetic active membership cannot turn a guest into a managed member');
select results_eq(
  $$select id::text from public.profiles order by id$$,
  array['f1100000-0000-4000-8000-000000000001'::text],
  'guest can read only its own profile'
);
select is((select count(*)::integer from public.products), 0,
  'guest uses bounded catalog endpoint rather than raw product fields');
select throws_ok(
  $$insert into public.check_ins (user_id, skin_state, irritation) values ('f1100000-0000-4000-8000-000000000001', 'same', 'none')$$,
  '42501', null, 'guest cannot submit managed check-in with a synthetic active membership'
);
select throws_ok(
  $$insert into public.refill_requests (user_id, product_name, brand) values ('f1100000-0000-4000-8000-000000000001', 'Wash', 'Source')$$,
  '42501', null, 'guest cannot request managed refill'
);
select throws_ok(
  $$insert into public.user_photos (user_id, photo_type, storage_path) values ('f1100000-0000-4000-8000-000000000001', 'front', 'f1100000-0000-4000-8000-000000000001/front/photo.jpg')$$,
  '42501', null, 'guest cannot write managed skin-photo metadata'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('customer-product-evidence', 'f1100000-0000-4000-8000-000000000001/front_label/photo.jpg', 'f1100000-0000-4000-8000-000000000001')$$,
  '42501', null, 'guest product-photo upload remains closed in Wave 1'
);

set local role postgres;
update private.release_flags set enabled = true where key = 'open_external_testflight_beta';
set local role authenticated;
select throws_ok($$select public.claim_external_beta_access()$$,
  '42501', 'permanent identity required', 'guest direct RPC claim is rejected even when flag is open');

set local request.jwt.claim.sub = 'f1100000-0000-4000-8000-000000000002';
select is((select public.current_member_is_active()), false,
  'second guest without membership also lacks managed access');
select results_eq($$select id::text from public.profiles order by id$$,
  array['f1100000-0000-4000-8000-000000000002'::text],
  'another guest cannot read the first guest profile');
select results_eq($$select count(*)::integer from public.product_resolution_cases$$,
  array[0], 'guests begin without another owner’s product-resolution cases');

set local request.jwt.claim.sub = 'f1100000-0000-4000-8000-000000000003';
select is((select public.current_member_is_active()), true,
  'permanent active member retains managed access');
select results_eq($$select name from public.products order by name$$,
  array['Provisional Wash'::text, 'Public Wash'::text, 'Unsourced Wash'::text],
  'managed member retains historical product reads');

select * from finish();
rollback;
