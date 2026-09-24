export interface SupportedPersonalFit {
  label: string;
  explanation: string;
  evidenceUsed: string[];
  uncertainty: string | null;
}

export type PersonalFitRefreshInput =
  | { kind: 'factual_only' | 'loading' | 'insufficient' | 'unavailable' }
  | { kind: 'supported'; fit: SupportedPersonalFit | null };

export type PersonalFitRefreshView = {
  kind: 'factual_only' | 'loading' | 'supported' | 'insufficient' | 'unavailable';
  title: string;
  message: string;
  fit: SupportedPersonalFit | null;
};

/** Describes only the supplied fit response; it never evaluates a product. */
export function describePersonalFitRefresh(input: PersonalFitRefreshInput): PersonalFitRefreshView {
  if (input.kind === 'supported' && input.fit) return {
    kind: 'supported', title: input.fit.label, message: input.fit.explanation, fit: input.fit,
  };
  if (input.kind === 'loading') return {
    kind: 'loading', title: 'Checking your fit', message: 'Your product details are still here.', fit: null,
  };
  if (input.kind === 'unavailable') return {
    kind: 'unavailable', title: 'Personal Fit unavailable', message: 'You can still use the product facts below.', fit: null,
  };
  if (input.kind === 'insufficient' || input.kind === 'supported') return {
    kind: 'insufficient', title: 'Not enough to say yet', message: 'We need more reliable product details to assess your fit.', fit: null,
  };
  return {
    kind: 'factual_only', title: 'Personal Fit', message: 'Want to know if this fits you? Personalize Derive in about 45 seconds.', fit: null,
  };
}
