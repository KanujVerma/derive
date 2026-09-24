import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { baselineAngles, deriveManagedUpgradeView, type ManagedUpgradeInput } from '../src/presentation/managed-upgrade/managedUpgrade.ts';
import { deriveManagedPlanView, type ManagedPlanStatus } from '../src/presentation/managed-plan/managedPlan.ts';
import { managedPlanFixtures } from '../src/fixtures/managed-plan/managedPlanFixtures.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const complete: ManagedUpgradeInput = {
  identity: 'permanent',
  knownContext: {
    goals: ['Improve texture'], skinBehavior: 'Combination', sensitivities: null,
    treatmentSafety: null, routinePreference: 'Simple',
  },
  safetyReviewed: true,
  acceptedBaselineAngles: baselineAngles,
  lifecycle: 'draft',
};

test('K-PAID-1A upgrade gates anonymous identity before managed intake', () => {
  const view = deriveManagedUpgradeView({ ...complete, identity: 'anonymous' });
  assert.equal(view.stage, 'identity_required');
  assert.equal(view.canSubmit, false);
});

test('K-PAID-1A reuses saved free context and asks only for missing fields', () => {
  const view = deriveManagedUpgradeView({ ...complete, knownContext: { goals: ['Texture'], sensitivities: null }, managedAnswers: { skinBehavior: 'Dry' } });
  assert.deepEqual(view.reusedFields, ['goals', 'sensitivities']);
  assert.deepEqual(view.missingFields, ['treatmentSafety', 'routinePreference']);
  assert.equal(view.stage, 'missing_information');
  assert.ok(!view.missingFields.includes('goals'));
  assert.ok(!view.missingFields.includes('sensitivities'));
});

test('K-PAID-1A reviews safety and requires each baseline angle before submit', () => {
  assert.equal(deriveManagedUpgradeView({ ...complete, safetyReviewed: false }).stage, 'safety_review');
  for (const angle of baselineAngles) {
    const view = deriveManagedUpgradeView({ ...complete, acceptedBaselineAngles: baselineAngles.filter((item) => item !== angle) });
    assert.equal(view.stage, 'baseline_photos');
    assert.deepEqual(view.missingBaselineAngles, [angle]);
    assert.equal(view.canSubmit, false);
  }
  assert.equal(deriveManagedUpgradeView(complete).stage, 'ready_to_submit');
  assert.equal(deriveManagedUpgradeView(complete).canSubmit, true);
});

test('K-PAID-1A submitted and active states follow caller lifecycle only', () => {
  assert.equal(deriveManagedUpgradeView({ ...complete, lifecycle: 'submitted' }).stage, 'submitted_preparing');
  assert.equal(deriveManagedUpgradeView({ ...complete, lifecycle: 'active' }).stage, 'active_managed');
  assert.equal(deriveManagedUpgradeView({ ...complete, lifecycle: 'draft' }).stage, 'ready_to_submit');
});

test('K-PAID-1A managed Plan fixtures cover every display state', () => {
  const statuses: ManagedPlanStatus[] = ['preparing', 'draft_review', 'active', 'adjustment_pending', 'check_in_due', 'error'];
  for (const status of statuses) {
    const view = deriveManagedPlanView(managedPlanFixtures[status]);
    assert.equal(view.status, status);
    assert.equal(view.illustrative, true);
    assert.ok(view.title && view.detail);
    assert.equal(view.showRoutine, ['active', 'adjustment_pending', 'check_in_due'].includes(status));
  }
  assert.equal(deriveManagedPlanView(managedPlanFixtures.error).showRetry, true);
  assert.equal(deriveManagedPlanView(managedPlanFixtures.check_in_due).showCheckIn, true);
});

test('K-PAID-1A is presentation only with truthful product and reviewer copy', () => {
  const files = [
    'src/presentation/managed-upgrade/managedUpgrade.ts',
    'src/presentation/managed-plan/managedPlan.ts',
    'src/components/managed-upgrade/ManagedUpgradePresentation.tsx',
    'src/components/plan/managed/ManagedPlanPresentation.tsx',
  ].map(read).join('\n');
  assert.doesNotMatch(files, /supabase|checkout|createProductCheckout|ensureInitialRoutineProposal|activateMembership|onboard-customer|stripe/i);
  assert.doesNotMatch(files, /dermatologist|clinician.reviewed|doctor.approved/i);
  assert.match(files, /Founder and expert review is planned for the beta/);
  assert.match(files, /Products purchased separately/);
  assert.match(files, /ILLUSTRATIVE PREVIEW/);
});
