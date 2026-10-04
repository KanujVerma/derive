import { FormulaAnalysisSchema, type FormulaAnalysis } from '../../contracts/PartFour.ts';
import { NormalizationResultSchema, type NormalizationResult } from '../../contracts/PartTwo.ts';
import { deepFreeze } from '../part-two/dictionary.ts';
import { APPROVED_INGREDIENT_KNOWLEDGE, ingredientKnowledgeAvailable, resolveIngredientKnowledge, validateIngredientKnowledgeRelease, type IngredientKnowledgeRelease } from './knowledge.ts';

export interface FormulaAnalysisOptions {
  now: string;
  knowledge?: IngredientKnowledgeRelease;
  withdrawnDependencies?: readonly string[];
  expectedBinding?: { bindingKey: string; resultRevision: number; dependencyDigest: string };
}

/** Pure interpretation of an already-authorized Part 2 output. Current source
 * authority must be checked by the caller: parsing a cached object is not auth.
 * Never bind a reading to a product or generate identity, dose or efficacy facts. */
export function analyzeFormula(value: NormalizationResult, options: FormulaAnalysisOptions): FormulaAnalysis | null {
  const parsed = NormalizationResultSchema.safeParse(value);
  if (!parsed.success || parsed.data.state !== 'ready') return null;
  const result = parsed.data, reading = result.output.reading;
  const now = Date.parse(options.now);
  if (!Number.isFinite(now) || now >= Date.parse(result.expiresAt)) return null;
  const expected = options.expectedBinding;
  if (expected && (expected.bindingKey !== result.bindingKey || expected.resultRevision !== result.resultRevision || expected.dependencyDigest !== reading.binding.dependencyDigest)) return null;
  let knowledge: IngredientKnowledgeRelease;
  try { knowledge = validateIngredientKnowledgeRelease(options.knowledge ?? APPROVED_INGREDIENT_KNOWLEDGE); } catch { return null; }
  if (!ingredientKnowledgeAvailable(knowledge,options)) return null;
  const snapshot = result.output.kind === 'bound' ? result.output.productFacts : reading;
  const withdrawn = options.withdrawnDependencies ?? [];
  if ([result.bindingKey,reading.binding.dependencyDigest,...reading.dependencyManifest.sourceRefs.flatMap(source => [source.observationId,source.policyId,source.contentHash])].some(id => withdrawn.includes(id))) return null;
  if (snapshot.facts.some(fact => fact.sourceDependencies.some(id => withdrawn.includes(id)) || fact.dictionaryDependencies.some(id => withdrawn.includes(id)))) return null;
  const ingredients = reading.occurrences.map(occurrence => {
    const candidate = occurrence.transcription === 'clear' && occurrence.modality !== 'unresolved' && occurrence.mapping.state !== 'ambiguous' ? resolveIngredientKnowledge(occurrence.observedName,knowledge,options) : null;
    // A resolved but differing identity is a conflict, never an alias override.
    const card = candidate && (occurrence.mapping.state !== 'resolved' || occurrence.mapping.ingredientId === candidate.ingredientId) ? candidate : null;
    const amounts = occurrence.quantities.filter(quantity => quantity.status === 'validated' && quantity.subject === 'ingredient');
    return { occurrenceId: occurrence.occurrenceId, occurrence, observedName: occurrence.observedName,
      ingredientId: card?.ingredientId ?? (occurrence.mapping.state === 'resolved' ? occurrence.mapping.ingredientId : null),
      card, modality: occurrence.modality, quantityText: amounts.length ? amounts.map(quantity => quantity.span.raw).join('; ') : null };
  });
  const documentIds = new Set(ingredients.flatMap(ingredient=>ingredient.card?.editorial?[ingredient.card.editorial.documentId]:[]));
  const context = knowledge.educationContext?.filter(document=>documentIds.has(document.documentId));
  const sourceIds = new Set(ingredients.flatMap(ingredient => ingredient.card?.sourceIds ?? []));
  // Context citations remain navigable references, not source-processing grants.
  const contextUrls = new Set(context?.flatMap(doc=>doc.sections.flatMap(section=>section.paragraphs.flatMap(p=>p.links.map(link=>link.url))))??[]);
  knowledge.sources.filter(source=>contextUrls.has(source.url)).forEach(source=>sourceIds.add(source.id));
  const limitations = [
    'approved_editorial_local_only', 'reference_roles_not_finished_product_efficacy',
    'no_product_identity_or_dose_inference', 'ingredient_order_not_concentration',
    ...(ingredients.some(ingredient => ingredient.quantityText === null) ? ['ingredient_concentrations_unknown'] : []),
    ...(ingredients.some(ingredient => ingredient.card === null) ? ['unknown_ingredient_knowledge'] : []),
    ...(ingredients.some(ingredient => ingredient.modality !== 'unconditional') ? ['conditional_not_definite_presence'] : []),
    ...(result.output.kind === 'reading_only' ? ['reading_only_not_product_presence'] : []),
    ...(reading.claimLimits.declarationCompleteness !== 'accepted' ? ['declaration_completeness_unestablished'] : []),
    ...(reading.packageConfirmation === 'unconfirmed' ? ['package_not_confirmed'] : []),
    ...(reading.evidenceState === 'conflict' ? ['conflicting_formula_evidence'] : []),
  ];
  return deepFreeze(FormulaAnalysisSchema.parse({ version: 'formula-analysis/v1', knowledgeVersion: knowledge.version,
    knowledgeHash: knowledge.contentHash, partTwoBindingKey: result.bindingKey, partTwoRevision: result.resultRevision,
    dependencyDigest: reading.binding.dependencyDigest, binding: reading.binding, versions: reading.versions,
    sourceRefs: reading.dependencyManifest.sourceRefs, facts: snapshot.facts, expiresAt: knowledge.provenance.expiresAt===null?result.expiresAt:new Date(Math.min(Date.parse(result.expiresAt),Date.parse(knowledge.provenance.expiresAt))).toISOString(),
    scope: reading.scope, evidenceState: reading.evidenceState, ingredients,
    sources: knowledge.sources.filter(source => sourceIds.has(source.id)), ...(context?.length?{educationContext:context}:{}), limitations }));
}
