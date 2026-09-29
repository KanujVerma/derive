import assert from 'node:assert/strict';
import test from 'node:test';
import { createContextDraft, type ContextDraft } from '../src/presentation/p0b-personalization/draft.ts';
import * as draftModule from '../src/presentation/p0b-personalization/draft.ts';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';
const file = 'src/components/p0b-personalization/ContextFlow.tsx';

test('basic questions use substantive choices and step Skip preserves the earlier goal', () => {
  let applied: ContextDraft | undefined;
  let exits = 0;
  const flow = componentHarness(file, 'ContextFlow', { collectIntent: false, onApply(value: ContextDraft) { applied = value; }, onSkip() { exits++; } });
  let nodes = flow.render();
  for (const label of ['Leave unanswered', 'Prefer not to say', 'Not sure']) assert.ok(!nodes.some(node => node.props.label === label));
  press(control(nodes, 'Dryness'));
  press(control(flow.render(), 'Continue'));
  nodes = flow.render();
  for (const label of ['Leave unanswered', 'Prefer not to say', 'Not sure']) assert.ok(!nodes.some(node => node.props.label === label));
  press(control(nodes, 'Skip'));
  assert.deepEqual(applied?.primaryGoal, { state: 'answered', value: 'dryness' });
  assert.deepEqual(applied?.behavior, { state: 'unanswered' });
  assert.deepEqual(applied?.reactivity, { state: 'unanswered' });
  assert.equal(exits, 0);
});

test('Skip on the first step advances without inventing a goal and selected main goal can clear', () => {
  let applied: ContextDraft | undefined;
  const flow = componentHarness(file, 'ContextFlow', { collectIntent: false, onApply(value: ContextDraft) { applied = value; }, onSkip() {} });
  press(control(flow.render(), 'Dryness'));
  press(control(flow.render(), 'Dryness'));
  assert.equal(control(flow.render(), 'Dryness').props.selected, false);
  press(control(flow.render(), 'Skip'));
  assert.equal(applied, undefined);
  assert.ok(flow.render().some(node => node.props.label === 'Do skincare products tend to irritate your skin?'));
  press(control(flow.render(), 'Skip'));
  assert.deepEqual((applied as ContextDraft | undefined)?.primaryGoal, { state: 'unanswered' });
});

test('editing retains unsure and withheld values while Cancel still exits', () => {
  const draft = createContextDraft(); draft.behavior = { state: 'answered', value: 'unsure' }; draft.reactivity = { state: 'withheld' };
  let applied: ContextDraft | undefined;
  let exits = 0;
  const flow = componentHarness(file, 'ContextFlow', { initialDraft: draft, collectIntent: false, onApply(value: ContextDraft) { applied = value; }, onSkip() { exits++; } });
  press(control(flow.render(), 'Save skin profile'));
  assert.deepEqual(applied?.behavior, { state: 'answered', value: 'unsure' });
  assert.deepEqual(applied?.reactivity, { state: 'withheld' });
  press(control(flow.render(), 'Cancel profile edit'));
  assert.equal(exits, 1);
});

test('final Skip blocks invalid retained answers through the same real validator as Done', () => {
  const invalid = createContextDraft(); invalid.secondaryGoals = ['dryness', 'redness', 'texture'];
  let applies = 0;
  // Inject a corrupt local draft to exercise validation beyond the chip limits.
  const flow = componentHarness(file, 'ContextFlow', { collectIntent: false, onApply() { applies++; }, onSkip() {} }, {
    modules: { '@/src/presentation/p0b-personalization/draft': { ...draftModule, createContextDraft: () => createContextDraft(invalid) } },
  });
  press(control(flow.render(), 'Skip'));
  press(control(flow.render(), 'Skip'));
  assert.equal(applies, 0);
  assert.ok(textContent(flow.render()).includes('Choose up to two other goals.'));
});

test('final Skip retains entered sensitivity names and leaves untouched fields unanswered', () => {
  let applied: ContextDraft | undefined;
  const flow = componentHarness(file, 'ContextFlow', { collectIntent: false, contextQuestions: ['sensitivities'], onApply(value: ContextDraft) { applied = value; }, onSkip() {} });
  press(control(flow.render(), 'Skip'));
  press(control(flow.render(), 'Skip'));
  const input = flow.render().find(node => node.type === 'TextInput');
  assert.ok(input);
  input.props.onChangeText('  fragrance  \n\n limonene ');
  press(control(flow.render(), 'Skip'));
  assert.deepEqual(applied?.sensitivities, { state: 'answered', value: ['fragrance', 'limonene'] });
  assert.deepEqual(applied?.reactivity, { state: 'unanswered' });
});
