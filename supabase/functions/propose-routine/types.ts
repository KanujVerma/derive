// Canonical types for Server-Side Routine Intelligence & Proposal Provider
// Part of DERIVE I1-B2.1: Real Model Intelligence, Trust Semantics & Error-Boundary Closure
// Self-contained and portable across Deno Edge Runtime and Node.js

export type Goal =
  | 'breakouts'
  | 'dark_spots'
  | 'dryness'
  | 'oiliness'
  | 'texture'
  | 'redness'
  | 'fine_lines'
  | 'simplify'
  | 'maintain';

export type RoutineComplexity = 'simple' | 'balanced' | 'maximize';

export type ProductCostPreference = 'balanced' | 'value' | 'premium';

export type MiddayFeel = 'dry_tight' | 'comfortable' | 'oily_shiny' | 'combination' | 'unsure';

export type ProductCategory =
  | 'cleanser'
  | 'toner'
  | 'treatment'
  | 'serum'
  | 'moisturizer'
  | 'sunscreen'
  | 'oil'
  | 'mask'
  | 'deodorant'
  | 'body_care'
  | 'hair_care'
  | 'other';

export type RoutineAction = 'KEEP' | 'PAUSE' | 'REPLACE' | 'ADD' | 'STOP';

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type RoutineErrorCode =
  | 'UNAUTHORIZED'
  | 'INTAKE_NOT_COMMITTED'
  | 'INTAKE_CONTEXT_INVALID'
  | 'MODEL_UNAVAILABLE'
  | 'MODEL_OUTPUT_INVALID'
  | 'CLARIFICATION_REQUIRED'
  | 'VALIDATION_FAILED'
  | 'PERSISTENCE_FAILED'
  | 'INTERNAL_ERROR';

export interface RoutineErrorResponse {
  code: RoutineErrorCode;
  error: string;
  clarificationQuestions?: string[];
}

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

export interface RoutineIntelligenceProvider {
  generateProposal(context: AssembledRoutineContext): Promise<RoutineIntelligenceProposal>;
}
