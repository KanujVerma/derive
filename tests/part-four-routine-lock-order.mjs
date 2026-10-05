/** Isolated PostgreSQL race fixture. Root supplies a freshly seeded, ready exact
 * routine/P1/P2 fixture; every mutation below is rolled back. No provider or
 * hosted request is made. Usage:
 * PART_FOUR_LOCK_FIXTURE=/tmp/routine-lock-fixture.json
 * PART_ONE_DB_CONTAINER=supabase_db_derive-part-four-integration node this-file
 * Fixture: {ownerId,sourceObservationId,savedAssessmentId,resultId,
 * requests:[RoutineFormulaRequest,...]}.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const container=process.env.PART_ONE_DB_CONTAINER;
if(!container||!/^supabase_db_derive-part-four-(?:integration|disposable|local)(?:[-_].*)?$/.test(container))throw Error('A disposable Part Four integration database is required');
const fixture=JSON.parse(await readFile(process.env.PART_FOUR_LOCK_FIXTURE,'utf8'));
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
assert(uuid.test(fixture.ownerId)&&uuid.test(fixture.sourceObservationId));
assert(uuid.test(fixture.savedAssessmentId)&&uuid.test(fixture.resultId));
assert(Array.isArray(fixture.requests)&&fixture.requests.length>0&&fixture.requests.length<=50);
const literal=value=>`'${String(value).replaceAll("'","''")}'`;
const sql=query=>new Promise((resolve,reject)=>{
 const config=process.env.PART_ONE_DOCKER_CONFIG?['--config',process.env.PART_ONE_DOCKER_CONFIG]:[];
 const child=spawn('/opt/homebrew/bin/docker',[...config,'exec','-i',container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq'],{stdio:['pipe','pipe','pipe']});
 let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.once('error',reject);
 child.once('close',code=>code===0?resolve(out.trim()):reject(Error(`Isolated transaction failed: ${err.split('\n').find(line=>line.startsWith('ERROR:'))??'transport failure'}`)));
 child.stdin.end(query);
});
const ready=`select coalesce(bool_and(value->>'state'='ready'),false) from jsonb_array_elements(public.part_four_routine_formula_worker(${literal(fixture.ownerId)}::uuid,${literal(JSON.stringify(fixture.requests))}::jsonb));`;
assert.equal(await sql(`begin;${ready}rollback;`),'t','Supplied fixture must genuinely authorize each exact routine formula');
assert.equal(await sql(`select exists(select 1 from public.part_three_results where id=${literal(fixture.resultId)}::uuid and owner_id=${literal(fixture.ownerId)}::uuid and payload is not null) and exists(select 1 from public.part_three_saved_assessments where id=${literal(fixture.savedAssessmentId)}::uuid and owner_id=${literal(fixture.ownerId)}::uuid and packet is not null);`),'t','Direct mutation races require the actual current and saved fixture rows');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(application,event){
 const deadline=Date.now()+10000;
 while(Date.now()<deadline){
  if(await sql(`select exists(select 1 from pg_stat_activity where application_name=${literal(application)} and wait_event=${literal(event)});`)==='t')return;
  await pause(40);
 }
 throw Error(`Transaction did not reach ${event}; no lock-order claim established`);
}
const mutations=[
 ['withdraw source',`insert into private.part_one_record_status(record_id,status) values(${literal(fixture.sourceObservationId)}::uuid,'revoked') on conflict(record_id) do update set status='revoked';`],
 ['delete source',`delete from private.part_one_records where id=${literal(fixture.sourceObservationId)}::uuid;`],
 ['delete owner',`delete from auth.users where id=${literal(fixture.ownerId)}::uuid;`],
 ['update saved packet',`update public.part_three_saved_assessments set packet=packet where id=${literal(fixture.savedAssessmentId)}::uuid;`],
 ['delete current result',`delete from public.part_three_results where id=${literal(fixture.resultId)}::uuid;`],
];
// Re-read the rows after the competing writer has entered. A row-first writer
// waiting for our globals would deadlock here; statement fences must make it
// wait before obtaining these parent/current/saved row locks.
const readerRows=`select 1 from private.part_one_records where id=${literal(fixture.sourceObservationId)}::uuid for share;
 select 1 from private.part_one_record_status where record_id=${literal(fixture.sourceObservationId)}::uuid for share;
 select 1 from auth.users where id=${literal(fixture.ownerId)}::uuid for share;
 select 1 from public.part_three_saved_assessments where id=${literal(fixture.savedAssessmentId)}::uuid for share;
 select 1 from public.part_three_results where id=${literal(fixture.resultId)}::uuid for share;`;
let assertions=2;
for(const [name,mutation] of mutations){
 // Reader first: inherited lifecycle mutation must wait before source/owner
 // rows, then finish after the routine authorization transaction releases.
 const a=`p4-routine-${randomUUID()}`,b=`p4-lifecycle-${randomUUID()}`;
 const reader=sql(`set application_name=${literal(a)};begin;set local statement_timeout='12s';${ready}select pg_sleep(2);${readerRows}rollback;`);
 await waitFor(a,'PgSleep');
 const writer=sql(`set application_name=${literal(b)};begin;set local statement_timeout='12s';${mutation}rollback;`);
 await waitFor(b,'advisory');
 assert((await reader).split('\n').includes('t'),`${name}: ready reader basis`);await writer;assertions+=2;
 // Writer first: its rollback must unblock the lookup without an inversion;
 // the returned exact formula remains ready because nothing was committed.
 const c=`p4-lifecycle-${randomUUID()}`,d=`p4-routine-${randomUUID()}`;
 const first=sql(`set application_name=${literal(c)};begin;set local statement_timeout='12s';${mutation}select pg_sleep(2);rollback;`);
 await waitFor(c,'PgSleep');
 const second=sql(`set application_name=${literal(d)};begin;set local statement_timeout='12s';${ready}rollback;`);
 await waitFor(d,'advisory');await first;
 assert((await second).split('\n').includes('t'),`${name}: reader ready after lifecycle rollback`);assertions+=2;
}
console.log(`Part Four routine lifecycle concurrency: ${assertions} assertions passed; all fixture mutations rolled back.`);
