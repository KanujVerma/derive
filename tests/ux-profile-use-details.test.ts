import assert from 'node:assert/strict';
import { componentHarness, control, press } from './ux-profile-render.ts';
import { unknownUseContext } from '../src/presentation/p0b-personalization/experience.ts';
const changed: ReturnType<typeof unknownUseContext>[] = [];
const field = componentHarness('src/components/p0b-personalization/ReportedUseFields.tsx', 'ReportedUseFields', {
  value: unknownUseContext(), onChange: (value: any) => { changed.push(value); },
});
let nodes = field.render();
assert.ok(!nodes.some(node => node.props.accessibilityLabel === 'Reported exact use count'), 'Exact use and dates must be disclosed only on request');
assert.ok(nodes.filter(node => node.type === 'ChoiceChip').every(node => node.props.selectionType === 'single'));
press(control(nodes, 'A few times a week'));
assert.deepEqual(changed.at(-1)?.frequency, { kind: 'qualitative', value: 'few_times_week' });
assert.equal(changed.at(-1)?.timing, 'unknown');
assert.equal(changed.at(-1)?.startedOn, null);
nodes = field.render();
press(control(nodes, 'Add dates or exact frequency'));
nodes = field.render();
assert.ok(nodes.some(node => node.props.accessibilityLabel === 'Reported exact use count'));
const details = { ...unknownUseContext(), frequency: { kind: 'exact' as const, count: 2, unit: 'week' as const }, startedOn: '2026-01-01' };
const edit = componentHarness('src/components/p0b-personalization/ReportedUseFields.tsx', 'ReportedUseFields', { value: details, onChange() {} });
assert.ok(edit.render().some(node => node.props.accessibilityLabel === 'Reported exact use count'), 'Previously supplied precision is visible while editing');
console.log('UX profile optional reported-use precision passed');
