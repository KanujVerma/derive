// scripts/test-s2-local.mjs
// DERIVE S2 local API integration harness
// Exercises: append-only routine versions, owner-isolated history, atomic
// formula/reaction capture, structured check-ins, persisted refills, and a
// fresh-client read that simulates an app restart.

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

  const line = localStatus
    .split('\n')
    .find((candidate) => candidate.startsWith(`${name}=`));
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

async function signIn(email, password) {
  const client = memberClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  assert.ok(data.session, `Expected a session for ${email}`);
  return client;
}

async function run() {
  console.log('=== DERIVE S2 Local API Integration ===\n');

  const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ownerEmail = `s2-owner-${runId}@example.test`;
  const otherEmail = `s2-other-${runId}@example.test`;
  const password = 'S2TestPassword123!';
  let ownerId;
  let otherId;
  let productId;

  try {
    console.log('1. Creating isolated authenticated members and catalog product...');
    const { data: ownerCreate, error: ownerCreateError } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'S2 Owner' },
    });
    assert.ifError(ownerCreateError);
    ownerId = ownerCreate.user.id;

    const { data: otherCreate, error: otherCreateError } = await admin.auth.admin.createUser({
      email: otherEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'S2 Other' },
    });
    assert.ifError(otherCreateError);
    otherId = otherCreate.user.id;

    const { data: product, error: productError } = await admin
      .from('products')
      .insert({
        brand: 'S2 Integration',
        name: `Gentle Cleanser ${runId}`,
        category: 'cleanser',
        key_actives: ['Glycerin'],
        full_ingredients: ['Water', 'Glycerin', 'Fragrance'],
      })
      .select('id, brand, name')
      .single();
    assert.ifError(productError);
    productId = product.id;
    console.log('   ✓ Isolated members and canonical product created');

    const owner = await signIn(ownerEmail, password);
    const other = await signIn(otherEmail, password);

    console.log('2. Appending two routine snapshots through the server-only RPC...');
    const item = {
      order_index: 1,
      timing: 'am',
      product_id: productId,
      product_name: product.name,
      brand: product.brand,
      category: 'cleanser',
      amount: 'one pump',
      area: 'face',
      days: [],
      purpose: 'cleanse',
      why_chosen: 'A simple, gentle baseline.',
    };

    const { error: routine1Error } = await admin.rpc('create_routine_version', {
      p_user_id: ownerId,
      p_summary_sentence: 'S2 routine version one',
      p_items: [item],
      p_status: 'awaiting_review',
    });
    assert.ifError(routine1Error);

    const { error: routine2Error } = await admin.rpc('create_routine_version', {
      p_user_id: ownerId,
      p_summary_sentence: 'S2 routine version two',
      p_items: [{ ...item, why_chosen: 'Retained in a new immutable version.' }],
      p_status: 'published',
      p_published_at: new Date().toISOString(),
    });
    assert.ifError(routine2Error);

    const { data: ownerRoutines, error: ownerRoutineError } = await owner
      .from('routines')
      .select('id, version, status, summary_sentence, created_at, updated_at, published_at')
      .order('version', { ascending: true });
    assert.ifError(ownerRoutineError);
    assert.deepEqual(ownerRoutines.map((row) => row.version), [1, 2]);
    assert.equal(ownerRoutines[0].summary_sentence, 'S2 routine version one');
    assert.equal(ownerRoutines[1].summary_sentence, 'S2 routine version two');

    const { data: otherRoutines, error: otherRoutineError } = await other
      .from('routines')
      .select('id');
    assert.ifError(otherRoutineError);
    assert.deepEqual(otherRoutines, []);
    console.log('   ✓ Versions append sequentially; another member sees none');

    console.log('3. Recording an immutable formula snapshot and reaction atomically...');
    const formulaCapturedAt = '2026-09-10T12:30:00.000Z';
    const { error: reactionError } = await admin.rpc('record_product_reaction', {
      p_user_id: ownerId,
      p_product_id: productId,
      p_product_name: product.name,
      p_brand: product.brand,
      p_ingredients: ['Water', 'Glycerin', 'Fragrance'],
      p_symptoms: ['burning_stinging'],
      p_body_area: 'face',
      p_severity: 'moderate',
      p_approximate_date: 'early September 2026',
      p_notes: 'Synthetic S2 integration reaction',
      p_formula_captured_at: formulaCapturedAt,
    });
    assert.ifError(reactionError);

    const { data: reactions, error: reactionsError } = await owner
      .from('product_reactions')
      .select('id, formula_snapshot_id, severity, product_name_snapshot');
    assert.ifError(reactionsError);
    assert.equal(reactions.length, 1);

    const { data: formulas, error: formulasError } = await owner
      .from('formula_snapshots')
      .select('id, product_id, ingredients, captured_at');
    assert.ifError(formulasError);
    assert.equal(formulas.length, 1);
    assert.equal(reactions[0].formula_snapshot_id, formulas[0].id);
    assert.deepEqual(formulas[0].ingredients, ['Water', 'Glycerin', 'Fragrance']);
    assert.equal(formulas[0].captured_at, formulaCapturedAt.replace('.000Z', '+00:00'));

    const { error: directFormulaError } = await owner
      .from('formula_snapshots')
      .insert({
        user_id: ownerId,
        product_name: 'Bypass attempt',
        ingredients: ['Unknown'],
        captured_at: new Date().toISOString(),
      });
    assert.ok(directFormulaError, 'Member direct formula write must fail');
    console.log('   ✓ Exact historical formula is linked; direct member writes fail closed');

    console.log('4. Persisting structured weekly check-in and canonical refill request...');
    const activeRoutine = ownerRoutines[1];
    const { error: checkInError } = await owner.from('check_ins').insert({
      user_id: ownerId,
      routine_id: activeRoutine.id,
      skin_state: 'better',
      irritation: 'little',
      primary_goal: 'breakouts',
      goal_outcome: 'better',
      adherence: 'mostly',
      irritation_symptoms: ['dryness_peeling'],
      irritation_body_area: 'face',
      notes: 'Synthetic S2 check-in',
    });
    assert.ifError(checkInError);

    const { error: refillError } = await owner.from('refill_requests').insert({
      user_id: ownerId,
      product_id: productId,
      product_name: product.name,
      brand: product.brand,
      request_note: 'Running low',
    });
    assert.ifError(refillError);

    const { error: duplicateRefillError } = await owner.from('refill_requests').insert({
      user_id: ownerId,
      product_id: productId,
      product_name: product.name,
      brand: product.brand,
    });
    assert.equal(duplicateRefillError?.code, '23505');
    console.log('   ✓ Check-in and refill survive as canonical relational records');

    console.log('5. Simulating app restart with a fresh authenticated client...');
    await owner.auth.signOut({ scope: 'local' });
    const restartedOwner = await signIn(ownerEmail, password);

    const { data: persistedRoutine, error: persistedRoutineError } = await restartedOwner
      .from('routines')
      .select('id, version, status, summary_sentence, updated_at')
      .order('version', { ascending: false })
      .limit(1)
      .single();
    assert.ifError(persistedRoutineError);
    assert.equal(persistedRoutine.version, 2);

    const { data: persistedSteps, error: persistedStepsError } = await restartedOwner
      .from('routine_items')
      .select('routine_id, product_id, timing, order_index')
      .eq('routine_id', persistedRoutine.id);
    assert.ifError(persistedStepsError);
    assert.equal(persistedSteps.length, 1);
    assert.equal(persistedSteps[0].product_id, productId);

    const { data: persistedRefills, error: persistedRefillsError } = await restartedOwner
      .from('refill_requests')
      .select('id, product_id, status, requested_at');
    assert.ifError(persistedRefillsError);
    assert.equal(persistedRefills.length, 1);
    assert.equal(persistedRefills[0].product_id, productId);
    console.log('   ✓ Fresh client reconstructs the same routine and refill state');

    console.log('\n=== ALL DERIVE S2 LOCAL API CHECKS PASSED ===\n');
  } finally {
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
    if (otherId) await admin.auth.admin.deleteUser(otherId);
    if (productId) await admin.from('products').delete().eq('id', productId);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
