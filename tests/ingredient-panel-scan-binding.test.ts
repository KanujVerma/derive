import assert from 'node:assert/strict';
import test from 'node:test';
import { ingredientEdgeFixture, owner, scan, rootId, parentId, photoPath, requestId } from './helpers/ingredient-panel-edge.ts';
import { createFreeEvidenceProcessor } from '../src/presentation/capture/freeEvidenceProcessor.ts';
import { createProductLinkController } from '../src/presentation/product-links/controller.ts';
import { handleProductLink, linkBarcodeResolutionInput } from '../supabase/functions/resolve-product-link/handler.ts';
import type { ProductLinkIntakeResult } from '../src/contracts/ProductLinkIntake.ts';

test('non-panel identity results retain their scan and bind the root without reserving ingredients', async () => {
  const f = ingredientEdgeFixture({ eligibleIdentity: true });
  const response = await f.invoke({ requestId: requestId(1), consumer: 'scan', scanSessionId: scan, barcode: '036000291452' });
  assert.equal(response.status, 200); assert.equal((await response.json()).caseId, rootId);
  assert.deepEqual(f.calls.map(c => c.name), ['record_product_resolution', 'seal_product_truth_snapshot', 'bind_product_ingredient_scan']);
  assert.equal(f.calls[0].args.p_evidence_snapshot.ingredientScanSessionId, scan);
  assert.deepEqual(f.calls[2].args, { p_user_id: owner, p_scan_session_id: scan, p_root_case_id: rootId, p_parent_snapshot_id: parentId });
});

test('ordinary front-label and barcode processors forward the same logical scan UUID without charging the local budget', async () => {
  const requests: any[] = []; let n = 0;
  const processor = createFreeEvidenceProcessor({ getOwnerId: () => owner, getScanSessionId: () => scan, createRequestId: () => requestId(++n),
    readPhoto: async () => ({ mimeType: 'image/jpeg', bytes: new ArrayBuffer(1) }),
    prepare: async input => ({ ...input, bucket: 'customer-product-evidence', storagePath: photoPath(n, 'front_label'), uploadToken: 'synthetic', maxBytes: 100, expiresAt: 'synthetic' }),
    upload: async () => {}, resolve: async input => { requests.push(input); return { caseId: rootId, state: 'insufficient_evidence', candidates: [], nextAction: 'manual_review', requiresFounderReview: false }; } });
  await processor.process([{ kind: 'barcode', role: 'barcode', value: '036000291452' }]);
  await processor.process([{ kind: 'local_photo', role: 'front_label', value: 'file:///front.jpg' }]);
  assert.equal(requests.length, 2); assert.ok(requests.every(input => input.scanSessionId === scan));
});

const url = 'https://world.openbeautyfacts.org/product/036000291452';
const recovery: ProductLinkIntakeResult = { status: 'needs_details', source: 'unsupported', reason: 'Synthetic', nextAction: 'search_or_photo' };
test('product-link fallback keeps scan continuity through controller and internal barcode forwarding', async () => {
  let forwarded: unknown;
  const controller = createProductLinkController({ createRequestId: () => requestId(1), getScanSessionId: () => scan,
    transport: async input => { forwarded = input; return recovery; } });
  controller.setOwner(owner); controller.setInput(url); await controller.submit();
  assert.deepEqual(forwarded, { requestId: requestId(1), scanSessionId: scan, url });
  let resolverScan: string | undefined;
  const response = await handleProductLink(new Request('https://synthetic.invalid', { method: 'POST' }), {
    authenticate: async () => ({ userId: owner, admin: {} }), readJsonObject: async () => forwarded as Record<string, unknown>,
    reserveExternalLookup: async () => { throw Error('No external lookup'); }, dailyMedEnabled: false,
    resolveBarcode: async (_identity, id, barcode, _request, scanSessionId) => { resolverScan = scanSessionId;
      assert.deepEqual(linkBarcodeResolutionInput(id, barcode, scanSessionId), { requestId: requestId(1), consumer: 'scan', barcode: '036000291452', barcodeSource: 'member_input', scanSessionId: scan });
      return { caseId: rootId, state: 'insufficient_evidence', candidates: [], nextAction: 'manual_review', requiresFounderReview: false }; },
    failure: (_code, message) => new Error(message), respond: body => Response.json(body), errorResponse: () => Response.json({}, { status: 500 }), corsHeaders: {},
  });
  assert.equal(response.status, 200); assert.equal(resolverScan, scan);
});

test('a delayed product-link result cannot publish into a changed scan and a new submit uses a fresh request', async () => {
  let currentScan = scan, complete!: (result: ProductLinkIntakeResult) => void, n = 0;
  const requests: any[] = [];
  const controller = createProductLinkController({ createRequestId: () => requestId(++n), getScanSessionId: () => currentScan,
    transport: async input => { requests.push(input); if (requests.length === 1) return new Promise(yes => { complete = yes; }); return recovery; } });
  controller.setOwner(owner); controller.setInput(url); const old = controller.submit();
  currentScan = requestId(2); complete(recovery); assert.equal(await old, null);
  assert.equal(controller.getState().kind, 'idle'); controller.setInput(url); await controller.submit();
  assert.notEqual(requests[0].requestId, requests[1].requestId); assert.equal(requests[1].scanSessionId, currentScan);
});
