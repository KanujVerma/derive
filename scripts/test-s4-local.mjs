// DERIVE S4 local founder-operations integration harness.
// Exercises founder allowlisting, queue reads, routine publication, fulfillment,
// formula verification, private notes, safety resolution, and audit logging.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

let localStatus;
function localValue(name) {
  if (!localStatus) {
    localStatus = execFileSync('supabase', ['status', '-o', 'env'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
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
const client = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function invoke(clientInstance, body) {
  const { data, error } = await clientInstance.functions.invoke('founder-operations', { body });
  if (error) {
    const payload = error.context?.clone ? await error.context.clone().json().catch(() => null) : null;
    error.payload = payload;
  }
  return { data, error };
}

async function run() {
  console.log('=== DERIVE S4 Local Founder Operations Integration ===\n');
  const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const founderEmail = `s4-founder-${runId}@example.test`;
  const memberEmail = `s4-member-${runId}@example.test`;
  const password = 'S4IntegrationPassword123!';
  let founderId;
  let memberId;
  const productIds = [];

  try {
    console.log('1. Provisioning isolated founder and member identities...');
    const founderCreated = await admin.auth.admin.createUser({
      email: founderEmail, password, email_confirm: true, user_metadata: { full_name: 'S4 Founder' },
    });
    assert.ifError(founderCreated.error);
    founderId = founderCreated.data.user.id;
    const memberCreated = await admin.auth.admin.createUser({
      email: memberEmail, password, email_confirm: true, user_metadata: { full_name: 'S4 Member' },
    });
    assert.ifError(memberCreated.error);
    memberId = memberCreated.data.user.id;
    assert.ifError((await admin.from('founder_accounts').insert({ user_id: founderId, role: 'founder' })).error);
    assert.ifError((await admin.from('skin_profiles').insert({
      user_id: memberId,
      primary_goal: 'dryness', secondary_goals: ['simplify'], routine_complexity: 'simple',
      cost_preference: 'balanced', midday_feel: 'dry_tight', post_cleanse_tightness: true,
      known_sensitivities: [], sensitivities_status: 'none_known', active_prescriptions: [],
      pregnancy_status: 'no', is_pregnant_or_nursing: false, onboarding_completed: true,
    })).error);

    const products = await admin.from('products').insert([
      { brand: 'S4 Integration', name: `Gentle Cleanser ${runId}`, category: 'cleanser', key_actives: ['Glycerin'], full_ingredients: ['Water', 'Glycerin'], is_catalog_standard: true },
      { brand: 'S4 Integration', name: `Provisional Cream ${runId}`, category: 'moisturizer', key_actives: [], full_ingredients: [], is_catalog_standard: false },
    ]).select('id, brand, name, category');
    assert.ifError(products.error);
    productIds.push(...products.data.map((row) => row.id));
    const cleanser = products.data[0];
    const provisional = products.data[1];

    const routineCreated = await admin.rpc('create_routine_version', {
      p_user_id: memberId,
      p_summary_sentence: 'Awaiting founder review.',
      p_items: [{
        order_index: 1, timing: 'am', product_id: cleanser.id, product_name: cleanser.name,
        brand: cleanser.brand, category: cleanser.category, amount: 'one pump', area: 'face', days: [],
        purpose: 'Cleanse without stripping.', why_chosen: 'Simple verified baseline.',
      }],
      p_status: 'awaiting_review',
    });
    assert.ifError(routineCreated.error);
    const routineId = routineCreated.data.id;
    assert.ifError((await admin.from('founder_review_tasks').insert([
      { user_id: memberId, task_type: 'initial_routine', priority: 'normal', notes: 'Review generated plan.' },
      { user_id: memberId, task_type: 'safety_flag', priority: 'urgent', notes: 'Privacy-minimized safety escalation; no transcript stored.' },
    ])).error);
    const refillCreated = await admin.from('refill_requests').insert({
      user_id: memberId, product_id: cleanser.id, product_name: cleanser.name, brand: cleanser.brand,
    }).select('id').single();
    assert.ifError(refillCreated.error);

    const founder = client();
    const member = client();
    assert.ifError((await founder.auth.signInWithPassword({ email: founderEmail, password })).error);
    assert.ifError((await member.auth.signInWithPassword({ email: memberEmail, password })).error);
    console.log('   ✓ Founder allowlist and operational fixtures are ready');

    console.log('2. Enforcing founder authorization and privacy-minimized queues...');
    const forbidden = await invoke(member, { action: 'dashboard' });
    assert.ok(forbidden.error);
    assert.equal(forbidden.error.context?.status, 403);
    const dashboard = await invoke(founder, { action: 'dashboard' });
    assert.ifError(dashboard.error);
    assert.ok(dashboard.data.counts.urgentSafety >= 1);
    assert.ok(dashboard.data.counts.routineReview >= 1);
    assert.ok(dashboard.data.counts.activeRefills >= 1);
    assert.ok(dashboard.data.safetyQueue.some((row) => row.user_id === memberId));
    assert.ok(dashboard.data.routineQueue.some((row) => row.id === routineId));
    assert.ok(dashboard.data.refillQueue.some((row) => row.id === refillCreated.data.id));
    assert.ok(dashboard.data.formulaQueue.some((row) => row.id === provisional.id));
    assert.doesNotMatch(JSON.stringify(dashboard.data), /storage_path|trouble breathing|ask transcript/i);
    console.log('   ✓ Customers are denied; founder queues expose only minimum necessary context');

    console.log('3. Publishing a reviewed routine as a new immutable version...');
    const detail = await invoke(founder, { action: 'routine_detail', routineId });
    assert.ifError(detail.error);
    assert.equal(detail.data.items.length, 1);
    const published = await invoke(founder, {
      action: 'publish_routine', requestId: crypto.randomUUID(), routineId,
      summarySentence: 'Founder-reviewed gentle baseline.',
      founderNotes: 'Reviewed in S4 integration.',
      items: detail.data.items.map((item) => ({ ...item, why_chosen: 'Verified gentle baseline.' })),
    });
    assert.ifError(published.error);
    const routineRows = await admin.from('routines').select('version, status').eq('user_id', memberId).order('version');
    assert.ifError(routineRows.error);
    assert.deepEqual(routineRows.data, [{ version: 1, status: 'approved' }, { version: 2, status: 'published' }]);
    console.log('   ✓ Review creates version 2 and retains version 1 as historical evidence');

    console.log('4. Advancing refill fulfillment with strict tracking requirements...');
    for (const [nextStatus, extra] of [
      ['ordered', {}],
      ['shipped', { carrier: 'UPS', trackingNumber: `TRACK-${runId}`, trackingUrl: 'https://www.ups.com/track' }],
      ['delivered', {}],
    ]) {
      const transition = await invoke(founder, {
        action: 'transition_refill', requestId: crypto.randomUUID(), refillId: refillCreated.data.id,
        nextStatus, ...extra,
      });
      assert.ifError(transition.error);
    }
    const refill = await admin.from('refill_requests').select('status, shipped_at, delivered_at, tracking_number').eq('id', refillCreated.data.id).single();
    assert.ifError(refill.error);
    assert.equal(refill.data.status, 'delivered');
    assert.ok(refill.data.shipped_at && refill.data.delivered_at && refill.data.tracking_number);
    console.log('   ✓ requested → ordered → shipped → delivered persisted atomically');

    console.log('5. Verifying formula provenance, private notes, and safety resolution...');
    const formula = await invoke(founder, {
      action: 'review_formula', requestId: crypto.randomUUID(), productId: provisional.id,
      decision: 'verified', ingredients: ['Water', 'Glycerin', 'Ceramide NP'], keyActives: ['Ceramide NP'],
      sourceReference: 'https://manufacturer.example/current-label', reviewNotes: 'Synthetic integration evidence.',
    });
    assert.ifError(formula.error);
    const safetyTask = dashboard.data.safetyQueue.find((row) => row.user_id === memberId);
    assert.ok(safetyTask);
    assert.ifError((await invoke(founder, {
      action: 'add_note', requestId: crypto.randomUUID(), userId: memberId,
      noteType: 'safety_follow_up', note: 'Synthetic follow-up completed; no diagnosis recorded.',
    })).error);
    assert.ifError((await invoke(founder, {
      action: 'resolve_task', requestId: crypto.randomUUID(), taskId: safetyTask.id, resolution: 'completed',
    })).error);
    const verified = await admin.from('products').select('is_catalog_standard, full_ingredients').eq('id', provisional.id).single();
    assert.equal(verified.data.is_catalog_standard, true);
    const audit = await admin.from('founder_operation_log').select('operation').eq('actor_user_id', founderId);
    assert.ifError(audit.error);
    assert.equal(audit.data.length, 7);
    console.log('   ✓ Catalog trust, internal note, safety task, and seven audit events verified');

    console.log('\n=== ALL DERIVE S4 LOCAL FOUNDER OPERATIONS CHECKS PASSED ===\n');
  } finally {
    if (founderId) await admin.auth.admin.deleteUser(founderId);
    if (memberId) await admin.auth.admin.deleteUser(memberId);
    if (productIds.length) await admin.from('products').delete().in('id', productIds);
  }
}

run().catch((error) => {
  console.error('\nS4 integration failed:', error);
  process.exitCode = 1;
});
