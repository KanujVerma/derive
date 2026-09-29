import assert from 'node:assert/strict';
import { componentHarness, textContent } from './ux-profile-render.ts';
import { anonymousEmptyMyStuff } from '../src/fixtures/my-stuff/myStuffFixtures.ts';
const view = componentHarness('src/components/my-stuff/MyStuffContent.tsx', 'MyStuffContent', {
  model: anonymousEmptyMyStuff, memoryStatus: 'loading', experienceStatus: 'loading', onAddProduct() {}, onAddExperience() {},
});
let text = textContent(view.render());
assert.ok(text.includes('Loading your products'), 'unresolved retrieval is not an empty saved collection');
assert.ok(!text.includes('No products saved'));
assert.ok(!text.includes('No checks yet'));
text = textContent(view.render({ memoryStatus: 'error', experienceStatus: 'error' }));
assert.ok(text.includes('Unavailable'));
assert.ok(!text.includes('No products saved'));
console.log('My Stuff retrieval, failure and empty records remain distinct');
