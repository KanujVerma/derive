/** Actual local Auth/Edge/persistence through existing customer controllers. Obtain shared-service lease before --run. */
import assert from 'node:assert/strict';
import { randomUUID, randomInt, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { sourceMetadata } from './acceptance/p0d/sourceMetadata.mjs';
import { assertLocalRun, LOCAL_CHECKS } from './acceptance/p0d/releaseEvidence.ts';
import { cleanupP0dFixtures } from './acceptance/p0d/cleanup.ts';
const args = process.argv.slice(2);
if (args.includes('--help')) {
 console.log('Usage: node --experimental-strip-types scripts/test-p0d-customer-flow-local.mjs --dry-run | --run --output /private/tmp/p0d-local.json\n--dry-run touches no database/services. --run requires the root shared-service lease, existing exact-local Supabase and served Edge functions. Never starts or resets the stack. Creates and cleans synthetic catalog/guest rows. Proves local API/controller/persistence only, never UI/camera/hosted/binary/customer acceptance.');
 process.exit(0);
}
if (args.length === 1 && args[0] === '--dry-run') {
 console.log(JSON.stringify({ status: 'NOT_RUN', source: sourceMetadata(), environment: { kind: 'local', apiUrl: 'http://127.0.0.1:54321' }, fixtureMode: 'synthetic_catalog', intendedChecks: LOCAL_CHECKS, binary: null, limitations: ['No services contacted.', 'No camera, UI, OCR, hosted guest, physical phone or TestFlight proof.'] }, null, 2)); process.exit(0);
}
assert(args.length === 3 && args[0] === '--run' && args[1] === '--output' && args[2], 'Expected --dry-run or --run --output PATH');
const source = sourceMetadata(); assert.equal(source.dirty, false, 'Commit source before producing a pinned receipt');
const status = JSON.parse(execFileSync(process.env.SUPABASE_CLI ?? 'supabase', ['status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
assertLocalRun(status.API_URL, true);
const { createClient } = await import('@supabase/supabase-js');
const { CustomerController, selectVisibleCustomerDecision, describeCanonicalMyStuff } = await import('../src/presentation/personal-decision/customerController.ts');
const { describePersonalDecision } = await import('../src/presentation/personal-decision/result.ts');
const { describeProductTruth } = await import('../src/presentation/capture/productTruthPresentation.ts');
const { mapFreeMyStuff } = await import('../src/presentation/my-stuff/liveMyStuff.ts');
const { createCheckMemorySaver } = await import('../src/presentation/check/checkMemory.ts');
const make = key => createClient(status.API_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
const admin = make(status.SERVICE_ROLE_KEY), guest = make(status.ANON_KEY), other = make(status.ANON_KEY);
const checks = [], trace = [], users = []; const fixtures = { product: null, variant: null, formula: null, identifier: null };
const digest = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
async function call(client, name, body) {
 const response = await client.functions.invoke(name, { body });
 const responseStatus = response.error?.context?.status ?? 200;
 trace.push({ function: name, operation: body.operation ?? 'request', status: responseStatus, responseSha256: digest(response.data) });
 return { ...response, status: responseStatus };
}
async function good(client, name, body) { const result = await call(client, name, body); assert.ifError(result.error); assert.equal(result.status, 200); return result.data; }
const passed = (id, observation) => checks.push({ id, outcome: 'passed', observation });
let controller;
try {
 for (const client of [guest, other]) { const signed = await client.auth.signInAnonymously(); assert.ifError(signed.error); assert.equal(signed.data.user.is_anonymous, true); users.push(signed.data.user.id); }
 const owner = users[0];
 const access = await good(guest, 'access-state', {}); assert.equal(access.userId, owner); assert.equal(access.freeProductAccess, true); assert.equal(access.identityKind, 'anonymous'); assert.equal(access.managedAccess, false); assert.equal(access.managedMembershipStatus, 'none');
 passed('guest_free_entry', 'Actual anonymous Auth identity receives free access without managed membership.');
 const now = new Date().toISOString(), token = randomUUID();
 const insert = async (table, row) => { const result = await admin.from(table).insert(row).select('id').single(); assert.ifError(result.error); return result.data.id; };
 fixtures.product = await insert('products', { brand: 'Explicit P0-D fixture', name: `P0D moisturizer ${token}`, category: 'moisturizer', is_catalog_standard: true, catalog_source_reference: 'https://fixture.invalid/p0d', catalog_public_source_url: 'https://fixture.invalid/p0d', catalog_observed_at: now, catalog_verified_at: now });
 fixtures.variant = await insert('product_variants', { product_id: fixtures.product, variant_name: 'Synthetic US bottle', catalog_verification_status: 'verified', catalog_source_reference: 'https://fixture.invalid/p0d', catalog_public_source_url: 'https://fixture.invalid/p0d', catalog_observed_at: now });
 fixtures.formula = await insert('product_formula_versions', { variant_id: fixtures.variant, ingredients: ['Water', 'Glycerin'], normalized_ingredient_fingerprint: `water|glycerin|${token}`, provenance_type: 'founder_review', source_reference: 'https://fixture.invalid/p0d', catalog_public_source_url: 'https://fixture.invalid/p0d', observed_at: now, verification_status: 'verified' });
 const prefix = String(randomInt(10000000000, 99999999999)), sum = [...prefix].reduce((v, digit, i) => v + Number(digit) * (i % 2 === 0 ? 3 : 1), 0), barcode = prefix + String((10 - sum % 10) % 10);
 fixtures.identifier = await insert('product_identifiers', { variant_id: fixtures.variant, formula_version_id: fixtures.formula, identifier_type: 'gtin_12', identifier_value: barcode, source_authority: 'founder', source_reference: 'https://fixture.invalid/p0d', observed_at: now, verified_at: now });
 const search = await good(guest, 'catalog-products', { operation: 'search', query: token, limit: 10 }); assert(search.items.some(item => item.productId === fixtures.product));
 passed('catalog_search', 'Authenticated catalog search finds the uniquely seeded sourced fixture.');
 const unknown = await good(guest, 'resolve-product-identity', { requestId: randomUUID(), consumer: 'scan', brand: 'Unknown P0D', productName: `No match ${token}` });
 assert.equal(unknown.state, 'insufficient_evidence'); assert(!unknown.product); assert.match(describeProductTruth(unknown.truthSnapshot).nextAction, /barcode|search/i);
 passed('useful_unknown', 'Unresolved typed input remains insufficient; existing consumer copy offers barcode/search recovery. No contribution or recognition claim.');
 const resolveProduct = () => good(guest, 'resolve-product-identity', { requestId: randomUUID(), consumer: 'scan', barcode });
 const resolved = await resolveProduct(), snapshot = resolved.truthSnapshot; assert.equal(snapshot.formula.formulaVersionId, fixtures.formula); assert.equal(resolved.state, 'verified_product_formula');
 passed('immutable_facts', 'Actual resolver supplies the exact owner-bound product/variant/formula snapshot. Barcode is a synthetic API input, not camera proof.');
 const gateway = { load: async () => good(guest, 'personal-context', { operation: 'get_context' }), write: async (_owner, request) => good(guest, 'personal-context', request), evaluate: async (_owner, request) => good(guest, 'personal-decision', request) };
 controller = new CustomerController(gateway, randomUUID); controller.setOwner(owner); assert.equal(await controller.load(), true); assert.equal(controller.getState().context.profile, null);
 await controller.assess(snapshot, 'add'); let selected = selectVisibleCustomerDecision(controller.getState(), owner, snapshot); assert(selected); assert.equal(selected.packet.action.kind, 'NOT_ENOUGH_INFORMATION');
 passed('optional_context', 'Factual Check works with empty context; canonical decision abstains before optional profile is supplied.');
 const profile = { intent: 'add', primaryGoal: 'dryness', secondaryGoals: [], skinBehavior: 'dry_tight', reactivity: 'generally_tolerates', reproductive: { pregnancy: 'no', nursing: 'no', tryingToConceive: 'no' }, sensitivities: { status: 'none_known', values: [] }, treatments: { status: 'none', values: [] } };
 assert.equal(await controller.save({ operation: 'save_profile', profile }), true);
 assert.equal(await controller.save({ operation: 'save_routine', routine: { completeness: 'complete', items: [] } }), true);
 await controller.assess(snapshot, 'add'); selected = selectVisibleCustomerDecision(controller.getState(), owner, snapshot); assert(selected); const view = describePersonalDecision(selected.packet, selected.expectedBinding); assert.equal(view.kind, 'ready'); assert.equal(view.action, 'COULD_WORK'); assert.equal(view.nextStep, 'consider_use');
 passed('personal_decision', 'Existing CustomerController and bounded renderer produce supported moisturizer action/reason/next step from authoritative stored truth.');
 const reference = { kind: 'catalog', productId: fixtures.product, variantId: fixtures.variant, formulaVersionId: fixtures.formula };
 const item = { id: randomUUID(), reference, state: 'current', timing: 'pm', frequency: { kind: 'qualitative', value: 'daily' }, startedOn: null, stoppedOn: null, duration: null };
 assert.equal(await controller.save({ operation: 'save_routine', routine: { completeness: 'complete', items: [item] } }), true);
 const experience = { id: randomUUID(), reference, kind: 'no_reaction_reported', occurred: { start: null, end: null }, useContext: null, symptoms: [], note: null };
 assert.equal(await controller.save({ operation: 'append_experience', supersedesRevisionId: null, experience }), true);
 const summary = describeCanonicalMyStuff(controller.getState(), owner); assert.equal(summary.kind, 'ready'); assert.equal(summary.primaryGoal, 'Dryness & barrier'); assert.match(summary.experienceSummary, /1 saved product experience/);
 passed('routine_history', 'Canonical routine and reported experience persist/read through existing controller; My Stuff summary preserves primary goal and report wording.');
 const lists = async client => Promise.all(['products', 'checks', 'experiences'].map(section => good(client, 'free-context', { operation: 'list', section })));
 assert.deepEqual((await lists(guest))[1].items, [], 'Resolution/assessment never auto-save Check history');
 const saver = createCheckMemorySaver(request => good(guest, 'free-context', request), randomUUID); assert.equal(await saver.save(owner, resolved.caseId), 'saved'); assert.equal(await saver.save(owner, resolved.caseId), 'saved');
 const unknownSaver = createCheckMemorySaver(request => good(guest, 'free-context', request), randomUUID); assert.equal(await unknownSaver.save(owner, unknown.caseId), 'saved');
 await good(guest, 'free-context', { operation: 'save_product', requestId: randomUUID(), product: { productId: fixtures.product }, state: 'using' });
 await good(guest, 'free-context', { operation: 'save_product', requestId: randomUUID(), product: { name: 'Unidentified P0D wash' }, state: 'considering' });
 const [products, history, experiences] = await lists(guest); assert.equal(history.items.length, 2);
 const memory = mapFreeMyStuff(null, products.items, history.items, experiences.items); assert(memory.checks.some(check => check.productName === 'Product not identified')); assert(memory.products.some(product => product.source === 'user_reported' && product.name === 'Unidentified P0D wash'));
 passed('explicit_my_stuff', 'Explicit case save is idempotent. Unknown stays Product not identified; manual saved product remains user_reported.');
 const repeated = await resolveProduct(); await controller.assess(repeated.truthSnapshot, 'add'); selected = selectVisibleCustomerDecision(controller.getState(), owner, repeated.truthSnapshot); assert(selected); assert.equal(selected.packet.action.kind, 'KEEP_CURRENT'); assert.equal(selected.contextRevision, controller.getState().context.revision);
 passed('repeat_check', 'New immutable Check consumes current canonical routine/history and returns KEEP_CURRENT without duplicating history.');
 assert.deepEqual((await lists(other)).flatMap(list => list.items), []); assert.equal((await call(other, 'free-context', { operation: 'record_check', requestId: randomUUID(), caseId: resolved.caseId })).status, 404);
 controller.setOwner(users[1]); assert.equal(controller.getState().context, null); assert.equal(selectVisibleCustomerDecision(controller.getState(), users[1], repeated.truthSnapshot), null);
 passed('owner_isolation', 'Second guest cannot read/save first guest history; existing customer controller clears the prior owner immediately.');
 await good(guest, 'delete-customer-account', { confirmation: 'DELETE_MY_DERIVE_ACCOUNT' }); assert.equal((await admin.auth.admin.getUserById(owner)).error?.status, 404);
 for (const table of ['personal_context_revisions', 'personal_decision_assessments', 'free_saved_products', 'free_check_history', 'free_product_experiences', 'product_resolution_cases']) { const result = await admin.from(table).select('id').eq('user_id', owner); assert.ifError(result.error); assert.deepEqual(result.data, []); }
 users[0] = null;
 passed('customer_deletion', 'Actual customer deletion Edge removes synthetic guest Auth and canonical/free/Check records; no billing entitlement used.');
} finally {
 controller?.setOwner(null);
 await cleanupP0dFixtures(admin, users, fixtures);
}
passed('fixture_cleanup', 'Only generated guests and random-ID fixture catalog rows were removed; checked absence. Shared stack unchanged.');
assert.deepEqual(checks.map(check => check.id), [...LOCAL_CHECKS]); assert.deepEqual(sourceMetadata(), source, 'Source changed during the run');
const receipt = { version: 1, kind: 'local_api', source, observedAt: new Date().toISOString(), environment: { kind: 'local', apiUrl: status.API_URL }, binary: null, fixtureMode: 'synthetic_catalog', checks, trace, limitation: 'Actual local APIs/controller/persistence with synthetic catalog. No camera/UI, production catalog coverage, hosted, physical, TestFlight or human acceptance.' };
const receiptBytes = JSON.stringify(receipt, null, 2);
writeFileSync(args[2], receiptBytes, { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ status: 'LOCAL_API_PROVEN', source, receiptPath: args[2], sha256: createHash('sha256').update(receiptBytes).digest('hex'), checks: checks.map(check => check.id), binary: null, fixtureMode: 'synthetic_catalog' }, null, 2));
