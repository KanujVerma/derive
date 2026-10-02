begin;
select no_plan();

select has_table('private','part_one_jobs','A20 durable jobs ledger installed');
select has_table('private','part_one_records','immutable evidence ledger installed');
select ok(not has_table_privilege('authenticated','private.part_one_scans','select')
  and not has_table_privilege('authenticated','private.part_one_records','select'),
  'private records have no customer table hydration path');
select ok(not has_function_privilege('authenticated','public.part_one_worker(text,jsonb)','execute'),
  'only service-role consumer can publish/reserve');
select ok(has_function_privilege('authenticated','public.part_one_operation(text,jsonb)','execute'),
  'authenticated operation RPC is installed');
select is((select count(*)::int from private.part_one_policies where id<>'derive_catalog' and
  (lookup_allowed or retain_allowed or display_allowed)),0,'all unresolved external/private source policies stay disabled');

insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
  ('e6000000-0000-4000-8000-000000000001',null,true,'{}'),
  ('e6000000-0000-4000-8000-000000000002',null,true,'{}');
create temp table part_one_test_state(key text primary key,value jsonb);
grant all on part_one_test_state to authenticated;

-- Synthetic permitted source: no production provider payload, photo or profile.
insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,observed_at,expires_at) values
 ('e6100000-0000-4000-8000-000000000001','observation',null,1,null,'derive_catalog','1',
  '{"provider":"synthetic","rawText":"Water, Glycerin","sourceUpdatedAt":null}',now(),now()+interval '1 day'),
 ('e6100000-0000-4000-8000-000000000002','declaration','e6200000-0000-4000-8000-000000000001',1,null,'derive_catalog','1',
  '{"state":"accepted","rawText":"Water, Glycerin","sections":[],"sources":[],"predicate":{"association":{"passed":true},"noContradiction":{"passed":true},"variantMarket":{"passed":true},"completeness":{"passed":true},"rightsFreshness":{"passed":true}}}',now(),now()+interval '1 day'),
 ('e6100000-0000-4000-8000-000000000003','snapshot','e6200000-0000-4000-8000-000000000001',1,'gtin:00305210416383','derive_catalog','1',
  '{"name":"Synthetic Lotion","brand":"Fixture","variantText":"Unscented 100 ml","image":null,"declarationIds":["e6100000-0000-4000-8000-000000000002"],"requestedMarket":null,"sourceMarkets":[],"packageMarket":null}',now(),now()+interval '1 day');
-- Cannot add dependencies after creation: use a second immutable declaration
-- that points at the observation to exercise the recursive rights closure.
insert into private.part_one_records(id,kind,item_id,revision,policy_id,policy_version,payload,dependencies,observed_at,expires_at)
 select 'e6100000-0000-4000-8000-000000000004','declaration',item_id,2,policy_id,policy_version,payload,
  array['e6100000-0000-4000-8000-000000000001'::uuid],observed_at,expires_at
 from private.part_one_records where id='e6100000-0000-4000-8000-000000000002';
insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,observed_at,expires_at) values
 ('e6100000-0000-4000-8000-000000000005','declaration','e6200000-0000-4000-8000-000000000002',1,null,'derive_catalog','1',
  '{"state":"partial","rawText":"Water","sections":[],"sources":[],"predicate":{"association":{"passed":true},"noContradiction":{"passed":true},"variantMarket":{"passed":false},"completeness":{"passed":false},"rightsFreshness":{"passed":true}}}',now(),now()+interval '1 day'),
 ('e6100000-0000-4000-8000-000000000006','snapshot','e6200000-0000-4000-8000-000000000002',1,'gtin:00123456789012','derive_catalog','1',
  '{"name":"Synthetic Partial Lotion","brand":"Fixture","variantText":"Incomplete panel","image":null,"declarationIds":["e6100000-0000-4000-8000-000000000005"],"requestedMarket":null,"sourceMarkets":[],"packageMarket":null}',now(),now()+interval '1 day');
select throws_ok($$update private.part_one_records set payload='{}' where id='e6100000-0000-4000-8000-000000000002'$$,
 'P0001','PART_ONE_IMMUTABLE','A09 original declaration cannot be rewritten');
select is(private.part_one_code_key('{"raw":"305210416383","symbology":"upc_a","namespace":"gtin","retailerId":null}'),
 'gtin:00305210416383','A01 server retains canonical equivalence');
select is(private.part_one_code_key('{"raw":"0305210416383","symbology":"ean13","namespace":"gtin","retailerId":null}'),
 'gtin:00305210416383','A01 EAN representation coalesces');
select is(private.part_one_code_key('{"raw":"01234565","symbology":null,"namespace":"gtin","retailerId":null}'),null,
 'A02 unknown eight-digit namespace never guessed');

set local role authenticated;
select set_config('request.jwt.claim.sub','e6000000-0000-4000-8000-000000000001',true);
insert into part_one_test_state values('accepted',public.part_one_operation('scans/create',
 '{"idempotencyKey":"accepted-1","canonicalKey":"gtin:WRONG-CLIENT-KEY","reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e6300000-0000-4000-8000-000000000001","clientScanId":"e6300000-0000-4000-8000-000000000002","idempotencyKey":"accepted-1","generation":0,"code":{"raw":"305210416383","symbology":"upc_a","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
select is((select value->>'identity' from part_one_test_state where key='accepted'),'exact','catalog-first returns exact identity');
select is((select value->>'declarationState' from part_one_test_state where key='accepted'),'accepted','DEC-01 whole predicate accepted');
select is((select value->>'snapshotId' from part_one_test_state where key='accepted'),'e6100000-0000-4000-8000-000000000003',
 'client canonical-key injection cannot change retained barcode binding');
select is((select value->'display'->>'resultRevision' from part_one_test_state where key='accepted'),'1','display is revision-bound');
insert into part_one_test_state values('save',public.part_one_operation('saves/create',
 (select jsonb_build_object('idempotencyKey','save-1','scanId',value->'scanId','expectedGeneration',0,'expectedResultRevision',1,
  'selectedSnapshotId',value->'snapshotId','selectedDeclarationId',value->'declarationId') from part_one_test_state where key='accepted')));
select is((select value->>'snapshotAtSaveId' from part_one_test_state where key='save'),'e6100000-0000-4000-8000-000000000003',
 'A28 accepted save fixes snapshot-at-save');
select is(public.part_one_operation('saves/create',
 (select jsonb_build_object('idempotencyKey','save-1','scanId',value->'scanId','expectedGeneration',0,'expectedResultRevision',1,
  'selectedSnapshotId',value->'snapshotId','selectedDeclarationId',value->'declarationId') from part_one_test_state where key='accepted')),
 (select value from part_one_test_state where key='save'),'save replay returns same persisted operation');
insert into part_one_test_state values('partial',public.part_one_operation('scans/create',
 '{"idempotencyKey":"partial-1","canonicalKey":null,"reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e6300000-0000-4000-8000-000000000010","clientScanId":"e6300000-0000-4000-8000-000000000011","idempotencyKey":"partial-1","generation":0,"code":{"raw":"123456789012","symbology":"upca","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
select is((select value->>'declarationState' from part_one_test_state where key='partial'),'partial','A28 published partial evidence never becomes accepted');
insert into part_one_test_state values('partial-save',public.part_one_operation('saves/create',
 (select jsonb_build_object('idempotencyKey','partial-save-1','scanId',value->'scanId','expectedGeneration',0,'expectedResultRevision',value->'resultRevision',
  'selectedSnapshotId',value->'snapshotId','selectedDeclarationId',value->'declarationId') from part_one_test_state where key='partial')));
select is((public.part_one_operation('saves/read',(select jsonb_build_object('id',value->'saveId') from part_one_test_state where key='partial-save'))->'result')->>'declarationState',
 'partial','A28 partial save reopens without complete claims');
insert into part_one_test_state values('capture1',public.part_one_operation('captures/create',
 (select jsonb_build_object('scanId',value->'scanId','expectedGeneration',0,'expectedResultRevision',1) from part_one_test_state where key='accepted')));
select throws_ok($$select public.part_one_operation('captures/observations',(select jsonb_build_object(
 'captureSessionId',value->'captureSessionId','packageObservationId',value->'packageObservationId','expectedGeneration',0,
 'expectedResultRevision',1,'expectedCaptureRevision',0,'expectedDeletionEpoch',0,'observations',jsonb_build_array(),'edits',jsonb_build_array())
 from part_one_test_state where key='capture1'))$$,'P0001','PART_ONE_PRIVATE_RETENTION_DISABLED',
 'A25 private text/photo durable commit is retention-gated with no private payload side effects');
insert into part_one_test_state values('unresolved1',public.part_one_operation('scans/create',
 '{"idempotencyKey":"pending-1","canonicalKey":"gtin:03337875844574","reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e6300000-0000-4000-8000-000000000003","clientScanId":"e6300000-0000-4000-8000-000000000004","idempotencyKey":"pending-1","generation":0,"code":{"raw":"3337875844574","symbology":"ean13","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
select is((select value->>'work' from part_one_test_state where key='unresolved1'),'deferred_budget','A21 no consumer makes background absence honest');
insert into part_one_test_state values('subscription1',public.part_one_operation('subscriptions/create',
 (select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='unresolved1')));
select is(public.part_one_operation('subscriptions/create',
 (select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='unresolved1'))->>'subscriptionId',
 (select value->>'subscriptionId' from part_one_test_state where key='subscription1'),'A21 reopen rejoins same generation interest');
select set_config('request.jwt.claim.sub','e6000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.part_one_operation('scans/read',(select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='accepted'))$$,
 '42501','PART_ONE_NOT_FOUND','A24 foreign account cannot retrieve prior owner scan');
select throws_ok($$select public.part_one_operation('saves/read',(select jsonb_build_object('id',value->'saveId') from part_one_test_state where key='save'))$$,
 '42501','PART_ONE_NOT_FOUND','A24 foreign save inaccessible');
insert into part_one_test_state values('unresolved2',public.part_one_operation('scans/create',
 '{"idempotencyKey":"pending-1","canonicalKey":"gtin:03337875844574","reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e6300000-0000-4000-8000-000000000005","clientScanId":"e6300000-0000-4000-8000-000000000006","idempotencyKey":"pending-1","generation":0,"code":{"raw":"3337875844574","symbology":"ean13","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
select is((select value->>'jobId' from part_one_test_state where key='unresolved1'),(select value->>'jobId' from part_one_test_state where key='unresolved2'),
 'A20 separate owners join one public-key job');
insert into part_one_test_state values('capture2',public.part_one_operation('captures/create',
 (select jsonb_build_object('scanId',value->'scanId','expectedGeneration',0,'expectedResultRevision',1) from part_one_test_state where key='unresolved2')));
select isnt((select value->>'packageObservationId' from part_one_test_state where key='capture1'),
 (select value->>'packageObservationId' from part_one_test_state where key='capture2'),'A25 capture packages stay distinct per owner');
set local role postgres;
select is((select count(*)::int from private.part_one_jobs where id=(select (value->>'jobId')::uuid from part_one_test_state where key='unresolved1')),1,
 'A20 unique index makes create/join atomic');
insert into private.part_one_budgets(provider,call_limit,concurrency_limit,window_seconds) values('derive_catalog',1,1,60);
insert into part_one_test_state values('claim1',public.part_one_worker('claim','{}')->'job');
insert into part_one_test_state values('reservation',public.part_one_worker('reserve',(select jsonb_build_object('jobId',value->'id',
 'leaseToken',value->'leaseToken','stage','synthetic-provider','provider','derive_catalog') from part_one_test_state where key='claim1')));
select is((select value->>'mayDispatch' from part_one_test_state where key='reservation'),'true','A20 reserve before dispatch');
select is(public.part_one_worker('dispatch',(select jsonb_build_object('jobId',c.value->'id','leaseToken',c.value->'leaseToken',
 'reservationId',r.value->'reservationId') from part_one_test_state c,part_one_test_state r where c.key='claim1' and r.key='reservation'))->>'mayDispatch',
 'true','provider call receives one dispatch admission');
select is(public.part_one_worker('dispatch',(select jsonb_build_object('jobId',c.value->'id','leaseToken',c.value->'leaseToken',
 'reservationId',r.value->'reservationId') from part_one_test_state c,part_one_test_state r where c.key='claim1' and r.key='reservation'))->>'mayDispatch',
 'false','A21 ambiguous dispatched call cannot dispatch twice');
select lives_ok($$select public.part_one_worker('checkpoint',(select jsonb_build_object('jobId',value->'id','leaseToken',value->'leaseToken',
 'stage','completed-stage','output',jsonb_build_object('status','found','parsedNegative',false)) from part_one_test_state where key='claim1'))$$,
 'A21 successful stage checkpoint survives worker loss');
select throws_ok($$select public.part_one_worker('checkpoint',(select jsonb_build_object('jobId',value->'id','leaseToken',value->'leaseToken',
 'stage','fake-negative','output',jsonb_build_object('status','not_found','parsedNegative',false)) from part_one_test_state where key='claim1'))$$,
 'P0001','PART_ONE_UNPROVEN_NEGATIVE','A22 malformed/error never becomes a negative cache');
update private.part_one_jobs set lease_expires_at=now()-interval '1 second' where id=(select (value->>'id')::uuid from part_one_test_state where key='claim1');
insert into part_one_test_state values('claim2',public.part_one_worker('claim','{}')->'job');
select is((select value->>'id' from part_one_test_state where key='claim1'),(select value->>'id' from part_one_test_state where key='claim2'),
 'A21 expired consumer resumes same job');
select ok((select value->'checkpoints' ? 'completed-stage' from part_one_test_state where key='claim2'),'A21 checkpoint reused after crash');
select is((select jsonb_array_length(value->'unknownReservations') from part_one_test_state where key='claim2'),1,
 'A21 dispatched unknown reservation remains charged after process loss');
select throws_ok($$select public.part_one_worker('checkpoint',(select jsonb_build_object('jobId',value->'id','leaseToken',value->'leaseToken',
 'stage','stale','output',jsonb_build_object('status','found')) from part_one_test_state where key='claim1'))$$,
 'P0001','PART_ONE_STALE_LEASE','expired lease cannot checkpoint');
select is(public.part_one_worker('reserve',(select jsonb_build_object('jobId',value->'id','leaseToken',value->'leaseToken',
 'stage','distinct-stage','provider','derive_catalog') from part_one_test_state where key='claim2'))->>'deferred','true',
 'A20 another stage cannot bypass unknown reservation or atomic quota');

select lives_ok($$select public.part_one_worker('revoke','{"recordId":"e6100000-0000-4000-8000-000000000001","status":"retracted","reason":"synthetic credible contradiction"}')$$,
 'A23 source lifecycle appended separately from original evidence');
select is(private.part_one_record_allowed('e6100000-0000-4000-8000-000000000004',null),false,
 'A23 source retraction invalidates dependent declaration recursively');
select is((select payload->>'rawText' from private.part_one_records where id='e6100000-0000-4000-8000-000000000001'),
 'Water, Glycerin','retraction does not erase original source text');
select lives_ok($$select public.part_one_worker('revoke','{"recordId":"e6100000-0000-4000-8000-000000000002","status":"retracted","reason":"synthetic disagreement"}')$$,
 'A23 usable evidence retracts in current scans');
set local role authenticated;
select set_config('request.jwt.claim.sub','e6000000-0000-4000-8000-000000000001',true);
insert into part_one_test_state values('retracted',public.part_one_operation('scans/read',
 (select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='accepted')));
select is((select value->>'identity' from part_one_test_state where key='retracted'),'exact','A23 retraction retains independently permitted identity');
select is((select value->>'declarationState' from part_one_test_state where key='retracted'),'conflict','A23 readiness can decrease');
select cmp_ok((select (value->>'resultRevision')::int from part_one_test_state where key='retracted'),'>',1,
 'A23 retraction increments revision');
select is((public.part_one_operation('saves/create',(select jsonb_build_object('idempotencyKey','stale-save','scanId',value->'scanId',
 'expectedGeneration',0,'expectedResultRevision',1,'selectedSnapshotId',value->'snapshotId','selectedDeclarationId',value->'declarationId')
 from part_one_test_state where key='accepted')))->>'conflict','true','A23 stale accepted save atomically rejected');
insert into part_one_test_state values('identity-save',public.part_one_operation('saves/create',
 (select jsonb_build_object('idempotencyKey','identity-save-1','scanId',value->'scanId','expectedGeneration',0,'expectedResultRevision',value->'resultRevision',
  'selectedSnapshotId',value->'snapshotId','selectedDeclarationId',null) from part_one_test_state where key='retracted')));
select is((public.part_one_operation('saves/read',(select jsonb_build_object('id',value->'saveId') from part_one_test_state where key='identity-save'))->'result')->>'identity',
 'exact','A28 identity-only save reopens supported identity');
select is((public.part_one_operation('saves/read',(select jsonb_build_object('id',value->'saveId') from part_one_test_state where key='identity-save'))->'result')->>'declarationId',
 null,'A28 identity-only save never silently inherits newer declaration');
select lives_ok($$select public.part_one_operation('saves/delete',(select jsonb_build_object('id',value->'saveId') from part_one_test_state where key='save'))$$,
 'A24 explicit delete tombstones save');
select throws_ok($$select public.part_one_operation('saves/create',(select jsonb_build_object('idempotencyKey','save-1','scanId',value->'scanId',
 'expectedGeneration',0,'expectedResultRevision',1,'selectedSnapshotId',value->'snapshotId','selectedDeclarationId',value->'declarationId')
 from part_one_test_state where key='accepted'))$$,'P0001','PART_ONE_DELETED','A24 offline replay cannot resurrect deleted save');
set local role postgres;
select is(public.begin_customer_account_deletion('e6000000-0000-4000-8000-000000000001'),true,'account deletion fence established');
set local role authenticated;
select throws_ok($$select public.part_one_operation('scans/read',(select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='accepted'))$$,
 '42501','PART_ONE_OWNER_UNAVAILABLE','A24 fenced identity cannot replay private work');
set local role postgres;
delete from auth.users where id='e6000000-0000-4000-8000-000000000001';
select is((select count(*)::int from private.part_one_captures where owner_id='e6000000-0000-4000-8000-000000000001'),0,
 'A25 account erasure removes owner private capture metadata');
select is((select count(*)::int from private.part_one_captures where owner_id='e6000000-0000-4000-8000-000000000002'),1,
 'A25 other owner capture remains unchanged');
-- Poison/expired consumer work is terminal, not a permanent pending spinner.
update private.part_one_jobs set state='running',attempts=max_attempts,lease_token=gen_random_uuid(),
 lease_expires_at=now()-interval '1 second' where id=(select (value->>'jobId')::uuid from part_one_test_state where key='unresolved2');
select lives_ok($$select public.part_one_worker('claim','{}')$$,'A21 poisoned lease recovery produces terminal work');
set local role authenticated;
select set_config('request.jwt.claim.sub','e6000000-0000-4000-8000-000000000002',true);
insert into part_one_test_state values('poison-final',public.part_one_operation('scans/read',
 (select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='unresolved2')));
select is((select value->>'work' from part_one_test_state where key='poison-final'),'failed_final','A21 retries exhaust into terminal status');
select is((select value->>'identity' from part_one_test_state where key='poison-final'),'unresolved','A21 terminal failure never leaves pending identity spinner');
set local role postgres;
-- Real ingress-shaped dependency graph: observation -> declaration ->
-- snapshot, with the snapshot retaining BOTH observation and declaration IDs.
select public.part_one_worker('admit',jsonb_build_object('id','e6400000-0000-4000-8000-000000000001',
 'kind','observation','itemId','e6400000-0000-4000-8000-000000000004','revision',1,'canonicalKey','gtin:00012345678905',
 'policyId','derive_catalog','policyVersion','1','scope','public','dependencies',jsonb_build_array(),'supersedesId',null,
 'observedAt',now(),'expiresAt',now()+interval '1 day',
 'payload',jsonb_build_object('provider','synthetic-local-ingress','comparison','exact','rawText','Water, Glycerin',
   'payload',jsonb_build_object('name','Independent Identity Lotion','nativeCode','012345678905','canonicalCode','00012345678905','rawIngredients','Water, Glycerin'))));
select public.part_one_worker('admit',jsonb_build_object('id','e6400000-0000-4000-8000-000000000002',
 'kind','declaration','itemId','e6400000-0000-4000-8000-000000000004','revision',1,'canonicalKey','gtin:00012345678905',
 'policyId','derive_catalog','policyVersion','1','scope','public','dependencies',jsonb_build_array('e6400000-0000-4000-8000-000000000001'),
 'supersedesId',null,'observedAt',now(),'expiresAt',now()+interval '1 day',
 'payload',jsonb_build_object('state','accepted','rawText','Water, Glycerin',
   'predicate','{"association":{"passed":true},"noContradiction":{"passed":true},"variantMarket":{"passed":true},"completeness":{"passed":true},"rightsFreshness":{"passed":true}}'::jsonb,
   'sections',jsonb_build_array(jsonb_build_object('text','Water, Glycerin')),
   'sources',jsonb_build_array(jsonb_build_object('label','Synthetic local ingress')))));
select public.part_one_worker('admit',jsonb_build_object('id','e6400000-0000-4000-8000-000000000003',
 'kind','snapshot','itemId','e6400000-0000-4000-8000-000000000004','revision',1,'canonicalKey','gtin:00012345678905',
 'policyId','derive_catalog','policyVersion','1','scope','public',
 'dependencies',jsonb_build_array('e6400000-0000-4000-8000-000000000001','e6400000-0000-4000-8000-000000000002'),
 'supersedesId',null,'observedAt',now(),'expiresAt',now()+interval '1 day',
 'payload',jsonb_build_object('name','Independent Identity Lotion','brand','Fixture','variantText','100 ml','image',null,
   'declarationIds',jsonb_build_array('e6400000-0000-4000-8000-000000000002'),'requestedMarket',null,
   'fieldEvidence',jsonb_build_object('name',jsonb_build_array('e6400000-0000-4000-8000-000000000001'),
     'brand',jsonb_build_array('e6400000-0000-4000-8000-000000000001')),
   'barcodeAssertions',jsonb_build_array(jsonb_build_object('evidenceId','e6400000-0000-4000-8000-000000000001')))));
set local role authenticated;
select set_config('request.jwt.claim.sub','e6000000-0000-4000-8000-000000000002',true);
insert into part_one_test_state values('ingress',public.part_one_operation('scans/create',
 '{"idempotencyKey":"ingress-1","canonicalKey":null,"reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e6300000-0000-4000-8000-000000000012","clientScanId":"e6300000-0000-4000-8000-000000000013","idempotencyKey":"ingress-1","generation":0,"code":{"raw":"012345678905","symbology":"upca","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
select is((select value->>'declarationState' from part_one_test_state where key='ingress'),'accepted','A23 actual ingress dependency graph initially has accepted ingredients');
insert into part_one_test_state values('ingress-save',public.part_one_operation('saves/create',
 (select jsonb_build_object('idempotencyKey','ingress-save-1','scanId',value->'scanId','expectedGeneration',0,'expectedResultRevision',value->'resultRevision',
  'selectedSnapshotId',value->'snapshotId','selectedDeclarationId',value->'declarationId') from part_one_test_state where key='ingress')));
set local role postgres;
select public.part_one_worker('revoke','{"recordId":"e6400000-0000-4000-8000-000000000002","status":"retracted","reason":"Synthetic declaration-only conflict"}');
select is(private.part_one_record_allowed('e6400000-0000-4000-8000-000000000003',null),false,
 'A23 whole snapshot readiness still depends on retracted declaration');
select is(private.part_one_snapshot_identity_allowed('e6400000-0000-4000-8000-000000000003',null),true,
 'A23 independently permitted identity projection survives declaration-only retraction');
select is((select cardinality(dependencies) from private.part_one_records where id='e6400000-0000-4000-8000-000000000003'),2,
 'A23 full immutable provenance dependencies are retained');
set local role authenticated;
insert into part_one_test_state values('ingress-retracted',public.part_one_operation('scans/read',
 (select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='ingress')));
select is((select value->>'identity' from part_one_test_state where key='ingress-retracted'),'exact','A23 ingress retraction retains exact identity');
select is((select value->'display'->'selectedIdentity'->>'name' from part_one_test_state where key='ingress-retracted'),
 'Independent Identity Lotion','A23 ingress identity name remains attributable');
select is((select value->>'declarationId' from part_one_test_state where key='ingress-retracted'),null,'A23 retracted declaration selection purged');
select is((select jsonb_array_length(value->'display'->'sections') from part_one_test_state where key='ingress-retracted'),0,'A23 ingredient display purged');
select is((select jsonb_array_length(value->'display'->'sources') from part_one_test_state where key='ingress-retracted'),0,'A23 ingredient source display purged');
select is((public.part_one_operation('saves/read',(select jsonb_build_object('id',value->'saveId') from part_one_test_state where key='ingress-save'))->'result')->>'identity',
 'exact','A28 saved ingress snapshot keeps independently permitted identity');
insert into part_one_test_state values('ingress-identity-save',public.part_one_operation('saves/create',
 (select jsonb_build_object('idempotencyKey','ingress-identity-save-1','scanId',value->'scanId','expectedGeneration',0,'expectedResultRevision',value->'resultRevision',
  'selectedSnapshotId',value->'snapshotId','selectedDeclarationId',null) from part_one_test_state where key='ingress-retracted')));
select ok((select value ? 'saveId' from part_one_test_state where key='ingress-identity-save'),
 'A28 identity-only save remains supported after dependent declaration retraction');
set local role postgres;
-- Reconstruct a previously accepted cached projection whose declaration has
-- expired while its independent identity observation/snapshot are still valid.
insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,dependencies,observed_at,expires_at)
 select 'e6400000-0000-4000-8000-000000000005','declaration',item_id,2,canonical_key,policy_id,policy_version,payload,dependencies,
   now()-interval '2 days',now()-interval '1 day' from private.part_one_records where id='e6400000-0000-4000-8000-000000000002';
insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,dependencies,observed_at,expires_at)
 select 'e6400000-0000-4000-8000-000000000006','snapshot',item_id,2,canonical_key,policy_id,policy_version,
   payload || jsonb_build_object('declarationIds',jsonb_build_array('e6400000-0000-4000-8000-000000000005')),
   array['e6400000-0000-4000-8000-000000000001'::uuid,'e6400000-0000-4000-8000-000000000005'::uuid],observed_at,expires_at
 from private.part_one_records where id='e6400000-0000-4000-8000-000000000003';
insert into part_one_test_state values('ingress-expired',private.part_one_filter_result(
 (select value || jsonb_build_object('snapshotId','e6400000-0000-4000-8000-000000000006',
   'declarationId','e6400000-0000-4000-8000-000000000005') from part_one_test_state where key='ingress'),
 'e6000000-0000-4000-8000-000000000002'));
select is(private.part_one_record_allowed('e6400000-0000-4000-8000-000000000006',null),false,
 'A26 expired declaration blocks whole snapshot readiness');
select is((select value->>'identity' from part_one_test_state where key='ingress-expired'),'exact',
 'A26 independent permitted identity survives declaration expiry');
select is((select value->>'declarationId' from part_one_test_state where key='ingress-expired'),null,
 'A26 expired declaration selection is purged');
select is((select jsonb_array_length(value->'display'->'sections') from part_one_test_state where key='ingress-expired'),0,
 'A26 expired declaration text cannot remain on screen');
select public.part_one_worker('revoke','{"recordId":"e6400000-0000-4000-8000-000000000001","status":"retracted","reason":"Synthetic identity observation conflict"}');
select is(private.part_one_snapshot_identity_allowed('e6400000-0000-4000-8000-000000000003',null),false,
 'A23 actual identity-source retraction still removes identity');
set local role authenticated;
select is((public.part_one_operation('scans/read',(select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='ingress'))->'display')->'selectedIdentity',
 'null'::jsonb,'A23 invalid identity observation cannot remain visible');
set local role postgres;
select * from finish();
rollback;
