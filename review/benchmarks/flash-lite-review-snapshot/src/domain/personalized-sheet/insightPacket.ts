import {validateObservedProductObservation} from './observedProductIdentity.ts';
import type {ObservedProductBinding} from './observedProductBinding.ts';
import {scopeKey,validateQuestion,type ScopedQuestion,type AnswerScope} from './scopedAnswers.ts';
import {digest,canonicalJson,type AdmittedClaim} from './evidenceAdmission.ts';
export type Action='keep_current'|'try_replacement'|'skip_candidate'|'verify_evidence';
interface InsightBasisCommon {
 ownerId:string;accountGeneration:number;
 contextRevision:number;routineRevision:string|null;answerRevision:number;sourceDigest:string;policyVersion:string;
 /** Hash of the complete validated Part Three binding, including use, intent,
  * comparator, source revisions, permissions, deletion epoch and releases. */
 decisionBindingHash:string;
}
export type CatalogInsightBasis=InsightBasisCommon & {productId:string;variantId:string;formulaVersionId:string|null;observedProduct?:never};
export type ObservedInsightBasis=InsightBasisCommon & {productId:null;variantId:null;formulaVersionId:null;observedProduct:ObservedProductBinding};
export type InsightBasis=CatalogInsightBasis|ObservedInsightBasis;

export interface PersonalFact {id:string;text:string;revision:string;scope:AnswerScope|null;validUntil:string|null}
export interface DecisionUseContext {
 candidateName:string;comparatorName:string|null;
 intent:'add'|'replace'|'check_current'|'unanswered'|'unsure'|'withheld';
 purpose:'moisturizing'|'cleansing'|'sun_protection'|'other'|null;
 site:'face'|'body'|'hands'|'scalp'|'lips'|'eye_area'|'other'|null;
 useForm:'leave_on'|'rinse_off'|'other'|null;
}
export interface InsightInput {
 dataMode:'synthetic'|'personal';productContext:DecisionUseContext;basis:InsightBasis;evidence:readonly AdmittedClaim[];personalFacts:readonly PersonalFact[];
 allowedActions:readonly Action[];mandatoryCautionIds:readonly string[];
 allowedQuestions:readonly ScopedQuestion[];now:string;validUntil:string;
}
export interface InsightPoint {id:string;title:string;body:string;evidenceIds:string[];personalFactIds:string[]}
export interface InsightProposal {
 action:Action;headline:string;reason:string;nextStep:string;
 why:InsightPoint[];tradeoffs:InsightPoint[];
 selectedQuestionId:string|null;cautionIds:string[];
}
export interface SourceDependency {id:string;version:string;bodyHash:string;rightsRevision:string}
export interface InsightPacket {sourceDependencies:SourceDependency[];version:'personalized-sheet/v1';basis:InsightBasis;basisHash:string;packetHash:string;generatedAt:string;validUntil:string;model:string;proposal:InsightProposal}
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const unique=(a:readonly string[])=>new Set(a).size===a.length;
const clean=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export async function basisHash(input:InsightInput):Promise<string>{
 // Public research cache and personal decision cache deliberately use different identities.
 return digest({dataMode:input.dataMode,basis:input.basis,productContext:input.productContext,evidence:input.evidence,personalFacts:input.personalFacts,allowedActions:input.allowedActions,mandatoryCautionIds:input.mandatoryCautionIds,allowedQuestions:input.allowedQuestions,validUntil:input.validUntil});
}
export function validateProposal(input:InsightInput,proposal:InsightProposal):InsightProposal {
 if(!proposal||typeof proposal!=='object'||Object.keys(proposal).sort().join()!=='action,cautionIds,headline,nextStep,reason,selectedQuestionId,tradeoffs,why')throw Error('invalid_proposal_shape');
 if(!input.allowedActions.includes(proposal.action))throw Error('disallowed_action');
 if(!text(proposal.headline,80)||!text(proposal.reason,360)||!text(proposal.nextStep,200)||!Array.isArray(proposal.why)||proposal.why.length<1||proposal.why.length>3||!Array.isArray(proposal.tradeoffs)||proposal.tradeoffs.length>2)throw Error('invalid_copy');
 if(!Array.isArray(proposal.cautionIds)||!unique(proposal.cautionIds)||input.mandatoryCautionIds.some(id=>!proposal.cautionIds.includes(id))||proposal.cautionIds.some(id=>!input.mandatoryCautionIds.includes(id)))throw Error('lost_or_invented_caution');
 const e=new Map(input.evidence.map(x=>[x.claim.id,x])),p=new Map(input.personalFacts.map(x=>[x.id,x]));
 if(e.size!==input.evidence.length||p.size!==input.personalFacts.length)throw Error('ambiguous_reference');
 const points=[...proposal.why,...proposal.tradeoffs];
 if(!unique(points.map(x=>x.id))||!unique(points.map(x=>clean(x.body))))throw Error('duplicate_insight');
 for(const point of points){
  if(!point||Object.keys(point).sort().join()!=='body,evidenceIds,id,personalFactIds,title'||!text(point.id,100)||!text(point.title,80)||!text(point.body,450)||!Array.isArray(point.evidenceIds)||!Array.isArray(point.personalFactIds)||!point.personalFactIds.length)throw Error('non_personal_insight');
  if(!unique(point.evidenceIds)||!unique(point.personalFactIds)||point.evidenceIds.some(id=>!e.has(id))||point.personalFactIds.some(id=>!p.has(id)))throw Error('unknown_reference');
 }
 if(proposal.selectedQuestionId!==null){const q=input.allowedQuestions.find(q=>q.id===proposal.selectedQuestionId);if(!q)throw Error('invented_question');validateQuestion(q);scopeKey(q.scope);}
 return proposal;
}
function observedBasisExpiry(basis:InsightBasis,now:string):number|null {
 if(!basis.observedProduct)return null;
 const value=basis.observedProduct;
 if(basis.productId!==null||basis.variantId!==null||basis.formulaVersionId!==null||value.version!=='observed-product-binding/v1'
  ||value.decisionBindingHash!==basis.decisionBindingHash||!Number.isSafeInteger(value.continuityGeneration)||value.continuityGeneration<0)throw Error('invalid_observed_basis');
 const observation=validateObservedProductObservation(value.observation);
 if(Date.parse(observation.observedAt)>Date.parse(now))throw Error('future_observation');
 return Date.parse(observation.validUntil);
}
export async function admitProposal(input:InsightInput,proposal:InsightProposal,model:string):Promise<InsightPacket>{
 const now=Date.parse(input.now);if(!Number.isFinite(now)||!Number.isFinite(Date.parse(input.validUntil))||Date.parse(input.validUntil)<=now)throw Error('expired_basis');
 const observedExpiry=observedBasisExpiry(input.basis,input.now);
 const expiries=[Date.parse(input.validUntil),...(observedExpiry===null?[]:[observedExpiry]),...input.evidence.map(e=>Date.parse(e.validUntil)),...input.personalFacts.filter(p=>p.validUntil!==null).map(p=>Date.parse(p.validUntil!))];
 if(expiries.some(t=>!Number.isFinite(t)||t<=now))throw Error('expired_evidence_or_context');
 if(!text(model,100))throw Error('invalid_model');
 const dependencyMap=new Map<string,SourceDependency>();
 for(const evidence of input.evidence){const source=evidence.source,dependency={id:source.id,version:source.version,bodyHash:source.bodyHash,rightsRevision:source.rightsRevision};const existing=dependencyMap.get(source.id);if(existing&&JSON.stringify(existing)!==JSON.stringify(dependency))throw Error('conflicting_source_dependency');dependencyMap.set(source.id,dependency);}
 const sourceDependencies=[...dependencyMap.values()].sort((a,b)=>a.id.localeCompare(b.id));
 const packet={sourceDependencies,version:'personalized-sheet/v1' as const,basis:structuredClone(input.basis),basisHash:await basisHash(input),generatedAt:input.now,validUntil:new Date(Math.min(...expiries)).toISOString(),model,proposal:structuredClone(validateProposal(input,proposal))};
 return {...packet,packetHash:await digest(packet)};
}
export async function canReusePacket(packet:InsightPacket,input:InsightInput):Promise<boolean>{
 try{validateProposal(input,packet.proposal);const expiry=observedBasisExpiry(input.basis,input.now);if(expiry!==null&&expiry<=Date.parse(input.now))return false;}catch{return false;}
 const {packetHash,...content}=packet;
 if(packetHash!==await digest(content)||Date.parse(packet.generatedAt)>Date.parse(input.now)||Date.parse(input.validUntil)<=Date.parse(input.now))return false;
 return packet.version==='personalized-sheet/v1'&&packet.basis.ownerId===input.basis.ownerId&&packet.basis.accountGeneration===input.basis.accountGeneration&&canonicalJson(packet.basis)===canonicalJson(input.basis)&&Date.parse(packet.validUntil)>Date.parse(input.now)&&packet.basisHash===await basisHash(input);
}
/** This structural admission is necessary, not proof that generated prose is semantically true.
 * Production acceptance additionally requires evidence-entailment evaluation and regression
 * benchmarks. The renderer must never present an unadmitted provider payload. */
