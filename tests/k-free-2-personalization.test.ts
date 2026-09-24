import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  createPersonalizationDraft,
  toggleGoal,
  completePersonalization,
  nextPersonalizationStep,
  toggleTreatment,
} from '../src/presentation/personalization/draft.ts';
import { describePersonalFitRefresh } from '../src/presentation/personalization/result.ts';
import { fixturePersonalFit } from '../src/fixtures/personalization/fixtureAdapter.ts';

test('K-FREE-2: goals have a three-choice maximum and can be deselected', () => {
  let draft = createPersonalizationDraft();
  for (const goal of ['breakouts', 'dark_marks', 'dryness_barrier'] as const) draft = toggleGoal(draft, goal);
  assert.equal(toggleGoal(draft, 'redness_sensitivity').goals.length, 3);
  assert.deepEqual(toggleGoal(draft, 'dark_marks').goals, ['breakouts', 'dryness_barrier']);
});

test('K-FREE-2: skipped questions remain unknown in completion output', () => {
  const draft = createPersonalizationDraft();
  assert.equal(nextPersonalizationStep('goals'), 'behavior');
  assert.equal(nextPersonalizationStep('behavior'), 'context');
  assert.equal(nextPersonalizationStep('context'), 'complete');
  assert.deepEqual(completePersonalization(draft), {
    goals: [], skinBehavior: null, reactivity: null, treatments: [],
    sensitivityOrAllergy: null, pregnancy: 'prefer_not_to_say',
  });
});

test('K-FREE-2: editing starts from a copy and treatment choices toggle without affecting the source', () => {
  const original = { ...createPersonalizationDraft(), goals: ['texture'] as const, treatments: ['retinoids'] as const };
  const editing = createPersonalizationDraft({ ...original, goals: [...original.goals], treatments: [...original.treatments] });
  const changed = toggleTreatment(editing, 'retinoids');
  assert.deepEqual(changed.treatments, []);
  assert.deepEqual(original.treatments, ['retinoids']);
});

test('K-FREE-2: result stays factual until a supported fit is supplied', () => {
  assert.equal(describePersonalFitRefresh({ kind: 'factual_only' }).kind, 'factual_only');
  assert.equal(describePersonalFitRefresh({ kind: 'loading' }).kind, 'loading');
  assert.equal(describePersonalFitRefresh({ kind: 'insufficient' }).kind, 'insufficient');
  assert.equal(describePersonalFitRefresh({ kind: 'unavailable' }).kind, 'unavailable');
  assert.equal(describePersonalFitRefresh({ kind: 'supported', fit: fixturePersonalFit }).kind, 'supported');
  assert.equal(describePersonalFitRefresh({ kind: 'supported', fit: null }).kind, 'insufficient');
});

test('K-FREE-2: customer flow exposes optional navigation and no managed or remote path', () => {
  const flow = readFileSync(new URL('../src/components/personalization/PersonalizationFlow.tsx', import.meta.url), 'utf8');
  const result = readFileSync(new URL('../src/components/personalization/PersonalFitSection.tsx', import.meta.url), 'utf8');
  assert.match(flow, /onComplete/);
  assert.match(flow, /onSkip/);
  assert.match(flow, /onRemindLater/);
  assert.match(flow, /Back/);
  assert.match(flow, /Skip this step/);
  assert.match(flow, /Step .* of 3/);
  assert.match(result, /FORMULA DETAILS/);
  assert.match(result, /PERSONAL FIT/);
  assert.doesNotMatch(flow + result, /deriveClient|evaluateProduct|supabase|AsyncStorage|membership|managed|fixturePersonalFit/);
});
