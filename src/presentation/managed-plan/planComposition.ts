import { managedPlanFixtures } from '../../fixtures/managed-plan/managedPlanFixtures.ts';
import type { ManagedPlanSnapshot, ManagedPlanStatus } from './managedPlan.ts';
import type { ShellPresentation } from '../../utils/shellPresentation.ts';
import { isFreeIntegrationShell } from '../../utils/shellPresentation.ts';

export type PlanPresentation =
  | { kind: 'free' }
  | { kind: 'managed' }
  | { kind: 'fixture'; snapshot: ManagedPlanSnapshot };

/** A fixture is an explicit development presentation choice, never membership evidence. */
export function resolvePlanPresentation(input: {
  shell: ShellPresentation;
  managedAccess: boolean;
  fixtureStatus?: string;
}): PlanPresentation {
  if (input.shell === 'legacy') return { kind: 'managed' };
  if (isFreeIntegrationShell(input.shell) && input.managedAccess) return { kind: 'managed' };

  const status = input.fixtureStatus;
  if (input.shell !== 'hosted_free_integration' && status && Object.prototype.hasOwnProperty.call(managedPlanFixtures, status)) {
    return { kind: 'fixture', snapshot: managedPlanFixtures[status as ManagedPlanStatus] };
  }
  return { kind: 'free' };
}
