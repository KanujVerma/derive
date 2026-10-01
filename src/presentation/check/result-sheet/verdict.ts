import type { DecisionBinding, DecisionEvidence, Finding, PersonalDecisionPacketV1 } from '../../../contracts/PersonalDecision.ts';
import { describePersonalDecision } from '../../personal-decision/result.ts';
import { describeCheckResultContent, type CheckResultContentInput } from './content.ts';

export type CheckPresentationIntent = 'add' | 'replace' | 'check_current';
export type VerdictState = 'good' | 'tradeoffs' | 'poor' | 'unknown';
export const verdictLabels: Record<VerdictState, string> = {
  good: 'Good fit', tradeoffs: 'Some tradeoffs', poor: 'Not a good fit', unknown: 'Not enough information',
};
export interface ResultFinding {
  id: string; title: string; reason: string; evidence: Array<{ label: string; detail: string }>;
  limits: string[];
}
export interface VerdictPresentation {
  state: VerdictState; label: string; reason: string; findings: ResultFinding[];
  /** Retained evidence for the verdict, including a goal row removed only when it repeats the summary. */
  summaryFinding?: ResultFinding;
}
const goals: Record<string, string> = { dryness: 'dryness', breakouts: 'breakouts', dark_spots: 'dark marks',
  oiliness: 'oiliness', texture: 'texture', redness: 'redness', fine_lines: 'fine lines',
  simplify: 'a simpler routine', maintain: 'maintaining your skin' };
const title: Record<Finding['kind'], string> = {
  goal_role_match: 'Your goal', replacement_candidate: 'A possible replacement', role_redundancy: 'Your routine',
  active_overlap: 'A combination to review', reactive_active: 'Your skin reactivity',
  reported_ingredient_sensitivity: 'A reported sensitivity', prior_product_reaction: 'A past product report',
  reproductive_context_caution: 'Relevant personal context', routine_experience_caution: 'A current product report',
  formula_changed: 'A different formula', missing_evidence: 'What is still unknown', no_supported_rule: 'Evidence limits',
};
const directConflict = new Set<Finding['kind']>(['reported_ingredient_sensitivity', 'prior_product_reaction', 'reproductive_context_caution']);
const tradeoffKinds = new Set<Finding['kind']>(['role_redundancy', 'active_overlap', 'reactive_active', 'routine_experience_caution']);

/** Copy uses retained structured fields only. It neither evaluates ingredients nor generates a verdict. */
function reason(finding: Finding, fallback: string, intent?: CheckPresentationIntent): string {
  const d = finding.display;
  if (d?.kind === 'role_match') return `This ${d.category} matches your ${goals[d.goal] ?? 'skin'} goal.`;
  if (d?.kind === 'routine_relation') {
    if (finding.kind === 'role_redundancy') {
      const timing = d.timing === 'am' ? ' in the morning' : d.timing === 'pm' ? ' in the evening' : d.timing === 'both' ? ' morning and evening' : '';
      const frequency = d.frequency === 'daily' ? ' every day' : d.frequency === 'few_times_weekly' ? ' a few times a week' : d.frequency === 'weekly' ? ' once a week' : '';
      return `You already use a ${d.role}${timing}${frequency}. ${intent === 'add' ? 'Adding this would duplicate that step.' : 'This could replace it rather than add another step.'}`;
    }
    if (finding.kind === 'replacement_candidate') return `This could replace a ${d.role} in your routine.`;
    return 'This overlaps with a product in your recorded routine. Review the combination before using them together.';
  }
  if (d?.kind === 'ingredient_context') {
    if (d.context === 'reported_sensitivity') return `This formula contains ${d.ingredient}, which you reported as a sensitivity.`;
    if (d.context === 'reactivity') return `This formula includes ${d.ingredient}, and you said new products often irritate your skin.`;
    if (d.context === 'treatment_overlap') return 'A treatment you use needs a combination review before you add this product.';
    return 'Your reported reproductive context needs review before you use this formula.';
  }
  if (d?.kind === 'prior_reaction') return 'You reported a reaction to this product. It may not be a good choice for you.';
  if (d?.kind === 'routine_experience') return d.outcome === 'reaction'
    ? 'You reported a reaction to a product already in your routine. That does not establish a reaction to this new product.'
    : 'You said a current product was not helping. That does not establish that this replacement will work better.';
  if (finding.kind === 'formula_changed') return 'Your earlier report concerns a different formula. Tolerance of this formula is still unknown.';
  if (d?.kind === 'evidence_gap' && d.code === 'routine_completeness') return 'Your routine is not fully recorded, so overlap is still unknown.';
  return fallback.replaceAll(';', '.');
}
function evidence(e: DecisionEvidence): { label: string; detail: string } | null {
  if (e.kind === 'observation') return null;
  if (e.kind === 'context_fact') return { label: e.section === 'history' ? 'Product experience' : e.section === 'routine' ? 'Recorded routine' : 'Skin profile', detail: e.section === 'history' ? 'Your own report of this product experience.' : e.section === 'routine' ? 'Your recorded routine context.' : 'Your recorded skin profile answers.' };
  if (e.kind === 'reviewed_claim') return { label: 'Reviewed evidence', detail: e.limitations.length ? e.limitations.join(' ') : 'A reviewed claim record. Publication details were not supplied.' };
  return { label: e.kind === 'routine_product_fact' ? 'Current product record' : 'Product record',
    detail: e.scope === 'formula' ? 'The verified ingredient list for this package.' : e.scope === 'category' ? 'The sourced product role.' : 'The confirmed product and variant.' };
}
const unknown = (reasonText: string, findings: ResultFinding[] = []): VerdictPresentation => ({ state: 'unknown', label: verdictLabels.unknown, reason: reasonText, findings });

/** Semantic projection of an already bound packet. Live callers also validate the immutable snapshot.
 * Optional intent must concern this Check; global stored profile intent is not a substitute. */
export function describeDecisionVerdict(value: unknown, expectedBinding: DecisionBinding, options: { intent?: CheckPresentationIntent } = {}): VerdictPresentation {
  const view = describePersonalDecision(value, expectedBinding);
  if (view.kind !== 'ready') return unknown('A current personal assessment could not be verified.');
  const packet = value as PersonalDecisionPacketV1;
  const active = packet.findings.filter(f => f.applicability !== 'not_applicable');
  const known = active.filter(f => f.applicability === 'applicable' && f.confidence === 'supported');
  const conflicts = known.filter(f => directConflict.has(f.kind) && f.severity !== 'informational'
    && f.evidence.some(e => e.kind === 'context_fact' && (e.section === 'profile' || e.section === 'history')));
  const routineRole = known.find(f => f.kind === 'role_redundancy' && f.display?.kind === 'routine_relation');
  const tradeoffs = known.filter(f => tradeoffKinds.has(f.kind) && (f.kind !== 'role_redundancy' || options.intent === 'add') && f.evidence.some(e => e.kind === 'context_fact'));
  const positive = known.find(f => f.kind === 'goal_role_match' && f.display?.kind === 'role_match');
  let state: VerdictState = 'unknown';
  let deciding: Finding | undefined;
  if (conflicts.length) { state = 'poor'; deciding = conflicts[0]; }
  else if (!packet.evidenceNeeds.some(n => n.critical) && tradeoffs.length) { state = 'tradeoffs'; deciding = tradeoffs.find(f => f.id === packet.action.primaryFindingId) ?? tradeoffs[0]; }
  else if (view.action === 'COULD_WORK' && positive && !packet.evidenceNeeds.some(n => n.critical)
    && !active.some(f => f.severity !== 'informational')) { state = 'good'; deciding = positive; }
  const groups = view.detailGroups;
  const findings = active.filter(f => f.kind !== 'no_supported_rule' || f.evidence.length > 0).map(f => {
    const group = groups.find(g => g.findingIds.includes(f.id));
    return { id: f.id, title: title[f.kind], reason: reason(f, group?.reason ?? view.primaryReason, options.intent),
      evidence: f.evidence.map(evidence).filter((e): e is NonNullable<typeof e> => e !== null),
      limits: [...new Set([...f.uncertainty, ...packet.evidenceNeeds.filter(n => f.evidenceNeedIds.includes(n.id)).map(n => {
        if (n.code === 'routine_completeness') return 'An unrecorded routine does not mean you have no routine.';
        if (n.code === 'individual_tolerance') return 'Tolerance of this new product is not established.';
        return n.state === 'withheld' ? 'You chose not to provide this context.' : `Unresolved: ${n.code.replaceAll('_', ' ')}.`;
      })])] };
  });
  const ordered = [...findings].sort((a, b) => {
    const rank = (id: string) => { const kind = active.find(f => f.id === id)!.kind; return kind === 'goal_role_match' ? 0 : ['replacement_candidate', 'role_redundancy'].includes(kind) ? 1 : 2; };
    return rank(a.id) - rank(b.id);
  });
  let summary = deciding ? reason(deciding, view.primaryReason, options.intent) : view.primaryReason.replaceAll(';', '.');
  if (state === 'unknown') {
    if (routineRole && !packet.evidenceNeeds.some(n => n.critical)) summary = reason(routineRole, view.primaryReason, options.intent);
    const gap = packet.evidenceNeeds.find(n => n.critical);
    if (gap?.code === 'verified_formula' || gap?.code === 'formula_conflict') summary = 'The ingredient list for your exact package has not been verified.';
    else if (gap?.code === 'routine_completeness') summary = 'Your routine is not fully recorded, so placement and overlap are still unknown.';
    else if (gap?.code === 'supported_rule' || gap?.code === 'reviewed_claim') summary = 'There is not enough supported evidence to assess this product for your goal.';
    else if (gap?.code === 'current_formula_experience') summary = 'Your earlier report concerns a different formula. Tolerance of this formula is still unknown.';
  }
  if (state === 'poor' && packet.evidenceNeeds.some(n => n.critical && n.code === 'verified_formula')) {
    summary = 'You reported a reaction to this product. Its current package formula is also unverified.';
  }
  if (state === 'unknown' && !deciding && tradeoffs.some(f => f.severity !== 'informational')) {
    const caution = tradeoffs.find(f => f.severity !== 'informational')!;
    const detail = reason(caution, view.primaryReason, options.intent).split('. ')[0];
    summary = `${summary.split('. ')[0]}. ${detail.replace(/\.$/, '')}.`;
  }
  const summaryFinding = deciding ? ordered.find(f => f.id === deciding.id) : undefined;
  const distinct = ordered.filter(f => !(f.id === positive?.id && summaryFinding?.id === f.id && f.reason === summary));
  return { state, label: verdictLabels[state], reason: summary, findings: distinct,
    ...(summaryFinding ? { summaryFinding } : {}) };
}

/** Snapshot, owner and independently loaded revisions are checked before any positive presentation. */
export function describeCheckVerdict(input: CheckResultContentInput): VerdictPresentation {
  const model = describeCheckResultContent(input);
  if (model.fit.kind === 'canonical') return describeDecisionVerdict(model.fit.packet, model.fit.expectedBinding);
  const copy: Record<string, string> = {
    identity_unconfirmed: 'The exact product has not been confirmed.',
    formula_unverified: 'The ingredient list for your exact package has not been verified.',
    preview_unavailable: model.facts.formula ? 'This preview has no saved personal assessment.' : 'The ingredient list for your exact package has not been verified.',
    loading: 'Your personal assessment is updating.', service_failure: 'A current personal assessment could not be verified.',
    profile_save_failure: 'Your updated answers were not saved.',
    not_personalized: 'This product has not been assessed for your skin.',
  };
  return unknown(copy[model.outcome.kind] ?? 'There is not enough supported evidence for a personal assessment.');
}
