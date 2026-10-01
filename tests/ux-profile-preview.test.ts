import assert from 'node:assert/strict';
import { componentHarness, control, textContent, press } from './ux-profile-render.ts';
let completed = 0;
let exited = 0;
const preview = componentHarness('src/components/personalization/PersonalizationFlow.tsx', 'PersonalizationFlow', {
  available: false, onComplete: () => { completed++; }, onSkip: () => { exited++; },
});
const nodes = preview.render();
assert.ok(textContent(nodes).includes('Saving a skin profile is not available in this preview.'), 'Unavailable previews must explain that answers cannot be saved');
assert.ok(!nodes.some(node => node.type === 'ChoiceChip'), 'An unavailable preview must not collect unusable profile answers');
press(control(nodes, 'Back to Check'));
assert.equal(exited, 1);
assert.equal(completed, 0);
const live = componentHarness('src/components/personalization/PersonalizationFlow.tsx', 'PersonalizationFlow', { onComplete() {}, onSkip() {}, loading: true });
const busy = live.render();
assert.equal(control(busy, 'Continue').props.loading, true);
assert.ok(busy.filter(node => node.type === 'ChoiceChip').every(node => node.props.disabled), 'Saving disables draft changes');
console.log('UX profile unavailable preview and pending-save controls passed');
