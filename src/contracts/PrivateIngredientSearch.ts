/** Ephemeral original Google-grounded display; never canonical formula or decision-engine input. */
export interface PrivateIngredientQuery {
  barcode: string;
  name: string;
  brand: string | null;
  size: string | null;
}

/** Explicit one-shot permission; the server, never client input, supplies saved cosmetic context. */
export type PrivateIngredientRequest = PrivateIngredientQuery & {
  personalization?: 'basic_skin_context';
  contextSharingConsent?: true;
};

export interface PrivateGroundedAnswer {
  status: 'grounded_answer';
  query: PrivateIngredientQuery;
  text: string;
  searchSuggestionsHtml: string;
  sources: { title: string; url: string }[];
  retrievedAt: string;
  formulaVerified: false;
  canonicalProductId: null;
  answerKind?: 'published_ingredients' | 'contextual_web_guidance';
  /** Opaque snapshot fingerprint, not a profile ID or serialized personal context. */
  contextVersion?: string;
}

export type PrivateIngredientSearch = PrivateGroundedAnswer | {
  status: 'configuration_required' | 'rate_limited' | 'unavailable' | 'no_grounded_answer'
    | 'personalization_disabled' | 'profile_missing' | 'context_unavailable' | 'context_changed';
};
