import type { ProductResolutionNextAction, ProductResolutionState } from '../../contracts/ProductIdentityResolver.ts';
import { createProductAnalytics, type CheckInputMethod, type CheckOutcome,
  type ProductEventSink } from './index.ts';

export type VisibleCheckView =
  | { kind: 'candidate_choice' }
  | { kind: 'unknown_product' | 'insufficient_evidence' | 'failed' }
  | {
    kind: 'identified_result';
    state: 'verified_product_formula' | 'identified_formula_unverified';
    supportedIdentity: boolean;
    verifiedFormulaFactsShown: boolean;
    visibleIdentityNextAction: boolean;
    personalDecisionShown: boolean;
  };

export interface CheckScreenVisibility {
  integrated: boolean;
  focused: boolean;
  ownerReady: boolean;
  ownerBlocked: boolean;
  captureOpen: boolean;
  checking: boolean;
  errorShown: boolean;
  unknownShown: boolean;
  catalogDetailVisible: boolean;
  snapshotVisible: boolean;
  resolutionState: ProductResolutionState | null;
  catalogIdentityMatched: boolean;
  snapshotIdentityKnown: boolean;
  snapshotMatchesResolution: boolean;
  catalogFormulaFactsShown: boolean;
  snapshotFormulaFactsShown: boolean;
  identityNextActionCopyAvailable: boolean;
  readyDecisionPanelShown: boolean;
  decisionMatchesResolution: boolean;
  unresolvedPhotoVisible: boolean;
}

/** Mirrors Check's rendered branch order using coarse, non-identifying inputs. */
export function selectVisibleCheckView(input: CheckScreenVisibility): VisibleCheckView | null {
  if (!input.integrated || !input.focused || !input.ownerReady || input.ownerBlocked
    || input.captureOpen || input.checking) return null;
  if (input.errorShown) return { kind: 'failed' };
  if (input.unknownShown) return { kind: 'unknown_product' };
  const currentSnapshot = input.snapshotVisible && input.snapshotMatchesResolution;
  if (input.snapshotVisible && !currentSnapshot) return null;
  if ((input.catalogDetailVisible || currentSnapshot)
    && (input.resolutionState === 'verified_product_formula'
      || input.resolutionState === 'identified_formula_unverified')) {
    // The rendered card uses snapshot facts when present; catalog identity cannot override them.
    const catalogIdentity = !input.snapshotVisible && input.catalogDetailVisible && input.catalogIdentityMatched;
    const snapshotIdentity = currentSnapshot && input.snapshotIdentityKnown;
    return {
      kind: 'identified_result', state: input.resolutionState,
      supportedIdentity: catalogIdentity || snapshotIdentity,
      verifiedFormulaFactsShown: (catalogIdentity && input.catalogFormulaFactsShown)
        || (snapshotIdentity && input.snapshotFormulaFactsShown),
      visibleIdentityNextAction: input.catalogDetailVisible && input.catalogIdentityMatched
        && input.identityNextActionCopyAvailable && (catalogIdentity || snapshotIdentity),
      personalDecisionShown: snapshotIdentity && input.readyDecisionPanelShown
        && input.decisionMatchesResolution,
    };
  }
  if (input.resolutionState === 'ambiguous_candidates') return { kind: 'candidate_choice' };
  if (input.resolutionState || input.unresolvedPhotoVisible) return { kind: 'insufficient_evidence' };
  return null;
}

/** Only these resolver-owned actions have plain customer copy in the Check result. */
export function selectIdentityNextAction(
  state: ProductResolutionState,
  action: ProductResolutionNextAction,
): string | null {
  if (state !== 'identified_formula_unverified') return null;
  if (action === 'photograph_ingredients') return 'Photograph this package’s ingredient list to check its exact formula.';
  if (action === 'confirm_variant') return 'Confirm this exact package variant before relying on a personal answer.';
  return null;
}

function classifyVisibleCheck(view: VisibleCheckView): { outcome: CheckOutcome; personalized: boolean } | null {
  if (view.kind === 'candidate_choice') return null;
  if (view.kind !== 'identified_result') return { outcome: view.kind, personalized: false };
  const personalized = view.state === 'verified_product_formula' && view.personalDecisionShown;
  const useful = view.supportedIdentity && (
    personalized
    || (view.state === 'verified_product_formula' && view.verifiedFormulaFactsShown)
    || (view.state === 'identified_formula_unverified' && view.visibleIdentityNextAction)
  );
  return {
    outcome: useful ? 'useful' : 'insufficient_evidence',
    personalized: useful && personalized,
  };
}

/** One flow per mounted Check screen. The default has no sink or transport. */
export function createCustomerCheckFlow(sink?: ProductEventSink) {
  const analytics = createProductAnalytics(sink);
  let active: ReturnType<typeof analytics.beginCheck> | null = null;
  let completedUseful = false;
  let decisionReported = false;

  return {
    begin(method: CheckInputMethod): boolean {
      if (active) return false;
      completedUseful = false;
      decisionReported = false;
      active = analytics.beginCheck(method);
      return true;
    },
    completeVisible(view: VisibleCheckView): boolean {
      if (!active) return false;
      const completion = classifyVisibleCheck(view);
      if (!completion) return false;
      const check = active;
      active = null;
      completedUseful = completion.outcome === 'useful';
      const recorded = check.complete(completion.outcome, completion.personalized);
      if (completedUseful && completion.personalized) {
        decisionReported = true;
        analytics.track('personal_decision_viewed', {});
      }
      return recorded;
    },
    observePersonalDecision(view: VisibleCheckView): boolean {
      if (!completedUseful || decisionReported || view.kind !== 'identified_result'
        || view.state !== 'verified_product_formula' || !view.supportedIdentity
        || !view.personalDecisionShown) return false;
      decisionReported = true;
      return analytics.track('personal_decision_viewed', {});
    },
    abandon(): void {
      active = null;
      completedUseful = false;
      decisionReported = false;
    },
  };
}
