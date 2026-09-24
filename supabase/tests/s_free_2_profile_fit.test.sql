begin;
select plan(13);

select ok(to_regclass('public.free_skin_profiles') is not null, 'free profile table exists separately from managed intake');
select ok(not has_table_privilege('anon', 'public.free_skin_profiles', 'select')
  and not has_table_privilege('authenticated', 'public.free_skin_profiles', 'select')
  and not has_table_privilege('authenticated', 'public.free_skin_profiles', 'insert'),
  'raw free context is not exposed through the Data API');
select ok((select relrowsecurity from pg_class where oid = 'public.free_skin_profiles'::regclass), 'RLS is enabled');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'free_skin_profiles'), 3,
  'owner-only select, insert, and update policies are present');

insert into auth.users (id, is_anonymous, raw_user_meta_data) values
  ('f2100000-0000-4000-8000-000000000001', true, '{}'::jsonb),
  ('f2100000-0000-4000-8000-000000000002', true, '{}'::jsonb);
insert into public.free_skin_profiles (
  user_id, goals, skin_behavior, reactivity, pregnancy_status,
  sensitivities_status, known_sensitivities, treatment_status, current_treatments
) values (
  'f2100000-0000-4000-8000-000000000001', array['dryness'], 'dry_tight', 'unsure',
  'prefer_not_to_say', 'unanswered', '{}', 'unanswered', '{}'
);
select is((select pregnancy_status from public.free_skin_profiles where user_id = 'f2100000-0000-4000-8000-000000000001'),
  'prefer_not_to_say', 'withheld pregnancy context is not collapsed into no');
select is((select count(*)::integer from public.skin_profiles where user_id = 'f2100000-0000-4000-8000-000000000001'),
  0, 'free context does not fabricate a managed skin profile');
select is((select count(*)::integer from public.memberships where user_id = 'f2100000-0000-4000-8000-000000000001'),
  0, 'free context does not fabricate a membership');
select throws_ok($$insert into public.free_skin_profiles (user_id, goals) values
  ('f2100000-0000-4000-8000-000000000002', array['unknown_goal'])$$,
  '23514', null, 'database rejects unapproved goals');
select throws_ok($$insert into public.free_skin_profiles (user_id, sensitivities_status) values
  ('f2100000-0000-4000-8000-000000000002', 'reported')$$,
  '23514', null, 'reported sensitivity status requires actual reported detail');

-- Temporarily grant for policy proof; transaction rollback preserves Edge-only
-- production grants. API callers never receive these table privileges.
grant select, insert, update on public.free_skin_profiles to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'f2100000-0000-4000-8000-000000000001';
select results_eq($$select user_id::text from public.free_skin_profiles$$,
  array['f2100000-0000-4000-8000-000000000001'::text], 'guest sees only its own context under RLS');
select throws_ok($$insert into public.free_skin_profiles (user_id) values
  ('f2100000-0000-4000-8000-000000000002')$$,
  '42501', null, 'guest cannot insert another owner context');
set local request.jwt.claim.sub = 'f2100000-0000-4000-8000-000000000002';
select is((select count(*)::integer from public.free_skin_profiles), 0, 'other guest sees no first-guest context');
select is((select count(*)::integer from public.free_skin_profiles where user_id = 'f2100000-0000-4000-8000-000000000001'),
  0, 'owner filter does not bypass RLS');

select * from finish();
rollback;
