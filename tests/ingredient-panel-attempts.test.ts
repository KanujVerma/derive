import assert from 'node:assert/strict';
import test from 'node:test';
import { createCheckCaptureBridge } from '../src/presentation/capture/checkCaptureAdapter.ts';
import type { CaptureEvidence } from '../src/presentation/capture/productEvidence.ts';
import type { CaptureResult } from '../src/presentation/capture/productEvidence.ts';
import { createIngredientPanelSession, IngredientPanelAttemptError } from '../src/presentation/capture/ingredientPanelSession.ts';
import { verifiedProductTruth, formulaOnlyProductTruth } from '../src/fixtures/product-truth/snapshots.ts';
import type { ProductResolutionResult } from '../src/contracts/ProductIdentityResolver.ts';

const panel = (name: string): CaptureEvidence[] => [{ kind: 'local_photo', role: 'ingredients', value: `file:///${name}.jpg` }];

test('two unsuccessful ingredient panels stop further dispatch and never hand off an incomplete result', async () => {
  let calls = 0;
  const bridge = createCheckCaptureBridge({ async process() { calls++; return { state: 'insufficient_evidence', candidates: [] }; } });
  await assert.rejects(bridge.processor.process(panel('initial')));
  await assert.rejects(bridge.processor.process(panel('guided-retake')));
  await assert.rejects(bridge.processor.process(panel('third')));
  assert.equal(calls, 2);
  assert.equal(bridge.handoff({ authority: 'customer_evidence', evidence: panel('guided-retake') }).resolvedCase, null);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const verified: ProductResolutionResult = { caseId: verifiedProductTruth.resolutionCaseId, state: 'verified_product_formula',
  product: verifiedProductTruth.product!, candidates: [], nextAction: 'evaluate_product_fit', requiresFounderReview: false,
  truthSnapshot: verifiedProductTruth };
const unconfirmed: CaptureResult = { state: 'insufficient_evidence', candidates: [] };

test('duplicate panels cannot spend the retake or dispatch again after a completed failure', async () => {
  let calls = 0;
  const bridge = createCheckCaptureBridge({ async process() { calls++; return unconfirmed; } });
  await assert.rejects(bridge.processor.process(panel('same')));
  for (let tap = 0; tap < 5; tap++) await assert.rejects(bridge.processor.process(panel('same')), IngredientPanelAttemptError);
  assert.equal(calls, 1);
  assert.equal(bridge.ingredientPanels.getState().attempts, 1);
  await assert.rejects(bridge.processor.process(panel('different')));
  assert.equal(calls, 2);
  assert.equal(bridge.ingredientPanels.getState().phase, 'fallback');
});

test('concurrent same and different panels cannot reserve another attempt or invalidate the original response', async () => {
  const pending = deferred<CaptureResult>(); let calls = 0;
  const bridge = createCheckCaptureBridge({ process() { calls++; return pending.promise; }, resolutionFor: () => verified });
  const first = bridge.processor.process(panel('first'));
  await assert.rejects(bridge.processor.process(panel('first')));
  await assert.rejects(bridge.processor.process(panel('different')));
  assert.equal(bridge.ingredientPanels.getState().attempts, 1);
  pending.resolve({ state: 'candidates', candidates: [{ id: 'verified', label: 'Synthetic fixture' }] });
  await first;
  assert.equal(calls, 1);
  assert.equal(bridge.ingredientPanels.getState().phase, 'verified');
  assert.equal(bridge.handoff({ authority: 'customer_evidence', evidence: panel('first') }).resolvedCase, verified);
});

test('front label, packaging and barcode processing do not spend or replenish the ingredient budget', async () => {
  const bridge = createCheckCaptureBridge({ async process() { return unconfirmed; } });
  for (let i = 0; i < 3; i++) for (const role of ['front_label', 'packaging'] as const) {
    await bridge.processor.process([{ kind: 'local_photo', role, value: `file:///${role}-${i}.jpg` }]);
  }
  assert.equal(bridge.ingredientPanels.getState().attempts, 0);
  await assert.rejects(bridge.processor.process(panel('initial')));
  await bridge.processor.process([{ kind: 'barcode', role: 'barcode', value: '036000291452' }]);
  assert.equal(bridge.ingredientPanels.getState().attempts, 1);
  await assert.rejects(bridge.processor.process(panel('retake')));
  await bridge.processor.process([{ kind: 'local_photo', role: 'front_label', value: 'file:///new-front.jpg' }]);
  await assert.rejects(bridge.processor.process(panel('third')));
  assert.equal(bridge.ingredientPanels.getState().attempts, 2);
});

test('capture remounts share the exhausted budget until a deliberate new scan session', async () => {
  const session = createIngredientPanelSession(); let calls = 0;
  const processor = { async process() { calls++; return unconfirmed; } };
  await assert.rejects(createCheckCaptureBridge(processor, session).processor.process(panel('initial')));
  await assert.rejects(createCheckCaptureBridge(processor, session).processor.process(panel('retake')));
  await assert.rejects(createCheckCaptureBridge(processor, session).processor.process(panel('third')));
  assert.equal(calls, 2);
  session.startNewSession();
  await assert.rejects(createCheckCaptureBridge(processor, session).processor.process(panel('initial')));
  assert.equal(calls, 3);
  assert.equal(session.getState().attempts, 1);
});

test('new-session late success cannot reset the new budget, attach an old case or unlock its pending attempt', async () => {
  const session = createIngredientPanelSession(), old = deferred<CaptureResult>(), current = deferred<CaptureResult>();
  const first = createCheckCaptureBridge({ process: () => old.promise, resolutionFor: () => verified }, session);
  const stale = first.processor.process(panel('old')); const rejected = assert.rejects(stale, IngredientPanelAttemptError);
  session.startNewSession();
  const second = createCheckCaptureBridge({ process: () => current.promise }, session);
  const fresh = second.processor.process(panel('new')); const freshRejected = assert.rejects(fresh);
  old.resolve({ state: 'candidates', candidates: [] }); await rejected;
  assert.equal(session.getState().phase, 'processing'); assert.equal(session.getState().attempts, 1);
  assert.equal(first.handoff({ authority: 'customer_evidence', evidence: panel('old') }).resolvedCase, null);
  current.resolve(unconfirmed); await freshRejected;
  assert.equal(session.getState().phase, 'retake');
});

test('cancelling an in-flight attempt keeps its budget and fences stale completion after remount', async () => {
  const session = createIngredientPanelSession(), pending = deferred<CaptureResult>();
  const first = createCheckCaptureBridge({ process: () => pending.promise, resolutionFor: () => verified }, session);
  const stale = first.processor.process(panel('old')); const rejected = assert.rejects(stale);
  first.cancel();
  assert.deepEqual(session.getState(), { attempts: 1, phase: 'retake', reason: 'unavailable' });
  const second = createCheckCaptureBridge({ async process() { return { ...unconfirmed, ingredientPanelFailure: 'unreadable' }; } }, session);
  await assert.rejects(second.processor.process(panel('retake')));
  pending.resolve({ state: 'candidates', candidates: [] }); await rejected;
  assert.deepEqual(session.getState(), { attempts: 2, phase: 'fallback', reason: 'unreadable' });
});

test('failed provider or network responses consume only the submitted panel and never expose private errors', async () => {
  const bridge = createCheckCaptureBridge({ async process() { throw Error('private-provider-token'); } });
  await assert.rejects(bridge.processor.process(panel('first')), error => {
    assert.ok(error instanceof IngredientPanelAttemptError); assert.doesNotMatch(error.message, /token|provider/); return true;
  });
  assert.deepEqual(bridge.ingredientPanels.getState(), { attempts: 1, phase: 'retake', reason: 'unavailable' });
  await assert.rejects(bridge.processor.process(panel('second')));
  assert.equal(bridge.ingredientPanels.getState().phase, 'fallback');
});

test('candidate labels, formula-only and incomplete snapshots cannot count as verified ingredient success', async () => {
  for (const snapshot of [formulaOnlyProductTruth, { ...verifiedProductTruth, formula: null },
    { ...verifiedProductTruth, conflicts: [{ code: 'ingredient_mismatch' as const, status: 'unresolved' as const }] }]) {
    const bridge = createCheckCaptureBridge({ async process() { return { state: 'candidates', candidates: [{ id: 'guess', label: 'Guessed formula' }] }; },
      resolutionFor: () => ({ ...verified, truthSnapshot: snapshot }) });
    await assert.rejects(bridge.processor.process(panel('first')));
    assert.equal(bridge.ingredientPanels.getState().phase, 'retake');
    assert.equal(bridge.handoff({ authority: 'customer_evidence', evidence: panel('first') }).resolvedCase, null);
  }
});

test('mutating caller evidence while processing cannot bind the reviewed case to replacement pixels', async () => {
  const pending = deferred<CaptureResult>();
  const bridge = createCheckCaptureBridge({ process: () => pending.promise, resolutionFor: () => verified });
  const evidence = panel('original'); const work = bridge.processor.process(evidence);
  evidence[0].value = 'file:///replacement.jpg';
  pending.resolve({ state: 'candidates', candidates: [] }); await work;
  assert.equal(bridge.handoff({ authority: 'customer_evidence', evidence }).resolvedCase, null);
  assert.equal(bridge.handoff({ authority: 'customer_evidence', evidence: panel('original') }).resolvedCase, verified);
});

test('a deliberate new session withdraws even a previously completed ingredient handoff', async () => {
  const session = createIngredientPanelSession();
  const bridge = createCheckCaptureBridge({ async process() { return { state: 'candidates', candidates: [] }; }, resolutionFor: () => verified }, session);
  await bridge.processor.process(panel('previous'));
  assert.equal(bridge.handoff({ authority: 'customer_evidence', evidence: panel('previous') }).resolvedCase, verified);
  session.startNewSession();
  assert.equal(bridge.handoff({ authority: 'customer_evidence', evidence: panel('previous') }).resolvedCase, null);
});
