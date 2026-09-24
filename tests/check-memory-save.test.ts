import assert from 'node:assert/strict';
import test from 'node:test';
import { createCheckMemorySaver, selectFreeCheckOwner, validateCheckResolution,
  selectSavableCheckCaseId, shouldHideCheckForOwner, canPublishCheckResult } from '../src/presentation/check/checkMemory.ts';
import { recordFreeCheck } from '../src/services/remote/freeContext.ts';
import type { ProductResolutionResult } from '../src/contracts/ProductIdentityResolver.ts';

const CASE_A = '11111111-1111-4111-8111-111111111111';
const CASE_B = '22222222-2222-4222-8222-222222222222';

test('a shown result waits for an explicit save and records its exact case once', async () => {
  const requests: unknown[] = [];
  const saver = createCheckMemorySaver(async (request) => {
    requests.push(request);
  }, () => '33333333-3333-4333-8333-333333333333');

  assert.equal(saver.status('owner-a', CASE_A), 'idle');
  assert.deepEqual(requests, []);
  assert.equal(await saver.save('owner-a', CASE_A), 'saved');
  assert.deepEqual(requests, [{
    operation: 'record_check', requestId: '33333333-3333-4333-8333-333333333333', caseId: CASE_A,
  }]);
  assert.equal(await saver.save('owner-a', CASE_A), 'saved');
  assert.equal(requests.length, 1);
});

test('double taps while a save is pending do not send another request', async () => {
  let finish!: () => void;
  const requests: unknown[] = [];
  const saver = createCheckMemorySaver(async (request) => {
    requests.push(request);
    await new Promise<void>((resolve) => { finish = resolve; });
  }, () => '44444444-4444-4444-8444-444444444444');

  const first = saver.save('owner-a', CASE_A);
  assert.equal(saver.status('owner-a', CASE_A), 'saving');
  assert.equal(await saver.save('owner-a', CASE_A), 'saving');
  assert.equal(requests.length, 1);
  finish();
  assert.equal(await first, 'saved');
});

test('a failed save reuses its request ID on customer retry', async () => {
  const requests: unknown[] = [];
  let fail = true;
  const saver = createCheckMemorySaver(async (request) => {
    requests.push(request);
    if (fail) throw new Error('response lost');
  }, () => '55555555-5555-4555-8555-555555555555');

  assert.equal(await saver.save('owner-a', CASE_A), 'failed');
  fail = false;
  assert.equal(await saver.save('owner-a', CASE_A), 'saved');
  assert.deepEqual(requests, [
    { operation: 'record_check', requestId: '55555555-5555-4555-8555-555555555555', caseId: CASE_A },
    { operation: 'record_check', requestId: '55555555-5555-4555-8555-555555555555', caseId: CASE_A },
  ]);
});

test('cases and owners stay separate, and missing identity never writes', async () => {
  const requests: unknown[] = [];
  let next = 0;
  const saver = createCheckMemorySaver(async (request) => { requests.push(request); }, () => `request-${++next}`);

  assert.equal(await saver.save(null, CASE_A), 'unavailable');
  assert.equal(await saver.save('owner-a', ''), 'unavailable');
  assert.equal(await saver.save('owner-a', CASE_A), 'saved');
  assert.equal(await saver.save('owner-a', CASE_B), 'saved');
  assert.equal(await saver.save('owner-b', CASE_A), 'saved');
  assert.deepEqual(requests, [
    { operation: 'record_check', requestId: 'request-1', caseId: CASE_A },
    { operation: 'record_check', requestId: 'request-2', caseId: CASE_B },
    { operation: 'record_check', requestId: 'request-3', caseId: CASE_A },
  ]);
  assert.equal(saver.status('owner-a', CASE_A), 'saved');
  assert.equal(saver.status('owner-b', CASE_B), 'idle');
});

test('the owner gate allows only ready local free Auth for the same account', () => {
  const ready = {
    shell: 'local_free_integration' as const,
    authStatus: 'SIGNED_IN' as const,
    sessionUserId: 'owner-a',
    accessStatus: 'READY', accessUserId: 'owner-a', accessOwnerId: 'owner-a',
  };
  assert.equal(selectFreeCheckOwner(ready), 'owner-a');
  assert.equal(selectFreeCheckOwner({ ...ready, shell: 'scanner_first_preview' }), null);
  assert.equal(selectFreeCheckOwner({ ...ready, shell: 'legacy' }), null);
  assert.equal(selectFreeCheckOwner({ ...ready, authStatus: 'SIGNED_OUT' }), null);
  assert.equal(selectFreeCheckOwner({ ...ready, sessionUserId: null }), null);
  assert.equal(selectFreeCheckOwner({ ...ready, accessStatus: 'RESOLVING' }), null);
  assert.equal(selectFreeCheckOwner({ ...ready, accessUserId: 'owner-b' }), null);
  assert.equal(selectFreeCheckOwner({ ...ready, accessOwnerId: 'owner-b' }), null);
});

test('the explicit action reaches the S-FREE-3 Edge contract with only the scan case', async () => {
  const calls: { name: string; body: object }[] = [];
  const client = { functions: { invoke: async (name: string, options: { body: object }) => {
    calls.push({ name, body: options.body });
    return { data: { check: { id: 'saved-check' } }, error: null };
  } } };
  const saver = createCheckMemorySaver((request) => recordFreeCheck(request, client),
    () => '66666666-6666-4666-8666-666666666666');

  assert.equal(await saver.save('owner-a', CASE_A), 'saved');
  assert.deepEqual(calls, [{ name: 'free-context', body: {
    operation: 'record_check', requestId: '66666666-6666-4666-8666-666666666666', caseId: CASE_A,
  } }]);
});

test('a mismatched catalog selection is rejected before its case can be saved', () => {
  const result: ProductResolutionResult = {
    caseId: CASE_A, state: 'identified_formula_unverified',
    product: { productId: CASE_A, brand: 'Example', name: 'Product' },
    candidates: [], nextAction: 'confirm_variant', requiresFounderReview: false,
  };
  assert.throws(() => validateCheckResolution(result, CASE_B), /identities disagree/);
  assert.equal(validateCheckResolution(result, CASE_A), result);
  assert.equal(selectSavableCheckCaseId({ caseId: result.caseId, liveOwner: 'owner-a',
    resultOwner: null, hasError: true }), null);
});

test('an error or account switch cannot expose the save action for an old result', () => {
  const shown = { caseId: CASE_A, liveOwner: 'owner-a', resultOwner: 'owner-a', hasError: false };
  assert.equal(selectSavableCheckCaseId(shown), CASE_A);
  assert.equal(selectSavableCheckCaseId({ ...shown, hasError: true }), null);
  assert.equal(selectSavableCheckCaseId({ ...shown, liveOwner: 'owner-b' }), null);
  assert.equal(selectSavableCheckCaseId({ ...shown, caseId: null }), null);
});

test('a retained Check result is hidden immediately across owner or access changes', () => {
  const shown = {
    integrated: true, previousOwner: 'owner-a', sessionUserId: 'owner-a',
    liveOwner: 'owner-a', resultOwner: 'owner-a', hasResult: true,
  };
  assert.equal(shouldHideCheckForOwner(shown), false);
  assert.equal(shouldHideCheckForOwner({ ...shown, sessionUserId: 'owner-b', liveOwner: 'owner-b' }), true);
  assert.equal(shouldHideCheckForOwner({ ...shown, sessionUserId: 'owner-b', liveOwner: 'owner-b', hasResult: false }), true);
  assert.equal(shouldHideCheckForOwner({ ...shown, sessionUserId: null, liveOwner: null }), true);
  assert.equal(shouldHideCheckForOwner({ ...shown, liveOwner: null }), true);
  assert.equal(shouldHideCheckForOwner({ ...shown, integrated: false, sessionUserId: 'owner-b' }), false);
  assert.equal(canPublishCheckResult(true, 'owner-a', 'owner-b'), false);
  assert.equal(canPublishCheckResult(true, 'owner-a', null), false);
  assert.equal(canPublishCheckResult(true, 'owner-a', 'owner-a'), true);
  assert.equal(canPublishCheckResult(false, null, null), true);
});
