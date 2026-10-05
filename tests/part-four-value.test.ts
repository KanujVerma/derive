import assert from 'node:assert/strict';
import { evaluateBalancedValue, OFFER_FIELDS, type BalancedValueInput, type QualifiedOffer } from '../src/domain/part-four/value.ts';
const now='2026-10-03T12:00:00Z';
// Entirely synthetic rights and seller evidence; no source policy is activated.
const grant=(sourceId:string,field:(typeof OFFER_FIELDS)[number])=>({sourceId,field,policyId:'synthetic-policy',policyVersion:'v1',validUntil:'2026-10-04T10:00:00Z',operations:{process:true,store:true,display:true,export:true},retention:{mode:'retain_until' as const,until:'2026-10-04T10:00:00Z'}});
const offer=(productId:string,amount:string,size='50'):QualifiedOffer=>({sourceId:`source-${productId}`,sourceUrl:`https://retailer.example.invalid/${productId}`,offerId:`offer-${productId}`,productId,brandId:`brand-${productId}`,skuId:`sku-${productId}`,variantId:`variant-${productId}`,formulaVersionId:`formula-${productId}`,packCount:'1',size:{amount:size,unit:'mL'},amount,currency:'USD',market:'US',merchant:'Example retailer',merchantId:'example-retailer',seller:{id:'example-retailer',name:'Example retailer',relationship:'retailer_direct',evidence:{kind:'retailer_direct_listing',qualification:'documented',sourceId:`source-${productId}`,url:`https://retailer.example.invalid/${productId}`,sellerId:'example-retailer',sellerName:'Example retailer',merchantId:'example-retailer',brandId:null,observedAt:'2026-10-03T10:00:00Z',validUntil:'2026-10-04T10:00:00Z',grant:grant(`source-${productId}`,'seller')}},fulfillment:{id:'example-warehouse',name:'Example fulfillment',shipsFrom:'US',prime:false},condition:'new',availability:'in_stock',priceKind:'ordinary',observedAt:'2026-10-03T10:00:00Z',validUntil:'2026-10-04T10:00:00Z',qualification:'eligible',conditions:[],conditionsSatisfied:true,fieldGrants:OFFER_FIELDS.map(field=>grant(`source-${productId}`,field))});
const expected=(productId:string)=>({productId,brandId:`brand-${productId}`,skuId:`sku-${productId}`,variantId:`variant-${productId}`,formulaVersionId:`formula-${productId}`,packCount:'1',size:{amount:'50',unit:'mL' as const}});
const input=():BalancedValueInput=>({now,primaryGoal:'dryness',candidate:{id:'candidate',eligibility:'suitable',expected:expected('candidate'),offer:offer('candidate','20')},comparator:{id:'current',eligibility:'suitable',expected:expected('current'),offer:offer('current','10')},advantage:{state:'admitted',favored:'candidate',magnitude:'meaningful',goal:'dryness',propositionId:'benefit',sourceIds:['benefit-source']}});
{
 const i=input(); let r=evaluateBalancedValue(i); assert.equal(r.state,'ready'); assert.equal(r.preferredId,'candidate'); assert.match(r.explanation,/meaningful.*primary/);
 assert.equal(i.advantage.state,'admitted'); if(i.advantage.state!=='admitted')throw Error('Fixture'); i.advantage={...i.advantage,magnitude:'small'}; r=evaluateBalancedValue(i); assert.equal(r.preferredId,'current'); assert.match(r.explanation,/lower.*unit/);
 i.advantage={state:'unknown'}; assert.equal(evaluateBalancedValue(i).preferredId,'current');
 i.advantage={state:'admitted',favored:'candidate',magnitude:'meaningful',goal:'dark_spots',propositionId:'benefit',sourceIds:['benefit-source']}; assert.equal(evaluateBalancedValue(i).preferredId,'current');
}
{
 const i=input(); i.comparator.offer!.size.unit='g'; assert.equal(evaluateBalancedValue(i).state,'pending');
 i.comparator.offer=offer('current','10'); i.comparator.offer.validUntil=now; assert.equal(evaluateBalancedValue(i).state,'pending');
 i.comparator.offer=null; assert.equal(evaluateBalancedValue(i).preferredId,null);
 i.comparator.offer=offer('current','10'); i.comparator.offer.conditions=['member price']; i.comparator.offer.conditionsSatisfied=false; assert.equal(evaluateBalancedValue(i).state,'pending');
 i.comparator.offer=offer('current','10'); i.comparator.offer.skuId='other'; assert.equal(evaluateBalancedValue(i).state,'pending');
 i.comparator.offer=offer('current','10'); i.comparator.eligibility='unknown'; assert.equal(evaluateBalancedValue(i).state,'pending');
}
{
 const i=input(); i.advantage={state:'unknown'}; i.candidate.offer=offer('candidate','0.300000000000000001','3'); i.candidate.expected.size.amount='3'; i.comparator.offer=offer('current','0.1','1'); i.comparator.expected.size.amount='1';
 assert.equal(evaluateBalancedValue(i).preferredId,'current');
 i.candidate.offer.amount='0.3'; assert.equal(evaluateBalancedValue(i).preferredId,null);
 i.candidate.offer.currency='EUR'; assert.equal(evaluateBalancedValue(i).state,'pending');
}
{
 const i=input(); i.spending={currency:'USD',scope:'per_product',amount:'15',period:'purchase'};
 const r=evaluateBalancedValue(i); assert.equal(r.preferredId,'candidate'); assert.match(r.affordability!,/candidate is above/); assert.doesNotMatch(r.explanation,/%|score/);
 i.spending.scope='routine'; assert.match(evaluateBalancedValue(i).affordability!,/consumption/);
 i.advantage={state:'admitted',favored:'candidate',magnitude:'meaningful',goal:'dryness',propositionId:'benefit',sourceIds:[]}; assert.equal(evaluateBalancedValue(i).preferredId,'current');
 i.candidate.id='92000000-0000-4000-8000-000000000001'; i.candidate.label='Candidate lotion'; i.advantage={state:'admitted',favored:'candidate',magnitude:'meaningful',goal:'dryness',propositionId:'benefit',sourceIds:['benefit-source']}; assert.match(evaluateBalancedValue(i).explanation,/Candidate lotion/); assert.doesNotMatch(evaluateBalancedValue(i).explanation,/92000000/);
}
{
 for(const change of [
  (o:QualifiedOffer)=>{o.seller.relationship='unknown';},
  (o:QualifiedOffer)=>{o.seller.id='marketplace-seller';},
  (o:QualifiedOffer)=>{o.seller.evidence.qualification='pending';},
  (o:QualifiedOffer)=>{o.seller.evidence.sellerId='other';},
  (o:QualifiedOffer)=>{o.seller.evidence.sellerName='Other seller';},
  (o:QualifiedOffer)=>{o.seller.evidence.validUntil=now;},
  (o:QualifiedOffer)=>{o.seller.evidence.grant.operations.process=false;},
  (o:QualifiedOffer)=>{o.condition='used';},
  (o:QualifiedOffer)=>{o.availability='unknown';},
  (o:QualifiedOffer)=>{o.priceKind='member';},
  (o:QualifiedOffer)=>{o.conditions=['coupon'];o.conditionsSatisfied=true;},
  (o:QualifiedOffer)=>{o.packCount='2';},
  (o:QualifiedOffer)=>{o.fieldGrants=o.fieldGrants.filter(g=>g.field!=='price');},
  (o:QualifiedOffer)=>{o.fieldGrants[0].operations.process=false;},
  (o:QualifiedOffer)=>{o.fieldGrants[0].operations.display=false;},
  (o:QualifiedOffer)=>{o.fieldGrants[0].validUntil=now;},
 ]) {
  const i=input(),o=i.candidate.offer!; change(o); o.fulfillment!.prime=true;
  const result=evaluateBalancedValue(i);assert.equal(result.state,'pending');assert.equal(result.preferredId,null);assert.deepEqual(result.unitPrices,[]);
 }
 const unsupported=input();(unsupported.candidate.offer as any).subscriptionDiscount=true;
 assert.equal(evaluateBalancedValue(unsupported).state,'pending');
 for(const priceKind of ['member','coupon','subscription','cart','bundle','unknown'] as const){
  const i=input();i.candidate.offer!.priceKind=priceKind;assert.equal(evaluateBalancedValue(i).state,'pending',priceKind);
 }
 const marketplace=input();marketplace.candidate.offer!.seller.relationship='marketplace';marketplace.candidate.offer!.fulfillment!.prime=true;
 assert.equal(evaluateBalancedValue(marketplace).state,'pending');
 const wrongMarket=input();wrongMarket.comparator.offer!.market='GB';assert.ok(evaluateBalancedValue(wrongMarket).gapIds.includes('market_mismatch'));
}
{
 const i=input(),o=i.candidate.offer!;
 o.seller={id:'authorized-seller',name:'Independently authorized seller',relationship:'brand_authorized',evidence:{...o.seller.evidence,kind:'brand_authorization_document',sourceId:'brand-document',url:'https://brand.example.invalid/authorized-sellers',sellerId:'authorized-seller',sellerName:'Independently authorized seller',merchantId:null,brandId:o.brandId,grant:grant('brand-document','seller')}};
 let r=evaluateBalancedValue(i);assert.equal(r.state,'ready');assert.ok(r.sourceIds.includes('brand-document'));assert.equal(r.unitPrices[0].sellerName,'Independently authorized seller');
 o.seller.evidence.brandId='other-brand';assert.equal(evaluateBalancedValue(i).state,'pending');o.seller.evidence.brandId=o.brandId;
 o.seller.evidence.sourceId=o.sourceId;o.seller.evidence.grant.sourceId=o.sourceId;assert.equal(evaluateBalancedValue(i).state,'pending');
}
{
 const i=input();let r=evaluateBalancedValue(i);assert.equal(r.retailerComparison,'same_retailer');
 const o=i.comparator.offer!;o.merchantId='second-retailer';o.merchant='Second retailer';o.seller.id='second-retailer';o.seller.name='Second retailer';o.seller.evidence.sellerId='second-retailer';o.seller.evidence.sellerName='Second retailer';o.seller.evidence.merchantId='second-retailer';
 r=evaluateBalancedValue(i);assert.equal(r.retailerComparison,'distinct_retailers');assert.match(r.explanation,/Example retailer.*Second retailer/);assert.equal(r.unitPrices[1].sourceId,'source-current');
 for(const mode of ['omit','tombstone','restricted'] as const){
  const rights=o.fieldGrants.find(g=>g.field==='price')!;rights.operations.store=false;rights.operations.export=false;rights.retention={mode,until:null};
  r=evaluateBalancedValue(i);assert.equal(r.state,'ready');assert.equal(r.unitPrices[1].rights.rawOfferRetentionAllowed,false);assert.equal(r.unitPrices[1].rights.exportAllowed,false);assert.equal(r.unitPrices[1].rights.fields.find(g=>g.field==='price')?.retention.mode,mode);
 }
 o.fieldGrants.find(g=>g.field==='price')!.retention={mode:'retain_until',until:'2026-10-04T10:00:00Z'};assert.equal(evaluateBalancedValue(i).state,'pending');
}
{
 const i=input();i.advantage={state:'unknown'};i.candidate.offer!.packCount='2';i.candidate.expected.packCount='2';
 let r=evaluateBalancedValue(i);assert.equal(r.state,'ready');assert.equal(r.preferredId,null);assert.equal(r.unitPrices[0].packCount,'2');
 i.candidate.offer!.fieldGrants[0].validUntil='2026-10-03T15:00:00Z';i.candidate.offer!.fieldGrants[0].retention.until='2026-10-03T14:00:00Z';
 r=evaluateBalancedValue(i);assert.equal(r.unitPrices[0].qualifiedUntil,'2026-10-03T15:00:00.000Z');assert.equal(r.unitPrices[0].rights.retainUntil,'2026-10-03T14:00:00.000Z');
 i.now='2026-10-03T15:00:00Z';assert.equal(evaluateBalancedValue(i).state,'pending');
}
console.log('part-four value: passed');
