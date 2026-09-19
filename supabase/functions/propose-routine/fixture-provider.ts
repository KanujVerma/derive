// Deterministic Test Routine Provider & Proposal Factory
// Part of DERIVE I1-B2.2: Provider-Neutral Intelligence Boundary, Catalog Provenance & Trust Closure
// Exclusively for unit tests, local E2E simulation, and CI.

import type {
  AssembledRoutineContext,
  CanonicalCatalogProduct,
  ProductCategory,
  RoutineAction,
  RoutineIntelligenceProposal,
  RoutineIntelligenceProvider,
  RoutineProposalProductDecision,
  RoutineProposalStep,
} from './types.ts';
import { isRetinoid, isSunscreen } from './validator.ts';

export class FixtureRoutineProvider implements RoutineIntelligenceProvider {
  readonly providerId = 'fixture';

  async generateProposal(context: AssembledRoutineContext): Promise<RoutineIntelligenceProposal> {
    return createDeterministicTestProposal(context);
  }
}

/**
 * Deterministic test proposal factory for automated tests, local E2E, and CI.
 * Conforms strictly to schema and invariants without calling external networks.
 * Distinct from production generator.
 */
export function createDeterministicTestProposal(
  context: AssembledRoutineContext
): RoutineIntelligenceProposal {
  const isPregnant = context.isPregnantOrNursing || context.pregnancyStatus === 'yes';
  const hasPihSignal = context.pihTendencyAnswer === 'Often' || context.pihTendencyAnswer === 'Sometimes';

  const productDecisions: RoutineProposalProductDecision[] = [];
  const catalogProducts: CanonicalCatalogProduct[] = [];
  const amSteps: RoutineProposalStep[] = [];
  const pmSteps: RoutineProposalStep[] = [];

  let userCleanser: CanonicalCatalogProduct | null = null;
  let userMoisturizer: CanonicalCatalogProduct | null = null;
  let userSunscreen: CanonicalCatalogProduct | null = null;
  let userRetinoid: CanonicalCatalogProduct | null = null;

  for (const p of context.confirmedProducts) {
    const lowerName = (p.name || '').toLowerCase();
    const cat = (p.category || 'other') as ProductCategory;
    const isActRet = isRetinoid(p.name, p.keyActives || []);

    let action: RoutineAction = 'KEEP';
    let actionReason = 'Keep. Working well with your baseline skin barrier.';
    let frequency = 7;

    if (isActRet) {
      if (isPregnant) {
        action = 'PAUSE';
        actionReason = 'Pause during pregnancy and nursing. Retinoids are clinically contraindicated.';
        frequency = 0;
      } else {
        action = 'KEEP';
        actionReason = 'Keep at 3 nights/week. Cellular turnover active scheduled with recovery nights.';
        frequency = 3;
        userRetinoid = {
          brand: p.brand,
          name: p.name,
          category: 'treatment',
          keyActives: p.keyActives || ['Adapalene'],
        };
      }
    } else if (lowerName.includes('scrub') || lowerName.includes('harsh')) {
      action = 'PAUSE';
      actionReason = 'Pause physical scrub to protect skin barrier from micro-tears.';
      frequency = 0;
    } else if (lowerName.includes('astringent') || lowerName.includes('denat')) {
      action = 'STOP';
      actionReason = 'Discontinue drying astringent to preserve essential lipid barrier.';
      frequency = 0;
    } else if (cat === 'cleanser' || lowerName.includes('cleanser') || lowerName.includes('wash')) {
      action = 'KEEP';
      actionReason = 'Keep. Gentle barrier cleansing without post-wash tightness.';
      frequency = 7;
      if (!userCleanser) {
        userCleanser = {
          brand: p.brand,
          name: p.name,
          category: 'cleanser',
          keyActives: p.keyActives || ['Ceramides'],
        };
      }
    } else if (cat === 'moisturizer' || lowerName.includes('moistur') || lowerName.includes('cream')) {
      action = 'KEEP';
      actionReason = 'Keep. Restores hydration and balances trans-epidermal water loss.';
      frequency = 7;
      if (!userMoisturizer) {
        userMoisturizer = {
          brand: p.brand,
          name: p.name,
          category: 'moisturizer',
          keyActives: p.keyActives || ['Ceramides', 'Glycerin'],
        };
      }
    } else if (cat === 'sunscreen' || isSunscreen(p.name, cat)) {
      action = 'KEEP';
      actionReason = 'Keep every morning. Essential daily photoprotection.';
      frequency = 7;
      if (!userSunscreen) {
        userSunscreen = {
          brand: p.brand,
          name: p.name,
          category: 'sunscreen',
          keyActives: p.keyActives || ['Zinc Oxide'],
        };
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

  // Baseline standard items if missing
  const effectiveCleanser: CanonicalCatalogProduct = userCleanser || {
    brand: 'Standard Barrier',
    name: 'Gentle Hydrating Cleanser',
    category: 'cleanser',
    keyActives: ['Glycerin', 'Purified Water'],
  };
  if (!userCleanser) {
    productDecisions.push({
      productName: effectiveCleanser.name,
      brand: effectiveCleanser.brand,
      category: 'cleanser',
      action: 'ADD',
      actionReason: 'Add gentle fragrance-free cleanser to maintain barrier lipids.',
      frequencyNightsPerWeek: 7,
    });
  }

  const effectiveMoisturizer: CanonicalCatalogProduct = userMoisturizer || {
    brand: 'Standard Barrier',
    name: 'Restorative Barrier Moisturizer',
    category: 'moisturizer',
    keyActives: ['Ceramides', 'Niacinamide'],
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

  const effectiveSunscreen: CanonicalCatalogProduct = userSunscreen || {
    brand: 'Standard Defense',
    name: 'Daily Mineral SPF 40',
    category: 'sunscreen',
    keyActives: ['Zinc Oxide'],
  };
  if (!userSunscreen) {
    productDecisions.push({
      productName: effectiveSunscreen.name,
      brand: effectiveSunscreen.brand,
      category: 'sunscreen',
      action: 'ADD',
      actionReason: 'Add broad-spectrum daily SPF to prevent UV-mediated barrier breakdown.',
      frequencyNightsPerWeek: 7,
    });
  }

  const addCatalog = (prod: CanonicalCatalogProduct) => {
    const b = (prod.brand || '').toLowerCase();
    const n = (prod.name || '').toLowerCase();
    if (!catalogProducts.some((c) => (c.brand || '').toLowerCase() === b && (c.name || '').toLowerCase() === n)) {
      catalogProducts.push(prod);
    }
  };

  addCatalog(effectiveCleanser);
  addCatalog(effectiveMoisturizer);
  addCatalog(effectiveSunscreen);

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
      ? 'Gentle morning cleanse formulated to remove overnight sebum without worsening tightness.'
      : 'Lightweight morning wash to prep skin barrier for daytime defense.',
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
    whyChosen: `Formulated to support ${context.primaryGoal.replace(/_/g, ' ')} while balancing ${context.middayFeel} skin comfort.`,
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
      ? 'Critical daily photoprotection to stop reactive melanin synthesis and prevent blemish marks from deepening.'
      : 'Essential broad-spectrum daily defense against UV-induced barrier stress.',
  });

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
    whyChosen: 'Thorough evening cleanse to dissolve daily sunscreen and environmental particulates.',
  });

  if (!isPregnant && userRetinoid) {
    addCatalog(userRetinoid);
    pmSteps.push({
      order: pmOrder++,
      timing: 'pm',
      productName: userRetinoid.name,
      brand: userRetinoid.brand,
      category: 'treatment',
      amount: 'Pea-sized amount',
      area: 'Entire face avoiding eye contours and corners of mouth',
      days: ['mon', 'wed', 'fri'],
      purpose: 'Targeted Cellular Renewal',
      whyChosen: 'Scheduled 3 nights/week to provide cell turnover with built-in barrier recovery nights.',
      watchFor: 'Mild tingling or initial flaking. Buffer with moisturizer if needed.',
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
    whyChosen: 'Overnight lipid replenishment to reinforce barrier recovery during sleep.',
  });

  const summarySentence = isPregnant
    ? `Pregnancy-safe barrier-supportive routine focused on ${context.primaryGoal.replace(/_/g, ' ')} with gentle hydration and daily UV defense.`
    : userRetinoid
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
