import { createHash } from 'node:crypto';
import { input as reviewedInput } from '../../tests/fixtures/p0b/policy.ts';
import type { EvaluationInput } from '../../src/domain/personal-decision/evaluate.ts';
import type { SoftJudgmentV0 } from './schema.ts';

export const CORPUS_VERSION = 'decision-intelligence-v0/1';
export interface Case {
  id: string;
  scenario: string;
  provenance: { kind: 'reviewed_p0b_policy_expectation'; source: string; rationale: string };
  expected: SoftJudgmentV0;
  makeInput: () => EvaluationInput;
}
const make = (edit: (value: EvaluationInput) => void = () => {}): EvaluationInput => {
  const value = reviewedInput(); edit(value); value.binding.checkIntent = value.intent; return value;
};
const existing = (value: EvaluationInput) => {
  value.routine!.items = [{ id: 'moisturizer-1', productId: 'existing', variantId: 'existing-variant', formulaVersionId: 'existing-formula',
    category: { state: 'known', value: 'moisturizer', sourceIds: ['routine-label'] },
    ingredients: { state: 'known', value: ['water'], sourceIds: ['routine-label'] },
    state: 'current', timing: 'pm', frequency: 'few_times_weekly' }];
};
const caseOf = (id: string, scenario: string, source: string, rationale: string, expected: SoftJudgmentV0, edit?: (value: EvaluationInput) => void): Case =>
  ({ id, scenario, provenance: { kind: 'reviewed_p0b_policy_expectation', source, rationale }, expected, makeInput: () => make(edit) });

/** Labels are narrow translations of assertions in the cited reviewed tests, not independent human gold. */
export const CORPUS: readonly Case[] = [
  caseOf('supported-role-gap', 'Supported dry-skin moisturizer role, complete empty routine', 'tests/p0b-policy.test.ts: narrow supported dryness role fits',
    'The reviewed rule establishes a supported role with no current item in a complete routine.',
    { routineContribution: 'incremental', overlap: 'none', needsMoreContext: false, abstain: false }),
  caseOf('known-role-redundancy', 'Current sourced moisturizer with same role', 'tests/p0b-policy.test.ts: add redundancy retains goal match',
    'A supported current role match establishes role redundancy, without comparing efficacy.',
    { routineContribution: 'redundant', overlap: 'strong', needsMoreContext: false, abstain: false }, existing),
  caseOf('explicit-replacement', 'Customer explicitly considers replacing sourced current role', 'tests/p0b-policy.test.ts: explicit replace produces candidate',
    'Intent changes the relation to a candidate for comparison; efficacy and tolerance remain unranked.',
    { routineContribution: 'replacement_candidate', overlap: 'strong', needsMoreContext: false, abstain: false }, value => { existing(value); value.intent = 'replace'; }),
  caseOf('partial-routine', 'Partial routine with no established matching role', 'tests/p0b-policy.test.ts: partial routine never implies absence',
    'An incomplete routine cannot establish a gap.',
    { routineContribution: 'unclear', overlap: 'unknown', needsMoreContext: true, abstain: true }, value => { value.routine!.completeness = 'partial'; }),
  caseOf('known-match-partial-routine', 'Known redundancy survives partial routine', 'tests/p0b-policy.test.ts: known role redundancy remains visible with partial routine',
    'The present matched item supports local redundancy; other routine content remains unknown.',
    { routineContribution: 'redundant', overlap: 'strong', needsMoreContext: true, abstain: false }, value => { existing(value); value.routine!.completeness = 'partial'; }),
  caseOf('conflicting-formula', 'Formula evidence conflicts', 'tests/p0b-policy.test.ts: formula conflict blocks role fit and chooses confirm formula',
    'Product truth is insufficient for a positive soft contribution.',
    { routineContribution: 'unclear', overlap: 'unknown', needsMoreContext: true, abstain: true }, value => { value.product.formula = { state: 'conflict', sourceIds: ['label'], reason: 'fixture conflict' }; value.binding.formulaVersionId = null; }),
  caseOf('reported-reaction-no-formula', 'Reported reaction persists without current formula or profile', 'tests/p0b-policy.test.ts: prior reaction survives missing profile and formula',
    'A self report is retained as a caution, while contribution remains unknown; no ingredient diagnosis follows.',
    { routineContribution: 'unclear', overlap: 'unknown', needsMoreContext: true, abstain: true }, value => { value.profile = null; value.binding.profileRevision = null; value.product.formula = { state: 'unknown', reason: 'fixture missing' }; value.binding.formulaVersionId = null; value.history!.events = [{ id: 'reaction-1', productId: 'product', variantId: null, formulaVersionId: null, outcome: 'reaction' }]; }),
];

export function corpusSha256(): string {
  return createHash('sha256').update(JSON.stringify(CORPUS.map(c => ({
    id: c.id, scenario: c.scenario, provenance: c.provenance, expected: c.expected, input: c.makeInput(),
  })))).digest('hex');
}
