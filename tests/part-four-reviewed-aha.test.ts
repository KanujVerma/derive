import assert from 'node:assert/strict';
import test from 'node:test';
import {sha256} from '../src/domain/part-two/hash.ts';
import {normalize} from '../src/domain/part-two/index.ts';
import {ORDINARY_PART_THREE_RELEASE_SELECTION as release} from '../src/domain/part-three/release.ts';
import {p2id,boundDeclaration} from './fixtures/part-two-core.ts';
import {p3context,p3routine,p3revision} from './fixtures/part-three.ts';
import {handlePersonalRequest,type PartThreePorts} from '../supabase/functions/part-three/handler.ts';
import {projectScientificFeatures} from '../src/domain/part-four/featureProjection.ts';
import {decisionCopy} from '../src/presentation/part-three/copy.ts';
import {planRoutineFormulaRequests,type RoutineFormulaReadyEvidence} from '../src/domain/part-four/routineFormula.ts';
import {ISOLATED_423_EDUCATION} from '../src/domain/part-four/knowledge423.ts';
import {partFourClientBinding,parsePartFourClientSelection} from '../src/domain/part-four/clientRelease.ts';
const api=await import('../src/domain/part-four/reviewedAha.ts').catch(()=>null);
const now='2026-10-04T12:00:00.000Z',until='2026-10-05T12:00:00.000Z';
const dated=<T>(v:T):T=>JSON.parse(JSON.stringify(v).replaceAll('2026-10-02T10:00:00Z',now).replaceAll('2026-10-03T10:00:00Z',until));
function label(ingredients:string,text:string){const input=dated(boundDeclaration(ingredients,'public'));const source=input.sourceRefs[0],sourceText=ingredients+'\npurpose: '+text,start=sourceText.length-text.length;
 source.sourceTextHash=sha256(sourceText);
 input.labelAssertions=[{assertionId:p2id(140),assertionKind:'purpose',text,span:{observationId:source.observationId,sourceRevision:source.sourceRevision,sectionId:'label:'+source.observationId,entryId:null,start,end:start+text.length,raw:text},sourceText,transcription:'clear',conditional:null,fieldPermission:{policyId:source.policyId,policyVersion:source.policyVersion,assertionKind:'purpose',policyEpoch:1,expiresAt:until,permitted:true}}];return input;}
function fixture(ingredients='Glycolic Acid, Water',purpose='AHA exfoliant'){
 const context=dated(p3context());context.profile!.id=p2id(101);context.profile!.data.primaryGoal={state:'known',value:'maintain'};
 const input=label(ingredients,purpose);return {context,input};
}
function sunRoutine(f:ReturnType<typeof fixture>,options:{timing?:'am'|'pm'|'both'|'unknown';state?:'current'|'paused'|'stopped'|'occasional';manual?:boolean;label?:string;frequency?:import('../src/contracts/PersonalContext.ts').ReportedFrequency;site?:string}={}){
 const item=dated(p3routine(p2id(301),'sun_protection',options.site??'face'));item.timing=options.timing??'am';item.state=options.state??'current';item.frequency=options.frequency??{kind:'exact',count:1,unit:'day'};if(!options.manual)item.reference={kind:'catalog',productId:p2id(302),variantId:p2id(303),formulaVersionId:p2id(304)};
 f.context.routine=dated(p3revision(p2id(305),{completeness:'complete' as const,items:[item]}));
 const p=normalize(label('Water',options.label??'Sunscreen'),release.dictionaryRelease,{snapshotId:p2id(390),createdAt:now,resultRevision:1});assert.equal(p.state,'ready');if(p.state!=='ready'||p.output.kind!=='bound'||p.output.productFacts.binding.kind!=='declaration')throw Error('fixture');
 const request=planRoutineFormulaRequests(f.context,ISOLATED_423_EDUCATION).requests[0];if(!request)return null;const b=p.output.productFacts.binding;
 const evidence:RoutineFormulaReadyEvidence={version:'routine-formula-evidence/v1',request,state:'ready',association:{id:p2id(306),revision:1,reference:request.reference,partOneItemId:b.itemId,partOneSnapshotId:b.snapshotId,declarationId:b.declarationId,declarationRevision:b.declarationRevision,partTwoSnapshotId:p2id(307),partTwoBindingKey:p.bindingKey,partTwoRevision:p.resultRevision,dependencyDigest:b.dependencyDigest,sourceDependencies:p.output.productFacts.dependencyManifest.sourceRefs.map(s=>s.observationId),validUntil:until,revoked:false},authorization:{authorityId:p2id(308),authorityRevision:1,checkedAt:now,validUntil:until,evaluate:true,display:true,store:true,revoked:false,withdrawnDependencies:[],sourcePermissions:p.output.productFacts.dependencyManifest.sourceRefs.map(s=>({observationId:s.observationId,sourceRevision:s.sourceRevision,policyId:s.policyId,policyVersion:s.policyVersion,grantId:p2id(309),grantVersion:'test-grant-v1',evaluate:true,display:true,store:true,revoked:false,validUntil:s.expiresAt}))},partTwo:p};return evidence;
}
async function check(f=fixture(),evidence:RoutineFormulaReadyEvidence[]=[]) {
 assert(api,'Reviewed FDA AHA path is missing');const p=normalize(f.input,release.dictionaryRelease,{snapshotId:p2id(90),createdAt:now,resultRevision:1});assert.equal(p.state,'ready');
 const ports:PartThreePorts={releaseSelection:release,partFourEnabled:true,partFourEducation:'approved423',ownerId:f.context.ownerId,now:()=>now,normalize:async()=>p,context:async()=>f.context,history:async()=>({items:[],nextCursor:null,atRevision:1}),worker:async(action,payload)=>action==='encounter/read'?{}:action==='routine/formulas'?evidence:action==='prepare'?{resultId:p2id(120),resultRevision:2,leaseToken:p2id(121)}:action==='publish'?{kind:'result',result:payload.result,replayed:false}:action==='provider/gate'?{allowed:false}:[]};
 ports.partFourDecisionEvidence={manifest:api.REVIEWED_AHA_MANIFEST,load:async(binding,input)=>projectScientificFeatures({manifest:api!.REVIEWED_AHA_MANIFEST,binding,...input,now})};
 const response=await handlePersonalRequest({operation:'evaluate',requestId:p2id(110),encounterId:p2id(111),accountGeneration:1,generation:1,scanId:p.scanId,captureSessionId:p.captureSessionId,expectedPartOneGeneration:p.generation,expectedPartOneRevision:p.evidenceRevision,intent:'add',comparatorId:null,candidateRoutineItemId:null,selectedManualReportIds:[],use:{purpose:'other',site:'face',useForm:'leave_on'},savedAssessmentId:null},ports);assert.equal(response.kind,'result');if(response.kind!=='result')throw Error('No result');return response.result;
}
test('untried label-qualified AHA with unknown amount/pH earns useful source-backed sun-plan Check first',async()=>{
 const result=await check();assert(api);assert.equal(result.summary?.judgment,'check_first');const copy=decisionCopy(result);assert.equal(copy.label,'Check first');assert.match(copy.reason,/sun.protection|sunscreen/i);assert.match(copy.action??'',/before trying|before adding/i);assert.match(copy.action??'',/week/i);
 const finding=result.findings.find(f=>f.allowedPropositionId===api!.AHA_SUN_PLAN_CLAIM_ID);assert(finding);assert.equal(finding.consequence,'concern');assert(finding.dependencies.sourceIds.includes('FDA-alpha-hydroxy-acids'));
 assert(result.partFour?.retainedEvidence?.fields.some(f=>f.state==='retained'&&f.kind==='scientific_claim'));assert(!/effective|safe to|better than/i.test(copy.reason));assert(result.partFour?.formula.ingredients.every(i=>!i.quantityText));
});
test('acid identity alone, citric acid and copolymer names do not become an AHA exfoliant',async()=>{
 assert(api);for(const f of [fixture('Glycolic Acid, Water','Moisturizes facial skin. Leave on.'),fixture('Citric Acid, Water'),fixture('Lactic Acid/Glycolic Acid Copolymer, Water')]){const r=await check(f);assert(!r.findings.some(f=>f.allowedPropositionId===api!.AHA_SUN_PLAN_CLAIM_ID));}
});
test('reported AM daily sun step with exact worker-qualified sunscreen label avoids missing-plan concern without certifying safety',async()=>{
 assert(api);const f=fixture(),e=sunRoutine(f)!;const r=await check(f,[e]);assert(!r.findings.some(f=>f.allowedPropositionId===api!.AHA_SUN_PLAN_CLAIM_ID));assert.notEqual(r.summary?.judgment,'worth_considering');assert(!/safe|protected from/i.test(decisionCopy(r).reason));
});
test('manual names, wrong label, PM-only/unknown timing or denied source do not establish sunscreen plan',async()=>{
 assert(api);for(const options of [{manual:true},{label:'Moisturizes facial skin. Leave on.'},{timing:'pm' as const},{timing:'unknown' as const},{state:'paused' as const},{state:'occasional' as const},{frequency:{kind:'unknown' as const}},{frequency:{kind:'qualitative' as const,value:'most_days' as const}},{site:'hands'}]){const f=fixture(),e=sunRoutine(f,options),r=await check(f,e?[e]:[]);assert(r.findings.some(f=>f.allowedPropositionId===api!.AHA_SUN_PLAN_CLAIM_ID));}
 const f=fixture(),e=sunRoutine(f)!;e.authorization.sourcePermissions[0].display=false;const r=await check(f,[e]);assert(r.findings.some(f=>f.allowedPropositionId===api!.AHA_SUN_PLAN_CLAIM_ID));
});
test('conditional/uncertain label and expired source cannot earn the FDA contextual action',async()=>{
 assert(api);for(const mutate of [(f:ReturnType<typeof fixture>)=>f.input.labelAssertions![0].conditional='if used as an exfoliant',(f:ReturnType<typeof fixture>)=>f.input.labelAssertions![0].transcription='uncertain' as const]){const f=fixture();mutate(f);const r=await check(f);assert(!r.findings.some(f=>f.allowedPropositionId===api!.AHA_SUN_PLAN_CLAIM_ID));}
 const expired=fixture();expired.input.labelAssertions![0].fieldPermission.expiresAt=now;await assert.rejects(()=>check(expired),/Label assertion requires exact current authorized/);
});
test('new scientific selection has a distinct tuple and preserves the frozen pending selection',()=>{assert(api);const old=partFourClientBinding(parsePartFourClientSelection('approved423','pending_candidates'));const reviewed=partFourClientBinding(parsePartFourClientSelection('approved423','reviewed_aha'));assert.equal(reviewed.scientificManifestHash,api.REVIEWED_AHA_MANIFEST.contentHash);assert.notEqual(reviewed.releaseHash,old.releaseHash);});

// No provider, DB or runtime service is activated by these handler fixtures.
test('resolved lactic acid still earns FDA context for reported nightly leave-on use, while daily AM qualitative report counts',async()=>{
 assert(api);const f=fixture('Lactic Acid, Water','Alpha hydroxy acid exfoliant');const item=dated(p3routine(p2id(330),'other'));item.timing='pm';item.reference={kind:'catalog',productId:p2id(331),variantId:p2id(332),formulaVersionId:p2id(333)};f.context.routine=dated(p3revision(p2id(334),{completeness:'complete' as const,items:[item]}));const r=await check(f);assert.equal(r.summary?.judgment,'check_first');assert(r.findings.some(x=>x.allowedPropositionId===api!.AHA_SUN_PLAN_CLAIM_ID));
 const daily=fixture(),e=sunRoutine(daily,{timing:'both',frequency:{kind:'qualitative',value:'daily'}})!;const withPlan=await check(daily,[e]);assert(!withPlan.findings.some(x=>x.allowedPropositionId===api!.AHA_SUN_PLAN_CLAIM_ID));
});
test('worker evidence with wrong formula association or source expiry cannot establish a sun plan',async()=>{
 assert(api);for(const mutation of [(e:RoutineFormulaReadyEvidence)=>{e.association.reference.variantId=p2id(399);},(e:RoutineFormulaReadyEvidence)=>{e.authorization.sourcePermissions[0].validUntil=now;}]){const f=fixture(),e=sunRoutine(f)!;mutation(e);const r=await check(f,[e]);assert(r.findings.some(x=>x.allowedPropositionId===api!.AHA_SUN_PLAN_CLAIM_ID));}
});

test('future starts and ended periods cannot establish a current sun plan, including partial date precision',async()=>{
 assert(api);for(const dates of [{start:{precision:'day' as const,value:'2026-10-05'}},{start:{precision:'month' as const,value:'2026-11'}},{start:{precision:'year' as const,value:'2027'}},{stop:{precision:'day' as const,value:'2026-10-03'}},{stop:{precision:'day' as const,value:'2026-10-04'}},{stop:{precision:'month' as const,value:'2026-09'}},{stop:{precision:'year' as const,value:'2025'}}]){
  const f=fixture(),e=sunRoutine(f)!,item=f.context.routine!.data.items[0];if(dates.start)item.startedOn={state:'known',value:dates.start};if(dates.stop)item.stoppedOn={state:'known',value:dates.stop};
  // Rebind the legitimate worker evidence to the exact changed report, so this
  // tests temporal coherence rather than an unrelated stale request hash.
  e.request=planRoutineFormulaRequests(f.context,ISOLATED_423_EDUCATION).requests[0];const r=await check(f,[e]);assert(r.findings.some(x=>x.allowedPropositionId===api!.AHA_SUN_PLAN_CLAIM_ID));
 }
});
