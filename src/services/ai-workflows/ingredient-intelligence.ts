import type {
  ProductReaction,
  FormulaSnapshot,
  IngredientSignal,
  Product,
  IngredientSignalConfidence,
} from '../../types/schema.ts';


interface InferSignalsInput {
  reactions: ProductReaction[];
  formulaSnapshots: FormulaSnapshot[];
  toleratedProducts?: Product[];
  confirmedAllergies?: string[];
}

/**
 * Normalizes ingredient names for reliable matching across labels
 * (e.g., "Niacinamide (Vitamin B3)" -> "niacinamide")
 */
export function normalizeIngredient(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
}

/**
 * Infer ingredient signals from the user's personal reaction evidence,
 * accounting for tolerated exposures and exact formula snapshots.
 */
export function inferIngredientSignals({
  reactions,
  formulaSnapshots,
  toleratedProducts = [],
  confirmedAllergies = [],
}: InferSignalsInput): IngredientSignal[] {
  const formulaMap = new Map<string, FormulaSnapshot>();
  formulaSnapshots.forEach((snap) => {
    formulaMap.set(snap.id, snap);
    if (snap.productId) {
      formulaMap.set(snap.productId, snap);
    }
  });

  // 1. Build map of tolerated ingredients with provenance
  const toleratedMap = new Map<string, { productId: string; productName: string }[]>();
  toleratedProducts.forEach((prod) => {
    const ingredients = prod.fullIngredients || prod.keyActives || [];
    ingredients.forEach((ing) => {
      const norm = normalizeIngredient(ing);
      if (!norm) return;
      const existing = toleratedMap.get(norm) || [];
      if (!existing.some((e) => e.productId === prod.id)) {
        existing.push({ productId: prod.id, productName: prod.name });
      }
      toleratedMap.set(norm, existing);
    });
  });

  // 2. Map ingredients found in reaction products
  interface Candidate {
    name: string;
    supportingReactionIds: string[];
    severityCount: Record<'mild' | 'moderate' | 'severe' | 'unknown', number>;
  }

  const candidateMap = new Map<string, Candidate>();

  reactions.forEach((rx) => {
    let ingredients: string[] = [];

    // Prioritize exact formula snapshot
    if (rx.formulaSnapshotId && formulaMap.has(rx.formulaSnapshotId)) {
      ingredients = formulaMap.get(rx.formulaSnapshotId)!.ingredients;
    } else if (rx.productId && formulaMap.has(rx.productId)) {
      ingredients = formulaMap.get(rx.productId)!.ingredients;
    }

    ingredients.forEach((ing) => {
      const norm = normalizeIngredient(ing);
      if (!norm) return;

      const current = candidateMap.get(norm) || {
        name: ing.trim(),
        supportingReactionIds: [],
        severityCount: { mild: 0, moderate: 0, severe: 0, unknown: 0 },
      };

      if (!current.supportingReactionIds.includes(rx.id)) {
        current.supportingReactionIds.push(rx.id);
        current.severityCount[rx.severity] = (current.severityCount[rx.severity] || 0) + 1;
      }
      candidateMap.set(norm, current);
    });
  });

  const signals: IngredientSignal[] = [];

  // 3. Process explicit confirmed allergies first
  confirmedAllergies.forEach((allergy) => {
    const norm = normalizeIngredient(allergy);
    signals.push({
      ingredientId: `ing_${norm}`,
      ingredientName: allergy.trim(),
      confidence: 'confirmed_allergy',
      evidenceCount: 1,
      supportingReactionIds: [],
      contradictoryToleranceEvidence: toleratedMap.get(norm) || [],
      allergySource: 'clinician_reported',
      notes: 'Explicit allergy confirmed by user or clinician.',
    });
  });

  // 4. Evaluate candidates from reaction products
  candidateMap.forEach((cand, norm) => {
    // If already added as confirmed allergy, skip duplication
    if (signals.some((s) => normalizeIngredient(s.ingredientName) === norm)) {
      return;
    }

    const reactionCount = cand.supportingReactionIds.length;
    const toleratedList = toleratedMap.get(norm) || [];
    const toleratedCount = toleratedList.length;

    let confidence: IngredientSignalConfidence;
    let rationale = '';

    // Evidence calculation:
    // If tolerated across multiple products, naive suspicion is significantly discounted
    if (toleratedCount >= 2) {
      // User tolerated in 2+ products without problem
      confidence = 'weak_signal';
      rationale = `Present in ${reactionCount} reaction product(s), but also tolerated in ${toleratedCount} other products (${toleratedList.map((t) => t.productName).join(', ')}). Low probability of being causal agent.`;
    } else if (reactionCount >= 2 && toleratedCount === 0) {
      // Overlap across 2+ independent reaction products with ZERO tolerated exposures
      confidence = 'strong_signal';
      rationale = `Repeated overlap: present in ${reactionCount} independent products that caused reactions, with zero tolerated products. High suspicion.`;
    } else if (cand.severityCount.severe > 0 && toleratedCount === 0) {
      // Single reaction, but severe and zero tolerated exposures
      confidence = 'suspected_sensitivity';
      rationale = `Present in a product associated with a severe reaction (${cand.supportingReactionIds.length} incident), with no documented tolerated exposure.`;
    } else {
      // 1 reaction product, no strong overlap
      confidence = 'weak_signal';
      rationale = `Present in 1 reaction product alongside multiple other ingredients. Insufficient evidence to isolate as sole cause.`;
    }

    signals.push({
      ingredientId: `ing_${norm}`,
      ingredientName: cand.name,
      confidence,
      evidenceCount: reactionCount,
      supportingReactionIds: cand.supportingReactionIds,
      contradictoryToleranceEvidence: toleratedList,
      allergySource: 'user_reported',
      notes: rationale,
    });
  });

  return signals;
}

/**
 * Returns plain-English user-grounded rationale for caution
 */
export function explainIngredientCaution(signal: IngredientSignal): string {
  if (signal.confidence === 'confirmed_allergy') {
    return `Confirmed allergy to ${signal.ingredientName}. Excluded from all recommendations.`;
  }
  if (signal.confidence === 'strong_signal') {
    return `Cautious with ${signal.ingredientName}: appeared in ${signal.evidenceCount} products that previously caused bad reactions.`;
  }
  if (signal.contradictoryToleranceEvidence.length > 0) {
    return `Under observation: present in a past reaction product, but also tolerated in ${signal.contradictoryToleranceEvidence[0].productName}.`;
  }
  return `Suspected sensitivity to ${signal.ingredientName} based on past reaction.`;
}
