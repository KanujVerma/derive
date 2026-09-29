begin;
select plan(18);

select has_table('private', 'external_candidate_lookup_reservations', 'lookup budget has a private ledger');
select ok(not has_table_privilege('authenticated', 'private.external_candidate_lookup_reservations', 'select')
  and not has_table_privilege('authenticated', 'private.external_candidate_lookup_reservations', 'insert'),
  'customers cannot query or insert budget rows');
select ok(has_function_privilege('service_role', 'public.reserve_external_candidate_lookup(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.reserve_external_candidate_lookup(uuid)', 'execute'),
  'only trusted server code may reserve OBF lookups');

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('e5000000-0000-4000-8000-000000000001', null, true, '{}'::jsonb),
  ('e5000000-0000-4000-8000-000000000002', null, true, '{}'::jsonb);
select lives_ok($$select public.reserve_external_candidate_lookup('e5000000-0000-4000-8000-000000000001')$$,
  'valid owner can reserve a lookup');
select is((select count(*)::int from private.external_candidate_lookup_reservations), 1,
  'one request reservation is recorded without product data');
select ok((select count(*) = 0 from information_schema.columns
  where table_schema = 'private' and table_name = 'external_candidate_lookup_reservations'
    and column_name in ('barcode','product_name','source_payload')),
  'ledger has no barcode or product fields');

set local role authenticated;
select throws_ok($$select public.reserve_external_candidate_lookup('e5000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'customer cannot invoke reservation RPC');
set local role postgres;

insert into private.external_candidate_lookup_reservations (user_id)
  select 'e5000000-0000-4000-8000-000000000001' from generate_series(1, 9);
select throws_ok($$select public.reserve_external_candidate_lookup('e5000000-0000-4000-8000-000000000001')$$,
  'P0001', 'EXTERNAL_CANDIDATE_USER_LIMIT', 'per-owner minute cap rejects the eleventh lookup');
select is((select count(*)::int from private.external_candidate_lookup_reservations), 10,
  'rejected lookup does not insert a row');

delete from private.external_candidate_lookup_reservations;
insert into private.external_candidate_lookup_reservations (user_id)
  select 'e5000000-0000-4000-8000-000000000002' from generate_series(1, 11);
select lives_ok($$select public.reserve_external_candidate_lookup('e5000000-0000-4000-8000-000000000001')$$,
  'twelfth global reservation remains available');
select is((select count(*)::int from private.external_candidate_lookup_reservations), 12,
  'twelfth global reservation is recorded');
select throws_ok($$select public.reserve_external_candidate_lookup('e5000000-0000-4000-8000-000000000001')$$,
  'P0001', 'EXTERNAL_CANDIDATE_GLOBAL_LIMIT', 'global cap protects provider from many guest owners');
select is((select count(*)::int from private.external_candidate_lookup_reservations), 12,
  'global rejection does not insert a row');

delete from private.external_candidate_lookup_reservations;
insert into private.external_candidate_lookup_reservations (user_id, reserved_at)
  values ('e5000000-0000-4000-8000-000000000002', clock_timestamp() - interval '2 days');
select lives_ok($$select public.reserve_external_candidate_lookup('e5000000-0000-4000-8000-000000000001')$$,
  'expired reservations are pruned and do not consume budget');
select is((select count(*)::int from private.external_candidate_lookup_reservations), 1,
  'old reservation was pruned');

select is(public.begin_customer_account_deletion('e5000000-0000-4000-8000-000000000001'), true,
  'account deletion fence starts');
select throws_ok($$select public.reserve_external_candidate_lookup('e5000000-0000-4000-8000-000000000001')$$,
  'P0001', 'EXTERNAL_CANDIDATE_OWNER_UNAVAILABLE', 'fenced account cannot reserve another lookup');
delete from auth.users where id = 'e5000000-0000-4000-8000-000000000001';
select is((select count(*)::int from private.external_candidate_lookup_reservations), 0,
  'Auth deletion cascades lookup reservations');

select * from finish();
rollback;
