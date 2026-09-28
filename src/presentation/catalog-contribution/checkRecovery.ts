import { validateContributionGtin } from '../../domain/catalog-contribution/proposal.ts';
import type { ContributionDraft } from './draft.ts';

export type CheckContributionRecoveryReason = 'unknown_barcode' | 'unresolved_check' | 'unresolved_photo';

export function selectCheckContributionRecovery(input: {
  targetShell: boolean;
  ownerId: string | null;
  caseId: string | null;
  reason: CheckContributionRecoveryReason | null;
  observedBarcode: string | null;
  observedName: string | null;
}): { contextKey: string; availability: { kind: 'unavailable' }; initial: Partial<ContributionDraft> } | null {
  if (!input.targetShell || !input.reason) return null;
  const initial: Partial<ContributionDraft> = {};
  if (input.reason === 'unresolved_check' && input.observedName?.trim()) {
    initial.name = input.observedName.trim();
  }
  if (input.observedBarcode) {
    try { initial.gtin = validateContributionGtin(input.observedBarcode); }
    catch { /* An observed scan is not necessarily a valid product GTIN. */ }
  }
  return {
    contextKey: `${input.ownerId ?? 'no-owner'}:${input.caseId ?? 'no-case'}:${input.reason}`,
    availability: { kind: 'unavailable' },
    initial,
  };
}
