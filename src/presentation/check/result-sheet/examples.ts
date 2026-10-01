import { personalDecisionFixtures } from '../../../fixtures/personal-decision/fixtures.ts';
import { describeDecisionVerdict } from './verdict.ts';
import type { CustomerCheckFacts } from '../../personal-decision/customerController.ts';

/** Development-only semantic examples. Never create immutable truth or a live decision from these. */
export const resultExamples = [
  ['positive-role-match', 'New product'], ['redundancy', 'Same routine role'], ['caution', 'Reported reaction'],
  ['missing-formula', 'Unknown formula'], ['routine-not-provided', 'Routine not provided'], ['long-label', 'Long product label'], ['partial-routine', 'Unknown routine'], ['reformulation', 'Changed formula'],
] as const;
export function describeResultExample(id: string) {
  const base = personalDecisionFixtures.find(item => item.id === id) ?? personalDecisionFixtures[0];
  const fixture: typeof base = JSON.parse(JSON.stringify(base));
  if (id === 'routine-not-provided') {
    fixture.binding.routineRevision = null; fixture.packet.binding.routineRevision = null;
    fixture.packet.findings.push({ id: 'routine-unknown', kind: 'missing_evidence', applicability: 'uncertain', severity: 'informational', confidence: 'unknown', ruleId: 'fixture:routine-unknown', ruleVersion: '1', evidence: [], uncertainty: ['Routine placement and overlap are unknown. Missing routine information does not mean no routine.'], evidenceNeedIds: ['routine-unknown'], display: { kind: 'evidence_gap', code: 'routine_completeness', evidenceIndexes: [] } });
    fixture.packet.evidenceNeeds.push({ id: 'routine-unknown', code: 'routine_completeness', critical: false, state: 'unknown', findingIds: ['routine-unknown'] });
  }
  const facts: CustomerCheckFacts = { brand: 'DEVELOPMENT EXAMPLE', name: id === 'long-label' ? 'Example daily moisturizing lotion for face and body in a family-size pump bottle' : 'Example daily moisturizer',
    categoryLabel: 'Moisturizer', formula: null, source: null };
  return { facts, verdict: describeDecisionVerdict(fixture.packet, fixture.binding) };
}
