/** Existing exact-local services only; tagged synthetic accounts, no reset or provider requests. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createExternalProductSaver } from '../src/presentation/external-products/saveProduct.ts';
import { ingredientQueryKey } from '../src/presentation/external-products/ingredientSearch.ts';
import { describeExternalSavedContext } from '../src/presentation/external-products/savedContext.ts';
import { buildPersonalIngredientInsights } from '../src/presentation/external-products/personalIngredientInsights.ts';
import { listFreeProducts, saveFreeProduct } from '../src/services/remote/freeContext.ts';
import { getPersonalContext, writePersonalContext } from '../src/services/remote/personalContext.ts';

assert.equal(process.argv[2], '--local-no-provider');
const status = JSON.parse(execFileSync('supabase', ['status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assert.equal(status.API_URL, 'http://127.0.0.1:54321');
assert.equal(new URL(status.DB_URL).port, '54322');
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const run = randomUUID(), owners = [], clients = [];
const client = () => {
  const result = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  clients.push(result); return result;
};
const make = async () => {
  const id = randomUUID(), email = `derive-save-${id}@example.invalid`, password = randomUUID() + '!Aa9';
  const created = await admin.auth.admin.createUser({ id, email, password, email_confirm: true, user_metadata: { derive_save_test: run } });
  assert.equal(created.error, null); assert.equal(created.data.user?.id, id); owners.push(id);
  const instance = client(); assert.equal((await instance.auth.signInWithPassword({ email, password })).error, null);
  return { id, email, password, client: instance };
};
try {
  const first = await make(), other = await make();
  const query = { barcode: '0012044038840', name: 'Old Spice High Endurance Fresh Scent Deodorant for Men 3.0 oz', brand: 'Old Spice', size: 'One 3oz. Stick' };
  const states = [];
  await createExternalProductSaver({ ownerId: first.id, query, getOwner: () => first.id, getQueryKey: () => ingredientQueryKey(query), createId: randomUUID,
    list: cursor => listFreeProducts(50, cursor, first.client), save: request => saveFreeProduct(request, first.client), publish: state => states.push(state) }).save(true);
  assert.equal(states.at(-1)?.kind, 'saved');
  const product = states.at(-1).product;
  assert.equal(product.source, 'user_reported'); assert.equal(product.productId, null);
  let context = await getPersonalContext(first.client);
  await writePersonalContext({ operation: 'save_profile', requestId: randomUUID(), baseRevision: context.revision,
    profile: { intent: 'check_current', primaryGoal: 'dryness', secondaryGoals: [], skinBehavior: 'dry_tight', reactivity: 'reacts_easily',
      reproductive: { pregnancy: 'unanswered', tryingToConceive: 'unanswered', nursing: 'unanswered' },
      sensitivities: { status: 'unanswered', values: [] }, treatments: { status: 'unanswered', values: [] } } }, first.client);
  context = await getPersonalContext(first.client);
  await writePersonalContext({ operation: 'append_experience', requestId: randomUUID(), baseRevision: context.revision, supersedesRevisionId: null,
    experience: { id: randomUUID(), reference: { kind: 'manual', name: 'Old Spice Aqua Reef' }, kind: 'reacted',
      occurred: { start: null, end: null }, useContext: null, symptoms: ['burning'], note: 'Synthetic test: pit burns' } }, first.client);
  // A different client represents restarting the application; it shares no screen memory.
  const reopened = client(); assert.equal((await reopened.auth.signInWithPassword({ email: first.email, password: first.password })).error, null);
  const readback = await listFreeProducts(50, undefined, reopened);
  assert.equal(readback.items.length, 1); assert.equal(readback.items[0].id, product.id);
  const restored = await getPersonalContext(reopened);
  const presentation = describeExternalSavedContext(first.id, 'ready', restored);
  assert.match(presentation.profile, /dry or tight/); assert.equal(presentation.reports[0].product, 'Old Spice Aqua Reef');
  const personalNotes = buildPersonalIngredientInsights(restored, [{ ingredientsText: 'Water, Glycerin, Fragrance' }], 'user_label');
  assert.equal(personalNotes.status, 'ready');
  assert.equal(personalNotes.basis, 'local_rules');
  assert.ok(personalNotes.sentences.some(s => /dryness or tightness/.test(s) && /Glycerin/.test(s)));
  assert.ok(personalNotes.sentences.some(s => /reacts easily/.test(s) && /fragrance/.test(s)));
  assert.ok(!personalNotes.sentences.some(s => /caused.*burn|allergic|\bscore\b/i.test(s)));
  let repeatedWrites = 0;
  await createExternalProductSaver({ ownerId: first.id, query, getOwner: () => first.id, getQueryKey: () => ingredientQueryKey(query), createId: randomUUID,
    list: cursor => listFreeProducts(50, cursor, reopened), save: async request => { repeatedWrites++; return saveFreeProduct(request, reopened); }, publish: () => {} }).save(true);
  assert.equal(repeatedWrites, 0); assert.equal((await listFreeProducts(50, undefined, reopened)).items.length, 1);
  assert.equal((await listFreeProducts(50, undefined, other.client)).items.length, 0);
  assert.equal((await getPersonalContext(other.client)).experiences.length, 0);
  const forged = await other.client.functions.invoke('free-context', { body: { operation: 'list', section: 'products', ownerId: first.id } });
  assert.equal(forged.error?.context?.status, 400);
  console.log(JSON.stringify({ scope: 'exact_local_real_auth_edge_database_new_client', providerRequests: 0,
    checks: ['confirmed_manual_product_save', 'product_readback_after_new_client', 'profile_and_reaction_readback', 'saved_profile_to_local_ingredient_sentences', 'no_reaction_cause_inference', 'repeated_scan_no_duplicate', 'other_owner_empty', 'forged_owner_400'] }));
} finally {
  let failed = false;
  for (const id of owners) {
    const before = await admin.auth.admin.getUserById(id);
    if (before.data.user?.user_metadata?.derive_save_test !== run) { failed = true; continue; }
    const removed = await admin.auth.admin.deleteUser(id);
    const after = await admin.auth.admin.getUserById(id);
    const remaining = await admin.from('free_saved_products').select('id', { count: 'exact', head: true }).eq('user_id', id);
    if (removed.error || after.error?.status !== 404 || remaining.error || remaining.count !== 0) failed = true;
  }
  clients.forEach(instance => instance.auth.stopAutoRefresh()); admin.auth.stopAutoRefresh();
  assert.equal(failed, false, 'Synthetic fixture cleanup must be confirmed');
  console.log('PASS: exact tagged local fixtures removed, Auth absence and shelf cleanup read back.');
}
