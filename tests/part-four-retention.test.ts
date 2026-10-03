import assert from 'node:assert/strict';
import test from 'node:test';
import { createRetainedEvidence, reprojectRetainedEvidence, RetainedEvidenceSchema } from '../src/domain/part-four/retainedEvidence.ts';
import { OFFER_FIELDS, type BalancedValueResult } from '../src/domain/part-four/value.ts';
import { researchBriefHash } from '../src/domain/part-four/researchBrief.ts';
import type { ProductResearchBrief } from '../src/contracts/PartFour.ts';

const now='2026-10-03T12:00:00Z',expires='2026-10-04T12:00:00Z',secret='314.159265358979';
function value():BalancedValueResult {
 const fields=OFFER_FIELDS.map(field=>({sourceId:'synthetic-offer-source',field,policyId:`policy-${field}`,policyVersion:'synthetic-v1',validUntil:expires,operations:{process:true,store:true,display:true,export:true},retention:{mode:'retain_until' as const,until:expires}}));
 return {state:'ready',preferredId:'candidate',explanation:`Synthetic price-derived prose ${secret}`,affordability:`Synthetic budget prose ${secret}`,sourceIds:['synthetic-offer-source'],gapIds:[],retailerComparison:'same_retailer',unitPrices:[{choiceId:'candidate',amount:secret,sizeAmount:'50',packCount:'1',unit:'mL',currency:'USD',market:'US',offerId:'synthetic-offer',sourceId:'synthetic-offer-source',sourceUrl:`https://synthetic.invalid/offer?quoted=${secret}`,merchantId:'synthetic-merchant',merchant:'Synthetic merchant',sellerId:'synthetic-seller',sellerName:'Synthetic seller',sellerRelationship:'retailer_direct',fulfillment:{id:'warehouse',name:'Synthetic fulfillment',shipsFrom:'US',prime:true},observedAt:now,validUntil:expires,qualifiedUntil:expires,conditions:[],rights:{fields,rawOfferRetentionAllowed:true,retainUntil:expires,exportAllowed:true}}]};
}
function brief():ProductResearchBrief {
 const b:ProductResearchBrief={version:'product-research-brief/v1',revision:'synthetic-brief',contentHash:'0'.repeat(64),productId:'synthetic-product',variantId:'synthetic-variant',formulaVersionId:'synthetic-formula',reviewDecision:'approved_local_fixture',reviewedAt:now,reviewerId:'synthetic-reviewer',validUntil:expires,coverageLimit:'Synthetic limited coverage',observations:[{id:'first',text:'PROTECTED_FIRST_OBSERVATION',kind:'reported_experience',scope:'feel_context',sourceIds:['first-source'],opposingSourceIds:[]},{id:'second',text:'INDEPENDENT_SECOND_OBSERVATION',kind:'reported_experience',scope:'feel_context',sourceIds:['second-source'],opposingSourceIds:[]}],sources:['first','second'].map(id=>({id:`${id}-source`,title:`${id} source`,url:`https://synthetic.invalid/${id}`,kind:'personal_anecdote',retrievedAt:now,publishedAt:null,matching:'exact_formula',productId:'synthetic-product',variantId:'synthetic-variant',formulaVersionId:'synthetic-formula',coverageLimit:`Synthetic ${id} coverage`,permission:{grantId:`${id}-grant`,version:'synthetic-v1',process:true,store:true,display:true,export:true,revoked:false,validUntil:expires}}))};
 b.contentHash=researchBriefHash(b);return b;
}
const row=(projection:ReturnType<typeof createRetainedEvidence>,kind:string)=>projection.fields.find(field=>field.kind===kind)!;

test('saved source projection is deterministic, whitelisted and contains no full artifact or derived price prose',()=>{
 const source=value(),saved=createRetainedEvidence({value:source},{now});
 assert.deepEqual(saved,createRetainedEvidence({value:source},{now}));RetainedEvidenceSchema.parse(saved);
 assert.equal(row(saved,'offer_price').state,'retained');assert.equal(row(saved,'offer_price').originallyVisible,true);
 const json=JSON.stringify(saved);assert.ok(json.includes(secret));assert.equal(json.includes('price-derived'),false);assert.equal(json.includes('budget prose'),false);assert.equal(json.includes('unitPrices'),false);assert.equal(json.includes('rawArtifact'),false);
 assert.ok(Object.isFrozen(saved));
});

test('omit, tombstone and restriction leave content-free history without a URL or serialized artifact price bypass',()=>{
 for(const mode of ['omit','tombstone','restricted'] as const){
  const source=value(),price=source.unitPrices[0].rights.fields.find(grant=>grant.field==='price')!;
  price.operations.store=false;price.retention={mode,until:null};
  (source as any).rawArtifact=JSON.stringify(source);
  const saved=createRetainedEvidence({value:source},{now});
  assert.equal(row(saved,'offer_price').value,null);assert.equal(row(saved,'offer_price').originallyVisible,true);
  assert.equal(row(saved,'offer_price').state,{omit:'omitted',tombstone:'tombstoned',restricted:'restricted'}[mode]);
  assert.equal(JSON.stringify(saved).includes(secret),false);
  assert.equal(row(saved,'offer_identity').state,'retained');
 }
});

test('finite grant and retention deadlines remove persisted price bytes on reopen without revival',()=>{
 const source=value();source.unitPrices[0].rights.fields.find(grant=>grant.field==='price')!.retention.until='2026-10-03T13:00:00Z';
 const saved=createRetainedEvidence({value:source},{now});
 const later=reprojectRetainedEvidence(saved,{now:'2026-10-03T13:00:00Z',purpose:'retain'});
 assert.equal(row(later,'offer_price').state,'tombstoned');assert.equal(row(later,'offer_price').originallyVisible,true);assert.equal(JSON.stringify(later).includes(secret),false);
 assert.equal(row(later,'offer_identity').state,'retained');
 const rollback=reprojectRetainedEvidence(later,{now,purpose:'display'});assert.equal(row(rollback,'offer_price').value,null);
 const expired=reprojectRetainedEvidence(saved,{now:expires,purpose:'display'});assert.ok(expired.fields.every(field=>field.value===null));
});

test('unknown, conflicting and revoked grants fail closed while independent fields remain',()=>{
 for(const mutation of [
  (v:BalancedValueResult)=>{v.unitPrices[0].rights.fields=v.unitPrices[0].rights.fields.filter(grant=>grant.field!=='price');},
  (v:BalancedValueResult)=>{(v.unitPrices[0].rights.fields.find(grant=>grant.field==='price') as any).retention.mode='forever';},
  (v:BalancedValueResult)=>{(v.unitPrices[0].rights.fields.find(grant=>grant.field==='price') as any).revoked=true;},
  (v:BalancedValueResult)=>{v.unitPrices[0].rights.fields.push({...v.unitPrices[0].rights.fields.find(grant=>grant.field==='price')!,operations:{process:true,store:false,display:true,export:true}});},
 ]){
  const source=value();mutation(source);const saved=createRetainedEvidence({value:source},{now});
  assert.equal(row(saved,'offer_price').value,null);assert.equal(JSON.stringify(saved).includes(secret),false);assert.equal(row(saved,'offer_identity').state,'retained');
 }
 const saved=createRetainedEvidence({value:value()},{now}),withdrawn=reprojectRetainedEvidence(saved,{now,purpose:'retain',withdrawnDependencies:['policy-price']});
 assert.equal(row(withdrawn,'offer_price').state,'tombstoned');assert.equal(JSON.stringify(withdrawn).includes(secret),false);
 assert.equal(row(withdrawn,'offer_identity').state,'retained');
});

test('export is independently denied without modifying an otherwise retained displayed price',()=>{
 const source=value();source.unitPrices[0].rights.fields.find(grant=>grant.field==='price')!.operations.export=false;
 const saved=createRetainedEvidence({value:source},{now});assert.equal(row(saved,'offer_price').state,'retained');
 const exported=reprojectRetainedEvidence(saved,{now,purpose:'export'});
 assert.equal(row(exported,'offer_price').state,'restricted');assert.equal(JSON.stringify(exported).includes(secret),false);
 assert.equal(row(saved,'offer_price').state,'retained');assert.ok(JSON.stringify(reprojectRetainedEvidence(saved,{now,purpose:'display'})).includes(secret));
});

test('brief withdrawal removes dependent source metadata and wording but preserves independent observations and formula facts',()=>{
 const formula={ingredientId:'glycerin',factKind:'independently-permitted-formula-fact'},input={value:value(),brief:brief(),formula};
 const saved=createRetainedEvidence(input,{now}),withdrawn=reprojectRetainedEvidence(saved,{now,purpose:'retain',withdrawnDependencies:['first-grant']});
 const json=JSON.stringify(withdrawn);assert.equal(json.includes('PROTECTED_FIRST_OBSERVATION'),false);assert.ok(json.includes('INDEPENDENT_SECOND_OBSERVATION'));
 assert.equal(json.includes('https://synthetic.invalid/first'),false);assert.equal(json.includes('Synthetic limited coverage'),false);
 assert.deepEqual(input.formula,formula);assert.equal('formula' in withdrawn,false,'Independent formula ownership remains with the canonical envelope');
 const expired=reprojectRetainedEvidence(saved,{now:expires,purpose:'retain'});assert.equal(JSON.stringify(expired).includes('OBSERVATION'),false);
});

test('invalid brief permissions or tampered retained envelope never serialize protected source artifacts',()=>{
 const source=brief();(source.sources[0].permission as any).revoked=true;source.contentHash=researchBriefHash(source);
 const denied=createRetainedEvidence({brief:source},{now});assert.equal(JSON.stringify(denied).includes('OBSERVATION'),false);
 const saved=structuredClone(createRetainedEvidence({value:value()},{now}));(saved as any).rawArtifact={amount:secret};
 const deniedSaved=reprojectRetainedEvidence(saved,{now,purpose:'display'});assert.equal(JSON.stringify(deniedSaved).includes(secret),false);
 for(const change of [
  (v:ReturnType<typeof createRetainedEvidence>)=>{row(v,'offer_price').grants[0].field='identity';},
  (v:ReturnType<typeof createRetainedEvidence>)=>{row(v,'offer_price').withdrawalIds=[];},
  (v:ReturnType<typeof createRetainedEvidence>)=>{row(v,'offer_price').grants[0].sourceId='foreign-source';},
  (v:ReturnType<typeof createRetainedEvidence>)=>{row(v,'offer_price').grants[0].operations.process=false;},
 ]){
  const bad=structuredClone(createRetainedEvidence({value:value()},{now}));change(bad);
  assert.equal(JSON.stringify(reprojectRetainedEvidence(bad,{now,purpose:'display'})).includes(secret),false);
 }
});


test('closed field variants reject raw bytes, missing discriminants and extra payload properties',()=>{
 for(const mutation of [
  (v:any)=>{v.fields=['arbitrary raw restricted source bytes'];},
  (v:any)=>{delete v.fields[0].kind;},
  (v:any)=>{delete v.fields[0].recordId;},
  (v:any)=>{v.fields[0].value.rawArtifact='arbitrary raw restricted source bytes';},
 ]){
  const bad=structuredClone(createRetainedEvidence({value:value()},{now}));mutation(bad);
  assert.equal(RetainedEvidenceSchema.safeParse(bad).success,false);
  const safe=reprojectRetainedEvidence(bad,{now,purpose:'retain'});
  assert.equal(safe.state,'empty');assert.equal(safe.fields.length,0);
  assert.equal(JSON.stringify(safe).includes('arbitrary raw restricted source bytes'),false);
 }
});

export { value as retentionValueFixture, brief as retentionBriefFixture };
