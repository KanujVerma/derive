import { z } from 'zod';

// ==========================================
// 1. ONBOARDING & PROFILE TYPES
// ==========================================

export const GoalSchema = z.enum([
  'breakouts',
  'dark_spots',
  'dryness',
  'oiliness',
  'texture',
  'redness',
  'fine_lines',
  'simplify',
  'maintain',
]);
export type Goal = z.infer<typeof GoalSchema>;

export const GoalLabels: Record<Goal, { label: string; description: string }> = {
  breakouts: { label: 'Breakouts', description: 'Clogged pores and blemishes' },
  dark_spots: { label: 'Dark spots & tone', description: 'Hyperpigmentation and post-acne marks' },
  dryness: { label: 'Dryness & tightness', description: 'Flaking and lack of hydration' },
  oiliness: { label: 'Excess oil', description: 'Shiny T-zone or midday grease' },
  texture: { label: 'Uneven texture', description: 'Roughness and small bumps' },
  redness: { label: 'Redness & sensitivity', description: 'Flushing and easily irritated skin' },
  fine_lines: { label: 'Fine lines & aging', description: 'Loss of firmness and early lines' },
  simplify: { label: 'Simplify routine', description: 'Cut unnecessary steps and clutter' },
  maintain: { label: 'Maintain skin health', description: 'Keep current healthy skin stable' },
};

export const RoutineComplexitySchema = z.enum(['simple', 'balanced', 'maximize']);
export type RoutineComplexity = z.infer<typeof RoutineComplexitySchema>;

export const ProductCostPreferenceSchema = z.enum(['value', 'balanced', 'premium']);
export type ProductCostPreference = z.infer<typeof ProductCostPreferenceSchema>;

export const MiddayFeelSchema = z.enum(['dry_tight', 'comfortable', 'oily_shiny', 'combination', 'unsure']);
export type MiddayFeel = z.infer<typeof MiddayFeelSchema>;

export const PostCleanseFeelSchema = z.enum(['tight_dry', 'normal_comfortable', 'oily', 'unsure']);
export type PostCleanseFeel = z.infer<typeof PostCleanseFeelSchema>;

// ==========================================
// 2. PRODUCT REACTION & INGREDIENT INTELLIGENCE
// ==========================================

export const ReactionSeveritySchema = z.enum(['mild', 'moderate', 'severe', 'unknown']);
export type ReactionSeverity = z.infer<typeof ReactionSeveritySchema>;

export const IngredientSignalConfidenceSchema = z.enum([
  'confirmed_allergy',
  'strong_signal',
  'suspected_sensitivity',
  'weak_signal',
]);
export type IngredientSignalConfidence = z.infer<typeof IngredientSignalConfidenceSchema>;

export const AllergySourceSchema = z.enum(['user_reported', 'clinician_reported']);
export type AllergySource = z.infer<typeof AllergySourceSchema>;

export const BodyAreaSchema = z.enum([
  'face',
  'cheeks',
  'around_eyes',
  'forehead',
  'jawline',
  'neck',
  'scalp',
  'underarms',
  'chest',
  'back',
  'arms',
  'legs',
  'body',
  'other',
]);
export type BodyArea = z.infer<typeof BodyAreaSchema>;

export const ReactionSymptomSchema = z.enum([
  'burning_stinging',
  'redness_rash',
  'itching',
  'breakouts',
  'dryness_peeling',
  'swelling',
  'other',
]);
export type ReactionSymptom = z.infer<typeof ReactionSymptomSchema>;

export const ReactionSymptomLabels: Record<ReactionSymptom, string> = {
  burning_stinging: 'Burning or stinging',
  redness_rash: 'Redness or rash',
  itching: 'Itching',
  breakouts: 'Breakouts',
  dryness_peeling: 'Dryness or peeling',
  swelling: 'Swelling',
  other: 'Something else',
};

export interface ProductReaction {
  id: string;
  userId: string;
  productId?: string;
  productNameSnapshot: string;
  brandSnapshot?: string;
  formulaSnapshotId?: string;
  symptoms: ReactionSymptom[];
  bodyArea: BodyArea;
  severity: ReactionSeverity;
  approximateDate?: string;
  notes?: string;
}

export interface FormulaSnapshot {
  id: string;
  productId?: string;
  productName: string;
  brand?: string;
  ingredients: string[];
  capturedAt: string;
}

export interface IngredientSignal {
  ingredientId: string;
  ingredientName: string;
  confidence: IngredientSignalConfidence;
  evidenceCount: number;
  supportingReactionIds: string[];
  contradictoryToleranceEvidence: {
    productId: string;
    productName: string;
  }[];
  allergySource?: AllergySource;
  notes?: string;
}

export const PregnancyStatusSchema = z.enum(['yes', 'no', 'prefer_not_to_say', 'unanswered']);
export type PregnancyStatus = z.infer<typeof PregnancyStatusSchema>;

export const SensitivitiesStatusSchema = z.enum(['none_known', 'reported', 'unanswered']);
export type SensitivitiesStatus = z.infer<typeof SensitivitiesStatusSchema>;

export interface SkinProfile {
  id: string;
  userId: string;
  primaryGoal: Goal;
  secondaryGoals: Goal[];
  routineComplexity: RoutineComplexity;
  costPreference: ProductCostPreference;
  middayFeel: MiddayFeel;
  postCleanseTightness: boolean;
  knownSensitivities: string[];
  sensitivitiesStatus: SensitivitiesStatus;
  activePrescriptions: string[];
  isPregnantOrNursing: boolean;
  pregnancyStatus: PregnancyStatus;
  additionalNotes?: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 3. PRODUCT & SHELF TYPES
// ==========================================

export const ProductCategorySchema = z.enum([
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
export type ProductCategory = z.infer<typeof ProductCategorySchema>;

export const RoutineActionSchema = z.enum(['KEEP', 'PAUSE', 'REPLACE', 'ADD', 'STOP']);
export type RoutineAction = z.infer<typeof RoutineActionSchema>;

export interface Product {
  id: string;
  /** Canonical catalog provenance only; never proof of current merchant package or formula. */
  isCatalogStandard?: boolean;
  brand: string;
  name: string;
  category: ProductCategory;
  keyActives: string[];
  fullIngredients?: string[];
  retailPriceApprox?: number;
  imageUrl?: string;
  cautions?: string[];
}

export interface UserProduct {
  id: string;
  userId: string;
  productId: string;
  product: Product;
  action: RoutineAction;
  actionReason: string;
  frequencyNightsPerWeek?: number;
  isConfirmedByUser: boolean;
}

// ==========================================
// 4. ROUTINE & SCHEDULE TYPES
// ==========================================

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface RoutineStep {
  id: string;
  order: number;
  productId: string;
  productName: string;
  brand: string;
  category: ProductCategory;
  amount: string; // e.g., '1-2 pumps', 'Pea-sized amount'
  area: string; // e.g., 'Entire face avoiding eyelids'
  timing: 'am' | 'pm';
  days: DayOfWeek[]; // Empty array means everyday
  purpose: string;
  whyChosen: string; // Personalized rationale grounded in user's history
  watchFor?: string;
  scheduleText?: string; // e.g. "Monday, Wednesday, Friday" or "Every morning"
}

export function formatRoutineStepSchedule(step: RoutineStep): string {
  if (!step.days || step.days.length === 0 || step.days.length === 7) {
    return step.timing === 'am' ? 'Every morning' : 'Every evening';
  }
  const dayNames: Record<DayOfWeek, string> = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
  };
  return step.days.map((d) => dayNames[d]).join(', ');
}

export function validateCanonicalRoutine(routine: Routine): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Sunscreen invariant: Must NEVER be scheduled in the PM routine
  for (const step of routine.pmSteps) {
    if (step.category === 'sunscreen' || step.productName.toLowerCase().includes('sunscreen') || step.productName.toLowerCase().includes('spf')) {
      errors.push(`Canonical violation: Sunscreen (${step.productName}) cannot be in the PM routine.`);
    }
  }

  // Active retinoid invariant: Should not be in morning routine
  for (const step of routine.amSteps) {
    if (step.productName.toLowerCase().includes('differin') || step.productName.toLowerCase().includes('adapalene') || step.productName.toLowerCase().includes('tretinoin')) {
      errors.push(`Canonical violation: Retinoid (${step.productName}) must not be in the AM routine.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export type RoutineStatus = 'draft' | 'awaiting_review' | 'approved' | 'published';

export interface Routine {
  id: string;
  userId: string;
  version: number;
  status: RoutineStatus;
  summarySentence: string;
  amSteps: RoutineStep[];
  pmSteps: RoutineStep[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  founderNotes?: string;
}

// ==========================================
// 5. CHECK-IN & PROGRESS TYPES
// ==========================================

export const SkinStateSchema = z.enum(['better', 'same', 'worse']);
export type SkinState = z.infer<typeof SkinStateSchema>;

export const IrritationLevelSchema = z.enum(['none', 'little', 'lot']);
export type IrritationLevel = z.infer<typeof IrritationLevelSchema>;

export const AdherenceLevelSchema = z.enum(['yes', 'mostly', 'not_really']);
export type AdherenceLevel = z.infer<typeof AdherenceLevelSchema>;

export const CheckInContextTagSchema = z.enum([
  'diet',
  'sleep',
  'stress',
  'alcohol',
  'cycle',
  'travel_weather',
  'new_product',
  'medication_supplement',
  'routine_change',
  'other',
]);
export type CheckInContextTag = z.infer<typeof CheckInContextTagSchema>;

export const CheckInContextTagLabels: Record<CheckInContextTag, string> = {
  diet: 'Diet',
  sleep: 'Sleep',
  stress: 'Stress',
  alcohol: 'Alcohol',
  cycle: 'Cycle',
  travel_weather: 'Travel / weather',
  new_product: 'New product',
  medication_supplement: 'Medication / supplement',
  routine_change: 'Routine change',
  other: 'Other',
};

export const CHECK_IN_CONTEXT_TAGS = CheckInContextTagSchema.options;

export interface CheckIn {
  id: string;
  userId: string;
  primaryGoal?: Goal;
  goalOutcome?: SkinState;
  skinState: SkinState;
  irritation: IrritationLevel;
  adherence?: AdherenceLevel;
  irritationDetails?: {
    symptoms: ReactionSymptom[];
    bodyArea: BodyArea;
  };
  notes?: string;
  contextTags: CheckInContextTag[];
  contextNote?: string;
  photoUrls?: string[];
  aiAnalysisSentence?: string;
  adjustmentProposed: boolean;
  createdAt: string;
}

export type InsightBasis =
  | 'user_reported'
  | 'photo_observed'
  | 'routine_history'
  | 'founder_reviewed'
  | 'research_derived';

export const InsightBasisLabels: Record<InsightBasis, string> = {
  user_reported: 'From your check-ins',
  routine_history: 'From your routine history',
  photo_observed: 'From your progress photos',
  founder_reviewed: 'Verified by team',
  research_derived: 'From clinical research',
};

export interface LearnedInsight {
  id: string;
  text: string;
  basis: InsightBasis;
  dateObserved: string;
  relatedIngredient?: string;
}

export interface PhotoContextEntry {
  id: string;
  angle: 'front' | 'left' | 'right';
  uri: string;
  capturedAt: string;
  userNote?: string;
}

// ==========================================
// 6. RESEARCH INTELLIGENCE
// ==========================================

export type ResearchActionRecommendation =
  | 'no_change'
  | 'monitor'
  | 'consider_later'
  | 'action';

export interface ResearchSource {
  title: string;
  publicationDate: string;
  journalOrPublisher?: string;
  url?: string;
}

export interface ResearchInsight {
  id: string;
  title: string;
  summary: string;
  whyItMattersToYou?: string;
  recommendation: ResearchActionRecommendation;
  recommendationReason: string;
  source: string;
  evidenceStrength: 'high' | 'moderate' | 'preliminary';
  date: string;
  sources?: ResearchSource[];
}

// ==========================================
// 7. REFILL & ORDER TRACKING TYPES
// ==========================================

export type RefillStatus = 'requested' | 'ordered' | 'shipped' | 'delivered';

export interface RefillRequest {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  brand: string;
  status: RefillStatus;
  requestedAt: string;
  shippedAt?: string;
  deliveredAt?: string;
  estimatedDelivery?: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

// ==========================================
// 8. CHAT & PRODUCT SCAN
// ==========================================

export type ProductScanVerdict =
  | 'great_fit'
  | 'could_work'
  | 'fits_plan'
  | 'not_needed'
  | 'better_replacement'
  | 'use_with_caution'
  | 'not_good_fit';

export const ProductScanVerdictLabels: Record<ProductScanVerdict, string> = {
  great_fit: 'GREAT FIT',
  could_work: 'COULD WORK',
  fits_plan: 'GREAT FIT',
  not_needed: 'NOT NEEDED',
  better_replacement: 'BETTER AS A REPLACEMENT',
  use_with_caution: 'USE WITH CAUTION',
  not_good_fit: 'NOT A GOOD FIT RIGHT NOW',
};

export interface ProductScanResult {
  productName: string;
  brand: string;
  category: ProductCategory;
  keyActives: string[];
  verdict: ProductScanVerdict;
  verdictLabel?: string;
  verdictSummary: string;
  reason?: string;
  whatItWouldChangeOrReplace?: string;
  factsUsedToDecide: string[];
  whyBullets?: string[];
  whyPersonalized?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: 'user' | 'derive';
  text: string;
  directAnswer?: string;
  whyExplanation?: string;
  recommendedAction?: string;
  attachmentUri?: string;
  attachmentType?: 'product' | 'skin';
  timestamp: string;
  isSafetyEscalation?: boolean;
  productScan?: ProductScanResult;
}

// ==========================================
// 9. FOUNDER OPERATIONS
// ==========================================

export interface FounderReviewTask {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  taskType: 'initial_routine' | 'routine_adjustment' | 'refill' | 'safety_flag';
  status: 'pending' | 'in_review' | 'completed' | 'dismissed';
  priority: 'normal' | 'high' | 'urgent';
  createdAt: string;
  notes?: string;
}
