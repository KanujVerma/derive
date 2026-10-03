import assert from 'node:assert/strict';
import test from 'node:test';
import {p3input,p3revision,p3routine,p3assessment} from './fixtures/part-three.ts';
import {p2id,p2metadata,boundLabelDeclaration} from './fixtures/part-two-core.ts';
import {normalize,LOCAL_DICTIONARY_RELEASE} from '../src/domain/part-two/index.ts';
import {evaluatePersonalResult} from '../src/domain/part-three/evaluate.ts';
import {personalContextV2Schema} from '../src/contracts/PersonalContextV2Schema.ts';
import {NormalizationResultSchema} from '../src/contracts/PartTwo.ts';
import {PersonalResultV2Schema} from '../src/contracts/PersonalResultV2.ts';
import {handlePersonalRequest,type PartThreePorts} from '../supabase/functions/part-three/handler.ts';
import type {PartThreeEvaluateRequest} from '../src/contracts/PartThreeService.ts';
function full(){const x=p3input();x.context.profile!.id=p2id(800);x.binding.profileRevision=p2id(800);return x;}
function evaluate(x:ReturnType<typeof full>){personalContextV2Schema.parse(x.context);NormalizationResultSchema.parse(x.partTwo);x.binding.encounterInputs={candidateRoutineItemId:x.candidateRoutineItemId,selectedManualReportIds:x.selectedManualReportIds,use:x.requestedUse};return PersonalResultV2Schema.parse(evaluatePersonalResult(x));}
function current(x:ReturnType<typeof full>){const item=p3routine(p2id(801)),assessment=p3assessment(item);assessment.id=p2id(802);x.context.routine=p3revision(p2id(803),{completeness:'partial',items:[item]});x.binding.routineRevision=p2id(803);x.context.assessments=[p3revision(p2id(804),assessment)];x.binding.assessmentRevisions=[p2id(804)];return {item,assessment};}
test('review 3: full admitted cleanser schema cannot earn a moisturizing dryness premise',()=>{
 for(const cleanser of [true,false]){const x=full();x.partTwo=normalize(boundLabelDeclaration(cleanser?'Cleanses facial skin. Rinse off.':'Moisturizes facial skin. Leave on.','purpose','public'),LOCAL_DICTIONARY_RELEASE,p2metadata);x.requestedUse={purpose:cleanser?'cleansing':'moisturizing',site:'face',useForm:cleanser?'rinse_off':'leave_on'};const r=evaluate(x);assert.equal(r.summary?.judgment,cleanser?'not_enough_info':'worth_considering');assert.equal(r.findings.some(f=>f.kind==='purpose_value'&&f.arguments.detail==='helps'),!cleanser);}
});
test('review 4: unknown, unsure and withheld current use retain the report and a gap, never Worth keeping',()=>{
 for(const state of ['unanswered','unsure','withheld'] as const){const x=full(),{item,assessment}=current(x);x.context.profile!.data.primaryGoal={state:'known',value:'maintain'};x.binding.intent='check_current';x.candidateRoutineItemId=item.id;x.requestedUse={purpose:null,site:null,useForm:null};item.reportedPurpose!.answer={state};item.applicationSite!.answer={state};item.useForm!.answer={state};assessment.useContext=p3assessment(item).useContext;assessment.goalOrPurpose={state:'known',value:'maintain'};const r=evaluate(x);assert.equal(r.summary?.judgment,'not_enough_info');assert.notEqual(r.summary?.displayVariant,'worth_keeping');assert(r.materialGaps.some(g=>g.reason==='purpose_or_site'));assert.equal(x.context.assessments[0].data.perceivedHelp,'helps');}
});
test('review secondary: paused/stopped helpful comparators cannot make add/replace intent material',()=>{
 for(const state of ['paused','stopped'] as const){const x=full(),{item}=current(x);item.state=state;x.binding.comparatorId=item.id;x.binding.intent='unanswered';assert.equal(evaluate(x).question,null);x.binding.intent='add';assert(!evaluate(x).findings.some(f=>f.ruleId==='already-helpful'));}
});
test('review 2: catalog preferences match their explicit product, variant and formula scope',()=>{
 const x=full();if(x.binding.subject.kind!=='declaration')throw Error('bound fixture');const ref={kind:'catalog' as const,productId:p2id(820),variantId:p2id(821),formulaVersionId:p2id(822)};x.binding.subject.productId=ref.productId;x.binding.subject.variantId=ref.variantId;x.binding.subject.formulaVersionId=null;x.context.preferences=[p3revision(p2id(823),{id:p2id(824),revision:1,kind:'avoid_product' as const,target:{kind:'product' as const,reference:ref},strength:'decisive' as const,status:'confirmed' as const,confirmedAt:x.now,source:{kind:'structured' as const}})];x.binding.preferenceRevisions=[p2id(823)];
 x.binding.subject.variantId = p2id(826);
 const differentVariant = evaluate(x);
 assert.equal(differentVariant.summary?.judgment, 'worth_considering', 'Known different variant rules out exact avoidance despite unknown formula');
 assert(!differentVariant.materialGaps.some(g => g.reason === 'avoidance_unresolved'));
 assert(!differentVariant.findings.some(f => f.ruleId === 'avoid-retry'));
 x.binding.subject.variantId = ref.variantId;
 assert.equal(evaluate(x).summary?.judgment,'check_first');assert(evaluate(x).materialGaps.some(g=>g.reason==='avoidance_unresolved'));x.binding.subject.formulaVersionId=ref.formulaVersionId;assert.equal(evaluate(x).summary?.judgment,'skip');x.binding.subject.formulaVersionId=p2id(825);
 const differentFormula = evaluate(x);
 assert.equal(differentFormula.summary?.judgment, 'worth_considering');
 assert(!differentFormula.materialGaps.some(g => g.reason === 'avoidance_unresolved'));
 x.binding.subject.variantId = null;
 assert.equal(evaluate(x).summary?.judgment, 'worth_considering', 'Known formula mismatch also rules out the constrained target when variant is unknown');
 x.binding.subject.variantId = ref.variantId;
const target=x.context.preferences[0].data.target;if(target.kind!=='product')throw Error('product target');target.reference={...ref,variantId:null,formulaVersionId:null};assert.equal(evaluate(x).summary?.judgment,'skip','explicit whole-product avoidance is respected at its own family scope');
});
test('review 2: the actual handler drains candidate and comparator at one revision, including a reaction after row 50',async()=>{
 const x=full(),{item}=current(x);item.reference={kind:'catalog',productId:p2id(840),variantId:null,formulaVersionId:null};x.context.assessments[0].data.reference=item.reference;const candidate={productId:p2id(841),variantId:p2id(842),formulaVersionId:null};x.context.historyTruncated=true;
 const records=Array.from({length:61},(_,i)=>p3revision(p2id(900+i),{id:p2id(1000+i),reference:{kind:'catalog' as const,...candidate},kind:i===60?'reacted' as const:'liked' as const,occurred:{start:{state:'unanswered' as const},end:{state:'withheld' as const}},useContext:null,symptoms:[],note:null}));
 const request:PartThreeEvaluateRequest={operation:'evaluate',requestId:p2id(850),encounterId:p2id(851),accountGeneration:1,generation:1,scanId:x.partTwo.scanId,captureSessionId:x.partTwo.captureSessionId,expectedPartOneGeneration:x.partTwo.generation,expectedPartOneRevision:x.partTwo.evidenceRevision,intent:'add',comparatorId:item.id,candidateRoutineItemId:null,selectedManualReportIds:[],use:x.requestedUse,savedAssessmentId:null};
 const calls:Array<{revision:number;scope:string;cursor:string|null}>=[];let dependencies:string[]=[];
 const ports:PartThreePorts={ownerId:x.context.ownerId,now:()=>x.now,normalize:async()=>x.partTwo,context:async()=>x.context,identity:async()=>({name:x.name,expiresAt:x.partTwo.expiresAt,catalogReference:candidate}),history:async(revision,scope,cursor)=>{assert.equal(scope.kind,'catalog');const id=scope.kind==='catalog'?scope.productId:'';calls.push({revision,scope:id,cursor});return id===candidate.productId?{atRevision:revision,items:cursor?records.slice(50):records.slice(0,50),nextCursor:cursor?null:'page-two'}:{atRevision:revision,items:[],nextCursor:null};},worker:async(action,payload)=>{if(action==='encounter/read')return {};if(action==='prepare'){dependencies=payload.contextRefs as string[];return {resultId:p2id(852),resultRevision:1,leaseToken:p2id(853)};}if(action==='publish')return {kind:'result',result:payload.result,replayed:false};if(action==='provider/gate')return {allowed:false};throw Error(action);}};
 const response=await handlePersonalRequest(request,ports);assert.equal(response.kind,'result');if(response.kind!=='result')return;assert.equal(response.result.summary?.judgment,'check_first');const recall=response.result.findings.find(f=>f.arguments.reportTrace?.recordId===records[60].data.id);assert.equal(recall?.arguments.relation,'product_family');assert.equal(recall?.consequence,'concern');assert.equal(calls.length,3);assert(calls.every(c=>c.revision===x.context.revision));assert(dependencies.includes(records[60].id));assert.equal(response.result.binding.subject.kind==='declaration'&&response.result.binding.subject.formulaVersionId,null);
});
