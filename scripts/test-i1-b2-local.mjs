// scripts/test-i1-b2-local.mjs
// DERIVE I1-B2 Committed Local Full-Stack E2E Test Harness
// Exercises: Auth, Gateway JWT Gate, committed intake requirement, propose-routine Edge Function,
// product catalog normalization, atomic relational routine persistence, awaiting_review status,
// version-1 idempotency/replay, RemoteDeriveService getRoutine/getUserProducts assembly.

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
  console.log('=== DERIVE I1-B2 Local Full-Stack E2E Test Harness ===\n');

  // -------------------------------------------------------------
  // Step 1: Gateway JWT Gate Verification for propose-routine
  // -------------------------------------------------------------
  console.log('1. Testing propose-routine Platform Gateway JWT Gate...');
  {
    const resNoAuth = await fetch(`${SUPABASE_URL}/functions/v1/propose-routine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(resNoAuth.status, 401, 'propose-routine without auth must return 401');

    const resBadAuth = await fetch(`${SUPABASE_URL}/functions/v1/propose-routine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid.token.value',
      },
      body: JSON.stringify({}),
    });
    assert.equal(resBadAuth.status, 401, 'propose-routine with invalid token must return 401');
    console.log('   ✓ propose-routine gateway strictly rejects unauthenticated requests (401)');
  }

  // -------------------------------------------------------------
  // Step 2: Create Synthetic Test User
  // -------------------------------------------------------------
  console.log('2. Creating synthetic test user...');
  const runId = Date.now();
  const userEmail = `member_b2_e2e_${runId}@example.test`;
  const testPassword = 'TestPassword123!';

  const { data: uCreate, error: uErr } = await adminClient.auth.admin.createUser({
    email: userEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Member B2 Synthetic E2E' },
  });
  assert.ok(!uErr && uCreate?.user, `Failed creating test user: ${uErr?.message}`);
  const user = uCreate.user;
  const userId = user.id;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: uSign, error: uSignErr } = await userClient.auth.signInWithPassword({
    email: userEmail,
    password: testPassword,
  });
  assert.ok(!uSignErr && uSign.session, `User sign in failed: ${uSignErr?.message}`);
  const userJwt = uSign.session.access_token;
  console.log(`   ✓ Authenticated test user: ${userId}`);

  // -------------------------------------------------------------
  // Step 3: Trigger propose-routine BEFORE onboarding commit (must fail closed)
  // -------------------------------------------------------------
  console.log('3. Testing propose-routine before intake commit (fail-closed check)...');
  {
    const resPreCommit = await fetch(`${SUPABASE_URL}/functions/v1/propose-routine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(resPreCommit.status, 400, 'propose-routine before committed intake must return 400');
    const body = await resPreCommit.json();
    assert.equal(body.code, 'INTAKE_NOT_COMMITTED');
    console.log('   ✓ propose-routine fails closed when intake is not committed (400 INTAKE_NOT_COMMITTED)');
  }

  // -------------------------------------------------------------
  // Step 4: Perform Complete Onboarding Intake Commit
  // -------------------------------------------------------------
  console.log('4. Performing full B1 onboarding intake commit for test user...');
  {
    // A. Prepare onboarding
    const prepRes = await fetch(`${SUPABASE_URL}/functions/v1/prepare-onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(prepRes.status, 200, 'prepare-onboarding must succeed');
    const prepData = await prepRes.json();
    const submissionId = prepData.submissionId;
    const frontPath = prepData.uploadTargets.front.path;
    const leftPath = prepData.uploadTargets.left.path;
    const rightPath = prepData.uploadTargets.right.path;
    const shelfPath = prepData.uploadTargets.shelf?.path;

    // B. Upload 3 required photos
    const uploadPhoto = async (storagePath) => {
      const { error: upErr } = await userClient.storage
        .from('customer-skin-photos')
        .upload(storagePath, tinyJpegBytes, {
          contentType: 'image/jpeg',
          upsert: false,
        });
      assert.ok(!upErr, `Photo upload failed for ${storagePath}: ${upErr?.message}`);
    };

    await uploadPhoto(frontPath);
    await uploadPhoto(leftPath);
    await uploadPhoto(rightPath);

    const storagePaths = {
      front: frontPath,
      left: leftPath,
      right: rightPath,
      shelf: shelfPath,
    };

    // C. Commit onboarding intake
    const commitPayload = {
      primaryGoal: 'breakouts',
      secondaryGoals: ['texture'],
      routineComplexity: 'simple',
      costPreference: 'balanced',
      middayFeel: 'combination',
      postCleanseTightness: false,
      safetyContext: {
        isPregnantOrNursing: false,
        pregnancyStatus: 'no',
        sensitivitiesStatus: 'none_known',
        knownSensitivities: [],
        activePrescriptions: [],
      },
      pihTendencyAnswer: 'Sometimes',
      confirmedProducts: [
        {
          brand: 'CeraVe',
          name: 'Foaming Facial Cleanser',
          category: 'cleanser',
          keyActives: ['Ceramides', 'Niacinamide'],
        },
        {
          brand: 'Differin',
          name: 'Adapalene Gel 0.1%',
          category: 'treatment',
          keyActives: ['Adapalene'],
        },
      ],
      storagePaths,
    };

    const commitRes = await fetch(`${SUPABASE_URL}/functions/v1/onboard-customer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify({
        submissionId,
        payload: commitPayload,
      }),
    });
    if (commitRes.status !== 200) {
      const errText = await commitRes.text();
      throw new Error(`onboard-customer failed with ${commitRes.status}: ${errText}`);
    }
    const commitData = await commitRes.json();
    assert.equal(commitData.initialRoutineState, 'pending_generation');
    console.log('   ✓ Onboarding intake committed successfully (pending_generation)');
  }

  // -------------------------------------------------------------
  // Step 5A: Client cannot select provider; missing provider returns 503 MODEL_UNAVAILABLE
  // -------------------------------------------------------------
  console.log('5A. Testing propose-routine client cannot select provider via x-routine-fixture (fail-closed check)...');
  {
    await adminClient.from('server_runtime_config').delete().eq('key', 'routine_model_provider');

    const propResWithClientHeader = await fetch(`${SUPABASE_URL}/functions/v1/propose-routine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
        'x-routine-fixture': 'true', // Client attempts to force fixture
      },
      body: JSON.stringify({}),
    });
    // Server must ignore client fixture header and fail closed if no server provider is configured
    if (!process.env.ROUTINE_MODEL_PROVIDER && !process.env.GEMINI_API_KEY) {
      assert.equal(propResWithClientHeader.status, 503, 'propose-routine with client fixture header on unconfigured server must return 503 MODEL_UNAVAILABLE');
      const errBody = await propResWithClientHeader.json();
      assert.equal(errBody.code, 'MODEL_UNAVAILABLE');
      assert.ok(!errBody.stack, 'Error response must never contain stack traces');
      console.log('   ✓ propose-routine strictly rejects client-side provider selection; unconfigured server returns 503 MODEL_UNAVAILABLE');
    } else {
      console.log('   (Server-level provider env detected; skipping 503 assertion)');
    }
  }

  // -------------------------------------------------------------
  // Step 5B: Trigger Initial Routine Generation via Server-Configured Fixture Provider
  // -------------------------------------------------------------
  console.log('5B. Triggering initial routine generation via server-configured fixture provider (no client fixture header)...');
  let proposalResult;
  {
    // Configure server-side fixture provider via secure server_runtime_config
    const { error: cfgErr } = await adminClient
      .from('server_runtime_config')
      .upsert({ key: 'routine_model_provider', value: 'fixture' });
    assert.ok(!cfgErr, `Failed configuring server provider: ${cfgErr?.message}`);

    const propRes = await fetch(`${SUPABASE_URL}/functions/v1/propose-routine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
        // ZERO client fixture headers!
      },
      body: JSON.stringify({}),
    });
    if (propRes.status !== 200) {
      const errText = await propRes.text();
      throw new Error(`propose-routine failed with status ${propRes.status}: ${errText}`);
    }
    proposalResult = await propRes.json();

    // Verify RoutineProposalResult shape
    assert.ok(proposalResult.routine, 'Response must contain routine');
    assert.ok(Array.isArray(proposalResult.userProducts), 'Response must contain userProducts array');

    const routine = proposalResult.routine;
    assert.equal(routine.userId, userId);
    assert.equal(routine.version, 1);
    assert.equal(routine.status, 'awaiting_review', 'Routine must be in awaiting_review status');
    assert.ok(routine.summarySentence.length > 0);
    assert.ok(routine.createdAt, 'createdAt must be present');
    assert.ok(routine.updatedAt, 'updatedAt must be present (B2 reconciliation)');
    assert.equal(routine.publishedAt, undefined, 'Initial routine must NOT be published');

    // Steps verification
    assert.ok(routine.amSteps.length >= 2, 'amSteps must contain steps');
    assert.ok(routine.pmSteps.length >= 2, 'pmSteps must contain steps');

    // Sunscreen AM Invariant
    const amSpf = routine.amSteps.find((s) => s.category === 'sunscreen');
    assert.ok(amSpf, 'AM routine must have daily sunscreen');
    assert.equal(amSpf.timing, 'am');
    assert.ok(amSpf.productId.length > 0, 'Step must have canonical productId');

    const pmSpf = routine.pmSteps.find((s) => s.category === 'sunscreen');
    assert.equal(pmSpf, undefined, 'PM routine must NEVER contain sunscreen');

    // Retinoid PM Invariant
    const amRet = routine.amSteps.find((s) => s.productName.toLowerCase().includes('adapalene'));
    assert.equal(amRet, undefined, 'AM routine must NEVER contain retinoid');

    const pmRet = routine.pmSteps.find((s) => s.productName.toLowerCase().includes('adapalene'));
    assert.ok(pmRet, 'PM routine must contain scheduled retinoid');
    assert.equal(pmRet.timing, 'pm');

    console.log('   ✓ propose-routine produced valid canonical routine proposal in awaiting_review state');
  }

  // -------------------------------------------------------------
  // Step 6: Verify Database Relational Integrity
  // -------------------------------------------------------------
  console.log('6. Verifying database relational records & normalization...');
  {
    // Routines table
    const { data: dbRoutines, error: rErr } = await adminClient
      .from('routines')
      .select('*')
      .eq('user_id', userId);
    assert.ok(!rErr && dbRoutines.length === 1, 'Exactly one routine row must exist for user');
    const rRow = dbRoutines[0];
    assert.equal(rRow.version, 1);
    assert.equal(rRow.status, 'awaiting_review');
    assert.ok(rRow.updated_at, 'routines.updated_at column must be populated');

    // Routine items table
    const { data: dbItems, error: iErr } = await adminClient
      .from('routine_items')
      .select('*')
      .eq('routine_id', rRow.id);
    assert.ok(!iErr && dbItems.length > 0, 'routine_items must exist');
    for (const item of dbItems) {
      assert.ok(item.product_id, `Item ${item.product_name} must have a valid product_id`);
      // Verify foreign key integrity
      const { data: prod } = await adminClient
        .from('products')
        .select('*')
        .eq('id', item.product_id)
        .single();
      assert.ok(prod, `product_id ${item.product_id} must exist in products table`);
    }

    // User products table: Check confirmation provenance and catalog provenance
    const { data: dbUserProds, error: upErr } = await adminClient
      .from('user_products')
      .select('*, products(*)')
      .eq('user_id', userId);
    assert.ok(!upErr && dbUserProds.length > 0, 'user_products rows must exist');
    for (const up of dbUserProds) {
      assert.ok(['KEEP', 'PAUSE', 'REPLACE', 'ADD', 'STOP'].includes(up.action));
      if (up.action === 'ADD') {
        assert.equal(up.is_confirmed_by_user, false, 'Newly proposed ADD product must have is_confirmed_by_user = false');
      } else {
        // Shelf items confirmed during onboarding must NOT be downgraded to false
        assert.equal(up.is_confirmed_by_user, true, `Shelf item (${up.detected_brand} ${up.detected_name}) must retain is_confirmed_by_user = true`);
      }
      if (up.product_id) {
        assert.ok(up.products, 'Joined products row must reference canonical products row');
      }
    }

    // Founder review tasks
    const { data: task } = await adminClient
      .from('founder_review_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('task_type', 'initial_routine')
      .single();
    assert.ok(task, 'Founder review task must exist');
    assert.equal(task.status, 'pending');
    console.log('   ✓ Relational database integrity, product normalization, confirmation preservation, and FKs confirmed');
  }

  // -------------------------------------------------------------
  // Step 7: Test Replay Idempotency
  // -------------------------------------------------------------
  console.log('7. Testing propose-routine replay idempotency...');
  {
    const replayRes = await fetch(`${SUPABASE_URL}/functions/v1/propose-routine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(replayRes.status, 200, 'Replay call must succeed with 200');
    const replayData = await replayRes.json();
    assert.equal(replayData.routine.id, proposalResult.routine.id, 'Replay must return exact same routine id');
    assert.equal(replayData.routine.version, 1);

    // Verify no duplicate routine was created
    const { data: dbRoutines } = await adminClient
      .from('routines')
      .select('id')
      .eq('user_id', userId);
    assert.equal(dbRoutines.length, 1, 'Replay must NOT insert a second routine row');
    console.log('   ✓ Replay call succeeds idempotently without duplicate records');
  }

  // -------------------------------------------------------------
  // Step 8: Test Client Read Assembly via RemoteDeriveService
  // -------------------------------------------------------------
  console.log('8. Testing client read assembly via user Client...');
  {
    // A. Query routine directly as authenticated user
    const { data: routineRow, error: rErr } = await userClient
      .from('routines')
      .select('id, user_id, version, status, summary_sentence, created_at, updated_at, published_at')
      .eq('user_id', userId)
      .single();
    if (rErr) console.error('Routine query error:', rErr);
    assert.ok(routineRow, `Expected routineRow, got null. Error: ${rErr?.message}`);

    const { data: itemRows } = await userClient
      .from('routine_items')
      .select('*')
      .eq('routine_id', routineRow.id)
      .order('order_index', { ascending: true });
    assert.ok(itemRows.length > 0);

    // B. Query user_products joined with products
    const { data: upRows } = await userClient
      .from('user_products')
      .select('*, products(*)')
      .eq('user_id', userId);
    assert.ok(upRows.length > 0);
    assert.ok(upRows[0].products, 'Joined products row must be populated');
    console.log('   ✓ RLS and joined queries succeed for authenticated user');
  }

  console.log('\n=== ALL DERIVE I1-B2 LOCAL E2E VERIFICATION CHECKS PASSED ===\n');
}

run().finally(async () => {
  await adminClient.from('server_runtime_config').delete().eq('key', 'routine_model_provider');
}).catch((err) => {
  console.error('\n❌ B2 E2E TEST FAILED:', err);
  process.exit(1);
});
