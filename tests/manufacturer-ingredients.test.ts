import assert from 'node:assert/strict';
import test from 'node:test';
import { manufacturerIngredientPage } from '../src/presentation/external-products/manufacturerIngredients.ts';

test('manufacturer ingredient fallback only navigates to validated Old Spice GTIN', () => {
  const q = { barcode: '0012044038840', name: 'Old Spice Fresh', brand: 'Old Spice', size: '3 oz' };
  assert.equal(manufacturerIngredientPage(q), 'https://smartlabel.pg.com/00012044038840.html');
  for (const change of [{ barcode: '123' }, { barcode: '../../bad' }, { brand: 'Spice' }, { brand: 'Not Old Spice' }, { brand: null }]) {
    assert.equal(manufacturerIngredientPage({ ...q, ...change }), null);
  }
});
