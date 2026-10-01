import { personalDecisionFixtures } from '../../../fixtures/personal-decision/fixtures.ts';
import { describeDecisionVerdict, type CheckPresentationIntent, type ResultFinding } from './verdict.ts';
import type { CustomerCheckFacts } from '../../personal-decision/customerController.ts';

/** Fictional label/person/routine facts. No source URL, authoritative snapshot or new live evaluation rule. */
interface CategoryExample {
  category: 'Cleanser' | 'Moisturizer' | 'Sunscreen'; name: string; summary: string;
  goal: string; placement: string; categoryFact: string;
  labelEvidence: string; profileEvidence: string; routineEvidence: string; limits: string;
}
const categories: Record<string, CategoryExample> = {
  cleanser: {
    category: 'Cleanser', name: 'Hydrating Cream Cleanser',
    summary: 'You described tight skin after washing and want a cream cleanser. This is a non-foaming cream labeled for dry skin.',
    goal: 'Your goal is less post-wash tightness. The dry-skin label is relevant, but it does not establish how your skin will respond.',
    placement: 'This would replace your evening gel wash. Your moisturizer remains a separate step.',
    categoryFact: 'It is a rinse-off cleanser, so it does not replace a leave-on moisturizer.',
    labelEvidence: 'Fictional package: non-foaming cream cleanser for dry skin. Rinse off after cleansing.',
    profileEvidence: 'Fictional person reports post-wash tightness and prefers a cream cleanser.',
    routineEvidence: 'Fictional routine: gel wash followed by moisturizer each evening. This Check is explicitly about replacement.',
    limits: 'The label does not establish that it will feel gentler or prevent irritation for this person.',
  },
  moisturizer: {
    category: 'Moisturizer', name: 'Comfort Moisturizing Cream',
    summary: 'You want a richer texture when your skin feels dry. This leave-on cream matches that preference.',
    goal: 'Your dryness goal is about comfort after cleansing. The cream texture matches your preference, without proving a hydration result.',
    placement: 'This would occupy the evening moisturizer step after your cleanser. Your morning sunscreen has a different role.',
    categoryFact: 'The package describes a rich cream. That is a texture choice to consider if you also want something lightweight.',
    labelEvidence: 'Fictional package: rich, leave-on moisturizing cream. No individual outcome or tolerability claim.',
    profileEvidence: 'Fictional person reports dry, tight skin and wants a richer evening cream.',
    routineEvidence: 'Fictional complete routine: evening cleanser and morning sunscreen. This Check is about adding an evening moisturizer.',
    limits: 'A stated texture does not establish absorption, pore effects or individual tolerance.',
  },
  sunscreen: {
    category: 'Sunscreen', name: 'Outdoor Swim Sunscreen SPF 50',
    summary: 'You swim outdoors for about an hour. Its label lists broad-spectrum SPF 50 and 80-minute water resistance.',
    goal: 'You want a sun-protection step for outdoor swims. The water-resistance label is relevant to that activity, without guaranteeing protection in use.',
    placement: 'This would replace your morning sunscreen on swim days. It does not replace your moisturizer.',
    categoryFact: 'The label says to reapply after swimming or towel-drying. Water resistance is time-limited, not waterproof.',
    labelEvidence: 'Fictional package: broad-spectrum SPF 50, water resistant for 80 minutes. Directions include reapplication after swimming or towel-drying.',
    profileEvidence: 'Fictional person swims outdoors for roughly one hour and wants a sunscreen for that activity.',
    routineEvidence: 'Fictional routine: morning moisturizer and daily sunscreen. This Check is explicitly about replacement on swim days.',
    limits: 'SPF and water-resistance labels do not establish application amount, actual protection, white cast or tolerance.',
  },
};
export const resultExamples = [
  ['moisturizer', 'Moisturizer'], ['cleanser', 'Cleanser'], ['sunscreen', 'Sunscreen'],
  ['redundancy', 'Adding another moisturizer'], ['replacement', 'Replacing a moisturizer'], ['intent-unknown', 'Intent not provided'],
  ['caution', 'Reported reaction'], ['missing-formula', 'Unknown formula'], ['routine-not-provided', 'Routine not provided'],
  ['long-label', 'Long product label'], ['partial-routine', 'Unknown routine'], ['reformulation', 'Changed formula'],
] as const;
function categoryFindings(example: CategoryExample): ResultFinding[] {
  return [
    { id: 'goal-role', title: 'Your goal', reason: example.goal,
      evidence: [{ label: 'Your preference', detail: example.profileEvidence }, { label: 'Package description', detail: example.labelEvidence }], limits: [example.limits] },
    { id: 'routine-placement', title: 'Your routine', reason: example.placement,
      evidence: [{ label: 'Recorded steps', detail: example.routineEvidence }], limits: ['This placement does not assess combinations or individual tolerance.'] },
    { id: 'category-fact', title: example.category === 'Sunscreen' ? 'Water resistance' : example.category === 'Cleanser' ? 'Rinse-off step' : 'Cream texture', reason: example.categoryFact,
      evidence: [{ label: 'Package description', detail: example.labelEvidence }], limits: [example.limits] },
  ];
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
  if (category && verdict.state === 'good') { verdict.reason = category.summary; verdict.findings = categoryFindings(category); }
  return { facts, verdict };
}
