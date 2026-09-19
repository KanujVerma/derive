begin;

select plan(16);

select col_default_is(
  'public',
  'memberships',
  'tier',
  'founding_beta'::text,
  'membership tier default is price-neutral'
);

select has_column('public', 'check_ins', 'primary_goal', 'check-ins persist primary goal');
select has_column('public', 'check_ins', 'adherence', 'check-ins persist adherence');
select has_column('public', 'check_ins', 'context_tags', 'check-ins persist structured context tags');
select has_column('public', 'check_ins', 'context_note', 'check-ins persist one optional explanation');

select col_default_is(
  'public',
  'check_ins',
  'context_tags',
  array[]::text[],
  'context tags default to an empty observation set'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '44444444-4444-4444-4444-444444444444',
    'i1b4-owner@example.test',
    '{"full_name":"I1 B4 Owner"}'::jsonb
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'i1b4-other@example.test',
    '{"full_name":"I1 B4 Other"}'::jsonb
  );

insert into public.memberships (user_id)
values ('44444444-4444-4444-4444-444444444444');

select results_eq(
  $$select tier from public.memberships where user_id = '44444444-4444-4444-4444-444444444444'$$,
  array['founding_beta'],
  'new memberships receive the canonical price-neutral tier'
);

select is_empty(
  $$select tier from public.memberships where tier = 'founding_beta_129'$$,
  'no legacy price-coded membership identities remain after migration'
);

select ok(
  has_column_privilege('authenticated', 'public.check_ins', 'context_tags', 'insert')
    and has_column_privilege('authenticated', 'public.check_ins', 'context_note', 'insert')
    and has_column_privilege('authenticated', 'public.check_ins', 'primary_goal', 'insert')
    and has_column_privilege('authenticated', 'public.check_ins', 'adherence', 'insert'),
  'authenticated members can append the new observation fields'
);

set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';

select lives_ok(
  $$
    insert into public.check_ins (
      user_id,
      primary_goal,
      skin_state,
      irritation,
      adherence,
      context_tags,
      context_note
    ) values (
      '44444444-4444-4444-4444-444444444444',
      'breakouts',
      'same',
      'none',
      'mostly',
      array['diet', 'alcohol', 'sleep'],
      'Ate differently, drank Friday, and barely slept.'
    )
  $$,
  'an owner can append multiple optional context tags'
);

select ok(
  (
    select context_tags = array['diet', 'alcohol', 'sleep']::text[]
      and context_note = 'Ate differently, drank Friday, and barely slept.'
    from public.check_ins
    where user_id = '44444444-4444-4444-4444-444444444444'
  ),
  'structured context and its optional explanation survive a database round trip'
);

select throws_ok(
  $$
    insert into public.check_ins (user_id, skin_state, irritation, context_tags)
    values (
      '44444444-4444-4444-4444-444444444444',
      'same',
      'none',
      array['claimed_cause']
    )
  $$,
  '23514',
  null,
  'non-canonical or causal tags fail closed'
);

select throws_ok(
  $$
    insert into public.check_ins (user_id, skin_state, irritation, context_note)
    values (
      '44444444-4444-4444-4444-444444444444',
      'same',
      'none',
      repeat('x', 2001)
    )
  $$,
  '23514',
  null,
  'context notes reject oversized input'
);

select throws_ok(
  $$
    insert into public.check_ins (user_id, skin_state, irritation, context_tags)
    values (
      '55555555-5555-5555-5555-555555555555',
      'same',
      'none',
      array['sleep']
    )
  $$,
  '42501',
  null,
  'a member cannot write context for another member'
);

select throws_ok(
  $$update public.check_ins set ai_analysis_sentence = 'context caused outcome'$$,
  '42501',
  null,
  'members cannot convert observations into server analysis'
);

select is_empty(
  $$
    select id
    from public.check_ins
    where user_id = '55555555-5555-5555-5555-555555555555'
  $$,
  'owner-scoped reads do not expose another member check-ins'
);

select * from finish();
rollback;
