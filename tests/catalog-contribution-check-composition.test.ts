import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { selectCheckContributionRecovery } from '../src/presentation/catalog-contribution/checkRecovery.ts';

const check = readFileSync(new URL('../src/components/check/CheckProductScreen.tsx', import.meta.url), 'utf8');

test('recovery appears only for unresolved scanner-first product identity', () => {
  const base = { targetShell: true, ownerId: 'owner-a', caseId: 'case-a', observedBarcode: null,
    observedName: null };
  assert.equal(selectCheckContributionRecovery({ ...base, reason: null }), null);
  assert.equal(selectCheckContributionRecovery({ ...base, targetShell: false, reason: 'unresolved_check' }), null);
  assert.equal(selectCheckContributionRecovery({ ...base, reason: 'unknown_barcode' })?.availability.kind, 'unavailable');
  assert.equal(selectCheckContributionRecovery({ ...base, reason: 'unresolved_check' })?.availability.kind, 'unavailable');
  assert.equal(selectCheckContributionRecovery({ ...base, reason: 'unresolved_photo' })?.availability.kind, 'unavailable');
});

test('only an exact valid observed barcode is prefilled; photo URI is never part of a proposal', () => {
  const base = { targetShell: true, ownerId: 'owner-a', caseId: 'case-a', reason: 'unknown_barcode' as const,
    observedName: null };
  assert.deepEqual(selectCheckContributionRecovery({ ...base, observedBarcode: '036000291452' })?.initial,
    { gtin: '036000291452' });
  for (const observedBarcode of ['036-000291452', '000000000000', 'file:///private/photo.jpg']) {
    assert.deepEqual(selectCheckContributionRecovery({ ...base, observedBarcode })?.initial, {});
  }
  assert.deepEqual(selectCheckContributionRecovery({ ...base, reason: 'unresolved_check', observedBarcode: null,
    observedName: '  Typed product  ' })?.initial, { name: 'Typed product' });
  assert.deepEqual(selectCheckContributionRecovery({ ...base, reason: 'unresolved_photo', observedBarcode: null,
    observedName: 'Typed product' })?.initial, {});
});

test('owner or Check case changes the recovery context and cannot reuse a previous private draft', () => {
  const base = { targetShell: true, ownerId: 'owner-a', caseId: 'case-a', reason: 'unresolved_check' as const,
    observedBarcode: null, observedName: null };
  const first = selectCheckContributionRecovery(base);
  assert.ok(first);
  assert.notEqual(first.contextKey, selectCheckContributionRecovery({ ...base, ownerId: 'owner-b' })?.contextKey);
  assert.notEqual(first.contextKey, selectCheckContributionRecovery({ ...base, caseId: 'case-b' })?.contextKey);
});

test('Check composes recovery for unknown barcode, unresolved case, and unresolved photos without a send action', () => {
  assert.match(check, /import \{ MissingProductContribution \}/);
  assert.match(check, /reason: 'unknown_barcode'/);
  assert.match(check, /resolution\.state === 'insufficient_evidence'[\s\S]*?'unresolved_check'/);
  assert.match(check, /reason: 'unresolved_photo'/);
  assert.equal((check.match(/<MissingProductContribution/g) ?? []).length, 3);
  assert.doesNotMatch(check, /catalog-contribution['"]|submitCatalogContribution/);
});
