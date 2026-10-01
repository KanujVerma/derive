import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { PersonalContextSnapshot } from '../src/contracts/PersonalContext.ts';
import { describeExternalSavedContext } from '../src/presentation/external-products/savedContext.ts';
const context: PersonalContextSnapshot = {
  version: 'personal-context-v1', ownerId: 'owner', revision: 1, profile: null, routine: null,
  experiences: [{ id: 'revision', ownerId: 'owner', revision: 1, recordedAt: '2026-09-30', provenance: 'self_report', supersedesRevisionId: null,
    data: { id: 'experience', reference: { kind: 'manual', name: 'Old Spice Aqua Reef' }, kind: 'reacted',
      occurred: { start: null, end: null }, useContext: null, symptoms: ['burning'], note: 'Pit burns' } }],
  historyTruncated: false, historyRevision: 'revision',
  legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false },
};
test('saved reaction report is rendered without asserting ingredient cause or predicting fit', () => {
  const result = describeExternalSavedContext('owner', 'ready', context);
  assert.deepEqual(result.reports, [{ id: 'revision', product: 'Old Spice Aqua Reef', symptoms: ['burning'], note: 'Pit burns' }]);
  assert.equal(result.kind, 'ready'); assert.equal('score' in result, false); assert.equal('verdict' in result, false);
});
test('owner mismatch, missing context and loading/error cannot leak previous-owner history', () => {
  for (const owner of [null, 'other']) assert.equal(describeExternalSavedContext(owner, 'ready', context).reports.length, 0);
  assert.equal(describeExternalSavedContext('owner', 'error', context).kind, 'unavailable');
  assert.equal(describeExternalSavedContext('owner', 'loading', null).kind, 'loading');
  assert.equal(describeExternalSavedContext('owner', 'loading', context).reports.length, 0);
  assert.equal(describeExternalSavedContext('owner', 'ready', { ...context, experiences: [{ ...context.experiences[0], ownerId: 'other' }] }).reports.length, 0);
});
test('tolerance/absence of a report is not a positive safety signal; truncated history remains disclosed', () => {
  const result = describeExternalSavedContext('owner', 'ready', { ...context, historyTruncated: true,
    experiences: [{ ...context.experiences[0], data: { ...context.experiences[0].data, kind: 'tolerated' } }] });
  assert.equal(result.reports.length, 0); assert.equal(result.incomplete, true);
});
test('legacy saved reports are shown as reports and catalog labels require exact reference keys', () => {
  const catalog = { ...context.experiences[0], data: { ...context.experiences[0].data,
    reference: { kind: 'catalog' as const, productId: 'p', variantId: null, formulaVersionId: null } } };
  const result = describeExternalSavedContext('owner', 'ready', { ...context, experiences: [catalog],
    legacy: { ...context.legacy, experiences: [{ id: 'legacy-report', productName: 'Another deodorant', kind: 'reacted', note: 'It stung' }] } },
    { 'p:null:null': 'Sourced display name' });
  assert.equal(result.reports[0].product, 'Sourced display name'); assert.equal(result.reports[1].note, 'It stung');
});
test('only explicit skin answers are displayed, and the three-report display cap is disclosed', () => {
  const result = describeExternalSavedContext('owner', 'ready', { ...context,
    experiences: Array.from({ length: 4 }, (_, i) => ({ ...context.experiences[0], id: 'report-' + i })),
    profile: { id: 'profile', ownerId: 'owner', revision: 1, recordedAt: '2026-09-30', provenance: 'self_report', supersedesRevisionId: null,
      data: { intent: 'unanswered', primaryGoal: null, secondaryGoals: [], skinBehavior: 'dry_tight', reactivity: 'reacts_easily',
        reproductive: { pregnancy: 'unanswered', tryingToConceive: 'unanswered', nursing: 'unanswered' },
        sensitivities: { status: 'unanswered', values: [] }, treatments: { status: 'unanswered', values: [] } } } });
  assert.match(result.profile ?? '', /dry or tight/); assert.match(result.profile ?? '', /reacts easily/);
  assert.equal(result.reports.length, 3); assert.equal(result.incomplete, true);
});
test('private scan provides explicit save/history actions and no contradictory missing-product card', () => {
  const component = readFileSync(new URL('../src/components/check/ExternalProductActions.tsx', import.meta.url), 'utf8');
  assert.match(component, /Save product to My Stuff/); assert.match(component, /Matches — save/);
  assert.match(component, /captureCustomerFunctionClient/); assert.match(component, /View or record a past reaction/);
  assert.doesNotMatch(component, /fetch\(|GEMINI_API_KEY|analytics\./);
  const check = readFileSync(new URL('../src/components/check/CheckProductScreen.tsx', import.meta.url), 'utf8');
  assert.match(check, /!externalTest && recovery && <MissingProductContribution/);
  assert.match(check, /No package-verified formula in Derive’s catalog/);
});
