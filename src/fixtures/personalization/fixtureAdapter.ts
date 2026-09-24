import type { SupportedPersonalFit } from '../../presentation/personalization/result.ts';

/** Illustration for component previews and tests only. Never used as a live verdict. */
export const fixturePersonalFit: SupportedPersonalFit = {
  label: 'COULD WORK',
  explanation: 'The known formula facts are compatible with the selected skin context in this sample.',
  evidenceUsed: ['Sample formula evidence', 'Selected skin behavior'],
  uncertainty: 'This is a sample presentation, not an evaluation of your product.',
};
