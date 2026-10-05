import type { ContextGoal } from '../../contracts/PersonalContext.ts';
import { z } from 'zod';
/** Already acquired and permission-qualified projection. No provider prices or
 * legacy catalog prices are read here. Seller evidence and source rights must
 * be admitted by the caller; this pure evaluator cannot verify source authority.
 * Decimal strings are exact. Size is per item; packCount is the exact offer pack. */
const nonempty=z.string().trim().min(1).max(1000),date=z.iso.datetime();
export const OFFER_FIELDS=['identity','merchant','seller','fulfillment','price','availability','conditions','dates'] as const;
const retention=z.strictObject({mode:z.enum(['retain_until','omit','tombstone','restricted']),until:date.nullable()});
const fieldGrant=z.strictObject({sourceId:nonempty,field:z.enum(OFFER_FIELDS),policyId:nonempty,policyVersion:nonempty,validUntil:date,
 operations:z.strictObject({process:z.boolean(),store:z.boolean(),display:z.boolean(),export:z.boolean()}),retention});
export type OfferFieldGrant=z.infer<typeof fieldGrant>;
const identity=z.strictObject({productId:nonempty,brandId:nonempty,skuId:nonempty,variantId:nonempty,formulaVersionId:nonempty,packCount:z.string().regex(/^[1-9]\d{0,5}$/),size:z.strictObject({amount:z.string().max(100),unit:z.enum(['g','mL'])})});
export type OfferIdentity=z.infer<typeof identity>;
const sellerEvidence=z.strictObject({kind:z.enum(['retailer_direct_listing','brand_authorization_document']),qualification:z.enum(['documented','pending','unknown']),sourceId:nonempty,url:z.url(),sellerId:nonempty,sellerName:nonempty,merchantId:nonempty.nullable(),brandId:nonempty.nullable(),observedAt:date,validUntil:date,grant:fieldGrant});
const qualifiedOffer=identity.extend({offerId:nonempty,sourceId:nonempty,sourceUrl:z.url(),amount:z.string().max(100),currency:z.string().regex(/^[A-Z]{3}$/),market:nonempty,merchant:nonempty,merchantId:nonempty,
 seller:z.strictObject({id:nonempty,name:nonempty,relationship:z.enum(['retailer_direct','brand_authorized','marketplace','unknown']),evidence:sellerEvidence}),
 fulfillment:z.strictObject({id:nonempty,name:nonempty,shipsFrom:nonempty.nullable(),prime:z.boolean()}).nullable(),
 condition:z.enum(['new','used','refurbished','unknown']),availability:z.enum(['in_stock','out_of_stock','preorder','unknown']),priceKind:z.enum(['ordinary','member','coupon','subscription','cart','bundle','unknown']),
 observedAt:date,validUntil:date,qualification:z.enum(['eligible','pending','stale','permission_denied','unavailable']),conditions:z.array(nonempty).max(100),conditionsSatisfied:z.boolean(),fieldGrants:z.array(fieldGrant).max(100)});
export type QualifiedOffer=z.infer<typeof qualifiedOffer>;
export interface ValueChoice { id:string; label?:string; eligibility:'suitable'|'unsuitable'|'unknown'; expected:OfferIdentity; offer:QualifiedOffer|null }
export type AdmittedAdvantage = {state:'admitted';favored:'candidate'|'comparator';magnitude:'meaningful'|'small'|'uncertain';goal:ContextGoal;propositionId:string;sourceIds:string[]}|{state:'unknown'};
export interface BalancedValueInput { now:string;primaryGoal:ContextGoal|null;candidate:ValueChoice;comparator:ValueChoice;advantage:AdmittedAdvantage;
 spending?:{currency:string;scope:'per_product'|'routine';amount:string;period:'purchase'|'month'}|null;
}
export interface BalancedValueResult { state:'ready'|'pending'|'unavailable';preferredId:string|null;explanation:string;sourceIds:string[];gapIds:string[];
 /** Exact ratio; display rounding belongs to the presentation layer. */
 unitPrices:Array<{choiceId:string;amount:string;sizeAmount:string;packCount:string;unit:'g'|'mL';currency:string;market:string;offerId:string;sourceId:string;sourceUrl:string;merchantId:string;merchant:string;sellerId:string;sellerName:string;sellerRelationship:QualifiedOffer['seller']['relationship'];fulfillment:QualifiedOffer['fulfillment'];observedAt:string;validUntil:string;qualifiedUntil:string;conditions:string[];
  rights:{fields:OfferFieldGrant[];rawOfferRetentionAllowed:boolean;retainUntil:string|null;exportAllowed:boolean}}>;
 retailerComparison:'same_retailer'|'distinct_retailers'|null;
 affordability:string|null;
}
interface Decimal {integer:bigint;scale:bigint}
function decimal(value:string):Decimal|null {
 if(!/^\d+(?:\.\d+)?$/.test(value)||value.length>100)return null;
 const [whole,fraction='']=value.split('.');return {integer:BigInt(whole+fraction),scale:10n**BigInt(fraction.length)};
}
function compare(a:Decimal,b:Decimal):number {const delta=a.integer*b.scale-b.integer*a.scale;return delta<0n?-1:delta>0n?1:0;}
function grantAvailable(grant:OfferFieldGrant,sourceId:string,now:number):boolean {
 if(grant.sourceId!==sourceId||!grant.operations.process||!grant.operations.display||Date.parse(grant.validUntil)<=now)return false;
 const until=grant.retention.until;
 if(grant.retention.mode==='retain_until')return grant.operations.store&&until!==null&&Date.parse(until)>now&&Date.parse(until)<=Date.parse(grant.validUntil);
 return until===null; // Omission, tombstone and restriction carry no raw retention promise.
}
function qualified(choice:ValueChoice,now:number):{offer:QualifiedOffer;price:Decimal;size:Decimal}|string {
 if(!choice.offer)return `${choice.id}:missing_offer`;
 const parsed=qualifiedOffer.safeParse(choice.offer),expected=identity.safeParse(choice.expected);
 if(!parsed.success||!expected.success)return `${choice.id}:unsupported_offer_fields`;
 const offer=parsed.data;
 if(offer.qualification!=='eligible')return `${choice.id}:${offer.qualification}`;
 const observed=Date.parse(offer.observedAt),expires=Date.parse(offer.validUntil);
 if(!Number.isFinite(observed)||!Number.isFinite(expires)||observed>now||expires<=now||observed>=expires)return `${choice.id}:offer_date`;
 if(offer.condition!=='new'||offer.availability!=='in_stock')return `${choice.id}:offer_condition_or_availability`;
 // Membership, coupons, subscribe/save, cart and bundle conditions are excluded
 // even if a caller marks them satisfied. Only ordinary current-pair prices qualify.
 if(offer.priceKind!=='ordinary'||offer.conditions.length||!offer.conditionsSatisfied)return `${choice.id}:conditional_price_excluded`;
 if(offer.fieldGrants.length!==OFFER_FIELDS.length||new Set(offer.fieldGrants.map(grant=>grant.field)).size!==OFFER_FIELDS.length||offer.fieldGrants.some(grant=>!grantAvailable(grant,offer.sourceId,now)))return `${choice.id}:source_field_permissions`;
 const seller=offer.seller,evidence=seller.evidence;
 const evidenceObserved=Date.parse(evidence.observedAt),evidenceExpires=Date.parse(evidence.validUntil);
 if(evidence.qualification!=='documented'||evidence.sellerId!==seller.id||evidence.sellerName!==seller.name||evidenceObserved>now||evidenceExpires<=now||evidenceObserved>=evidenceExpires||evidence.grant.field!=='seller'||!grantAvailable(evidence.grant,evidence.sourceId,now))return `${choice.id}:seller_evidence`;
 if(seller.relationship==='retailer_direct'){
  if(seller.id!==offer.merchantId||seller.name!==offer.merchant||evidence.kind!=='retailer_direct_listing'||evidence.merchantId!==offer.merchantId||evidence.sourceId!==offer.sourceId||evidence.url!==offer.sourceUrl)return `${choice.id}:retailer_direct_seller`;
 }else if(seller.relationship==='brand_authorized'){
  if(evidence.kind!=='brand_authorization_document'||evidence.brandId!==offer.brandId||evidence.sourceId===offer.sourceId||evidence.url===offer.sourceUrl)return `${choice.id}:brand_authorized_seller`;
 }else return `${choice.id}:unsupported_seller`;
 const price=decimal(offer.amount),size=decimal(offer.size.amount),expectedSize=decimal(choice.expected.size.amount);
 if(!price||!size||size.integer===0n||!expectedSize||expectedSize.integer===0n)return `${choice.id}:invalid_decimal`;
 if(['productId','brandId','skuId','variantId','formulaVersionId','packCount'].some(key=>{const k=key as keyof Omit<OfferIdentity,'size'>;return offer[k]!==choice.expected[k];})||offer.size.unit!==choice.expected.size.unit||compare(size,expectedSize)!==0)return `${choice.id}:offer_identity`;
 return {offer,price,size:{integer:size.integer*BigInt(offer.packCount),scale:size.scale}};
}
export function evaluateBalancedValue(input:BalancedValueInput):BalancedValueResult {
 const output:BalancedValueResult={state:'pending',preferredId:null,explanation:'Value is pending qualified comparable offers and suitable current-pair choices.',sourceIds:[],gapIds:[],unitPrices:[],retailerComparison:null,affordability:null};
 const now=Date.parse(input.now);if(!Number.isFinite(now))throw Error('Value evaluation time must be valid');
 const choices=[input.candidate,input.comparator];
 const label=(choice:ValueChoice)=>choice.label&&choice.label!==choice.id?choice.label:choice===input.candidate?'candidate':'current routine product';
 if(input.candidate.id===input.comparator.id){output.state='unavailable';output.gapIds=['self_comparison'];output.explanation='A distinct current routine comparator is required for value.';return output;}
 for(const choice of choices)if(choice.eligibility!=='suitable')output.gapIds.push(`${choice.id}:${choice.eligibility}`);
 if(output.gapIds.length){if(choices.some(c=>c.eligibility==='unsuitable'))output.state='unavailable';return output;}
 const candidate=qualified(input.candidate,now),comparator=qualified(input.comparator,now);
 if(typeof candidate==='string')output.gapIds.push(candidate);if(typeof comparator==='string')output.gapIds.push(comparator);
 if(typeof candidate==='string'||typeof comparator==='string')return output;
 if(candidate.offer.currency!==comparator.offer.currency)output.gapIds.push('currency_mismatch');
 if(candidate.offer.market!==comparator.offer.market)output.gapIds.push('market_mismatch');
 if(candidate.offer.merchantId===comparator.offer.merchantId&&candidate.offer.merchant!==comparator.offer.merchant)output.gapIds.push('merchant_identity_conflict');
 if(candidate.offer.size.unit!==comparator.offer.size.unit)output.gapIds.push('unit_mismatch');
 if(output.gapIds.length)return output;
 output.sourceIds=[...new Set([candidate.offer.sourceId,comparator.offer.sourceId,candidate.offer.seller.evidence.sourceId,comparator.offer.seller.evidence.sourceId])];
 output.retailerComparison=candidate.offer.merchantId===comparator.offer.merchantId?'same_retailer':'distinct_retailers';
 output.unitPrices=choices.map((choice,index)=>{const offer=(index===0?candidate:comparator).offer;
  const fields=[...offer.fieldGrants,offer.seller.evidence.grant];
  const rawOfferRetentionAllowed=fields.every(grant=>grant.operations.store&&grant.retention.mode==='retain_until');
  return {choiceId:choice.id,amount:offer.amount,sizeAmount:offer.size.amount,packCount:offer.packCount,unit:offer.size.unit,currency:offer.currency,market:offer.market,offerId:offer.offerId,sourceId:offer.sourceId,sourceUrl:offer.sourceUrl,merchantId:offer.merchantId,merchant:offer.merchant,sellerId:offer.seller.id,sellerName:offer.seller.name,sellerRelationship:offer.seller.relationship,fulfillment:offer.fulfillment,observedAt:offer.observedAt,validUntil:offer.validUntil,qualifiedUntil:new Date(Math.min(Date.parse(offer.validUntil),Date.parse(offer.seller.evidence.validUntil),...fields.map(grant=>Date.parse(grant.validUntil)))).toISOString(),conditions:[...offer.conditions],
   rights:{fields,rawOfferRetentionAllowed,retainUntil:rawOfferRetentionAllowed?new Date(Math.min(...fields.map(grant=>Date.parse(grant.retention.until!)))).toISOString():null,exportAllowed:fields.every(grant=>grant.operations.export)}};
 });
 // (price / size) ratios compared as exact integer cross products. No floating
 // point, density conversion, implied per-use cost or efficacy score.
 const candidateNumerator=candidate.price.integer*candidate.size.scale, candidateDenominator=candidate.price.scale*candidate.size.integer;
 const comparatorNumerator=comparator.price.integer*comparator.size.scale, comparatorDenominator=comparator.price.scale*comparator.size.integer;
 const difference=candidateNumerator*comparatorDenominator-comparatorNumerator*candidateDenominator;
 const cheaper=difference<0n?input.candidate:difference>0n?input.comparator:null;
 const advantage=input.advantage;
 const meaningful=advantage.state==='admitted'&&advantage.magnitude==='meaningful'&&advantage.goal===input.primaryGoal&&!!advantage.propositionId&&advantage.sourceIds.length>0;
 if(meaningful&&advantage.state==='admitted'){
  output.preferredId=advantage.favored==='candidate'?input.candidate.id:input.comparator.id;
  output.sourceIds=[...new Set([...output.sourceIds,...advantage.sourceIds])];
  output.explanation=`A meaningful supported advantage for your primary ${input.primaryGoal!.replaceAll('_',' ')} goal favors ${label(advantage.favored==='candidate'?input.candidate:input.comparator)}. Comparable price is secondary to that benefit; both exact current offers remain visible.`;
 }else if(cheaper){
  output.preferredId=cheaper.id;
  output.explanation=`${label(cheaper)} has the lower qualified unit price among these suitable choices. No meaningful supported primary-goal advantage establishes a reason to pay more; small or uncertain advantages leave price as the deciding factor.`;
 }else output.explanation='Both suitable choices have the same qualified unit price. No meaningful supported primary-goal advantage establishes a value winner.';
 output.explanation+=output.retailerComparison==='same_retailer'?` Both ordinary offers are from ${candidate.offer.merchant}.`:` These ordinary offers use distinct retailers: ${candidate.offer.merchant} and ${comparator.offer.merchant}. A same-retailer comparison is preferred when available.`;
 output.state='ready';
 const spending=input.spending;
 if(spending){
  const budget=decimal(spending.amount);
  if(!budget||spending.currency!==candidate.offer.currency)output.affordability='Your spending report cannot be matched to these offer amounts or currency.';
  else if(spending.scope!=='per_product'||spending.period!=='purchase')output.affordability='Your routine or monthly spending report needs consumption and other routine costs before affordability can be assessed.';
  else output.affordability=choices.map((choice,index)=>`${label(choice)} is ${compare((index===0?candidate:comparator).price,budget)>0?'above':'within'} your reported per-product purchase budget.`).join(' ');
 }
 return output;
}
