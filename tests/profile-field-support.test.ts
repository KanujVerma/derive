import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PersonalContextSnapshot } from '../src/contracts/PersonalContext.ts';
import { describeProfileFieldSupport, type ProfileField } from '../src/presentation/p0b-personalization/fieldSupport.ts';

const owner = 'test-owner';
function context(): PersonalContextSnapshot {
  return { version: 'personal-context-v1', ownerId: owner, revision: 0, profile: null, routine: null,
    experiences: [], historyRevision: null, historyTruncated: false,
    legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false } };
}
function withProfile(): PersonalContextSnapshot {
  const value = context();
  value.profile = { id: 'profile-id', ownerId: owner, revision: 1, recordedAt: '2026-10-01T00:00:00Z',
    provenance: 'self_report', supersedesRevisionId: null, data: { intent: 'unanswered', primaryGoal: 'breakouts',
      secondaryGoals: ['dryness'], skinBehavior: 'comfortable', reactivity: 'withheld',
      reproductive: { pregnancy: 'unanswered', nursing: 'unanswered', tryingToConceive: 'unanswered' },
      sensitivities: { status: 'unanswered', values: [] }, treatments: { status: 'unanswered', values: [] } } };
  return value;
}
const row = (value: PersonalContextSnapshot, field: ProfileField) => describeProfileFieldSupport(owner, value).fields.find(item => item.field === field)!;

test('missing or mismatched owner cannot publish saved field metadata', () => {
  assert.ok(describeProfileFieldSupport(null, context()).fields.every(item => item.persistence === 'unavailable'));
  const wrong = withProfile(); wrong.profile!.ownerId = 'other-owner';
  assert.ok(describeProfileFieldSupport(owner, wrong).fields.every(item => item.decisionUse === 'not_used'));
});
test('absent profile remains unsaved and unknown instead of inferred from routine or previews', () => {
  const value = context();
  assert.equal(row(value, 'primary_goal').persistence, 'not_saved');
  assert.equal(row(value, 'skin_feel').answer, 'unanswered');
  assert.equal(row(value, 'optional_note').decisionUse, 'not_used');
});
test('saved goal ranking and limited skin rules are explicit without exposing answers', () => {
  const value = withProfile(); const summary = describeProfileFieldSupport(owner, value);
  assert.equal(row(value, 'primary_goal').persistence, 'saved');
  assert.equal(row(value, 'secondary_goals').answer, 'provided');
  assert.match(row(value, 'primary_goal').limitations.join(' '), /different primary goal prevents/);
  assert.match(row(value, 'skin_feel').limitations.join(' '), /Other skin-feel answers are saved/);
  assert.equal(row(value, 'reactivity').answer, 'withheld');
  assert.doesNotMatch(JSON.stringify(summary), /test-owner|profile-id|comfortable|breakouts/);
  value.profile!.data.skinBehavior = 'unsure';
  assert.equal(row(value, 'skin_feel').answer, 'unsure');
});
test('an explicitly complete empty routine is saved, but an unknown empty routine is not no-products', () => {
  const value = context();
  value.routine = { id: 'routine-id', ownerId: owner, revision: 1, recordedAt: '2026-10-01T00:00:00Z',
    provenance: 'self_report', supersedesRevisionId: null, data: { completeness: 'complete', items: [] } };
  assert.equal(row(value, 'current_products').persistence, 'saved');
  assert.equal(row(value, 'current_products').answer, 'provided');
  value.routine.data.completeness = 'unknown';
  assert.equal(row(value, 'current_products').answer, 'unanswered');
  assert.match(row(value, 'current_products').limitations.join(' '), /Incomplete routine data/);
});
test('saved reports disclose catalog-only use and do not echo or interpret symptoms or notes', () => {
  const value = context(); value.historyRevision = 'history-id';
  value.experiences = [{ id: 'revision-id', ownerId: owner, revision: 1, recordedAt: '2026-10-01T00:00:00Z',
    provenance: 'self_report', supersedesRevisionId: null, data: { id: 'experience-id',
      reference: { kind: 'manual', name: 'SECRET_PRODUCT' }, kind: 'reacted', occurred: { start: null, end: null },
      useContext: null, symptoms: ['SECRET_SYMPTOM'], note: 'SECRET_NOTE' } }];
  const report = row(value, 'past_product_problems');
  assert.equal(report.persistence, 'saved'); assert.equal(report.decisionUse, 'catalog_reports_only');
  assert.match(report.limitations.join(' '), /Symptoms and note text are saved but are not interpreted/);
  assert.doesNotMatch(JSON.stringify(describeProfileFieldSupport(owner, value)), /SECRET_|experience-id|history-id/);
  assert.equal(row(value, 'optional_note').persistence, 'not_saved');
});
