import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import { buildFoundationInsights } from '../src/domain/part-four/foundations.ts';
import { analyzeFormula } from '../src/domain/part-four/formula.ts';
import { ISOLATED_423_EDUCATION } from '../src/domain/part-four/knowledge423.ts';
import { normalize, LOCAL_DICTIONARY_RELEASE } from '../src/domain/part-two/index.ts';
import { boundDeclaration,p2metadata,p2id } from './fixtures/part-two-core.ts';
import {p3input,p3routine,p3assessment,p3revision} from './fixtures/part-three.ts';
import {componentHarness,textContent} from './ux-profile-render.ts';
const sources=JSON.parse(readFileSync(new URL('./fixtures/part-four-moisturizer-sources.json',import.meta.url),'utf8'));
function fixture(){
 const x=p3input(),item=p3routine(p2id(470));item.reference={kind:'manual',name:'CeraVe PM Facial Moisturizing Lotion'};
 item.startedOn={state:'known',value:{value:x.now.slice(0,10),precision:'day'}};
 const assessment=p3assessment(item);assessment.goalOrPurpose={state:'known',value:'dryness'};assessment.textureExperience={state:'known',value:'comfortable'};assessment.reportingPeriod={start:item.startedOn,end:item.startedOn};
 x.context.routine=p3revision(p2id(471),{completeness:'complete',items:[item]});x.context.assessments=[p3revision(p2id(472),assessment)];x.context.profile!.data.secondaryGoals=['oiliness'];
 return {x,item,assessment,input:{context:x.context,partTwo:x.partTwo,requestedUse:x.requestedUse,intent:'replace' as const,candidateRoutineItemId:null,selectedComparatorId:item.id,now:x.now}};
}
test('actual named current moisturizer yields a qualified report-based action while secondary oiliness remains unknown',()=>{
 const f=fixture(),packet=buildFoundationInsights(f.input),report=packet.insights.find(i=>i.ruleId==='F04')!;
 assert.equal(report.state,'supported');assert.match(report.action!,/Keep CeraVe PM.*dryness.*reported benefit/);
 assert.match(report.explanation,/comfortable.*not clinical efficacy/);
 assert.equal(packet.insights.find(i=>i.ruleId==='F02')!.state,'unknown');assert.doesNotMatch(report.action!,/superior|beats|treats|safe/i);
});
test('membership, stale or changed use, uncomfortable feel and family mismatch cannot earn the keep action',()=>{
 for(const change of ['no_report','unknown_help','past','changed_frequency','heavy','family'] as const){const f=fixture();
  if(change==='no_report')f.x.context.assessments=[];
  if(change==='unknown_help')f.assessment.perceivedHelp='unanswered';
  if(change==='past')f.assessment.reportingPeriod.end={state:'known',value:{value:'2020-01-01',precision:'day'}};
  if(change==='changed_frequency')f.item.frequency={kind:'exact',count:1,unit:'week'};
  if(change==='heavy')f.assessment.textureExperience={state:'known',value:'too_heavy'};
  if(change==='family'){f.item.reference={kind:'catalog',productId:p2id(473),variantId:p2id(474),formulaVersionId:p2id(475)};f.assessment.reference={...f.item.reference,formulaVersionId:p2id(476)};}
  assert.equal(buildFoundationInsights(f.input).insights.find(i=>i.ruleId==='F04')!.action,null,change);
 }
});
test('19/24 actual manufacturer literal positions retain approved function education and unknown amounts without formula authority claims',()=>{
 for(const source of sources){
  // Offline literal test data; this grants no manufacturer operations or bottle matching.
  assert.equal(source.rights.status,'pending');assert.equal(source.formulaVersionId,null);
  const result=normalize(boundDeclaration(source.ingredientNames.join(', '),'public'),LOCAL_DICTIONARY_RELEASE,p2metadata);
  const formula=analyzeFormula(result,{knowledge:ISOLATED_423_EDUCATION,now:p3input().now})!;
  assert.equal(formula.ingredients.length,source.ingredientNames.length);
  assert.deepEqual(formula.ingredients.map(i=>i.observedName),source.ingredientNames);
  assert.equal(formula.ingredients.every(i=>i.card!==null),true);
  assert.equal(formula.ingredients.every(i=>i.quantityText===null),true);
  assert.ok(formula.limitations.includes('reference_roles_not_finished_product_efficacy'));
  assert.match(formula.ingredients.find(i=>i.card?.ingredientId==='glycerin')!.card!.body,/water/i);
 }
});

import {createSetupBundle,addCurrentProduct,currentUseItem,manualUnverifiedReference,toggleCurrentFeedback,currentFeedbackChoices} from '../src/presentation/p0b-personalization/setup.ts';
import {setupToStorageV2} from '../src/presentation/p0b-personalization/setupStorageV2.ts';
import {createContextDraft} from '../src/presentation/p0b-personalization/draft.ts';
test('ordinary setup can collect helpful and comfortable without inventing satisfaction, dates or dose',()=>{
 const f=fixture(),id=p2id(480);let bundle=addCurrentProduct(createSetupBundle(),currentUseItem(id,manualUnverifiedReference('CeraVe PM Facial Moisturizing Lotion')));
 bundle.reportedUse={[id]:{reportedPurpose:{answer:{state:'known',value:'moisturizing'},provenance:'self_report'},applicationSite:{answer:{state:'known',value:'face'},provenance:'self_report'},useForm:{answer:{state:'known',value:'leave_on'},provenance:'self_report'}}};
 bundle=toggleCurrentFeedback(toggleCurrentFeedback(bundle,id,'helpful'),id,'comfortable');let serial=490;
 const stored=setupToStorageV2(createContextDraft(),bundle,()=>p2id(serial++),f.x.now);assert.equal(stored.assessments[0].perceivedHelp,'helps');assert.equal(stored.assessments[0].satisfaction,'unanswered');assert.equal(stored.assessments[0].textureExperience?.state==='known'?stored.assessments[0].textureExperience.value:null,'comfortable');assert.equal(stored.assessments[0].reportingPeriod.end.state,'unanswered');
 f.x.context.routine=p3revision(p2id(485),stored.routine);f.x.context.assessments=[p3revision(p2id(486),stored.assessments[0])];f.input.selectedComparatorId=id;
 const report=buildFoundationInsights(f.input).insights.find(i=>i.ruleId==='F04')!;assert.equal(report.state,'limited');assert.match(report.action!,/Keep CeraVe PM.*if your reported benefit.*remain current/);
 assert(currentFeedbackChoices('moisturizer').some(([v])=>v==='comfortable'));
 bundle=toggleCurrentFeedback(bundle,id,'too_heavy');const heavy=setupToStorageV2(createContextDraft(),bundle,()=>p2id(serial++),f.x.now);assert.equal(heavy.assessments[0].textureExperience?.state==='known'?heavy.assessments[0].textureExperience.value:null,'too_heavy');
});
