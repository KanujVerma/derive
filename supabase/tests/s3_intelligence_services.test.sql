begin;

select plan(21);

select has_column(
  'public',
  'product_reactions',
  'source_key',
  'onboarding reaction provenance key exists'
);

select has_function(
  'public',
  'resolve_catalog_product',
  array['text', 'text', 'text'],
  'S3 catalog resolver exists'
);
select has_function(
  'public',
  'append_ingredient_signal_versions',
  array['uuid', 'jsonb'],
  'S3 ingredient signal append transaction exists'
);

select ok(
  has_function_privilege('service_role', 'public.resolve_catalog_product(text,text,text)', 'execute')
    and has_function_privilege('service_role', 'public.append_ingredient_signal_versions(uuid,jsonb)', 'execute')
    and has_function_privilege('service_role', 'public.record_product_reaction_once(uuid,text,uuid,text,text,text[],text[],text,text,text,text,timestamp with time zone)', 'execute')
    and not has_function_privilege('authenticated', 'public.resolve_catalog_product(text,text,text)', 'execute')
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
      'cleanser'
    )
  $$,
  'catalog resolver creates a normalized user-reported product identity'
);

select lives_ok(
  $$
    select public.resolve_catalog_product(
      ' s3 brand ',
      ' barrier cleanser ',
      'cleanser'
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
  'user-reported identities are not falsely marked as audited catalog standards'
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
  not has_function_privilege('authenticated', 'public.resolve_catalog_product(text,text,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.append_ingredient_signal_versions(uuid,jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.record_product_reaction_once(uuid,text,uuid,text,text,text[],text[],text,text,text,text,timestamp with time zone)', 'execute'),
  'authenticated members cannot invoke trusted S3 persistence operations directly'
);

select * from finish();
rollback;
