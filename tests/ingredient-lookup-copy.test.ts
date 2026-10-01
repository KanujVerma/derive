import assert from 'node:assert/strict';
import test from 'node:test';
import { ingredientLookupCopy } from '../src/presentation/external-products/ingredientLookupCopy.ts';

test('missing and ambiguous lists remain distinct from interrupted and unconfigured search', () => {
  const statuses = ['not_found', 'ambiguous', 'unavailable', 'configuration_required', 'rate_limited'] as const;
  const copies = statuses.map(ingredientLookupCopy);
  assert.equal(new Set(copies.map(copy => copy.title)).size, statuses.length);
  for (const copy of copies) {
    assert.match(copy.body, /ingredients from your package/);
    assert.doesNotMatch(copy.title + copy.body, /[:\u2013\u2014]|\b(?:safe|unsafe|score|approved|verified)\b/i);
  }
  assert.match(ingredientLookupCopy('unavailable').body, /product match is still here/);
  assert.match(ingredientLookupCopy('configuration_required').body, /product match is still here/);
  assert.match(ingredientLookupCopy('rate_limited').body, /Try again later/);
});
