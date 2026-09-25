// S-PAID-1 / F1: founder-authored initial routine without a model provider.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' });
function value(key) {
  const row = status.split('\n').find((line) => line.startsWith(`${key}=`));
  if (!row) throw new Error(`Missing local ${key}`);
  return row.slice(key.length + 1).replace(/^"|"$/g, '');
}
const url = value('API_URL');
const anonKey = value('ANON_KEY');
const serviceKey = value('SERVICE_ROLE_KEY');
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const client = () => createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function invoke(who, body) {
  const { data, error } = await who.functions.invoke('founder-operations', { body });
  return { data, status: error?.context?.status ?? 200,
    code: error?.context?.clone ? (await error.context.clone().json().catch(() => null))?.code : null };
}

async function run() {
  const runId = crypto.randomUUID();
  const password = 'F1LocalTestPassword123!';
  const users = [];
  let productId;
  try {
    const createUser = async (name) => {
      const email = `f1-${name}-${runId}@example.test`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      assert.ifError(error);
      users.push(data.user.id);
      return { id: data.user.id, email };
    };
    const founderUser = await createUser('founder');
    const memberUser = await createUser('member');
    const outsiderUser = await createUser('outsider');
    assert.ifError((await admin.from('founder_accounts').insert({ user_id: founderUser.id, role: 'founder' })).error);
    assert.ifError((await admin.from('memberships').insert({ user_id: memberUser.id, tier: 'founding_beta', status: 'active' })).error);
    assert.ifError((await admin.from('skin_profiles').insert({
      user_id: memberUser.id, primary_goal: 'dryness', secondary_goals: [], routine_complexity: 'simple',
      cost_preference: 'balanced', midday_feel: 'dry_tight', post_cleanse_tightness: true,
      known_sensitivities: [], sensitivities_status: 'none_known', active_prescriptions: [],
      pregnancy_status: 'no', is_pregnant_or_nursing: false, onboarding_completed: true,
    })).error);
    const product = await admin.from('products').insert({ brand: 'F1 Test', name: `Gentle Cleanser ${runId}`,
      category: 'cleanser', key_actives: [], full_ingredients: ['Water', 'Glycerin'], is_catalog_standard: true })
      .select('id, brand, name, category').single();
    assert.ifError(product.error);
    productId = product.data.id;

    const founder = client();
    const member = client();
    const outsider = client();
    assert.ifError((await founder.auth.signInWithPassword({ email: founderUser.email, password })).error);
    assert.ifError((await member.auth.signInWithPassword({ email: memberUser.email, password })).error);
    assert.ifError((await outsider.auth.signInWithPassword({ email: outsiderUser.email, password })).error);
    const request = {
      action: 'create_manual_routine_draft', requestId: crypto.randomUUID(), memberId: memberUser.id,
      summarySentence: 'A simple founder-reviewed baseline.',
      items: [{ product_id: productId, product_name: product.data.name, brand: product.data.brand,
        category: 'cleanser', order_index: 1, timing: 'am', amount: 'one pump', area: 'face', days: [],
        purpose: 'Cleanse gently.', why_chosen: 'Simple routine baseline.', watch_for: null }],
      founderNotes: 'Private founder note',
    };

    assert.equal((await invoke(outsider, { action: 'managed_member_lookup', email: memberUser.email })).status,
      403, 'non-founder cannot look up managed members');
    const lookup = await invoke(founder, { action: 'managed_member_lookup', email: memberUser.email });
    assert.equal(lookup.status, 200);
    assert.equal(lookup.data.member.id, memberUser.id);
    assert.equal(lookup.data.skinProfile.onboarding_completed, true);
    const noMembership = await invoke(founder, { action: 'managed_member_lookup', email: outsiderUser.email });
    assert.equal(noMembership.status, 403);
    const search = await invoke(founder, { action: 'routine_catalog_search', query: 'Gentle Cleanser' });
    assert.equal(search.status, 200);
    assert.ok(search.data.products.some((row) => row.id === productId));
    assert.ok(search.data.products.every((row) => !('full_ingredients' in row)), 'picker returns minimum metadata');
    assert.equal((await invoke(founder, { action: 'routine_catalog_search', query: '%' })).status, 400);

    assert.equal((await invoke(member, request)).status, 403, 'member cannot create founder draft');
    assert.equal((await invoke(outsider, request)).status, 403, 'outsider cannot create founder draft');
    const mismatched = await invoke(founder, { ...request, requestId: crypto.randomUUID(),
      items: [{ ...request.items[0], product_name: 'A different catalog product' }] });
    assert.equal(mismatched.status, 409, 'founder cannot label one catalog product as another');
    const created = await invoke(founder, request);
    assert.equal(created.status, 200);
    assert.equal(created.data.result.replayed, false);
    const replay = await invoke(founder, request);
    assert.equal(replay.status, 200);
    assert.equal(replay.data.result.routine_id, created.data.result.routine_id);
    assert.equal(replay.data.result.replayed, true);
    const changedPayload = await invoke(founder, { ...request, summarySentence: 'A different routine.' });
    assert.equal(changedPayload.status, 409, 'same request ID cannot replay a changed payload');
    const collision = await invoke(founder, { ...request, memberId: outsiderUser.id });
    assert.equal(collision.status, 403, 'different member cannot reuse request ID');
    const duplicate = await invoke(founder, { ...request, requestId: crypto.randomUUID() });
    assert.equal(duplicate.status, 409, 'another initial draft is rejected');
    assert.equal((await invoke(founder, { action: 'managed_member_lookup', email: memberUser.email })).status,
      409, 'member with an existing routine cannot be selected for another initial draft');

    const rows = await admin.from('routines').select('id, version, status, founder_notes').eq('user_id', memberUser.id);
    assert.ifError(rows.error);
    assert.equal(rows.data.length, 1);
    assert.equal(rows.data[0].status, 'awaiting_review');
    assert.equal(rows.data[0].founder_notes, 'Private founder note');
    const privateSelect = await member.from('routines').select('founder_notes').eq('id', rows.data[0].id);
    assert.ok(privateSelect.error, 'customer cannot select private founder notes');
    const crossOwner = await outsider.from('routines').select('id').eq('id', rows.data[0].id);
    assert.deepEqual(crossOwner.data, []);
    const directRpc = await member.rpc('founder_create_manual_routine_draft', {
      p_actor_user_id: founderUser.id, p_member_id: memberUser.id, p_summary_sentence: 'Bypass',
      p_items: request.items, p_founder_notes: null, p_request_id: crypto.randomUUID(),
    });
    assert.ok(directRpc.error, 'customer cannot call privileged RPC');

    const published = await invoke(founder, { action: 'publish_routine', requestId: crypto.randomUUID(),
      routineId: rows.data[0].id, summarySentence: request.summarySentence, items: request.items,
      founderNotes: request.founderNotes });
    assert.equal(published.status, 200);
    const after = await admin.from('routines').select('version, status').eq('user_id', memberUser.id).order('version');
    assert.deepEqual(after.data, [{ version: 1, status: 'approved' }, { version: 2, status: 'published' }]);
    console.log('S-PAID-1 manual draft: founder-only, entitled, idempotent, validated, private, and publishable');
  } finally {
    // Founder audit rows intentionally retain their actor FK; remove only this
    // isolated fixture's rows before deleting its disposable Auth identities.
    if (users[0]) assert.ifError((await admin.from('founder_operation_log').delete().eq('actor_user_id', users[0])).error);
    for (const id of users) assert.ifError((await admin.auth.admin.deleteUser(id)).error);
    if (productId) assert.ifError((await admin.from('products').delete().eq('id', productId)).error);
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
