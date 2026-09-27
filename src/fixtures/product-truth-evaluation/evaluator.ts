import type { ProductEvidenceExtractionCandidate } from '../../contracts/ProductEvidenceExtraction.ts';
import { resolveProductIdentity } from '../../../supabase/functions/_shared/product-identity.ts';
import type { ResolverEvidence } from '../../../supabase/functions/_shared/product-identity.ts';
import { extractionCorpus, realImageScenarios, resolutionCorpus, syntheticCatalog } from './corpus.ts';

const fields = ['schemaVersion', 'evidenceId', 'role', 'outcome', 'abstentionReason', 'barcodeText', 'brandText', 'productNameText', 'variantText', 'regionText', 'labelText', 'orderedIngredients', 'numbers'];
const textFields = ['barcodeText', 'brandText', 'productNameText', 'variantText', 'regionText', 'labelText'] as const;
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 4096;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Experimental boundary validator. It does not certify extraction correctness. */
export function parseExtractionCandidate(value: unknown, evidenceId: string): ProductEvidenceExtractionCandidate {
  if (!object(value) || Object.keys(value).some(key => !fields.includes(key))
    || value.schemaVersion !== 1 || value.evidenceId !== evidenceId || !/^[a-zA-Z0-9_-]{1,100}$/.test(evidenceId)
    || !['front_label', 'ingredients', 'packaging'].includes(String(value.role))
    || !['candidate', 'abstained'].includes(String(value.outcome))) throw new Error('Invalid extraction envelope');
  for (const field of textFields) if (value[field] !== undefined && !isText(value[field])) throw new Error(`Invalid ${field}`);
  if (value.orderedIngredients !== undefined && (!Array.isArray(value.orderedIngredients)
    || value.orderedIngredients.length === 0 || value.orderedIngredients.length > 300 || !value.orderedIngredients.every(isText))) throw new Error('Invalid ingredient occurrences');
  if (value.numbers !== undefined && (!Array.isArray(value.numbers) || value.numbers.length === 0 || value.numbers.length > 100
    || !value.numbers.every(number => object(number) && Object.keys(number).length === 3
      && isText(number.text) && isText(number.unitText) && isText(number.contextText)))) throw new Error('Invalid literal numbers');
  if (value.outcome === 'abstained') {
    if (!['unreadable', 'unsupported', 'conflicting_evidence', 'no_product_evidence'].includes(String(value.abstentionReason))
      || [...textFields, 'orderedIngredients', 'numbers'].some(field => value[field] !== undefined)) throw new Error('Abstention must contain no guesses');
  } else if (value.abstentionReason !== undefined || ![...textFields, 'orderedIngredients', 'numbers'].some(field => value[field] !== undefined)) {
    throw new Error('Candidate must contain observed proposals');
  }
  return value as unknown as ProductEvidenceExtractionCandidate;
}

/** Extracted barcode is NOT trusted scanner input; resemblance remains candidate-only. */
export function candidateToResolverEvidence(candidate: ProductEvidenceExtractionCandidate): ResolverEvidence {
  if (candidate.outcome === 'abstained') return {};
  return {
    labelText: [candidate.labelText, candidate.brandText, candidate.productNameText, candidate.variantText, candidate.regionText, candidate.barcodeText].filter(Boolean).join(' ') || undefined,
    ingredientList: candidate.orderedIngredients ? [...candidate.orderedIngredients] : undefined,
  };
}

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

export interface ExtractionEvaluationRow {
  id: string;
  status: 'PASS' | 'FAIL' | 'NOT_RUN';
  errors: string[];
}

/** Supply task-id keyed outputs from an independently run adapter. Missing rows are NOT_RUN. */
export function evaluateExtraction(outputs: Record<string, unknown>) {
  const rows: ExtractionEvaluationRow[] = extractionCorpus.map(fixture => {
    if (!Object.hasOwn(outputs, fixture.id)) return { id: fixture.id, status: 'NOT_RUN', errors: ['No extraction output supplied'] };
    try {
      const candidate = parseExtractionCandidate(outputs[fixture.id], fixture.id);
      const errors = fields.filter(field => canonical(candidate[field as keyof typeof candidate]) !== canonical(fixture.gold[field as keyof typeof fixture.gold]));
      return { id: fixture.id, status: errors.length ? 'FAIL' : 'PASS', errors };
    } catch (error) {
      return { id: fixture.id, status: 'FAIL', errors: [error instanceof Error ? error.message : 'Invalid output'] };
    }
  });
  const executed = rows.filter(row => row.status !== 'NOT_RUN').length;
  const passed = rows.filter(row => row.status === 'PASS').length;
  return { scope: 'synthetic_text_only', total: rows.length, executed, passed, failed: executed - passed,
    notRun: rows.length - executed, exactCandidateRate: executed ? passed / executed : null, rows };
}

export function evaluateResolver() {
  const rows = resolutionCorpus.map(fixture => {
    const actual = resolveProductIdentity(fixture.evidence, syntheticCatalog);
    const pass = actual.state === fixture.expectedState && (!fixture.expectedVariantId || actual.selected?.variantId === fixture.expectedVariantId)
      && (!fixture.expectedFormulaVersionId || actual.selected?.formulaVersionId === fixture.expectedFormulaVersionId)
      && (!fixture.requireNoSelectedFormula || actual.selected?.formulaVersionId === undefined);
    return { id: fixture.id, status: pass ? 'PASS' : 'FAIL', expectedState: fixture.expectedState, actualState: actual.state,
      expectedVariantId: fixture.expectedVariantId, actualVariantId: actual.selected?.variantId,
      expectedFormulaVersionId: fixture.expectedFormulaVersionId, actualFormulaVersionId: actual.selected?.formulaVersionId,
      requireNoSelectedFormula: fixture.requireNoSelectedFormula };
  });
  return { scope: 'synthetic_catalog_only', total: rows.length, passed: rows.filter(row => row.status === 'PASS').length,
    failed: rows.filter(row => row.status === 'FAIL').length, rows };
}

export function evaluationReport(outputs: Record<string, unknown> = {}) {
  return { schemaVersion: 1, provider: 'NONE_SELECTED', realImageAccuracy: null, latencyMs: null, cost: null,
    extraction: evaluateExtraction(outputs), resolver: evaluateResolver(), realImageScenarios };
}
