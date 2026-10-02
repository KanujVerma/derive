import type { PersonalContextSnapshot } from '../../contracts/PersonalContext.ts';
import { ENGINE_VERSION, POLICY_VERSION } from '../../domain/personal-decision/evaluate.ts';

export type ProfileField = 'primary_goal' | 'secondary_goals' | 'skin_feel' | 'reactivity'
  | 'current_products' | 'past_product_problems' | 'optional_note';
export interface ProfileFieldSupport {
  field: ProfileField;
  persistence: 'saved' | 'not_saved' | 'unavailable';
  answer: 'provided' | 'unanswered' | 'unsure' | 'withheld' | 'unavailable';
  /** Describes current engine capability, not a claim that this Check used the field. */
  decisionUse: 'bounded_goal_rule' | 'bounded_skin_rule' | 'bounded_reactivity_rule'
    | 'verified_routine_facts_only' | 'catalog_reports_only' | 'not_used';
  limitations: string[];
}
export interface ProfileSupportSummary {
  version: 'profile-field-support/v1';
  engineVersion: string;
  policyVersion: string;
  fields: ProfileFieldSupport[];
}

const FIELDS: ProfileField[] = ['primary_goal', 'secondary_goals', 'skin_feel', 'reactivity',
  'current_products', 'past_product_problems', 'optional_note'];
const answer = (value: string | null | undefined): ProfileFieldSupport['answer'] =>
  value === 'withheld' ? 'withheld' : value === 'unsure' ? 'unsure'
    : value === 'unanswered' || value == null ? 'unanswered' : 'provided';

/**
 * Owner-bound support metadata for the composition owner. No answers, notes,
 * product names, owner IDs or inference leave this projection. The actual
 * decision packet remains the only authority for which findings were used.
 * Combined setup fixture answers are not accepted here as persisted context.
 */
export function describeProfileFieldSupport(ownerId: string | null,
  context: PersonalContextSnapshot | null): ProfileSupportSummary {
  const result = (fields: ProfileFieldSupport[]): ProfileSupportSummary => ({
    version: 'profile-field-support/v1', engineVersion: ENGINE_VERSION, policyVersion: POLICY_VERSION, fields,
  });
  if (!ownerId || !context || context.ownerId !== ownerId
    || context.profile && context.profile.ownerId !== ownerId
    || context.routine && context.routine.ownerId !== ownerId
    || context.experiences.some(row => row.ownerId !== ownerId)) {
    return result(FIELDS.map(field => ({ field, persistence: 'unavailable', answer: 'unavailable',
      decisionUse: 'not_used', limitations: ['Owner-bound saved context is unavailable.'] })));
  }
  const profile = context.profile?.data;
  const profilePersistence = context.profile ? 'saved' as const : 'not_saved' as const;
  return result([
    { field: 'primary_goal', persistence: profilePersistence, answer: answer(profile?.primaryGoal),
      decisionUse: profile ? 'bounded_goal_rule' : 'not_used',
      limitations: ['Only the dryness moisturizer role has a supported positive goal rule.',
        'The primary goal is retained and a different primary goal prevents a positive dryness-only conclusion.'] },
    { field: 'secondary_goals', persistence: profilePersistence,
      answer: profile?.secondaryGoals.length ? 'provided' : 'unanswered',
      decisionUse: profile ? 'bounded_goal_rule' : 'not_used',
      limitations: ['Secondary dryness can produce a supporting role finding, not override the primary goal.',
        'Other secondary goals do not currently have positive efficacy rules.'] },
    { field: 'skin_feel', persistence: profilePersistence, answer: answer(profile?.skinBehavior),
      decisionUse: profile ? 'bounded_skin_rule' : 'not_used',
      limitations: ['Dry or tight skin is used in the dryness moisturizer rule.',
        'Other skin-feel answers are saved but do not establish positive ingredient suitability.'] },
    { field: 'reactivity', persistence: profilePersistence, answer: answer(profile?.reactivity),
      decisionUse: profile ? 'bounded_reactivity_rule' : 'not_used',
      limitations: ['Easy reactivity can produce a caution for a verified active ingredient.',
        'Unknown, unsure and withheld answers are not interpreted as generally tolerant skin.'] },
    { field: 'current_products', persistence: context.routine ? 'saved' : 'not_saved',
      answer: context.routine ? context.routine.data.items.length || context.routine.data.completeness === 'complete'
        ? 'provided' : 'unanswered' : 'unanswered',
      decisionUse: context.routine ? 'verified_routine_facts_only' : 'not_used',
      limitations: ['Dedicated routine-editor saves are used for role and verified formula overlap.',
        'Manual names do not establish a product category or formula.',
        'Supported combined setup products and feedback are saved through the same routine and report APIs.',
        'Incomplete routine data is not treated as an empty routine.'] },
    { field: 'past_product_problems', persistence: context.historyRevision ? 'saved' : 'not_saved',
      answer: context.experiences.length ? 'provided' : 'unanswered',
      decisionUse: context.historyRevision ? 'catalog_reports_only' : 'not_used',
      limitations: ['Dedicated experience-editor saves retain reaction and ineffective reports.',
        'Only catalog-bound reports are used in product and routine findings.',
        'Symptoms and note text are saved but are not interpreted by the decision rules.',
        'A product reaction does not establish an ingredient allergy.',
        'Supported combined setup problems are saved as self-reported experiences.'] },
    { field: 'optional_note', persistence: 'not_saved', answer: 'unanswered', decisionUse: 'not_used',
      limitations: ['The optional note has no profile storage field and is not collected by live setup.',
        'It is not saved or used in a Check. Separate experience notes remain reports, not inferred facts.'] },
  ]);
}
