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

export interface CustomerProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  tier: 'founding_beta_129';
  membershipStatus: 'active' | 'paused' | 'cancelled';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
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
  skinPhotos: {
    frontUri?: string;
    leftUri?: string;
    rightUri?: string;
    contextNote?: string;
  };
  safetyContext: {
    knownSensitivities: string[];
    activePrescriptions: string[];
    isPregnantOrNursing: boolean;
    additionalNotes?: string;
  };
}

export interface OnboardingResult {
  userId: string;
  skinProfile: SkinProfile;
  proposedRoutine: Routine;
  userProducts: UserProduct[];
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
