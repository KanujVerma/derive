/**
 * Guarded hosted H1A post-auth smoke. Run only against the verified Derive
 * project with disposable users and an explicit admin-provisioned entitlement.
 * This never provisions membership from the client and is not OTP or billing proof.
 *
 * Phases: create -> provision -> run -> readback -> cleanup.
 * Credentials are kept only in a mode-0600 temporary state file outside Git.
 */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, openSync, closeSync, writeSync, fstatSync, fsyncSync, lstatSync, linkSync, renameSync, unlinkSync, constants } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = 'snojlbqovlawewwqbviz';
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;
const url = process.env.H1_HOSTED_SUPABASE_URL;
const key = process.env.H1_HOSTED_SUPABASE_PUBLISHABLE_KEY;
const statePath = process.env.H1A_HOSTED_STATE_PATH;
const phase = process.argv[2];
assert.equal(process.env.H1A_HOSTED_ALLOW_DISPOSABLE_TESTS, 'YES', 'Explicit hosted opt-in required');
assert.equal(url, PROJECT_URL, 'Wrong hosted project');
assert.match(key ?? '', /^sb_publishable_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$/, 'Modern public key required');
assert.match(statePath ?? '', /^\/private\/tmp\/derive-h1a-[A-Za-z0-9_-]+\.json$/, 'Private temporary state path required');
assert.ok(['create', 'provision', 'run', 'cleanup'].includes(phase), 'Choose create, provision, run, or cleanup');

const client = () => createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const TINY_JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');

function stateExists() {
  try { lstatSync(statePath); return true; }
  catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}
function privateStateFd(path, flags) {
  const fd = openSync(path, flags | constants.O_NOFOLLOW, 0o600);
  const info = fstatSync(fd);
  if (!info.isFile() || info.uid !== process.getuid() || (info.mode & 0o077) !== 0) {
    closeSync(fd);
    throw new Error('State file must be a private regular file owned by this user');
  }
  return fd;
}
function save(state) {
  const replacing = stateExists();
  if (replacing) closeSync(privateStateFd(statePath, constants.O_RDONLY));
  const tempPath = `${statePath}.${randomUUID()}.tmp`;
  const fd = privateStateFd(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL);
  try {
    const bytes = Buffer.from(JSON.stringify(state));
    let written = 0;
    while (written < bytes.length) {
      const count = writeSync(fd, bytes, written, bytes.length - written);
      assert.ok(count > 0, 'State write made no progress');
      written += count;
    }
    fsyncSync(fd);
  } catch (error) {
    try { closeSync(fd); } catch { /* Preserve the write error. */ }
    try { unlinkSync(tempPath); } catch { /* Preserve the write error. */ }
    throw error;
  }
  closeSync(fd);
  try {
    if (replacing) renameSync(tempPath, statePath);
    else {
      linkSync(tempPath, statePath);
      unlinkSync(tempPath);
    }
  } catch (error) {
    try { unlinkSync(tempPath); } catch { /* Preserve the original error. */ }
    throw error;
  }
}
function load({ allowExpired = false } = {}) {
  const fd = privateStateFd(statePath, constants.O_RDONLY);
  let raw;
  try { raw = readFileSync(fd, 'utf8'); } finally { closeSync(fd); }
  const state = JSON.parse(raw);
  assert.equal(state.projectRef, PROJECT_REF);
  if (!allowExpired) assert.ok(Date.now() - state.createdAt < 24 * 60 * 60 * 1000, 'Expired fixture state');
  return state;
}
async function signIn(account) {
  const instance = client();
  const { data, error } = await instance.auth.signInWithPassword({ email: account.email, password: account.password });
  assert.ifError(error);
  assert.ok(data.user?.id, 'Disposable identity missing');
  if (account.id) assert.equal(data.user.id, account.id, 'Disposable identity mismatch');
  else account.id = data.user.id;
  assert.ok(data.session?.access_token);
  return instance;
}
async function deleteAccount(account) {
  const instance = await signIn(account);
  const { data, error } = await instance.functions.invoke('delete-customer-account', {
    body: { confirmation: 'DELETE_MY_DERIVE_ACCOUNT' },
  });
  assert.ifError(error);
  assert.equal(data?.deleted, true);
}
async function create() {
  assert.equal(stateExists(), false, 'State file already exists');
  const state = { projectRef: PROJECT_REF, createdAt: Date.now(), accounts: [] };
  try {
    for (const role of ['member', 'founder']) {
      const instance = client();
      const email = `h1a-${role}-${randomUUID()}@example.test`;
      const password = `H1A!${randomBytes(30).toString('base64url')}`;
      const account = { role, id: null, email, password, deleted: false };
      state.accounts.push(account);
      save(state);
      const { data, error } = await instance.auth.signUp({ email, password });
      if (data?.user?.id) {
        account.id = data.user.id;
        save(state);
      }
      assert.ifError(error);
      assert.ok(data.user?.id && data.session?.access_token,
        'Disposable signup needs a controlled hosted session, not email OTP proof');
    }
    for (const account of state.accounts) console.log(`${account.role} user id: ${account.id}`);
    console.log('H1A disposable Auth sessions created; provision only these IDs through trusted admin SQL.');
  } catch (error) {
    const failed = [];
    for (const account of [...state.accounts].reverse()) {
      try { await deleteAccount(account); account.deleted = true; save(state); }
      catch { failed.push(account.id ?? account.email); }
    }
    if (failed.length) console.error('Manual cleanup needed for disposable identifiers:', failed.join(', '));
    else if (stateExists()) unlinkSync(statePath);
    throw error;
  }
}
function provision() {
  const state = load();
  const member = state.accounts.find((account) => account.role === 'member');
  const founder = state.accounts.find((account) => account.role === 'founder');
  assert.ok(member && founder && state.accounts.length === 2);
  for (const account of state.accounts) {
    assert.match(account.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.match(account.email, new RegExp(`^h1a-${account.role}-[0-9a-f-]+@example\\.test$`));
  }
  const sql = `begin;
do $$ begin
 if not exists(select 1 from auth.users where id='${member.id}'::uuid and email='${member.email}' and created_at>now()-interval '1 hour') then raise exception 'H1A member guard failed'; end if;
 if not exists(select 1 from auth.users where id='${founder.id}'::uuid and email='${founder.email}' and created_at>now()-interval '1 hour') then raise exception 'H1A founder guard failed'; end if;
 if exists(select 1 from public.memberships where user_id='${member.id}'::uuid) or exists(select 1 from public.founder_accounts where user_id='${founder.id}'::uuid) then raise exception 'H1A fixture already exists'; end if;
 insert into public.memberships(user_id,tier,status) values('${member.id}'::uuid,'founding_beta','active');
 insert into public.founder_accounts(user_id,role,status) values('${founder.id}'::uuid,'founder','active');
end $$;
commit;`;
  const cli = process.env.H1A_SUPABASE_CLI || 'supabase';
  const output = execFileSync(cli, ['db', 'query', '--linked', '--project-ref', PROJECT_REF, sql, '--output-format', 'json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.ok(JSON.parse(output), 'Trusted CLI provisioning did not return JSON');
  console.log('Trusted management CLI provisioned one disposable active membership and one founder allowlist row.');
}
async function invoke(instance, name, body) {
  const { data, error } = await instance.functions.invoke(name, { body });
  return { data, error, status: error?.context?.status ?? 200 };
}
async function run() {
  const state = load();
  const memberAccount = state.accounts.find((account) => account.role === 'member');
  const founderAccount = state.accounts.find((account) => account.role === 'founder');
  assert.ok(memberAccount && founderAccount);
  const member = await signIn(memberAccount);
  const founder = await signIn(founderAccount);

  const membership = await member.from('memberships').select('status').eq('user_id', memberAccount.id).single();
  assert.ifError(membership.error);
  assert.equal(membership.data.status, 'active', 'Admin staging entitlement must be visible canonically');
  const foreignProfile = await founder.from('profiles').select('id').eq('id', memberAccount.id);
  assert.ifError(foreignProfile.error);
  assert.deepEqual(foreignProfile.data, []);
  assert.equal((await invoke(member, 'founder-operations', { action: 'dashboard' })).status, 403);
  assert.equal((await invoke(founder, 'founder-operations', { action: 'dashboard' })).status, 200);
  console.log('Controlled Auth, canonical active entitlement and founder allowlist: PASS');

  if (!state.submissionId) {
    const prepared = await invoke(member, 'prepare-onboarding', {});
    assert.ifError(prepared.error);
    assert.equal(prepared.data.submissionStatus, 'draft');
    const submissionId = prepared.data.submissionId;
    for (const angle of ['front', 'left', 'right']) {
      const target = prepared.data.uploadTargets[angle];
      assert.ok(target.path.startsWith(`${memberAccount.id}/${angle}/`));
      if (!target.uploaded) {
        const upload = await member.storage.from('customer-skin-photos').upload(target.path, TINY_JPEG, {
          contentType: 'image/jpeg', upsert: false,
        });
        assert.ifError(upload.error);
      }
    }
    const payload = {
      primaryGoal: 'breakouts', secondaryGoals: ['texture'], routineComplexity: 'simple',
      costPreference: 'balanced', middayFeel: 'combination', postCleanseTightness: false,
      confirmedProducts: [{ brand: 'H1A Example', name: 'Manual Test Cleanser', category: 'cleanser', userShelfAction: 'keep', keyActives: [] }],
      productReactions: [{ id: `rx-${randomUUID()}`, userId: memberAccount.id,
        productNameSnapshot: 'Earlier Synthetic Serum', brandSnapshot: 'H1A Example',
        symptoms: ['redness_rash'], bodyArea: 'face', severity: 'mild',
        notes: 'Synthetic test reaction history' }],
      pihTendencyAnswer: 'Sometimes', hasBadReactions: true,
      safetyContext: { pregnancyStatus: 'no', isPregnantOrNursing: false,
        sensitivitiesStatus: 'none_known', knownSensitivities: [], activePrescriptions: [] },
    };
    const committed = await invoke(member, 'onboard-customer', { submissionId, payload });
    assert.ifError(committed.error);
    assert.equal(committed.data.userId, memberAccount.id);
    assert.equal(committed.data.skinProfile.onboardingCompleted, true);
    state.submissionId = submissionId;
    save(state);
    console.log('Hosted manual Shelf intake and three private photos committed:', submissionId);
  } else {
    console.log('Resuming committed disposable intake:', state.submissionId);
  }

  const ownPhotos = await member.from('user_photos').select('id,photo_type,storage_path').eq('user_id', memberAccount.id);
  assert.ifError(ownPhotos.error);
  assert.equal(ownPhotos.data.length, 3);
  const foreignPhotos = await founder.from('user_photos').select('id').eq('user_id', memberAccount.id);
  assert.ifError(foreignPhotos.error);
  assert.deepEqual(foreignPhotos.data, []);
  const foreignSkin = await founder.from('skin_profiles').select('id').eq('user_id', memberAccount.id);
  assert.ifError(foreignSkin.error);
  assert.deepEqual(foreignSkin.data, []);
  const photoId = ownPhotos.data.find((photo) => photo.photo_type === 'front')?.id;
  assert.ok(photoId);
  const ownerSigned = await invoke(member, 'photo-url', { photoId });
  assert.ifError(ownerSigned.error);
  assert.equal(ownerSigned.data.expiresIn, 900);
  assert.equal(new URL(ownerSigned.data.signedUrl).hostname, `${PROJECT_REF}.supabase.co`);
  assert.equal((await fetch(ownerSigned.data.signedUrl)).status, 200);
  assert.equal((await invoke(founder, 'photo-url', { photoId })).status, 404);
  const direct = await fetch(`${PROJECT_URL}/storage/v1/object/public/customer-skin-photos/${ownPhotos.data[0].storage_path}`);
  assert.notEqual(direct.status, 200, 'Private Storage cannot expose a public object URL');
  console.log('Private photo metadata, bounded owner signing and cross-user denial: PASS');

  const proposal = await invoke(member, 'propose-routine', {});
  console.log(`Real provider/proposal status: ${proposal.status}`);
  if (proposal.status !== 200) {
    const code = proposal.error?.context?.clone
      ? (await proposal.error.context.clone().json().catch(() => null))?.code : null;
    console.log(`Proposal boundary code: ${code ?? 'unavailable'}`);
  }
  console.log('H1A state retained for independent hosted readback; run cleanup afterward.');
}
async function cleanup() {
  const state = load({ allowExpired: true });
  const failed = [];
  for (const account of [...state.accounts].reverse().filter((entry) => !entry.deleted)) {
    try {
      await deleteAccount(account);
      account.deleted = true;
      save(state);
      console.log(`Deleted disposable ${account.role} account`);
    }
    catch { failed.push(account.id ?? account.email); }
  }
  if (failed.length) {
    console.error('Manual cleanup needed for disposable identifiers:', failed.join(', '));
    process.exitCode = 1;
    return;
  }
  unlinkSync(statePath);
  console.log('H1A disposable accounts self-deleted; verify hosted row and object counts separately.');
}

if (phase === 'create') await create();
if (phase === 'provision') provision();
if (phase === 'run') await run();
if (phase === 'cleanup') await cleanup();
