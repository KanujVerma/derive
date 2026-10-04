import {PENDING_SCIENTIFIC_MANIFEST} from '../../src/domain/part-four/scientificDecision.ts';
import assert from 'node:assert/strict';
import {sha256} from '../../src/domain/part-two/hash.ts';
import {normalize} from '../../src/domain/part-two/index.ts';
import {ORDINARY_PART_THREE_RELEASE_SELECTION as release} from '../../src/domain/part-three/release.ts';
import {p2id,boundDeclaration} from './part-two-core.ts';
import {p3context,p3routine,p3revision} from './part-three.ts';
import {handlePersonalRequest,type PartThreePorts} from '../../supabase/functions/part-three/handler.ts';
import {projectScientificFeatures} from '../../src/domain/part-four/featureProjection.ts';
import {decisionCopy} from '../../src/presentation/part-three/copy.ts';
import {planRoutineFormulaRequests,type RoutineFormulaReadyEvidence} from '../../src/domain/part-four/routineFormula.ts';
import {ISOLATED_423_EDUCATION} from '../../src/domain/part-four/knowledge423.ts';
import {partFourClientBinding,parsePartFourClientSelection} from '../../src/domain/part-four/clientRelease.ts';
export const api=await import('../../src/domain/part-four/reviewedUsefulness.ts').catch(()=>null);
export const now='2026-10-04T13:00:00.000Z',until='2026-10-05T13:00:00.000Z';
export const dated=<T>(v:T):T=>JSON.parse(JSON.stringify(v).replaceAll('2026-10-02T10:00:00Z',now).replaceAll('2026-10-03T10:00:00Z',until));
export function label(ingredients:string,text:string){const input=dated(boundDeclaration(ingredients,'public'));const source=input.sourceRefs[0],sourceText=ingredients+'\npurpose: '+text,start=sourceText.length-text.length;
 source.sourceTextHash=sha256(sourceText);
 input.labelAssertions=[{assertionId:p2id(140),assertionKind:'purpose',text,span:{observationId:source.observationId,sourceRevision:source.sourceRevision,sectionId:'label:'+source.observationId,entryId:null,start,end:start+text.length,raw:text},sourceText,transcription:'clear',conditional:null,fieldPermission:{policyId:source.policyId,policyVersion:source.policyVersion,assertionKind:'purpose',policyEpoch:1,expiresAt:until,permitted:true}}];return input;}
export function fixture(ingredients='Glycolic Acid, Water',purpose='AHA exfoliant'){
 const context=dated(p3context());context.profile!.id=p2id(101);context.profile!.data.primaryGoal={state:'known',value:'maintain'};
 const input=label(ingredients,purpose);return {context,input};
}
export function sunRoutine(f:ReturnType<typeof fixture>,options:{timing?:'am'|'pm'|'both'|'unknown';state?:'current'|'paused'|'stopped'|'occasional';manual?:boolean;label?:string;frequency?:import('../../src/contracts/PersonalContext.ts').ReportedFrequency;site?:string}={}){
 const item=dated(p3routine(p2id(301),'sun_protection',options.site??'face'));item.timing=options.timing??'am';item.state=options.state??'current';item.frequency=options.frequency??{kind:'exact',count:1,unit:'day'};if(!options.manual)item.reference={kind:'catalog',productId:p2id(302),variantId:p2id(303),formulaVersionId:p2id(304)};
 f.context.routine=dated(p3revision(p2id(305),{completeness:'complete' as const,items:[item]}));
 const p=normalize(label('Water',options.label??'Sunscreen'),release.dictionaryRelease,{snapshotId:p2id(390),createdAt:now,resultRevision:1});assert.equal(p.state,'ready');if(p.state!=='ready'||p.output.kind!=='bound'||p.output.productFacts.binding.kind!=='declaration')throw Error('fixture');
 const request=planRoutineFormulaRequests(f.context,ISOLATED_423_EDUCATION).requests[0];if(!request)return null;const b=p.output.productFacts.binding;
 const evidence:RoutineFormulaReadyEvidence={version:'routine-formula-evidence/v1',request,state:'ready',association:{id:p2id(306),revision:1,reference:request.reference,partOneItemId:b.itemId,partOneSnapshotId:b.snapshotId,declarationId:b.declarationId,declarationRevision:b.declarationRevision,partTwoSnapshotId:p2id(307),partTwoBindingKey:p.bindingKey,partTwoRevision:p.resultRevision,dependencyDigest:b.dependencyDigest,sourceDependencies:p.output.productFacts.dependencyManifest.sourceRefs.map(s=>s.observationId),validUntil:until,revoked:false},authorization:{authorityId:p2id(308),authorityRevision:1,checkedAt:now,validUntil:until,evaluate:true,display:true,store:true,revoked:false,withdrawnDependencies:[],sourcePermissions:p.output.productFacts.dependencyManifest.sourceRefs.map(s=>({observationId:s.observationId,sourceRevision:s.sourceRevision,policyId:s.policyId,policyVersion:s.policyVersion,grantId:p2id(309),grantVersion:'test-grant-v1',evaluate:true,display:true,store:true,revoked:false,validUntil:s.expiresAt}))},partTwo:p};return evidence;
}
export async function check(f=fixture(),evidence:RoutineFormulaReadyEvidence[]=[],mode:'composition'|'before'='composition',candidateRoutineItemId:string|null=null,intent:'replace'|'check_current'='replace',configure?:(ports:PartThreePorts)=>void) {
 assert(api,'Integrated usefulness composition is missing');const p=normalize(f.input,release.dictionaryRelease,{snapshotId:p2id(90),createdAt:now,resultRevision:1});assert.equal(p.state,'ready');
 const ports:PartThreePorts={...(mode==='composition'?{partFourComposition:'reviewed_usefulness' as const}:{}),releaseSelection:release,partFourEnabled:true,partFourEducation:'approved423',ownerId:f.context.ownerId,now:()=>now,normalize:async()=>p,context:async()=>f.context,history:async()=>({items:[],nextCursor:null,atRevision:1}),worker:async(action,payload)=>action==='encounter/read'?{}:action==='routine/formulas'?evidence:action==='prepare'?{resultId:p2id(120),resultRevision:2,leaseToken:p2id(121)}:action==='publish'?{kind:'result',result:payload.result,replayed:false}:action==='provider/gate'?{allowed:false}:[]};
 const manifest=mode==='composition'?api.REVIEWED_USEFULNESS_MANIFEST:PENDING_SCIENTIFIC_MANIFEST;
 ports.partFourDecisionEvidence={manifest,load:async(binding,input)=>projectScientificFeatures({manifest,binding,...input,now})};
 configure?.(ports);
 const response=await handlePersonalRequest({operation:'evaluate',requestId:p2id(110),encounterId:p2id(111),accountGeneration:1,generation:1,scanId:p.scanId,captureSessionId:p.captureSessionId,expectedPartOneGeneration:p.generation,expectedPartOneRevision:p.evidenceRevision,intent,comparatorId:null,candidateRoutineItemId,selectedManualReportIds:[],use:{purpose:f.input.labelAssertions?.[0].text.includes('exfoliant')?'other':'moisturizing',site:'face',useForm:'leave_on'},savedAssessmentId:null},ports);assert.equal(response.kind,'result');if(response.kind!=='result')throw Error('No result');return response.result;
}
