import type { ProductLinkIntakeResult } from '../../../contracts/ProductLinkIntake.ts';
import type { ProductTruthSnapshotV1 } from '../../../contracts/ProductTruthSnapshot.ts';
import type { CustomerState, CustomerCheckFacts, CustomerDecision } from '../../personal-decision/customerController.ts';
import { selectVisibleCustomerDecision, canShowLegacyPersonalFit } from '../../personal-decision/customerController.ts';
import type { PersonalFitRefreshInput } from '../../personalization/result.ts';
import type { CheckResultContentInput } from './content.ts';

interface CheckContentHostInput {
  ownerId: string | null;
  snapshot: ProductTruthSnapshotV1 | null;
  catalogFacts?: CustomerCheckFacts;
  customerState: CustomerState;
  preview: boolean;
  legacyState: PersonalFitRefreshInput;
}
type ReadyDecision = Extract<CustomerDecision, { kind: 'ready' }>;

export function selectCurrentCheckDecision(state: CustomerState, ownerId: string | null,
  snapshot: ProductTruthSnapshotV1 | null, rendered: ReadyDecision | null): ReadyDecision | null {
  if (state.status !== 'ready' || !rendered) return null;
  const current = selectVisibleCustomerDecision(state, ownerId, snapshot);
  return current && current.packet.id === rendered.packet.id
    && current.contextRevision === rendered.contextRevision
    && current.expectedBinding.productSnapshotId === rendered.expectedBinding.productSnapshotId
    ? current : null;
}
export function selectCheckContentInput(input: CheckContentHostInput): CheckResultContentInput {
  const { ownerId, snapshot, catalogFacts, customerState: state } = input;
  if (input.preview) return { ownerId: null, snapshot: null, catalogFacts, fit: { kind: 'preview_unavailable' } };
  const result = { ownerId, snapshot, catalogFacts };
  const decision = state.status === 'ready' ? selectVisibleCustomerDecision(state, ownerId, snapshot) : null;
  if (decision) return { ...result, fit: { kind: 'canonical', packet: decision.packet, expectedBinding: decision.expectedBinding } };
  if (!ownerId || state.ownerId !== ownerId || state.status === 'error') return { ...result, fit: { kind: 'service_failure' } };
  if (state.status !== 'ready' || state.decision.kind === 'loading') return { ...result, fit: { kind: 'loading' } };
  if (snapshot && state.decision.kind === 'unavailable') return { ...result, fit: { kind: 'service_failure' } };
  return { ...result, fit: { kind: 'legacy', state: canShowLegacyPersonalFit(state, ownerId)
    ? input.legacyState : { kind: 'factual_only' } } };
}

export function describeCheckLinkNotice(result: ProductLinkIntakeResult): { title: string; detail: string; source: string | null } | null {
  if (result.status === 'resolution') return null;
  if (result.status === 'label_candidate') return {
    title: result.candidate.title,
    detail: 'This label title has not confirmed the exact product or formula. Search by name or scan the package.',
    source: result.candidate.sourceUrl,
  };
  return { title: 'Product details needed', detail: result.reason, source: result.sourceUrl ?? null };
}
