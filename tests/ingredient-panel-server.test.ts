import assert from 'node:assert/strict';
import test from 'node:test';
import { ingredientEdgeFixture, owner, otherOwner, scan, rootId, parentId, photoPath, requestId } from './helpers/ingredient-panel-edge.ts';
import { createFreeEvidenceProcessor } from '../src/presentation/capture/freeEvidenceProcessor.ts';
import { createIngredientContinuationProcessor } from '../src/presentation/capture/ingredientContinuationProcessor.ts';
import { createCheckCaptureBridge } from '../src/presentation/capture/checkCaptureAdapter.ts';
import { createIngredientPanelSession } from '../src/presentation/capture/ingredientPanelSession.ts';
import { resolveCatalogIdentity, continueCatalogIngredients } from '../src/services/productCatalog.ts';
import { parseIngredientPanelAttemptReceipt, IngredientPanelAttemptResponseError } from '../src/contracts/IngredientPanelAttempt.ts';
import { processIngredientPanelAttempt, ingredientEvidenceFingerprint } from '../supabase/functions/_shared/ingredient-panel-attempts.ts';
import { createPhotoExtractionAdapter } from '../supabase/functions/_shared/photo-extraction-adapter.ts';

const input = (n = 1) => ({ requestId: requestId(n), consumer: 'scan' as const, scanSessionId: scan,
  evidencePhotos: [{ role: 'ingredients' as const, storagePath: photoPath(n) }] });
const continuation = (n = 1) => ({ operation: 'continue_ingredients' as const, requestId: requestId(n), scanSessionId: scan,
  rootCaseId: rootId, parentSnapshotId: parentId, evidencePhoto: { role: 'ingredients' as const, storagePath: photoPath(n) } });
const receipt = (n = 1) => ({ kind: 'ingredient_panel_attempt', scanSessionId: scan, requestId: requestId(n), rootCaseId: null,
  parentSnapshotId: null, attemptsUsed: 1, outcome: 'unavailable', reason: 'unavailable', fallbackActions: [] });

test('default producer is unavailable, with a durable reservation and no truth/formula writes on both routes', async () => {
  for (const body of [input(), continuation()]) {
    const f = ingredientEdgeFixture(); const response = await f.invoke(body);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
    const result = await response.json();
    assert.equal(result.kind, 'ingredient_panel_attempt'); assert.equal(result.reason, 'unavailable');
    assert.equal(result.attemptsUsed, 1); assert.equal(result.rootCaseId, 'rootCaseId' in body ? rootId : null);
    assert.deepEqual(f.calls.map(c => c.name), ['reserve_product_ingredient_panel', 'settle_product_ingredient_panel']);
    assert.equal(f.calls[0].args.p_user_id, owner); assert.equal(f.calls[0].args.p_scan_session_id, scan);
    assert.doesNotMatch(JSON.stringify(result), /storagePath|ingredients|formula|verdict|review|provider|leaseId/);
  }
});

test('front-label, packaging and barcode paths never reserve ingredient attempts', async () => {
  const f = ingredientEdgeFixture();
  for (const role of ['front_label', 'packaging'] as const) {
    const response = await f.invoke({ requestId: requestId(10), consumer: 'scan', evidencePhotos: [{ role, storagePath: photoPath(10, role) }] });
    assert.equal(response.status, 200); assert.notEqual((await response.json()).kind, 'ingredient_panel_attempt');
  }
  assert.equal((await f.invoke({ requestId: requestId(11), consumer: 'scan', barcode: '036000291452' })).status, 200);
  assert.equal(f.calls.filter(c => /ingredient_panel/.test(c.name)).length, 0);
});

test('Auth, owner, parent and granted stored object checks precede reservations', async () => {
  const fixtures = [
    [ingredientEdgeFixture(), input(), 'invalid', 401],
    [ingredientEdgeFixture(), { ...input(), evidencePhotos: [{ role: 'ingredients', storagePath: photoPath(1, 'ingredients', otherOwner) }] }, undefined, 400],
    [ingredientEdgeFixture({ grant: false }), input(), undefined, 403],
    [ingredientEdgeFixture({ stored: false }), input(), undefined, 409],
    [ingredientEdgeFixture({ userId: otherOwner }), continuation(), undefined, 400],
    [ingredientEdgeFixture({ root: null }), continuation(), undefined, 404],
    [ingredientEdgeFixture({ parent: null }), continuation(), undefined, 409],
    [ingredientEdgeFixture({ parent: { id: parentId, case_revision: 9 } }), continuation(), undefined, 409],
  ] as const;
  for (const [f, body, auth, status] of fixtures) {
    assert.equal((await f.invoke(body, auth)).status, status);
    assert.deepEqual(f.calls, []);
  }
});

test('missing session, duplicate panel roles and supplied OCR ingredients cannot bypass the photo boundary', async () => {
  const f = ingredientEdgeFixture();
  for (const body of [
    { ...input(), scanSessionId: undefined }, { ...continuation(), scanSessionId: undefined },
    { ...input(), ingredientList: ['Water', 'Invented'] }, { ...continuation(), ingredientList: ['Water', 'Invented'] },
    { ...input(), evidencePhotos: [input().evidencePhotos[0], input(2).evidencePhotos[0]] },
    { ...input(), evidencePhotos: [{ ...input().evidencePhotos[0], extractedText: 'Water, Invented' }] },
  ]) assert.equal((await f.invoke(body)).status, 400);
  assert.deepEqual(f.calls, []);
});

test('busy/replayed/exhausted reservations never run a second decoder or settle another lease', async () => {
  for (const decision of ['busy', 'replayed', 'exhausted']) {
    const f = ingredientEdgeFixture({ rpc: () => ({ data: { decision, attemptsUsed: 2, reason: 'unreadable' }, error: null }) });
    const response = await f.invoke(input()); const result = await response.json();
    assert.equal(result.outcome, decision === 'busy' ? 'in_progress' : 'exhausted');
    assert.equal(f.calls.length, 1); assert.deepEqual(result.fallbackActions, decision === 'busy' ? [] : ['product_link', 'verified_catalog', 'retry_later']);
  }
});

test('malformed or refused RPC receipts fail closed and sanitize private details', async () => {
  for (const response of [
    { data: { decision: 'reserved', attemptsUsed: 3, leaseId: 'private-token' }, error: null },
    { data: { decision: 'settled', attemptsUsed: 1, reason: 'made-up' }, error: null },
    { data: null, error: { code: '23505', message: 'private-token' } },
    { data: null, error: { code: 'XX001', message: 'private-token' } },
  ]) {
    const f = ingredientEdgeFixture({ rpc: () => response }); const result = await f.invoke(input());
    assert.ok([409, 503].includes(result.status)); assert.doesNotMatch(await result.text(), /private-token|made-up/);
  }
});

test('existing neutral decoder yields retake reasons or unconfirmed identity, never an authoritative formula', async () => {
  const adapter = createPhotoExtractionAdapter({ providerId: 'synthetic', modelId: 'synthetic', enabled: true });
  const evidenceId = await ingredientEvidenceFingerprint(photoPath(1));
  const raws = [
    { schemaVersion: 1, evidenceId, role: 'ingredients', outcome: 'abstained', abstentionReason: 'unreadable' },
    { schemaVersion: 1, evidenceId, role: 'ingredients', outcome: 'abstained', abstentionReason: 'conflicting_evidence' },
    { schemaVersion: 1, evidenceId, role: 'ingredients', outcome: 'abstained', abstentionReason: 'no_product_evidence' },
    { schemaVersion: 1, evidenceId, role: 'ingredients', outcome: 'candidate', productNameText: 'Synthetic', orderedIngredients: ['Invented'], labelText: 'Water' },
  ];
  for (const [i, raw] of raws.entries()) {
    const f = ingredientEdgeFixture();
    const result = await processIngredientPanelAttempt(f.admin, { userId: owner, scanSessionId: scan,
      requestId: requestId(1), requestFingerprint: 'a'.repeat(64), storagePath: photoPath(1) }, { adapter, raw });
    assert.equal(result.reason, ['unreadable', 'conflicting_evidence', 'no_product_evidence', 'unconfirmed'][i]);
    assert.doesNotMatch(JSON.stringify(result), /Invented|Water|formula|provider|review/);
  }
});

test('the catalog service accepts only a strict receipt bound to the exact photo request', async () => {
  const f = ingredientEdgeFixture();
  await assert.rejects(resolveCatalogIdentity(input(), f.client), IngredientPanelAttemptResponseError);
  await assert.rejects(continueCatalogIngredients(continuation(), f.client), error => {
    assert.ok(error instanceof IngredientPanelAttemptResponseError); assert.equal(error.receipt.rootCaseId, rootId); return true;
  });
  for (const bad of [{ ...receipt(), requestId: requestId(8) }, { ...receipt(), scanSessionId: requestId(8) },
    { ...receipt(), formula: ['Invented'] }, { ...receipt(), outcome: 'manual_review' }, { ...receipt(), attemptsUsed: 3 },
    { ...receipt(), rootCaseId: rootId, parentSnapshotId: parentId }]) {
    assert.throws(() => parseIngredientPanelAttemptReceipt(bad, { requestId: requestId(1), scanSessionId: scan }));
  }
});

test('server exhaustion wins over a fresh client counter through the actual route, service, processor and bridge', async () => {
  const panels = createIngredientPanelSession(() => scan);
  const f = ingredientEdgeFixture({ rpc: () => ({ data: { decision: 'exhausted', attemptsUsed: 2 }, error: null }) });
  let n = 0;
  const processor = createFreeEvidenceProcessor({ getOwnerId: () => owner, getScanSessionId: panels.getScanSessionId,
    createRequestId: () => requestId(++n), readPhoto: async () => ({ mimeType: 'image/jpeg', bytes: new ArrayBuffer(2) }),
    prepare: async i => ({ ...i, bucket: 'customer-product-evidence', storagePath: photoPath(n), maxBytes: 100, expiresAt: 'synthetic', uploadToken: 'synthetic' }),
    upload: async () => {}, resolve: value => resolveCatalogIdentity(value, f.client) });
  const bridge = createCheckCaptureBridge(processor, panels);
  const evidence = [{ kind: 'local_photo' as const, role: 'ingredients' as const, value: 'file:///synthetic.jpg' }];
  await assert.rejects(bridge.processor.process(evidence));
  assert.deepEqual(panels.getState(), { attempts: 2, phase: 'fallback', reason: 'unavailable' });
  assert.equal(bridge.handoff({ authority: 'customer_evidence', evidence }).resolvedCase, null);
  await assert.rejects(bridge.processor.process([{ ...evidence[0], value: 'file:///third.jpg' }]));
  assert.equal(f.calls.length, 1);
});

test('stable session IDs survive remounts and a changed session fences a delayed server receipt before dispatch', async () => {
  let id = 0; const panels = createIngredientPanelSession(() => requestId(++id));
  assert.equal(panels.getScanSessionId(), requestId(1));
  let release!: () => void, resolves = 0;
  const paused = new Promise<void>(yes => { release = yes; });
  const processor = createFreeEvidenceProcessor({ getOwnerId: () => owner, getScanSessionId: panels.getScanSessionId,
    createRequestId: () => requestId(20), readPhoto: async () => { await paused; return { mimeType: 'image/jpeg', bytes: new ArrayBuffer(2) }; },
    prepare: async () => { throw Error('A retired session must not prepare an upload'); }, upload: async () => {},
    resolve: async () => { resolves++; throw Error('A retired session must not resolve'); } });
  const result = processor.process([{ kind: 'local_photo', role: 'ingredients', value: 'file:///old.jpg' }]);
  const rejected = assert.rejects(result); panels.startNewSession(); release(); await rejected;
  assert.equal(panels.getScanSessionId(), requestId(2)); assert.equal(resolves, 0);
});

test('busy and replay receipts replace a tentative local charge and preserve the real remaining permit', async () => {
  for (const outcome of ['in_progress', 'unavailable'] as const) {
    const panels = createIngredientPanelSession(() => scan);
    const first = panels.begin('file:///first.jpg'); panels.cancel(first);
    const second = panels.begin('file:///retake.jpg');
    const r = parseIngredientPanelAttemptReceipt({ ...receipt(), outcome }, { requestId: requestId(1), scanSessionId: scan });
    assert.equal(panels.settleFromServer(second, r), true);
    assert.equal(panels.getState().attempts, 1);
    assert.equal(panels.getState().phase, 'retake');
    const retry = panels.begin('file:///retake.jpg');
    assert.equal(retry.attempt, 2);
  }
});
