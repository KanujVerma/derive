/**
 * Server-Side Initial Routine Intelligence & Deterministic Validation
 *
 * Part of DERIVE I1-B2: Server-Side Routine Intelligence, Product Normalization
 * and Awaiting-Review Persistence.
 *
 * Rules:
 * - Production routine proposal is formulated from canonical intake, not hardcoded demo fixtures.
 * - Deterministic validation enforces AM/PM invariants, pregnancy contraindications, and action enums.
 * - Zero client secrets or Gemini API keys in the mobile bundle.
 */

import type {
  Goal,
  RoutineComplexity,
  ProductCostPreference,
  MiddayFeel,
  ProductCategory,
  RoutineAction,
  DayOfWeek,
} from '../../types/schema.ts';

export interface AssembledRoutineContext {
  userId: string;
  primaryGoal: Goal;
  secondaryGoals: Goal[];
  routineComplexity: RoutineComplexity;
  costPreference: ProductCostPreference;
  middayFeel: MiddayFeel;
  postCleanseTightness: boolean;
  isPregnantOrNursing: boolean;
  pregnancyStatus: 'yes' | 'no' | 'prefer_not_to_say' | 'unanswered';
  sensitivitiesStatus: 'none_known' | 'reported' | 'unanswered';
  knownSensitivities: string[];
  activePrescriptions: string[];
  confirmedProducts: Array<{
    brand: string;
    name: string;
    category?: ProductCategory | string;
    keyActives?: string[];
  }>;
  productReactions: Array<{
    productName?: string;
    symptoms?: string[];
    severity?: string;
    bodyArea?: string;
  }>;
  formulaSnapshots: Array<{
    productName?: string;
    brand?: string;
    keyActives?: string[];
    fullIngredients?: string[];
  }>;
  pihTendencyAnswer?: 'Rarely' | 'Sometimes' | 'Often' | 'Not sure';
  photoMetadata?: Array<{
    photoType: string;
    storagePath: string;
  }>;
}

export interface RoutineProposalStep {
  order: number;
  timing: 'am' | 'pm';
  productName: string;
  brand: string;
  category: ProductCategory;
  amount: string;
  area: string;
  days: DayOfWeek[];
  purpose: string;
  whyChosen: string;
  watchFor?: string;
}

export interface RoutineProposalProductDecision {
  productName: string;
  brand: string;
  category: ProductCategory;
  action: RoutineAction;
  actionReason: string;
  frequencyNightsPerWeek?: number;
}

export interface CanonicalCatalogProduct {
  brand: string;
  name: string;
  category: ProductCategory;
  keyActives: string[];
  fullIngredients?: string[];
  retailPriceApprox?: number;
  isCatalogStandard?: boolean;
}

export interface RoutineIntelligenceProposal {
  summarySentence: string;
  productDecisions: RoutineProposalProductDecision[];
  amSteps: RoutineProposalStep[];
  pmSteps: RoutineProposalStep[];
  catalogProducts: CanonicalCatalogProduct[];
  clarificationQuestions?: string[];
}

const VALID_CATEGORIES = new Set<string>([
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

const VALID_ACTIONS = new Set<string>(['KEEP', 'PAUSE', 'REPLACE', 'ADD', 'STOP']);
const VALID_DAYS = new Set<string>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

const RETINOID_TERMS = ['adapalene', 'differin', 'tretinoin', 'retinol', 'retinal', 'retinoid', 'tazarotene', 'trifarotene'];
const CONTRAINDICATED_PREGNANCY_TERMS = [...RETINOID_TERMS, 'hydroquinone'];

function isRetinoid(name: string, actives: string[] = []): boolean {
  const lower = name.toLowerCase();
  if (RETINOID_TERMS.some((term) => lower.includes(term))) return true;
  return actives.some((active) => RETINOID_TERMS.some((term) => active.toLowerCase().includes(term)));
}

function isContraindicatedInPregnancy(name: string, actives: string[] = []): boolean {
  const lower = name.toLowerCase();
  if (CONTRAINDICATED_PREGNANCY_TERMS.some((term) => lower.includes(term))) return true;
  return actives.some((active) => CONTRAINDICATED_PREGNANCY_TERMS.some((term) => active.toLowerCase().includes(term)));
}

function isSunscreen(name: string, category: string): boolean {
  if (category === 'sunscreen') return true;
  const lower = name.toLowerCase();
  return lower.includes('sunscreen') || lower.includes('spf');
}

/**
 * Deterministic Post-Model Routine Proposal Validator
 */
export function validateRoutineProposal(
  proposal: RoutineIntelligenceProposal,
  context?: Partial<AssembledRoutineContext>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!proposal.summarySentence || proposal.summarySentence.trim().length === 0) {
    errors.push('Proposal summarySentence must be a non-empty string.');
  }

  const isPregnancyConcern = context?.isPregnantOrNursing === true || context?.pregnancyStatus === 'yes';

  // 1. Validate catalogProducts
  const catalogMap = new Set<string>();
  for (const prod of proposal.catalogProducts || []) {
    if (!prod.brand || prod.brand.trim().length === 0) errors.push('Catalog product brand cannot be empty.');
    if (!prod.name || prod.name.trim().length === 0) errors.push('Catalog product name cannot be empty.');
    if (!VALID_CATEGORIES.has(prod.category)) {
      errors.push(`Catalog product category '${prod.category}' is not a valid ProductCategory.`);
    }
    catalogMap.add(`${prod.brand.trim().toLowerCase()}::${prod.name.trim().toLowerCase()}`);
  }

  // 2. Validate amSteps
  for (let i = 0; i < proposal.amSteps.length; i++) {
    const step = proposal.amSteps[i];
    if (step.timing !== 'am') {
      errors.push(`Step '${step.productName}' in amSteps has timing '${step.timing}', expected 'am'.`);
    }
    if (!VALID_CATEGORIES.has(step.category)) {
      errors.push(`AM step '${step.productName}' has invalid category '${step.category}'.`);
    }
    // Retinoid PM Invariant
    if (isRetinoid(step.productName)) {
      errors.push(`Active retinoid invariant: Retinoid (${step.productName}) must NOT be in the AM routine.`);
    }
    // Pregnancy Contraindication Invariant
    if (isPregnancyConcern && isContraindicatedInPregnancy(step.productName)) {
      errors.push(`Pregnancy safety invariant: Contraindicated active (${step.productName}) must NOT be in the routine.`);
    }
    // Days Invariant
    for (const d of step.days || []) {
      if (!VALID_DAYS.has(d)) {
        errors.push(`AM step '${step.productName}' has invalid day '${d}'.`);
      }
    }
    // Required fields
    if (!step.brand || !step.productName || !step.amount || !step.area || !step.purpose || !step.whyChosen) {
      errors.push(`AM step ${i + 1} is missing one or more required fields (brand, productName, amount, area, purpose, whyChosen).`);
    }
    // Catalog linkage
    const key = `${(step.brand || '').trim().toLowerCase()}::${(step.productName || '').trim().toLowerCase()}`;
    if (!catalogMap.has(key)) {
      errors.push(`AM step '${step.productName}' by '${step.brand}' is missing from catalogProducts.`);
    }
  }

  // 3. Validate pmSteps
  for (let i = 0; i < proposal.pmSteps.length; i++) {
    const step = proposal.pmSteps[i];
    if (step.timing !== 'pm') {
      errors.push(`Step '${step.productName}' in pmSteps has timing '${step.timing}', expected 'pm'.`);
    }
    if (!VALID_CATEGORIES.has(step.category)) {
      errors.push(`PM step '${step.productName}' has invalid category '${step.category}'.`);
    }
    // Sunscreen AM Invariant
    if (isSunscreen(step.productName, step.category)) {
      errors.push(`Sunscreen invariant: Sunscreen (${step.productName}) cannot be in the PM routine.`);
    }
    // Pregnancy Contraindication Invariant
    if (isPregnancyConcern && isContraindicatedInPregnancy(step.productName)) {
      errors.push(`Pregnancy safety invariant: Contraindicated active (${step.productName}) must NOT be in the routine.`);
    }
    // Days Invariant
    for (const d of step.days || []) {
      if (!VALID_DAYS.has(d)) {
        errors.push(`PM step '${step.productName}' has invalid day '${d}'.`);
      }
    }
    // Required fields
    if (!step.brand || !step.productName || !step.amount || !step.area || !step.purpose || !step.whyChosen) {
      errors.push(`PM step ${i + 1} is missing one or more required fields (brand, productName, amount, area, purpose, whyChosen).`);
    }
    // Catalog linkage
    const key = `${(step.brand || '').trim().toLowerCase()}::${(step.productName || '').trim().toLowerCase()}`;
    if (!catalogMap.has(key)) {
      errors.push(`PM step '${step.productName}' by '${step.brand}' is missing from catalogProducts.`);
    }
  }

  // 4. Validate productDecisions
  for (const dec of proposal.productDecisions || []) {
    if (!VALID_ACTIONS.has(dec.action)) {
      errors.push(`Product decision for '${dec.productName}' has invalid action '${dec.action}'.`);
    }
    if (!dec.actionReason || dec.actionReason.trim().length === 0) {
      errors.push(`Product decision for '${dec.productName}' must include a non-empty actionReason.`);
    }
    if (isPregnancyConcern && isContraindicatedInPregnancy(dec.productName) && dec.action === 'KEEP') {
      errors.push(`Pregnancy safety invariant: Contraindicated active (${dec.productName}) must be PAUSE or STOP during pregnancy.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Derives canonical schedule display text from timing and scheduled days.
 */
export function formatRoutineStepScheduleText(timing: 'am' | 'pm', days: DayOfWeek[]): string {
  if (!days || days.length === 0 || days.length === 7) {
    return timing === 'am' ? 'Every morning' : 'Every evening';
  }
  const dayLabels: Record<DayOfWeek, string> = {
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

/**
 * Server-Side Context Assembler
 */
export function assembleRoutineContext(
  skinProfile: any,
  payloadSnapshot: any,
  photos?: any[]
): AssembledRoutineContext {
  const safety = payloadSnapshot?.safetyContext || {};
  const isPregnant = skinProfile?.is_pregnant_or_nursing === true || safety.isPregnantOrNursing === true || skinProfile?.pregnancy_status === 'yes';

  return {
    userId: skinProfile?.user_id || payloadSnapshot?.userId || '',
    primaryGoal: skinProfile?.primary_goal || payloadSnapshot?.primaryGoal || 'barrier_health',
    secondaryGoals: skinProfile?.secondary_goals || payloadSnapshot?.secondaryGoals || [],
    routineComplexity: skinProfile?.routine_complexity || payloadSnapshot?.routineComplexity || 'essential',
    costPreference: skinProfile?.cost_preference || payloadSnapshot?.costPreference || 'practical',
    middayFeel: skinProfile?.midday_feel || payloadSnapshot?.middayFeel || 'comfortable',
    postCleanseTightness: skinProfile?.post_cleanse_tightness ?? payloadSnapshot?.postCleanseTightness ?? false,
    isPregnantOrNursing: isPregnant,
    pregnancyStatus: (skinProfile?.pregnancy_status || safety.pregnancyStatus || (isPregnant ? 'yes' : 'unanswered')) as any,
    sensitivitiesStatus: (skinProfile?.sensitivities_status || safety.sensitivitiesStatus || 'unanswered') as any,
    knownSensitivities: skinProfile?.known_sensitivities || safety.knownSensitivities || [],
    activePrescriptions: skinProfile?.active_prescriptions || payloadSnapshot?.activePrescriptions || [],
    confirmedProducts: (payloadSnapshot?.confirmedProducts || []).map((p: any) => ({
      brand: p.brand || p.detectedBrand || 'Unknown Brand',
      name: p.name || p.detectedName || p.productName || 'Unknown Product',
      category: p.category || 'other',
      keyActives: p.keyActives || [],
    })),
    productReactions: payloadSnapshot?.productReactions || [],
    formulaSnapshots: payloadSnapshot?.formulaSnapshots || [],
    pihTendencyAnswer: payloadSnapshot?.pihTendencyAnswer || undefined,
    photoMetadata: (photos || []).map((ph: any) => ({
      photoType: ph.photo_type || ph.photoType,
      storagePath: ph.storage_path || ph.storagePath,
    })),
  };
}

/**
 * Production Context-Grounded Routine Intelligence Generator
 *
 * Constructing a personalized proposal from the actual member's canonical intake.
 * Zero hardcoded demo fixtures.
 */
export function generateContextGroundedProposal(
  context: AssembledRoutineContext
): RoutineIntelligenceProposal {
  const isPregnant = context.isPregnantOrNursing || context.pregnancyStatus === 'yes';
  const hasPihSignal = context.pihTendencyAnswer === 'Often' || context.pihTendencyAnswer === 'Sometimes';

  const productDecisions: RoutineProposalProductDecision[] = [];
  const catalogProducts: CanonicalCatalogProduct[] = [];
  const amSteps: RoutineProposalStep[] = [];
  const pmSteps: RoutineProposalStep[] = [];

  let userCleanser: { brand: string; name: string; category: ProductCategory; keyActives: string[] } | null = null;
  let userMoisturizer: { brand: string; name: string; category: ProductCategory; keyActives: string[] } | null = null;
  let userSunscreen: { brand: string; name: string; category: ProductCategory; keyActives: string[] } | null = null;
  let userRetinoidTreatment: { brand: string; name: string; category: ProductCategory; keyActives: string[] } | null = null;

  // Audit confirmed products
  for (const p of context.confirmedProducts) {
    const lowerName = p.name.toLowerCase();
    const cat = (p.category || 'other') as ProductCategory;
    const isActivesRetinoid = isRetinoid(p.name, p.keyActives);

    let action: RoutineAction = 'KEEP';
    let actionReason = 'Keep. Working well with your baseline skin barrier.';
    let frequency = 7;

    if (isActivesRetinoid) {
      if (isPregnant) {
        action = 'PAUSE';
        actionReason = 'Pause during pregnancy and nursing. Retinoids are clinically contraindicated; we prioritize non-retinoid barrier stabilization.';
        frequency = 0;
      } else {
        action = 'KEEP';
        actionReason = "Keep at 3 nights/week. Cellular turnover active scheduled with recovery nights.";
        frequency = 3;
        userRetinoidTreatment = {
          brand: p.brand,
          name: p.name,
          category: 'treatment',
          keyActives: p.keyActives || ['Adapalene'],
        };
      }
    } else if (lowerName.includes('scrub') || lowerName.includes('harsh') || lowerName.includes('physical')) {
      action = 'PAUSE';
      actionReason = 'Pause physical scrub. Removing harsh physical abrasives avoids micro-tears and reduces reactive oiliness.';
      frequency = 0;
    } else if (lowerName.includes('astringent') || lowerName.includes('alcohol denat')) {
      action = 'STOP';
      actionReason = 'Discontinue drying astringent to protect essential lipid barrier.';
      frequency = 0;
    } else if (cat === 'cleanser' || lowerName.includes('cleanser') || lowerName.includes('wash')) {
      action = 'KEEP';
      actionReason = 'Keep. Gentle barrier cleansing without post-wash tightness.';
      frequency = 7;
      if (!userCleanser) {
        userCleanser = { brand: p.brand, name: p.name, category: 'cleanser', keyActives: p.keyActives || ['Ceramides'] };
      }
    } else if (cat === 'moisturizer' || lowerName.includes('moistur') || lowerName.includes('cream') || lowerName.includes('lotion')) {
      action = 'KEEP';
      actionReason = 'Keep. Restores hydration and prevents trans-epidermal water loss.';
      frequency = 7;
      if (!userMoisturizer) {
        userMoisturizer = { brand: p.brand, name: p.name, category: 'moisturizer', keyActives: p.keyActives || ['Ceramides', 'Glycerin'] };
      }
    } else if (cat === 'sunscreen' || isSunscreen(p.name, cat)) {
      action = 'KEEP';
      actionReason = 'Keep every morning. Essential daily photoprotection prevents hyperpigmentation and barrier stress.';
      frequency = 7;
      if (!userSunscreen) {
        userSunscreen = { brand: p.brand, name: p.name, category: 'sunscreen', keyActives: p.keyActives || ['Zinc Oxide'] };
      }
    }

    productDecisions.push({
      productName: p.name,
      brand: p.brand,
      category: cat,
      action,
      actionReason,
      frequencyNightsPerWeek: frequency,
    });
  }

  // Ensure canonical cleanser
  const effectiveCleanser = userCleanser || {
    brand: 'Vanicream',
    name: 'Gentle Facial Cleanser',
    category: 'cleanser' as ProductCategory,
    keyActives: ['Glycerin', 'Purified Water'],
  };
  if (!userCleanser) {
    productDecisions.push({
      productName: effectiveCleanser.name,
      brand: effectiveCleanser.brand,
      category: 'cleanser',
      action: 'ADD',
      actionReason: 'Add gentle, fragrance-free cleanser to cleanse without stripping natural lipids.',
      frequencyNightsPerWeek: 7,
    });
  }

  // Ensure canonical moisturizer
  const effectiveMoisturizer = userMoisturizer || {
    brand: 'La Roche-Posay',
    name: 'Toleriane Double Repair Face Moisturizer',
    category: 'moisturizer' as ProductCategory,
    keyActives: ['Ceramides', 'Niacinamide', 'Glycerin'],
  };
  if (!userMoisturizer) {
    productDecisions.push({
      productName: effectiveMoisturizer.name,
      brand: effectiveMoisturizer.brand,
      category: 'moisturizer',
      action: 'ADD',
      actionReason: 'Add barrier-restorative moisturizer to balance trans-epidermal water loss.',
      frequencyNightsPerWeek: 7,
    });
  }

  // Ensure canonical sunscreen (Sunscreen AM Invariant)
  const effectiveSunscreen = userSunscreen || {
    brand: 'EltaMD',
    name: 'UV Clear Broad-Spectrum SPF 46',
    category: 'sunscreen' as ProductCategory,
    keyActives: ['Zinc Oxide', 'Niacinamide'],
  };
  if (!userSunscreen) {
    productDecisions.push({
      productName: effectiveSunscreen.name,
      brand: effectiveSunscreen.brand,
      category: 'sunscreen',
      action: 'ADD',
      actionReason: 'Add broad-spectrum daily SPF to prevent UV-mediated barrier breakdown and post-blemish dark marks.',
      frequencyNightsPerWeek: 7,
    });
  }

  // Assemble catalog products
  const addCatalog = (prod: { brand: string; name: string; category: ProductCategory; keyActives: string[] }) => {
    if (!catalogProducts.some((c) => c.brand.toLowerCase() === prod.brand.toLowerCase() && c.name.toLowerCase() === prod.name.toLowerCase())) {
      catalogProducts.push({
        brand: prod.brand,
        name: prod.name,
        category: prod.category,
        keyActives: prod.keyActives,
        fullIngredients: prod.keyActives,
        isCatalogStandard: true,
      });
    }
  };

  addCatalog(effectiveCleanser);
  addCatalog(effectiveMoisturizer);
  addCatalog(effectiveSunscreen);

  // AM Steps: Cleanse -> Moisturize -> Sunscreen
  let amOrder = 1;
  amSteps.push({
    order: amOrder++,
    timing: 'am',
    productName: effectiveCleanser.name,
    brand: effectiveCleanser.brand,
    category: effectiveCleanser.category,
    amount: '1-2 pumps',
    area: 'Entire face with lukewarm water',
    days: [],
    purpose: 'Cleanse',
    whyChosen: context.postCleanseTightness
      ? 'Gentle wash removes overnight sebum without exacerbating post-cleanse dryness or tightness.'
      : 'Lightweight morning cleanse to prep skin for daytime defense without stripping natural barrier lipids.',
  });

  amSteps.push({
    order: amOrder++,
    timing: 'am',
    productName: effectiveMoisturizer.name,
    brand: effectiveMoisturizer.brand,
    category: effectiveMoisturizer.category,
    amount: 'Dime-sized amount',
    area: 'Entire face & neck',
    days: [],
    purpose: 'Hydrate & Seal',
    whyChosen: `Formulated to support ${context.primaryGoal.replace(/_/g, ' ')} while balancing ${context.middayFeel} midday skin feel.`,
  });

  amSteps.push({
    order: amOrder++,
    timing: 'am',
    productName: effectiveSunscreen.name,
    brand: effectiveSunscreen.brand,
    category: effectiveSunscreen.category,
    amount: 'Two finger lengths (1/4 tsp)',
    area: 'Entire face, ears, and neck',
    days: [],
    purpose: 'UV Protection',
    whyChosen: hasPihSignal
      ? 'Critical broad-spectrum photoprotection to stop reactive pigment synthesis and prevent dark spots from deepening.'
      : 'Essential broad-spectrum protection against daily UVA/UVB damage, protecting active cellular recovery.',
  });

  // PM Steps: Cleanse -> Optional Treatment (retinoid on recovery schedule) -> Moisturize
  let pmOrder = 1;
  pmSteps.push({
    order: pmOrder++,
    timing: 'pm',
    productName: effectiveCleanser.name,
    brand: effectiveCleanser.brand,
    category: effectiveCleanser.category,
    amount: '1-2 pumps',
    area: 'Entire face with lukewarm water',
    days: [],
    purpose: 'Evening Cleanse',
    whyChosen: 'Thorough evening cleanse to dissolve daily sunscreen, pollution particles, and excess sebum.',
  });

  // Treatment step: only if not pregnant and either existing or indicated
  if (!isPregnant && userRetinoidTreatment) {
    addCatalog(userRetinoidTreatment);
    pmSteps.push({
      order: pmOrder++,
      timing: 'pm',
      productName: userRetinoidTreatment.name,
      brand: userRetinoidTreatment.brand,
      category: 'treatment',
      amount: 'Pea-sized amount',
      area: 'Entire face avoiding delicate eye contours and corners of mouth',
      days: ['mon', 'wed', 'fri'],
      purpose: 'Targeted Cellular Renewal',
      whyChosen: 'Scheduled at 3 nights per week to provide steady follicular desquamation with built-in barrier recovery nights.',
      watchFor: 'Mild flaking or tingling in initial weeks. Buffer with moisturizer if sensitivity arises.',
    });
  }

  pmSteps.push({
    order: pmOrder++,
    timing: 'pm',
    productName: effectiveMoisturizer.name,
    brand: effectiveMoisturizer.brand,
    category: effectiveMoisturizer.category,
    amount: 'Nickel-sized amount',
    area: 'Entire face & neck',
    days: [],
    purpose: 'Barrier Recovery',
    whyChosen: 'Overnight lipid replenishment to reinforce the stratum corneum and lock in physiological hydration.',
  });

  // Summary sentence
  const summarySentence = isPregnant
    ? `Pregnancy-safe barrier-supportive routine focused on ${context.primaryGoal.replace(/_/g, ' ')} with gentle hydration and strict daily UV protection.`
    : userRetinoidTreatment
    ? `Targeted 3-night active routine balancing cellular renewal with barrier protection for ${context.primaryGoal.replace(/_/g, ' ')}.`
    : `Balanced barrier-stabilizing routine designed for ${context.primaryGoal.replace(/_/g, ' ')} and ${context.middayFeel} skin comfort.`;

  return {
    summarySentence,
    productDecisions,
    amSteps,
    pmSteps,
    catalogProducts,
  };
}
