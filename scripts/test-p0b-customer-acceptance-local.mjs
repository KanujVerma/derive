/** Actual mobile controller + remote adapters + SDK + local Edge/persistence.
 * Synthetic catalog inputs are explicit; this is neither native UI nor customer evidence.
 * Stack lifecycle belongs to the operator. Never reset, start or stop it here.
 * Run: node --experimental-strip-types scripts/test-p0b-customer-acceptance-local.mjs
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { assertDisposableLocalTarget } from './acceptance/p0b/target.ts';
import { attemptOwnedCleanup } from './acceptance/p0b/cleanup.ts';
import { CustomerController, captureCustomerFunctionClient, selectVisibleCustomerDecision, describeCanonicalMyStuff } from '../src/presentation/personal-decision/customerController.ts';
import { getPersonalContext, writePersonalContext, requestPersonalContext } from '../src/services/remote/personalContext.ts';
import { requestPersonalDecision } from '../src/services/remote/personalDecision.ts';
import { createContextDraft, manualRoutineItem } from '../src/presentation/p0b-personalization/draft.ts';
import { profileToStorage, routineToStorage } from '../src/presentation/p0b-personalization/storageAdapter.ts';
import { describePersonalDecision } from '../src/presentation/personal-decision/result.ts';

const cli = process.env.SUPABASE_CLI ?? 'supabase';
const status = JSON.parse(execFileSync(cli, ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assertDisposableLocalTarget(status.API_URL);
const make = key => createClient(status.API_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
const admin = make(status.SERVICE_ROLE_KEY), a = make(status.ANON_KEY), b = make(status.ANON_KEY);
const ownedUsers = [], owned = { product: null, variant: null, formula: null, identifier: null };
const productId = randomUUID(), variantId = randomUUID(), formulaId = randomUUID();
const trace = []; // Operation/revision metadata only. No tokens, answers or sensitive text.
let owner = null, source = a, controller;
let dropWriteConfirmation = false, failLoad = false, failDecision = false;
const capture = () => captureCustomerFunctionClient(owner, source, () => owner, changed => controller.setOwner(changed));
const gateway = {
  async load(expectedOwner) {
    assert.equal(owner, expectedOwner);
    if (failLoad) throw new Error('Controlled unavailable transport');
    return getPersonalContext(await capture());
  },
  async write(expectedOwner, request) {
    assert.equal(owner, expectedOwner);
    const result = await writePersonalContext(request, await capture());
    trace.push({ operation: request.operation, requestId: request.requestId, revision: result.revision.revision, replayed: result.replayed });
    if (dropWriteConfirmation) { dropWriteConfirmation = false; throw new Error('Controlled response lost after server commit'); }
    return result;
  },
  async history(expectedOwner, request) { assert.equal(owner, expectedOwner); return requestPersonalContext(request, await capture()); },
  async evaluate(expectedOwner, request) {
    assert.equal(owner, expectedOwner);
    if (failDecision) throw new Error('Controlled unavailable transport');
    const result = await requestPersonalDecision(request, await capture());
    assert.equal(result.runtime, 'authoritative', 'Local-fixture evaluation cannot clear this run');
    trace.push({ operation: 'evaluate', revision: result.contextRevision, runtime: result.runtime, action: result.packet.action.kind });
    return result;
  },
};
controller = new CustomerController(gateway, randomUUID);
const state = () => controller.getState();
const changeOwner = (id, client) => { owner = id; source = client; controller.setOwner(id); };
async function assess(snapshot, expectedAction) {
  await controller.assess(snapshot);
  const visible = selectVisibleCustomerDecision(state(), owner, snapshot);
  assert(visible, 'Actual persisted result must survive the mobile owner/context/truth render gate');
  assert.equal(visible.packet.action.kind, expectedAction);
  const presentation = describePersonalDecision(visible.packet, visible.expectedBinding);
  assert.equal(presentation.kind, 'ready');
  return visible.packet;
}
async function count(table, column, value) {
  const result = await admin.from(table).select('*', { count: 'exact', head: true }).eq(column, value);
  assert.ifError(result.error); return result.count;
}
try {
  for (const client of [a, b]) {
    const result = await client.auth.signInAnonymously(); assert.ifError(result.error);
    assert(result.data.user?.is_anonymous); ownedUsers.push(result.data.user.id);
  }
  const [aid, bid] = ownedUsers;
  changeOwner(aid, a); assert(await controller.load()); assert.equal(state().context.revision, 0);
  assert.equal(describeCanonicalMyStuff(state(), aid).hasProfile, false);
  const now = new Date().toISOString();
  assert.ifError((await admin.from('products').insert({ id: productId, brand: 'Explicit acceptance fixture', name: 'P0-B synthetic moisturizer', category: 'moisturizer', is_catalog_standard: true, catalog_source_reference: 'https://fixture.invalid/p0b-customer', catalog_public_source_url: 'https://fixture.invalid/p0b-customer', catalog_observed_at: now, catalog_verified_at: now })).error); owned.product = productId;
  assert.ifError((await admin.from('product_variants').insert({ id: variantId, product_id: productId, variant_name: 'Synthetic package', catalog_verification_status: 'verified', catalog_source_reference: 'https://fixture.invalid/p0b-customer', catalog_observed_at: now })).error); owned.variant = variantId;
  assert.ifError((await admin.from('product_formula_versions').insert({ id: formulaId, variant_id: variantId, ingredients: ['Water', 'Glycerin'], normalized_ingredient_fingerprint: 'water|glycerin', provenance_type: 'founder_review', source_reference: 'https://fixture.invalid/p0b-customer', catalog_public_source_url: 'https://fixture.invalid/p0b-customer', observed_at: now, verification_status: 'verified' })).error); owned.formula = formulaId;
  const identifier = await admin.from('product_identifiers').insert({ variant_id: variantId, formula_version_id: formulaId, identifier_type: 'gtin_12', identifier_value: '012345678905', source_authority: 'founder', source_reference: 'https://fixture.invalid/p0b-customer', observed_at: now, verified_at: now }).select('id').single(); assert.ifError(identifier.error); owned.identifier = identifier.data.id;
  const resolved = await a.functions.invoke('resolve-product-identity', { body: { requestId: randomUUID(), consumer: 'scan', barcode: '012345678905' } }); assert.ifError(resolved.error);
  const snapshot = resolved.data.truthSnapshot; assert(snapshot); assert.equal(snapshot.formula.formulaVersionId, formulaId);
  assert.equal(await count('product_truth_snapshots', 'user_id', aid), 1, 'Resolution actually created an owned immutable snapshot before cleanup');
  await assess(snapshot, 'NOT_ENOUGH_INFORMATION');

  const draft = createContextDraft();
  draft.intent = { state: 'answered', value: 'add' }; draft.primaryGoal = { state: 'answered', value: 'dryness' };
  draft.secondaryGoals = ['texture', 'redness']; draft.behavior = { state: 'answered', value: 'dry_tight' };
  draft.reactivity = { state: 'answered', value: 'generally_tolerates' };
  draft.pregnancy = draft.trying = draft.nursing = { state: 'answered', value: 'no' };
  draft.treatments = draft.sensitivities = { state: 'answered', value: [] };
  const profile = profileToStorage(draft);
  assert.equal(await controller.save({ operation: 'save_profile', profile: { ...profile, secondaryGoals: ['texture', 'redness', 'oiliness'] } }), false);
  assert.equal(await count('personal_context_revisions', 'user_id', aid), 0, 'A fourth total goal must not persist');
  assert.equal(await controller.save({ operation: 'save_profile', profile: { ...profile, secondaryGoals: ['dryness'] } }), false);
  assert.equal(await count('personal_context_revisions', 'user_id', aid), 0, 'The primary goal cannot also persist as secondary');
  dropWriteConfirmation = true;
  assert.equal(await controller.save({ operation: 'save_profile', profile }), false);
  assert.equal(state().status, 'error'); assert.equal(state().context.revision, 0);
  assert.equal(await count('personal_context_revisions', 'user_id', aid), 1, 'First write actually committed');
  assert(await controller.save({ operation: 'save_profile', profile }));
  assert.equal(trace[1].requestId, trace[2].requestId, 'Retry must retain the real committed request');
  assert.equal(trace[2].replayed, true); assert.equal(await count('personal_context_revisions', 'user_id', aid), 1);
  assert.deepEqual(state().context.profile.data.secondaryGoals, ['texture', 'redness']);
  assert(await controller.save({ operation: 'save_routine', routine: { completeness: 'complete', items: [] } }));
  await assess(snapshot, 'COULD_WORK');
  assert.equal(describeCanonicalMyStuff(state(), aid).hasProfile, true);

  const name = 'Synthetic QA Cedar 123, café';
  const manual = manualRoutineItem(randomUUID(), name);
  assert(await controller.save({ operation: 'save_routine', routine: routineToStorage({ completeness: 'partial', items: [manual] }) }));
  assert.equal(state().context.routine.data.items[0].reference.name, name, 'Exact client-entered Unicode text survives actual persistence');
  const partial = await assess(snapshot, 'NOT_ENOUGH_INFORMATION');
  assert(partial.evidenceNeeds.some(need => need.code === 'routine_completeness' && need.critical));
  const item = { ...state().context.routine.data.items[0], reference: { kind: 'catalog', productId, variantId, formulaVersionId: formulaId } };
  assert(await controller.save({ operation: 'save_routine', routine: { completeness: 'complete', items: [item] } }));
  const redundant = await assess(snapshot, 'KEEP_CURRENT'); assert(redundant.routineImpacts.some(impact => impact.kind === 'duplicates_role'));
  assert(await controller.save({ operation: 'save_routine', routine: { completeness: 'complete', items: [] } }));
  assert.equal(state().context.routine.data.items.length, 0); await assess(snapshot, 'COULD_WORK');

  const experience = { id: randomUUID(), reference: item.reference, kind: 'no_reaction_reported', occurred: { start: null, end: null }, useContext: null, symptoms: [], note: null };
  assert(await controller.save({ operation: 'append_experience', experience, supersedesRevisionId: null }));
  const original = state().context.experiences.find(record => record.data.id === experience.id);
  assert(await controller.save({ operation: 'append_experience', experience: { ...experience, kind: 'reacted', symptoms: ['Synthetic stinging report'] }, supersedesRevisionId: original.id }));
  assert.equal(state().context.experiences.length, 1); assert.equal(state().context.experiences[0].data.kind, 'reacted');
  const caution = await assess(snapshot, 'USE_WITH_CAUTION'); assert(caution.findings.some(finding => finding.kind === 'prior_product_reaction'));

  failLoad = true; assert.equal(await controller.load(), false); assert.equal(state().context, null); assert.equal(selectVisibleCustomerDecision(state(), aid, snapshot), null);
  failLoad = false; assert(await controller.load()); await assess(snapshot, 'USE_WITH_CAUTION');
  failDecision = true; await controller.assess(snapshot); assert.equal(state().decision.kind, 'unavailable');
  failDecision = false; await assess(snapshot, 'USE_WITH_CAUTION');
  changeOwner(bid, b); assert.equal(state().context, null); assert.equal(selectVisibleCustomerDecision(state(), bid, snapshot), null);
  assert(await controller.load()); assert.equal(state().context.revision, 0); assert.equal(state().context.experiences.length, 0);
  await controller.assess(snapshot); assert.equal(state().decision.kind, 'unavailable', 'B cannot use A resolver snapshot');
  changeOwner(null, b); assert.equal(state().context, null); assert.equal(state().decision.kind, 'idle');
  changeOwner(aid, a); assert(await controller.load()); await assess(snapshot, 'USE_WITH_CAUTION');
  for (const client of [a, b]) for (const table of ['personal_context_heads', 'personal_context_revisions', 'personal_decision_assessments']) {
    assert.equal((await client.from(table).select('*')).error?.code, '42501');
  }
} finally {
  changeOwner(null, a);
  const catalog = [['product_identifiers', owned.identifier], ['product_formula_versions', owned.formula], ['product_variants', owned.variant], ['products', owned.product]].filter(([, id]) => id);
  const deletions = [a, b].map((client, index) => ({ label: `session ${index + 1} sign-out`, run: async () => { assert.ifError((await client.auth.signOut()).error); } }));
  ownedUsers.forEach((id, index) => deletions.push({ label: `owned user ${index + 1} deletion`, run: async () => { assert.ifError((await admin.auth.admin.deleteUser(id)).error); } }));
  catalog.forEach(([table, id]) => deletions.push({ label: `${table} deletion`, run: async () => { assert.ifError((await admin.from(table).delete().eq('id', id)).error); } }));
  const checks = ownedUsers.map((id, index) => ({ label: `owned user ${index + 1} absence`, run: async () => {
    const result = await admin.auth.admin.getUserById(id);
    assert.equal(result.error?.code, 'user_not_found'); assert.equal(result.data.user, null);
  } }));
  for (const [index, id] of ownedUsers.entries()) for (const table of ['personal_context_heads', 'personal_context_revisions', 'personal_decision_assessments', 'product_resolution_cases', 'product_truth_snapshots']) checks.push({ label: `owned user ${index + 1} ${table} absence`, run: async () => { assert.equal(await count(table, 'user_id', id), 0); } });
  catalog.forEach(([table, id]) => checks.push({ label: `${table} absence`, run: async () => { assert.equal(await count(table, 'id', id), 0); } }));
  await attemptOwnedCleanup(deletions, checks);
}
console.log('PASS: actual mobile controller/remote adapters, SDK, local authoritative Edge and persistence; positive/redundancy/reaction/partial context, exact text, server goal cap, correction, response-loss idempotency, unavailable/retry, A-B-signout-A and private-table boundaries. Synthetic catalog inputs only. Native/physical/hosted/human acceptance remains separate.');
console.log('PASS: disposable identity/context/assessment/case/snapshot/catalog cleanup independently read back as zero.');
