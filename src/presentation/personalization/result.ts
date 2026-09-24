export interface SupportedPersonalFit {
  label: 'GREAT FIT' | 'COULD WORK' | 'NOT NEEDED' | 'BETTER AS A REPLACEMENT'
    | 'USE WITH CAUTION' | 'NOT A GOOD FIT RIGHT NOW';
  explanation: string;
  evidenceUsed: string[];
  uncertainty: string | null;
}

export type PersonalFitRefreshInput =
  | { kind: 'factual_only' | 'loading' | 'insufficient' }
  | { kind: 'unavailable'; reason?: 'answers_not_saved' | 'client_session_ready' }
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
    kind: 'unavailable', title: 'Personal Fit unavailable',
    message: input.reason === 'answers_not_saved'
      ? 'Your answers were not saved. Product facts remain available.'
      : input.reason === 'client_session_ready'
        ? 'Your answers are ready for this session. A supported product fit is unavailable.'
        : 'A supported product fit is unavailable. Product facts remain available.',
    fit: null,
  };
  if (input.kind === 'insufficient' || input.kind === 'supported') return {
    kind: 'insufficient', title: 'Not enough to say yet', message: 'We need more reliable product details to assess your fit.', fit: null,
  };
  return {
    kind: 'factual_only', title: 'Not personalized yet', message: 'Optional: add your skin preferences.', fit: null,
  };
}
