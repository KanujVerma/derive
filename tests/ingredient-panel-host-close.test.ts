import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness } from './ux-profile-render.ts';
import { verifiedProductTruth } from '../src/fixtures/product-truth/snapshots.ts';
import type { CaptureResult, CaptureHandoff } from '../src/presentation/capture/productEvidence.ts';

test('native modal close cancels synchronously before a late verified ingredient response or handoff can publish', async () => {
  let finish!: (result: CaptureResult) => void;
  const pending = new Promise<CaptureResult>(resolve => { finish = resolve; });
  let closes = 0, deliveries = 0;
  const h = componentHarness('src/components/check/capture/CheckCaptureHost.tsx', 'CheckCaptureHost', {
    onClose() { closes++; }, onCaptureReady() { deliveries++; }, photoCaptureEnabled: true,
    processor: { process: () => pending, resolutionFor: () => ({ caseId: verifiedProductTruth.resolutionCaseId,
      state: 'verified_product_formula', product: verifiedProductTruth.product, truthSnapshot: verifiedProductTruth,
      candidates: [], nextAction: 'evaluate_product_fit', requiresFounderReview: false }) },
  }, { effects: true, modules: {
    './ProductEvidenceCapture': { ProductEvidenceCapture: 'ProductEvidenceCapture' },
    '../../../presentation/capture/liveFreeEvidenceProcessor': { createLiveFreeEvidenceProcessor() { throw Error('No I/O allowed'); } },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider' },
    'react-native': { Modal: 'Modal', View: 'View', AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
  } });
  const nodes = h.render(); const child = nodes.find(node => node.type === 'ProductEvidenceCapture')!;
  const capture: CaptureHandoff = { authority: 'customer_evidence', evidence: [{ kind: 'local_photo', role: 'ingredients', value: 'file:///panel.jpg' }] };
  const reviewing = child.props.processor.process(capture.evidence);
  nodes.find(node => node.type === 'Modal')!.props.onRequestClose();
  finish({ state: 'candidates', candidates: [] });
  await assert.rejects(reviewing);
  child.props.onEvidenceReady(capture);
  assert.equal(closes, 1); assert.equal(deliveries, 0);
  assert.equal(child.props.ingredientPanels.getState().attempts, 1);
  h.dispose();
});

test('foreground delivery drops background evidence from a prior scan session', async () => {
  let onAppState!: (state: string) => void; let deliveries = 0;
  const h = componentHarness('src/components/check/capture/CheckCaptureHost.tsx', 'CheckCaptureHost', {
    onClose() {}, onCaptureReady() { deliveries++; }, processor: { async process() { return { state: 'unknown', candidates: [] }; } },
  }, { effects: true, modules: {
    './ProductEvidenceCapture': { ProductEvidenceCapture: 'ProductEvidenceCapture' },
    '../../../presentation/capture/liveFreeEvidenceProcessor': { createLiveFreeEvidenceProcessor() { throw Error('No I/O allowed'); } },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider' },
    'react-native': { Modal: 'Modal', View: 'View', AppState: { currentState: 'background', addEventListener: (_event: string, callback: (state: string) => void) => { onAppState = callback; return { remove() {} }; } } },
  } });
  const child = h.render().find(node => node.type === 'ProductEvidenceCapture')!;
  child.props.onEvidenceReady({ authority: 'customer_evidence', evidence: [{ kind: 'local_photo', role: 'front_label', value: 'file:///prior-session.jpg' }] });
  child.props.ingredientPanels.startNewSession();
  onAppState('active');
  assert.equal(deliveries, 0);
  h.dispose();
});
