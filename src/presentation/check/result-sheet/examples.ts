import { personalDecisionFixtures } from '../../../fixtures/personal-decision/fixtures.ts';
import { describeDecisionVerdict, type CheckPresentationIntent, type ResultFinding } from './verdict.ts';
import type { CustomerCheckFacts } from '../../personal-decision/customerController.ts';

/** Fictional label/person/routine facts. No source URL, authoritative snapshot or new live evaluation rule. */
interface CategoryExample {
  category: 'Cleanser' | 'Moisturizer' | 'Sunscreen'; name: string; summary: string;
  goalTitle: string; goalReason: string; placement: string; texture?: string;
  labelEvidence: string; profileEvidence: string; routineEvidence: string;
}
const categories: Record<string, CategoryExample> = {
  cleanser: {
    category: 'Cleanser', name: 'Hydrating Cream Cleanser',
    summary: 'A cream cleanser for your dry-skin routine.',
    goalTitle: 'For dry skin',
    goalReason: 'Labelled for dry skin. Your current wash leaves your skin feeling tight.',
    placement: 'Replaces your evening gel cleanser.',
    texture: 'Non-foaming cream, your preferred cleanser type.',
    labelEvidence: 'Fictional package excerpt: non-foaming cream cleanser for dry skin. Rinse off after cleansing.',
    profileEvidence: 'Fictional profile answers: dry skin; current wash leaves skin feeling tight; prefers a cream cleanser.',
    routineEvidence: 'Fictional recorded routine: evening gel cleanser, then moisturizer. Check intent: replace the evening gel cleanser.',
  },
  moisturizer: {
    category: 'Moisturizer', name: 'Comfort Moisturizing Cream',
    summary: 'A dry-skin moisturizer for your evening routine.',
    goalTitle: 'For your dryness', goalReason: 'Labelled to moisturize dry skin.',
    placement: 'Adds an evening moisturizer after your cleanser.',
    texture: 'Rich cream, matching your stated preference.',
    labelEvidence: 'Fictional package excerpt: rich, leave-on moisturizer for dry skin.',
    profileEvidence: 'Fictional profile answers: dry skin; explicitly wants a rich texture.',
    routineEvidence: 'Fictional complete routine: evening cleanser and morning sunscreen. Check intent: add an evening moisturizer.',
  },
  sunscreen: {
    category: 'Sunscreen', name: 'Outdoor Swim Sunscreen SPF 50',
    summary: 'SPF 50 with water resistance for outdoor swims.',
    goalTitle: 'Protection', goalReason: 'Broad-spectrum SPF 50.',
    placement: 'Replaces your morning sunscreen on swim days.',
    labelEvidence: 'Fictional package excerpt: broad-spectrum SPF 50. Water resistant for 80 minutes.',
    profileEvidence: 'Fictional profile answers: outdoor swimming for about one hour; wants sunscreen for swimming.',
    routineEvidence: 'Fictional recorded routine: morning moisturizer and sunscreen. Check intent: replace the morning sunscreen on swim days.',
  },
};
const swimDirections = 'Fictional package directions: Apply a generous amount before sun exposure (15 minutes ahead). Reapply once 80 minutes of swimming or sweating have elapsed; reapply immediately after towel drying and at least every two hours.';
export const resultExamples = [
  ['moisturizer', 'Moisturizer'], ['cleanser', 'Cleanser'], ['sunscreen', 'Sunscreen'],
  ['redundancy', 'Adding another moisturizer'], ['replacement', 'Replacing a moisturizer'], ['intent-unknown', 'Intent not provided'],
  ['caution', 'Reported reaction'], ['missing-formula', 'Unknown formula'], ['routine-not-provided', 'Routine not provided'],
  ['long-label', 'Long product label'], ['partial-routine', 'Unknown routine'], ['reformulation', 'Changed formula'],
] as const;
function categoryFindings(example: CategoryExample): ResultFinding[] {
  const label = { label: 'Package label', detail: example.labelEvidence };
  const profile = { label: 'Skin profile', detail: example.profileEvidence };
  const routine = { id: 'routine-placement', title: 'In your routine', reason: example.placement,
    evidence: [{ label: 'Recorded steps', detail: example.routineEvidence }], limits: [] };
  const goal = { id: 'category-goal', title: example.goalTitle, reason: example.goalReason,
    evidence: [label, profile], limits: [] };
  if (example.category === 'Sunscreen') return [goal,
    { id: 'swimming', title: 'For swimming',
      reason: 'Water resistant for 80 minutes. Reapply after swimming or towel drying, following the label.',
      evidence: [label, profile, { label: 'Package directions', detail: swimDirections }],
      limits: ['Swimming/sweating: reapply at 80 minutes. Towel drying: reapply immediately. Also reapply at least every 2 hours. Not waterproof.'] },
    routine];
  return [goal, routine,
    { id: 'texture', title: 'Texture', reason: example.texture!, evidence: [label, profile], limits: [] }];
}
/** Only the guarded development route consumes these authored examples. Live presentation remains narrow and bound. */
export function describeResultExample(id: string) {
  const routineScenario = ['redundancy', 'replacement', 'intent-unknown'].includes(id);
  const base = personalDecisionFixtures.find(item => item.id === (routineScenario ? 'redundancy' : id)) ?? personalDecisionFixtures[0];
  const fixture: typeof base = JSON.parse(JSON.stringify(base));
  let intent: CheckPresentationIntent | undefined = id === 'redundancy' ? 'add' : id === 'replacement' ? 'replace' : undefined;
  const category = categories[id];
  if (category) {
    intent = id === 'moisturizer' ? 'add' : 'replace';
    const match = fixture.packet.findings.find(f => f.display?.kind === 'role_match');
    if (match?.display?.kind === 'role_match') { match.display.category = category.category.toLowerCase(); match.display.goal = id === 'sunscreen' ? 'maintain' : 'dryness'; }
  }
  if (id === 'routine-not-provided') {
    fixture.binding.routineRevision = null; fixture.packet.binding.routineRevision = null;
    fixture.packet.findings.push({ id: 'routine-unknown', kind: 'missing_evidence', applicability: 'uncertain', severity: 'informational', confidence: 'unknown', ruleId: 'fixture:routine-unknown', ruleVersion: '1', evidence: [], uncertainty: ['Routine placement and overlap are unknown. Missing routine information does not mean no routine.'], evidenceNeedIds: ['routine-unknown'], display: { kind: 'evidence_gap', code: 'routine_completeness', evidenceIndexes: [] } });
    fixture.packet.evidenceNeeds.push({ id: 'routine-unknown', code: 'routine_completeness', critical: false, state: 'unknown', findingIds: ['routine-unknown'] });
  }
  const facts: CustomerCheckFacts = { brand: 'Example', name: category?.name ?? (id === 'long-label' ? 'Daily moisturizing lotion for face and body in a family-size pump bottle' : 'Daily Moisturizer'),
    categoryLabel: category?.category ?? 'Moisturizer', formula: null, source: null };
  const verdict = describeDecisionVerdict(fixture.packet, fixture.binding, { intent });
  if (category && verdict.state === 'good') {
    verdict.reason = category.summary; verdict.findings = categoryFindings(category);
  }
  return { facts, verdict };
}
