import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFreeContextRequest } from '../supabase/functions/free-context/validate.ts';
import { determinePersonalFit } from '../supabase/functions/free-personal-fit/fit.ts';

const id = 'f3100000-0000-4000-8000-000000000001';

test('S-FREE-3: a guest request may only name bounded context operations', () => {
  assert.deepEqual(parseFreeContextRequest({ operation: 'list', section: 'checks' }),
    { operation: 'list', section: 'checks', limit: 20 });
  assert.deepEqual(parseFreeContextRequest({ operation: 'list', section: 'products', limit: 50, cursor: id }),
    { operation: 'list', section: 'products', limit: 50, cursor: id });
  for (const payload of [
    { operation: 'list', section: 'checks', limit: 51 },
    { operation: 'list', section: 'checks', cursor: '-1' },
    { operation: 'list', section: 'checks', userId: id },
    { operation: 'delete_entry', section: 'products', id },
    { operation: 'record_check', requestId: id },
    { operation: 'record_check', requestId: id, productId: id, caseId: id },
    { operation: 'save_product', requestId: id, product: { productId: id, name: 'forged' }, state: 'using' },
    { operation: 'save_product', requestId: id, product: { name: 'Wash' }, state: 'KEEP' },
  ]) assert.throws(() => parseFreeContextRequest(payload));
});

test('S-FREE-3: manual product input stays explicitly user-reported and notes are bounded', () => {
  assert.deepEqual(parseFreeContextRequest({ operation: 'save_product', requestId: id,
    product: { name: '  Gentle Wash ', brand: '  My Brand ' }, state: 'considering' }), {
    operation: 'save_product', requestId: id,
    product: { name: 'Gentle Wash', brand: 'My Brand' }, state: 'considering',
  });
  assert.deepEqual(parseFreeContextRequest({ operation: 'record_experience', requestId: id,
    product: { productId: id }, kind: 'reacted', note: '  Stinging after use  ' }), {
    operation: 'record_experience', requestId: id,
    product: { productId: id }, kind: 'reacted', note: 'Stinging after use',
  });
  assert.throws(() => parseFreeContextRequest({ operation: 'record_experience', requestId: id,
    product: { name: 'Wash' }, kind: 'diagnosed_allergy' }));
  assert.throws(() => parseFreeContextRequest({ operation: 'record_experience', requestId: id,
    product: { name: 'Wash' }, kind: 'reacted', note: 'x'.repeat(501) }));
});

test('S-FREE-3: same-product reaction prevents a positive fit without claiming allergy', () => {
  const result = determinePersonalFit({
    goals: ['dryness'], skinBehavior: 'dry_tight', reactivity: 'generally_tolerates',
    pregnancyStatus: 'no', sensitivitiesStatus: 'none_known', knownSensitivities: [],
    treatmentStatus: 'none', currentTreatments: [],
  }, {
    productId: id, variantId: id, formulaVersionId: id, category: 'moisturizer',
    ingredients: ['Water', 'Glycerin'],
  }, { reactedToSameProduct: true });
  assert.equal(result.label, 'USE_WITH_CAUTION');
  assert.equal(result.reason, 'prior_product_reaction');
  assert.ok(result.missingEvidence.includes('exact_prior_variant_and_formula'));
  assert.ok(!result.explanation.includes('allergic to'));
});
