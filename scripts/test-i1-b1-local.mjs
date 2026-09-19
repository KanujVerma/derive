// scripts/test-i1-b1-local.mjs
// DERIVE S1 Committed Local E2E Test Harness
// Exercises: Auth, Gateway JWT Gate, prepare-onboarding, direct private Storage,
// onboard-customer transactional RPC, rollback, replay idempotency, private
// photo signing, and Storage-first account deletion.

import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Tiny synthetic 1x1 JPEG blob
const TINY_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const tinyJpegBytes = Buffer.from(TINY_JPEG_BASE64, 'base64');

async function run() {
  console.log('=== DERIVE S1 Local Full-Stack E2E Test Harness ===\n');

  // -------------------------------------------------------------
  // Step 1: Platform Gateway JWT Gate Verification
  // -------------------------------------------------------------
  console.log('1. Testing Platform Gateway JWT Verification...');
  {
    // No Authorization
    const resNoAuth = await fetch(`${SUPABASE_URL}/functions/v1/prepare-onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(resNoAuth.status, 401, 'prepare-onboarding without auth must return 401');

    // Malformed Authorization
    const resBadAuth = await fetch(`${SUPABASE_URL}/functions/v1/prepare-onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid.jwt.token',
      },
      body: JSON.stringify({}),
    });
    assert.equal(resBadAuth.status, 401, 'prepare-onboarding with malformed token must return 401');

    // onboard-customer without auth
    const resCommitNoAuth = await fetch(`${SUPABASE_URL}/functions/v1/onboard-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(resCommitNoAuth.status, 401, 'onboard-customer without auth must return 401');

    const resPhotoNoAuth = await fetch(`${SUPABASE_URL}/functions/v1/photo-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: '00000000-0000-4000-8000-000000000000' }),
    });
    assert.equal(resPhotoNoAuth.status, 401, 'photo-url without auth must return 401');

    const resDeleteNoAuth = await fetch(`${SUPABASE_URL}/functions/v1/delete-customer-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE_MY_DERIVE_ACCOUNT' }),
    });
    assert.equal(resDeleteNoAuth.status, 401, 'delete-customer-account without auth must return 401');
    console.log('   ✓ Platform JWT gate correctly blocks unauthenticated requests (401)');
  }

  // -------------------------------------------------------------
  // Step 2: Create Synthetic Test Users
  // -------------------------------------------------------------
  console.log('2. Creating synthetic test users...');
  const runId = Date.now();
  const user1Email = `member_b1_e2e_${runId}_1@example.test`;
  const user2Email = `member_b1_e2e_${runId}_2@example.test`;
  const testPassword = 'TestPassword123!';

  const { data: u1Create, error: u1Err } = await adminClient.auth.admin.createUser({
    email: user1Email,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Member B1.1 Synthetic One' },
  });
  assert.ok(!u1Err && u1Create?.user, `Failed creating user 1: ${u1Err?.message}`);
  const user1 = u1Create.user;

  const { data: u2Create, error: u2Err } = await adminClient.auth.admin.createUser({
    email: user2Email,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Member B1.1 Synthetic Two' },
  });
  assert.ok(!u2Err && u2Create?.user, `Failed creating user 2: ${u2Err?.message}`);
  const user2 = u2Create.user;

  assert.ifError((await adminClient.from('memberships').insert([
    { user_id: user1.id, tier: 'founding_beta', status: 'active' },
    { user_id: user2.id, tier: 'founding_beta', status: 'active' },
  ])).error);

  // Sign in as user 1 to get client with valid session JWT
  const user1Client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: u1Sign, error: u1SignErr } = await user1Client.auth.signInWithPassword({
    email: user1Email,
    password: testPassword,
  });
  assert.ok(!u1SignErr && u1Sign.session, `User 1 sign in failed: ${u1SignErr?.message}`);
  const user1Jwt = u1Sign.session.access_token;

  // Sign in as user 2
  const user2Client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: u2Sign, error: u2SignErr } = await user2Client.auth.signInWithPassword({
    email: user2Email,
    password: testPassword,
  });
  assert.ok(!u2SignErr && u2Sign.session, `User 2 sign in failed: ${u2SignErr?.message}`);
  const user2Jwt = u2Sign.session.access_token;
  console.log(`   ✓ Authenticated test users: ${user1.id} and ${user2.id}`);

  // -------------------------------------------------------------
  // Step 3: Invoke prepare-onboarding
  // -------------------------------------------------------------
  console.log('3. Invoking prepare-onboarding with user 1 JWT...');
  const { data: prepData, error: prepErr } = await user1Client.functions.invoke('prepare-onboarding', {
    body: {},
  });
  assert.ok(!prepErr, `prepare-onboarding failed: ${prepErr?.message}`);
  assert.ok(prepData.submissionId, 'prepare-onboarding must return submissionId');
  assert.equal(prepData.submissionStatus, 'draft', 'prepare-onboarding must return draft status');
  assert.ok(prepData.uploadTargets.front.path.startsWith(`${user1.id}/front/`), 'front path must start with userId/front/');
  assert.ok(prepData.uploadTargets.left.path.startsWith(`${user1.id}/left/`), 'left path must start with userId/left/');
  assert.ok(prepData.uploadTargets.right.path.startsWith(`${user1.id}/right/`), 'right path must start with userId/right/');
  assert.ok(prepData.uploadTargets.shelf.path.startsWith(`${user1.id}/shelf/`), 'shelf path must start with userId/shelf/');
  assert.equal(prepData.uploadTargets.front.uploaded, false);
  console.log(`   ✓ Draft created: ${prepData.submissionId}`);

  // -------------------------------------------------------------
  // Step 4: Cross-User Authorization Gating
  // -------------------------------------------------------------
  console.log('4. Testing cross-user authorization defense...');
  const { error: crossErr } = await user2Client.functions.invoke('onboard-customer', {
    body: {
      submissionId: prepData.submissionId, // User 2 trying to commit User 1's submission
      payload: {
        primaryGoal: 'breakouts',
        routineComplexity: 'simple',
        costPreference: 'balanced',
        middayFeel: 'combination',
      },
    },
  });
  assert.ok(crossErr, 'User 2 committing User 1 submission must fail');
  console.log('   ✓ Cross-user submission access rejected (fail-closed)');

  // -------------------------------------------------------------
  // Step 5: Failure Before DB Finalizer (Missing Photos)
  // -------------------------------------------------------------
  console.log('5. Testing failure before finalizer (missing photos)...');
  const { error: missingPhotoErr } = await user1Client.functions.invoke('onboard-customer', {
    body: {
      submissionId: prepData.submissionId,
      payload: {
        primaryGoal: 'breakouts',
        routineComplexity: 'simple',
        costPreference: 'balanced',
        middayFeel: 'combination',
      },
    },
  });
  assert.ok(missingPhotoErr, 'Commit without uploading photos must fail');
  // Verify draft remains status draft and profile not completed
  const { data: draftCheck } = await adminClient
    .from('onboarding_submissions')
    .select('status')
    .eq('id', prepData.submissionId)
    .single();
  assert.equal(draftCheck.status, 'draft', 'Draft status must remain draft');
  console.log('   ✓ Missing photos fail closed; draft remains in draft state');

  // -------------------------------------------------------------
  // Step 6: Direct Private Storage Upload
  // -------------------------------------------------------------
  console.log('6. Uploading synthetic photos directly to customer-skin-photos bucket...');
  const uploadPhoto = async (storagePath) => {
    const { data, error } = await user1Client.storage
      .from('customer-skin-photos')
      .upload(storagePath, tinyJpegBytes, { contentType: 'image/jpeg', upsert: false });
    assert.ok(!error, `Failed uploading to ${storagePath}: ${error?.message}`);
    return data;
  };

  await uploadPhoto(prepData.uploadTargets.front.path);
  await uploadPhoto(prepData.uploadTargets.left.path);
  await uploadPhoto(prepData.uploadTargets.right.path);

  // Verify prepare-onboarding now reports uploaded: true
  const { data: prepVerify } = await user1Client.functions.invoke('prepare-onboarding', { body: {} });
  assert.equal(prepVerify.submissionId, prepData.submissionId, 'Must resume same draft submission');
  assert.equal(prepVerify.uploadTargets.front.uploaded, true, 'front must be uploaded');
  assert.equal(prepVerify.uploadTargets.left.uploaded, true, 'left must be uploaded');
  assert.equal(prepVerify.uploadTargets.right.uploaded, true, 'right must be uploaded');
  console.log('   ✓ Private photos uploaded with upsert=false; prepare detects uploaded files');

  // -------------------------------------------------------------
  // Step 7: Relational Rollback on Invalid Input
  // -------------------------------------------------------------
  console.log('7. Testing atomic transaction rollback on invalid relational input...');
  const { error: invalidErr } = await user1Client.functions.invoke('onboard-customer', {
    body: {
      submissionId: prepData.submissionId,
      payload: {
        primaryGoal: 'breakouts',
        routineComplexity: 'INVALID_COMPLEXITY_FOR_TEST',
        costPreference: 'balanced',
        middayFeel: 'combination',
      },
    },
  });
  assert.ok(invalidErr, 'Invalid routineComplexity must cause commit failure');

  // Verify all tables rolled back
  const { data: subRollback } = await adminClient
    .from('onboarding_submissions')
    .select('status')
    .eq('id', prepData.submissionId)
    .single();
  assert.equal(subRollback.status, 'draft', 'Submission status must still be draft after rollback');

  const { data: photosRollback } = await adminClient
    .from('user_photos')
    .select('id')
    .eq('user_id', user1.id);
  assert.equal(photosRollback.length, 0, 'No user_photos rows must exist after rollback');

  const { data: tasksRollback } = await adminClient
    .from('founder_review_tasks')
    .select('id')
    .eq('user_id', user1.id);
  assert.equal(tasksRollback.length, 0, 'No founder_review_tasks must exist after rollback');
  console.log('   ✓ Transactional RPC rolled back atomically on error (zero partial state)');

  // -------------------------------------------------------------
  // Step 8: Successful Atomic Commit
  // -------------------------------------------------------------
  console.log('8. Finalizing valid onboarding intake commit...');
  const validPayload = {
    primaryGoal: 'breakouts',
    secondaryGoals: ['texture'],
    routineComplexity: 'simple',
    costPreference: 'balanced',
    middayFeel: 'combination',
    postCleanseTightness: false,
    confirmedProducts: [{ brand: 'CeraVe', name: 'Hydrating Cleanser', category: 'cleanser', userShelfAction: 'keep' }],
    productReactions: [],
    safetyContext: {
      knownSensitivities: [],
      sensitivitiesStatus: 'none_known',
      activePrescriptions: [],
      isPregnantOrNursing: false,
      pregnancyStatus: 'no',
    },
  };

  const { data: commitResult, error: commitErr } = await user1Client.functions.invoke('onboard-customer', {
    body: {
      submissionId: prepData.submissionId,
      payload: validPayload,
    },
  });

  assert.ok(!commitErr, `onboard-customer failed: ${commitErr?.message}`);
  assert.equal(commitResult.userId, user1.id);
  assert.equal(commitResult.proposedRoutine, null, 'proposedRoutine must be null in B1');
  assert.equal(commitResult.initialRoutineState, 'pending_generation');
  assert.deepEqual(commitResult.userProducts, []);
  assert.equal(commitResult.skinProfile.onboardingCompleted, true);

  // Verify database state directly
  const { data: subCommitted } = await adminClient
    .from('onboarding_submissions')
    .select('status, payload_snapshot')
    .eq('id', prepData.submissionId)
    .single();
  assert.equal(subCommitted.status, 'committed', 'Submission status must be committed');
  assert.ok(subCommitted.payload_snapshot, 'Snapshot must be persisted');
  assert.equal(subCommitted.payload_snapshot.skinPhotos.frontStoragePath, prepData.uploadTargets.front.path);

  const { data: skinProfile } = await adminClient
    .from('skin_profiles')
    .select('onboarding_completed, primary_goal')
    .eq('user_id', user1.id)
    .single();
  assert.equal(skinProfile.onboarding_completed, true);
  assert.equal(skinProfile.primary_goal, 'breakouts');

  const { data: userPhotos } = await adminClient
    .from('user_photos')
    .select('id, photo_type, storage_path')
    .eq('user_id', user1.id);
  assert.equal(userPhotos.length, 3, 'Must have exactly 3 photo rows');

  const { data: founderTasks } = await adminClient
    .from('founder_review_tasks')
    .select('id, task_type, status')
    .eq('user_id', user1.id);
  assert.equal(founderTasks.length, 1, 'Must have exactly 1 pending founder review task');
  assert.equal(founderTasks[0].task_type, 'initial_routine');
  assert.equal(founderTasks[0].status, 'pending');

  const { data: routines } = await adminClient
    .from('routines')
    .select('id')
    .eq('user_id', user1.id);
  assert.equal(routines.length, 0, 'Must have zero routine rows (deferred to I1-B2)');
  console.log('   ✓ Atomic commit successful (submission committed, photos, task, skin profile complete, no fake routine)');

  // -------------------------------------------------------------
  // Step 9: Response-Loss Replay Idempotency
  // -------------------------------------------------------------
  console.log('9. Testing response-loss replay idempotency (invoking onboard-customer again)...');
  const { data: replayResult, error: replayErr } = await user1Client.functions.invoke('onboard-customer', {
    body: {
      submissionId: prepData.submissionId,
      payload: validPayload,
    },
  });
  assert.ok(!replayErr, `Replay call failed: ${replayErr?.message}`);
  assert.equal(replayResult.userId, user1.id);
  assert.equal(replayResult.skinProfile.onboardingCompleted, true);
  assert.equal(replayResult.initialRoutineState, 'pending_generation');

  // Verify no duplicate records created
  const { data: photosAfterReplay } = await adminClient
    .from('user_photos')
    .select('id')
    .eq('user_id', user1.id);
  assert.equal(photosAfterReplay.length, 3, 'Replay must not duplicate user_photos');

  const { data: tasksAfterReplay } = await adminClient
    .from('founder_review_tasks')
    .select('id')
    .eq('user_id', user1.id);
  assert.equal(tasksAfterReplay.length, 1, 'Replay must not duplicate founder_review_tasks');
  console.log('   ✓ Replay succeeds cleanly with zero duplicate records');

  // -------------------------------------------------------------
  // Step 10: Prepare After Commit Resumption
  // -------------------------------------------------------------
  console.log('10. Testing prepare-onboarding after commit...');
  const { data: postCommitPrep, error: postPrepErr } = await user1Client.functions.invoke('prepare-onboarding', {
    body: {},
  });
  assert.ok(!postPrepErr, `Post-commit prepare failed: ${postPrepErr?.message}`);
  assert.equal(postCommitPrep.submissionId, prepData.submissionId, 'Must reuse committed submission');
  assert.equal(postCommitPrep.submissionStatus, 'committed', 'Status must be committed');
  assert.equal(postCommitPrep.uploadTargets.front.uploaded, true, 'front must remain uploaded');

  const { data: allSubs } = await adminClient
    .from('onboarding_submissions')
    .select('id, status')
    .eq('user_id', user1.id);
  assert.equal(allSubs.length, 1, 'Must have exactly 1 onboarding_submissions row for user');
  console.log('   ✓ prepare-onboarding reuses committed submission without creating new draft');

  // -------------------------------------------------------------
  // Step 11: Database Protection: Single Committed Submission
  // -------------------------------------------------------------
  console.log('11. Testing single committed submission index constraint...');
  const { error: dupCommitErr } = await adminClient
    .from('onboarding_submissions')
    .insert({
      user_id: user1.id,
      status: 'committed',
      front_storage_path: `${user1.id}/front/dup.jpg`,
      left_storage_path: `${user1.id}/left/dup.jpg`,
      right_storage_path: `${user1.id}/right/dup.jpg`,
    });
  assert.ok(dupCommitErr, 'Inserting second committed submission must violate unique index');
  assert.equal(dupCommitErr.code, '23505', 'Must fail with 23505 unique violation');
  console.log('   ✓ Partial unique index blocks duplicate committed submissions');

  // -------------------------------------------------------------
  // Step 12: JWT-Bound Private Photo Signing
  // -------------------------------------------------------------
  console.log('12. Testing JWT-bound 15-minute private photo signing...');
  const targetPhoto = userPhotos.find((photo) => photo.photo_type === 'front');
  assert.ok(targetPhoto?.id, 'Committed front photo must have a metadata ID');

  const signedResponse = await fetch(`${SUPABASE_URL}/functions/v1/photo-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Jwt}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ photoId: targetPhoto.id }),
  });
  assert.equal(signedResponse.status, 200, 'Owner must receive a signed photo URL');
  assert.match(signedResponse.headers.get('cache-control') || '', /no-store/);
  const signedBody = await signedResponse.json();
  assert.equal(signedBody.expiresIn, 900, 'Signed URL lifetime must be exactly 900 seconds');
  assert.ok(typeof signedBody.signedUrl === 'string' && signedBody.signedUrl.length > 0);

  const signedPhotoResponse = await fetch(signedBody.signedUrl);
  assert.equal(signedPhotoResponse.status, 200, 'Signed owner URL must retrieve the private object');

  const crossOwnerResponse = await fetch(`${SUPABASE_URL}/functions/v1/photo-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user2Jwt}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ photoId: targetPhoto.id }),
  });
  assert.equal(crossOwnerResponse.status, 404, 'Cross-owner photo lookup must fail closed');

  const spoofedOwnerResponse = await fetch(`${SUPABASE_URL}/functions/v1/photo-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Jwt}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      photoId: targetPhoto.id,
      userId: user2.id,
      path: `${user2.id}/front/spoofed.jpg`,
    }),
  });
  assert.equal(spoofedOwnerResponse.status, 400, 'Caller-supplied identity or path must be rejected');
  console.log('   ✓ Owner signing succeeds for 900 seconds; cross-owner and spoofed access fail closed');

  // -------------------------------------------------------------
  // Step 13: Storage-First Account Deletion
  // -------------------------------------------------------------
  console.log('13. Testing Storage-first account deletion...');
  const badConfirmation = await fetch(`${SUPABASE_URL}/functions/v1/delete-customer-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Jwt}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ confirmation: 'DELETE' }),
  });
  assert.equal(badConfirmation.status, 400, 'Deletion must require the exact confirmation phrase');

  const spoofedDeletion = await fetch(`${SUPABASE_URL}/functions/v1/delete-customer-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Jwt}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      confirmation: 'DELETE_MY_DERIVE_ACCOUNT',
      userId: user2.id,
    }),
  });
  assert.equal(spoofedDeletion.status, 400, 'Deletion must reject caller-supplied identity fields');

  const deleteResponse = await fetch(`${SUPABASE_URL}/functions/v1/delete-customer-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Jwt}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ confirmation: 'DELETE_MY_DERIVE_ACCOUNT' }),
  });
  assert.equal(deleteResponse.status, 200, 'Confirmed caller deletion must succeed');
  assert.match(deleteResponse.headers.get('cache-control') || '', /no-store/);
  assert.deepEqual(await deleteResponse.json(), { deleted: true });

  const { data: deletedProfile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', user1.id)
    .maybeSingle();
  assert.equal(deletedProfile, null, 'Relational profile must cascade only after Storage deletion');

  for (const folder of ['front', 'left', 'right', 'shelf', 'checkin']) {
    const { data: remainingObjects, error: remainingError } = await adminClient.storage
      .from('customer-skin-photos')
      .list(`${user1.id}/${folder}`, { limit: 100 });
    assert.ok(!remainingError, `Storage verification failed for ${folder}`);
    assert.equal(remainingObjects.length, 0, `No ${folder} objects may survive deletion`);
  }

  const { data: deletedAuth, error: deletedAuthError } = await adminClient.auth.admin.getUserById(user1.id);
  assert.ok(deletedAuthError || !deletedAuth?.user, 'Caller Auth user must be deleted last');
  const { data: survivingAuth, error: survivingAuthError } = await adminClient.auth.admin.getUserById(user2.id);
  assert.ok(!survivingAuthError && survivingAuth?.user, 'Other members must remain untouched');
  console.log('   ✓ Private objects removed first; caller relational/Auth state deleted; other member untouched');

  const { error: cleanupError } = await adminClient.auth.admin.deleteUser(user2.id);
  assert.ok(!cleanupError, 'Synthetic unaffected user cleanup must succeed');

  console.log('\n=== ALL DERIVE S1 LOCAL E2E VERIFICATION CHECKS PASSED ===\n');
}

run().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
