import { z } from 'zod';
import { canonicalJson } from '../domain/part-two/hash.ts';
const OFFER_RETENTION_FIELDS=['identity','merchant','seller','fulfillment','price','availability','conditions','dates'] as const;
const id=z.string().min(1).max(200),text=z.string().min(1).max(4000),date=z.iso.datetime();
const retention=z.strictObject({mode:z.enum(['retain_until','omit','tombstone','restricted']),until:date.nullable()});
const operations=z.strictObject({process:z.boolean(),store:z.boolean(),display:z.boolean(),export:z.boolean()});
export const RetainedEvidenceGrantSchema=z.strictObject({sourceId:id,field:z.enum([...OFFER_RETENTION_FIELDS,'brief']),policyId:id,policyVersion:id,validUntil:date,operations,retention,revoked:z.boolean()});
export type RetentionGrant=z.infer<typeof RetainedEvidenceGrantSchema>;
const common={recordId:z.string().regex(/^[a-f0-9]{64}$/),sourceIds:z.array(id).max(100),withdrawalIds:z.array(id).max(100),originallyVisible:z.boolean(),state:z.enum(['retained','omitted','tombstoned','restricted','unavailable']),reason:z.enum(['unknown_grant','source_withdrawn','grant_revoked','permission_expired','retention_expired','retention_omitted','source_tombstone','retention_restricted','storage_not_permitted','processing_not_permitted','display_not_permitted','export_not_permitted']).nullable(),grants:z.array(RetainedEvidenceGrantSchema).max(100)};
const fulfillment=z.strictObject({id:text,name:text,shipsFrom:text.nullable(),prime:z.boolean()}).nullable();
export const RetainedEvidencePayloadSchemas={
 offer_identity:z.strictObject({choiceId:id,offerId:id,sizeAmount:text,packCount:text,unit:z.enum(['g','mL']),market:id}),
 offer_price:z.strictObject({amount:text,currency:id}),
 offer_merchant:z.strictObject({merchantId:id,merchant:text}),
 offer_seller:z.strictObject({sellerId:id,sellerName:text,sellerRelationship:z.enum(['retailer_direct','brand_authorized','marketplace','unknown'])}),
 offer_fulfillment:z.strictObject({fulfillment}),
 offer_availability:z.strictObject({condition:z.literal('new'),availability:z.literal('in_stock')}),
 offer_conditions:z.strictObject({conditions:z.array(text).max(100)}),
 offer_dates:z.strictObject({observedAt:date,validUntil:date,qualifiedUntil:date}),
 offer_source:z.strictObject({url:z.url().max(4096)}),
 brief_header:z.strictObject({revision:id,productId:id,variantId:id,formulaVersionId:id.nullable(),coverageLimit:text,reviewedAt:date,reviewerId:id,reviewDecision:z.enum(['approved_local_fixture','approved_source_brief']),validUntil:date}),
 brief_source:z.strictObject({title:text,url:z.url().max(4096),kind:z.enum(['personal_anecdote','editorial','manufacturer']),retrievedAt:date,publishedAt:date.nullable(),matching:z.enum(['exact_variant','exact_formula']),productId:id,variantId:id,formulaVersionId:id.nullable(),coverageLimit:text}),
 brief_observation:z.strictObject({text:text.max(600),kind:z.enum(['reported_experience','editorial_observation']),scope:z.enum(['feel_context','formula_context']),sourceIds:z.array(id).max(100),opposingSourceIds:z.array(id).max(100)}),
};
export type RetainedEvidenceKind=keyof typeof RetainedEvidencePayloadSchemas;
export const RetainedEvidenceFieldSchema=z.discriminatedUnion('kind',[
 z.strictObject({...common,kind:z.literal('offer_identity'),value:RetainedEvidencePayloadSchemas.offer_identity.nullable()}),
 z.strictObject({...common,kind:z.literal('offer_price'),value:RetainedEvidencePayloadSchemas.offer_price.nullable()}),
 z.strictObject({...common,kind:z.literal('offer_merchant'),value:RetainedEvidencePayloadSchemas.offer_merchant.nullable()}),
 z.strictObject({...common,kind:z.literal('offer_seller'),value:RetainedEvidencePayloadSchemas.offer_seller.nullable()}),
 z.strictObject({...common,kind:z.literal('offer_fulfillment'),value:RetainedEvidencePayloadSchemas.offer_fulfillment.nullable()}),
 z.strictObject({...common,kind:z.literal('offer_availability'),value:RetainedEvidencePayloadSchemas.offer_availability.nullable()}),
 z.strictObject({...common,kind:z.literal('offer_conditions'),value:RetainedEvidencePayloadSchemas.offer_conditions.nullable()}),
 z.strictObject({...common,kind:z.literal('offer_dates'),value:RetainedEvidencePayloadSchemas.offer_dates.nullable()}),
 z.strictObject({...common,kind:z.literal('offer_source'),value:RetainedEvidencePayloadSchemas.offer_source.nullable()}),
 z.strictObject({...common,kind:z.literal('brief_header'),value:RetainedEvidencePayloadSchemas.brief_header.nullable()}),
 z.strictObject({...common,kind:z.literal('brief_source'),value:RetainedEvidencePayloadSchemas.brief_source.nullable()}),
 z.strictObject({...common,kind:z.literal('brief_observation'),value:RetainedEvidencePayloadSchemas.brief_observation.nullable()}),
]).superRefine((row,ctx)=>{
 if((row.state==='retained')!==(row.value!==null)||row.state==='retained'&&(row.reason!==null||!row.grants.length)||row.state!=='retained'&&row.reason===null)ctx.addIssue({code:'custom',message:'Retained source field state/payload mismatch'});
 const sources=[...new Set(row.grants.map(g=>g.sourceId))].sort();
 if(canonicalJson([...row.sourceIds].sort())!==canonicalJson(sources)||row.grants.some(g=>[g.sourceId,g.policyId,g.policyVersion].some(id=>!row.withdrawalIds.includes(id))))ctx.addIssue({code:'custom',message:'Retained source field lacks exact grant/withdrawal dependencies'});
 if(row.kind.startsWith('brief_')&&row.grants.some(g=>g.field!=='brief'))ctx.addIssue({code:'custom',message:'Brief field carries a foreign grant'});
 if(row.kind.startsWith('offer_')&&row.kind!=='offer_source'&&row.grants.some(g=>g.field!==row.kind.slice(6)))ctx.addIssue({code:'custom',message:'Offer field carries a foreign field grant'});
 if(row.kind==='offer_source'&&row.state==='retained'&&OFFER_RETENTION_FIELDS.some(name=>!row.grants.some(g=>g.field===name)))ctx.addIssue({code:'custom',message:'Offer URL lacks every source field dependency'});
});
export const RetainedEvidenceSchema=z.strictObject({version:z.literal('part-four-retained-evidence/v1'),savedAt:date,projectedAt:date,purpose:z.enum(['save','retain','display','export']),state:z.enum(['complete','partial','unavailable','empty']),fields:z.array(RetainedEvidenceFieldSchema).max(1000)}).superRefine((value,ctx)=>{
 if(new Set(value.fields.map(row=>`${row.recordId}:${row.kind}`)).size!==value.fields.length)ctx.addIssue({code:'custom',message:'Duplicate retained source field'});
 const count=value.fields.filter(row=>row.state==='retained').length;
 const state=!value.fields.length?'empty':count===value.fields.length?'complete':count?'partial':'unavailable';
 if(value.state!==state)ctx.addIssue({code:'custom',message:'Retained source envelope state differs from fields'});
 const seen=new Map<string,string>();
 for(const row of value.fields)for(const g of row.grants){
  const key=canonicalJson([row.recordId,g.sourceId,g.field,g.policyId,g.policyVersion]),content=canonicalJson(g);
  if(seen.has(key)&&seen.get(key)!==content)ctx.addIssue({code:'custom',message:'Conflicting repeated source grant'});
  seen.set(key,content);
 }
});
export type RetainedEvidence=z.infer<typeof RetainedEvidenceSchema>;
export type RetainedEvidenceField=RetainedEvidence['fields'][number];
export type RetainedEvidencePurpose=RetainedEvidence['purpose'];
