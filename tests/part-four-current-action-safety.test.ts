import assert from 'node:assert/strict';
import test from 'node:test';
import {buildFoundationInsights} from '../src/domain/part-four/foundations.ts';
import {assembleFoundation} from '../src/domain/part-four/assemble.ts';
import {partFourBindingRelease} from '../src/domain/part-four/release.ts';
import {evaluatePersonalResult} from '../src/domain/part-three/evaluate.ts';
import {p3input,p3routine,p3assessment,p3revision} from './fixtures/part-three.ts';
import {p2id} from './fixtures/part-two-core.ts';
import {authorizedPartFourPacket} from '../src/presentation/part-four/sections.ts';
function fixture(){
 const x=p3input(),item=p3routine(p2id(930));item.reference={kind:'manual',name:'CeraVe PM Facial Moisturizing Lotion'};
 item.startedOn={state:'known',value:{value:x.now.slice(0,10),precision:'day'}};
 const a=p3assessment(item);a.id=p2id(931);a.goalOrPurpose={state:'known',value:'dryness'};a.textureExperience={state:'known',value:'comfortable'};a.reportingPeriod={start:item.startedOn,end:item.startedOn};
 x.context.routine=p3revision(p2id(932),{completeness:'complete',items:[item]});x.context.assessments=[p3revision(p2id(933),a)];
 x.binding.routineRevision=x.context.routine.id;x.binding.assessmentRevisions=[p2id(933)];x.binding.intent='check_current';x.candidateRoutineItemId=item.id;
 x.binding.encounterInputs={candidateRoutineItemId:item.id,selectedManualReportIds:[],use:x.requestedUse};x.binding.releases.partFour=partFourBindingRelease();
 const input={context:x.context,partTwo:x.partTwo,requestedUse:x.requestedUse,intent:'check_current' as const,candidateRoutineItemId:item.id,selectedComparatorId:null,now:x.now};
 return {x,item,a,input};
}
const action=(f:ReturnType<typeof fixture>)=>buildFoundationInsights(f.input).insights.find(i=>i.ruleId==='F04')?.action??null;
test('fixture-only fresh manual helpful/comfortable report gives qualified action',()=>{assert.match(action(fixture())!,/Keep CeraVe PM.*based on your report/);});
test('reacted report blocks the current action',()=>{const f=fixture();f.x.context.experiences=[p3revision(p2id(934),{id:p2id(935),reference:f.item.reference,kind:'reacted',occurred:{start:{state:'unanswered'},end:{state:'unanswered'}},useContext:f.a.useContext,symptoms:['Stinging'],note:null})];assert.equal(action(f),null);});
test('withdrawn helpful assessment yields no action',()=>{const f=fixture();f.x.context.assessments=[];assert.equal(action(f),null);});
test('superseding mixed report removes previous helpful action',()=>{const f=fixture(),next=structuredClone(f.a);next.id=p2id(936);next.perceivedHelp='mixed';const revision:typeof f.x.context.assessments[number]=p3revision(p2id(937),next);revision.supersedesRevisionId=p2id(933);f.x.context.assessments.push(revision);assert.equal(action(f),null);});
test('previous-day assessment and future assessment cannot produce current keep',()=>{for(const assessedAt of ['2026-10-01T23:59:59Z','2026-10-02T10:00:01Z']){const f=fixture();f.a.assessedAt=assessedAt;assert.equal(action(f),null,assessedAt);}});
test('changed use and truncated history cannot produce current keep',()=>{const f=fixture();f.item.frequency={kind:'exact',count:1,unit:'week'};assert.equal(action(f),null);const g=fixture();g.x.context.historyTruncated=true;assert.equal(action(g),null);});
test('explicit future start cannot produce a current helpfulness Keep action',()=>{const f=fixture();const future={state:'known' as const,value:{value:'2026-10-03',precision:'day' as const}};f.item.startedOn=future;f.a.useContext.startedOn=future;f.a.reportingPeriod={start:{state:'unanswered'},end:{state:'unanswered'}};assert.equal(action(f),null);});
test('expired or withdrawn product authority removes the entire actionable packet from mounted display',()=>{const f=fixture(),r=evaluatePersonalResult(f.x),p=assembleFoundation(f.input,r)!;assert.ok(authorizedPartFourPacket(p,{now:Date.parse(f.x.now)}));assert.equal(authorizedPartFourPacket(p,{now:Date.parse(p.formula.expiresAt)}),null);assert.equal(authorizedPartFourPacket(p,{now:Date.parse(f.x.now),withdrawn:true}),null);});
test('same current product decisive avoidance must not leave contradictory Keep in visible insights',()=>{
 const f=fixture();f.x.context.preferences=[p3revision(p2id(938),{id:p2id(939),revision:1,kind:'avoid_product',target:{kind:'product',reference:f.item.reference},strength:'decisive',status:'confirmed',confirmedAt:f.x.now,source:{kind:'structured'}})];f.x.binding.preferenceRevisions=[p2id(938)];
 const r=evaluatePersonalResult(f.x);assert.equal(r.summary?.judgment,'skip');const p=assembleFoundation(f.input,r)!;assert.match(p.action,/confirmed concern/);
 assert.equal(p.insights.find(i=>i.ruleId==='F04')!.action,null);
});
