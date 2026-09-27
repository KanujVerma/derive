import assert from 'node:assert/strict';
import test from 'node:test';
import { describeContributionExperience } from '../src/presentation/catalog-contribution/experience.ts';

test('an unavailable contribution service exposes another Check path without an enabled send action', () => {
  const view = describeContributionExperience('unavailable');
  assert.equal(view.canPrepareRequest, false);
  assert.equal(view.primaryAction, 'try_another_way');
  assert.match(view.explanation, /not available yet/i);
  assert.doesNotMatch(view.explanation, /sent|added to.*catalog/i);
});

test('a future available service permits review only, with no success claim from draft preparation', () => {
  const view = describeContributionExperience('available');
  assert.equal(view.canPrepareRequest, true);
  assert.equal(view.primaryAction, 'help_add_product');
  assert.match(view.reviewActionLabel, /review/i);
  assert.doesNotMatch(view.reviewActionLabel, /send|submit|added/i);
});
