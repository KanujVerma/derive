begin;
select plan(18);

select ok(
  not has_function_privilege('anon', 'public.join_managed_waitlist(text, integer, text)', 'execute')
  and not has_function_privilege('anon', 'public.read_managed_waitlist()', 'execute')
  and not has_function_privilege('anon', 'public.withdraw_managed_waitlist()', 'execute'),
  'anonymous API role cannot call the waitlist'
);
select ok(
  not has_table_privilege('authenticated', 'public.managed_waitlist', 'insert')
  and not has_table_privilege('authenticated', 'public.managed_waitlist', 'update')
  and not has_table_privilege('authenticated', 'public.managed_waitlist', 'delete'),
  'customers cannot write the waitlist table directly'
);
select ok(
  (select pronargs = 3 from pg_proc where oid = 'public.join_managed_waitlist(text, integer, text)'::regprocedure)
  and not exists (
    select 1 from information_schema.parameters
    where specific_schema = 'public' and specific_name like 'join_managed_waitlist%'
      and parameter_name ilike '%user%'
  ),
  'join derives the owner and accepts no user id'
);
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'managed_waitlist' and column_name = 'email'
  ),
  'waitlist stores no email'
);

insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values
  ('aa110000-0000-4000-8000-000000000001', null, true, '{}'::jsonb),
  ('aa110000-0000-4000-8000-000000000002', null, true, '{}'::jsonb);

set local role authenticated;
set local request.jwt.claim.sub = 'aa110000-0000-4000-8000-000000000001';

select throws_ok(
  $$insert into public.managed_waitlist (user_id, status, joined_at, offer_version, price_cents, entry_surface)
    values ('aa110000-0000-4000-8000-000000000002', 'joined', now(), 'managed_waitlist_v1', 2500, 'plan')$$,
  '42501', null, 'a guest cannot insert another owner'
);
select is(
  (select public.join_managed_waitlist('managed_waitlist_v1', 2500, 'plan') ->> 'status'),
  'joined',
  'anonymous owner can join'
);
select is(
  (select public.join_managed_waitlist('managed_waitlist_v1', 2500, 'plan') ->> 'joinedAt'),
  (select public.read_managed_waitlist() ->> 'joinedAt'),
  'a repeated join keeps the original receipt time'
);
select is(
  (select count(*)::integer from public.managed_waitlist where user_id = 'aa110000-0000-4000-8000-000000000001'),
  1,
  'repeated join stays one row'
);
select is(
  (select price_cents from public.managed_waitlist where user_id = 'aa110000-0000-4000-8000-000000000001'),
  2500,
  'the shown price is stored in cents'
);
select throws_ok(
  $$select public.join_managed_waitlist('managed_waitlist_v2', 2500, 'plan')$$,
  '22023', null, 'an unknown offer version is rejected'
);
select throws_ok(
  $$select public.join_managed_waitlist('managed_waitlist_v1', 100, 'plan')$$,
  '22023', null, 'a mismatched price is rejected'
);

set local request.jwt.claim.sub = 'aa110000-0000-4000-8000-000000000002';
select is(
  (select public.read_managed_waitlist() ->> 'status'),
  'none',
  'another owner cannot read the joined row'
);
select is(
  (select count(*)::integer from public.managed_waitlist),
  0,
  'row security hides the other owner'
);

set local request.jwt.claim.sub = 'aa110000-0000-4000-8000-000000000001';
select is(
  (select public.withdraw_managed_waitlist() ->> 'status'),
  'withdrawn',
  'the owner can leave'
);
select is(
  (select public.withdraw_managed_waitlist() ->> 'status'),
  'withdrawn',
  'leaving again stays withdrawn'
);
select is(
  (select public.join_managed_waitlist('managed_waitlist_v1', 2500, 'plan') ->> 'status'),
  'joined',
  'leaving can be reversed by joining again'
);
select ok(
  (select joined_at >= withdrawn_at and status = 'joined' from public.managed_waitlist
    where user_id = 'aa110000-0000-4000-8000-000000000001'),
  'a renewed join stays joined and keeps the earlier withdrawal time'
);

reset role;
delete from auth.users where id = 'aa110000-0000-4000-8000-000000000001';
select is(
  (select count(*)::integer from public.managed_waitlist where user_id = 'aa110000-0000-4000-8000-000000000001'),
  0,
  'account deletion removes the waitlist row'
);

select * from finish();
rollback;
