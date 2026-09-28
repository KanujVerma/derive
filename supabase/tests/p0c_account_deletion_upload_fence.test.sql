begin;
select plan(12);

select has_column('public', 'profiles', 'deletion_started_at',
  'a durable deletion marker exists');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'deletion_started_at', 'update'),
  'customers cannot clear the deletion marker');
select ok(has_function_privilege('service_role', 'public.begin_customer_account_deletion(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.begin_customer_account_deletion(uuid)', 'execute'),
  'only trusted server code can begin deletion');
select is((select count(*)::int from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'customer_private_upload_deletion_fence'
    and permissive = 'RESTRICTIVE' and cmd = 'INSERT'), 1,
  'one restrictive policy fences both private buckets');

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('f1300000-0000-4000-8000-000000000001', null, true, '{}'::jsonb),
  ('f1300000-0000-4000-8000-000000000002', null, true, '{}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = 'f1300000-0000-4000-8000-000000000001';
select is(public.customer_private_upload_allowed(), true,
  'a live customer can pass the shared upload fence');
select throws_ok(
  $$update public.profiles set deletion_started_at = null where id = 'f1300000-0000-4000-8000-000000000001'$$,
  '42501', null, 'the customer cannot mutate the deletion marker');
select throws_ok(
  $$select public.begin_customer_account_deletion('f1300000-0000-4000-8000-000000000001')$$,
  '42501', null, 'the customer cannot invoke the server-only transition');

set local role postgres;
select is(public.begin_customer_account_deletion('f1300000-0000-4000-8000-000000000001'), true,
  'trusted deletion transition succeeds');
select is(public.begin_customer_account_deletion('f1300000-0000-4000-8000-000000000001'), true,
  'trusted deletion transition is retryable');

set local role authenticated;
select is(public.customer_private_upload_allowed(), false,
  'new private uploads are rejected after deletion begins');
set local request.jwt.claim.sub = 'f1300000-0000-4000-8000-000000000002';
select is(public.customer_private_upload_allowed(), true,
  'another customer remains writable');
set local request.jwt.claim.sub = 'f1300000-0000-4000-8000-000000000001';
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
      values ('customer-product-evidence', 'f1300000-0000-4000-8000-000000000001/free_scan/front_label/a.png', 'f1300000-0000-4000-8000-000000000001')$$,
  '42501', null, 'a fenced account cannot insert into private product Storage');

select * from finish();
rollback;
