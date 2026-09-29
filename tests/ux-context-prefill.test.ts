import assert from 'node:assert/strict';
import { componentHarness, control, textContent, press } from './ux-profile-render.ts';
import { createExperienceDraft, type ExperienceEdit } from '../src/presentation/p0b-personalization/experience.ts';

const initial = createExperienceDraft('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
initial.reference = { kind: 'catalog', label: 'Known product', productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', variantId: null, formulaVersionId: null };
let applied: ExperienceEdit | null = null;
const editor = componentHarness('src/components/p0b-personalization/ExperienceContext.tsx', 'ExperienceContext', {
  initialDraft: initial, createRecordId: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  onApply: (value: ExperienceEdit) => { applied = value; }, onSkip() {},
});
let nodes = editor.render();
assert.ok(textContent(nodes).includes('Known product'), 'contextual Add experience preselects the actual owned product');
assert.ok(textContent(nodes).includes('unconfirmed'), 'preselection never establishes the formula');
press(control(nodes, 'I tolerated it'));
nodes = editor.render();
press(control(nodes, 'Use this report'));
assert.ok(applied);
const result = applied as ExperienceEdit;
assert.equal(result.draft.id, initial.id);
assert.equal(result.supersedesRevisionId, null);
assert.deepEqual(result.draft.reference, initial.reference);
console.log('Contextual experience preselection preserves record and formula uncertainty');
