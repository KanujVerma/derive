begin;

select plan(22);

-- I1-B4B check-in context columns, constraints, grants, and owner-scoped RLS.

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'check_ins'
      and column_name = 'context_tags'
      and is_nullable = 'NO'
      and udt_name = '_text'
  ),
  'context_tags exists as a non-null text array'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'check_ins'
      and column_name = 'context_note'
      and is_nullable = 'YES'
  ),
  'context_note exists and is nullable'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'check_ins'
      and column_name = 'adherence'
      and is_nullable = 'YES'
  ),
  'adherence exists and is nullable'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'check_ins'
      and column_name = 'primary_goal'
      and is_nullable = 'YES'
  ),
  'primary_goal exists and is nullable'
);

select results_eq(
  $$
    select (tablename || '.' || policyname || ':' || cmd || ':' || array_to_string(roles, ',')) collate "default"
    from pg_policies
    where schemaname = 'public'
      and tablename = 'check_ins'
    order by policyname
  $$,
  array[
    'check_ins.check_ins_insert_own:INSERT:authenticated',
    'check_ins.check_ins_select_own:SELECT:authenticated'
  ],
  'check_ins RLS policy set remains owner select/insert only'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'b4b11111-1111-1111-1111-111111111111',
    'member_b4b_owner@example.test',
    '{"full_name":"Member B4B Owner"}'::jsonb
  ),
  (
    'b4b22222-2222-2222-2222-222222222222',
    'member_b4b_other@example.test',
    '{"full_name":"Member B4B Other"}'::jsonb
  );

-- The owner exercises paid check-in writes under E1; the other user stays inactive.
insert into public.memberships (user_id, tier, status)
values ('b4b11111-1111-1111-1111-111111111111', 'founding_beta', 'active');

select results_eq(
  $$
    insert into public.check_ins (user_id, skin_state, irritation)
    values (
      'b4b11111-1111-1111-1111-111111111111',
      'same',
      'none'
    )
    returning cardinality(context_tags)
  $$,
  array[0],
  'legacy-style insert without tags defaults context_tags to empty array'
);

select lives_ok(
  $$
    insert into public.check_ins (
      user_id, skin_state, irritation, context_tags, context_note, adherence, primary_goal
    )
    values (
      'b4b11111-1111-1111-1111-111111111111',
      'better',
      'none',
      array['sleep']::text[],
      'Slept poorly after travel.',
      'yes',
      'breakouts'
    )
  $$,
  'valid canonical context tag, note, adherence, and primary_goal are accepted'
);

select lives_ok(
  $$
    insert into public.check_ins (
      user_id, skin_state, irritation, context_tags
    )
    values (
      'b4b11111-1111-1111-1111-111111111111',
      'same',
      'little',
      array['sleep', 'stress', 'travel_weather']::text[]
    )
  $$,
  'multiple valid canonical context tags are accepted'
);

select throws_ok(
  $$
    insert into public.check_ins (
      user_id, skin_state, irritation, context_tags
    )
    values (
      'b4b11111-1111-1111-1111-111111111111',
      'same',
      'none',
      array['sleep', 'hormonal_imbalance']::text[]
    )
  $$,
  '23514',
  null,
  'unknown context tags are rejected'
);

select throws_ok(
  $$
    insert into public.check_ins (
      user_id, skin_state, irritation, context_tags
    )
    values (
      'b4b11111-1111-1111-1111-111111111111',
      'same',
      'none',
      array['sleep', null]::text[]
    )
  $$,
  '23514',
  null,
  'null entries inside context_tags are rejected'
);

select throws_ok(
  $$
    insert into public.check_ins (
      user_id, skin_state, irritation, adherence
    )
    values (
      'b4b11111-1111-1111-1111-111111111111',
      'same',
      'none',
      'sometimes'
    )
  $$,
  '23514',
  null,
  'invalid adherence values are rejected'
);

select throws_ok(
  $$
    insert into public.check_ins (
      user_id, skin_state, irritation, primary_goal
    )
    values (
      'b4b11111-1111-1111-1111-111111111111',
      'same',
      'none',
      'glow'
    )
  $$,
  '23514',
  null,
  'invalid primary_goal values are rejected'
);

select lives_ok(
  $$
    insert into public.check_ins (
      user_id, skin_state, irritation, adherence
    )
    values (
      'b4b11111-1111-1111-1111-111111111111',
      'same',
      'none',
      'mostly'
    )
  $$,
  'canonical adherence values are accepted'
);

set local role anon;

select throws_ok(
  $$select * from public.check_ins$$,
  '42501',
  null,
  'anon cannot read check-ins'
);

select throws_ok(
  $$
    insert into public.check_ins (user_id, skin_state, irritation)
    values (
      'b4b11111-1111-1111-1111-111111111111',
      'same',
      'none'
    )
  $$,
  '42501',
  null,
  'anon cannot write check-ins'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = 'b4b11111-1111-1111-1111-111111111111';

select results_eq(
  $$
    insert into public.check_ins (
      user_id, skin_state, irritation, context_tags, context_note, adherence, primary_goal
    )
    values (
      'b4b11111-1111-1111-1111-111111111111',
      'better',
      'none',
      array['diet', 'other']::text[],
      'Skipped dessert and noted travel.',
      'not_really',
      'texture'
    )
    returning array_to_string(context_tags, ',')
  $$,
  array['diet,other'],
  'owner can insert own context tags and note'
);

select throws_ok(
  $$
    insert into public.check_ins (
      user_id, skin_state, irritation, context_tags
    )
    values (
      'b4b22222-2222-2222-2222-222222222222',
      'same',
      'none',
      array['sleep']::text[]
    )
  $$,
  '42501',
  null,
  'member cannot insert another user check-in'
);

select throws_ok(
  $$update public.check_ins set ai_analysis_sentence = 'forged analysis'$$,
  '42501',
  null,
  'member cannot write ai_analysis_sentence'
);

select throws_ok(
  $$
    insert into public.check_ins (
      user_id, skin_state, irritation, ai_analysis_sentence
    )
    values (
      'b4b11111-1111-1111-1111-111111111111',
      'same',
      'none',
      'forged on insert'
    )
  $$,
  '42501',
  null,
  'member cannot insert server-owned ai_analysis_sentence'
);

select isnt_empty(
  $$
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'check_ins'
      and grantee = 'authenticated'
      and privilege_type = 'INSERT'
      and column_name in ('context_tags', 'context_note', 'adherence', 'primary_goal')
    group by table_name
    having count(distinct column_name) = 4
  $$,
  'authenticated insert grants include new user-reported check-in columns'
);

reset role;

select throws_ok(
  $$
    insert into public.check_ins (
      user_id, skin_state, irritation, context_note
    )
    values (
      'b4b11111-1111-1111-1111-111111111111',
      'same',
      'none',
      repeat('x', 4001)
    )
  $$,
  '23514',
  null,
  'oversized context_note is rejected'
);

select throws_ok(
  $$
    insert into public.check_ins (
      user_id, skin_state, irritation, notes
    )
    values (
      'b4b11111-1111-1111-1111-111111111111',
      'same',
      'none',
      repeat('y', 4001)
    )
  $$,
  '23514',
  null,
  'oversized notes is rejected'
);

select finish();
rollback;
