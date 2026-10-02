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
select has_table('private','part_one_upload_tickets','private upload dispatch has durable opaque tickets');
select has_table('private','part_one_private_cleanup','private bytes removal has durable version-fenced outbox');
select has_table('private','part_one_review_authorities','review authorities are independently registered');
select is((select count(*)::integer from private.part_one_review_authorities where enabled),0,'no private review authority is enabled by migration');
select ok(not has_function_privilege('authenticated','public.part_one_private_service(text,jsonb)','execute') and not has_function_privilege('anon','public.part_one_private_service(text,jsonb)','execute'),'private upload attestation/review/cleanup RPC is service only');
select ok(not has_table_privilege('authenticated','private.part_one_upload_tickets','select') and not has_table_privilege('authenticated','private.part_one_review_authorities','insert'),'customer cannot hydrate upload tickets or register authority');
select ok(not private.part_one_private_enabled(true),'private capability disabled with no retention approval or consumer');
select throws_ok($$select public.part_one_private_service('review/prepare','{}')$$,'P0001','PART_ONE_PRIVATE_RETENTION_DISABLED','default review cannot persist or accept private evidence');
select is(private.part_one_js_slice('A😀B',1,3),'😀','trusted source proof slices use JS UTF16 units');
select is(private.part_one_js_slice('A😀B',2,3),null,'trusted source proof cannot split an astral code point');
select is(private.part_one_canonical_json('{"z":1.00,"a":[0.10,true,null,"é"]}'),'{"a":[0.1,true,null,"é"],"z":1}','private observation canonical hash uses stable sorted keys/numeric values');


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
   'sections',jsonb_build_array(jsonb_build_object('text','Water, Glycerin','evidenceIds',jsonb_build_array('e6400000-0000-4000-8000-000000000001'),'expiresAt',now()+interval '1 day')),
   'sources',jsonb_build_array(jsonb_build_object('label','Synthetic local ingress','observationId','e6400000-0000-4000-8000-000000000001','expiresAt',now()+interval '1 day')))));
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
select is(public.part_one_worker('admit',(select jsonb_build_object('id',r.id,'kind',r.kind,'itemId',r.item_id,
 'revision',r.revision,'canonicalKey',r.canonical_key,'policyId',r.policy_id,'policyVersion',r.policy_version,'scope',r.scope,
 'dependencies',to_jsonb(r.dependencies),'supersedesId',r.supersedes_id,'observedAt',r.observed_at,'expiresAt',r.expires_at,'payload',r.payload)
 from private.part_one_records r where r.id='e6400000-0000-4000-8000-000000000001'))->>'replay','true',
 'A21 crash-after-admission exact payload replay is idempotent');
select throws_ok($$select public.part_one_worker('admit',(select jsonb_build_object('id',r.id,'kind',r.kind,'itemId',r.item_id,
 'revision',r.revision,'canonicalKey',r.canonical_key,'policyId',r.policy_id,'policyVersion',r.policy_version,'scope',r.scope,
 'dependencies',to_jsonb(r.dependencies),'supersedesId',r.supersedes_id,'observedAt',r.observed_at,'expiresAt',r.expires_at,'payload',r.payload || '{"changed":true}')
 from private.part_one_records r where r.id='e6400000-0000-4000-8000-000000000001'))$$,
 'P0001','PART_ONE_ADMISSION_REPLAY_CONFLICT','A21 same immutable ID cannot replay contradictory payload');
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
-- Namespace regression: the native representation cannot bypass restricted use.
select is(private.part_one_code_key(jsonb_build_object('raw',raw,'symbology',sym,'namespace','gtin','retailerId',null)),null,
 'A02 restricted representation stays unsupported: ' || raw)
from (values ('200000000004','upca'),('0200000000004','ean13'),('00200000000004','gtin14'),
 ('400000000008','upca'),('0400000000008','ean13'),('00400000000008','gtin14'),
 ('2000000000008','ean13'),('02000000000008','gtin14'),('2900000000001','ean13'),('02900000000001','gtin14')) reps(raw,sym);
select is(private.part_one_code_key('{"raw":"305210416383","symbology":"ean13","namespace":"gtin","retailerId":null}'),
 'gtin:00305210416383','A01 bounded iOS EAN-labeled twelve-digit UPC accepted');
select is(private.part_one_code_key('{"raw":"12345670","symbology":"ean13","namespace":"gtin","retailerId":null}'),
 null,'A02 arbitrary EAN-labeled lengths remain unsupported');
select is(private.part_one_code_key(jsonb_build_object('raw',raw,'symbology','itf14','namespace','gtin','retailerId',null)),
 'gtin:'||raw,'A02 genuine packaging GTIN remains distinct: '||raw)
from (values ('10012345000017'),('20012345000014'),('20305210416387'),('40305210416381')) reps(raw);
set local role authenticated;
select set_config('request.jwt.claim.sub','e6000000-0000-4000-8000-000000000002',true);
insert into part_one_test_state
select 'restricted-'||raw,public.part_one_operation('scans/create',jsonb_build_object('idempotencyKey','restricted-'||raw,
 'canonicalKey','gtin:CLIENT-CANNOT-OVERRIDE','reasonCodes',jsonb_build_array(),'request',jsonb_build_object(
 'schemaVersion',1,'requestId','e6300000-0000-4000-8000-000000000020','clientScanId','e6300000-0000-4000-8000-000000000021',
 'idempotencyKey','restricted-'||raw,'generation',0,'code',jsonb_build_object('raw',raw,'symbology',sym,'namespace','gtin','retailerId',null),
 'requestedMarket',null,'categoryHint',null)))
from (values ('200000000004','upca'),('0200000000004','ean13'),('00200000000004','gtin14'),
 ('400000000008','upca'),('0400000000008','ean13'),('00400000000008','gtin14')) reps(raw,sym);
select ok(value->>'jobId' is null and value->>'identity'='unresolved' and value->>'work'='complete',
 'A02 restricted direct RPC creates no public work: '||key) from part_one_test_state where key like 'restricted-%';
set local role postgres;

-- Candidate projections retain no selected snapshot ID. Their own identity and
-- image provenance therefore must be revalidated separately on every read.
insert into private.part_one_policies(id,version,retain_allowed,display_allowed,permission_evidence)
 values('candidate_fixture','1',true,true,'Rollback-only synthetic fixture policy');
insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,dependencies,observed_at,expires_at) values
 ('e6700000-0000-4000-8000-000000000001','observation',null,1,null,'derive_catalog','1','{}','{}',now(),now()+interval '1 day'),
 ('e6700000-0000-4000-8000-000000000002','observation',null,1,null,'candidate_fixture','1','{}','{}',now(),now()+interval '1 day'),
 ('e6700000-0000-4000-8000-000000000003','observation',null,1,null,'derive_catalog','1','{}','{}',now(),now()+interval '1 day'),
 ('e6700000-0000-4000-8000-000000000004','snapshot','e6700000-0000-4000-8000-000000000006',1,'gtin:00036000291452','derive_catalog','1',
 jsonb_build_object('name','Candidate A','brand','Fixture','variantText','100 ml','requestedMarket',null,'declarationIds',jsonb_build_array(),
  'fieldEvidence',jsonb_build_object('name',jsonb_build_array('e6700000-0000-4000-8000-000000000001')),
  'image',jsonb_build_object('url','https://fixtures.invalid/a.png','policyId','e6700000-0000-4000-8000-000000000099',
    'evidenceId','e6700000-0000-4000-8000-000000000003','sourceRevision',1,'observedAt',now(),'expiresAt',now()+interval '1 day')),
 array['e6700000-0000-4000-8000-000000000001'::uuid,'e6700000-0000-4000-8000-000000000003'::uuid],now(),now()+interval '1 day'),
 ('e6700000-0000-4000-8000-000000000005','snapshot','e6700000-0000-4000-8000-000000000007',1,'gtin:00036000291452','candidate_fixture','1',
 '{"name":"Candidate B","brand":"Fixture","variantText":"200 ml","image":null,"requestedMarket":null,"declarationIds":[],"fieldEvidence":{"name":["e6700000-0000-4000-8000-000000000002"]}}',
 array['e6700000-0000-4000-8000-000000000002'::uuid],now(),now()+interval '1 day');
set local role authenticated;
insert into part_one_test_state values('ambiguous',public.part_one_operation('scans/create',
 '{"idempotencyKey":"ambiguous-1","reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e6300000-0000-4000-8000-000000000022","clientScanId":"e6300000-0000-4000-8000-000000000023","idempotencyKey":"ambiguous-1","generation":0,"code":{"raw":"036000291452","symbology":"upca","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
select is((select jsonb_array_length(value->'display'->'candidates') from part_one_test_state where key='ambiguous'),2,'A26 both permitted candidates initially render');
set local role postgres;
insert into part_one_test_state values('bound-selection',public.part_one_operation('scans/create',
 '{"idempotencyKey":"bound-selection","reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e6300000-0000-4000-8000-000000000034","clientScanId":"e6300000-0000-4000-8000-000000000035","idempotencyKey":"bound-selection","generation":0,"code":{"raw":"036000291452","symbology":"upca","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
set local role postgres;
insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,dependencies,observed_at,expires_at)
 select 'e6700000-0000-4000-8000-000000000008',kind,item_id,2,canonical_key,policy_id,policy_version,
   payload || '{"name":"Unseen revised Candidate A","variantText":"Different unseen formula"}'::jsonb,dependencies,observed_at,expires_at
 from private.part_one_records where id='e6700000-0000-4000-8000-000000000004';
set local role authenticated;
select is(public.part_one_operation('selection',(select jsonb_build_object('scanId',value->'scanId','candidateId','e6700000-0000-4000-8000-000000000006',
 'expectedGeneration',0,'expectedResultRevision',value->'resultRevision') from part_one_test_state where key='bound-selection'))->>'snapshotId',
 'e6700000-0000-4000-8000-000000000004','A19 selection binds displayed snapshot rather than unseen latest same-item revision');
set local role postgres;

set local role authenticated;
insert into part_one_test_state values('candidate-selection-source',public.part_one_operation('scans/create',
 '{"idempotencyKey":"candidate-selection-source","reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e6300000-0000-4000-8000-000000000036","clientScanId":"e6300000-0000-4000-8000-000000000037","idempotencyKey":"candidate-selection-source","generation":0,"code":{"raw":"036000291452","symbology":"upca","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
set local role postgres;
select public.part_one_worker('revoke','{"recordId":"e6700000-0000-4000-8000-000000000003","status":"revoked","reason":"Synthetic image permission revoked"}');
set local role authenticated;
insert into part_one_test_state values('candidate-image-revoked',public.part_one_operation('scans/read',
 (select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='ambiguous')));
select is((select c->'image' from part_one_test_state,jsonb_array_elements(value->'display'->'candidates') c
 where key='candidate-image-revoked' and c->>'name'='Candidate A'),'null'::jsonb,'A26 candidate image revocation purges image independently');
select is((select jsonb_array_length(value->'display'->'candidates') from part_one_test_state where key='candidate-image-revoked'),2,
 'A26 image revocation keeps independently permitted candidate identity');
-- Selection rebuilds an identity from immutable source payload, so it must
-- filter current image rights before returning or storing that reconstruction.
insert into part_one_test_state values('candidate-selection-read',public.part_one_operation('scans/read',
 (select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='candidate-selection-source')));
insert into part_one_test_state values('candidate-selection-result',public.part_one_operation('selection',
 (select jsonb_build_object('scanId',value->'scanId','candidateId','e6700000-0000-4000-8000-000000000006',
 'expectedGeneration',value->'generation','expectedResultRevision',value->'resultRevision') from part_one_test_state where key='candidate-selection-read')));
select is((select value->'display'->'selectedIdentity'->'image' from part_one_test_state where key='candidate-selection-result'),
 'null'::jsonb,'A26 revoke then read then select cannot restore immutable revoked image URL');
select is((select value->>'itemId' from part_one_test_state where key='candidate-selection-result'),
 'e6700000-0000-4000-8000-000000000006','A26 image revocation preserves selected independently permitted identity');
set local role postgres;
select is((select result->'display'->'selectedIdentity'->'image' from private.part_one_scans where id=(select (value->>'scanId')::uuid from part_one_test_state where key='candidate-selection-result')),
 'null'::jsonb,'A26 selection persists only currently permitted image projection');
set local role authenticated;
set local role postgres;
select public.part_one_worker('revoke_policy','{"policyId":"candidate_fixture"}');
set local role authenticated;
insert into part_one_test_state values('candidate-policy-revoked',public.part_one_operation('scans/read',
 (select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='ambiguous')));
select is((select jsonb_array_length(value->'display'->'candidates') from part_one_test_state where key='candidate-policy-revoked'),1,
 'A26 revoked candidate policy removes only affected candidate');
select is((select value->'display'->'candidates'->0->>'name' from part_one_test_state where key='candidate-policy-revoked'),
 'Candidate A','A26 independently permitted other candidate survives');
select is((select jsonb_array_length(value->'candidateIds') from part_one_test_state where key='candidate-policy-revoked'),1,
 'A26 revoked candidate action binding removed too');
set local role postgres;

-- Late joins: A claims the shared job, then B joins the still-running ledger.
-- Terminal publication must include B rather than only claim-time targets.
update private.part_one_jobs set state='cancelled',lease_token=null,lease_expires_at=null
 where state in ('queued','running','retry_wait','deferred_budget');
set local role authenticated;
insert into part_one_test_state values('late-a',public.part_one_operation('scans/create',
 '{"idempotencyKey":"late-a","reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e6300000-0000-4000-8000-000000000024","clientScanId":"e6300000-0000-4000-8000-000000000025","idempotencyKey":"late-a","generation":0,"code":{"raw":"500000000005","symbology":"upca","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
set local role postgres;
insert into part_one_test_state values('late-claim',public.part_one_worker('claim','{}')->'job');
set local role authenticated;
insert into part_one_test_state values('late-b',public.part_one_operation('scans/create',
 '{"idempotencyKey":"late-b","reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e6300000-0000-4000-8000-000000000026","clientScanId":"e6300000-0000-4000-8000-000000000027","idempotencyKey":"late-b","generation":0,"code":{"raw":"500000000005","symbology":"upca","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
select is((select value->>'jobId' from part_one_test_state where key='late-a'),(select value->>'jobId' from part_one_test_state where key='late-b'),
 'A21 B joins the actual running job');
set local role postgres;
select public.part_one_worker('finish',(select jsonb_build_object('jobId',value->'id','leaseToken',value->'leaseToken',
 'expectedPublishRevision',value->'publishRevision','targets',value->'targets','resultPatch',jsonb_build_object('reasonCodes',jsonb_build_array('source_blocked')))
 from part_one_test_state where key='late-claim'));
set local role authenticated;
insert into part_one_test_state values('late-b-finished',public.part_one_operation('scans/read',
 (select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='late-b')));
select is((select value->>'work' from part_one_test_state where key='late-b-finished'),'complete','A21 late join sees terminal work');
select is((select value->>'identity' from part_one_test_state where key='late-b-finished'),'unresolved','A21 late join receives terminal result instead of pending spinner');
select is((select value->'reasonCodes' from part_one_test_state where key='late-b-finished'),'["source_blocked"]'::jsonb,
 'A21 late join receives actual terminal reason');
set local role postgres;

-- Governor: the final retry claim waits for quota; a wait is not a provider call.
insert into private.part_one_jobs(id,coalescing_key,input,policy_version,state,attempts,max_attempts)
 values('e6800000-0000-4000-8000-000000000001','synthetic-final-budget','{}','part-one-1','queued',3,4);
update private.part_one_budgets set reset_at=now()+interval '1 hour' where provider='derive_catalog';
insert into part_one_test_state values('budget-final-claim',public.part_one_worker('claim','{}')->'job');
select is((select value->>'id' from part_one_test_state where key='budget-final-claim'),'e6800000-0000-4000-8000-000000000001','A20 final eligible attempt claimed');
select is(public.part_one_worker('reserve',(select jsonb_build_object('jobId',value->'id','leaseToken',value->'leaseToken',
 'stage','final-budget-stage','provider','derive_catalog') from part_one_test_state where key='budget-final-claim'))->>'deferred','true',
 'A20 final attempt visibly waits for quota');
update private.part_one_budgets set reset_at=null where provider='derive_catalog';
update private.part_one_reservations set state='settled',reserved_at=now()-interval '2 minutes' where provider='derive_catalog';
update private.part_one_jobs set next_eligible_at=now() where id='e6800000-0000-4000-8000-000000000001';
insert into part_one_test_state values('budget-after-reset',public.part_one_worker('claim','{}')->'job');
select is((select value->>'id' from part_one_test_state where key='budget-after-reset'),'e6800000-0000-4000-8000-000000000001',
 'A20 budget reset permits same final-attempt job to resume');
-- Display deadlines are narrower than independently valid identity rights.
insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,dependencies,observed_at,expires_at) values
 ('e6900000-0000-4000-8000-000000000001','observation',null,1,null,'derive_catalog','1','{}','{}',now(),now()+interval '1 day'),
 ('e6900000-0000-4000-8000-000000000003','observation',null,1,null,'derive_catalog','1','{}','{}',now(),now()+interval '1 day'),
 ('e6900000-0000-4000-8000-000000000002','declaration','e6900000-0000-4000-8000-000000000005',1,null,'derive_catalog','1',
 jsonb_build_object('state','accepted','predicate','{"association":{"passed":true},"noContradiction":{"passed":true},"variantMarket":{"passed":true},"completeness":{"passed":true},"rightsFreshness":{"passed":true}}'::jsonb,
  'sections',jsonb_build_array(jsonb_build_object('text','Water','evidenceIds',jsonb_build_array('e6900000-0000-4000-8000-000000000001'),'expiresAt',now()+interval '3 hours')),
  'sources',jsonb_build_array(jsonb_build_object('label','Live permitted fixture','observationId','e6900000-0000-4000-8000-000000000001','expiresAt',now()+interval '3 hours'))),
 array['e6900000-0000-4000-8000-000000000001'::uuid],now(),now()+interval '2 hours'),
 ('e6900000-0000-4000-8000-000000000004','snapshot','e6900000-0000-4000-8000-000000000005',1,'gtin:00600000000002','derive_catalog','1',
 jsonb_build_object('name','Deadline Lotion','brand','Fixture','variantText','100 ml','requestedMarket',null,
  'fieldEvidence',jsonb_build_object('name',jsonb_build_array('e6900000-0000-4000-8000-000000000001')),
  'declarationIds',jsonb_build_array('e6900000-0000-4000-8000-000000000002'),
  'image',jsonb_build_object('url','https://fixtures.invalid/expired.png','policyId','e6900000-0000-4000-8000-000000000099',
    'evidenceId','e6900000-0000-4000-8000-000000000003','observedAt',now()-interval '1 hour','expiresAt',now()-interval '1 second','sourceRevision',1)),
 array['e6900000-0000-4000-8000-000000000001'::uuid,'e6900000-0000-4000-8000-000000000002'::uuid,'e6900000-0000-4000-8000-000000000003'::uuid],now(),now()+interval '1 day');
set local role authenticated;
insert into part_one_test_state values('narrow-deadline',public.part_one_operation('scans/create',
 '{"idempotencyKey":"narrow-deadline","reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e6300000-0000-4000-8000-000000000028","clientScanId":"e6300000-0000-4000-8000-000000000029","idempotencyKey":"narrow-deadline","generation":0,"code":{"raw":"600000000002","symbology":"upca","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
select is((select (value->'freshness'->>'expiresAt')::timestamptz from part_one_test_state where key='narrow-deadline'),now()+interval '2 hours',
 'A26 initial readiness deadline includes shorter declaration validity');
select is((select value->'display'->'selectedIdentity'->'image' from part_one_test_state where key='narrow-deadline'),'null'::jsonb,
 'A26 expired optional selected image is purged immediately');
select is((select value->>'declarationState' from part_one_test_state where key='narrow-deadline'),'accepted',
 'A26 expired optional image does not retract otherwise usable declaration');
select is((select (value->'display'->'selectedIdentity'->>'expiresAt')::timestamptz from part_one_test_state where key='narrow-deadline'),now()+interval '1 day',
 'A26 independent identity deadline is not shortened to ingredient deadline');
set local role postgres;
insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,dependencies,observed_at,expires_at) values
 ('e6910000-0000-4000-8000-000000000001','observation',null,1,null,'derive_catalog','1','{}','{}',now(),now()+interval '1 day'),
 ('e6910000-0000-4000-8000-000000000002','declaration','e6910000-0000-4000-8000-000000000004',1,null,'derive_catalog','1',
 jsonb_build_object('state','partial','predicate','{"association":{"passed":true},"noContradiction":{"passed":true},"variantMarket":{"passed":true},"completeness":{"passed":false},"rightsFreshness":{"passed":true}}'::jsonb,
  'sections',jsonb_build_array(
   jsonb_build_object('text','Still readable Water','evidenceIds',jsonb_build_array('e6910000-0000-4000-8000-000000000001'),'expiresAt',now()+interval '1 hour'),
   jsonb_build_object('text','Expired tail Glycerin','evidenceIds',jsonb_build_array('e6910000-0000-4000-8000-000000000001'),'expiresAt',now()-interval '1 second')),
  'sources',jsonb_build_array(
   jsonb_build_object('label','Permitted source','observationId','e6910000-0000-4000-8000-000000000001','expiresAt',now()+interval '1 hour'),
   jsonb_build_object('label','Expired source','observationId','e6910000-0000-4000-8000-000000000001','expiresAt',now()-interval '1 second'))),
 array['e6910000-0000-4000-8000-000000000001'::uuid],now(),now()+interval '2 hours'),
 ('e6910000-0000-4000-8000-000000000003','snapshot','e6910000-0000-4000-8000-000000000004',1,'gtin:00700000000009','derive_catalog','1',
 '{"name":"Partial Deadline Lotion","brand":"Fixture","variantText":"100 ml","requestedMarket":null,"image":null,"fieldEvidence":{"name":["e6910000-0000-4000-8000-000000000001"]},"declarationIds":["e6910000-0000-4000-8000-000000000002"]}',
 array['e6910000-0000-4000-8000-000000000001'::uuid,'e6910000-0000-4000-8000-000000000002'::uuid],now(),now()+interval '1 day');
set local role authenticated;
insert into part_one_test_state values('partial-deadline',public.part_one_operation('scans/create',
 '{"idempotencyKey":"partial-deadline","reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e6300000-0000-4000-8000-000000000030","clientScanId":"e6300000-0000-4000-8000-000000000031","idempotencyKey":"partial-deadline","generation":0,"code":{"raw":"700000000009","symbology":"upca","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
select is((select jsonb_array_length(value->'display'->'sections') from part_one_test_state where key='partial-deadline'),1,
 'A26 partial expired section is purged independently');
select is((select value->'display'->'sections'->0->>'text' from part_one_test_state where key='partial-deadline'),'Still readable Water',
 'A26 partial permitted section survives');
select is((select jsonb_array_length(value->'display'->'sources') from part_one_test_state where key='partial-deadline'),1,
 'A26 partial expired source is purged independently');
select is((select value->>'identity' from part_one_test_state where key='partial-deadline'),'exact','A26 partial expiry retains independently permitted identity');
select is((select value->>'declarationState' from part_one_test_state where key='partial-deadline'),'partial','A26 partial expiry cannot become complete');
select is((select value->'freshness'->>'state' from part_one_test_state where key='partial-deadline'),'expired','A26 partial expiration updates readiness freshness');
set local role postgres;
-- Actual owner-private transactions under a SYNTHETIC local-only grant. No
-- upload or real camera bytes are involved; these are Storage identity fixtures.
select is((select enabled from private.part_one_private_config where id=true),false,'private destination/retention disabled by default');
select ok(not has_table_privilege('authenticated','private.part_one_asset_attestations','insert')
 and not has_table_privilege('authenticated','private.part_one_capture_commits','select')
 and not has_table_privilege('authenticated','private.part_one_private_cleanup','select'),'A24 private receipt/config/outbox tables server-only');
insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
 ('e7100000-0000-4000-8000-000000000001',null,true,'{}'),('e7100000-0000-4000-8000-000000000002',null,true,'{}');
insert into private.part_one_records(id,kind,item_id,revision,canonical_key,policy_id,policy_version,payload,observed_at,expires_at)
 values('e7100000-0000-4000-8000-000000000003','snapshot','e7100000-0000-4000-8000-000000000004',1,'gtin:00800000000006','derive_catalog','1',
 '{"name":"Private fixture product","brand":"Synthetic","variantText":"100 ml","image":null,"declarationIds":[],"requestedMarket":null,"sourceMarkets":[],"packageMarket":null}',now(),now()+interval '1 day');
set local role authenticated;
select set_config('request.jwt.claim.sub','e7100000-0000-4000-8000-000000000001',true);
insert into part_one_test_state values('private-a',public.part_one_operation('scans/create',
 '{"idempotencyKey":"private-a","reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e7100000-0000-4000-8000-000000000005","clientScanId":"e7100000-0000-4000-8000-000000000006","idempotencyKey":"private-a","generation":0,"code":{"raw":"800000000006","symbology":"upca","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
insert into part_one_test_state values('private-capture-a',public.part_one_operation('captures/create',
 (select jsonb_build_object('scanId',value->'scanId','expectedGeneration',0,'expectedResultRevision',value->'resultRevision') from part_one_test_state where key='private-a')));
select is(public.part_one_operation('captures/read',(select jsonb_build_object('id',value->'captureSessionId') from part_one_test_state where key='private-capture-a')),
 (select value from part_one_test_state where key='private-capture-a'),'A25 owner capture read retains exact typed binding');
select set_config('request.jwt.claim.sub','e7100000-0000-4000-8000-000000000002',true);
insert into part_one_test_state values('private-b',public.part_one_operation('scans/create',
 '{"idempotencyKey":"private-b","reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e7100000-0000-4000-8000-000000000007","clientScanId":"e7100000-0000-4000-8000-000000000008","idempotencyKey":"private-b","generation":0,"code":{"raw":"800000000006","symbology":"upca","namespace":"gtin","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
insert into part_one_test_state values('private-capture-b',public.part_one_operation('captures/create',
 (select jsonb_build_object('scanId',value->'scanId','expectedGeneration',0,'expectedResultRevision',value->'resultRevision') from part_one_test_state where key='private-b')));
select throws_ok($$select public.part_one_operation('captures/read',(select jsonb_build_object('id',value->'captureSessionId') from part_one_test_state where key='private-capture-a'))$$,
 '42501','PART_ONE_NOT_FOUND','A24 foreign capture read denied');
set local role postgres;
insert into storage.buckets(id,name,public) values('part-one-private-fixture','part-one-private-fixture',false);
update private.part_one_policies set version='synthetic-private-1',retain_allowed=true,display_allowed=true,
 permission_evidence='Synthetic private transaction fixture only',expires_at=now()+interval '1 hour' where id='private_capture';
update private.part_one_private_config set enabled=true,policy_version='synthetic-private-1',process_allowed=true,ocr_allowed=true,
 upload_allowed=true,private_display_allowed=true,bucket_id='part-one-private-fixture',retention_seconds=3600,
 deletion_deadline_seconds=60,approval_evidence='Synthetic transaction fixture; NOT retention or upload approval',expires_at=now()+interval '1 hour';
insert into storage.objects(id,bucket_id,name,owner,owner_id,version) values
 ('e7200000-0000-4000-8000-000000000001','part-one-private-fixture','owner-a/synthetic-sanitized.png','e7100000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000001','synthetic-version-1'),
 ('e7200000-0000-4000-8000-000000000002','part-one-private-fixture','owner-b/synthetic-sanitized.png','e7100000-0000-4000-8000-000000000002','e7100000-0000-4000-8000-000000000002','synthetic-version-1'),
 ('e7200000-0000-4000-8000-000000000003','part-one-private-fixture','owner-b/unattested.png','e7100000-0000-4000-8000-000000000002','e7100000-0000-4000-8000-000000000002','synthetic-version-1');
insert into private.part_one_asset_attestations(id,owner_id,capture_id,package_observation_id,generation,deletion_epoch,storage_object_id,object_version,
 content_hash,width,height,sanitizer_version,verification_evidence,metadata_stripped,observed_at,expires_at)
 select 'e7200000-0000-4000-8000-000000000004','e7100000-0000-4000-8000-000000000001',(value->>'captureSessionId')::uuid,
 (value->>'packageObservationId')::uuid,0,0,'e7200000-0000-4000-8000-000000000001','synthetic-version-1','fixture-hash-a',400,300,
 'synthetic-sanitizer-1','Synthetic metadata proof; optical sanitation NOT tested',true,now(),now()+interval '1 hour'
 from part_one_test_state where key='private-capture-a';
insert into private.part_one_asset_attestations(id,owner_id,capture_id,package_observation_id,generation,deletion_epoch,storage_object_id,object_version,
 content_hash,width,height,sanitizer_version,verification_evidence,metadata_stripped,observed_at,expires_at)
 select 'e7200000-0000-4000-8000-000000000005','e7100000-0000-4000-8000-000000000002',(value->>'captureSessionId')::uuid,
 (value->>'packageObservationId')::uuid,0,0,'e7200000-0000-4000-8000-000000000002','synthetic-version-1','fixture-hash-b',400,300,
 'synthetic-sanitizer-1','Synthetic metadata proof; optical sanitation NOT tested',true,now(),now()+interval '1 hour'
 from part_one_test_state where key='private-capture-b';
insert into part_one_test_state values('private-request-a',(select jsonb_build_object('captureSessionId',value->'captureSessionId',
 'idempotencyKey','private-commit-a','expectedGeneration',0,'expectedResultRevision',1,'expectedCaptureRevision',0,'expectedDeletionEpoch',0,
 'packageObservationId',value->'packageObservationId','assets',jsonb_build_array(jsonb_build_object('evidenceId','e7200000-0000-4000-8000-000000000006',
 'storageObjectId','e7200000-0000-4000-8000-000000000001','contentHash','fixture-hash-a','width',400,'height',300,'metadataStripped',true)),
 'observations',jsonb_build_array(jsonb_build_object('evidenceId','e7200000-0000-4000-8000-000000000007','captureSessionId',value->'captureSessionId',
 'generation',0,'recognizer','Apple Vision synthetic','recognizerVersion','fixture-1','languageConfig',jsonb_build_array('en'),'correctionEnabled',false,
 'sourceWidth',400,'sourceHeight',300,'orientationTransform','[1,0,0,0,1,0,0,0,1]'::jsonb,'status','recognized',
 'lines',jsonb_build_array(jsonb_build_object('text','Water, 1,2-Hexanediol','alternatives',jsonb_build_array('Water, 1,2-HexanedioI'),
 'region','[0,0,1,0.1]'::jsonb,'confidence',0.99),jsonb_build_object('text','Glycerin 0.1% w/w','alternatives','[]'::jsonb,
 'region','[0,0.1,1,0.1]'::jsonb,'confidence',0.97)))),'edits','[]'::jsonb) from part_one_test_state where key='private-capture-a'));
set local role authenticated;
select set_config('request.jwt.claim.sub','e7100000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.part_one_operation('captures/observations',(select value || jsonb_build_object('idempotencyKey','private-duplicate-assets',
 'assets',jsonb_build_array(value->'assets'->0,value->'assets'->0)) from part_one_test_state where key='private-request-a'))$$,
 'P0001','PART_ONE_INVALID_PAYLOAD','A25 direct RPC duplicate asset IDs rejected before commit');
select throws_ok($$select public.part_one_operation('captures/observations',(select value || jsonb_build_object('idempotencyKey','private-duplicate-asset-casing',
 'assets',jsonb_build_array(value->'assets'->0,(value->'assets'->0) || jsonb_build_object(
 'evidenceId',upper(value->'assets'->0->>'evidenceId'),'storageObjectId',upper(value->'assets'->0->>'storageObjectId'))))
 from part_one_test_state where key='private-request-a'))$$,
 'P0001','PART_ONE_INVALID_PAYLOAD','A25 UUID case variants cannot bypass direct RPC duplicate asset guard');
set local role postgres;
select is((select count(*)::integer from private.part_one_records where owner_id='e7100000-0000-4000-8000-000000000001'),0,
 'A25 duplicate asset request has no durable payload side effects');
set local role authenticated;
insert into part_one_test_state values('private-commit-a',public.part_one_operation('captures/observations',(select value from part_one_test_state where key='private-request-a')));
select is((select value->'result'->>'scope' from part_one_test_state where key='private-commit-a'),'private_package','A25 committed OCR remains owner-private');
select is((select value->'result'->>'declarationState' from part_one_test_state where key='private-commit-a'),'partial','A14 confidence cannot establish private panel completeness');
select is((select jsonb_array_length(value->'observationIds') from part_one_test_state where key='private-commit-a'),1,'private commit returns immutable OCR ID');
select is((select jsonb_array_length(value->'declarationIds') from part_one_test_state where key='private-commit-a'),1,'private commit returns immutable partial declaration ID');
select is((select value->'capture'->>'captureRevision' from part_one_test_state where key='private-commit-a'),'1','private commit advances capture revision');
select is((select value->'result'->'display'->'sections'->0->>'text' from part_one_test_state where key='private-commit-a'),
 E'Water, 1,2-Hexanediol\nGlycerin 0.1% w/w','A11 private raw lines and chemical punctuation preserved');
select is(public.part_one_operation('captures/observations',(select value from part_one_test_state where key='private-request-a'))->'observationIds',
 (select value->'observationIds' from part_one_test_state where key='private-commit-a'),'A21 private exact replay retains immutable IDs');
insert into part_one_test_state values('private-edit-request',(select jsonb_build_object('captureSessionId',value->'capture'->'captureSessionId',
 'idempotencyKey','private-edit-a','expectedGeneration',0,'expectedResultRevision',value->'result'->'resultRevision','expectedCaptureRevision',1,'expectedDeletionEpoch',0,
 'packageObservationId',value->'capture'->'packageObservationId','assets','[]'::jsonb,'observations','[]'::jsonb,
 'edits',jsonb_build_array(jsonb_build_object('observationId','e7200000-0000-4000-8000-000000000008','supersedesId','e7200000-0000-4000-8000-000000000007',
 'revision',2,'text',E'Water, 1,2-Hexanediol\nGlycerin 0.2% w/w','reason','Synthetic attributed correction')))
 from part_one_test_state where key='private-commit-a'));
insert into part_one_test_state values('private-edit-a',public.part_one_operation('captures/observations',(select value from part_one_test_state where key='private-edit-request')));
select is((select value->'result'->>'declarationState' from part_one_test_state where key='private-edit-a'),'partial','A14 attributed edit cannot clear missing panel/variant evidence');
select is(public.part_one_operation('captures/observations',(select value || jsonb_build_object('idempotencyKey','private-edit-stale') from part_one_test_state where key='private-edit-request'))->>'conflict',
 'true','A25 stale capture/result revision cannot restore an older edit');
select throws_ok($$select public.part_one_operation('captures/observations',(select req.value || jsonb_build_object('idempotencyKey','private-edit-branch',
 'expectedResultRevision',done.value->'result'->'resultRevision','expectedCaptureRevision',2,
 'edits',jsonb_build_array(jsonb_build_object('observationId','e7200000-0000-4000-8000-000000000009','supersedesId','e7200000-0000-4000-8000-000000000007',
 'revision',2,'text','Competing branch','reason','Synthetic branch attempt')))
 from part_one_test_state req,part_one_test_state done where req.key='private-edit-request' and done.key='private-edit-a'))$$,
 'P0001','PART_ONE_IDEMPOTENCY_CONFLICT','A25 edited source cannot branch a second superseding revision');
set local role postgres;
select is((select payload->>'rawText' from private.part_one_records where id='e7200000-0000-4000-8000-000000000007'),
 E'Water, 1,2-Hexanediol\nGlycerin 0.1% w/w','A25 edit preserves original immutable recognition');
select is((select supersedes_id::text from private.part_one_records where id='e7200000-0000-4000-8000-000000000008'),
 'e7200000-0000-4000-8000-000000000007','A25 edit keeps attributed supersedes chain');
select is((select payload->'observation'->'lines'->0->'alternatives'->>0 from private.part_one_records where id='e7200000-0000-4000-8000-000000000007'),
 'Water, 1,2-HexanedioI','A16 original alternatives remain attributable beside correction');
select throws_ok($$update private.part_one_records set payload='{}' where id='e7200000-0000-4000-8000-000000000007'$$,
 'P0001','PART_ONE_IMMUTABLE','A25 private recognition cannot be overwritten');
select is((select payload->'declarationIds' from private.part_one_records where id='e7100000-0000-4000-8000-000000000003'),
 '[]'::jsonb,'A07 private declaration never promotes shared catalog');
select is((select count(*)::integer from private.part_one_records where owner_id='e7100000-0000-4000-8000-000000000002'),0,
 'A25 other owner receives no private material');
-- B's request has its own owner/capture/asset and independent observation UUID.
insert into part_one_test_state values('private-request-b',(select
 jsonb_set(jsonb_set(a.value,'{observations,0,captureSessionId}',b.value->'captureSessionId'),'{observations,0,evidenceId}',
 '"e7300000-0000-4000-8000-000000000001"') || jsonb_build_object('captureSessionId',b.value->'captureSessionId',
 'packageObservationId',b.value->'packageObservationId','idempotencyKey','private-commit-b',
 'assets',jsonb_build_array(jsonb_build_object('evidenceId','e7300000-0000-4000-8000-000000000002','storageObjectId','e7200000-0000-4000-8000-000000000002',
 'contentHash','fixture-hash-b','width',400,'height',300,'metadataStripped',true)))
 from part_one_test_state a,part_one_test_state b where a.key='private-request-a' and b.key='private-capture-b'));
set local role authenticated;
select set_config('request.jwt.claim.sub','e7100000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.part_one_operation('captures/observations',(select jsonb_set(value,'{assets,0,storageObjectId}',
 '"e7200000-0000-4000-8000-000000000001"') from part_one_test_state where key='private-request-b'))$$,
 '42501','PART_ONE_NOT_FOUND','A24 foreign object cannot become private proof');
select throws_ok($$select public.part_one_operation('captures/observations',(select jsonb_set(value,'{assets,0,storageObjectId}',
 '"e7200000-0000-4000-8000-000000000003"') from part_one_test_state where key='private-request-b'))$$,
 '42501','PART_ONE_NOT_FOUND','A27 client metadataStripped cannot replace server sanitation attestation');
select throws_ok($$select public.part_one_operation('captures/observations',(select value || jsonb_build_object('assets','[]'::jsonb,'observations','[]'::jsonb,
 'edits',jsonb_build_array(jsonb_build_object('observationId','e7300000-0000-4000-8000-000000000003','supersedesId','e7200000-0000-4000-8000-000000000007',
 'revision',2,'text','Foreign correction','reason','Synthetic attack'))) from part_one_test_state where key='private-request-b'))$$,
 '42501','PART_ONE_NOT_FOUND','A24 foreign edit lineage is inaccessible');
insert into part_one_test_state values('private-commit-b',public.part_one_operation('captures/observations',(select value from part_one_test_state where key='private-request-b')));
select is((select value->'result'->>'scope' from part_one_test_state where key='private-commit-b'),'private_package','A25 second owner commits separate private declaration');
select isnt((select value->'declarationIds'->>0 from part_one_test_state where key='private-commit-a'),
 (select value->'declarationIds'->>0 from part_one_test_state where key='private-commit-b'),'A25 private declarations never coalesce by GTIN');
select set_config('request.jwt.claim.sub','e7100000-0000-4000-8000-000000000001',true);
insert into part_one_test_state values('private-save-a',public.part_one_operation('saves/create',(select jsonb_build_object('idempotencyKey','private-save-a',
 'scanId',value->'result'->'scanId','expectedGeneration',0,'expectedResultRevision',value->'result'->'resultRevision',
 'selectedSnapshotId',value->'result'->'snapshotId','selectedDeclarationId',value->'result'->'declarationId') from part_one_test_state where key='private-edit-a')));
select is((public.part_one_operation('saves/read',(select jsonb_build_object('id',value->'saveId') from part_one_test_state where key='private-save-a'))->'result')->>'declarationState',
 'partial','A28 private partial save survives authoritative reopen');

-- Expiry is a consumer lifecycle action even before a commit creates assets.
insert into part_one_test_state values('expired-before-commit',public.part_one_operation('captures/create',(select jsonb_build_object('scanId',value->'result'->'scanId',
 'expectedGeneration',0,'expectedResultRevision',value->'result'->'resultRevision') from part_one_test_state where key='private-edit-a')));
set local role postgres;
insert into storage.objects(id,bucket_id,name,owner,owner_id,version) values
 ('e7500000-0000-4000-8000-000000000012','part-one-private-fixture','owner-a/expired-before-commit.png','e7100000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000001','synthetic-version-1');
insert into private.part_one_asset_attestations(id,owner_id,capture_id,package_observation_id,generation,deletion_epoch,storage_object_id,object_version,
 content_hash,width,height,sanitizer_version,verification_evidence,metadata_stripped,observed_at,expires_at)
 select 'e7500000-0000-4000-8000-000000000112','e7100000-0000-4000-8000-000000000001',(value->>'captureSessionId')::uuid,
 (value->>'packageObservationId')::uuid,0,0,'e7500000-0000-4000-8000-000000000012','synthetic-version-1','fixture-hash-expired',400,300,
 'synthetic-sanitizer-1','Synthetic expiry fixture only',true,now()-interval '1 hour',now()-interval '1 second'
 from part_one_test_state where key='expired-before-commit';
select public.part_one_worker('purge_private','{}');
select is((select count(*)::integer from private.part_one_private_cleanup where object_id='e7500000-0000-4000-8000-000000000012'),1,
 'A27 expired precommit attestation enters durable cleanup');
select is((select count(*)::integer from private.part_one_asset_attestations where id='e7500000-0000-4000-8000-000000000112'),0,
 'A26 expired precommit attestation erased after cleanup queued');
insert into part_one_test_state values('expired-precommit-revision',(select to_jsonb(capture_revision) from private.part_one_captures
 where id=(select (value->>'captureSessionId')::uuid from part_one_test_state where key='expired-before-commit')));
select public.part_one_worker('purge_private','{}');
select is((select count(*)::integer from private.part_one_private_cleanup where object_id='e7500000-0000-4000-8000-000000000012'),1,
 'A27 repeated precommit expiry sweep has one cleanup locator');
select is((select to_jsonb(capture_revision) from private.part_one_captures where id=(select (value->>'captureSessionId')::uuid from part_one_test_state where key='expired-before-commit')),
 (select value from part_one_test_state where key='expired-precommit-revision'),'A26 repeated precommit expiry leaves revision stable');
set local role authenticated;
-- A server-attested upload may be canceled before any commit creates the asset
-- ledger. It still must enter Storage cleanup before its receipt is erased.
insert into part_one_test_state values('cancel-before-commit',public.part_one_operation('captures/create',(select jsonb_build_object('scanId',value->'result'->'scanId',
 'expectedGeneration',0,'expectedResultRevision',value->'result'->'resultRevision') from part_one_test_state where key='private-edit-a')));
set local role postgres;
insert into storage.objects(id,bucket_id,name,owner,owner_id,version) values
 ('e7500000-0000-4000-8000-000000000010','part-one-private-fixture','owner-a/cancel-before-commit.png','e7100000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000001','synthetic-version-1');
insert into private.part_one_asset_attestations(id,owner_id,capture_id,package_observation_id,generation,deletion_epoch,storage_object_id,object_version,
 content_hash,width,height,sanitizer_version,verification_evidence,metadata_stripped,observed_at,expires_at)
 select 'e7500000-0000-4000-8000-000000000110','e7100000-0000-4000-8000-000000000001',(value->>'captureSessionId')::uuid,
 (value->>'packageObservationId')::uuid,0,0,'e7500000-0000-4000-8000-000000000010','synthetic-version-1','fixture-hash-cancel',400,300,
 'synthetic-sanitizer-1','Synthetic upload identity only',true,now(),now()+interval '1 hour' from part_one_test_state where key='cancel-before-commit';
set local role authenticated;
select is(public.part_one_operation('captures/delete',(select jsonb_build_object('id',value->'captureSessionId') from part_one_test_state where key='cancel-before-commit'))->>'deleted',
 'true','A25 uncommitted upload cancellation succeeds');
set local role postgres;
select is((select count(*)::integer from private.part_one_private_cleanup where object_id='e7500000-0000-4000-8000-000000000010'),1,
 'A27 uncommitted attested upload receives durable byte cleanup');
select is((select count(*)::integer from private.part_one_asset_attestations where id='e7500000-0000-4000-8000-000000000110'),0,
 'A25 canceled precommit upload receipt erased after queuing');
set local role authenticated;
insert into part_one_test_state values('selection-before-commit',public.part_one_operation('captures/create',(select jsonb_build_object('scanId',value->'result'->'scanId',
 'expectedGeneration',0,'expectedResultRevision',value->'result'->'resultRevision') from part_one_test_state where key='private-edit-a')));
set local role postgres;
insert into storage.objects(id,bucket_id,name,owner,owner_id,version) values
 ('e7500000-0000-4000-8000-000000000011','part-one-private-fixture','owner-a/selection-before-commit.png','e7100000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000001','synthetic-version-1');
insert into private.part_one_asset_attestations(id,owner_id,capture_id,package_observation_id,generation,deletion_epoch,storage_object_id,object_version,
 content_hash,width,height,sanitizer_version,verification_evidence,metadata_stripped,observed_at,expires_at)
 select 'e7500000-0000-4000-8000-000000000111','e7100000-0000-4000-8000-000000000001',(value->>'captureSessionId')::uuid,
 (value->>'packageObservationId')::uuid,0,0,'e7500000-0000-4000-8000-000000000011','synthetic-version-1','fixture-hash-cancel',400,300,
 'synthetic-sanitizer-1','Synthetic upload identity only',true,now(),now()+interval '1 hour' from part_one_test_state where key='selection-before-commit';
set local role authenticated;
set local role postgres;
-- Actual service preparation is bound to the latest source commit; no typed
-- client checkbox supplies an authority and stale apply cannot change rows.
update private.part_one_private_config set reviewed_at=now();
insert into part_one_test_state values('private-service-prepared',public.part_one_private_service('review/prepare',
 (select jsonb_build_object('ownerId',cm.owner_id,'captureSessionId',cm.capture_id,'idempotencyKey',cm.idempotency_key,'reviewId',null)
 from private.part_one_capture_commits cm where cm.owner_id='e7100000-0000-4000-8000-000000000001' order by cm.created_at desc,cm.capture_revision desc limit 1)));
select is((select value->'context'->'policy'->'retainedFields' @> '["ingredients"]' from part_one_test_state where key='private-service-prepared'),true,
 'reviewed private retention explicitly includes ingredient transcript evidence');
select is((select value->'context'->'ownerId' from part_one_test_state where key='private-service-prepared'),'"e7100000-0000-4000-8000-000000000001"'::jsonb,
 'actual prepared context is owner-bound');
select is(public.part_one_private_service('review/apply',(select jsonb_build_object('ownerId','e7100000-0000-4000-8000-000000000001',
 'captureSessionId',value->'context'->'capture'->'captureSessionId','idempotencyKey',cm.idempotency_key,'reviewId',null,'sourceCommitId',value->'sourceCommitId',
 'expectedCaptureRevision',-1,'expectedResultRevision',value->'resultRevision','evaluation','{}'::jsonb,'authorityPolicy',null)
 from part_one_test_state ps join private.part_one_capture_commits cm on cm.source_commit_id=(ps.value->>'sourceCommitId')::uuid where ps.key='private-service-prepared'))->>'conflict','true',
 'stale reviewed apply is rejected before any private graph admission');
select throws_ok($$select public.part_one_private_service('review/apply',(select jsonb_build_object('ownerId','e7100000-0000-4000-8000-000000000001',
 'captureSessionId',value->'context'->'capture'->'captureSessionId','idempotencyKey',cm.idempotency_key,'reviewId',null,'sourceCommitId',value->'sourceCommitId',
 'expectedCaptureRevision',value->'captureRevision','expectedResultRevision',value->'resultRevision','evaluation',jsonb_build_object('persistable',false),'authorityPolicy',null)
 from part_one_test_state ps join private.part_one_capture_commits cm on cm.source_commit_id=(ps.value->>'sourceCommitId')::uuid where ps.key='private-service-prepared'))$$,
 'P0001','PART_ONE_INVALID_PRIVATE_REVIEW','malformed/unpermitted private graph admission fails atomically');
-- Bounded private upload ownership and quota. These are reservations only;
-- no SQL fixture asserts that metadata insertion proves actual Storage bytes.
insert into part_one_test_state values('private-upload-binding',(select jsonb_build_object('captureSessionId',cc.id,'packageObservationId',cc.package_observation_id,
 'expectedGeneration',cc.generation,'expectedResultRevision',ss.result_revision,'expectedCaptureRevision',cc.capture_revision,'expectedDeletionEpoch',cc.deletion_epoch,
 'contentHash',repeat('a',64),'byteLength',100,'width',160,'height',64) from private.part_one_captures cc join private.part_one_scans ss on ss.id=cc.scan_id
 where cc.id=(select (value->>'captureSessionId')::uuid from part_one_test_state where key='private-capture-a')));
set local role authenticated;
select is(public.part_one_operation('captures/upload-authorize',(select value from part_one_test_state where key='private-upload-binding'))->>'code',
 'private_cleanup_worker_unavailable','private upload refuses dispatch without real fresh cleanup consumer');
set local role postgres;
select public.part_one_private_service('cleanup/heartbeat','{"consumerVersion":"synthetic-pgtap-consumer"}');
set local role authenticated;
select is(public.part_one_operation('captures/upload-authorize',(select value-'packageObservationId' from part_one_test_state where key='private-upload-binding'))->>'code',
 'stale_capture','direct RPC cannot omit exact package binding');
insert into part_one_test_state values('private-reservations',(select jsonb_agg(public.part_one_operation('captures/upload-reserve',ps.value||
 jsonb_build_object('idempotencyKey','synthetic-private-reservation-'||i,'evidenceId','e7800000-0000-4000-8000-'||lpad(i::text,12,'0'))))
 from part_one_test_state ps,generate_series(1,6) i where ps.key='private-upload-binding'));
select is(public.part_one_operation('captures/upload-reserve',(select value||jsonb_build_object('idempotencyKey','synthetic-private-reservation-7',
 'evidenceId','e7800000-0000-4000-8000-000000000007') from part_one_test_state where key='private-upload-binding'))->>'code',
 'private_upload_quota','seventh private capture reservation is deferred without Storage dispatch');
set local role postgres;
select is((select count(*)::integer from private.part_one_upload_tickets where capture_id=(select (value->>'captureSessionId')::uuid from part_one_test_state where key='private-capture-a')),6,
 'private quota refusal creates no seventh durable reservation');
select is((select count(distinct object_name)::integer from private.part_one_upload_tickets where capture_id=(select (value->>'captureSessionId')::uuid from part_one_test_state where key='private-capture-a')
 and object_name~'^part-one/[a-f0-9-]{36}\.jpg$'),6,'all reserved destinations are unique opaque server names');
-- Deletion fault fixture: a saved private snapshot owns an FK to a graph
-- record. The byte/source removal must erase the graph and all copied private
-- variant fields while retaining only original snapshot ID + public identity.
insert into private.part_one_records(id,kind,item_id,revision,policy_id,policy_version,owner_id,scope,payload,identity_dependencies,observed_at,expires_at)
 select 'e7600000-0000-4000-8000-000000000001','snapshot','e7100000-0000-4000-8000-000000000004',2,'private_capture',cfg.policy_version,
 'e7100000-0000-4000-8000-000000000001','private_package',jsonb_build_object('privateKind','package_snapshot','captureSessionId',pc.value->'captureSessionId',
 'packageObservationId',pc.value->'packageObservationId','name','Synthetic private package','brand','Fixture','variantText','Sensitive private variant',
 'image',null,'declarationIds','[]'::jsonb,'publicSnapshotId','e7100000-0000-4000-8000-000000000003'),array['e7100000-0000-4000-8000-000000000003'::uuid],now(),now()+interval '1 hour'
 from private.part_one_private_config cfg,part_one_test_state pc where pc.key='private-capture-a';
insert into private.part_one_saves(id,owner_id,idempotency_key,scan_id,snapshot_at_save_id,declaration_id,saved_result,saved_request)
 select 'e7600000-0000-4000-8000-000000000002',sv.owner_id,'synthetic-private-snapshot-save',sv.scan_id,'e7600000-0000-4000-8000-000000000001',sv.declaration_id,
 jsonb_set(jsonb_set(sv.saved_result,'{snapshotId}','"e7600000-0000-4000-8000-000000000001"'),'{display,selectedIdentity,variantText}','"Sensitive private variant"'),sv.saved_request
 from private.part_one_saves sv where sv.id=(select (value->>'saveId')::uuid from part_one_test_state where key='private-save-a');
select ok(exists(select 1 from private.part_one_saves where id='e7600000-0000-4000-8000-000000000002'),'private snapshot FK deletion regression fixture has a saved row');
insert into private.part_one_record_status(record_id,status,reason) values('e7600000-0000-4000-8000-000000000001','revoked','Synthetic private variant withdrawal');
select is((select private.part_one_filter_result(saved_result,owner_id)->>'snapshotId' from private.part_one_saves where id='e7600000-0000-4000-8000-000000000002'),
 'e7100000-0000-4000-8000-000000000003','A26 private snapshot withdrawal returns only original independently permitted public identity');
select ok((select private.part_one_filter_result(saved_result,owner_id)->>'identity'='exact' and not private.part_one_filter_result(saved_result,owner_id)::text like '%Sensitive private variant%'
 and private.part_one_filter_result(saved_result,owner_id)->'display'->'sections'='[]'::jsonb from private.part_one_saves where id='e7600000-0000-4000-8000-000000000002'),
 'A26 private withdrawal preserves public identity while purging private variant/ingredient projection');

-- Synthetic composition supplies an eligible selected-package candidate binding;
-- selection itself runs the real authenticated lifecycle transaction.
insert into private.part_one_candidate_bindings(scan_id,generation,owner_id,item_id,snapshot_id)
 select (value->'result'->>'scanId')::uuid,0,'e7100000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000004','e7100000-0000-4000-8000-000000000003'
 from part_one_test_state where key='private-edit-a';
update private.part_one_scans set result=jsonb_set(jsonb_set(result,'{candidateIds}',jsonb_build_array('e7100000-0000-4000-8000-000000000004')),
 '{display,candidates}',jsonb_build_array(result->'display'->'selectedIdentity')) where id=(select (value->'result'->>'scanId')::uuid from part_one_test_state where key='private-edit-a');
set local role authenticated;
insert into part_one_test_state values('private-selection',public.part_one_operation('selection',(select jsonb_build_object('scanId',value->'result'->'scanId',
 'expectedGeneration',0,'expectedResultRevision',value->'result'->'resultRevision','candidateId','e7100000-0000-4000-8000-000000000004') from part_one_test_state where key='private-edit-a')));
select is((select value->>'generation' from part_one_test_state where key='private-selection'),'1','A25 selection ends old capture generation');
select is((public.part_one_operation('saves/read',(select jsonb_build_object('id',value->'saveId') from part_one_test_state where key='private-save-a'))->'result')->>'declarationState',
 'partial','A28 committed historical package survives selection until explicit removal');
set local role postgres;
select is((select count(*)::integer from private.part_one_private_cleanup where object_id='e7500000-0000-4000-8000-000000000011'),1,
 'A27 selection purges uncommitted attested upload');
select ok((select removed_at is not null from private.part_one_captures where id=(select (value->>'captureSessionId')::uuid from part_one_test_state where key='private-capture-a')),
 'A25 committed old capture is ended by selection');
set local role authenticated;
select is(public.part_one_operation('captures/delete',(select jsonb_build_object('id',value->'captureSessionId') from part_one_test_state where key='private-capture-a'))->>'deleted',
 'true','A25 explicit removal deletes private proof');
set local role postgres;
insert into part_one_test_state values('private-deleted-revision',(select to_jsonb(capture_revision) from private.part_one_captures
 where id=(select (value->>'captureSessionId')::uuid from part_one_test_state where key='private-capture-a')));
set local role authenticated;
select is(public.part_one_operation('captures/delete',(select jsonb_build_object('id',value->'captureSessionId') from part_one_test_state where key='private-capture-a'))->>'deleted',
 'true','A24 repeated private deletion remains idempotent');
set local role postgres;
select is((select to_jsonb(capture_revision) from private.part_one_captures where id=(select (value->>'captureSessionId')::uuid from part_one_test_state where key='private-capture-a')),
 (select value from part_one_test_state where key='private-deleted-revision'),'A24 repeated purge leaves capture revision stable');
set local role authenticated;
select is(public.part_one_operation('captures/observations',(select value from part_one_test_state where key='private-request-a'))->>'conflict',
 'true','A24 removed capture outbox replay cannot restore private rows');
select is((public.part_one_operation('saves/read',(select jsonb_build_object('id',value->'saveId') from part_one_test_state where key='private-save-a'))->'result')->'display'->'sections',
 '[]'::jsonb,'A26 private removal purges copied save transcript');
select is(public.part_one_operation('scans/read',(select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='private-a'))->>'identity',
 'exact','A26 independently permitted public identity survives private removal');
set local role postgres;
select is((select count(*)::integer from private.part_one_records where owner_id='e7100000-0000-4000-8000-000000000001'),0,'A25 private removal erases original/edit/derived payloads');
select is((select snapshot_at_save_id from private.part_one_saves where id='e7600000-0000-4000-8000-000000000002'),
 'e7100000-0000-4000-8000-000000000003'::uuid,'A25 removal internal FK redirects only to stored original public identity');
select is((select original_snapshot_at_save_id from private.part_one_saves where id='e7600000-0000-4000-8000-000000000002'),
 'e7600000-0000-4000-8000-000000000001'::uuid,'A28 original saved private snapshot UUID remains opaque immutable tombstone');
select ok((select not saved_result::text like '%Sensitive private variant%' and saved_result->'display'->'sections'='[]'::jsonb and declaration_id is null
 from private.part_one_saves where id='e7600000-0000-4000-8000-000000000002'),'A26 private removal erases copied private variant and declaration readiness');
set local role authenticated;
select is(public.part_one_operation('saves/read','{"id":"e7600000-0000-4000-8000-000000000002"}')->>'snapshotAtSaveId',
 'e7600000-0000-4000-8000-000000000001','A28 tombstone reopen preserves external original snapshot-at-save ID');
set local role postgres;

select is((select count(*)::integer from private.part_one_private_cleanup where object_id='e7200000-0000-4000-8000-000000000001'),1,'A27 private bytes deletion durably queued through Storage API boundary');
insert into part_one_test_state values('private-cleanup-claim',public.part_one_private_service('cleanup/claim','{}'));
select ok((select value->'claim'<>'null'::jsonb from part_one_test_state where key='private-cleanup-claim'),'private cleanup consumer obtains durable bounded lease');
select is(public.part_one_private_service('cleanup/ack',(select jsonb_build_object('objectId',value->'claim'->'objectId','leaseToken','e7900000-0000-4000-8000-000000000001')
 from part_one_test_state where key='private-cleanup-claim'))->>'deleted','false','stale cleanup lease cannot acknowledge erasure');
select is(public.part_one_private_service('cleanup/ack',(select jsonb_build_object('objectId',value->'claim'->'objectId','leaseToken',value->'claim'->'leaseToken')
 from part_one_test_state where key='private-cleanup-claim'))->>'deleted','false','SQL never acknowledges byte erasure while Storage object still exists');
select is((select count(*)::integer from private.part_one_upload_tickets where capture_id=(select (value->>'captureSessionId')::uuid from part_one_test_state where key='private-capture-a')
 and state='cancelled'),6,'removed capture fences every uncommitted upload ticket');

select set_config('request.jwt.claim.sub','e7100000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((public.part_one_operation('scans/read',(select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='private-b'))->'display')->'sections'->0->>'text',
 E'Water, 1,2-Hexanediol\nGlycerin 0.1% w/w','A25 owner A removal leaves B transcript intact');
set local role postgres;
insert into private.part_one_asset_status(attestation_id,revoked_at,reason) values('e7200000-0000-4000-8000-000000000005',now(),'Synthetic private asset permission revoked');
set local role authenticated;
select is(public.part_one_operation('scans/read',(select jsonb_build_object('scanId',value->'scanId') from part_one_test_state where key='private-b'))->>'identity',
 'exact','A26 read-time source revocation preserves independent public identity');
set local role postgres;
select is((select count(*)::integer from private.part_one_records where owner_id='e7100000-0000-4000-8000-000000000002'),0,
 'A26 ordinary read purges affected private sources and derivatives before consumer sweep');
select public.part_one_worker('purge_private','{}');
select is((select count(*)::integer from private.part_one_records where owner_id='e7100000-0000-4000-8000-000000000002'),0,'A26 private asset revocation erases dependent transcripts on consumer sweep');
select is((select count(*)::integer from private.part_one_private_cleanup where object_id='e7200000-0000-4000-8000-000000000002'),1,'A26 revoked private asset schedules byte cleanup');
-- Unresolved identity can durably retain partial text with null item/snapshot;
-- neither an identity nor accepted declaration is invented from OCR.
set local role authenticated;
insert into part_one_test_state values('private-unresolved',public.part_one_operation('scans/create',
 '{"idempotencyKey":"private-unresolved","reasonCodes":[],"request":{"schemaVersion":1,"requestId":"e7400000-0000-4000-8000-000000000001","clientScanId":"e7400000-0000-4000-8000-000000000002","idempotencyKey":"private-unresolved","generation":0,"code":{"raw":"not-a-gtin","symbology":"qr","namespace":"unknown","retailerId":null},"requestedMarket":null,"categoryHint":null}}'));
insert into part_one_test_state values('private-unresolved-cap',public.part_one_operation('captures/create',(select jsonb_build_object('scanId',value->'scanId',
 'expectedGeneration',0,'expectedResultRevision',value->'resultRevision') from part_one_test_state where key='private-unresolved')));
set local role postgres;
insert into storage.objects(id,bucket_id,name,owner,owner_id,version) values
 ('e7400000-0000-4000-8000-000000000003','part-one-private-fixture','owner-b/unresolved.png','e7100000-0000-4000-8000-000000000002','e7100000-0000-4000-8000-000000000002','synthetic-version-1');
insert into private.part_one_asset_attestations(id,owner_id,capture_id,package_observation_id,generation,deletion_epoch,storage_object_id,object_version,
 content_hash,width,height,sanitizer_version,verification_evidence,metadata_stripped,observed_at,expires_at)
 select 'e7400000-0000-4000-8000-000000000004','e7100000-0000-4000-8000-000000000002',(value->>'captureSessionId')::uuid,
 (value->>'packageObservationId')::uuid,0,0,'e7400000-0000-4000-8000-000000000003','synthetic-version-1','fixture-hash-b',400,300,
 'synthetic-sanitizer-1','Synthetic metadata fixture only',true,now(),now()+interval '1 hour' from part_one_test_state where key='private-unresolved-cap';
insert into part_one_test_state values('private-unresolved-request',(select
 jsonb_set(jsonb_set(a.value,'{observations,0,captureSessionId}',b.value->'captureSessionId'),'{observations,0,evidenceId}',
 '"e7400000-0000-4000-8000-000000000006"') || jsonb_build_object('captureSessionId',b.value->'captureSessionId',
 'packageObservationId',b.value->'packageObservationId','idempotencyKey','private-unresolved-commit',
 'assets',jsonb_build_array(jsonb_build_object('evidenceId','e7400000-0000-4000-8000-000000000006','storageObjectId','e7400000-0000-4000-8000-000000000003',
 'contentHash','fixture-hash-b','width',400,'height',300,'metadataStripped',true)))
 from part_one_test_state a,part_one_test_state b where a.key='private-request-b' and b.key='private-unresolved-cap'));
set local role authenticated;
insert into part_one_test_state values('private-unresolved-commit',public.part_one_operation('captures/observations',(select value from part_one_test_state where key='private-unresolved-request')));
select is((select value->'result'->>'itemId' from part_one_test_state where key='private-unresolved-commit'),null,'A07 private partial cannot invent unresolved catalog item');
select is((select value->'result'->>'snapshotId' from part_one_test_state where key='private-unresolved-commit'),null,'A07 no guessed private product snapshot');
select is((select value->'result'->>'declarationState' from part_one_test_state where key='private-unresolved-commit'),'partial','unresolved identity text stays explicit partial');
select is((select jsonb_array_length(value->'result'->'display'->'sections') from part_one_test_state where key='private-unresolved-commit'),1,'unresolved partial retains owner display and rights-bound date');
set local role postgres;
-- Reopen commits include the unchanged immutable originals. Only exact same
-- owner/package/role/metadata reuses an ID; a changed source under it is rejected.
insert into part_one_test_state values('private-v2-reuse-request',(select (rq.value-'observations')||jsonb_build_object('schemaVersion',2,
 'idempotencyKey','private-v2-reuse','expectedResultRevision',ss.result_revision,'expectedCaptureRevision',cc.capture_revision,
 'sourceObservations',jsonb_build_array(jsonb_build_object('observationId',rq.value->'observations'->0->'evidenceId','revision',1,'role','ingredients','observation',rq.value->'observations'->0)),
 'review',null,'reviewId',null) from part_one_test_state rq join private.part_one_captures cc on cc.id=(rq.value->>'captureSessionId')::uuid
 join private.part_one_scans ss on ss.id=cc.scan_id where rq.key='private-unresolved-request'));
set local role authenticated;
insert into part_one_test_state values('private-v2-reuse',public.part_one_operation('captures/observations',(select value from part_one_test_state where key='private-v2-reuse-request')));
select is((select value->'observationIds' from part_one_test_state where key='private-v2-reuse'),
 (select value->'observationIds' from part_one_test_state where key='private-unresolved-commit'),'A28 reopened v2 commit reuses exact immutable original evidence IDs');
set local role postgres;
select is((select count(*)::integer from private.part_one_records where owner_id='e7100000-0000-4000-8000-000000000002' and payload->>'privateKind'='ocr'),1,
 'A28 exact original replay creates no duplicate OCR source');
insert into part_one_test_state values('private-v2-changed-id',(select jsonb_set(rq.value,'{sourceObservations,0,observation,lines,0,text}','"Contradictory replacement under old ID"')||
 jsonb_build_object('idempotencyKey','private-v2-contradiction','expectedResultRevision',ss.result_revision,'expectedCaptureRevision',cc.capture_revision)
 from part_one_test_state rq join private.part_one_captures cc on cc.id=(rq.value->>'captureSessionId')::uuid join private.part_one_scans ss on ss.id=cc.scan_id where rq.key='private-v2-reuse-request'));
set local role authenticated;
select throws_ok($$select public.part_one_operation('captures/observations',(select value from part_one_test_state where key='private-v2-changed-id'))$$,
 'P0001','PART_ONE_IDEMPOTENCY_CONFLICT','A28 changed metadata cannot reuse immutable original ID');
set local role postgres;
select is((select count(*)::integer from private.part_one_capture_commits where idempotency_key='private-v2-contradiction'),0,
 'A28 rejected changed-ID request commits no durable receipt');
-- Stable original pass order and ancestry order across same-transaction
-- commits. IDs deliberately sort opposite to source/edited revision order.
insert into part_one_test_state values('private-v2-pass-two-request',(select jsonb_build_object('captureSessionId',cc.id,'packageObservationId',cc.package_observation_id,
 'schemaVersion',2,'idempotencyKey','private-pass-two','expectedGeneration',cc.generation,'expectedResultRevision',ss.result_revision,'expectedCaptureRevision',cc.capture_revision,
 'expectedDeletionEpoch',cc.deletion_epoch,'assets',rq.value->'assets','sourceObservations',jsonb_build_array(jsonb_build_object('observationId','e7000000-0000-4000-8000-000000000009',
 'revision',1,'role','ingredients','observation',jsonb_set(rq.value->'observations'->0,'{recognizerVersion}','"synthetic-second-pass"'))),'edits','[]'::jsonb,'review',null,'reviewId',null)
 from part_one_test_state rq join private.part_one_captures cc on cc.id=(rq.value->>'captureSessionId')::uuid join private.part_one_scans ss on ss.id=cc.scan_id where rq.key='private-unresolved-request'));
set local role authenticated;
insert into part_one_test_state values('private-v2-pass-two',public.part_one_operation('captures/observations',(select value from part_one_test_state where key='private-v2-pass-two-request')));
insert into part_one_test_state values('private-pass-recovery',public.part_one_operation('captures/evidence',(select jsonb_build_object('captureSessionId',value->'capture'->'captureSessionId')
 from part_one_test_state where key='private-v2-pass-two')));
select is((select value->'sourceObservations'->0->>'observationId' from part_one_test_state where key='private-pass-recovery'),
 'e7400000-0000-4000-8000-000000000006','A28 recovered original pass remains first despite UUID/timestamp tie');
select is((select value->'sourceObservations'->1->>'observationId' from part_one_test_state where key='private-pass-recovery'),
 'e7000000-0000-4000-8000-000000000009','A28 later OCR pass appends to stable original source order');
set local role postgres;
select is((select (payload->>'sourceOrdinal')::integer from private.part_one_records where id='e7000000-0000-4000-8000-000000000009'),1,
 'A28 immutable later source retains admission ordinal');
insert into part_one_test_state values('private-v2-multiple-edits-request',(select jsonb_build_object('captureSessionId',cc.id,'packageObservationId',cc.package_observation_id,
 'schemaVersion',2,'idempotencyKey','private-multiple-edits','expectedGeneration',cc.generation,'expectedResultRevision',ss.result_revision,'expectedCaptureRevision',cc.capture_revision,
 'expectedDeletionEpoch',cc.deletion_epoch,'assets','[]'::jsonb,'sourceObservations','[]'::jsonb,'review',null,'reviewId',null,
 'edits',jsonb_build_array(jsonb_build_object('observationId','f7a00000-0000-4000-8000-000000000003','supersedesId','e7400000-0000-4000-8000-000000000006',
 'revision',2,'text','Synthetic original correction two','reason','Synthetic correction','sourceRef',jsonb_build_object('evidenceId','e7400000-0000-4000-8000-000000000006','observationIndex',0,'lineIndex',0),
 'replacementText','Synthetic original correction two'),jsonb_build_object('observationId','e7a00000-0000-4000-8000-000000000002','supersedesId','f7a00000-0000-4000-8000-000000000003',
 'revision',3,'text','Synthetic original correction three','reason','Synthetic correction','sourceRef',jsonb_build_object('evidenceId','e7400000-0000-4000-8000-000000000006','observationIndex',0,'lineIndex',0),
 'replacementText','Synthetic original correction three')))
 from private.part_one_captures cc join private.part_one_scans ss on ss.id=cc.scan_id where cc.id=(select (value->>'captureSessionId')::uuid from part_one_test_state where key='private-unresolved-cap')));
set local role authenticated;
insert into part_one_test_state values('private-v2-multiple-edits',public.part_one_operation('captures/observations',(select value from part_one_test_state where key='private-v2-multiple-edits-request')));
insert into part_one_test_state values('private-edit-order-recovery',public.part_one_operation('captures/evidence',(select jsonb_build_object('captureSessionId',value->'capture'->'captureSessionId')
 from part_one_test_state where key='private-v2-multiple-edits')));
select is((select value->'edits'->0->>'revision' from part_one_test_state where key='private-edit-order-recovery'),'2','A28 edit recovery preserves first supersedes revision despite UUID sort');
select is((select value->'edits'->1->>'revision' from part_one_test_state where key='private-edit-order-recovery'),'3','A28 latest recovered edit is actual latest chain revision');
select is((select value->'boundResult'->>'resultRevision' from part_one_test_state where key='private-edit-order-recovery'),
 (select value->'result'->>'resultRevision' from part_one_test_state where key='private-v2-multiple-edits'),'A28 latest bound commit uses capture revision rather than random UUID tie');
set local role postgres;
select public.begin_customer_account_deletion('e7100000-0000-4000-8000-000000000002');
delete from auth.users where id='e7100000-0000-4000-8000-000000000002';
select is((select count(*)::integer from private.part_one_records where owner_id='e7100000-0000-4000-8000-000000000002'),0,'A24 account erasure removes all private source/derived payloads');
select is((select count(*)::integer from private.part_one_capture_commits where owner_id='e7100000-0000-4000-8000-000000000002'),0,'A24 account erasure removes private receipt associations');
select is((select count(*)::integer from private.part_one_private_cleanup where object_id='e7400000-0000-4000-8000-000000000003'),1,'A24 account erase queues Storage cleanup before owner cascades');
-- Restore synthetic approval to its production-safe defaults inside rollback.
update private.part_one_private_config set enabled=false,process_allowed=false,ocr_allowed=false,upload_allowed=false,private_display_allowed=false;
update private.part_one_policies set retain_allowed=false,display_allowed=false where id='private_capture';
select set_config('request.jwt.claim.sub','e6000000-0000-4000-8000-000000000002',true);

insert into part_one_test_state values('before-worker-fence',(select to_jsonb(ss) from private.part_one_scans ss
 where ss.id=(select (value->>'scanId')::uuid from part_one_test_state where key='late-a')));
select public.begin_customer_account_deletion('e6000000-0000-4000-8000-000000000002');
update private.part_one_jobs set state='running',lease_token='e6900000-0000-4000-8000-000000000001',lease_expires_at=now()+interval '1 minute'
 where id=(select (value->>'jobId')::uuid from part_one_test_state where key='late-a');
select public.part_one_worker('finish',(select jsonb_build_object('jobId',j.id,'leaseToken',j.lease_token,'expectedPublishRevision',j.publish_revision,
 'targets',jsonb_build_array(jsonb_build_object('scanId',ss.id,'generation',ss.generation,'bindingRevision',ss.binding_revision)),
 'resultPatch',jsonb_build_object('reasonCodes',jsonb_build_array('should_not_publish_after_deletion')))
 from private.part_one_jobs j join private.part_one_scans ss on ss.job_id=j.id
 where ss.id=(select (value->>'scanId')::uuid from part_one_test_state where key='late-a')));
select is((select result_revision from private.part_one_scans where id=(select (value->>'scanId')::uuid from part_one_test_state where key='late-a')),
 (select (value->>'result_revision')::integer from part_one_test_state where key='before-worker-fence'),
 'A24 worker terminal publication leaves account-deletion-fenced owner result untouched');
select * from finish();
rollback;
