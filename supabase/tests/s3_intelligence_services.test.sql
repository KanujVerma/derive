begin;

select plan(33);

select has_column(
  'public',
  'product_reactions',
  'source_key',
  'onboarding reaction provenance key exists'
);

select has_function(
  'public',
  'resolve_catalog_product',
  array['text', 'text', 'text', 'text[]', 'text[]', 'text[]'],
  'S3 catalog resolver exists'
);
select has_function(
  'public',
  'commit_routine_proposal',
  array['uuid', 'text', 'jsonb', 'jsonb'],
  'S3 routine proposal transaction exists'
);
select has_function(
  'public',
  'append_ingredient_signal_versions',
  array['uuid', 'jsonb'],
  'S3 ingredient signal append transaction exists'
);

select ok(
  has_function_privilege('service_role', 'public.resolve_catalog_product(text,text,text,text[],text[],text[])', 'execute')
    and has_function_privilege('service_role', 'public.commit_routine_proposal(uuid,text,jsonb,jsonb)', 'execute')
    and has_function_privilege('service_role', 'public.append_ingredient_signal_versions(uuid,jsonb)', 'execute')
    and has_function_privilege('service_role', 'public.record_product_reaction_once(uuid,text,uuid,text,text,text[],text[],text,text,text,text,timestamp with time zone)', 'execute')
    and not has_function_privilege('authenticated', 'public.resolve_catalog_product(text,text,text,text[],text[],text[])', 'execute')
    and not has_function_privilege('authenticated', 'public.commit_routine_proposal(uuid,text,jsonb,jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.append_ingredient_signal_versions(uuid,jsonb)', 'execute'),
  'S3 mutation functions are service-role only'
);

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'user_products_user_product_unique_idx'
      and indexdef ilike '%unique index%'
  ),
  1,
  'member shelf identity is unique per canonical product'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('d3111111-1111-1111-1111-111111111111', 's3_owner@example.test', '{"full_name":"S3 Owner"}'::jsonb),
  ('d3222222-2222-2222-2222-222222222222', 's3_other@example.test', '{"full_name":"S3 Other"}'::jsonb);

set local role service_role;

select lives_ok(
  $$
    select public.resolve_catalog_product(
      'S3 Brand',
      'Barrier Cleanser',
      'cleanser',
      array['Glycerin'],
      array['Water', 'Glycerin'],
      array[]::text[]
    )
  $$,
  'catalog resolver creates a normalized model-decided product'
);

select lives_ok(
  $$
    select public.resolve_catalog_product(
      ' s3 brand ',
      ' barrier cleanser ',
      'cleanser',
      array['Glycerin'],
      array['Water', 'Glycerin'],
      array[]::text[]
    )
  $$,
  'catalog resolver reuses a case-insensitive canonical identity'
);

select is(
  (
    select count(*)::integer
    from public.products
    where lower(trim(brand)) = 's3 brand'
      and lower(trim(name)) = 'barrier cleanser'
  ),
  1,
  'repeated catalog resolution does not duplicate products'
);

select is(
  (
    select is_catalog_standard
    from public.products
    where lower(trim(brand)) = 's3 brand'
      and lower(trim(name)) = 'barrier cleanser'
  ),
  false,
  'model-normalized catalog rows are not falsely marked as audited standards'
);

select lives_ok(
  $$
    select public.commit_routine_proposal(
      'd3111111-1111-1111-1111-111111111111'::uuid,
      'S3 initial draft',
      jsonb_build_array(jsonb_build_object(
        'order_index', 1,
        'timing', 'am',
        'product_id', (
          select id from public.products
          where lower(trim(brand)) = 's3 brand'
            and lower(trim(name)) = 'barrier cleanser'
        ),
        'product_name', 'Barrier Cleanser',
        'brand', 'S3 Brand',
        'category', 'cleanser',
        'amount', 'one pump',
        'area', 'face',
        'days', '[]'::jsonb,
        'purpose', 'cleanse',
        'why_chosen', 'gentle baseline'
      )),
      jsonb_build_array(jsonb_build_object(
        'product_id', (
          select id from public.products
          where lower(trim(brand)) = 's3 brand'
            and lower(trim(name)) = 'barrier cleanser'
        ),
        'detected_brand', 'S3 Brand',
        'detected_name', 'Barrier Cleanser',
        'action', 'KEEP',
        'action_reason', 'Already tolerated',
        'frequency_nights_per_week', 7
      ))
    )
  $$,
  'validated routine and shelf decisions commit atomically'
);

select results_eq(
  $$
    select version, status
    from public.routines
    where user_id = 'd3111111-1111-1111-1111-111111111111'
  $$,
  $$values (1, 'awaiting_review'::text)$$,
  'S3 proposals append as awaiting-review routine versions'
);

select results_eq(
  $$
    select timing, order_index, product_name
    from public.routine_items
    where routine_id = (
      select id from public.routines
      where user_id = 'd3111111-1111-1111-1111-111111111111' and version = 1
    )
  $$,
  $$values ('am'::text, 1, 'Barrier Cleanser'::text)$$,
  'routine transaction preserves canonical step data'
);

select results_eq(
  $$
    select action, frequency_nights_per_week, is_confirmed_by_user
    from public.user_products
    where user_id = 'd3111111-1111-1111-1111-111111111111'
  $$,
  $$values ('KEEP'::text, 7, false)$$,
  'model shelf action remains explicitly unconfirmed by the member'
);

select is(
  (
    select count(*)::integer
    from public.founder_review_tasks
    where user_id = 'd3111111-1111-1111-1111-111111111111'
      and task_type = 'initial_routine'
      and status = 'pending'
  ),
  1,
  'routine proposal guarantees one pending founder quality-review task'
);

update public.user_products
set is_confirmed_by_user = true
where user_id = 'd3111111-1111-1111-1111-111111111111';

select lives_ok(
  $$
    select public.commit_routine_proposal(
      'd3111111-1111-1111-1111-111111111111'::uuid,
      'S3 second draft',
      jsonb_build_array(jsonb_build_object(
        'order_index', 1,
        'timing', 'am',
        'product_id', (
          select id from public.products
          where lower(trim(brand)) = 's3 brand'
            and lower(trim(name)) = 'barrier cleanser'
        ),
        'product_name', 'Barrier Cleanser',
        'brand', 'S3 Brand',
        'category', 'cleanser',
        'amount', 'one pump',
        'area', 'face',
        'days', '[]'::jsonb,
        'purpose', 'cleanse',
        'why_chosen', 'retained in next draft'
      )),
      jsonb_build_array(jsonb_build_object(
        'product_id', (
          select id from public.products
          where lower(trim(brand)) = 's3 brand'
            and lower(trim(name)) = 'barrier cleanser'
        ),
        'detected_brand', 'S3 Brand',
        'detected_name', 'Barrier Cleanser',
        'action', 'PAUSE',
        'action_reason', 'Temporary pause for founder review',
        'frequency_nights_per_week', 0
      ))
    )
  $$,
  'subsequent proposal appends a routine without overriding member-confirmed shelf truth'
);

select results_eq(
  $$
    select version
    from public.routines
    where user_id = 'd3111111-1111-1111-1111-111111111111'
    order by version
  $$,
  array[1, 2],
  'subsequent proposals preserve version history'
);

select is(
  (
    select count(*)::integer
    from public.user_products
    where user_id = 'd3111111-1111-1111-1111-111111111111'
  ),
  1,
  'subsequent proposals update one canonical shelf identity instead of duplicating it'
);

select results_eq(
  $$
    select action, action_reason, frequency_nights_per_week, is_confirmed_by_user
    from public.user_products
    where user_id = 'd3111111-1111-1111-1111-111111111111'
  $$,
  $$values ('KEEP'::text, 'Already tolerated'::text, 7, true)$$,
  'generated proposals cannot overwrite a member-confirmed shelf decision'
);

select lives_ok(
  $$
    select public.record_product_reaction(
      'd3111111-1111-1111-1111-111111111111'::uuid,
      (select id from public.products where lower(trim(brand)) = 's3 brand' and lower(trim(name)) = 'barrier cleanser'),
      'Barrier Cleanser',
      'S3 Brand',
      array['Water', 'Fragrance'],
      array['burning_stinging'],
      'face',
      'moderate'
    )
  $$,
  'S2 reaction evidence is available to S3 signal inference'
);

select lives_ok(
  $$
    select public.append_ingredient_signal_versions(
      'd3111111-1111-1111-1111-111111111111'::uuid,
      jsonb_build_array(jsonb_build_object(
        'ingredient_name', 'Fragrance',
        'confidence', 'weak_signal',
        'evidence_count', 1,
        'supporting_reaction_ids', jsonb_build_array((
          select id from public.product_reactions
          where user_id = 'd3111111-1111-1111-1111-111111111111'
        )),
        'contradictory_tolerance_evidence', '[]'::jsonb,
        'allergy_source', 'user_reported',
        'notes', 'Association only'
      ))
    )
  $$,
  'first inferred signal version appends from owner-validated evidence'
);

select is(
  (
    select count(*)::integer from public.ingredient_signals
    where user_id = 'd3111111-1111-1111-1111-111111111111'
      and ingredient_key = 'fragrance'
  ),
  1,
  'first inference creates one signal version'
);

select lives_ok(
  $$
    select public.append_ingredient_signal_versions(
      'd3111111-1111-1111-1111-111111111111'::uuid,
      jsonb_build_array(jsonb_build_object(
        'ingredient_name', 'Fragrance',
        'confidence', 'weak_signal',
        'evidence_count', 1,
        'supporting_reaction_ids', jsonb_build_array((
          select id from public.product_reactions
          where user_id = 'd3111111-1111-1111-1111-111111111111'
        )),
        'contradictory_tolerance_evidence', '[]'::jsonb,
        'allergy_source', 'user_reported',
        'notes', 'Association only'
      ))
    )
  $$,
  'repeating inference against unchanged evidence succeeds idempotently'
);

select is(
  (
    select count(*)::integer from public.ingredient_signals
    where user_id = 'd3111111-1111-1111-1111-111111111111'
      and ingredient_key = 'fragrance'
  ),
  1,
  'unchanged inference does not append history noise'
);

select lives_ok(
  $$
    select public.append_ingredient_signal_versions(
      'd3111111-1111-1111-1111-111111111111'::uuid,
      jsonb_build_array(jsonb_build_object(
        'ingredient_name', 'Fragrance',
        'confidence', 'weak_signal',
        'evidence_count', 1,
        'supporting_reaction_ids', jsonb_build_array((
          select id from public.product_reactions
          where user_id = 'd3111111-1111-1111-1111-111111111111'
        )),
        'contradictory_tolerance_evidence', jsonb_build_array(jsonb_build_object(
          'productId', (select id from public.products where lower(trim(brand)) = 's3 brand' and lower(trim(name)) = 'barrier cleanser'),
          'productName', 'Barrier Cleanser'
        )),
        'allergy_source', 'user_reported',
        'notes', 'Discounted by tolerated exposure'
      ))
    )
  $$,
  'changed tolerated-exposure evidence appends a new immutable version'
);

select results_eq(
  $$
    select version, jsonb_array_length(contradictory_tolerance_evidence)
    from public.ingredient_signals
    where user_id = 'd3111111-1111-1111-1111-111111111111'
      and ingredient_key = 'fragrance'
    order by version
  $$,
  $$values (1, 0), (2, 1)$$,
  'signal versions preserve the change in contradictory tolerated exposure'
);

select throws_ok(
  $$
    select public.commit_routine_proposal(
      'd3111111-1111-1111-1111-111111111111'::uuid,
      'Invalid partial draft',
      jsonb_build_array(jsonb_build_object(
        'order_index', 1,
        'timing', 'am',
        'product_id', (select id from public.products where lower(trim(brand)) = 's3 brand' and lower(trim(name)) = 'barrier cleanser'),
        'product_name', 'Barrier Cleanser',
        'brand', 'S3 Brand',
        'category', 'cleanser',
        'amount', 'one pump',
        'area', 'face',
        'days', '[]'::jsonb,
        'purpose', 'cleanse',
        'why_chosen', 'invalid transaction test'
      )),
      jsonb_build_array(jsonb_build_object(
        'product_id', (select id from public.products where lower(trim(brand)) = 's3 brand' and lower(trim(name)) = 'barrier cleanser'),
        'detected_brand', 'S3 Brand',
        'detected_name', 'Barrier Cleanser',
        'action', 'INVALID',
        'action_reason', 'must roll back'
      ))
    )
  $$,
  'P0001',
  'Invalid shelf action',
  'invalid model shelf action aborts the entire proposal transaction'
);

select is(
  (
    select count(*)::integer from public.routines
    where user_id = 'd3111111-1111-1111-1111-111111111111'
  ),
  2,
  'failed proposal transaction leaves no partial routine version'
);

select throws_ok(
  $$
    select public.append_ingredient_signal_versions(
      'd3222222-2222-2222-2222-222222222222'::uuid,
      jsonb_build_array(jsonb_build_object(
        'ingredient_name', 'Fragrance',
        'confidence', 'weak_signal',
        'evidence_count', 1,
        'supporting_reaction_ids', jsonb_build_array((
          select id from public.product_reactions
          where user_id = 'd3111111-1111-1111-1111-111111111111'
        )),
        'contradictory_tolerance_evidence', '[]'::jsonb
      ))
    )
  $$,
  'P0001',
  'Ingredient signal evidence must reference reactions owned by the same member',
  'signal inference cannot attach another member reaction evidence'
);

select lives_ok(
  $$
    select public.record_product_reaction_once(
      'd3111111-1111-1111-1111-111111111111'::uuid,
      'onboarding:v1:reaction:0',
      (select id from public.products where lower(trim(brand)) = 's3 brand' and lower(trim(name)) = 'barrier cleanser'),
      'Barrier Cleanser',
      'S3 Brand',
      array['Water', 'Glycerin'],
      array['burning_stinging'],
      'face',
      'mild',
      'last month',
      'sealed onboarding evidence',
      '2026-09-18T12:00:00Z'::timestamptz
    )
  $$,
  'sealed onboarding reaction normalizes into S2 provenance tables'
);

select lives_ok(
  $$
    select public.record_product_reaction_once(
      'd3111111-1111-1111-1111-111111111111'::uuid,
      'onboarding:v1:reaction:0',
      (select id from public.products where lower(trim(brand)) = 's3 brand' and lower(trim(name)) = 'barrier cleanser'),
      'Barrier Cleanser',
      'S3 Brand',
      array['Water', 'Glycerin'],
      array['burning_stinging'],
      'face',
      'mild',
      'last month',
      'sealed onboarding evidence',
      '2026-09-18T12:00:00Z'::timestamptz
    )
  $$,
  'replaying the same onboarding reaction remains safe'
);

select is(
  (
    select count(*)::integer
    from public.product_reactions
    where user_id = 'd3111111-1111-1111-1111-111111111111'
      and source_key = 'onboarding:v1:reaction:0'
  ),
  1,
  'onboarding reaction normalization is idempotent'
);

reset role;

select ok(
  not has_function_privilege('authenticated', 'public.resolve_catalog_product(text,text,text,text[],text[],text[])', 'execute')
    and not has_function_privilege('authenticated', 'public.commit_routine_proposal(uuid,text,jsonb,jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.append_ingredient_signal_versions(uuid,jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.record_product_reaction_once(uuid,text,uuid,text,text,text[],text[],text,text,text,text,timestamp with time zone)', 'execute'),
  'authenticated members cannot invoke trusted S3 persistence operations directly'
);

select * from finish();
rollback;
