// Gemini Structured Output Provider & Test Seam
// Part of DERIVE I1-B2.1: Real Model Intelligence, Trust Semantics & Error-Boundary Closure

import type {
  AssembledRoutineContext,
  RoutineIntelligenceProposal,
  RoutineProposalProductDecision,
  CanonicalCatalogProduct,
  RoutineProposalStep,
  ProductCategory,
  RoutineAction,
} from './types.ts';
import { isRetinoid, isSunscreen } from './validator.ts';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export const GEMINI_PROPOSAL_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summarySentence: {
      type: 'STRING',
      description: 'One concise sentence summarizing the routine focus and dermatological strategy.',
    },
    clarificationQuestions: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Any clinical questions if missing or conflicting information prevents a safe proposal.',
    },
    catalogProducts: {
      type: 'ARRAY',
      description: 'Complete catalog metadata for all products used in the routine (both existing shelf products and newly recommended products).',
      items: {
        type: 'OBJECT',
        properties: {
          brand: { type: 'STRING' },
          name: { type: 'STRING' },
          category: {
            type: 'STRING',
            enum: [
              'cleanser', 'toner', 'treatment', 'serum', 'moisturizer',
              'sunscreen', 'oil', 'mask', 'deodorant', 'body_care', 'hair_care', 'other',
            ],
          },
          keyActives: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          fullIngredients: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
        },
        required: ['brand', 'name', 'category', 'keyActives'],
      },
    },
    productDecisions: {
      type: 'ARRAY',
      description: 'Action decisions for all confirmed shelf products and recommended additions.',
      items: {
        type: 'OBJECT',
        properties: {
          brand: { type: 'STRING' },
          productName: { type: 'STRING' },
          category: {
            type: 'STRING',
            enum: [
              'cleanser', 'toner', 'treatment', 'serum', 'moisturizer',
              'sunscreen', 'oil', 'mask', 'deodorant', 'body_care', 'hair_care', 'other',
            ],
          },
          action: {
            type: 'STRING',
            enum: ['KEEP', 'PAUSE', 'REPLACE', 'ADD', 'STOP'],
          },
          actionReason: { type: 'STRING' },
          frequencyNightsPerWeek: { type: 'INTEGER' },
        },
        required: ['brand', 'productName', 'category', 'action', 'actionReason'],
      },
    },
    amSteps: {
      type: 'ARRAY',
      description: 'Morning routine steps in exact application order.',
      items: {
        type: 'OBJECT',
        properties: {
          order: { type: 'INTEGER' },
          timing: { type: 'STRING', enum: ['am'] },
          brand: { type: 'STRING' },
          productName: { type: 'STRING' },
          category: {
            type: 'STRING',
            enum: [
              'cleanser', 'toner', 'treatment', 'serum', 'moisturizer',
              'sunscreen', 'oil', 'mask', 'deodorant', 'body_care', 'hair_care', 'other',
            ],
          },
          amount: { type: 'STRING' },
          area: { type: 'STRING' },
          days: {
            type: 'ARRAY',
            items: {
              type: 'STRING',
              enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
            },
          },
          purpose: { type: 'STRING' },
          whyChosen: { type: 'STRING' },
          watchFor: { type: 'STRING' },
        },
        required: ['order', 'timing', 'brand', 'productName', 'category', 'amount', 'area', 'purpose', 'whyChosen'],
      },
    },
    pmSteps: {
      type: 'ARRAY',
      description: 'Evening routine steps in exact application order.',
      items: {
        type: 'OBJECT',
        properties: {
          order: { type: 'INTEGER' },
          timing: { type: 'STRING', enum: ['pm'] },
          brand: { type: 'STRING' },
          productName: { type: 'STRING' },
          category: {
            type: 'STRING',
            enum: [
              'cleanser', 'toner', 'treatment', 'serum', 'moisturizer',
              'sunscreen', 'oil', 'mask', 'deodorant', 'body_care', 'hair_care', 'other',
            ],
          },
          amount: { type: 'STRING' },
          area: { type: 'STRING' },
          days: {
            type: 'ARRAY',
            items: {
              type: 'STRING',
              enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
            },
          },
          purpose: { type: 'STRING' },
          whyChosen: { type: 'STRING' },
          watchFor: { type: 'STRING' },
        },
        required: ['order', 'timing', 'brand', 'productName', 'category', 'amount', 'area', 'purpose', 'whyChosen'],
      },
    },
  },
  required: ['summarySentence', 'catalogProducts', 'productDecisions', 'amSteps', 'pmSteps'],
};

export const GEMINI_SYSTEM_INSTRUCTION = `You are Derive's Clinical Skincare Intelligence Engine.
You formulate evidence-grounded, personalized daily skincare routines based strictly on verified customer skin profile data, confirmed bathroom shelf inventory, and clinical safety invariants.

DETERMINISTIC CLINICAL INVARIANTS YOU MUST STRICTLY OBEY:
1. SUNSCREEN AM INVARIANT: Sunscreen steps MUST ONLY appear in the morning ('amSteps'). Sunscreens must NEVER appear in the evening ('pmSteps').
2. RETINOID PM INVARIANT: Topical retinoids (adapalene, tretinoin, retinol, retinal, tazarotene, trifarotene) MUST ONLY appear in the evening ('pmSteps') on a recovery schedule (e.g. 3 nights per week). Retinoids must NEVER appear in the morning ('amSteps').
3. PREGNANCY & NURSING CONTRAINDICATION: If the member is pregnant or nursing (isPregnantOrNursing is true or pregnancyStatus is 'yes'), topical retinoids and hydroquinone are strictly contraindicated. Any shelf retinoid must be marked PAUSE with an explicit pregnancy contraindication reason, and no retinoids may appear in the proposed routine.
4. SENSITIVITY PROTECTION: Never recommend or add products containing ingredients matching the member's known sensitivities.
5. PRESERVE WORKING SHELF PRODUCTS: Prioritize keeping compatible barrier products already on the member's shelf (action: 'KEEP').
6. REMOVE HARSH ABRASIVES: Physical scrubs (apricot scrubs, walnut shell) and drying astringents (high alcohol denat) must be marked PAUSE or STOP to preserve barrier lipids.
7. ESSENTIAL BASELINE STEPS: Ensure the routine includes gentle cleansing, barrier hydration/moisturization, and broad-spectrum SPF 30+ daily photoprotection.
8. COSMETIC BOUNDARY: Keep all advice strictly non-diagnostic and cosmetic. Do not diagnose medical conditions.

You must output valid JSON conforming strictly to the requested schema.`;

export function buildGeminiPrompt(context: AssembledRoutineContext): string {
  return JSON.stringify({
    task: 'Formulate an initial personalized skincare routine proposal',
    memberProfile: {
      primaryGoal: context.primaryGoal,
      secondaryGoals: context.secondaryGoals,
      routineComplexity: context.routineComplexity,
      costPreference: context.costPreference,
      middayFeel: context.middayFeel,
      postCleanseTightness: context.postCleanseTightness,
      isPregnantOrNursing: context.isPregnantOrNursing,
      pregnancyStatus: context.pregnancyStatus,
      sensitivitiesStatus: context.sensitivitiesStatus,
      knownSensitivities: context.knownSensitivities,
      activePrescriptions: context.activePrescriptions,
      pihTendency: context.pihTendencyAnswer,
    },
    confirmedShelfProducts: context.confirmedProducts,
    productReactions: context.productReactions,
  });
}

/**
 * Invokes Gemini 3.8 Flash via Google AI Studio / Generative Language API
 * using server-side credentials and structured JSON output.
 */
export async function callGeminiProposalProvider(
  context: AssembledRoutineContext,
  apiKey: string,
  modelName: string = DEFAULT_GEMINI_MODEL
): Promise<RoutineIntelligenceProposal> {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    const error = new Error('Gemini API key is required but missing.');
    (error as any).code = 'MODEL_UNAVAILABLE';
    (error as any).status = 503;
    throw error;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const promptText = buildGeminiPrompt(context);

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: promptText }],
      },
    ],
    systemInstruction: {
      parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }],
    },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_PROPOSAL_RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err: any) {
    // Bounded technical log without leaking API key
    console.error(`[gemini-provider] Network failure connecting to Gemini API: ${err?.message}`);
    const error = new Error('Routine intelligence service is temporarily unavailable.');
    (error as any).code = 'MODEL_UNAVAILABLE';
    (error as any).status = 503;
    throw error;
  }

  if (!response.ok) {
    console.error(`[gemini-provider] Gemini API returned HTTP status ${response.status}`);
    const error = new Error('Routine intelligence service returned an error.');
    (error as any).code = 'MODEL_UNAVAILABLE';
    (error as any).status = 503;
    throw error;
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    console.error('[gemini-provider] Failed to parse Gemini HTTP response as JSON');
    const error = new Error('Invalid response from model provider.');
    (error as any).code = 'MODEL_OUTPUT_INVALID';
    (error as any).status = 502;
    throw error;
  }

  const candidate = data?.candidates?.[0];
  const rawText = candidate?.content?.parts?.[0]?.text;

  if (!rawText || typeof rawText !== 'string') {
    console.error('[gemini-provider] Gemini returned candidate with no text part');
    const error = new Error('Model candidate did not contain structured text part.');
    (error as any).code = 'MODEL_OUTPUT_INVALID';
    (error as any).status = 502;
    throw error;
  }

  let proposal: RoutineIntelligenceProposal;
  try {
    proposal = JSON.parse(rawText);
  } catch {
    console.error('[gemini-provider] Failed to parse structured JSON part from model candidate');
    const error = new Error('Model output could not be parsed as valid JSON.');
    (error as any).code = 'MODEL_OUTPUT_INVALID';
    (error as any).status = 502;
    throw error;
  }

  return proposal;
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
          fullIngredients: p.keyActives || ['Adapalene 0.1%'],
          isCatalogStandard: true,
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
          fullIngredients: p.keyActives || ['Glycerin'],
          isCatalogStandard: true,
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
          fullIngredients: p.keyActives || ['Ceramide NP', 'Glycerin'],
          isCatalogStandard: true,
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
          fullIngredients: p.keyActives || ['Zinc Oxide 9%'],
          isCatalogStandard: true,
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
    fullIngredients: ['Water', 'Glycerin'],
    isCatalogStandard: true,
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
    fullIngredients: ['Water', 'Ceramides', 'Niacinamide'],
    isCatalogStandard: true,
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
    fullIngredients: ['Zinc Oxide 12%', 'Water'],
    isCatalogStandard: true,
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
