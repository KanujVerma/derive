/** Prove the upload/deletion lock ordering against an isolated local database. */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8' }));
assert.equal(new URL(status.API_URL).hostname, '127.0.0.1', 'Refuse non-local Supabase');
const projectId = readFileSync('supabase/config.toml', 'utf8').match(/^project_id = "([a-zA-Z0-9_-]+)"/m)?.[1];
assert.ok(projectId, 'Local project ID is required');
const dbContainer = `supabase_db_${projectId}`;
const containers = execFileSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' });
assert.ok(containers.split('\n').includes(dbContainer), 'Matching local database container is required');
const makeClient = (key) => createClient(status.API_URL, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const admin = makeClient(status.SERVICE_ROLE_KEY);
const guest = makeClient(status.ANON_KEY);
let userId;
let transaction;

try {
  const signedIn = await guest.auth.signInAnonymously();
  assert.ifError(signedIn.error);
  userId = signedIn.data.user.id;

  transaction = spawn('docker', ['exec', '-i', dbContainer, 'psql', '-X', '-q', '-A', '-t',
    '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  transaction.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  transaction.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  transaction.stdin.write(`begin;
set local role authenticated;
set local request.jwt.claim.sub = '${userId}';
select 'LOCK_HELD' where public.customer_private_upload_allowed();
`);
  const deadline = Date.now() + 10_000;
  while (!stdout.includes('LOCK_HELD') && Date.now() < deadline) {
    assert.equal(transaction.exitCode, null, `Lock holder exited: ${stderr}`);
    await delay(25);
  }
  assert.match(stdout, /LOCK_HELD/, `Could not acquire upload lock: ${stderr}`);

  let transitionSettled = false;
  const transition = admin.rpc('begin_customer_account_deletion', { p_user_id: userId })
    .then((result) => { transitionSettled = true; return result; });
  await delay(250);
  assert.equal(transitionSettled, false, 'Deletion must wait for an admitted upload transaction');

  transaction.stdin.write('commit;\n');
  const result = await Promise.race([
    transition,
    delay(10_000).then(() => { throw new Error('Deletion did not resume after upload commit'); }),
  ]);
  assert.ifError(result.error);
  assert.equal(result.data, true);
  const allowedAfter = await guest.rpc('customer_private_upload_allowed');
  assert.ifError(allowedAfter.error);
  assert.equal(allowedAfter.data, false, 'A later upload sees the deletion marker');
  console.log('P0-C deletion waits for admitted upload and fences subsequent uploads');
} finally {
  if (transaction) {
    transaction.stdin.end();
    transaction.kill();
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
}
