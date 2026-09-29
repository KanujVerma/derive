import { hasVerifiedPackageFormula } from '../../contracts/ProductTruthSnapshot.ts';
import type { ProductTruthSnapshotV1 } from '../../contracts/ProductTruthSnapshot.ts';
import type { ProductCheckFact, ProductCheckFactsV1 } from '../../contracts/ProductCheckFacts.ts';

export interface StoredProductEvidence {
  id: string;
  evidence_type: 'front_label' | 'ingredients' | 'packaging' | 'barcode' | 'typed_identity';
  source_type: 'member_input' | 'trusted_ocr' | 'device_barcode' | 'founder_review';
  extracted_text: string | null;
}
export interface AcceptedCategory {
  category: Exclude<ProductCheckFactsV1['category'], 'unknown'>;
  productId: string;
  sourceRevision: string;
}
export interface FactsInput {
  snapshot: ProductTruthSnapshotV1;
  evidence: StoredProductEvidence[];
  acceptedCategory: AcceptedCategory | null;
  createdAt: string;
}

/** Converts only text actually present in bound label evidence to observed facts.
 * This deliberately does not guess a formula, concentration, suitability, or
 * negative/absence claim. Later OCR must still pass the same evidence boundary.
 */
export function evaluateProductCheckFacts(input: FactsInput): ProductCheckFactsV1 {
  const { snapshot, evidence, acceptedCategory } = input;
  if (acceptedCategory && snapshot.catalogReferences.productId !== acceptedCategory.productId) {
    throw new Error('Category does not belong to the bound product');
  }
  const facts: ProductCheckFact[] = [];
  const missing = new Set<ProductCheckFactsV1['missing'][number]>();
  if (!snapshot.product) missing.add('identity');
  if (acceptedCategory) facts.push({
    code: 'catalog_category', value: acceptedCategory.category, certainty: 'accepted',
    basis: { kind: 'catalog_category', sourceId: acceptedCategory.productId, sourceRevision: acceptedCategory.sourceRevision },
  });
  const exactFormula = hasVerifiedPackageFormula(snapshot) ? snapshot.formula : null;
  if (exactFormula) facts.push({
    code: 'verified_ingredients', value: [...exactFormula.ingredients], certainty: 'accepted',
    basis: { kind: 'verified_package_formula', sourceId: exactFormula.formulaVersionId,
      observedAt: exactFormula.observedAt, publicSourceUrl: exactFormula.publicSourceUrl },
  });
  const sealedEvidenceIds = new Set(snapshot.evidence.map((item) => item.evidenceId));
  const boundEvidence = evidence.filter((row) => sealedEvidenceIds.has(row.id));
  const label = boundEvidence.filter((row) => row.evidence_type === 'front_label'
    && (row.source_type === 'member_input' || row.source_type === 'trusted_ocr')
    && typeof row.extracted_text === 'string' && row.extracted_text.length <= 10_000);
  const observed = (row: StoredProductEvidence, code: ProductCheckFact['code'], value: string) => {
    facts.push({ code, value, certainty: 'observed_unverified', basis: {
      kind: 'submitted_label', evidenceId: row.id,
      extraction: row.source_type as 'member_input' | 'trusted_ocr',
    } });
  };
  if (label.length) {
    const negated = (text: string, index: number) =>
      /\b(?:not|no|non)[-\s]+(?:(?:a|an|the)\s+)?$/i.test(text.slice(Math.max(0, index - 30), index));
    const matches = (row: StoredProductEvidence, pattern: RegExp) =>
      [...row.extracted_text!.matchAll(new RegExp(pattern.source, 'gi'))]
        .filter((match) => !negated(row.extracted_text!, match.index));
    const firstMatch = (pattern: RegExp) => label.find((row) => matches(row, pattern).length > 0);
    const fixed = [
      ['deodorant_statement', 'deodorant', /\bdeodorant\b/i],
      ['antiperspirant_statement', 'antiperspirant', /\bantiperspirant\b|\banti-perspirant\b/i],
      ['shampoo_statement', 'shampoo', /\bshampoo\b/i],
      ['conditioner_statement', 'conditioner', /\bconditioner\b/i],
      ['body_wash_statement', 'body wash', /\bbody\s+wash\b/i],
      ['body_moisturizer_statement', 'body moisturizer', /\bbody\s+(?:lotion|moisturizer|moisturiser)\b/i],
      ['broad_spectrum_statement', 'broad spectrum', /\bbroad[-\s]+spectrum\b/i],
      ['drug_facts_statement', 'Drug Facts heading observed', /\bdrug\s+facts\b/i],
    ] as const;
    for (const [code, value, pattern] of fixed) {
      const row = firstMatch(pattern);
      if (row) observed(row, code, value);
    }
    const spfMatches = label.flatMap((row) => matches(row, /\bSPF\s*([1-9]\d{0,2})(?:\s*\+)?(?=\W|$)/gi)
      .map((match) => ({ row, value: Number(match[1]) })).filter((match) => match.value <= 200));
    const uniqueSpf = [...new Set(spfMatches.map((match) => match.value))];
    if (uniqueSpf.length === 1) observed(spfMatches[0].row, 'spf_statement', String(uniqueSpf[0]));
    if (uniqueSpf.length > 1) missing.add('conflicting_spf');
    const resistance = label.flatMap((row) => matches(row, /\bwater[-\s]+resistant\s*\(?\s*(40|80)\s*(?:minutes?|mins?)\s*\)?/gi)
      .map((match) => ({ row, value: match[1] })));
    if (resistance.length && new Set(resistance.map((match) => match.value)).size === 1) {
      observed(resistance[0].row, 'water_resistance_statement', `${resistance[0].value} minutes`);
    } else if (!resistance.length) {
      const row = firstMatch(/\bwater[-\s]+resistant\b/i);
      if (row) observed(row, 'water_resistance_statement', 'duration not transcribed');
    }
  } else missing.add('readable_label');
  const ingredientRows = boundEvidence.filter((row) => row.evidence_type === 'ingredients'
    && (row.source_type === 'member_input' || row.source_type === 'trusted_ocr')
    && typeof row.extracted_text === 'string');
  if (!exactFormula && ingredientRows.length === 1) {
    const row = ingredientRows[0];
    const raw = row.extracted_text!.replace(/^\s*ingredients\s*[:：]\s*/i, '');
    const entries = raw.split(',').map((term) => term.trim()).filter(Boolean);
    // A bounded, delimiter-supported transcription can be shown as observations.
    // It is never treated as a complete formula or proof that an ingredient is absent.
    if (entries.length >= 2 && entries.length <= 80 && entries.every((term) => term.length >= 2 && term.length <= 100
      && /^[\p{L}\p{N}\s.()+\-/%]+$/u.test(term))) {
      facts.push({ code: 'observed_ingredients', value: entries, certainty: 'observed_unverified',
        basis: { kind: 'submitted_ingredients', evidenceId: row.id,
          extraction: row.source_type as 'member_input' | 'trusted_ocr' } });
    }
  }
  if (!facts.some((fact) => fact.code === 'verified_ingredients' || fact.code === 'observed_ingredients')) {
    missing.add('ingredient_list');
  }
  const category = acceptedCategory?.category ?? 'unknown';
  if ((category === 'sunscreen' || facts.some((fact) => fact.code === 'spf_statement'))
    && !facts.some((fact) => fact.code === 'drug_facts_statement')) {
    missing.add('drug_facts');
  }
  const nextEvidence = missing.has('ingredient_list') ? 'ingredients'
    : missing.has('drug_facts') ? 'drug_facts'
      : missing.has('readable_label') || missing.has('conflicting_spf') ? 'front_label' : 'none';
  return {
    schemaVersion: 'product-check-facts/v1', caseId: snapshot.resolutionCaseId,
    snapshotId: snapshot.snapshotId, caseRevision: snapshot.caseRevision, createdAt: input.createdAt,
    category, facts, missing: [...missing], nextEvidence,
  };
}
