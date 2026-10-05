import { z } from 'zod';
import { ProductResearchBriefSchema } from '../../contracts/PartFour.ts';
import { canonicalJson, sha256 } from '../part-two/hash.ts';
import { deepFreeze } from '../part-two/dictionary.ts';
import { researchBriefHash } from './researchBrief.ts';
import { OFFER_FIELDS } from './value.ts';
import {ScientificManifestSchema,ScientificDecisionPacketSchema,type ScientificManifest,type ScientificDecisionPacket} from '../../contracts/ScientificClaim.ts';
import {scientificManifestHash} from './scientificDecision.ts';
import {claimSourcePin,scientificClaimHash} from './claimApplicability.ts';

import { RetainedEvidenceSchema, RetainedEvidenceGrantSchema as grant, RetainedEvidenceFieldSchema as field, RetainedEvidencePayloadSchemas as payloads, type RetainedEvidence, type RetentionGrant as Grant, type RetainedEvidenceField as Field, type RetainedEvidenceKind as Kind, type RetainedEvidencePurpose as Purpose } from '../../contracts/RetainedEvidence.ts';
export { RetainedEvidenceSchema, type RetainedEvidence } from '../../contracts/RetainedEvidence.ts';
const id=z.string().min(1).max(200),text=z.string().min(1).max(4000),date=z.iso.datetime();
const rawGrant=grant.extend({revoked:z.boolean().optional()});
const fulfillment=z.strictObject({id:text,name:text,shipsFrom:text.nullable(),prime:z.boolean()}).nullable();
export interface RetentionOptions {now:string;withdrawnDependencies?:readonly string[]}
export interface ReprojectionOptions extends RetentionOptions {purpose:'retain'|'display'|'export'}
const unitPrice=z.object({choiceId:id,offerId:id,sourceId:id,sourceUrl:z.url().max(4096),amount:text,sizeAmount:text,packCount:text,unit:z.enum(['g','mL']),currency:id,market:id,merchantId:id,merchant:text,sellerId:id,sellerName:text,sellerRelationship:z.enum(['retailer_direct','brand_authorized','marketplace','unknown']),fulfillment,observedAt:date,validUntil:date,qualifiedUntil:date,conditions:z.array(text).max(100),rights:z.object({fields:z.array(z.unknown()).max(100)})});
const unique=(values:readonly string[])=>[...new Set(values)].sort();
const compareText=(a:string,b:string)=>a<b?-1:a>b?1:0;

function decide(grants:Grant[],dependencies:readonly string[],options:RetentionOptions,purpose:Purpose,invalid=false):Pick<Field,'state'|'reason'> {
 const denied=(state:Field['state'],reason:Field['reason'])=>({state,reason});
 if(invalid||!grants.length)return denied('unavailable','unknown_grant');
 if(dependencies.some(id=>options.withdrawnDependencies?.includes(id)))return denied('tombstoned','source_withdrawn');
 const now=Date.parse(options.now);
 for(const g of grants){
  if(g.revoked)return denied('tombstoned','grant_revoked');
  if(Date.parse(g.validUntil)<=now)return denied('tombstoned','permission_expired');
  if(!g.operations.process)return denied('unavailable','processing_not_permitted');
  if(g.retention.mode==='omit')return denied('omitted','retention_omitted');
  if(g.retention.mode==='tombstone')return denied('tombstoned','source_tombstone');
  if(g.retention.mode==='restricted')return denied('restricted','retention_restricted');
  if(!g.operations.store)return denied('restricted','storage_not_permitted');
  if(g.retention.until===null||Date.parse(g.retention.until)>Date.parse(g.validUntil))return denied('unavailable','unknown_grant');
  if(Date.parse(g.retention.until)<=now)return denied('tombstoned','retention_expired');
  if((purpose==='display'||purpose==='save')&&!g.operations.display)return denied('restricted','display_not_permitted');
  if(purpose==='export'&&!g.operations.export)return denied('restricted','export_not_permitted');
 }
 return {state:'retained',reason:null};
}
function record(recordId:string,kind:Kind,value:unknown,grants:Grant[],options:RetentionOptions,invalid=false,extraDependencies:string[]=[],originallyVisible=true):Field {
 const sorted=[...grants].sort((a,b)=>compareText(canonicalJson(a),canonicalJson(b)));
 const sourceIds=unique(sorted.map(g=>g.sourceId)),withdrawalIds=unique([...extraDependencies,...sorted.flatMap(g=>[g.sourceId,g.policyId,g.policyVersion])]);
 const status=decide(sorted,withdrawalIds,options,'save',invalid);
 return field.parse({recordId,kind,sourceIds,withdrawalIds,originallyVisible,...status,grants:sorted,value:status.state==='retained'?payloads[kind].parse(value):null});
}
function envelope(fields:Field[],savedAt:string,options:RetentionOptions,purpose:Purpose):RetainedEvidence {
 if(!Number.isFinite(Date.parse(options.now)))throw Error('Retention projection requires a valid time');
 const count=fields.filter(row=>row.state==='retained').length;
 return deepFreeze(RetainedEvidenceSchema.parse({version:'part-four-retained-evidence/v1',savedAt,projectedAt:options.now,purpose,state:!fields.length?'empty':count===fields.length?'complete':count?'partial':'unavailable',fields:fields.sort((a,b)=>compareText(`${a.recordId}:${a.kind}`,`${b.recordId}:${b.kind}`))}));
}

/** Construct only source-dependent saved fields from already admitted artifacts.
 * Never copy an input artifact, recommendation, affordability text or arbitrary
 * JSON container. Formula/ingredient ownership remains with the canonical save
 * envelope, independently of this projection. Source IDs/policy IDs are assumed
 * to be service-owned opaque metadata, not URLs or protected content. */
export function createRetainedEvidence(input:{value?:unknown;brief?:unknown;science?:{manifest:ScientificManifest;packet:ScientificDecisionPacket}},options:RetentionOptions):RetainedEvidence {
 if(!Number.isFinite(Date.parse(options.now)))throw Error('Retention projection requires a valid time');
 const fields:Field[]=[];
 const value=z.object({state:z.enum(['ready','pending','unavailable']),unitPrices:z.array(z.unknown()).max(100)}).safeParse(input.value);
 if(value.success&&value.data.state==='ready')for(const [index,raw] of value.data.unitPrices.entries()){
  const parsed=unitPrice.safeParse(raw);
  if(!parsed.success){fields.push(record(sha256(`unsupported-offer:${index}`),'offer_price',null,[],options,true,[],false));continue;}
  const o=parsed.data,recordId=sha256(canonicalJson([o.choiceId,o.offerId,o.sourceId]));
  const groups=new Map(OFFER_FIELDS.map(name=>[name,{grants:[] as Grant[],invalid:false}]));
  let unsupported=false;
  for(const raw of o.rights.fields){
   const name=(raw&&typeof raw==='object'&&'field' in raw)?raw.field:null;
   const group=groups.get(name as typeof OFFER_FIELDS[number]);
   if(!group){unsupported=true;continue;}
   const parsed=rawGrant.safeParse(raw);
   if(!parsed.success){group.invalid=true;continue;}
   const g:Grant={...parsed.data,revoked:parsed.data.revoked??false};
   if(g.sourceId!==o.sourceId&&g.field!=='seller'){group.invalid=true;continue;}
   const existing=group.grants.find(prior=>prior.sourceId===g.sourceId&&prior.field===g.field);
   if(existing){if(canonicalJson(existing)!==canonicalJson(g))group.invalid=true;}
   else group.grants.push(g);
  }
  const bodies:Record<typeof OFFER_FIELDS[number],unknown>={identity:{choiceId:o.choiceId,offerId:o.offerId,sizeAmount:o.sizeAmount,packCount:o.packCount,unit:o.unit,market:o.market},price:{amount:o.amount,currency:o.currency},merchant:{merchantId:o.merchantId,merchant:o.merchant},seller:{sellerId:o.sellerId,sellerName:o.sellerName,sellerRelationship:o.sellerRelationship},fulfillment:{fulfillment:o.fulfillment},availability:{condition:'new',availability:'in_stock'},conditions:{conditions:o.conditions},dates:{observedAt:o.observedAt,validUntil:o.validUntil,qualifiedUntil:o.qualifiedUntil}};
  const all:Grant[]=[];let anyInvalid=unsupported;
  for(const name of OFFER_FIELDS){
   const group=groups.get(name)!;
   const invalid=unsupported||group.invalid||!group.grants.some(g=>g.sourceId===o.sourceId);
   anyInvalid||=invalid;all.push(...group.grants);
   fields.push(record(recordId,`offer_${name}` as Kind,bodies[name],group.grants,options,invalid));
  }
  // A listing URL may repeat protected prices in path/query parameters. Its
  // retention/export therefore depends on every field grant, never seller alone.
  fields.push(record(recordId,'offer_source',{url:o.sourceUrl},all,options,anyInvalid));
 }
 if(input.brief!==undefined&&input.brief!==null){
  const parsed=ProductResearchBriefSchema.safeParse(input.brief);
  if(!parsed.success||parsed.data.contentHash!==researchBriefHash(parsed.data))fields.push(record(sha256('unsupported-brief'),'brief_header',null,[],options,true,[],false));
  else {
   const b=parsed.data,recordId=sha256(canonicalJson(['brief',b.revision,b.productId,b.variantId]));
   const dependencies=[b.revision,b.contentHash,b.productId,b.variantId,b.reviewerId,...(b.formulaVersionId?[b.formulaVersionId]:[])];
   const grants=new Map(b.sources.map(source=>{
    const until=new Date(Math.min(Date.parse(b.validUntil),Date.parse(source.permission.validUntil))).toISOString();
    const g:Grant={sourceId:source.id,field:'brief',policyId:source.permission.grantId,policyVersion:source.permission.version,validUntil:until,operations:{process:source.permission.process,store:source.permission.store,display:source.permission.display,export:source.permission.export},retention:{mode:'retain_until',until},revoked:source.permission.revoked};
    return [source.id,g] as const;
   }));
   const all=[...grants.values()];
   fields.push(record(recordId,'brief_header',{revision:b.revision,productId:b.productId,variantId:b.variantId,formulaVersionId:b.formulaVersionId,coverageLimit:b.coverageLimit,reviewedAt:b.reviewedAt,reviewerId:b.reviewerId,reviewDecision:b.reviewDecision,validUntil:b.validUntil},all,options,grants.size!==b.sources.length,dependencies));
   for(const source of b.sources)fields.push(record(sha256(canonicalJson([recordId,source.id])),'brief_source',{title:source.title,url:source.url,kind:source.kind,retrievedAt:source.retrievedAt,publishedAt:source.publishedAt,matching:source.matching,productId:source.productId,variantId:source.variantId,formulaVersionId:source.formulaVersionId,coverageLimit:source.coverageLimit},[grants.get(source.id)!],options,false,dependencies));
   for(const observation of b.observations){
    const refs=unique([...observation.sourceIds,...observation.opposingSourceIds]);
    fields.push(record(sha256(canonicalJson([recordId,observation.id])),'brief_observation',{text:observation.text,kind:observation.kind,scope:observation.scope,sourceIds:observation.sourceIds,opposingSourceIds:observation.opposingSourceIds},refs.flatMap(id=>grants.has(id)?[grants.get(id)!]:[]),options,refs.some(id=>!grants.has(id)),dependencies));
   }
  }
 }
 if(input.science){
  const m=ScientificManifestSchema.safeParse(input.science.manifest),p=ScientificDecisionPacketSchema.safeParse(input.science.packet);
  if(!m.success||!p.success||m.data.contentHash!==scientificManifestHash(m.data)||m.data.contentHash!==p.data.manifestHash)fields.push(record(sha256('unsupported-scientific-manifest'),'scientific_claim',null,[],options,true,[],false));
  else for(const row of p.data.assessments.filter(row=>['supported','reference'].includes(row.assessment.state))){
   const a=row.assessment,claim=m.data.claims.find(c=>c.id===a.claimId&&scientificClaimHash(c)===a.claimHash);
   const matches=claim?m.data.admissions.filter(v=>v.claimId===a.claimId&&v.claimHash===a.claimHash&&v.status==='approved'&&v.reviewerId===a.admissionId&&canonicalJson([...v.sourcePins].sort())===canonicalJson(claim.sourceRefs.map(claimSourcePin).sort())):[];
   const admission=matches.length===1?matches[0]:null;
   const sources=claim&&admission?p.data.sourceRefs.filter(s=>s.reviewedAt===admission.reviewedAt&&s.validUntil===a.validUntil).filter(s=>{const {reviewedAt:_,validUntil:__,...rest}=s;return claim.sourceRefs.some(ref=>canonicalJson(ref)===canonicalJson(rest));}):[];
   const invalid=!claim||!admission||!a.validUntil||Date.parse(a.validUntil)<=Date.parse(options.now)||Date.parse(admission.reviewedAt)>Date.parse(options.now)||a.reason!==claim.copy.reason||canonicalJson(a.reasons)!==canonicalJson([...claim.copy.qualifications,...claim.endpoint.limitations])||sources.length!==claim.sourceRefs.length||sources.some(s=>s.reviewedAt!==admission.reviewedAt||s.validUntil!==a.validUntil)||Date.parse(a.validUntil)>Math.min(Date.parse(admission.validUntil),Date.parse(admission.rights.validUntil));
   const grants:Grant[]=admission&&a.validUntil?claim!.sourceRefs.map(s=>({sourceId:s.id,field:'science',policyId:admission.rights.grantId,policyVersion:admission.rights.version,validUntil:a.validUntil!,operations:{process:admission.rights.process,store:admission.rights.store,display:admission.rights.display,export:admission.rights.export},retention:{mode:'retain_until',until:a.validUntil!},revoked:admission.rights.revoked})):[];
   const dependencies=[p.data.manifestHash,a.claimId,a.claimHash,...a.factIds,...a.contextRevisionIds,...a.sourceIds,...(claim?claim.sourceRefs.flatMap(s=>[s.url,claimSourcePin(s),...(s.bodySha256?[s.bodySha256]:[])]):[]),...(admission?[admission.reviewerId,admission.qualificationRef]:[])];
   fields.push(record(sha256(canonicalJson([p.data.manifestHash,a.claimHash,row.goal])),'scientific_claim',{manifestHash:p.data.manifestHash,goal:row.goal,assessment:a,sources},grants,options,invalid,dependencies));
  }
 }
 return envelope(fields,options.now,options,'save');
}

/** Read/maintenance/export projection of the stored whitelist only. Never feed
 * a current source artifact into historical replay to repopulate missing bytes.
 * Persist the 'retain' projection atomically on lifecycle changes; an export
 * projection restricts transport without modifying the independent stored copy. */
export function reprojectRetainedEvidence(value:unknown,options:ReprojectionOptions):RetainedEvidence {
 const parsed=RetainedEvidenceSchema.safeParse(value);
 if(!parsed.success)return envelope([],options.now,options,options.purpose);
 const fields=parsed.data.fields.map(row=>{
  if(row.state!=='retained'||row.value===null)return row;
  const status=decide(row.grants,row.withdrawalIds,options,options.purpose);
  return field.parse({...row,...status,value:status.state==='retained'?row.value:null});
 });
 return envelope(fields,parsed.data.savedAt,options,options.purpose);
}
