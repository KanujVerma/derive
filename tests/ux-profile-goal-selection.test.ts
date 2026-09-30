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
function chipText(node: ReturnType<typeof goal>) {
  const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
  return children.filter(Boolean).map((child: { props?: { children?: string } }) => child.props?.children ?? '').join('');
}
function faded(node: ReturnType<typeof goal>) {
  return [node.props.style].flat(2).some(style => style && typeof style === 'object' && 'opacity' in style && style.opacity === 0.45);
}

test('one visible checkbox picker marks first choice primary and caps two additional choices', () => {
  let applied: ContextDraft | undefined;
  const flow = componentHarness(file, 'ContextFlow', { collectIntent: false, onApply(value: ContextDraft) { applied = value; }, onSkip() {} });
  let nodes = flow.render();
  assert.equal(nodes.find(node => node.props.label === 'What would you like to improve?')?.props.support, 'Choose up to three.');
  assert.ok(!nodes.some(node => node.props.children === 'Optional. You can skip and still see product facts.'));
  assert.ok(!nodes.some(node => ['Add other goals', 'Hide additional goals'].includes(node.props.label)));
  const available = goal(nodes, 'Breakouts');
  assert.equal(available.props.disabled, false);
  assert.equal(available.props.accessibilityState.disabled, false);
  assert.equal(faded(available), false);
  assert.equal(chipText(available), 'Breakouts');
  press(goal(nodes, 'Dryness'));
  nodes = flow.render();
  assert.equal(chipText(goal(nodes, 'Dryness')), 'Dryness');
  assert.equal(goal(nodes, 'Dryness').props.accessibilityLabel, 'Dryness, primary goal, selected');
  assert.equal(goal(nodes, 'Dryness').props.accessibilityRole, 'checkbox');
  assert.equal(goal(nodes, 'Dryness').props.accessibilityState.checked, true);
  press(goal(nodes, 'Texture'));
  press(goal(flow.render(), 'Breakouts'));
  nodes = flow.render();
  assert.equal(chipText(goal(nodes, 'Texture')), 'Texture');
  assert.equal(goal(nodes, 'Texture').props.accessibilityLabel, 'Texture, additional goal, selected');
  assert.equal(goal(nodes, 'Breakouts').props.accessibilityState.checked, true);
  assert.equal(goal(nodes, 'Dark marks').props.disabled, true);
  assert.equal(goal(nodes, 'Dark marks').props.accessibilityState.disabled, true);
  assert.equal(faded(goal(nodes, 'Dark marks')), true);
  press(goal(nodes, 'Dark marks'));
  assert.equal(goal(flow.render(), 'Dark marks').props.accessibilityState.checked, false);
  assert.notDeepEqual(goal(nodes, 'Dryness').props.style, goal(nodes, 'Texture').props.style);
  for (const label of ['Dryness', 'Texture', 'Breakouts', 'Dark marks']) assert.equal(chipText(goal(nodes, label)).includes('Main') || chipText(goal(nodes, label)).includes('Also'), false);
  press(control(nodes, 'Continue'));
  press(control(flow.render(), 'Skip'));
  assert.deepEqual(applied?.primaryGoal, { state: 'answered', value: 'dryness' });
  assert.deepEqual(applied?.secondaryGoals, ['texture', 'breakouts']);
});

test('tapping a selected additional goal promotes it and demotes the previous primary', () => {
  const draft = createContextDraft(); draft.primaryGoal = { state: 'answered', value: 'dryness' }; draft.secondaryGoals = ['texture', 'redness'];
  let applied: ContextDraft | undefined;
  const flow = componentHarness(file, 'ContextFlow', { initialDraft: draft, collectIntent: false, onApply(value: ContextDraft) { applied = value; }, onSkip() {} });
  press(goal(flow.render(), 'Texture'));
  const nodes = flow.render();
  assert.equal(goal(nodes, 'Texture').props.accessibilityLabel, 'Texture, primary goal, selected');
  assert.equal(goal(nodes, 'Dryness').props.accessibilityLabel, 'Dryness, additional goal, selected');
  assert.equal(goal(nodes, 'Redness & sensitivity').props.accessibilityLabel, 'Redness & sensitivity, additional goal, selected');
  press(control(nodes, 'Save skin profile'));
  assert.deepEqual(applied?.primaryGoal, { state: 'answered', value: 'texture' });
  assert.deepEqual(applied?.secondaryGoals, ['dryness', 'redness']);
});

test('removing the primary promotes the earliest remaining goal and leaves the other additional goal selected', () => {
  const draft = createContextDraft(); draft.primaryGoal = { state: 'answered', value: 'dryness' }; draft.secondaryGoals = ['texture', 'breakouts'];
  let applied: ContextDraft | undefined;
  const flow = componentHarness(file, 'ContextFlow', { initialDraft: draft, collectIntent: false, onApply(value: ContextDraft) { applied = value; }, onSkip() {} });
  press(goal(flow.render(), 'Dryness'));
  const nodes = flow.render();
  assert.equal(goal(nodes, 'Texture').props.accessibilityLabel, 'Texture, primary goal, selected');
  assert.equal(goal(nodes, 'Breakouts').props.accessibilityLabel, 'Breakouts, additional goal, selected');
  press(control(nodes, 'Save skin profile'));
  assert.deepEqual(applied?.primaryGoal, { state: 'answered', value: 'texture' });
  assert.deepEqual(applied?.secondaryGoals, ['breakouts']);
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
