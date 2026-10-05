import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {retentionArtifacts} from '../scripts/part-four-retention-fixture.mjs';
import {RetainedEvidenceSchema} from '../src/contracts/RetainedEvidence.ts';
import {reprojectRetainedEvidence} from '../src/domain/part-four/retainedEvidence.ts';
const now='2026-10-03T12:00:00.000Z',expiry='2026-10-04T12:00:00.000Z';
const subject={itemId:randomUUID(),productId:null,variantId:null,formulaVersionId:null};
test('durable acceptance inputs are original eligible direct-seller offers with exact field rights',()=>{
 const fixture=retentionArtifacts({id:randomUUID(),subject,now,expiry});
 assert.equal(fixture.value.state,'ready');assert.equal(fixture.value.retailerComparison,'same_retailer');assert.equal(fixture.value.unitPrices.length,2);
 RetainedEvidenceSchema.parse(fixture.retainedEvidence);
 assert.ok(fixture.retainedEvidence.fields.every(f=>f.state==='retained'));
 assert.ok(fixture.withdrawalIds.every(id=>/^retention-/.test(id)));
});
test('durable negative inputs exclude copied prices and dependent source links while preserving admitted brief',()=>{
 const omitted=retentionArtifacts({id:randomUUID(),subject,now,expiry,omit:true});
 assert.equal(JSON.stringify(omitted.retainedEvidence).includes(omitted.priceSecret),false);
 assert.ok(JSON.stringify(omitted.retainedEvidence).includes(omitted.briefSecret));
 const nonexport=retentionArtifacts({id:randomUUID(),subject,now,expiry,exportAllowed:false});
 assert.ok(JSON.stringify(nonexport.retainedEvidence).includes(nonexport.priceSecret));
 assert.equal(JSON.stringify(reprojectRetainedEvidence(nonexport.retainedEvidence,{now,purpose:'export'})).includes(nonexport.priceSecret),false);
});
test('source retention deadline is independent from current-result lease',()=>{
 const fixture=retentionArtifacts({id:randomUUID(),subject,now,expiry,priceUntil:'2026-10-03T12:00:02.000Z'});
 const later=reprojectRetainedEvidence(fixture.retainedEvidence,{now:'2026-10-03T12:00:03.000Z',purpose:'retain'});
 assert.equal(JSON.stringify(later).includes(fixture.priceSecret),false);assert.ok(JSON.stringify(later).includes(fixture.briefSecret));
 assert.ok(later.fields.some(f=>f.kind==='offer_identity'&&f.state==='retained'));
});
