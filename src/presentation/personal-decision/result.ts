import { groupDecisionDetails } from './disclosure.ts';
import type { DecisionDetailGroup } from './disclosure.ts';
import type { Goal } from '../../types/schema.ts';
import { validatePersonalDecisionPacket } from '../../contracts/PersonalDecision.ts';
import type {
  DecisionBinding, DecisionNextStep, EvidenceNeed, EvidenceNeedCode, Finding,
  FindingDisplayFacts, PersonalDecisionActionKind, PersonalDecisionPacketV1, RoutineImpact,
} from '../../contracts/PersonalDecision.ts';
import { decisionBindingSchema, personalDecisionPacketSchema } from './parse.ts';

export type PersonalDecisionView = { kind: 'unavailable'; title: string; message: string } | {
  kind: 'ready'; action: PersonalDecisionActionKind; title: string; primaryReason: string;
  secondaryCautions: string[]; criticalCautions: string[]; routineImpacts: string[];
  unknowns: Array<{ text: string; critical: boolean }>;
  nextStep: DecisionNextStep; nextStepLabel: string;
  details: Array<{ reason: string; evidence: string[] }>;
  detailGroups: DecisionDetailGroup[];
  presentationKey: string;
  versions: { engine: string; policy: string };
};
const titles: Record<PersonalDecisionActionKind, string> = {
  COULD_WORK: 'Could work', USE_WITH_CAUTION: 'Use with caution', KEEP_CURRENT: 'Keep your current product',
  SKIP: 'Skip this product', NOT_ENOUGH_INFORMATION: 'Need more information',
};
const nextSteps: Record<DecisionNextStep, string> = {
  consider_use: 'Consider this product', keep_current: 'Keep my current product', skip_product: 'Skip this product',
  confirm_formula: 'Confirm the exact formula', add_context: 'Add relevant context',
  review_routine: 'Review my routine', ask_clinician: 'Ask a qualified professional', view_product_facts: 'View product details',
};
const goals: Record<Goal, string> = {
  breakouts: 'breakouts', dark_spots: 'dark spots', dryness: 'dryness', oiliness: 'oiliness', texture: 'skin texture',
  redness: 'redness', fine_lines: 'fine lines', simplify: 'a simpler routine', maintain: 'maintaining your routine',
};
const roles: Record<string, string> = {
  moisturizer: 'a moisturizer', cleanser: 'a cleanser', sunscreen: 'a sunscreen', serum: 'a serum', treatment: 'a treatment',
};
const needs: Record<EvidenceNeedCode, string> = {
  exact_identity: 'The exact product and variant need confirmation.',
  verified_formula: 'The exact formula has not been verified.', formula_conflict: 'Formula evidence conflicts.',
  profile_context: 'Relevant personal context is missing.', routine_completeness: 'We do not have your complete routine; an absent product does not mean you do not use it.',
  application_schedule: 'Your application schedule is unknown.', current_treatments: 'Relevant current-treatment context is missing.',
  sensitivity_context: 'Relevant sensitivity context is unknown.', ingredient_alias_review: 'The reported ingredient name needs review.',
  reproductive_context: 'Relevant reproductive context has not been provided.', individual_tolerance: 'Individual tolerance is unknown.',
  exact_prior_formula: 'The formula used in your earlier experience is unconfirmed.',
  current_formula_experience: 'Earlier experience does not establish tolerance of the current formula.',
  reviewed_claim: 'There is not enough reviewed evidence for your situation.', supported_rule: 'The available evidence does not support personal advice for your situation.',
  clinician_review: 'Individual advice from a qualified professional is needed.',
};
const timing: Record<Extract<FindingDisplayFacts, { kind: 'routine_relation' }>['timing'], string> = {
  am: ' in the morning', pm: ' in the evening', both: ' morning and evening', unknown: '',
};
const frequency: Record<Extract<FindingDisplayFacts, { kind: 'routine_relation' }>['frequency'], string> = {
  daily: ' daily', few_times_weekly: ' a few times a week', weekly: ' weekly', occasional: ' occasionally', unknown: '',
};
const ingredientCopy: Record<Extract<FindingDisplayFacts, { kind: 'ingredient_context' }>['context'], string> = {
  reported_sensitivity: 'The formula lists an ingredient you reported as a sensitivity. This is not an allergy diagnosis.',
  reactivity: 'You reported easily reactive skin, so this formula needs individual tolerance review.',
  treatment_overlap: 'The formula overlaps with a treatment you reported. Review the combination with a qualified professional.',
  pregnancy: 'You reported pregnancy, and this formula needs individual suitability review.',
  trying_to_conceive: 'You reported trying to conceive, and this formula needs individual suitability review.',
  nursing: 'You reported nursing, and this formula needs individual suitability review.',
};

/** These statements are bounded by finding kind and structured facts. No arbitrary packet prose is rendered. */
function reasonFor(finding: Finding, packet: PersonalDecisionPacketV1): string | null {
  const display = finding.display;
  switch (finding.kind) {
    case 'goal_role_match':
      return display?.kind === 'role_match' && roles[display.category]
        ? `As ${roles[display.category]}, this fits your ${goals[display.goal]} goal by product role. Results and tolerance are not established.` : null;
    case 'role_redundancy':
    case 'replacement_candidate':
      if (display?.kind !== 'routine_relation' || !roles[display.role]) return null;
      return finding.kind === 'role_redundancy'
        ? `You already use ${roles[display.role]}${timing[display.timing]}${frequency[display.frequency]}. This would duplicate that routine role.`
        : `This could replace ${roles[display.role]} in your routine. A shared role does not establish better results.`;
    case 'prior_product_reaction':
      return display?.kind === 'prior_reaction'
        ? 'You previously reported a reaction to this product. That is a tolerance signal, not proof of an ingredient cause.' : null;
    case 'routine_experience_caution':
      return display?.kind === 'routine_experience'
        ? display.outcome === 'reaction'
          ? 'You reported a reaction to a product already in your routine. Review that experience before keeping or changing this routine role.'
          : 'You reported that a product already in your routine was ineffective. Review that experience before keeping or changing this routine role.'
        : null;
    case 'reported_ingredient_sensitivity':
      return display?.kind === 'ingredient_context' && display.context === 'reported_sensitivity' ? ingredientCopy[display.context] : null;
    case 'reactive_active':
      return display?.kind === 'ingredient_context' && display.context === 'reactivity' ? ingredientCopy[display.context] : null;
    case 'active_overlap':
      return display?.kind === 'ingredient_context' && display.context === 'treatment_overlap' ? ingredientCopy[display.context]
        : display?.kind === 'routine_relation' ? 'This overlaps with a product already in your routine. Review the combination before adding it.' : null;
    case 'reproductive_context_caution':
      return display?.kind === 'ingredient_context' && ['pregnancy', 'trying_to_conceive', 'nursing'].includes(display.context)
        ? ingredientCopy[display.context] : null;
    case 'formula_changed':
      return finding.evidence.some((e) => e.kind === 'context_fact' && e.section === 'history')
        ? 'Earlier experience does not establish tolerance of this formula.' : null;
    case 'missing_evidence': {
      const need = packet.evidenceNeeds.find((need) => finding.evidenceNeedIds.includes(need.id));
      return need ? needText(need) : null;
    }
    case 'no_supported_rule': return 'The available evidence does not support a personal decision for this product.';
  }
}
function needText(need: EvidenceNeed): string {
  if (need.state === 'withheld') return `You chose not to provide this context. ${needs[need.code]}`;
  if (need.state === 'conflict' && need.code !== 'formula_conflict') return `Evidence conflicts. ${needs[need.code]}`;
  return needs[need.code];
}
const impactCopy: Record<RoutineImpact['kind'], string> = {
  adds_role: 'This would add a role to your routine.', duplicates_role: 'This would duplicate an existing routine role.',
  replacement_candidate: 'Consider this as a replacement, rather than another step; better results are not established.',
  active_overlap: 'Review overlap with your existing routine before adding this product.', keep_current: 'Keep the existing routine role.',
  none: 'No routine change is supported by this result.', unknown: 'The routine impact is uncertain with the available context.',
};
function supportedImpact(impact: RoutineImpact, packet: PersonalDecisionPacketV1): boolean {
  if (impact.kind === 'unknown' || impact.kind === 'none') return true;
  const allowed: Record<Exclude<RoutineImpact['kind'], 'unknown' | 'none'>, Finding['kind'][]> = {
    adds_role: ['goal_role_match'], duplicates_role: ['role_redundancy'], replacement_candidate: ['replacement_candidate'],
    active_overlap: ['active_overlap'], keep_current: ['role_redundancy'],
  };
  const cited = packet.findings.filter((finding) => impact.findingIds.includes(finding.id)
    && finding.applicability === 'applicable' && finding.confidence === 'supported'
    && allowed[impact.kind as Exclude<RoutineImpact['kind'], 'unknown' | 'none'>].includes(finding.kind));
  const routineEvidence = cited.flatMap((finding) => finding.evidence).filter((e) => e.kind === 'context_fact' && e.section === 'routine');
  return routineEvidence.length > 0 && impact.routineItemIds.every((id) => routineEvidence.some((e) => e.kind === 'context_fact' && e.recordId === id));
}
const evidenceCopy = (finding: Finding): string[] => [...new Set(finding.evidence.filter((e) => e.kind !== 'observation').map((e) => {
  if (e.kind === 'product_fact') return `Verified ${e.scope} evidence`;
  if (e.kind === 'routine_product_fact') return `Verified routine-product ${e.scope} evidence`;
  if (e.kind === 'context_fact') return `Your reported ${e.section} context`;
  return 'Reviewed claim evidence';
}))];
const unavailable: PersonalDecisionView = {
  kind: 'unavailable', title: 'Personal decision unavailable',
  message: 'We cannot verify this personal result. Check the product details and try again.',
};

/** expectedBinding comes independently from the authenticated host, never packet/model authority. */
export function describePersonalDecision(value: unknown, expectedBinding: DecisionBinding): PersonalDecisionView {
  const parsed = personalDecisionPacketSchema.safeParse(value);
  const trusted = decisionBindingSchema.safeParse(expectedBinding);
  if (!parsed.success || !trusted.success) return unavailable;
  const packet = parsed.data;
  if (validatePersonalDecisionPacket(packet, trusted.data).length) return unavailable;
  if (packet.routineImpacts.some((impact) => !supportedImpact(impact, packet))) return unavailable;
  const active = packet.findings.filter((finding) => finding.applicability !== 'not_applicable');
  const reasons = new Map<string, string>();
  for (const finding of active) {
    const reason = reasonFor(finding, packet);
    if (!reason) return unavailable;
    reasons.set(finding.id, reason);
  }
  const primaryReason = reasons.get(packet.action.primaryFindingId);
  if (!primaryReason) return unavailable;
  const critical = packet.evidenceNeeds.filter((need) => need.critical);
  const other = packet.evidenceNeeds.filter((need) => !need.critical);
  return {
    kind: 'ready', action: packet.action.kind, title: titles[packet.action.kind], primaryReason,
    secondaryCautions: [...new Set(active.filter((finding) => finding.id !== packet.action.primaryFindingId
      && finding.severity === 'caution' && finding.confidence !== 'unknown' && reasons.get(finding.id) !== primaryReason).map((finding) => reasons.get(finding.id)!))],
    criticalCautions: [...new Set(active.filter((finding) => finding.severity === 'blocker' && finding.confidence !== 'unknown'
      && reasons.get(finding.id) !== primaryReason).map((finding) => reasons.get(finding.id)!))],
    routineImpacts: [...new Set(packet.routineImpacts.map((impact) => impactCopy[impact.kind]))],
    unknowns: deduplicateUnknowns([
      ...[...critical, ...other].map((need) => ({ text: needText(need), critical: need.critical })),
      ...active.filter((finding) => (finding.confidence !== 'supported' || finding.applicability === 'uncertain')
        && !((finding.kind === 'missing_evidence' || finding.kind === 'no_supported_rule')
          && finding.evidenceNeedIds.some((id) => packet.evidenceNeeds.some((need) => need.id === id)))).map((finding) => ({
        text: finding.confidence === 'limited' ? 'Some evidence for this advice is limited.'
          : finding.confidence === 'unknown' ? 'Some evidence for this advice is unresolved.' : 'This advice may not apply to your situation.',
        critical: finding.severity === 'blocker',
      })),
    ]),
    nextStep: packet.action.nextStep, nextStepLabel: nextSteps[packet.action.nextStep],
    details: active.map((finding) => ({ reason: reasons.get(finding.id)!, evidence: evidenceCopy(finding) })),
    detailGroups: groupDecisionDetails(active, reasons),
    presentationKey: JSON.stringify([packet.binding.ownerId, packet.id]),
    versions: { engine: safeVersion(packet.versions.engine), policy: safeVersion(packet.versions.policy) },
  };
}
function safeVersion(value: string): string {
  return /^[a-zA-Z0-9._/-]{1,80}$/.test(value) ? value : 'Recorded';
}

function deduplicateUnknowns(items: Array<{ text: string; critical: boolean }>): Array<{ text: string; critical: boolean }> {
  const unique = new Map<string, { text: string; critical: boolean }>();
  for (const item of items) {
    const existing = unique.get(item.text);
    unique.set(item.text, { text: item.text, critical: item.critical || existing?.critical === true });
  }
  return [...unique.values()];
}
