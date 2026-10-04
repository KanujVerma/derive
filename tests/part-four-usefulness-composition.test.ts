import assert from 'node:assert/strict';
import test from 'node:test';
import {writeFileSync} from 'node:fs';
import {api,fixture,check,dated,now,label,sunRoutine} from './fixtures/part-four-usefulness-composition.ts';
import {p3routine,p3assessment,p3revision} from './fixtures/part-three.ts';
import {p2id} from './fixtures/part-two-core.ts';
import {decisionCopy} from '../src/presentation/part-three/copy.ts';
import {planRoutineFormulaRequests} from '../src/domain/part-four/routineFormula.ts';
import {ISOLATED_423_EDUCATION} from '../src/domain/part-four/knowledge423.ts';
import {partFourClientBinding,parsePartFourClientSelection} from '../src/domain/part-four/clientRelease.ts';
import {partFourBindingRelease} from '../src/domain/part-four/release.ts';
import {PENDING_SCIENTIFIC_MANIFEST} from '../src/domain/part-four/scientificDecision.ts';
const examples:unknown[]=[];
function moisturizer(goal:'dryness'|'fine_lines'|'dark_spots'|'oiliness'|'texture'|'redness'='dryness'){
 const f=fixture('Niacinamide, Glycerin, Water','Moisturizes facial skin. Leave on.');f.context.profile!.data.primaryGoal={state:'known',value:goal};return f;
}
function reported(f:ReturnType<typeof moisturizer>,texture:'comfortable'|'too_heavy'|'too_light'='comfortable'){
 const item=dated(p3routine(p2id(510)));item.reference={kind:'manual',name:'CeraVe PM (your reported current moisturizer)'};item.timing='pm';item.frequency={kind:'qualitative',value:'daily'};
 const a=dated(p3assessment(item));a.id=p2id(512);a.goalOrPurpose={state:'known',value:'dryness'};a.textureExperience={state:'known',value:texture};a.satisfaction=texture==='comfortable'?'satisfied':'dissatisfied';
 f.context.routine=dated(p3revision(p2id(511),{completeness:'complete' as const,items:[item]}));f.context.assessments=[dated(p3revision(p2id(513),a))];return {item:f.context.routine.data.items[0],a:f.context.assessments[0].data};
}
const insight=(r:Awaited<ReturnType<typeof check>>,id:string)=>r.partFour?.insights.find(i=>i.id===id);
test('one integrated tuple includes two references and parent-passed AHA, preserving pending selection',async()=>{
 assert(api);const b=partFourClientBinding(parsePartFourClientSelection('approved423','reviewed_usefulness'));assert.equal(b.scientificManifestHash,api.REVIEWED_USEFULNESS_MANIFEST.contentHash);assert.notEqual(b.releaseHash,partFourClientBinding(parsePartFourClientSelection('approved423','reviewed_aha')).releaseHash);assert.equal(PENDING_SCIENTIFIC_MANIFEST.contentHash,'163edf63299f70395ad43b16b58fd07066f376ebfe0b603a054b14790c24e5e0');
 assert.throws(()=>partFourBindingRelease('approved423',undefined,'reviewed_usefulness'));
 for(const bad of ['missing','pending','disabled'] as const){let prepared=false;await assert.rejects(check(moisturizer(),[],'composition',null,'replace',ports=>{const worker=ports.worker;ports.worker=async(a,p)=>{if(a==='prepare')prepared=true;return worker(a,p);};if(bad==='missing')delete ports.partFourDecisionEvidence;else if(bad==='disabled')ports.partFourEnabled=false;else ports.partFourDecisionEvidence!.manifest=PENDING_SCIENTIFIC_MANIFEST;}),/invalid_part_four_composition/);assert.equal(prepared,false,bad);}
});
test('untried moisturizer keeps useful functions and barrier research reference at unknown amount',async()=>{
 assert(api);const r=await check(moisturizer());const a=r.partFour?.scientificDecision?.assessments.find(x=>x.assessment.claimId===api!.BARRIER_REFERENCE_ID)?.assessment;assert.equal(a?.state,'reference');assert.match(a!.reason!,/forearm|barrier/i);assert(!r.findings.some(x=>x.allowedPropositionId===api!.BARRIER_REFERENCE_ID));assert(insight(r,'foundation:F01:ingredient_relevance'));assert.equal(r.partFour?.decisionState,'pending');assert(!r.partFour?.formula.ingredients.some(i=>i.quantityText));
});
test('photoaging reference gives endpoint-specific study metadata without predicting current product benefit',async()=>{
 assert(api);for(const goal of ['fine_lines','dark_spots'] as const){const r=await check(moisturizer(goal)),a=r.partFour?.scientificDecision?.assessments.find(x=>x.assessment.claimId===api!.PHOTOAGING_REFERENCE_ID);assert.equal(a?.assessment.state,'reference');assert.match(a!.assessment.reason!,/5%|one study/i);assert(!r.findings.some(x=>x.allowedPropositionId===api!.PHOTOAGING_REFERENCE_ID));assert(r.partFour?.scientificDecision?.unresolvedGoals.includes(goal));}
});
test('oiliness, texture and general redness do not inherit photoaging/skin-barrier efficacy',async()=>{
 assert(api);for(const g of ['oiliness','texture','redness'] as const){const r=await check(moisturizer(g));assert(!r.partFour?.scientificDecision?.assessments.some(x=>[api!.BARRIER_REFERENCE_ID,api!.PHOTOAGING_REFERENCE_ID].includes(x.assessment.claimId)));assert.notEqual(r.summary?.judgment,'worth_considering');}
});
test('conditional niacinamide presence cannot earn a study reference',async()=>{
 assert(api);const f=moisturizer();f.input=label('Glycerin, May contain: Niacinamide','Moisturizes facial skin. Leave on.');const r=await check(f);assert.notEqual(r.partFour?.scientificDecision?.assessments.find(x=>x.assessment.claimId===api!.BARRIER_REFERENCE_ID)?.assessment.state,'reference');
});
test('actual helpful comfortable report improves the visible reason and conditional keep action',async()=>{
 const f=moisturizer();reported(f);const before=await check(f,[],'before'),after=await check(f);const a=decisionCopy(after);assert.match(a.reason,/reported|said/i);assert.match(a.reason,/comfortable/i);assert.match(a.action??'',/Keep CeraVe PM/);assert.equal(after.partFour?.decisionState,'pending');examples.push({case:'helpful-comfortable-current',input:'Synthetic owner report: current moisturizer helps dryness and feels comfortable; candidate untried, amounts unknown.',before:decisionCopy(before),after:a});
});
test('actual heavy-feel report and lightweight preference yield a useful replacement tradeoff without predicting candidate feel',async()=>{
 const f=moisturizer();reported(f,'too_heavy');f.context.profile!.data.texturePreference={state:'known',value:'lightweight'};const before=await check(f,[],'before'),after=await check(f),a=decisionCopy(after);assert.match(a.reason,/too heavy/i);assert.match(a.reason,/candidate.*feel.*unknown|cannot predict/i);assert.match(a.action??'',/feel|texture/i);assert.doesNotMatch(a.reason,/candidate.*(?:feels lighter|is lighter)/i);assert.notEqual(after.partFour?.value.state,'ready');examples.push({case:'current-too-heavy-prefer-lightweight',input:'Synthetic current too-heavy report and lightweight preference; candidate feel/price unknown.',before:decisionCopy(before),after:a});
});
test('known current feel is shown even without a texture preference, while candidate feel/value remain unavailable',async()=>{
 const f=moisturizer();reported(f,'too_light');const r=await check(f),i=insight(r,'foundation:F09:reported_feel');assert(i);assert.equal(i.state,'limited');assert.match(i.explanation,/too light/i);assert.match(i.explanation,/candidate|untried/i);assert(r.partFour?.value.state==='unavailable');assert.equal(i.action,null);
});
test('membership without an assessment cannot invent current comfort or useful texture action',async()=>{
 const f=moisturizer();reported(f);f.context.assessments=[];const r=await check(f);assert(!insight(r,'foundation:F09:reported_feel'));assert.doesNotMatch(decisionCopy(r).action??'',/Keep CeraVe/);
});
test('stale, changed-use and family-only reports cannot become a current feel tradeoff',async()=>{
 for(const change of ['past','changed','family'] as const){const f=moisturizer(),{item,a}=reported(f,'too_heavy');f.context.profile!.data.texturePreference={state:'known',value:'lightweight'};if(change==='past')a.assessedAt='2026-10-03T13:00:00.000Z';if(change==='changed')item.frequency={kind:'qualitative',value:'weekly'};if(change==='family'){item.reference={kind:'catalog',productId:p2id(520),variantId:p2id(521),formulaVersionId:p2id(522)};a.reference={...item.reference,formulaVersionId:p2id(523)};}const r=await check(f);assert(!insight(r,'foundation:F09:reported_feel'),change);}
});
test('latest superseding report wins and mixed/adverse feedback cannot earn a conflicting positive action',async()=>{
 const f=moisturizer();const {a,item}=reported(f);const newer=structuredClone(f.context.assessments[0]);newer.id=p2id(530);newer.revision=2;newer.supersedesRevisionId=f.context.assessments[0].id;newer.data.textureExperience={state:'known',value:'too_heavy'};newer.data.perceivedHelp='mixed';newer.data.satisfaction='mixed';f.context.revision=2;f.context.assessments.push(newer);f.context.profile!.data.texturePreference={state:'known',value:'lightweight'};const r=await check(f);assert.match(insight(r,'foundation:F09:reported_feel')!.explanation,/too heavy/);assert.equal(insight(r,'foundation:F09:reported_feel')!.action,null);assert.doesNotMatch(decisionCopy(r).action??'',/Keep CeraVe/);
 const adverse=moisturizer();const current=reported(adverse);adverse.context.experiences=[dated(p3revision(p2id(535),{id:p2id(536),reference:current.item.reference,kind:'reacted' as const,occurred:{start:{state:'unanswered' as const},end:{state:'unanswered' as const}},useContext:current.a.useContext,symptoms:[],note:null}))];const reaction=await check(adverse);assert.equal(insight(reaction,'foundation:F09:reported_feel')!.action,null);assert.doesNotMatch(decisionCopy(reaction).action??'',/Keep CeraVe/);
 for(const reverse of [false,true])for(const spelling of ['same','no_milliseconds']){const coequal=moisturizer();reported(coequal);const opposite=structuredClone(coequal.context.assessments[0]);opposite.id=p2id(537);opposite.data.id=p2id(538);if(spelling==='no_milliseconds')opposite.data.assessedAt=opposite.data.assessedAt.replace('.000Z','Z');opposite.data.perceivedHelp='mixed';opposite.data.satisfaction='mixed';opposite.data.textureExperience={state:'known',value:'too_heavy'};coequal.context.assessments.push(opposite);if(reverse)coequal.context.assessments.reverse();const blocked=await check(coequal);assert.equal(blocked.partFour?.decisionState,'conflict');assert.doesNotMatch(decisionCopy(blocked).action??'',/Keep CeraVe/);assert.match(decisionCopy(blocked).reason,/reports.*disagree/i);assert.doesNotMatch(decisionCopy(blocked).reason,/formula evidence/i);}
 const future=moisturizer();reported(future);future.context.assessments[0].recordedAt='2026-10-05T13:00:00.000Z';const blocked=await check(future);assert(!insight(blocked,'foundation:F09:reported_feel'));assert.doesNotMatch(decisionCopy(blocked).action??'',/Keep CeraVe/);assert.match(decisionCopy(blocked).reason,/recorded.*after/i);
});
test('sensitivity overrides the positive report/feel action',async()=>{
 const f=moisturizer();reported(f);f.context.profile!.data.sensitivities={status:'reported',values:['Niacinamide']};const r=await check(f);assert.equal(r.summary?.judgment,'check_first');assert.equal(insight(r,'foundation:F09:reported_feel')?.action,null);assert.doesNotMatch(decisionCopy(r).action??'',/Keep CeraVe/);
});
test('untried candidate timing stays unknown instead of inheriting the current routine AM session',async()=>{
 const f=moisturizer(),e=sunRoutine(f,{label:'Moisturizes facial skin. Leave on.'})!;const r=await check(f,[e]);const i=r.partFour?.insights.find(i=>i.ruleId==='F07'&&i.state==='supported');assert(i);assert.match(i.explanation,/candidate.*timing.*unknown|candidate.*timing.*not reported/i);assert.match(i.explanation,/am|morning/i);assert.doesNotMatch(i.explanation,/shares a session/);
});
test('actual known candidate/current timing distinguishes shared and separate sessions without dose or clinical conflict',async()=>{
 for(const timing of ['am','pm'] as const){const f=moisturizer(),e=sunRoutine(f,{label:'Moisturizes facial skin. Leave on.'})!;const own=dated(p3routine(p2id(540)));own.timing=timing;f.context.routine!.data.items.push(own);e.request=planRoutineFormulaRequests(f.context,ISOLATED_423_EDUCATION).requests[0];const r=await check(f,[e],'composition',own.id),i=r.partFour?.insights.find(i=>i.ruleId==='F07'&&i.state==='supported');assert(i);assert.match(i.explanation,timing==='am'?/same reported session/:/separate reported sessions/);assert.match(i.explanation,/total dose|cumulative dose/);assert.doesNotMatch(i.explanation,/incompatible|safe together/);}
});
test('revoked routine source cannot establish co-presence and partial routine does not prove no conflict',async()=>{
 const f=moisturizer(),e=sunRoutine(f,{label:'Moisturizes facial skin. Leave on.'})!;e.authorization.sourcePermissions[0].display=false;f.context.routine!.data.completeness='partial';e.request=planRoutineFormulaRequests(f.context,ISOLATED_423_EDUCATION).requests[0];const r=await check(f,[e]);assert.equal(r.partFour?.insights.find(i=>i.ruleId==='F07')?.state,'unknown');assert.match(r.partFour!.insights.find(i=>i.ruleId==='F07')!.explanation,/cannot establish no overlap or no conflict/);
});
test('parent-passed AHA still produces qualified Check first in the integrated composition',async()=>{
 const r=await check(fixture());assert.equal(r.summary?.judgment,'check_first');assert.match(decisionCopy(r).action??'',/sunscreen.*week/i);assert(r.partFour?.retainedEvidence?.fields.some(f=>f.state==='retained'&&f.kind==='scientific_claim'));
});
test('checking a current candidate does not choose the comparator comfort report as the primary feel evidence',async()=>{
 const f=moisturizer();const selected=reported(f,'too_heavy');f.context.profile!.data.texturePreference={state:'known',value:'lightweight'};const other=dated(p3routine(p2id(550)));other.reference={kind:'manual',name:'Different comfortable current item'};const a=dated(p3assessment(other));a.id=p2id(551);a.goalOrPurpose={state:'known',value:'dryness'};a.textureExperience={state:'known',value:'comfortable'};f.context.routine!.data.items.unshift(other);f.context.assessments.push(dated(p3revision(p2id(552),a)));const r=await check(f,[],'composition',selected.item.id,'check_current');const i=insight(r,'foundation:F09:reported_feel');assert(i);assert.match(i.explanation,/CeraVe PM.*too heavy/);assert.doesNotMatch(i.explanation,/Different comfortable current item/);assert.doesNotMatch(i.explanation,/untried candidate/);
});
test('examples are captured from actual normalized handler packets, not invented output',()=>{assert.equal(examples.length,2);writeFileSync(new URL('../../bounded-usefulness-composition/before-after-examples.json',import.meta.url),JSON.stringify(examples,null,2)+'\n');});
