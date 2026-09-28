begin;
select plan(20);

select has_table('public', 'product_measurement_events', 'first-party event ledger exists');
select has_column('public', 'product_measurement_events', 'user_id', 'ledger stores server-derived owner');
select has_column('public', 'product_measurement_events', 'received_at', 'ledger stores server receipt time');
select ok(not has_table_privilege('authenticated', 'public.product_measurement_events', 'select')
  and not has_table_privilege('authenticated', 'public.product_measurement_events', 'insert'),
  'clients cannot read or write the private ledger');
select ok(has_function_privilege('service_role', 'public.record_product_measurement(uuid,text,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.record_product_measurement(uuid,text,jsonb)', 'execute'),
  'only trusted server code may call the write RPC');
select is((select count(*)::int from pg_policies where schemaname = 'public'
  and tablename = 'product_measurement_events'), 0, 'RLS exposes no customer policy');

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('e4000000-0000-4000-8000-000000000001', null, true, '{}'::jsonb),
  ('e4000000-0000-4000-8000-000000000002', null, true, '{}'::jsonb);

select lives_ok($$select public.record_product_measurement(
  'e4000000-0000-4000-8000-000000000001', 'check_completed',
  '{"inputMethod":"barcode","outcome":"useful","personalized":false}'::jsonb)$$,
  'allowlisted Check result is accepted');
select is((select count(*)::int from public.product_measurement_events), 1, 'one event is stored');
select ok((select received_at between clock_timestamp() - interval '1 minute' and clock_timestamp()
  from public.product_measurement_events limit 1), 'receipt time comes from the server');
select throws_ok($$select public.record_product_measurement(
  'e4000000-0000-4000-8000-000000000001', 'check_started',
  '{"inputMethod":"photo","productName":"Private cream"}'::jsonb)$$,
  '23514', null, 'a product name cannot be stored');
select throws_ok($$select public.record_product_measurement(
  'e4000000-0000-4000-8000-000000000001', 'app_opened',
  '{"platform":"ios","email":"private@example.com"}'::jsonb)$$,
  '23514', null, 'an identifying field cannot be stored');
select throws_ok($$select public.record_product_measurement(
  'e4000000-0000-4000-8000-000000000001', 'app_opened',
  '{"platform":"arbitrary text"}'::jsonb)$$,
  '23514', null, 'free-text dimension cannot be stored');
select throws_ok($$select public.record_product_measurement(
  'e4000000-0000-4000-8000-000000000001', 'check_completed',
  '{"inputMethod":"barcode","outcome":"failed","personalized":true}'::jsonb)$$,
  '23514', null, 'failed Check cannot claim personalization');

set local role authenticated;
set local request.jwt.claim.sub = 'e4000000-0000-4000-8000-000000000001';
select throws_ok($$select count(*) from public.product_measurement_events$$,
  '42501', null, 'customer cannot query event history');
select throws_ok($$select public.record_product_measurement(
  'e4000000-0000-4000-8000-000000000001', 'app_opened',
  '{"platform":"ios"}'::jsonb)$$,
  '42501', null, 'customer cannot call write RPC');
set local role postgres;

insert into public.product_measurement_events (user_id, event_name, properties)
  select 'e4000000-0000-4000-8000-000000000001', 'app_opened', '{"platform":"ios"}'::jsonb
  from generate_series(1, 59);
select throws_ok($$select public.record_product_measurement(
  'e4000000-0000-4000-8000-000000000001', 'app_opened',
  '{"platform":"ios"}'::jsonb)$$,
  'P0001', 'PRODUCT_MEASUREMENT_RATE_LIMIT', 'per-owner minute rate cap is atomic');
select is((select count(*)::int from public.product_measurement_events), 60,
  'rate rejection does not create another event');

select is(public.begin_customer_account_deletion('e4000000-0000-4000-8000-000000000001'), true,
  'account deletion fence starts');
select throws_ok($$select public.record_product_measurement(
  'e4000000-0000-4000-8000-000000000001', 'app_opened',
  '{"platform":"ios"}'::jsonb)$$,
  'P0001', 'PRODUCT_MEASUREMENT_OWNER_UNAVAILABLE', 'fenced account cannot create events');
delete from auth.users where id = 'e4000000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.product_measurement_events), 0,
  'Auth deletion cascades all first-party events');

select * from finish();
rollback;
