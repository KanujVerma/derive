// DERIVE S3 local Edge integration harness
// Exercises JWT identity, emergency hard-stop behavior, server-only ingredient
// inference, safety-task creation, and fail-closed live-model configuration.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

let localStatus;
function localValue(name) {
  if (!localStatus) {
    localStatus = execFileSync('supabase', ['status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }
  const line = localStatus.split('\n').find((candidate) => candidate.startsWith(`${name}=`));
  if (!line) throw new Error(`Supabase local status did not provide ${name}`);
  return line.slice(name.length + 1).replace(/^"|"$/g, '');
}

const SUPABASE_URL = process.env.SUPABASE_URL || localValue('API_URL');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || localValue('ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || localValue('SERVICE_ROLE_KEY');

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function memberClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function expectFunctionStatus(client, name, body, expectedStatus) {
  const { error } = await client.functions.invoke(name, { body });
  assert.ok(error, `${name} should fail with HTTP ${expectedStatus}`);
  assert.equal(error.context?.status, expectedStatus, `${name} returned the wrong status`);
  return error.context?.clone ? error.context.clone().json() : null;
}

async function run() {
  console.log('=== DERIVE S3 Local Edge Integration ===\n');
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `s3-edge-${runId}@example.test`;
  const password = 'S3EdgePassword123!';
  let userId;
  let productId;
  let priorRoutineProviderConfig;

  try {
    console.log('1. Creating an isolated member with canonical S1/S2 context...');
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'S3 Edge Member' },
    });
    assert.ifError(createError);
    userId = created.user.id;

    assert.ifError((await admin.from('memberships').insert({
      user_id: userId, tier: 'founding_beta', status: 'active',
    })).error);

    const { error: profileError } = await admin.from('skin_profiles').insert({
      user_id: userId,
      primary_goal: 'breakouts',
      secondary_goals: ['simplify'],
      routine_complexity: 'simple',
      cost_preference: 'balanced',
      midday_feel: 'combination',
      post_cleanse_tightness: false,
      known_sensitivities: [],
      sensitivities_status: 'none_known',
      active_prescriptions: ['Differin adapalene 0.1% — Mon/Wed/Fri PM'],
      is_pregnant_or_nursing: false,
      pregnancy_status: 'no',
      onboarding_completed: true,
    });
    assert.ifError(profileError);

    const { error: intakeError } = await admin.from('onboarding_submissions').insert({
      user_id: userId,
      status: 'committed',
      front_storage_path: `${userId}/front/s3-edge.jpg`,
      left_storage_path: `${userId}/left/s3-edge.jpg`,
      right_storage_path: `${userId}/right/s3-edge.jpg`,
      committed_at: new Date().toISOString(),
      payload_snapshot: {
        confirmedProducts: [],
        productReactions: [],
        formulaSnapshots: [],
        pihTendencyAnswer: 'Rarely',
      },
    });
    assert.ifError(intakeError);

    const { data: product, error: productError } = await admin.from('products').insert({
      brand: 'S3 Edge',
      name: `Barrier Lotion ${runId}`,
      category: 'moisturizer',
      key_actives: ['Ceramides'],
      full_ingredients: ['Water', 'Glycerin', 'Fragrance'],
    }).select('id').single();
    assert.ifError(productError);
    productId = product.id;

    const { error: shelfError } = await admin.from('user_products').insert({
      user_id: userId,
      product_id: productId,
      detected_brand: 'S3 Edge',
      detected_name: `Barrier Lotion ${runId}`,
      action: 'KEEP',
      action_reason: 'Synthetic tolerated exposure',
      is_confirmed_by_user: true,
    });
    assert.ifError(shelfError);

    const { error: reactionError } = await admin.rpc('record_product_reaction', {
      p_user_id: userId,
      p_product_id: productId,
      p_product_name: `Barrier Lotion ${runId}`,
      p_brand: 'S3 Edge',
      p_ingredients: ['Water', 'Glycerin', 'Fragrance'],
      p_symptoms: ['burning_stinging'],
      p_body_area: 'face',
      p_severity: 'moderate',
    });
    assert.ifError(reactionError);

    const owner = memberClient();
    const { data: signedIn, error: signInError } = await owner.auth.signInWithPassword({ email, password });
    assert.ifError(signInError);
    assert.ok(signedIn.session);
    console.log('   ✓ Authenticated context spans S1 profile and S2 history');

    console.log('2. Running server-owned ingredient inference and immutable persistence...');
    const { data: inference, error: inferenceError } = await owner.functions.invoke(
      'infer-ingredient-signals',
      { body: {} },
    );
    assert.ifError(inferenceError);
    assert.ok(Array.isArray(inference.signals));
    assert.ok(inference.signals.some((signal) => signal.ingredientName === 'Fragrance'));

    const { data: persistedSignals, error: signalReadError } = await owner
      .from('ingredient_signals')
      .select('ingredient_name, confidence, version');
    assert.ifError(signalReadError);
    assert.ok(persistedSignals.some((signal) => signal.ingredient_name === 'Fragrance'));
    console.log('   ✓ Inference persisted owner-readable, versioned signals');

    console.log('3. Verifying emergency Ask hard-stops without calling the model...');
    const { data: emergency, error: emergencyError } = await owner.functions.invoke('ask-derive', {
      body: {
        userId,
        question: 'My face is swollen and I am having trouble breathing after this cream',
      },
    });
    assert.ifError(emergencyError);
    assert.equal(emergency.safety.severity, 'emergency');
    assert.equal(emergency.safety.recommendedAction, 'immediate_medical_care');

    const { data: safetyTasks, error: safetyTaskError } = await admin
      .from('founder_review_tasks')
      .select('priority, notes')
      .eq('user_id', userId)
      .eq('task_type', 'safety_flag');
    assert.ifError(safetyTaskError);
    assert.equal(safetyTasks.length, 1);
    assert.equal(safetyTasks[0].priority, 'urgent');
    assert.doesNotMatch(safetyTasks[0].notes, /trouble breathing/i);
    console.log('   ✓ Emergency response and privacy-minimized urgent founder task created');

    console.log('4. Rejecting identity spoofing and unauthenticated access...');
    await expectFunctionStatus(owner, 'ask-derive', {
      userId: '00000000-0000-0000-0000-000000000000',
      question: 'Can I use moisturizer?',
    }, 403);
    const anonymous = memberClient();
    await expectFunctionStatus(anonymous, 'infer-ingredient-signals', {}, 401);
    console.log('   ✓ JWT-bound identity is enforced at gateway and handler layers');

    console.log('5. Verifying live-model paths fail closed without a server Gemini secret...');
    const scanError = await expectFunctionStatus(owner, 'scan-product', {
      productName: 'Example Hydrating Serum',
      brand: 'Example',
    }, 503);
    assert.equal(scanError?.code, 'INTELLIGENCE_UNAVAILABLE');

    const { data: providerConfig, error: providerConfigReadError } = await admin
      .from('server_runtime_config')
      .select('key, value')
      .eq('key', 'routine_model_provider')
      .maybeSingle();
    assert.ifError(providerConfigReadError);
    priorRoutineProviderConfig = providerConfig;
    const { error: providerConfigDeleteError } = await admin
      .from('server_runtime_config')
      .delete()
      .eq('key', 'routine_model_provider');
    assert.ifError(providerConfigDeleteError);

    const routineError = await expectFunctionStatus(owner, 'propose-routine', {
      profile: {
        primaryGoal: 'breakouts',
        routineComplexity: 'simple',
      },
      shelfProducts: [],
    }, 503);
    assert.equal(routineError?.code, 'MODEL_UNAVAILABLE');
    console.log('   ✓ Scan and provider-neutral routine generation fail closed when server model configuration is absent');

    console.log('\n=== ALL DERIVE S3 LOCAL EDGE CHECKS PASSED ===\n');
  } finally {
    if (priorRoutineProviderConfig) {
      await admin.from('server_runtime_config').upsert(priorRoutineProviderConfig);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
    if (productId) await admin.from('products').delete().eq('id', productId);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
