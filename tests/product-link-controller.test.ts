import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductLinkController } from '../src/presentation/product-links/controller.ts';
import { ProductLinkError } from '../src/services/productLinks.ts';
import type { ProductLinkIntakeResult } from '../src/contracts/ProductLinkIntake.ts';

const firstUrl = 'https://www.amazon.com/dp/B00ABC1234';
const secondUrl = 'https://www.amazon.com/dp/B00ABC1235';
const id = '2f2f6f97-f988-4d46-b871-aeb8c2e2aa21';
const recovery: ProductLinkIntakeResult = { status: 'needs_details', source: 'amazon', reason: 'Provider text must not become a customer instruction.', nextAction: 'search_or_photo' };
const label: ProductLinkIntakeResult = { status: 'label_candidate', nextAction: 'confirm_package', candidate: {
  source: 'dailymed_spl', sourceRecordId: id, sourceVersion: 1, title: 'Example SPF 30 label',
  publishedDate: 'Jun 15, 2020', sourceUrl: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${id}`,
  retrievedAt: '2026-09-29T00:00:00.000Z', identityStatus: 'label_title_only',
} };
const resolution: ProductLinkIntakeResult = { status: 'resolution', source: 'open_beauty_facts_url',
  sourceUrl: 'https://world.openbeautyfacts.org/product/036000291452', barcode: '036000291452', resolution: {
    caseId: id, state: 'insufficient_evidence', candidates: [], nextAction: 'manual_review', requiresFounderReview: false,
  } };
const deferred = () => {
  let resolve!: (value: ProductLinkIntakeResult) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<ProductLinkIntakeResult>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('an explicit response-loss retry reuses its owner/input request ID without automatic calls', async () => {
  const requests: Array<{ requestId: string; url: string }> = [];
  let generated = 0;
  const controller = createProductLinkController({ createRequestId: () => { generated++; return id; },
    transport: async (input) => { requests.push(input); if (requests.length === 1) throw new Error('response lost'); return recovery; } });
  controller.setOwner('first'); controller.setInput(firstUrl);
  await controller.submit();
  assert.equal(controller.getState().kind, 'error');
  assert.equal(requests.length, 1);
  await controller.submit();
  assert.deepEqual(requests, [{ requestId: id, url: firstUrl }, { requestId: id, url: firstUrl }]);
  assert.equal(generated, 1);
  assert.equal(controller.getState().kind, 'needs_details');
});

test('owner switches clear the link and fence every late success/error branch', async () => {
  for (const outcome of [resolution, label, recovery, new ProductLinkError('RATE_LIMITED')]) {
    const pending = deferred();
    const controller = createProductLinkController({ createRequestId: () => id, transport: () => pending.promise });
    controller.setOwner('first'); controller.setInput(firstUrl);
    const request = controller.submit();
    controller.setOwner('second');
    if (outcome instanceof Error) pending.reject(outcome); else pending.resolve(outcome);
    assert.equal(await request, null);
    assert.deepEqual(controller.getState(), { ownerId: 'second', url: '', requestId: null, kind: 'idle', message: null });
  }
  let liveOwner: string | null = 'first';
  const pending = deferred();
  const controller = createProductLinkController({ createRequestId: () => id, getCurrentOwner: () => liveOwner, transport: () => pending.promise });
  controller.setOwner('first'); controller.setInput(firstUrl);
  const request = controller.submit(); liveOwner = null; pending.resolve(label);
  assert.equal(await request, null, 'live logout wins before the React owner effect');
  assert.deepEqual(controller.getState(), { ownerId: null, url: '', requestId: null, kind: 'idle', message: null });
});

test('newer input fences every old result/error and produces a new request ID', async () => {
  for (const outcome of [resolution, label, recovery, new ProductLinkError('UNAVAILABLE')]) {
    const first = deferred(); const second = deferred();
    const requests: Array<{ requestId: string; url: string }> = [];
    let generated = 0;
    const controller = createProductLinkController({ createRequestId: () => `request-${++generated}`,
      transport: (input) => { requests.push(input); return requests.length === 1 ? first.promise : second.promise; } });
    controller.setOwner('owner'); controller.setInput(firstUrl);
    const stale = controller.submit();
    controller.setInput(secondUrl);
    const current = controller.submit();
    second.resolve(recovery);
    assert.equal(await current, recovery);
    if (outcome instanceof Error) first.reject(outcome); else first.resolve(outcome);
    assert.equal(await stale, null);
    assert.equal(controller.getState().url, secondUrl);
    assert.equal(controller.getState().kind, 'needs_details');
    assert.equal(controller.getState().requestId, 'request-2');
  }
});

test('label-only output stays distinct from resolution and uses safe recovery copy', async () => {
  let outcome: ProductLinkIntakeResult = label;
  const controller = createProductLinkController({ createRequestId: () => id, transport: async () => outcome });
  controller.setOwner('owner'); controller.setInput(firstUrl);
  await controller.submit();
  const state = controller.getState();
  assert.equal(state.kind, 'label_candidate');
  if (state.kind === 'label_candidate') {
    assert.equal(state.result.candidate.identityStatus, 'label_title_only');
    assert.equal('resolution' in state.result, false);
    assert.match(state.message, /possible match/);
  }
  outcome = recovery; controller.setInput(secondUrl); await controller.submit();
  assert.doesNotMatch(controller.getState().message ?? '', /Provider text/);
});

test('typed quota is visible, private transport errors are hidden, and loading suppresses duplicate submit', async () => {
  const pending = deferred(); let calls = 0;
  const controller = createProductLinkController({ createRequestId: () => id, transport: () => { calls++; return pending.promise; } });
  controller.setOwner('owner'); controller.setInput(firstUrl);
  const request = controller.submit();
  assert.equal(await controller.submit(), null);
  assert.equal(calls, 1);
  pending.reject(new ProductLinkError('RATE_LIMITED'));
  await request;
  const state = controller.getState();
  assert.equal(state.kind, 'error');
  if (state.kind === 'error') assert.equal(state.code, 'RATE_LIMITED');
  assert.match(state.message ?? '', /temporarily limited/);
  const failing = createProductLinkController({ createRequestId: () => id, transport: async () => { throw new Error('secret URL token'); } });
  failing.setOwner('owner'); failing.setInput(firstUrl); await failing.submit();
  assert.doesNotMatch(failing.getState().message ?? '', /secret/);
});

test('reset invalidates pending input and empty/owner-unavailable attempts do not invoke transport', async () => {
  let calls = 0; const pending = deferred();
  const controller = createProductLinkController({ createRequestId: () => id, transport: () => { calls++; return pending.promise; } });
  await controller.submit();
  controller.setOwner('owner'); await controller.submit();
  assert.equal(calls, 0);
  controller.setInput(firstUrl); const request = controller.submit(); controller.reset(); pending.resolve(resolution);
  assert.equal(await request, null);
  assert.deepEqual(controller.getState(), { ownerId: 'owner', url: '', requestId: null, kind: 'idle', message: null });
});
