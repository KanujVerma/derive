/** Local integration regression: two real PostgreSQL sessions, no Auth/provider
 * transport or credentials. Exact task-owned Docker socket/container only.
 * Every fixture, configuration change and pgTAP extension setup rolls back.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

assert.equal(process.env.DOCKER_HOST, 'unix:///Users/kanuj/.colima/default/docker.sock', 'Explicit task-owned Docker socket required');
const container=process.env.CHECK_LEASE_DB_CONTAINER ?? 'supabase_db_derive-check-workflow-task6';
assert.ok(/^supabase_db_derive-(?:check-workflow-task6|check-part-three-integration)$/.test(container),'Only the two explicitly isolated synthetic test projects are permitted');
const directory=fileURLToPath(new URL('./db/check-lease-clock/',import.meta.url));
function session(name) {
 const child=spawn('/opt/homebrew/bin/docker',['exec','-i',container,'psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{stdio:['pipe','pipe','pipe']});
 let output='',error='';
 child.stdout.on('data',chunk=>{output+=chunk.toString();});
 child.stderr.on('data',chunk=>{error+=chunk.toString();});
 const done=new Promise(resolve=>child.on('exit',code=>resolve(code)));
 child.stdin.write(`set application_name = '${name}';\nset statement_timeout = '50s';\n`);
 async function marker(value) {
  const deadline=Date.now()+50_000;
  while(!output.includes(value)) {
   assert.equal(child.exitCode,null,`Session exited before ${value}: ${error}`);
   assert.ok(Date.now()<deadline,`Timed out waiting for ${value}: ${error}`);
   await delay(10);
  }
 }
 return {child,done,marker,write:sql=>child.stdin.write(sql),output:()=>output,error:()=>error};
}
const baseline=process.argv.includes('--baseline');
function originalFunction(path,name) {
 const source=readFileSync(fileURLToPath(new URL('../'+path,import.meta.url)),'utf8');
 const start=source.indexOf('create function '+name)>=0?source.indexOf('create function '+name):source.indexOf('create or replace function '+name);
 assert.ok(start>=0,'Original definition missing');
 return source.slice(start,source.indexOf('end $$;',start)+7).replace('create function ','create or replace function ');
}
const originalDefinitions=baseline?[
 originalFunction('supabase/migrations/20261002040000_part_one_evidence.sql','public.part_one_worker'),
 originalFunction('supabase/migrations/20261002170500_part_two_withdrawal_safe_label_projection.sql','public.part_two_resolve'),
 originalFunction('supabase/migrations/20261002170500_part_two_withdrawal_safe_label_projection.sql','public.part_two_worker'),
].join('\n'):'';
let assertions=0,regressions=0;
for(const file of readdirSync(directory).filter(name=>name.endsWith('.sql')).sort()) {
 const sql=readFileSync(directory+'/'+file,'utf8');
 let [setup,body,...unexpected]=sql.split('-- LEASE_CONTENTION_BLOCK');
 assert.ok(body&&!unexpected.length,'Each case requires exactly one actual contention boundary');
 if(baseline) {
  setup=setup.replace('begin;',()=> 'begin;\n'+originalDefinitions);
  // Stop each control after the targeted clock assertion: the old behavior
  // intentionally changes later state, so downstream recovery checks apply
  // only to the corrected implementation.
  const last=file.includes('claim')?'claim receives the full thirty seconds':file.includes('resolve')?'resolve receives thirty seconds':file.includes('renew')?'renewal that began before expiry':'publication begun before expiry';
  const position=body.indexOf(last);assert.ok(position>=0,'Missing negative-control assertion');
  body=body.slice(0,body.indexOf(';',position)+1)+'\nselect finish();\nrollback;\n';
 }
 const name='derive_lease_'+file.replace(/[^a-z_]/g,'').slice(0,40)+'_'+process.pid;
 const primary=session(name),blocker=session(name+'_blocker');
 try {
  primary.write(setup+"\nselect 'LEASE_SETUP_READY';\n");
  await primary.marker('LEASE_SETUP_READY');
  blocker.write("begin;\nselect pg_advisory_xact_lock(40203);\nselect 'LEASE_LOCK_HELD';\n");
  await blocker.marker('LEASE_LOCK_HELD');
  primary.write(body+"\nselect 'LEASE_BODY_COMPLETE';\n");
  // Verify the production RPC is actually waiting on this other backend.
  let waiting=false;
  const deadline=Date.now()+5000;
  while(!waiting&&Date.now()<deadline) {
   const nonce='LEASE_WAIT_'+Date.now();
   blocker.write(`select '${nonce}:'||exists(select 1 from pg_stat_activity where application_name='${name}' and wait_event_type='Lock' and pg_backend_pid()=any(pg_blocking_pids(pid)));\n`);
   await blocker.marker(nonce+':');
   waiting=blocker.output().includes(nonce+':true')||blocker.output().includes(nonce+':t');
   if(!waiting)await delay(20);
  }
  assert.ok(waiting,'Primary RPC must wait on the actual second session lifecycle lock');
  await delay(file.includes('claim')?32_000:1200);
  assert.ok(!primary.output().includes('LEASE_BODY_COMPLETE'),'RPC must remain blocked until lifecycle lock is released');
  blocker.write('rollback;\n');blocker.child.stdin.end();
  assert.equal(await blocker.done,0,blocker.error());
  await primary.marker('LEASE_BODY_COMPLETE');primary.child.stdin.end();
  assert.equal(await primary.done,0,primary.error());
  const tap=primary.output().split('\n').filter(line=>/^(?:not )?ok \d+|^1\.\.\d+|^#/.test(line));
  if(baseline) {
   const expected=file.includes('claim')?'claim receives the full thirty seconds':file.includes('resolve')?'resolve receives thirty seconds':file.includes('renew')?'renewal that began before expiry':'publication begun before expiry';
   assert.ok(tap.some(line=>line.startsWith('not ok')&&line.includes(expected)),'Original lease clocks must fail the targeted elapsed-time regression: '+tap.join('\n'));
   regressions++;
  } else assert.ok(!tap.some(line=>line.startsWith('not ok')),tap.join('\n'));
  const passed=tap.filter(line=>line.startsWith('ok ')).length;
  assert.ok(tap.some(line=>/^(?:not )?ok \d+/.test(line)),'No empty test receipt');assertions+=passed;
  console.log(file+' — real second-session contention ('+(file.includes('claim')?'32s':'1.2s')+'), '+passed+' assertions passed'+(baseline?', original-clock failure reproduced':''));
  console.log(tap.join('\n'));
 } finally {
  for(const current of [blocker,primary]) {
   if(current.child.exitCode===null) {
    current.child.stdin.end('rollback;\n');
    await Promise.race([current.done,delay(1000)]);
    if(current.child.exitCode===null)current.child.kill('SIGTERM');
   }
  }
 }
}
console.log(baseline?`Lease-clock negative controls: ${regressions} original-clock failures reproduced; definitions and fixtures rolled back.`:`Lease-clock concurrency: ${assertions} database assertions passed; all fixture transactions rolled back.`);
