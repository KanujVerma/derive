// Deterministic Post-Model Proposal Validator
// Part of DERIVE I1-B2.1: Real Model Intelligence, Trust Semantics & Error-Boundary Closure

import type {
  AssembledRoutineContext,
  RoutineIntelligenceProposal,
  ProductCategory,
  RoutineAction,
  DayOfWeek,
} from './types.ts';

export const VALID_CATEGORIES = new Set<string>([
  'cleanser',
  'toner',
  'treatment',
  'serum',
  'moisturizer',
  'sunscreen',
  'oil',
  'mask',
  'deodorant',
  'body_care',
  'hair_care',
  'other',
]);

export const VALID_ACTIONS = new Set<string>(['KEEP', 'PAUSE', 'REPLACE', 'ADD', 'STOP']);
export const VALID_DAYS = new Set<string>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

export const RETINOID_TERMS = [
  'adapalene',
  'differin',
  'tretinoin',
  'retinol',
  'retinal',
  'retinoid',
  'tazarotene',
  'trifarotene',
];

export const CONTRAINDICATED_PREGNANCY_TERMS = [...RETINOID_TERMS, 'hydroquinone'];

export function isRetinoid(name: string, actives: string[] = []): boolean {
  const lower = (name ?? '').toLowerCase();
  if (RETINOID_TERMS.some((term) => lower.includes(term))) return true;
  return (actives || []).some((active) =>
    RETINOID_TERMS.some((term) => (active ?? '').toLowerCase().includes(term))
  );
}

export function isContraindicatedInPregnancy(name: string, actives: string[] = []): boolean {
  const lower = (name ?? '').toLowerCase();
  if (CONTRAINDICATED_PREGNANCY_TERMS.some((term) => lower.includes(term))) return true;
  return (actives || []).some((active) =>
    CONTRAINDICATED_PREGNANCY_TERMS.some((term) => (active ?? '').toLowerCase().includes(term))
  );
}

export function isSunscreen(name: string, category?: string): boolean {
  if ((category ?? '').toLowerCase() === 'sunscreen') return true;
  const lower = (name ?? '').toLowerCase();
  return lower.includes('sunscreen') || lower.includes('spf');
}

export function formatRoutineStepScheduleText(timing: 'am' | 'pm', days: DayOfWeek[] = []): string {
  if (!days || days.length === 0 || days.length === 7) {
    return timing === 'am' ? 'Every morning' : 'Every evening';
  }
  const dayLabels: Record<string, string> = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
  };
  return days.map((d) => dayLabels[d] || d).join(', ');
}

export function validateRoutineProposal(
  proposal: RoutineIntelligenceProposal,
  context?: Partial<AssembledRoutineContext>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!proposal || typeof proposal !== 'object') {
    return { valid: false, errors: ['Proposal must be a non-null object.'] };
  }

  if (!proposal.summarySentence || typeof proposal.summarySentence !== 'string' || proposal.summarySentence.trim().length === 0) {
    errors.push('Proposal summarySentence must be a non-empty string.');
  }

  const isPregnancyConcern = context?.isPregnantOrNursing === true || context?.pregnancyStatus === 'yes';

  // 1. Validate catalogProducts
  const catalogMap = new Set<string>();
  for (const prod of proposal.catalogProducts || []) {
    if (!prod.brand || typeof prod.brand !== 'string' || prod.brand.trim().length === 0) {
      errors.push('Catalog product brand cannot be empty.');
    }
    if (!prod.name || typeof prod.name !== 'string' || prod.name.trim().length === 0) {
      errors.push('Catalog product name cannot be empty.');
    }
    if (!VALID_CATEGORIES.has(prod.category)) {
      errors.push(`Catalog product category '${prod.category}' is not a valid ProductCategory.`);
    }
    if (prod.brand && prod.name) {
      catalogMap.add(`${prod.brand.trim().toLowerCase()}::${prod.name.trim().toLowerCase()}`);
    }
  }

  // 2. Validate amSteps
  for (let i = 0; i < (proposal.amSteps || []).length; i++) {
    const step = proposal.amSteps[i];
    const prodName = step.productName ?? (step as any).product_name ?? '';
    const timing = step.timing;

    if (timing !== 'am') {
      errors.push(`Step '${prodName}' in amSteps has timing '${timing}', expected 'am'.`);
    }
    if (!VALID_CATEGORIES.has(step.category)) {
      errors.push(`AM step '${prodName}' has invalid category '${step.category}'.`);
    }
    // Retinoid PM Invariant
    if (isRetinoid(prodName, (step as any).keyActives || [])) {
      errors.push(`Active retinoid invariant: Retinoid (${prodName}) must NOT be in the AM routine.`);
    }
    // Pregnancy Contraindication Invariant
    if (isPregnancyConcern && isContraindicatedInPregnancy(prodName, (step as any).keyActives || [])) {
      errors.push(`Pregnancy safety invariant: Contraindicated active (${prodName}) must NOT be in the routine.`);
    }
    // Days Invariant
    for (const d of step.days || []) {
      if (!VALID_DAYS.has(d)) {
        errors.push(`AM step '${prodName}' has invalid day '${d}'.`);
      }
    }
    // Required fields
    if (!step.brand || !prodName || !step.amount || !step.area || !step.purpose || !(step.whyChosen ?? (step as any).why_chosen)) {
      errors.push(`AM step ${i + 1} is missing one or more required fields (brand, productName, amount, area, purpose, whyChosen).`);
    }
    // Catalog linkage
    const key = `${(step.brand || '').trim().toLowerCase()}::${prodName.trim().toLowerCase()}`;
    if (!catalogMap.has(key)) {
      errors.push(`AM step '${prodName}' by '${step.brand}' is missing from catalogProducts.`);
    }
  }

  // 3. Validate pmSteps
  for (let i = 0; i < (proposal.pmSteps || []).length; i++) {
    const step = proposal.pmSteps[i];
    const prodName = step.productName ?? (step as any).product_name ?? '';
    const timing = step.timing;

    if (timing !== 'pm') {
      errors.push(`Step '${prodName}' in pmSteps has timing '${timing}', expected 'pm'.`);
    }
    if (!VALID_CATEGORIES.has(step.category)) {
      errors.push(`PM step '${prodName}' has invalid category '${step.category}'.`);
    }
    // Sunscreen AM Invariant
    if (isSunscreen(prodName, step.category)) {
      errors.push(`Sunscreen invariant: Sunscreen (${prodName}) cannot be in the PM routine.`);
    }
    // Pregnancy Contraindication Invariant
    if (isPregnancyConcern && isContraindicatedInPregnancy(prodName, (step as any).keyActives || [])) {
      errors.push(`Pregnancy safety invariant: Contraindicated active (${prodName}) must NOT be in the routine.`);
    }
    // Days Invariant
    for (const d of step.days || []) {
      if (!VALID_DAYS.has(d)) {
        errors.push(`PM step '${prodName}' has invalid day '${d}'.`);
      }
    }
    // Required fields
    if (!step.brand || !prodName || !step.amount || !step.area || !step.purpose || !(step.whyChosen ?? (step as any).why_chosen)) {
      errors.push(`PM step ${i + 1} is missing one or more required fields (brand, productName, amount, area, purpose, whyChosen).`);
    }
    // Catalog linkage
    const key = `${(step.brand || '').trim().toLowerCase()}::${prodName.trim().toLowerCase()}`;
    if (!catalogMap.has(key)) {
      errors.push(`PM step '${prodName}' by '${step.brand}' is missing from catalogProducts.`);
    }
  }

  // 4. Validate productDecisions
  for (const dec of proposal.productDecisions || []) {
    const prodName = dec.productName ?? (dec as any).product_name ?? '';
    if (!VALID_ACTIONS.has(dec.action)) {
      errors.push(`Product decision for '${prodName}' has invalid action '${dec.action}'.`);
    }
    if (!VALID_CATEGORIES.has(dec.category)) {
      errors.push(`Product decision for '${prodName}' has invalid category '${dec.category}'.`);
    }
    const reason = dec.actionReason ?? (dec as any).action_reason ?? '';
    if (!reason || reason.trim().length === 0) {
      errors.push(`Product decision for '${prodName}' must include a non-empty actionReason.`);
    }
    if (isPregnancyConcern && isContraindicatedInPregnancy(prodName) && dec.action === 'KEEP') {
      errors.push(`Pregnancy safety invariant: Contraindicated active (${prodName}) must be PAUSE or STOP during pregnancy.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
