/** Explicit consented private text explanation, never canonical fit or a numeric score. */
export interface IngredientExplanationRequest {
  productName: string;
  ingredientsText: string;
  category: 'skincare' | 'other_personal_care';
  contextSharingConsent: true;
}
export type IngredientExplanationResult = {
  status: 'answer'; sentences: string[]; model: string; retrievedAt: string;
  contextVersion: string; basis: 'ai_guidance'; formulaVerified: false;
} | {
  status: 'configuration_required' | 'personalization_disabled' | 'profile_missing'
    | 'context_unavailable' | 'context_changed' | 'rate_limited' | 'unavailable' | 'no_answer';
};
