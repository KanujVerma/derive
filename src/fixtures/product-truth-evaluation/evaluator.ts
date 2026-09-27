import type { ProductEvidenceExtractionCandidate } from '../../contracts/ProductEvidenceExtraction.ts';
import { resolveProductIdentity } from '../../../supabase/functions/_shared/product-identity.ts';
import type { ResolverEvidence } from '../../../supabase/functions/_shared/product-identity.ts';
import { extractionCorpus, realImageScenarios, resolutionCorpus, syntheticCatalog } from './corpus.ts';
import { ProductEvidenceExtractionError, parseProductEvidenceExtraction, projectProductEvidenceExtraction } from '../../../supabase/functions/_shared/product-evidence-extraction.ts';
import type { ExtractionEvidenceRole } from '../../contracts/ProductEvidenceExtraction.ts';

const fields = ['schemaVersion', 'evidenceId', 'role', 'outcome', 'abstentionReason', 'barcodeText', 'brandText', 'productNameText', 'variantText', 'regionText', 'labelText', 'orderedIngredients', 'numbers'];
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Experimental boundary validator. It does not certify extraction correctness. */
export function parseExtractionCandidate(value: unknown, evidenceId: string, expectedRole?: ExtractionEvidenceRole): ProductEvidenceExtractionCandidate {
  // Preserve the two-argument fixture API using corpus-owned roles, never output-owned roles.
  const role = expectedRole ?? extractionCorpus.find(fixture => fixture.id === evidenceId)?.gold.role ?? 'front_label';
  return parseProductEvidenceExtraction(value, { evidenceId, role });
}

/** Extracted barcode is NOT trusted scanner input; resemblance remains candidate-only. */
export function candidateToResolverEvidence(candidate: ProductEvidenceExtractionCandidate): ResolverEvidence {
  const parsed = parseExtractionCandidate(candidate, candidate.evidenceId);
  return projectProductEvidenceExtraction(parsed, { evidenceId: parsed.evidenceId, role: parsed.role });
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
      const candidate = parseExtractionCandidate(outputs[fixture.id], fixture.id, fixture.gold.role);
      const errors = fields.filter(field => canonical(candidate[field as keyof typeof candidate]) !== canonical(fixture.gold[field as keyof typeof fixture.gold]));
      return { id: fixture.id, status: errors.length ? 'FAIL' : 'PASS', errors };
    } catch {
      return { id: fixture.id, status: 'FAIL', errors: [new ProductEvidenceExtractionError().message] };
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
