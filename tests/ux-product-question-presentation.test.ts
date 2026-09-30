import assert from 'node:assert/strict';
import test from 'node:test';
import { createContextDraft, type ContextDraft } from '../src/presentation/p0b-personalization/draft.ts';
import { componentHarness, control, press } from './ux-profile-render.ts';

const file = 'src/components/p0b-personalization/ContextFlow.tsx';
test('fresh profile asks skin feel and irritation on step 2 for any goal', () => {
  let saved: ContextDraft | undefined;
  const flow = componentHarness(file, 'ContextFlow', { collectIntent: false, completionLabel: 'Done', onApply(value: ContextDraft) { saved = value; }, onSkip() {} });
  let nodes = flow.render();
  assert.ok(!nodes.some(node => node.props.label === 'What are you deciding?'));
  press(control(nodes, 'Maintain my skin'));
  press(control(flow.render(), 'Continue'));
  nodes = flow.render();
  const feel = nodes.find(node => node.props.label === 'How does your skin usually feel?');
  const irritation = nodes.find(node => node.props.label === 'When you try a new skincare product, does your skin get irritated easily?');
  assert.ok(feel);
  assert.equal(feel?.props.support, undefined);
  assert.ok(irritation);
  assert.equal(irritation?.props.support, 'Think stinging, burning, redness, or peeling.');
  for (const label of ['Dry or tight', 'Neither dry nor oily', 'Oily in some areas, dry in others', 'Oily', 'Yes, often', 'Usually not']) assert.ok(control(nodes, label));
  const unsure = nodes.filter(node => node.props.label === 'Not sure');
  assert.equal(unsure.length, 2);
  press(unsure[0]);
  press(unsure[1]);
  press(control(flow.render(), 'Done'));
  assert.deepEqual(saved?.behavior, { state: 'answered', value: 'unsure' });
  assert.deepEqual(saved?.reactivity, { state: 'answered', value: 'unsure' });
});

test('editing preserves hidden intent and treatment answers and keeps an existing skin-feel answer discoverable', () => {
  const draft = createContextDraft();
  draft.intent = { state: 'answered', value: 'replace' };
  draft.behavior = { state: 'answered', value: 'oily' };
  draft.treatments = { state: 'answered', value: ['benzoyl_peroxide'] };
  draft.primaryGoal = { state: 'answered', value: 'dryness' };
  let saved: ContextDraft | undefined;
  const flow = componentHarness(file, 'ContextFlow', { initialDraft: draft, collectIntent: false, onApply(value: ContextDraft) { saved = value; }, onSkip() {} });
  let nodes = flow.render();
  assert.ok(nodes.some(node => node.props.label === 'How does your skin usually feel?'));
  assert.ok(!nodes.some(node => node.props.label === 'Treatments you use'));
  press(control(nodes, 'Maintain my skin'));
  nodes = flow.render();
  assert.equal(control(nodes, 'Maintain my skin').props.accessibilityState.checked, true);
  assert.equal(control(nodes, 'Dryness').props.accessibilityLabel, 'Dryness, primary goal, selected');
  assert.equal(control(nodes, 'Maintain my skin').props.accessibilityLabel, 'Maintain my skin, additional goal, selected');
  press(control(nodes, 'Save skin profile'));
  assert.deepEqual(saved?.intent, { state: 'answered', value: 'replace' });
  assert.deepEqual(saved?.treatments, { state: 'answered', value: ['benzoyl_peroxide'] });
  assert.deepEqual(saved?.behavior, { state: 'answered', value: 'oily' });
});

test('sensitive followups require the caller to establish relevance', () => {
  const flow = componentHarness(file, 'ContextFlow', { initialDraft: createContextDraft(), onApply() {}, onSkip() {} });
  let nodes = flow.render();
  for (const label of ['Treatments you use', 'Known sensitivities', 'Are you pregnant?']) assert.ok(!nodes.some(node => node.props.label === label));
  nodes = flow.render({ contextQuestions: ['treatments', 'sensitivities'], relevance: { fields: ['pregnancy'], evidenceReason: 'Bound reviewed retinoid evidence.' } });
  for (const label of ['Treatments you use', 'Known sensitivities', 'Are you pregnant?']) assert.ok(nodes.some(node => node.props.label === label));
});
