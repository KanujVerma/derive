import type { ProductTruthSnapshotV1 } from '../../../contracts/ProductTruthSnapshot.ts';
import { hasVerifiedPackageFormula } from '../../../contracts/ProductTruthSnapshot.ts';
import type { DecisionBinding } from '../../../contracts/PersonalDecision.ts';
import { selectCustomerCheckFacts, type CustomerCheckFacts } from '../../personal-decision/customerController.ts';
import { describePersonalDecision, type PersonalDecisionView } from '../../personal-decision/result.ts';
import { projectTrustedSnapshot } from '../../personal-decision/truthAdapter.ts';
import { describePersonalFitRefresh, type PersonalFitRefreshInput } from '../../personalization/result.ts';

export type CheckResultFitInput =
  | { kind: 'canonical'; packet: unknown; expectedBinding: DecisionBinding }
  | { kind: 'legacy'; state: PersonalFitRefreshInput }
  | { kind: 'loading' | 'service_failure' | 'profile_save_failure' | 'preview_unavailable' };
export interface CheckResultContentInput {
  ownerId: string | null;
  snapshot: ProductTruthSnapshotV1 | null;
  /** Bounded preview/legacy facts only. An immutable snapshot always takes precedence. */
  catalogFacts?: CustomerCheckFacts;
  fit: CheckResultFitInput;
}
export type ResultOutcomeKind = 'supported' | 'identity_unconfirmed' | 'formula_unverified'
  | 'context_missing' | 'unsupported_rule' | 'loading' | 'service_failure'
  | 'profile_save_failure' | 'preview_unavailable' | 'not_personalized';
export interface CheckResultContentModel {
  facts: CustomerCheckFacts;
  fit: Extract<CheckResultFitInput, { kind: 'canonical' | 'legacy' }> | { kind: 'limitation' };
  outcome: { kind: ResultOutcomeKind; title: string; reason: string; criticalUnknowns: string[] };
  canPersonalize: boolean;
}
const noFacts: CustomerCheckFacts = { brand: '', name: 'Product not confirmed', categoryLabel: '', formula: null, source: null };
const limitations: Record<'identity_unconfirmed' | 'formula_unverified' | 'loading' | 'service_failure' | 'profile_save_failure' | 'preview_unavailable', { title: string; reason: string }> = {
  identity_unconfirmed: { title: 'Product not confirmed', reason: 'Confirm the exact product before relying on Personal Fit.' },
  formula_unverified: { title: 'Exact formula not verified', reason: 'More skin answers cannot verify the formula in your package.' },
  loading: { title: 'Updating Personal Fit', reason: 'Your product facts remain available while this result updates.' },
  service_failure: { title: 'Personal Fit unavailable', reason: 'A current personal result could not be verified. Product facts remain available.' },
  profile_save_failure: { title: 'Answers not saved', reason: 'Your changes were not confirmed. Product facts remain available; retry from the profile editor.' },
  preview_unavailable: { title: 'Personal Fit unavailable in this preview', reason: 'This preview cannot save a skin profile or provide a supported Personal Fit.' },
};
function limitation(facts: CustomerCheckFacts, kind: keyof typeof limitations): CheckResultContentModel {
  return { facts, fit: { kind: 'limitation' }, outcome: { kind, ...limitations[kind], criticalUnknowns: [] }, canPersonalize: false };
}

/** Presentation only: independently loaded binding and snapshot must agree before rendering a packet. */
function matchesSnapshot(input: CheckResultContentInput, binding: DecisionBinding): boolean {
  const snapshot = input.snapshot;
  if (!snapshot || !input.ownerId || binding.ownerId !== input.ownerId) return false;
  const projection = projectTrustedSnapshot({ snapshot });
  const identity = projection.identity.state === 'known' ? projection.identity.value : null;
  const formula = projection.formula.state === 'known' ? projection.formula.value : null;
  const boundary = `p0a/v1:${snapshot.resolverVersion}`;
  return binding.productSnapshotId === snapshot.snapshotId
    && binding.productSnapshotRevision === String(snapshot.caseRevision)
    && (binding.sourceBoundaryRevision === boundary || binding.sourceBoundaryRevision.startsWith(`${boundary}:category:`))
    && binding.productId === (identity?.productId ?? null)
    && binding.variantId === (identity?.variantId ?? null)
    && binding.formulaVersionId === (formula?.formulaVersionId ?? null);
}
function outcomeKind(view: Extract<PersonalDecisionView, { kind: 'ready' }>, input: Extract<CheckResultFitInput, { kind: 'canonical' }>): ResultOutcomeKind {
  // The next action and evidence needs come from the validated packet, never local ingredient matching.
  const packet = input.packet as { evidenceNeeds: Array<{ code: string; critical: boolean }> };
  if (view.action !== 'NOT_ENOUGH_INFORMATION') return 'supported';
  const critical = packet.evidenceNeeds.filter(need => need.critical);
  if (critical.some(need => need.code === 'exact_identity')) return 'identity_unconfirmed';
  if (critical.some(need => need.code === 'verified_formula' || need.code === 'formula_conflict')) return 'formula_unverified';
  if (critical.some(need => need.code === 'supported_rule' || need.code === 'reviewed_claim')) return 'unsupported_rule';
  return 'context_missing';
}

/** Facts, personal guidance and user observations retain their existing authority boundaries. */
export function describeCheckResultContent(input: CheckResultContentInput): CheckResultContentModel {
  const facts = selectCustomerCheckFacts(input.snapshot, input.catalogFacts ?? noFacts);
  const fit = input.fit;
  if (fit.kind === 'canonical') {
    const view = describePersonalDecision(fit.packet, fit.expectedBinding);
    if (view.kind !== 'ready' || !matchesSnapshot(input, fit.expectedBinding)) return limitation(facts, 'service_failure');
    return { facts, fit, outcome: { kind: outcomeKind(view, fit), title: view.title, reason: view.primaryReason,
      criticalUnknowns: view.unknowns.filter(unknown => unknown.critical).map(unknown => unknown.text) },
      canPersonalize: view.nextStep === 'add_context' && (fit.packet as { evidenceNeeds: Array<{ code: string }> }).evidenceNeeds
        .some(need => ['profile_context', 'current_treatments', 'sensitivity_context', 'reproductive_context'].includes(need.code)) };
  }
  // Operation/capability failures are never recast as an answer the customer omitted.
  if (fit.kind !== 'legacy') return limitation(facts, fit.kind);
  if (fit.state.kind === 'unavailable') return limitation(facts,
    fit.state.reason === 'answers_not_saved' ? 'profile_save_failure'
      : fit.state.reason === 'client_session_ready' ? 'preview_unavailable' : 'service_failure');
  if (fit.state.kind === 'loading') return limitation(facts, 'loading');
  const identity = input.snapshot ? projectTrustedSnapshot({ snapshot: input.snapshot }).identity : null;
  if (input.snapshot && identity?.state !== 'known') return limitation(facts, 'identity_unconfirmed');
  if (!facts.formula || input.snapshot && !hasVerifiedPackageFormula(input.snapshot)) return limitation(facts, 'formula_unverified');
  const view = describePersonalFitRefresh(fit.state);
  if (view.kind === 'supported') return { facts, fit,
    outcome: { kind: 'supported', title: view.title, reason: view.message, criticalUnknowns: [] }, canPersonalize: false };
  // No packet identifies a relevant missing field here. Keep facts useful without a generic questionnaire.
  return { facts, fit: { kind: 'limitation' }, outcome: {
    kind: fit.state.kind === 'factual_only' ? 'not_personalized' : 'unsupported_rule',
    title: fit.state.kind === 'factual_only' ? 'Personal Fit not assessed' : 'Not enough supported evidence',
    reason: fit.state.kind === 'factual_only' ? 'Product facts are available. A supported personal result has not been assessed.'
      : view.message, criticalUnknowns: [],
  }, canPersonalize: false };
}
