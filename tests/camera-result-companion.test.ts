import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { ProductResolutionResult } from '../src/contracts/ProductIdentityResolver.ts';
import { unresolvedProductTruth } from '../src/fixtures/product-truth/snapshots.ts';
import { cameraCompanionSheet, cameraResultNeedsExistingPage } from '../src/presentation/check/result-sheet/cameraCompanion.ts';

const scanId = '11111111-1111-4111-8111-111111111111';
const base = { awaiting: true, checking: false, ownerId: 'owner-1', scanId, error: null, resolution: null, catalogProduct: null };
const unbound = { caseId: unresolvedProductTruth.resolutionCaseId, state: 'insufficient_evidence', candidates: [], nextAction: 'manual_review', requiresFounderReview: false } as ProductResolutionResult;

test('the camera sheet loads, binds a snapshot, and refuses an unbound finished result', () => {
  assert.equal(cameraCompanionSheet({ ...base, awaiting: false })?.kind, undefined);
  assert.equal(cameraCompanionSheet({ ...base, checking: true })?.kind, 'loading');
  assert.equal(cameraCompanionSheet({ ...base, error: 'offline' })?.kind, 'error');
  const bound = cameraCompanionSheet({ ...base, resolution: { ...unbound, truthSnapshot: unresolvedProductTruth } });
  assert.equal(bound?.kind, 'result');
  assert.equal(cameraCompanionSheet(base), null);
  assert.equal(cameraResultNeedsExistingPage({ ...base, resolution: unbound }), true);
  assert.equal(cameraResultNeedsExistingPage({ ...base, checking: true, resolution: unbound }), false);
});

test('Check keeps the camera mounted and does not pretend a follow-up photo continues the same case', () => {
  const check = readFileSync(new URL('../src/components/check/CheckProductScreen.tsx', import.meta.url), 'utf8');
  const host = readFileSync(new URL('../src/components/check/capture/CheckCaptureHost.tsx', import.meta.url), 'utf8');
  const capture = readFileSync(new URL('../src/components/check/capture/ProductEvidenceCapture.tsx', import.meta.url), 'utf8');
  assert.match(check, /cameraCompanionSheet\(/);
  assert.match(check, /detectionPaused=\{detectionPaused\}/);
  assert.doesNotMatch(check, /onAddRequestedEvidence/);
  assert.match(host, /detectionPaused=\{detectionPaused\}/);
  assert.match(capture, /const liveBarcode = !detectionPaused/);
  assert.match(capture, /onBarcodeScanned=\{liveBarcode \? onBarcode : undefined\}/);
});
