begin;
select plan(8);

select has_table('public', 'free_product_evidence_grants', 'free upload grants exist');
select ok((select relrowsecurity from pg_class where oid = 'public.free_product_evidence_grants'::regclass),
  'free upload grants enforce RLS');
select ok(has_table_privilege('authenticated', 'public.free_product_evidence_grants', 'select')
  and not has_table_privilege('authenticated', 'public.free_product_evidence_grants', 'insert')
  and not has_table_privilege('authenticated', 'public.free_product_evidence_grants', 'update'),
  'clients cannot issue or change grants');
select ok(has_function_privilege('service_role', 'public.issue_free_product_evidence_grant(uuid,uuid,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.issue_free_product_evidence_grant(uuid,uuid,text,text)', 'execute'),
  'only server can issue paths');
select ok((select not public from storage.buckets where id = 'customer-product-evidence'),
  'evidence remains private');
select is((select count(*)::int from pg_policies where schemaname = 'storage'
  and tablename = 'objects' and policyname = 'customer_product_evidence_free_insert_granted'), 1,
  'free path has dedicated insert policy');
select ok((select policyname is not null from pg_policies where schemaname = 'storage'
  and tablename = 'objects' and policyname = 'customer_product_evidence_insert_own'),
  'managed upload policy remains');
select ok(not has_table_privilege('anon', 'public.free_product_evidence_grants', 'select'),
  'unauthenticated callers cannot list grants');

select * from finish();
rollback;
