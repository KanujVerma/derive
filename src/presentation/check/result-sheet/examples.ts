import { personalDecisionFixtures } from '../../../fixtures/personal-decision/fixtures.ts';
import { describeDecisionVerdict, type CheckPresentationIntent, type ResultFinding } from './verdict.ts';
import type { CustomerCheckFacts } from '../../personal-decision/customerController.ts';

/** Fictional label/person/routine facts. No source URL, authoritative snapshot or new live evaluation rule. */
interface CategoryExample {
  category: 'Cleanser' | 'Moisturizer' | 'Sunscreen'; name: string; summary: string;
  placement: string; categoryFact?: string;
  labelEvidence: string; profileEvidence: string; routineEvidence: string; limits: string;
}
const categories: Record<string, CategoryExample> = {
  cleanser: {
    category: 'Cleanser', name: 'Hydrating Cream Cleanser',
    summary: 'Non-foaming cream · Your preferred cleanser type',
    placement: 'Evening · Replaces your gel wash',
    labelEvidence: 'Fictional package: non-foaming cream cleanser for dry skin. Rinse off after cleansing.',
    profileEvidence: 'Fictional preference: cream cleanser. Reported experience: tight skin after washing.',
    routineEvidence: 'Fictional routine: evening gel wash, then moisturizer. Intent: replace the gel wash.',
    limits: 'The label does not establish whether this cleanser will feel gentler or irritate your skin.',
  },
  moisturizer: {
    category: 'Moisturizer', name: 'Comfort Moisturizing Cream',
    summary: 'Rich cream · Your preferred texture',
    placement: 'Evening, after cleanser',
    labelEvidence: 'Fictional package: rich, leave-on moisturizing cream.',
    profileEvidence: 'Fictional preference: richer evening cream. Reported experience: dry, tight skin.',
    routineEvidence: 'Fictional complete routine: evening cleanser and morning sunscreen. Intent: add an evening moisturizer.',
    limits: 'The label describes texture; it does not establish hydration, absorption, pore effects or how your skin will tolerate this cream.',
  },
  sunscreen: {
    category: 'Sunscreen', name: 'Outdoor Swim Sunscreen SPF 50',
    summary: 'Broad-spectrum SPF 50 · Water resistant for 80 minutes',
    placement: 'Swim days · Replaces your morning sunscreen',
    categoryFact: 'Reapply after swimming or towel-drying. Water resistant, not waterproof.',
    labelEvidence: 'Fictional package: broad-spectrum SPF 50, water resistant for 80 minutes. Directions include reapplication after swimming or towel-drying.',
    profileEvidence: 'Fictional activity: outdoor swims of about one hour. Preference: sunscreen for swimming.',
    routineEvidence: 'Fictional routine: morning moisturizer and daily sunscreen. Intent: replace sunscreen on swim days.',
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
    { id: 'routine-placement', title: 'In your routine', reason: example.placement,
      evidence: [{ label: 'Recorded steps', detail: example.routineEvidence }], limits: [] },
    ...(example.categoryFact ? [{ id: 'category-fact', title: 'Water resistance', reason: example.categoryFact,
      evidence: [{ label: 'Package directions', detail: example.labelEvidence }], limits: [] }] : []),
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
  if (category && verdict.state === 'good') {
    verdict.reason = category.summary; verdict.findings = categoryFindings(category);
    verdict.summaryFinding = { id: 'category-summary', title: 'Personal fit', reason: category.summary,
      evidence: [{ label: 'Package description', detail: category.labelEvidence }, { label: 'Your preference', detail: category.profileEvidence }], limits: [category.limits] };
  }
  return { facts, verdict };
}
