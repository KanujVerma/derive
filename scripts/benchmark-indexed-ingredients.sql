-- Synthetic query-plan harness; run only against a disposable local database.
-- No source/catalog/owner data is exported. All fixtures roll back.
\set ON_ERROR_STOP on
begin;
insert into public.product_formula_versions(ingredients,normalized_ingredient_fingerprint,provenance_type,
 source_reference,catalog_public_source_url,observed_at,verification_status)
 select array['Synthetic Water','Synthetic Ingredient '||n], 'intentionally-unreliable-legacy-key',
 'manufacturer','https://example.org/synthetic','https://example.org/synthetic',now(),'verified'
 from generate_series(1,12001) n;
analyze public.product_formula_versions;
do $$
declare plan json; ids uuid[];
begin
 execute $query$explain (analyze, buffers, format json)
   select id from public.product_formula_versions
   where verification_status='verified'
   and private.ingredient_evidence_digest(ingredients)=private.ingredient_evidence_digest(array['synthetic water','synthetic ingredient 12001'])
   and private.ingredient_evidence_key(ingredients)=private.ingredient_evidence_key(array['synthetic water','synthetic ingredient 12001'])$query$ into plan;
 if plan::text not like '%product_formula_ingredient_evidence_idx%' then
   raise exception 'Dedicated index was not selected naturally';
 end if;
 ids := public.lookup_ingredient_candidate_ids(array['synthetic water','synthetic ingredient 12001'],true,
   'a1900000-0000-4000-8000-000000000099');
 if cardinality(ids)<>1 then raise exception 'Expected exactly one synthetic candidate, got %',cardinality(ids); end if;
 raise notice 'Synthetic formulas: 12001; candidate count: %; dedicated index: yes; query execution ms: %',
   cardinality(ids),plan->0->>'Execution Time';
end $$;
explain (analyze, buffers) select public.lookup_ingredient_candidate_ids(
 array['synthetic water','synthetic ingredient 12001'],true,'a1900000-0000-4000-8000-000000000099');
rollback;
