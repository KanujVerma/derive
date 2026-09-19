// Optional Gemini Routine Intelligence Adapter
// Part of DERIVE I1-B2.2: Provider-Neutral Intelligence Boundary, Catalog Provenance & Trust Closure
// NOTE: Derive production model selection is OPEN / DEFERRED.
// This adapter provides a provisional implementation for evaluation and experimentation.

declare const Deno: any;

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
      description: 'Catalog metadata for products used in the routine. Models propose clinical metadata only; full formula and pricing truth are server-managed.',
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
        },
        required: ['brand', 'name', 'category', 'keyActives'],
      },
    },
    productDecisions: {
      type: 'ARRAY',
      description: 'Action decisions for confirmed shelf products and recommended additions.',
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
7. PHOTOPROTECTION RATIONALE: If the member has dark spots or reports PIH tendency (pihTendency is 'Often' or 'Sometimes'), emphasize diligent daily photoprotection in the sunscreen rationale to prevent UV-mediated reactive hyperpigmentation.
8. PROPOSALS ARE NOT PRODUCT DATABASES: Only propose brand, productName, category, and keyActives. Do not invent pricing or full ingredient lists.`;

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
 * Invokes Gemini via Google AI Studio / Generative Language API
 * using server-side credentials header (x-goog-api-key) and structured JSON output.
 * No API key is ever placed in the request URL.
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

  // Section 12: Credentials must not appear in request URLs where header auth is supported
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;
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
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err: any) {
    // Bounded technical log without leaking API key
    console.error(`[gemini-adapter] Network failure connecting to Gemini API: ${err?.message}`);
    const error = new Error('Routine intelligence service is temporarily unavailable.');
    (error as any).code = 'MODEL_UNAVAILABLE';
    (error as any).status = 503;
    throw error;
  }

  if (!response.ok) {
    console.error(`[gemini-adapter] Gemini API returned HTTP status ${response.status}`);
    const error = new Error('Routine intelligence service returned an error.');
    (error as any).code = 'MODEL_UNAVAILABLE';
    (error as any).status = 503;
    throw error;
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    console.error('[gemini-adapter] Failed to parse Gemini HTTP response as JSON');
    const error = new Error('Invalid response from model provider.');
    (error as any).code = 'MODEL_OUTPUT_INVALID';
    (error as any).status = 502;
    throw error;
  }

  const candidate = data?.candidates?.[0];
  const rawText = candidate?.content?.parts?.[0]?.text;

  if (!rawText || typeof rawText !== 'string') {
    console.error('[gemini-adapter] Gemini returned candidate with no text part');
    const error = new Error('Model candidate did not contain structured text part.');
    (error as any).code = 'MODEL_OUTPUT_INVALID';
    (error as any).status = 502;
    throw error;
  }

  let proposal: RoutineIntelligenceProposal;
  try {
    proposal = JSON.parse(rawText);
  } catch {
    console.error('[gemini-adapter] Failed to parse structured JSON part from model candidate');
    const error = new Error('Model output could not be parsed as valid JSON.');
    (error as any).code = 'MODEL_OUTPUT_INVALID';
    (error as any).status = 502;
    throw error;
  }

  return proposal;
}

/**
 * Optional Gemini Routine Intelligence Provider Adapter
 * Implements provider-neutral RoutineIntelligenceProvider boundary.
 */
export class GeminiRoutineProvider implements RoutineIntelligenceProvider {
  readonly providerId = 'gemini';
  private apiKey: string;
  private modelName: string;

  constructor(apiKey?: string, modelName?: string) {
    this.apiKey = apiKey || (typeof Deno !== 'undefined' ? Deno.env.get('GEMINI_API_KEY') : process.env.GEMINI_API_KEY) || '';
    this.modelName =
      modelName ||
      (typeof Deno !== 'undefined'
        ? Deno.env.get('ROUTINE_MODEL_NAME') || Deno.env.get('GEMINI_MODEL')
        : process.env.ROUTINE_MODEL_NAME || process.env.GEMINI_MODEL) ||
      DEFAULT_GEMINI_MODEL;
  }

  async generateProposal(context: AssembledRoutineContext): Promise<RoutineIntelligenceProposal> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      const error = new Error('Gemini API key is required but missing.');
      (error as any).code = 'MODEL_UNAVAILABLE';
      (error as any).status = 503;
      throw error;
    }
    return callGeminiProposalProvider(context, this.apiKey, this.modelName);
  }
}
