import assert from 'node:assert/strict';
import test from 'node:test';
import { createContextDraft, type ContextDraft } from '../src/presentation/p0b-personalization/draft.ts';
import { componentHarness, control, press } from './ux-profile-render.ts';

const file = 'src/components/p0b-personalization/ContextFlow.tsx';
function goal(nodes: ReturnType<ReturnType<typeof componentHarness>['render']>, label: string) {
  const node = nodes.find(node => node.props.accessibilityLabel === label || node.props.accessibilityLabel?.startsWith(label + ', '));
  assert.ok(node, `Missing accessible goal ${label}`);
  return node;
}

test('one visible checkbox picker marks first choice Main and caps two Also choices', () => {
  let applied: ContextDraft | undefined;
  const flow = componentHarness(file, 'ContextFlow', { collectIntent: false, onApply(value: ContextDraft) { applied = value; }, onSkip() {} });
  let nodes = flow.render();
  assert.ok(!nodes.some(node => ['Add other goals', 'Hide additional goals'].includes(node.props.label)));
  press(goal(nodes, 'Dryness'));
  nodes = flow.render();
  assert.equal(goal(nodes, 'Dryness').props.accessibilityLabel, 'Dryness, Main');
  assert.equal(goal(nodes, 'Dryness').props.accessibilityRole, 'checkbox');
  assert.equal(goal(nodes, 'Dryness').props.accessibilityState.checked, true);
  press(goal(nodes, 'Texture'));
  press(goal(flow.render(), 'Breakouts'));
  nodes = flow.render();
  assert.equal(goal(nodes, 'Texture').props.accessibilityLabel, 'Texture, Also');
  assert.equal(goal(nodes, 'Breakouts').props.accessibilityState.checked, true);
  assert.equal(goal(nodes, 'Dark marks').props.disabled, true);
  press(goal(nodes, 'Dark marks'));
  assert.equal(goal(flow.render(), 'Dark marks').props.accessibilityState.checked, false);
  assert.notDeepEqual(goal(nodes, 'Dryness').props.style, goal(nodes, 'Texture').props.style);
  press(control(nodes, 'Continue'));
  press(control(flow.render(), 'Skip'));
  assert.deepEqual(applied?.primaryGoal, { state: 'answered', value: 'dryness' });
  assert.deepEqual(applied?.secondaryGoals, ['texture', 'breakouts']);
});

test('removing Main promotes earliest remaining Also and removing Also leaves Main unchanged', () => {
  const draft = createContextDraft(); draft.primaryGoal = { state: 'answered', value: 'dryness' }; draft.secondaryGoals = ['texture', 'breakouts'];
  let applied: ContextDraft | undefined;
  const flow = componentHarness(file, 'ContextFlow', { initialDraft: draft, collectIntent: false, onApply(value: ContextDraft) { applied = value; }, onSkip() {} });
  press(goal(flow.render(), 'Dryness'));
  let nodes = flow.render();
  assert.equal(goal(nodes, 'Texture').props.accessibilityLabel, 'Texture, Main');
  assert.equal(goal(nodes, 'Breakouts').props.accessibilityLabel, 'Breakouts, Also');
  press(goal(nodes, 'Breakouts'));
  nodes = flow.render();
  assert.equal(goal(nodes, 'Texture').props.accessibilityLabel, 'Texture, Main');
  assert.equal(goal(nodes, 'Breakouts').props.accessibilityState.checked, false);
  press(control(nodes, 'Save skin profile'));
  assert.deepEqual(applied?.primaryGoal, { state: 'answered', value: 'texture' });
  assert.deepEqual(applied?.secondaryGoals, []);
});

test('opening an existing edit preserves canonical unanswered goal meaning until a choice', () => {
  const draft = createContextDraft(); draft.primaryGoal = { state: 'withheld' }; draft.secondaryGoals = ['texture'];
  let applied: ContextDraft | undefined;
  const flow = componentHarness(file, 'ContextFlow', { initialDraft: draft, collectIntent: false, onApply(value: ContextDraft) { applied = value; }, onSkip() {} });
  press(control(flow.render(), 'Save skin profile'));
  assert.deepEqual(applied?.primaryGoal, { state: 'withheld' });
  assert.deepEqual(applied?.secondaryGoals, ['texture']);
});

test('short skin-feel labels retain the same saved meanings and explain Combination', () => {
  const draft = createContextDraft(); draft.primaryGoal = { state: 'answered', value: 'dryness' };
  let applied: ContextDraft | undefined;
  const flow = componentHarness(file, 'ContextFlow', { initialDraft: draft, collectIntent: false, onApply(value: ContextDraft) { applied = value; }, onSkip() {} });
  const nodes = flow.render();
  for (const label of ['Dry / tight', 'Balanced', 'Combination', 'Oily']) assert.ok(control(nodes, label));
  assert.ok(nodes.some(node => node.props.support?.includes('Combination: oily in some areas, dry in others.')));
  press(control(nodes, 'Combination'));
  press(control(flow.render(), 'Save skin profile'));
  assert.deepEqual(applied?.behavior, { state: 'answered', value: 'combination' });
});
