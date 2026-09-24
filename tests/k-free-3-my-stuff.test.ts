import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMyStuffPresentation } from '../src/presentation/my-stuff/myStuffPresentation.ts';
import {
  anonymousEmptyMyStuff,
  personalizedMyStuff,
  productsMyStuff,
  historyMyStuff,
  reactionsMyStuff,
  mixedMyStuff,
} from '../src/fixtures/my-stuff/myStuffFixtures.ts';

test('K-FREE-3: anonymous empty context does not fabricate skin, product, check or reaction facts', () => {
  const view = buildMyStuffPresentation(anonymousEmptyMyStuff);
  assert.equal(view.profile.summary, 'Not set up');
  assert.deepEqual(view.products, []);
  assert.deepEqual(view.checks, []);
  assert.deepEqual(view.experiences, []);
  assert.equal(view.productSummary, 'No products saved');
  assert.equal(view.checkSummary, 'No checks yet');
  assert.equal(view.experienceSummary, 'No experiences noted');
});

test('K-FREE-3: isolated fixtures populate only their respective context', () => {
  assert.equal(buildMyStuffPresentation(personalizedMyStuff).profile.summary, '2 skin concerns');
  assert.deepEqual(buildMyStuffPresentation(personalizedMyStuff).products, []);
  assert.equal(buildMyStuffPresentation(productsMyStuff).products.length, 3);
  assert.equal(buildMyStuffPresentation(productsMyStuff).checks.length, 0);
  assert.equal(buildMyStuffPresentation(historyMyStuff).checks.length, 2);
  assert.equal(buildMyStuffPresentation(historyMyStuff).experiences.length, 0);
  assert.equal(buildMyStuffPresentation(reactionsMyStuff).experiences.length, 3);
  assert.equal(buildMyStuffPresentation(reactionsMyStuff).products.length, 0);
});

test('K-FREE-3: product state, check outcome and user experience remain distinct in mixed context', () => {
  const view = buildMyStuffPresentation(mixedMyStuff);
  assert.deepEqual(view.products.map((item) => item.state), ['using', 'considering', 'stopped']);
  assert.deepEqual(view.checks.map((item) => item.outcome), ['checked', 'checked']);
  assert.deepEqual(view.experiences.map((item) => item.kind), ['tolerated', 'reacted', 'liked', 'finished']);
  assert.equal(view.productSummary, '3 products');
  assert.equal(view.checkSummary, '2 checks');
  assert.equal(view.experienceSummary, '4 experiences');
  assert.ok(view.experiences.some((item) => item.kind === 'reacted' && item.note === 'Stinging after use'));
  assert.ok(!JSON.stringify(view).toLowerCase().includes('diagnosis'));
});
