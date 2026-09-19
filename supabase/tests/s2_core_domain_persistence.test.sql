begin;

select plan(40);

-- New S2 history tables and least-privilege shape.
select has_table('public', 'formula_snapshots', 'formula_snapshots table exists');
select has_table('public', 'product_reactions', 'product_reactions table exists');
select has_table('public', 'ingredient_signals', 'ingredient_signals table exists');

select results_eq(
  $$
    select relname::text collate "default"
    from pg_class
    where oid in (
      'public.formula_snapshots'::regclass,
      'public.product_reactions'::regclass,
      'public.ingredient_signals'::regclass
    )
      and relrowsecurity
    order by relname
  $$,
  array['formula_snapshots', 'ingredient_signals', 'product_reactions'],
  'RLS is enabled on every S2 history table'
);

select results_eq(
  $$
    select (tablename || '.' || policyname || ':' || cmd || ':' || array_to_string(roles, ',')) collate "default"
    from pg_policies
    where schemaname = 'public'
      and tablename in ('formula_snapshots', 'product_reactions', 'ingredient_signals')
    order by tablename, policyname
  $$,
  array[
    'formula_snapshots.formula_snapshots_select_own:SELECT:authenticated',
    'ingredient_signals.ingredient_signals_select_own:SELECT:authenticated',
    'product_reactions.product_reactions_select_own:SELECT:authenticated'
  ],
  'S2 history tables expose exactly owner-read policies to members'
);

select ok(
  not has_table_privilege('authenticated', 'public.formula_snapshots', 'insert')
    and not has_table_privilege('authenticated', 'public.product_reactions', 'insert')
    and not has_table_privilege('authenticated', 'public.ingredient_signals', 'insert'),
  'members cannot directly write sensitive formula, reaction, or inferred-signal history'
);

select ok(
  has_table_privilege('service_role', 'public.formula_snapshots', 'insert')
    and has_table_privilege('service_role', 'public.product_reactions', 'insert')
    and has_table_privilege('service_role', 'public.ingredient_signals', 'insert'),
  'trusted service role can append S2 history'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_routine_version(uuid,text,jsonb,text,text,timestamptz)',
    'execute'
  )
    and not has_function_privilege(
      'authenticated',
      'public.create_routine_version(uuid,text,jsonb,text,text,timestamptz)',
      'execute'
    )
    and has_function_privilege(
      'service_role',
      'public.record_product_reaction(uuid,uuid,text,text,text[],text[],text,text,text,text,timestamptz)',
      'execute'
    )
    and not has_function_privilege(
      'authenticated',
      'public.record_product_reaction(uuid,uuid,text,text,text[],text[],text,text,text,text,timestamptz)',
      'execute'
    ),
  'append RPCs are service-only'
);

select has_column('public', 'routines', 'updated_at', 'routines exposes canonical updated_at');
select has_column('public', 'routine_items', 'product_id', 'routine items reference canonical products');

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'routines_user_version_unique_idx',
        'routine_items_schedule_order_unique_idx'
      )
      and indexdef ilike '%unique index%'
  ),
  2,
  'routine version and per-schedule ordering identities are unique'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('b1111111-1111-1111-1111-111111111111', 's2_owner@example.test', '{"full_name":"S2 Owner"}'::jsonb),
  ('b2222222-2222-2222-2222-222222222222', 's2_other@example.test', '{"full_name":"S2 Other"}'::jsonb);

insert into public.products (id, brand, name, category, key_actives, full_ingredients)
values
  (
    'c1111111-1111-1111-1111-111111111111',
    'S2 Brand',
    'S2 Cleanser',
    'cleanser',
    array['Glycerin'],
    array['Water', 'Glycerin']
  ),
  (
    'c2222222-2222-2222-2222-222222222222',
    'S2 Brand',
    'S2 Moisturizer',
    'moisturizer',
    array['Ceramides'],
    array['Water', 'Glycerin', 'Ceramide NP']
  );

set local role service_role;

select lives_ok(
  $$
    select public.create_routine_version(
      'b1111111-1111-1111-1111-111111111111'::uuid,
      'First immutable routine',
      '[
        {
          "order_index": 1,
          "timing": "am",
          "product_id": "c1111111-1111-1111-1111-111111111111",
          "product_name": "S2 Cleanser",
          "brand": "S2 Brand",
          "category": "cleanser",
          "amount": "one pump",
          "area": "face",
          "days": [],
          "purpose": "cleanse",
          "why_chosen": "gentle baseline"
        },
        {
          "order_index": 1,
          "timing": "pm",
          "product_id": "c2222222-2222-2222-2222-222222222222",
          "product_name": "S2 Moisturizer",
          "brand": "S2 Brand",
          "category": "moisturizer",
          "amount": "one pump",
          "area": "face",
          "days": ["mon", "wed", "fri"],
          "purpose": "support barrier",
          "why_chosen": "simple hydration"
        }
      ]'::jsonb,
      'awaiting_review'
    )
  $$,
  'first routine version appends atomically'
);

select results_eq(
  $$
    select version
    from public.routines
    where user_id = 'b1111111-1111-1111-1111-111111111111'
  $$,
  array[1],
  'first appended routine receives version 1'
);

select results_eq(
  $$
    select timing || ':' || order_index::text || ':' || product_id::text
    from public.routine_items
    where routine_id = (
      select id from public.routines
      where user_id = 'b1111111-1111-1111-1111-111111111111' and version = 1
    )
    order by timing, order_index
  $$,
  array[
    'am:1:c1111111-1111-1111-1111-111111111111',
    'pm:1:c2222222-2222-2222-2222-222222222222'
  ],
  'routine steps preserve schedule order and canonical product references'
);

select lives_ok(
  $$
    select public.create_routine_version(
      'b1111111-1111-1111-1111-111111111111'::uuid,
      'Second immutable routine',
      '[{
        "order_index": 1,
        "timing": "am",
        "product_id": "c1111111-1111-1111-1111-111111111111",
        "product_name": "S2 Cleanser",
        "brand": "S2 Brand",
        "category": "cleanser",
        "amount": "one pump",
        "area": "face",
        "days": [],
        "purpose": "cleanse",
        "why_chosen": "retained in the new version"
      }]'::jsonb,
      'draft'
    )
  $$,
  'second routine version appends without overwriting version 1'
);

select results_eq(
  $$
    select version
    from public.routines
    where user_id = 'b1111111-1111-1111-1111-111111111111'
    order by version
  $$,
  array[1, 2],
  'routine history contains sequential version snapshots'
);

select results_eq(
  $$
    select summary_sentence
    from public.routines
    where user_id = 'b1111111-1111-1111-1111-111111111111' and version = 1
  $$,
  array['First immutable routine'],
  'appending a new version preserves old customer-facing content'
);

select throws_ok(
  $$
    update public.routines
    set summary_sentence = 'destructive rewrite'
    where user_id = 'b1111111-1111-1111-1111-111111111111' and version = 1
  $$,
  'P0001',
  'Routine snapshots are immutable; create a new routine version',
  'routine snapshot content cannot be overwritten'
);

select throws_ok(
  $$
    update public.routine_items
    set amount = 'rewritten amount'
    where routine_id = (
      select id from public.routines
      where user_id = 'b1111111-1111-1111-1111-111111111111' and version = 1
    )
  $$,
  'P0001',
  'routine_items rows are immutable; append a new version instead',
  'routine item snapshots cannot be overwritten'
);

select lives_ok(
  $$
    update public.routines
    set status = 'approved'
    where user_id = 'b1111111-1111-1111-1111-111111111111' and version = 1
  $$,
  'routine lifecycle may progress without rewriting snapshot content'
);

select throws_ok(
  $$
    select public.create_routine_version(
      'b1111111-1111-1111-1111-111111111111'::uuid,
      'Invalid routine',
      '[{
        "order_index": 1,
        "timing": "am",
        "product_id": "c9999999-9999-9999-9999-999999999999",
        "product_name": "Unknown",
        "brand": "Unknown",
        "category": "other",
        "amount": "one",
        "area": "face",
        "days": [],
        "purpose": "unknown",
        "why_chosen": "unknown"
      }]'::jsonb
    )
  $$,
  'P0001',
  'Every routine item must reference a canonical product',
  'routine append fails closed on an unknown product reference'
);

select is(
  (
    select count(*)::integer
    from public.routines
    where user_id = 'b1111111-1111-1111-1111-111111111111'
  ),
  2,
  'failed atomic routine append leaves no partial header row'
);

select lives_ok(
  $$
    select public.record_product_reaction(
      'b1111111-1111-1111-1111-111111111111'::uuid,
      'c1111111-1111-1111-1111-111111111111'::uuid,
      'S2 Cleanser',
      'S2 Brand',
      array['Water', 'Glycerin', 'Fragrance'],
      array['burning_stinging', 'redness_rash'],
      'face',
      'moderate',
      'early September 2026',
      'Stopped after two uses',
      '2026-09-10T12:30:00Z'::timestamptz
    )
  $$,
  'reaction recorder atomically persists formula snapshot and reaction'
);

select ok(
  (
    select reaction.user_id = formula.user_id
      and reaction.product_id = formula.product_id
    from public.product_reactions as reaction
    join public.formula_snapshots as formula
      on formula.id = reaction.formula_snapshot_id
    where reaction.user_id = 'b1111111-1111-1111-1111-111111111111'
  ),
  'reaction is bound to a formula snapshot for the same member and product'
);

select results_eq(
  $$
    select ingredients, captured_at
    from public.formula_snapshots
    where user_id = 'b1111111-1111-1111-1111-111111111111'
  $$,
  $$values (
    array['Water', 'Glycerin', 'Fragrance']::text[],
    '2026-09-10T12:30:00Z'::timestamptz
  )$$,
  'historical formula ingredients and capture time are preserved exactly'
);

select throws_ok(
  $$
    update public.formula_snapshots
    set ingredients = array['rewritten']
    where user_id = 'b1111111-1111-1111-1111-111111111111'
  $$,
  'P0001',
  'formula_snapshots rows are immutable; append a new version instead',
  'historical formula snapshots cannot be rewritten'
);

select throws_ok(
  $$
    update public.product_reactions
    set severity = 'mild'
    where user_id = 'b1111111-1111-1111-1111-111111111111'
  $$,
  'P0001',
  'product_reactions rows are immutable; append a new version instead',
  'reaction history cannot be rewritten'
);

select throws_ok(
  $$
    insert into public.product_reactions (
      user_id,
      product_id,
      formula_snapshot_id,
      product_name_snapshot,
      symptoms,
      body_area,
      severity
    ) values (
      'b2222222-2222-2222-2222-222222222222',
      'c1111111-1111-1111-1111-111111111111',
      (select id from public.formula_snapshots where user_id = 'b1111111-1111-1111-1111-111111111111'),
      'S2 Cleanser',
      array['itching'],
      'face',
      'mild'
    )
  $$,
  'P0001',
  'Reaction formula snapshot must belong to the same member and product',
  'a reaction cannot attach another member formula snapshot'
);

select lives_ok(
  $$
    insert into public.ingredient_signals (
      user_id,
      ingredient_name,
      version,
      confidence,
      evidence_count,
      supporting_reaction_ids,
      contradictory_tolerance_evidence,
      notes
    ) values (
      'b1111111-1111-1111-1111-111111111111',
      'Fragrance',
      1,
      'suspected_sensitivity',
      1,
      array[(select id from public.product_reactions where user_id = 'b1111111-1111-1111-1111-111111111111')],
      '[]'::jsonb,
      'Association only; not a diagnosis'
    )
  $$,
  'ingredient signal version appends with explicit supporting evidence'
);

select throws_ok(
  $$
    update public.ingredient_signals
    set confidence = 'confirmed_allergy'
    where user_id = 'b1111111-1111-1111-1111-111111111111'
  $$,
  'P0001',
  'ingredient_signals rows are immutable; append a new version instead',
  'ingredient signal confidence history cannot be rewritten'
);

select throws_ok(
  $$
    insert into public.ingredient_signals (
      user_id,
      ingredient_name,
      version,
      confidence,
      evidence_count,
      supporting_reaction_ids
    ) values (
      'b2222222-2222-2222-2222-222222222222',
      'Fragrance',
      1,
      'weak_signal',
      1,
      array[(select id from public.product_reactions where user_id = 'b1111111-1111-1111-1111-111111111111')]
    )
  $$,
  'P0001',
  'Ingredient signal evidence must reference reactions owned by the same member',
  'ingredient evidence cannot cross member boundaries'
);

set local role authenticated;
set local request.jwt.claim.sub = 'b1111111-1111-1111-1111-111111111111';

select results_eq(
  $$
    select source
    from (
      select 'formula'::text as source from public.formula_snapshots
      union all
      select 'reaction'::text from public.product_reactions
      union all
      select 'signal'::text from public.ingredient_signals
    ) as own_history
    order by source
  $$,
  array['formula', 'reaction', 'signal'],
  'member can read each type of their own persisted history'
);

set local request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';

select is(
  (
    select
      (select count(*) from public.formula_snapshots)
      + (select count(*) from public.product_reactions)
      + (select count(*) from public.ingredient_signals)
  )::bigint,
  0::bigint,
  'another member cannot read formula, reaction, or signal history'
);

select throws_ok(
  $$
    insert into public.formula_snapshots (
      user_id, product_name, ingredients, captured_at
    ) values (
      'b2222222-2222-2222-2222-222222222222',
      'Direct write',
      array['Unknown'],
      now()
    )
  $$,
  '42501',
  null,
  'members cannot bypass the atomic reaction recorder with a direct formula write'
);

set local request.jwt.claim.sub = 'b1111111-1111-1111-1111-111111111111';

select lives_ok(
  $$
    insert into public.user_photos (user_id, photo_type, storage_path)
    values (
      'b1111111-1111-1111-1111-111111111111',
      'front',
      'b1111111-1111-1111-1111-111111111111/front/s2-default.jpg'
    )
  $$,
  'legacy-compatible photo insert receives provenance defaults'
);

select results_eq(
  $$
    select capture_type, angle, capture_quality_passed, member_approved
    from public.user_photos
    where storage_path = 'b1111111-1111-1111-1111-111111111111/front/s2-default.jpg'
  $$,
  $$values ('baseline'::text, 'front'::text, false, false)$$,
  'photo provenance defaults are conservative and truthful'
);

select lives_ok(
  $$
    insert into public.check_ins (
      user_id,
      routine_id,
      skin_state,
      irritation,
      primary_goal,
      goal_outcome,
      adherence,
      irritation_symptoms,
      irritation_body_area,
      notes
    ) values (
      'b1111111-1111-1111-1111-111111111111',
      (select id from public.routines where user_id = 'b1111111-1111-1111-1111-111111111111' and version = 1),
      'better',
      'little',
      'breakouts',
      'better',
      'mostly',
      array['dryness_peeling'],
      'face',
      'S2 weekly check-in'
    )
  $$,
  'member check-in persists routine linkage and structured longitudinal fields'
);

select lives_ok(
  $$
    insert into public.refill_requests (
      user_id,
      product_id,
      product_name,
      brand,
      request_note
    ) values (
      'b1111111-1111-1111-1111-111111111111',
      'c1111111-1111-1111-1111-111111111111',
      'S2 Cleanser',
      'S2 Brand',
      'Running low'
    )
  $$,
  'member refill request persists canonical product and request context'
);

select throws_ok(
  $$
    insert into public.refill_requests (
      user_id,
      product_id,
      product_name,
      brand
    ) values (
      'b1111111-1111-1111-1111-111111111111',
      'c1111111-1111-1111-1111-111111111111',
      'S2 Cleanser',
      'S2 Brand'
    )
  $$,
  '23505',
  null,
  'duplicate open refill for the same member and product is rejected'
);

reset role;

delete from auth.users where id = 'b1111111-1111-1111-1111-111111111111';

select is(
  (
    select
      (select count(*) from public.formula_snapshots where user_id = 'b1111111-1111-1111-1111-111111111111')
      + (select count(*) from public.product_reactions where user_id = 'b1111111-1111-1111-1111-111111111111')
      + (select count(*) from public.ingredient_signals where user_id = 'b1111111-1111-1111-1111-111111111111')
      + (select count(*) from public.routines where user_id = 'b1111111-1111-1111-1111-111111111111')
  )::bigint,
  0::bigint,
  'account deletion cascades S2 history without orphaning member records'
);

select * from finish();
rollback;
