import assert from 'node:assert/strict';
import test from 'node:test';
import { createContextDraft, type ContextDraft } from '../src/presentation/p0b-personalization/draft.ts';
import { componentHarness, control, press } from './ux-profile-render.ts';

const file = 'src/components/p0b-personalization/ContextFlow.tsx';
test('fresh profile keeps reactivity separate and asks skin feel only after a dryness goal', () => {
  const flow = componentHarness(file, 'ContextFlow', { collectIntent: false, completionLabel: 'Done', onApply() {}, onSkip() {} });
  let nodes = flow.render();
  assert.ok(!nodes.some(node => node.props.label === 'What are you deciding?'));
  press(control(nodes, 'Maintain my skin'));
  press(control(flow.render(), 'Continue'));
  nodes = flow.render();
  assert.ok(!nodes.some(node => node.props.label === 'How does your skin usually feel?'));
  assert.ok(nodes.some(node => node.props.label === 'Do skincare products tend to irritate your skin?'));
  press(control(nodes, 'Back'));
  press(control(flow.render(), 'Dryness'));
  press(control(flow.render(), 'Continue'));
  assert.ok(flow.render().some(node => node.props.label === 'How does your skin usually feel?'));
  assert.ok(flow.render().some(node => node.props.label === 'Done'));
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
  assert.equal(control(nodes, 'Dryness').props.accessibilityLabel, 'Dryness, Main');
  assert.equal(control(nodes, 'Maintain my skin').props.accessibilityLabel, 'Maintain my skin, Also');
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
