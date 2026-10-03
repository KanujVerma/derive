import type { FormulaAnalysis, PartFourPacket, PartFourInsight } from '../../contracts/PartFour.ts';

export interface PartFourRenderFence {
  now?: number;
  withdrawn?: boolean;
  expectedBindingKey?: string;
  expectedResultRevision?: number;
  expectedDependencyDigest?: string;
}

/** Rendering controls stay visible; this never corrects an ingredient name. */
export function partFourDisplayText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
    character => `[U+${character.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}]`);
}

/** No historical packet is retained. The owner must also withdraw on account,
 * context, source and server-authority changes; an optional fence pins Part 2. */
export function authorizedPartFourPacket(packet: PartFourPacket | null, fence: PartFourRenderFence = {}): PartFourPacket | null {
  if (!packet || fence.withdrawn) return null;
  const formula = packet.formula;
  const now = fence.now ?? Date.now();
  const live = (deadline: string) => Number.isFinite(Date.parse(deadline)) && Date.parse(deadline) > now;
  if (!Number.isFinite(now) || formula.evidenceState === 'blocked' || !live(formula.expiresAt) || !live(formula.binding.expiresAt)) return null;
  if (formula.partTwoBindingKey !== formula.binding.bindingKey || formula.dependencyDigest !== formula.binding.dependencyDigest) return null;
  if (fence.expectedBindingKey !== undefined && fence.expectedBindingKey !== formula.partTwoBindingKey) return null;
  if (fence.expectedResultRevision !== undefined && fence.expectedResultRevision !== formula.partTwoRevision) return null;
  if (fence.expectedDependencyDigest !== undefined && fence.expectedDependencyDigest !== formula.dependencyDigest) return null;
  if (formula.sourceRefs.some(source => !source.permitted || !live(source.expiresAt)) || formula.facts.some(fact => !live(fact.validUntil))) return null;
  return packet;
}

export function partFourDisclosureKey(packet: PartFourPacket): string {
  return JSON.stringify([packet.releaseId, packet.contextRevision, packet.formula.partTwoBindingKey,
    packet.formula.partTwoRevision, packet.formula.dependencyDigest, packet.formula.knowledgeHash]);
}

/** All exact matches are returned: repeated formula positions are never silently
 * collapsed or selected by a substring such as "Ceramide". */
export function ingredientTargets(formula: FormulaAnalysis, target: { occurrenceId?: string; ingredientId?: string; name?: string }): string[] {
  return formula.ingredients.filter(ingredient => target.occurrenceId !== undefined
    ? ingredient.occurrenceId === target.occurrenceId
    : target.ingredientId !== undefined ? ingredient.ingredientId === target.ingredientId
      : target.name !== undefined && (ingredient.observedName === target.name || ingredient.card?.name === target.name || ingredient.card?.aliases.includes(target.name)))
    .map(ingredient => ingredient.occurrenceId);
}

export function ingredientRow(ingredient: FormulaAnalysis['ingredients'][number]) {
  const occurrence = ingredient.occurrence;
  // A knowledge card is general ingredient context, never a personal verdict.
  const card = ingredient.ingredientId !== null && ingredient.card?.ingredientId === ingredient.ingredientId ? ingredient.card : null;
  const qualifiers: string[] = [];
  if (ingredient.modality === 'may_contain') qualifiers.push('May contain · Definite presence is not established.');
  if (ingredient.modality === 'alternative') qualifiers.push('Alternative entry · Definite presence is not established.');
  if (ingredient.modality === 'unresolved') qualifiers.push('Entry qualifier unclear · Check the original wording.');
  if (occurrence.transcription !== 'clear') qualifiers.push(occurrence.transcription === 'conflict' ? 'Conflicting text · Check the original wording.' : 'Text unclear · Check the original wording.');
  const amounts = occurrence.quantities.map(quantity => `Printed amount: ${partFourDisplayText(quantity.span.raw)}`);
  if (!amounts.length && ingredient.quantityText) amounts.push(`Printed amount: ${partFourDisplayText(ingredient.quantityText)}`);
  if (!amounts.length) amounts.push('Amount in this formula: not disclosed.');
  const quantityLimits = occurrence.quantities.flatMap(quantity => {
    const limits: string[] = [];
    if (!['parsed', 'validated'].includes(quantity.status)) limits.push('Printed amount needs review; no concentration is established.');
    else {
      if (quantity.basis === 'unknown') limits.push('The label does not specify whether this amount is by weight or volume.');
      if (quantity.subject === 'group' || quantity.subject === 'blend') limits.push('This amount applies to the listed group or blend. Individual amounts are unknown.');
    }
    return limits;
  });
  return { occurrenceId: ingredient.occurrenceId, name: partFourDisplayText(ingredient.observedName || occurrence.rawToken),
    literal: partFourDisplayText(occurrence.rawToken), card, qualifiers, amounts, quantityLimits: [...new Set(quantityLimits)],
    short: card ? partFourDisplayText(card.short) : occurrence.mapping.state === 'ambiguous' ? 'Ingredient identity is ambiguous.' : 'An explanation is unavailable for this name.',
    label: card ? partFourDisplayText(card.label) : 'Knowledge unavailable' };
}

export function ingredientSectionHeading(formula: FormulaAnalysis, index: number): string | null {
  const row = formula.ingredients[index]?.occurrence;
  const previous = formula.ingredients[index - 1]?.occurrence;
  if (!row || previous && row.sectionId === previous.sectionId && row.sectionKind === previous.sectionKind) return null;
  return { ingredients: 'Ingredients', active: 'Active ingredients', inactive: 'Inactive ingredients', may_contain: 'May contain' }[row.sectionKind];
}

export function formulaScope(formula: FormulaAnalysis): string {
  if (formula.binding.kind === 'capture') return 'Photo reading · Package not confirmed';
  return formula.scope === 'public' ? `Published list${formula.binding.packageConfirmation === 'unconfirmed' ? ' · Package not confirmed' : ''}` : 'Your label';
}

export function formulaEvidenceNotice(formula: FormulaAnalysis): string | null {
  return formula.evidenceState === 'partial' ? 'Partial list · Missing text remains unknown. May be incomplete.'
    : formula.evidenceState === 'uncertain' ? 'Some text is uncertain. Check the original wording.'
      : formula.evidenceState === 'conflict' ? 'These readings disagree. Review the original wording.' : null;
}

export function visiblePartFourInsights(packet: PartFourPacket): { comparison: PartFourInsight[]; routine: PartFourInsight[] } {
  const hasComparison = packet.comparison.state === 'selected' || packet.comparison.state === 'ambiguous';
  const visible = packet.insights.filter(insight => {
    if (insight.state === 'inapplicable') return false;
    // Quantity and general formula limits are readable beside the occurrence
    // and in Sources, rather than repeating them in the direct comparison.
    if (insight.ruleId === 'F08' && insight.state !== 'conflict') return false;
    if (insight.state !== 'unknown') return true;
    if (['F01', 'F02'].includes(insight.ruleId)) return true;
    if (['F06', 'F07'].includes(insight.ruleId)) return hasComparison;
    if (insight.ruleId === 'F04') return packet.comparison.state === 'selected';
    // Unavailable sensory/offer and review evidence has its own visible section.
    return false;
  });
  return { comparison: visible.filter(insight => !['F03', 'F06'].includes(insight.ruleId)),
    routine: visible.filter(insight => ['F03', 'F06'].includes(insight.ruleId)) };
}

const formulaLimitCopy: Readonly<Record<string, string | null>> = {
  approved_editorial_local_only: null,
  reference_roles_not_finished_product_efficacy: 'Ingredient references describe general functions; they do not establish the finished product’s results.',
  no_product_identity_or_dose_inference: null,
  ingredient_order_not_concentration: 'Ingredient order does not establish percentages or effective amounts.',
  ingredient_concentrations_unknown: 'Some ingredient amounts are not disclosed.',
  unknown_ingredient_knowledge: 'An explanation is not available for every listed ingredient.',
  conditional_not_definite_presence: 'Conditional or alternative entries do not establish definite ingredient presence.',
  reading_only_not_product_presence: 'A photo reading does not confirm the product or its formula.',
  declaration_completeness_unestablished: 'List completeness is not established. Missing text remains unknown.',
  package_not_confirmed: 'The published list has not been confirmed against your package.',
  conflicting_formula_evidence: 'Formula readings disagree; the disputed wording needs review.',
};

/** Developer/release codes never become product copy. Unknown code-shaped
 * values remain hidden; supplied readable evidence limits retain their wording. */
export function formulaLimitationsForDisplay(formula: FormulaAnalysis): string[] {
  return [...new Set(formula.limitations.flatMap(limit => {
    const mapped = formulaLimitCopy[limit];
    if (mapped !== undefined) return mapped ? [mapped] : [];
    return /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(limit) ? [] : [partFourDisplayText(limit)];
  }))];
}

export function safePartFourSourceUrl(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).protocol === 'https:' ? url : null; } catch { return null; }
}
