import type { DecisionNextStep, EvidenceNeedCode } from '../../contracts/PersonalDecision.ts';
import { createExperienceDraft, type ExperienceDraft } from '../p0b-personalization/experience.ts';
import type { MyStuffViewModel } from '../my-stuff/myStuffPresentation.ts';

export function contextEditorDestination(packet: { action: { nextStep: DecisionNextStep };
  evidenceNeeds: readonly { code: EvidenceNeedCode; critical: boolean }[] }): { mode: 'profile' | 'routine' | 'history'; entry?: 'new' } | null {
  if (packet.action.nextStep !== 'add_context') return null;
  const critical = packet.evidenceNeeds.filter(need => need.critical);
  const codes = (critical.length ? critical : packet.evidenceNeeds).map(need => need.code);
  if (codes.some(code => ['exact_identity', 'verified_formula', 'formula_conflict', 'reviewed_claim', 'supported_rule', 'clinician_review', 'ingredient_alias_review'].includes(code))) return null;
  if (codes.includes('current_formula_experience') || codes.includes('individual_tolerance')) return { mode: 'history', entry: 'new' };
  if (codes.includes('exact_prior_formula')) return { mode: 'history' };
  if (codes.includes('routine_completeness') || codes.includes('application_schedule')) return { mode: 'routine' };
  if (codes.some(code => ['profile_context', 'current_treatments', 'sensitivity_context', 'reproductive_context'].includes(code))) return { mode: 'profile' };
  return null;
}

/** Route return is separate from a successful write and survives batched A-B-A changes. */
export function createEditorReturnGate(initialOwner: string | null) {
  let owner = initialOwner;
  let epoch = 0;
  let generation = 0;
  const isCurrent = (token: { ownerId: string | null; epoch: number; generation: number }, currentOwner: string | null) => Boolean(token.ownerId && owner === token.ownerId && currentOwner === token.ownerId && token.epoch === epoch && token.generation === generation);
  return {
    observeOwner(next: string | null) { if (owner !== next) { owner = next; epoch++; generation++; } },
    begin(currentOwner: string | null) { return { ownerId: currentOwner, epoch, generation: ++generation }; },
    isCurrent,
    takeReturn(token: { ownerId: string | null; epoch: number; generation: number }, currentOwner: string | null) {
      if (!isCurrent(token, currentOwner)) return false;
      generation++;
      return true;
    },
    invalidate() { generation++; },
  };
}

/** Only an owned saved record can prefill a report; product-family selection is not package confirmation. */
export function experienceDraftForProduct(id: string, ownerId: string | null, recordOwnerId: string | null,
  product: MyStuffViewModel['products'][number] | undefined): ExperienceDraft | null {
  if (!ownerId || ownerId !== recordOwnerId || !product) return null;
  const draft = createExperienceDraft(id);
  const validId = product.productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(product.productId);
  draft.reference = product.source === 'catalog' && validId
    ? { kind: 'catalog', label: [product.brand, product.name].filter(Boolean).join(' '), productId: product.productId!, variantId: null, formulaVersionId: null }
    : { kind: 'manual', label: product.name, verification: 'unverified' };
  return draft;
}
