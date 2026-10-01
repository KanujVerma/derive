import assert from 'node:assert/strict';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';
const id = '00000000-0000-4000-8000-000000000001';
const routineSaved: any[] = [];
const routine = componentHarness('src/components/p0b-personalization/RoutineContext.tsx', 'RoutineContext', {
  createItemId: () => id, onApply: (draft: any) => { routineSaved.push(draft); }, onSkip() {},
});
let nodes = routine.render();
const name = nodes.find(node => node.props.accessibilityLabel === 'Routine product name')!;
name.props.onChangeText('My cream');
nodes = routine.render();
press(control(nodes, 'Add product'));
nodes = routine.render();
const states = nodes.filter(node => node.type === 'ChoiceChip' && ['Current', 'In use', 'Paused', 'Stopped', 'Occasional'].includes(node.props.label));
assert.equal(states.length, 4, 'New products require a visible use-status choice');
assert.ok(states.every(node => !node.props.selected), 'No use status is inferred when adding a name');
assert.ok(!nodes.some(node => node.props.accessibilityLabel?.startsWith('Exact use count')), 'Detailed scheduling should not appear during minimum entry');
press(control(nodes, 'Use this routine context'));
assert.equal(routineSaved.length, 0, 'An unconfirmed use state must not be applied');
nodes = routine.render();
assert.ok(textContent(nodes).includes('Choose a use status for each product.'));
press(control(nodes, 'In use'));
nodes = routine.render();
press(control(nodes, 'Use this routine context'));
assert.equal(routineSaved.at(-1).items[0].status, 'current');
assert.equal(routineSaved.at(-1).items[0].timing, 'unknown');
assert.deepEqual(routineSaved.at(-1).items[0].frequency, { kind: 'unknown' });
let experienceSaved: any = null;
const experience = componentHarness('src/components/p0b-personalization/ExperienceContext.tsx', 'ExperienceContext', {
  createRecordId: () => id, onApply: (edit: any) => { experienceSaved = edit; }, onSkip() {},
});
nodes = experience.render();
assert.ok(!nodes.some(node => node.props.accessibilityLabel === 'Experience date or interval start'), 'Dates must be disclosed instead of required during minimum entry');
assert.ok(!nodes.some(node => node.props.accessibilityLabel === 'Reported symptoms, one per line'), 'Optional medical details must start collapsed');
nodes.find(node => node.props.accessibilityLabel === 'Experience product name')!.props.onChangeText('My cream');
nodes = experience.render();
press(control(nodes, 'I reacted to it'));
nodes = experience.render();
press(control(nodes, 'Use this report'));
assert.equal(experienceSaved.draft.kind, 'reacted');
assert.deepEqual(experienceSaved.draft.occurred, { start: null, end: null });
assert.deepEqual(experienceSaved.draft.symptoms, []);
assert.equal(experienceSaved.draft.useContext, null);
console.log('UX profile minimum product/experience entry and progressive detail passed');
const original = {
  id, reference: { kind: 'manual' as const, label: 'Earlier cream', verification: 'unverified' as const }, kind: 'reacted' as const,
  occurred: { start: '2026-01-01', end: null }, useContext: { timing: 'pm' as const, frequency: { kind: 'exact' as const, count: 2, unit: 'week' as const }, startedOn: null, stoppedOn: null, duration: { count: 2, unit: 'months' as const } },
  symptoms: ['Redness'], note: 'User observation',
};
const corrected: any[] = [];
const correction = componentHarness('src/components/p0b-personalization/ExperienceContext.tsx', 'ExperienceContext', {
  existing: { draft: original, revisionId: 'previous-revision' }, createRecordId: () => id, onApply: (edit: any) => corrected.push(edit), onSkip() {},
});
nodes = correction.render();
press(control(nodes, 'Hide optional details'));
nodes = correction.render();
press(control(nodes, 'Hide use details'));
nodes = correction.render({ error: 'That change was not confirmed. Try again.' });
assert.ok(textContent(nodes).includes('That change was not confirmed. Try again.'));
press(control(nodes, 'Use this correction'));
assert.deepEqual(corrected[0].draft, original, 'Hiding optional fields or displaying a transient save error must preserve the draft');
assert.equal(corrected[0].supersedesRevisionId, 'previous-revision');
for (const status of ['paused', 'stopped'] as const) {
  const historicalUse = componentHarness('src/components/p0b-personalization/RoutineContext.tsx', 'RoutineContext', {
    initialDraft: { completeness: 'partial', items: [{ id, reference: { kind: 'manual', label: 'Earlier product', verification: 'unverified' }, status, timing: 'unknown', frequency: { kind: 'unknown' } }] },
    createItemId: () => id, onApply() {}, onSkip() {},
  });
  let historyNodes = historicalUse.render();
  assert.ok(historyNodes.some(node => node.props.label === 'Add use details'), 'Paused and stopped products must retain access to supported use-history fields');
  press(control(historyNodes, 'Add use details'));
  historyNodes = historicalUse.render();
  press(control(historyNodes, 'Hide use details'));
  historyNodes = historicalUse.render();
  assert.ok(historyNodes.some(node => node.props.label === 'Add use details'), 'Hiding details must retain a way to reopen them');
}
