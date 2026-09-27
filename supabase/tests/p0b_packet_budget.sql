begin;
set local search_path to public, extensions;
select plan(9);
insert into auth.users(id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values ('afafafaf-afaf-4faf-8faf-afafafafafaf','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p0b-budget@example.test','',now(),now());

-- A valid maximum routine can exceed the old 200 KB packet bound.
-- Engine/renderer integration tests supply the actual multi-finding packet;
-- these storage tests isolate byte, JSON type, immutable and privilege limits.
select lives_ok($$select public.persist_personal_decision_assessment(
 'afafafaf-afaf-4faf-8faf-afafafafafaf','a1111111-1111-4111-8111-111111111111',
 '{"expectedContextRevision":0}',jsonb_build_object('fixture',repeat('x',450000)),
 null,null,null,'budget-proof','fixture','fixture','fixture')$$,
 'A bounded packet larger than the old cap persists');
select lives_ok($$select public.persist_personal_decision_assessment(
 'afafafaf-afaf-4faf-8faf-afafafafafaf','a2222222-2222-4222-8222-222222222222',
 '{"expectedContextRevision":0}',jsonb_build_object('fixture',repeat('é',260000)),
 null,null,null,'unicode-proof','fixture','fixture','fixture')$$,
 'UTF8 packet bytes within budget persist');
select throws_ok($$select public.persist_personal_decision_assessment(
 'afafafaf-afaf-4faf-8faf-afafafafafaf','a3333333-3333-4333-8333-333333333333',
 '{"expectedContextRevision":0}',jsonb_build_object('fixture',repeat('é',530000)),
 null,null,null,'unicode-over-budget','fixture','fixture','fixture')$$,
 '23514',null,'UTF8 bytes over one MiB are rejected even below one million characters');
select throws_ok($$select public.persist_personal_decision_assessment(
 'afafafaf-afaf-4faf-8faf-afafafafafaf','a4444444-4444-4444-8444-444444444444',
 '{"expectedContextRevision":0}','[]',null,null,null,'wrong-type','fixture','fixture','fixture')$$,
 '23514',null,'Non-object packets remain rejected');
select lives_ok($$select public.persist_personal_decision_assessment(
 'afafafaf-afaf-4faf-8faf-afafafafafaf','a5555555-5555-4555-8555-555555555555',
 jsonb_build_object('expectedContextRevision',0,'fixture',repeat('é',200000)),
 '{"fixture":true}',null,null,null,'input-budget','fixture','fixture','fixture')$$,
 'Bounded evaluated formula projection larger than old input cap persists');
select throws_ok($$select public.persist_personal_decision_assessment(
 'afafafaf-afaf-4faf-8faf-afafafafafaf','a6666666-6666-4666-8666-666666666666',
 jsonb_build_object('expectedContextRevision',0,'fixture',repeat('é',270000)),
 '{"fixture":true}',null,null,null,'input-over-budget','fixture','fixture','fixture')$$,
 '23514',null,'Evaluated input over 512 KiB in UTF8 bytes remains rejected');
select throws_ok($$update public.personal_decision_assessments set packet='{}'
 where user_id='afafafaf-afaf-4faf-8faf-afafafafafaf'$$,
 'P0001','IMMUTABLE_CONTEXT_REVISION','Wider byte budget does not permit edits');
select ok(not has_table_privilege('authenticated','public.personal_decision_assessments','SELECT,INSERT,UPDATE,DELETE'),
 'Wider packet budget does not grant client access');
delete from auth.users where id='afafafaf-afaf-4faf-8faf-afafafafafaf';
select is((select count(*)::int from public.personal_decision_assessments
 where user_id='afafafaf-afaf-4faf-8faf-afafafafafaf'),0,'Budget-test assessments cascade on identity deletion');
select * from finish();
rollback;
