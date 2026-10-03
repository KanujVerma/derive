import assert from 'node:assert/strict';
import { buildFoundationInsights } from '../src/domain/part-four/foundations.ts';
import { planRoutineFormulaRequests, admitRoutineFormulaEvidence, type RoutineFormulaReadyEvidence } from '../src/domain/part-four/routineFormula.ts';
import { selectCurrentComparator } from '../src/domain/part-four/comparison.ts';
import { personalContextV2Schema } from '../src/contracts/PersonalContextV2Schema.ts';
import { p3input, p3routine, p3assessment, p3revision } from './fixtures/part-three.ts';
import { normalize } from '../src/domain/part-two/index.ts';
import { LOCAL_DICTIONARY_RELEASE } from '../src/domain/part-two/dictionary.ts';
import { boundDeclaration, boundLabelDeclaration, p2metadata, p2now, p2id } from './fixtures/part-two-core.ts';
const input = () => { const p = p3input(); return { context:p.context, partTwo:p.partTwo, requestedUse:p.requestedUse, intent:p.binding.intent, candidateRoutineItemId:null as string|null, selectedComparatorId:null as string|null, now:p2now }; };
const rule = (i:ReturnType<typeof input>, id:string) => buildFoundationInsights(i).insights.filter(x=>x.ruleId===id);
{
 const i=input(); i.context.profile!.data.primaryGoal={state:'known',value:'maintain'}; i.context.profile!.data.secondaryGoals=['dryness','dark_spots']; i.context.profile!.data.skinBehavior='dry_tight';
 assert.equal(rule(i,'F01')[0].state,'supported'); assert.match(rule(i,'F01')[0].explanation,/secondary/);
 assert.match(rule(i,'F02')[0].explanation,/dark spots.*not established/);
 i.requestedUse.site='hands'; assert.notEqual(rule(i,'F01')[0].state,'supported');
 i.requestedUse.site='face'; i.partTwo=normalize(boundLabelDeclaration('Niacinamide treats dark spots.','purpose','public'),LOCAL_DICTIONARY_RELEASE,p2metadata);
 assert.notEqual(rule(i,'F01')[0].state,'supported');
}
{
 const i=input(), a=p3routine('a'), b=p3routine('b'), inactive=p3routine('paused'); inactive.state='paused'; a.reference={kind:'manual',name:'A lotion'}; b.reference={kind:'manual',name:'B lotion'};
 i.context.routine=p3revision('routine',{completeness:'partial',items:[a,b,inactive]});
 assert.equal(buildFoundationInsights(i).comparison.state,'ambiguous');
 i.selectedComparatorId='b'; assert.equal(buildFoundationInsights(i).comparison.routineItemId,'b');
 assert.match(rule(i,'F06')[0].explanation,/A lotion.*B lotion/); assert.doesNotMatch(rule(i,'F06')[0].explanation,/a:|b:/); assert.doesNotMatch(rule(i,'F06')[0].explanation,/paused/);
 assert.equal(rule(i,'F06')[0].state,'limited');
 i.context.profile!.data.secondaryGoals=['simplify']; assert.equal(rule(i,'F03')[0].state,'supported');
 i.intent='replace'; assert.equal(rule(i,'F03')[0].state,'inapplicable');
 i.selectedComparatorId='paused'; assert.equal(buildFoundationInsights(i).comparison.state,'unavailable');
 i.selectedComparatorId='a'; i.candidateRoutineItemId='a'; assert.equal(buildFoundationInsights(i).comparison.state,'self');
}
{
 const i=input(), current=p3routine('current'); i.context.routine=p3revision('routine',{completeness:'complete',items:[current]}); i.candidateRoutineItemId='current'; i.intent='check_current';
 assert.equal(rule(i,'F04')[0].state,'unknown');
 const assessment=p3assessment(current); assessment.textureExperience={state:'known',value:'too_heavy'}; assessment.goalOrPurpose={state:'known',value:'dryness'}; assessment.satisfaction='dissatisfied';
 i.context.assessments=[p3revision('report',assessment)]; assert.equal(rule(i,'F04')[0].state,'limited'); assert.match(rule(i,'F04')[0].explanation,/helps.*dissatisfied/); assert.match(rule(i,'F04')[0].explanation,/too heavy/);
 assessment.perceivedHelp='mixed'; assert.equal(rule(i,'F04')[0].state,'limited');
 assessment.useContext.applicationSite={answer:{state:'known',value:'hands'},provenance:'self_report'}; assert.equal(rule(i,'F04')[0].state,'unknown');
 i.context.profile!.data.reactivity='reacts_easily'; assert.equal(rule(i,'F05')[0].state,'limited'); assert.match(rule(i,'F05')[0].explanation,/response.*unknown/);
}
{
 const i=input(), a=p3routine('a'); a.useForm={answer:{state:'unanswered'},provenance:'self_report'};
 assert.equal(selectCurrentComparator({routine:{completeness:'partial',items:[a]},requestedUse:i.requestedUse,candidateRoutineItemId:null,selectedComparatorId:null}).state,'unavailable');
 i.context.routine=p3revision('routine',{completeness:'partial',items:[]}); assert.match(rule(i,'F06')[0].explanation,/partial/);
 assert.equal(rule(i,'F07')[0].state,'unknown'); assert.equal(rule(i,'F10')[0].state,'unknown');
 i.now=i.partTwo.expiresAt; assert.notEqual(rule(i,'F01')[0].state,'supported');
}
{
 const i=input(), current=p3routine('current'); current.reference={kind:'catalog',productId:'product',variantId:'variant',formulaVersionId:'formula'};
 i.context.routine=p3revision('routine',{completeness:'complete',items:[current]});
 const normalized=normalize(boundDeclaration('Glycerin','public'),LOCAL_DICTIONARY_RELEASE,p2metadata);
 if(normalized.state!=='ready'||normalized.output.kind!=='bound'||normalized.output.productFacts.binding.kind!=='declaration')throw Error('Fixture not bound');
 const request=planRoutineFormulaRequests(i.context).requests[0], binding=normalized.output.productFacts.binding, sources=normalized.output.productFacts.dependencyManifest.sourceRefs;
 const evidence:RoutineFormulaReadyEvidence={version:'routine-formula-evidence/v1',request,state:'ready',partTwo:normalized,association:{id:'association',revision:1,reference:request.reference,partOneItemId:binding.itemId,partOneSnapshotId:binding.snapshotId,declarationId:binding.declarationId,declarationRevision:binding.declarationRevision,partTwoSnapshotId:'stored-part-two-snapshot',partTwoBindingKey:normalized.bindingKey,partTwoRevision:normalized.resultRevision,dependencyDigest:binding.dependencyDigest,sourceDependencies:sources.map(source=>source.observationId),validUntil:normalized.expiresAt,revoked:false},authorization:{authorityId:'authority',authorityRevision:1,checkedAt:p2now,validUntil:normalized.expiresAt,evaluate:true,display:true,store:true,revoked:false,withdrawnDependencies:[],sourcePermissions:sources.map(source=>({observationId:source.observationId,sourceRevision:source.sourceRevision,policyId:source.policyId,policyVersion:source.policyVersion,grantId:'grant',grantVersion:'v1',evaluate:true,display:true,store:true,revoked:false,validUntil:source.expiresAt}))}};
 const qualified=admitRoutineFormulaEvidence(i.context,[evidence],{now:p2now}).qualified[0];

 const results=buildFoundationInsights({...i,routineFormulas:[qualified]}); assert.equal(results.insights.find(x=>x.ruleId==='F07')!.state,'supported'); assert.match(results.insights.find(x=>x.ruleId==='F07')!.explanation,/Session overlap is unknown/);
 const family=p3assessment(current); family.reference={...current.reference,formulaVersionId:'older-formula'}; i.context.assessments=[p3revision('family-report',family)]; const familyRule=rule(i,'F04')[0]; assert.equal(familyRule.state,'limited'); assert.match(familyRule.explanation,/product family/);
 const wrong={...qualified,reference:{...qualified.reference,formulaVersionId:'other'}}; assert.equal(buildFoundationInsights({...i,routineFormulas:[wrong]}).insights.find(x=>x.ruleId==='F07')!.state,'unknown');
 i.candidateRoutineItemId='current';
 i.context.experiences=[p3revision('tolerance',{id:'tolerance',reference:current.reference,kind:'tolerated',occurred:{start:{state:'unanswered'},end:{state:'unanswered'}},useContext:(({id,reference,state,...use})=>use)(current),symptoms:[],note:null})];
 assert.match(rule(i,'F05')[0].explanation,/reported tolerated/); assert.equal(buildFoundationInsights({...i,routineFormulas:[qualified]}).insights.find(x=>x.ruleId==='F07')!.state,'unknown');
 i.context.profile!.data.texturePreference={state:'known',value:'lightweight'}; assert.match(rule(i,'F09')[0].explanation,/lightweight/);
}
{
 const i=input(), a=p3routine('92000000-0000-4000-8000-000000000001'); a.reference={kind:'catalog',productId:'product',variantId:'variant',formulaVersionId:'formula'}; i.context.routine=p3revision('routine',{completeness:'complete',items:[a]});
 const r=buildFoundationInsights({...i,routineLabels:{[a.id]:'Authorized lotion label'}}); assert.match(r.insights.find(x=>x.ruleId==='F06')!.explanation,/Authorized lotion label/); assert.doesNotMatch(JSON.stringify(r.insights.map(x=>x.explanation)),/92000000/); assert.match(buildFoundationInsights(i).comparison.explanation,/your current step 1/);
}
assert.throws(()=>{const i=input();i.context.profile!.ownerId='foreign';buildFoundationInsights(i);},/Foreign/);
{
 const i=input(),current=p3routine(p2id(101));current.reference={kind:'catalog',productId:p2id(102),variantId:p2id(103),formulaVersionId:p2id(104)};
 i.context.profile!.id=p2id(105);i.context.profile!.data.secondaryGoals=['simplify'];i.context.routine=p3revision(p2id(106),{completeness:'complete',items:[current]});
 const assessment=p3assessment(current);assessment.id=p2id(107);assessment.reportingPeriod={start:{state:'known',value:{value:'2025-03',precision:'month'}},end:{state:'known',value:{value:'2025',precision:'year'}}};assessment.useContext.timing='unknown';assessment.useContext.frequency={kind:'unknown'};assessment.useContext.startedOn={state:'withheld'};assessment.useContext.stoppedOn={state:'unsure'};
 i.context.assessments=[p3revision(p2id(108),assessment)];i.context=personalContextV2Schema.parse(i.context);
 const result=buildFoundationInsights({...i,candidateReference:current.reference});assert.equal(result.comparison.state,'self');assert.equal(result.insights.find(x=>x.ruleId==='F03')!.state,'inapplicable');assert.equal(result.insights.find(x=>x.ruleId==='F03')!.action,null);
 const report=result.insights.find(x=>x.ruleId==='F04')!;assert.equal(report.state,'limited');assert.match(report.explanation,/2025-03 \(month precision\).*2025 \(year precision\)/);assert.match(report.explanation,/unknown, frequency unknown, started withheld, stopped unsure/);assert.match(report.explanation,/does not establish current helpfulness/);
}
console.log('part-four foundations: passed');
