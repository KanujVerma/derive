import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolvePlanPresentation } from '../src/presentation/managed-plan/planComposition.ts';

const readPlan = () => readFileSync(new URL('../app/(tabs)/plan.tsx', import.meta.url), 'utf8');

test('KPAID-COMPOSE keeps free Plan on the truthful enrollment presentation by default', () => {
  assert.deepEqual(resolvePlanPresentation({ shell: 'scanner_first_preview', managedAccess: false }), { kind: 'free' });
  assert.deepEqual(resolvePlanPresentation({ shell: 'local_free_integration', managedAccess: false }), { kind: 'free' });
  assert.deepEqual(resolvePlanPresentation({ shell: 'local_free_integration', managedAccess: false, fixtureStatus: 'bogus' }), { kind: 'free' });
});

test('KPAID-COMPOSE only explicit local fixture selection shows illustrative managed states', () => {
  for (const status of ['preparing', 'draft_review', 'active', 'adjustment_pending', 'check_in_due', 'error']) {
    const presentation = resolvePlanPresentation({ shell: 'scanner_first_preview', managedAccess: false, fixtureStatus: status });
    assert.equal(presentation.kind, 'fixture');
    if (presentation.kind === 'fixture') {
      assert.equal(presentation.snapshot.status, status);
      assert.equal(presentation.snapshot.illustrative, true);
    }
  }
  const localFixture = resolvePlanPresentation({ shell: 'local_free_integration', managedAccess: false, fixtureStatus: 'draft_review' });
  assert.equal(localFixture.kind, 'fixture');
  if (localFixture.kind === 'fixture') assert.equal(localFixture.snapshot.illustrative, true);
  assert.deepEqual(resolvePlanPresentation({ shell: 'legacy', managedAccess: false, fixtureStatus: 'active' }), { kind: 'managed' });
  assert.deepEqual(resolvePlanPresentation({ shell: 'local_free_integration', managedAccess: true, fixtureStatus: 'active' }), { kind: 'managed' });
});

test('KPAID-COMPOSE preserves managed bootstrap and keeps free routing outside proposal effects', () => {
  const plan = readPlan();
  assert.match(plan, /ManagedPlanPresentation/);
  assert.match(plan, /PreviewPlanShell/);
  assert.match(plan, /resolvePlanPresentation/);
  assert.match(plan, /bootstrapReady/);
  assert.match(plan, /if \(isRemoteServiceEnabled\(\) && !bootstrapReady\) return;/);
  const legacyStart = plan.indexOf('function LegacyManagedPlanScreen');
  assert.ok(plan.indexOf('return <PreviewPlanShell />') < legacyStart, 'free route never mounts the proposal effect');
  assert.ok(plan.indexOf('return <IllustrativeManagedPlan') < legacyStart, 'fixture route never mounts the proposal effect');
  assert.doesNotMatch(plan.slice(plan.indexOf('function IllustrativeManagedPlan'), legacyStart), /ensureInitialRoutineProposal|useRoutineStore/);
  assert.match(plan, /s\.userId === sessionUserId && s\.access\?\.userId === sessionUserId/, 'access projection is bound to the active session');
});
