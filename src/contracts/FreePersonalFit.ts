import type { Goal, MiddayFeel, PregnancyStatus, SensitivitiesStatus } from '../types/schema.ts';

/** Optional free Check context. This is not the managed-care intake. */
export interface FreeSkinProfile {
  goals: Goal[];
  skinBehavior: MiddayFeel;
  reactivity: 'reacts_easily' | 'generally_tolerates' | 'unsure';
  pregnancyStatus: PregnancyStatus;
  sensitivitiesStatus: SensitivitiesStatus;
  knownSensitivities: string[];
  treatmentStatus: 'none' | 'reported' | 'unanswered';
  currentTreatments: Array<'topical_retinoid' | 'benzoyl_peroxide' | 'exfoliating_acid' | 'other_prescription'>;
  updatedAt: string;
}

export type FreeSkinProfileInput = Omit<FreeSkinProfile, 'updatedAt'>;

/** All operations require a verified Supabase Auth JWT, including guests. */
export type FreePersonalFitRequest =
  | { operation: 'get_profile' }
  | { operation: 'save_profile'; profile: FreeSkinProfileInput }
  | { operation: 'fit'; productId: string; variantId?: string };

export type PersonalFitLabel = 'COULD_WORK' | 'USE_WITH_CAUTION' | 'NOT_ENOUGH_INFORMATION';
export type PersonalFitReason =
  | 'profile_missing' | 'formula_unverified' | 'profile_context_missing'
  | 'reported_ingredient_sensitivity' | 'retinoid_pregnancy_context' | 'multiple_cautions'
  | 'active_overlap' | 'reactive_active' | 'sensitivity_unresolved'
  | 'goal_role_match' | 'no_supported_fit_rule' | 'prior_product_reaction';

export interface PersonalFitResult {
  productId: string;
  variantId: string | null;
  formulaVersionId: string | null;
  label: PersonalFitLabel;
  reason: PersonalFitReason;
  explanation: string;
  evidenceUsed: string[];
  missingEvidence: string[];
  /** Public, query-free HTTPS links only; never internal catalog provenance. */
  sources: string[];
}
