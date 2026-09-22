/**
 * Derive Domain Types
 * 
 * Canonical data contracts shared across the mobile application (Kanuj)
 * and the backend / intelligence platform (Sami).
 * 
 * Rule: Changes to this file impact both founders and require mutual review.
 */

import type {
  Goal,
  RoutineComplexity,
  ProductCostPreference,
  MiddayFeel,
  PostCleanseFeel,
  ReactionSeverity,
  IngredientSignalConfidence,
  AllergySource,
  BodyArea,
  ReactionSymptom,
  ProductReaction,
  FormulaSnapshot,
  IngredientSignal,
  SkinProfile,
  PregnancyStatus,
  SensitivitiesStatus,
  ProductCategory,
  RoutineAction,
  Product,
  UserProduct,
  DayOfWeek,
  RoutineStep,
  RoutineStatus,
  Routine,
  SkinState,
  IrritationLevel,
  AdherenceLevel,
  CheckInContextTag,
  CheckIn,
  InsightBasis,
  LearnedInsight,
  PhotoContextEntry,
  ResearchActionRecommendation,
  ResearchSource,
  ResearchInsight,
  RefillStatus,
  RefillRequest,
  ProductScanVerdict,
  ProductScanResult,
  ChatMessage,
  FounderReviewTask,
} from '../types/schema.ts';

// Re-export existing core types
export type {
  Goal,
  RoutineComplexity,
  ProductCostPreference,
  MiddayFeel,
  PostCleanseFeel,
  ReactionSeverity,
  IngredientSignalConfidence,
  AllergySource,
  BodyArea,
  ReactionSymptom,
  ProductReaction,
  FormulaSnapshot,
  IngredientSignal,
  SkinProfile,
  PregnancyStatus,
  SensitivitiesStatus,
  ProductCategory,
  RoutineAction,
  Product,
  UserProduct,
  DayOfWeek,
  RoutineStep,
  RoutineStatus,
  Routine,
  SkinState,
  IrritationLevel,
  AdherenceLevel,
  CheckInContextTag,
  CheckIn,
  InsightBasis,
  LearnedInsight,
  PhotoContextEntry,
  ResearchActionRecommendation,
  ResearchSource,
  ResearchInsight,
  RefillStatus,
  RefillRequest,
  ProductScanVerdict,
  ProductScanResult,
  ChatMessage,
  FounderReviewTask,
};

// ==========================================
// 1. CUSTOMER & MEMBERSHIP
// ==========================================

/** Price-neutral V1 membership identity. Do not encode 25 / $25 / 129 in this value. */
export type MembershipTier = 'founding_beta';

export function membershipDisplayLabel(tier: MembershipTier): string {
  switch (tier) {
    case 'founding_beta':
      return 'Founding Beta';
  }
}

export interface CustomerProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  tier: MembershipTier;
  membershipStatus: 'active' | 'paused' | 'cancelled';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerBootstrapState {
  userId: string;
  profileExists: boolean;
  onboardingCompleted: boolean;
  membershipStatus: 'active' | 'paused' | 'cancelled' | 'none';
}

/** Short-lived HTTPS destination returned by the trusted membership billing API. */
export interface HostedMembershipSession {
  url: string;
}

// Canonical aliases for clarity across workstreams
export type RoutinePlan = Routine;
export type RoutineItem = RoutineStep;
export type OrderStatus = RefillStatus;
export type ProgressInsight = LearnedInsight;
export type PhotoRecord = PhotoContextEntry;

export interface RoutineSchedule {
  timing: 'am' | 'pm';
  days: DayOfWeek[];
  formattedSchedule: string;
}

export interface RoutineVersion {
  versionNumber: number;
  routineId: string;
  createdAt: string;
  publishedAt?: string;
  summarySentence: string;
  amSteps: RoutineStep[];
  pmSteps: RoutineStep[];
  founderNotes?: string;
}

// ==========================================
// 2. CONVERSATION & INTELLIGENCE
// ==========================================

export interface SafetyClassification {
  isMedicalEmergency: boolean;
  severity: 'safe' | 'warning' | 'emergency';
  message?: string;
  matchedKeywords?: string[];
  recommendedAction?: 'continue' | 'caution_barrier' | 'immediate_medical_care';
}

export interface AskRequest {
  userId: string;
  question: string;
  activeContext?: {
    scannedProduct?: ProductScanResult;
    currentStepId?: string;
    photoAttachmentUri?: string;
  };
}

export interface AskResponse {
  answer: string;
  directAnswer: string;
  whyExplanation: string;
  recommendedAction?: string;
  safety: SafetyClassification;
  suggestedFollowUps?: string[];
  referencedProducts?: string[];
}

// ==========================================
// 3. CHECK-IN & PROGRESS
// ==========================================

export interface CheckInInput {
  userId: string;
  primaryGoal?: Goal;
  skinState: SkinState;
  irritation: IrritationLevel;
  adherence?: AdherenceLevel;
  notes?: string;
  contextTags?: CheckInContextTag[];
  contextNote?: string;
  photoUris?: string[];
  irritationDetails?: {
    symptoms: ReactionSymptom[];
    bodyArea: BodyArea;
  };
}

export interface CheckInResult {
  checkIn: CheckIn;
  aiAnalysisSentence: string;
  adjustmentProposed: boolean;
  proposedAdjustmentSummary?: string;
}

export interface ProgressData {
  checkIns: CheckIn[];
  learnedInsights: LearnedInsight[];
  recentPhotos: PhotoContextEntry[];
  routineHistorySummary: string;
  isCheckInDue: boolean;
}

// ==========================================
// 4. ONBOARDING PAYLOAD & RESULT
// ==========================================

export type InitialRoutineState = 'pending_generation' | 'awaiting_review';

export interface OnboardingPayload {
  userId?: string;
  primaryGoal: Goal;
  secondaryGoals: Goal[];
  routineComplexity: RoutineComplexity;
  costPreference: ProductCostPreference;
  middayFeel: MiddayFeel;
  postCleanseTightness: boolean;
  confirmedProducts: Product[];
  productReactions: ProductReaction[];
  formulaSnapshots?: FormulaSnapshot[];
  adaptiveFollowUps?: Array<{ question: string; answer?: string }>;
  pihTendencyAnswer?: 'Rarely' | 'Sometimes' | 'Often' | 'Not sure' | null;
  hasBadReactions?: boolean | null;
  skinPhotos: {
    frontUri?: string;
    leftUri?: string;
    rightUri?: string;
    shelfUri?: string;
    contextNote?: string;
  };
  safetyContext: {
    knownSensitivities: string[];
    sensitivitiesStatus: SensitivitiesStatus;
    activePrescriptions: string[];
    isPregnantOrNursing: boolean;
    pregnancyStatus: PregnancyStatus;
    additionalNotes?: string;
  };
}

export interface OnboardingResult {
  userId: string;
  skinProfile: SkinProfile;
  proposedRoutine: Routine | null;
  userProducts: UserProduct[];
  initialRoutineState: InitialRoutineState;
}

export interface RoutineProposalInput {
  profile: {
    primaryGoal: Goal;
    secondaryGoals?: Goal[];
    routineComplexity: RoutineComplexity;
    costPreference?: ProductCostPreference;
    middayFeel?: MiddayFeel;
    postCleanseTightness?: boolean;
    activePrescriptions?: string[];
    isPregnantOrNursing?: boolean;
  };
  shelfProducts: Product[];
  reactions?: ProductReaction[];
}

export interface RoutineProposalResult {
  routine: Routine;
  userProducts: UserProduct[];
  clarificationQuestions?: string[];
}

export interface ScanProductInput {
  productName: string;
  brand?: string;
  imageUri?: string;
  barcode?: string;
  /** Optional S6 case whose verified identity overrides caller-supplied labels. */
  resolutionCaseId?: string;
  userRoutineContext?: {
    activeDifferinSchedule?: boolean;
    currentRoutineProducts?: string[];
    recentReactions?: ProductReaction[];
  };
}

export interface RefillRequestInput {
  userId: string;
  productId: string;
  productName: string;
  brand: string;
  note?: string;
}
