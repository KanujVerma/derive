import {REVIEWED_USEFULNESS_MANIFEST} from '../../../src/domain/part-four/reviewedUsefulness.ts';
import { assessScientificDecision, scientificManifestHash } from '../../../src/domain/part-four/scientificDecision.ts';
import { ScientificManifestSchema, type ScientificManifest } from '../../../src/contracts/ScientificClaim.ts';
import { APPROVED_INGREDIENT_KNOWLEDGE, APPROVED_37_INGREDIENT_KNOWLEDGE } from '../../../src/domain/part-four/knowledge.ts';
import { resolveCurrentComparator } from '../../../src/domain/part-four/comparison.ts';
import { ISOLATED_423_EDUCATION } from '../../../src/domain/part-four/knowledge423.ts';
import { assembleFoundation } from '../../../src/domain/part-four/assemble.ts';
import { partFourBindingRelease } from '../../../src/domain/part-four/release.ts';
import { planRoutineFormulaRequests, admitRoutineFormulaEvidence } from '../../../src/domain/part-four/routineFormula.ts';
import {PartThreeRequestSchema,PartThreeResponseSchema,type PartThreeEvaluateRequest,type PartThreeResponse,type CandidateIdentity} from '../../../src/contracts/PartThreeService.ts';
import {DecisionBindingV2Schema,PersonalResultV2Schema,type DecisionBindingV2} from '../../../src/contracts/PersonalResultV2.ts';
import {NormalizationResultSchema,type NormalizationResult} from '../../../src/contracts/PartTwo.ts';
import type {PersonalContextV2} from '../../../src/contracts/PersonalContextV2.ts';
import {personalContextV2Schema} from '../../../src/contracts/PersonalContextV2Schema.ts';
import {evaluatePersonalResult,type HistoryResult,type PersonalEvaluationInput} from '../../../src/domain/part-three/evaluate.ts';
import {retrieveDecisionHistory,type HistoryPageV2} from '../../../src/domain/part-three/history.ts';
import {selectedPartThreeRelease,type PartThreeReleaseSelection} from '../../../src/domain/part-three/release.ts';
import {eligibleMenuFor} from '../../../src/domain/part-three/menu.ts';
import {canonicalJson,sha256} from '../../../src/domain/part-two/hash.ts';
import type {DecisionProvider,AuthorizedProjection,NormalizedSelection} from '../../../src/domain/part-three/provider.ts';
export class PartThreeError extends Error{readonly code:string;readonly status:number;constructor(code:string,status=409){super(code);this.code=code;this.status=status;}}
export interface PartThreePorts {partFourComposition?:'reviewed_usefulness';releaseSelection?:PartThreeReleaseSelection;partFourDecisionEvidence?:{manifest:ScientificManifest;load:(binding:DecisionBindingV2,input:{partTwo:NormalizationResult;context:PersonalContextV2;requestedUse:PersonalEvaluationInput['requestedUse'];routineFormulaEvidence:readonly unknown[];knowledge:import('../../../src/domain/part-four/knowledge.ts').IngredientKnowledgeRelease})=>Promise<unknown>};partFourEnabled?:boolean;partFourEducation?:'approved47'|'approved423';ownerId:string;now:()=>string;normalize:(r:PartThreeEvaluateRequest)=>Promise<NormalizationResult>;context:()=>Promise<PersonalContextV2>;history:(revision:number,scope:HistoryResult['requestedScopes'][number],cursor:string|null)=>Promise<HistoryPageV2>;worker:(action:string,payload:Record<string,unknown>)=>Promise<any>;identity?:(scanId:string,generation:number,revision:number,snapshotId:string|null,pinnedSnapshotId:string|null,captureSessionId:string|null)=>Promise<(Pick<CandidateIdentity,'name'|'expiresAt'>&Partial<Pick<CandidateIdentity,'catalogReference'>>)|null>;provider?:(model:string)=>DecisionProvider;defer?:(work:()=>Promise<void>)=>void}
function makeBinding(r:PartThreeEvaluateRequest,p:NormalizationResult,c:PersonalContextV2,identity:Partial<CandidateIdentity>|null,partFourEnabled=false,partFourEducation?:'approved47'|'approved423',scientificHash?:string,releaseSelection?:PartThreeReleaseSelection,composition?:'reviewed_usefulness'):DecisionBindingV2{
 const {semantic:release,releaseHash}=selectedPartThreeRelease(releaseSelection);
 if(p.state!=='ready')throw new PartThreeError('evidence_unavailable',503);
 const s=p.output.reading,d=p.output.kind==='bound'?p.output.productFacts.binding:null;
 const subject:DecisionBindingV2['subject']=d?.kind==='declaration'?{kind:'declaration',itemId:d.itemId,snapshotId:d.snapshotId,declarationId:d.declarationId,declarationRevision:d.declarationRevision,productId:identity?.catalogReference?.productId??null,variantId:identity?.catalogReference?.variantId??null,formulaVersionId:identity?.catalogReference?.formulaVersionId??null,packageScope:d.packageConfirmation==='unconfirmed'?'published_version':'confirmed_package'}:{kind:'source_reading',captureSessionId:r.captureSessionId!,observationId:s.dependencyManifest.sourceRefs[0].observationId};
 return DecisionBindingV2Schema.parse({ownerId:c.ownerId,accountGeneration:r.accountGeneration,encounterId:r.encounterId,attemptId:r.requestId,generation:r.generation,intent:r.intent,comparatorId:r.comparatorId,encounterInputs:{candidateRoutineItemId:r.candidateRoutineItemId,selectedManualReportIds:r.selectedManualReportIds,use:r.use},subject,scanId:p.scanId,captureSessionId:p.captureSessionId,partOneGeneration:p.generation,partOneRevision:p.evidenceRevision,partTwoRevision:p.resultRevision,partTwoBindingKey:p.bindingKey,sourceDigest:s.dependencyManifest.dependencyDigest,fieldPermissionEpoch:s.dependencyManifest.policyEpoch,deletionEpoch:s.dependencyManifest.deletionEpoch,policyEpoch:s.dependencyManifest.policyEpoch,dictionaryEpoch:s.dependencyManifest.dictionaryEpoch,contextRevision:c.revision,profileRevision:c.profile?.id??null,routineRevision:c.routine?.id??null,historyRevision:c.historyRevision,assessmentRevisions:[...new Set(c.assessments.map(x=>x.id))],preferenceRevisions:[...new Set(c.preferences.map(x=>x.id))],noteRevisions:[...new Set(c.notes.map(x=>x.id))],overlayRevision:null,releases:{releaseHash:releaseHash,rule:release.rule,evidence:release.evidence,question:release.question,template:release.template,policy:release.policy,dictionary:s.versions.dictionary,locale:'en',...(partFourEnabled?{partFour:{...partFourBindingRelease(partFourEducation,scientificHash,composition),...(scientificHash?{scientificManifestHash:scientificHash}:{})}}:{})},refinement:null});
}
export async function handlePersonalRequest(raw:unknown,ports:PartThreePorts):Promise<PartThreeResponse>{
 if(ports.partFourComposition==='reviewed_usefulness'&&(!ports.partFourEnabled||ports.partFourDecisionEvidence?.manifest.contentHash!==REVIEWED_USEFULNESS_MANIFEST.contentHash))throw new PartThreeError('invalid_part_four_composition',503);
 const {semantic:release}=selectedPartThreeRelease(ports.releaseSelection);
 const parsed=PartThreeRequestSchema.safeParse(raw);if(!parsed.success)throw new PartThreeError('invalid_request',400);const r=parsed.data;
 const savedInput=async(savedAssessmentId:string)=>{const saved=await ports.worker('saved/input',{savedAssessmentId});const packet=saved.partTwo;
 // Stored Part2 snapshots omit the per-request envelope ID. Rehydrate only this
 // transport field from the immutable server-owned binding, as Part2 saved reads do.
 if(packet?.state==='ready'){const requestId=packet.output?.reading?.binding?.requestId;if(typeof requestId!=='string')throw new PartThreeError('changed_basis',409);const snapshot=(value:any)=>value?{...value,binding:{...value.binding,requestId}}:value;saved.partTwo={...packet,requestId,output:{...packet.output,reading:snapshot(packet.output.reading),...(packet.output.kind==='bound'?{productFacts:snapshot(packet.output.productFacts)}:{})}};}
 return saved;};
 if(r.operation==='saved_basis'){const saved=await savedInput(r.savedAssessmentId);return PartThreeResponseSchema.parse({kind:'saved_basis',partTwo:saved.partTwo??null,pinnedSnapshotId:saved.pinnedSnapshotId??null,request:saved.request??null});}
 if(r.operation!=='evaluate'&&r.operation!=='identity'){const payload={...r};delete (payload as any).operation;return PartThreeResponseSchema.parse(await ports.worker(r.operation,payload));}
 let p:NormalizationResult,pinnedSnapshotId:string|null=null;
 if(r.savedAssessmentId){const saved=await savedInput(r.savedAssessmentId);if(!saved.partTwo)return {kind:'unavailable',reason:'historical_only'};p=NormalizationResultSchema.parse(saved.partTwo);pinnedSnapshotId=saved.pinnedSnapshotId;}
 else p=NormalizationResultSchema.parse(await ports.normalize({...r,operation:'evaluate'}));
 if(p.scanId!==r.scanId||p.captureSessionId!==r.captureSessionId||p.generation!==r.expectedPartOneGeneration||p.evidenceRevision!==r.expectedPartOneRevision)throw new PartThreeError('changed_basis');
 if(p.state!=='ready')return {kind:'unavailable',reason:'evidence_unavailable'};
 if(p.authenticatedOwnerId!==ports.ownerId)throw new PartThreeError('forbidden',403);
 const declaration=p.output.kind==='bound'?p.output.productFacts.binding:null;
 const identity=ports.identity?await ports.identity(p.scanId,p.generation,p.evidenceRevision,declaration?.kind==='declaration'?declaration.snapshotId:null,pinnedSnapshotId,p.captureSessionId):null;
 if(r.operation==='identity')return PartThreeResponseSchema.parse({kind:'identity',identity:identity?{...identity,catalogReference:identity.catalogReference??null}:null});
 const c=personalContextV2Schema.parse(await ports.context());if(c.ownerId!==ports.ownerId||p.authenticatedOwnerId!==ports.ownerId)throw new PartThreeError('forbidden',403);
 const explicit=c.routine?.data.items.find(x=>x.id===r.comparatorId);if(r.comparatorId&&!explicit||r.candidateRoutineItemId&&!c.routine?.data.items.some(x=>x.id===r.candidateRoutineItemId))throw new PartThreeError('invalid_comparator',400);
 // No incoming origin claim or derived ID is trusted. Keep the original choice
 // in the stored request, derive the canonical comparator before history and
 // binding, and let packet assembly explain that same original choice.
 const selection=ports.partFourEnabled?resolveCurrentComparator({routine:c.routine?.data??null,requestedUse:r.use,candidateRoutineItemId:r.candidateRoutineItemId,selectedComparatorId:r.comparatorId,candidateReference:identity?.catalogReference?{kind:'catalog',...identity.catalogReference}:null}):null;
 if(r.comparatorId&&selection?.comparison.state==='unavailable')throw new PartThreeError('invalid_comparator',400);
 const evaluationRequest:PartThreeEvaluateRequest=selection?{...r,comparatorId:selection.comparatorId}:r;
 const selected=c.routine?.data.items.find(x=>x.id===evaluationRequest.comparatorId);
 const currentItem=c.routine?.data.items.find(x=>x.id===r.candidateRoutineItemId);
 const scopes:HistoryResult['requestedScopes']=[];
 if(identity?.catalogReference)scopes.push({kind:'catalog',productId:identity.catalogReference.productId});
 if(currentItem?.reference.kind==='manual')scopes.push({kind:'manual',recordId:currentItem.id,name:currentItem.reference.name});
 if(currentItem?.reference.kind==='catalog')scopes.push({kind:'catalog',productId:currentItem.reference.productId});
 if(selected?.reference.kind==='manual')scopes.push({kind:'manual',recordId:selected.id,name:selected.reference.name});
 if(selected?.reference.kind==='catalog')scopes.push({kind:'catalog',productId:selected.reference.productId});
 for(const record of c.experiences)if(record.data.reference.kind==='manual'&&r.selectedManualReportIds.includes(record.data.id))scopes.push({kind:'manual',recordId:record.data.id});
 const retrieved=scopes.length?await retrieveDecisionHistory(scopes,c.revision,(scope,cursor)=>ports.history(c.revision,scope,cursor)):null;
 const context=structuredClone(c);if(retrieved){const all=new Map(context.experiences.map(x=>[x.data.id,x]));for(const item of retrieved.records)all.set(item.data.id,item);context.experiences=[...all.values()];}
 personalContextV2Schema.parse(context);

 const history:HistoryResult=retrieved?.history??{requestedScopes:[],atRevision:c.revision,activeRevisionIds:[...new Set(context.experiences.map(x=>x.id))],completeness:c.historyTruncated?'incomplete':'complete',reason:c.historyTruncated?'cap':'complete'};
 if(retrieved&&c.historyTruncated&&r.selectedManualReportIds.some(id=>!context.experiences.some(x=>x.data.id===id))){history.completeness='incomplete';history.reason='cap';}
 const suppression=await ports.worker('encounter/read',{encounterId:r.encounterId});
 const scientificManifest=ports.partFourEnabled&&ports.partFourDecisionEvidence?ScientificManifestSchema.parse(ports.partFourDecisionEvidence.manifest):null;
 if(scientificManifest&&scientificManifest.contentHash!==scientificManifestHash(scientificManifest))throw new PartThreeError('evidence_unavailable');
 const binding=makeBinding(evaluationRequest,p,c,identity,ports.partFourEnabled,ports.partFourEducation,scientificManifest?.contentHash,ports.releaseSelection,ports.partFourComposition),validUntil=new Date(Math.min(Date.parse(p.expiresAt),Date.parse(ports.now())+60000,...(identity?[Date.parse(identity.expiresAt)]:[]))).toISOString();
 const lease=await ports.worker('prepare',{binding,request:r,pinnedSnapshotId,validUntil,sourceRefs:p.output.reading.dependencyManifest.sourceRefs,contextRefs:[...new Set([c.profile?.id,c.routine?.id,...context.experiences.map(x=>x.id),...c.preferences.map(x=>x.id),...c.assessments.map(x=>x.id),...c.notes.map(x=>x.id)].filter((x):x is string=>Boolean(x)))]});
 if(lease.kind==='unavailable')return PartThreeResponseSchema.parse(lease);if(lease.cached)return {kind:'result',result:PersonalResultV2Schema.parse(lease.cached),replayed:true};if(lease.pending)return {kind:'unavailable',reason:'evidence_unavailable'};
 // Sample decision time only after the independently authorized routine lookup.
 // Its checkedAt cannot be later than the evaluation consuming that evidence.
 const knowledge=ports.partFourEducation==='approved423'?ISOLATED_423_EDUCATION:ports.partFourEducation==='approved47'?APPROVED_INGREDIENT_KNOWLEDGE:APPROVED_37_INGREDIENT_KNOWLEDGE;
 const routineRequests=ports.partFourEnabled?planRoutineFormulaRequests(context,knowledge).requests:[];
 const routineEvidence=routineRequests.length?await ports.worker('routine/formulas',{requests:routineRequests}):[];
 const scientificDecision=scientificManifest?assessScientificDecision({manifest:scientificManifest,evidence:await ports.partFourDecisionEvidence!.load(binding,{partTwo:p,context,requestedUse:r.use,routineFormulaEvidence:routineEvidence,knowledge}),context,partTwo:p,now:ports.now()}):undefined;
 const result=evaluatePersonalResult({releaseSelection:ports.releaseSelection,scientificDecision,binding,partTwo:p,context,history,now:ports.now(),resultId:lease.resultId,resultRevision:lease.resultRevision,name:identity&&Date.parse(identity.expiresAt)>Date.parse(ports.now())?identity.name:p.output.reading.binding.kind==='declaration'?'Selected product':'Label reading',requestedUse:r.use,selectedManualReportIds:r.selectedManualReportIds,candidateRoutineItemId:r.candidateRoutineItemId,questionSuppression:{exposedQuestionId:suppression.exposedQuestionId??null,skip:Boolean(suppression.skip),answered:Boolean(suppression.answered)}});
 result.validUntil=new Date(Math.min(Date.parse(result.validUntil),Date.parse(validUntil),...(scientificDecision?.assessments.filter(row=>['supported','reference'].includes(row.assessment.state)&&row.assessment.validUntil).map(row=>Date.parse(row.assessment.validUntil!))??[]))).toISOString();
 if(ports.partFourEnabled){
  // Formula authority is loaded independently by the authenticated worker.
  // Incoming requests never carry source, association or permission claims.
  const evidence=routineEvidence;
  const admission=admitRoutineFormulaEvidence(context,evidence,{now:result.evaluatedAt,knowledge});
  const packet=assembleFoundation({composition:ports.partFourComposition,releaseSelection:ports.releaseSelection,scientificDecision,scientificManifest:scientificManifest??undefined,context,partTwo:p,requestedUse:r.use,intent:r.intent,candidateRoutineItemId:r.candidateRoutineItemId,selectedComparatorId:r.comparatorId,candidateReference:identity?.catalogReference?{kind:'catalog',...identity.catalogReference}:null,routineFormulas:admission.qualified,routineFormulaEvidence:evidence,now:result.evaluatedAt},result);
  if(!packet)throw new PartThreeError('evidence_unavailable');result.partFour=packet;
  if(admission.validUntil)result.validUntil=new Date(Math.min(Date.parse(result.validUntil),Date.parse(admission.validUntil))).toISOString();
 }
 // The same live path hosts real provider wiring. Gate checks happen outside the
 // provider; no payload/grant/model is borrowed from incoming client JSON.
 const refine=async(currentResult:typeof result,currentLease:typeof lease)=>{
 const result=currentResult,lease=currentLease;
 const optional=result.findings.filter(f=>f.consequence==='optional'&&!f.mandatoryVisibility).slice(0,8);
 const menu=eligibleMenuFor(binding,result.findings,result.question);
 if(menu){const gate=await ports.worker('provider/gate',{encounterId:r.encounterId,resultId:lease.resultId,menu,fieldIds:['encounter_intent'],sourceFieldIds:[`encounter:${r.encounterId}:intent`],menuSourceFields:optional.flatMap(f=>f.dependencies.sourceFields),menuContextRefs:[...optional.flatMap(f=>f.dependencies.contextRevisionIds),...(result.question?[c.routine?.id,...c.assessments.map(a=>a.id)].filter((x):x is string=>Boolean(x)):[])],jobs:menu.jobs.map(j=>j.id)});
  if(gate.allowed&&gate.model===release.refinement.configuredModel&&ports.provider&&!suppression.interacted&&!suppression.exposedQuestionId){const projection:AuthorizedProjection={version:'part-three-provider-projection/v1',purpose:'optional_content_selection',approvalId:gate.approvalId,fields:[{id:'encounter_intent',value:r.intent==='add'||r.intent==='replace'||r.intent==='check_current'?r.intent:'unknown',externalOperationGrant:gate.grants[0],sourceFieldId:`encounter:${r.encounterId}:intent`}]};
   let choice:NormalizedSelection;try{choice=await ports.provider(gate.model).evaluate(projection,menu,new AbortController().signal,Date.parse(ports.now())+1500);}catch{choice={selectedTradeoffId:null,selectedQuestionId:null,provider:'jev',resolvedModel:null,usage:null,elapsedMs:0,contractVersion:'part-three-selection/v1',outcome:'unavailable'};}result.refinementStatus=choice.outcome;result.binding={...binding,refinement:{candidateSetHash:menu.candidateSetHash,projectionVersion:release.refinement.projection,promptVersion:release.refinement.prompt,adapterVersion:release.refinement.adapter,configuredModel:gate.model,resolvedModel:choice.resolvedModel}};
   result.refinementTrace={callId:gate.callId,menu,originalQuestion:result.question,baselineTradeoffId:result.selectedTradeoffId,selection:{...choice,provider:'jev'},applied:false};
   if(choice.outcome==='accepted'){const current=await ports.worker('encounter/read',{encounterId:r.encounterId});if(!current.interacted&&!current.exposedQuestionId){result.refinementTrace.applied=true;if(choice.selectedTradeoffId!==null)result.selectedTradeoffId=choice.selectedTradeoffId;if(choice.selectedQuestionId===null)result.question=null;}}
  }
 }
 return PartThreeResponseSchema.parse(await ports.worker('publish',{resultId:lease.resultId,leaseToken:lease.leaseToken,result:PersonalResultV2Schema.parse(result)}));
 };
 if(ports.defer){
  const baseline=PartThreeResponseSchema.parse(await ports.worker('publish',{resultId:lease.resultId,leaseToken:lease.leaseToken,result:PersonalResultV2Schema.parse(result)}));
  if(baseline.kind==='result'&&eligibleMenuFor(binding,result.findings,result.question)){ports.defer(async()=>{const continuation=await ports.worker('refinement/prepare',{resultId:result.resultId,expectedResultRevision:result.resultRevision,expectedBindingHash:sha256(canonicalJson(binding))});if(!continuation.leaseToken)return;await refine({...structuredClone(result),resultRevision:continuation.resultRevision},continuation);});}
  return baseline;
 }
 return refine(result,lease);
}
