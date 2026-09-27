import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseProductTruthSnapshot } from '../src/contracts/productTruthValidation.ts';
import { verifiedProductTruth, unresolvedProductTruth, formulaOnlyProductTruth } from '../src/fixtures/product-truth/snapshots.ts';
test('valid boundary snapshots parse without elevating formula-only',()=>{
  for (const value of [verifiedProductTruth,unresolvedProductTruth,formulaOnlyProductTruth]) assert.deepEqual(parseProductTruthSnapshot(value),value);
});
test('reject private evidence, untrusted verification, invalid revision and mismatched refs',()=>{
  assert.throws(()=>parseProductTruthSnapshot({...verifiedProductTruth,storagePath:'private.jpg'}));
  assert.throws(()=>parseProductTruthSnapshot({...verifiedProductTruth,caseRevision:0}));
  assert.throws(()=>parseProductTruthSnapshot({...verifiedProductTruth,formula:{...verifiedProductTruth.formula,publicSourceUrl:'https://example.org/?token=secret'}}));
  assert.throws(()=>parseProductTruthSnapshot({...verifiedProductTruth,catalogReferences:{...verifiedProductTruth.catalogReferences,formulaVersionId:null}}));
  assert.throws(()=>parseProductTruthSnapshot({...verifiedProductTruth,conflicts:[{code:'ingredient_mismatch',status:'unresolved'}]}));
  assert.throws(()=>parseProductTruthSnapshot({...formulaOnlyProductTruth,formula:{...formulaOnlyProductTruth.formula,appliesToSelectedVariant:true}}));
});
