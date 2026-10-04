import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {buildFoundationInsights} from '../src/domain/part-four/foundations.ts';
import {ISOLATED_423_EDUCATION} from '../src/domain/part-four/knowledge423.ts';
import {normalize,LOCAL_DICTIONARY_RELEASE} from '../src/domain/part-two/index.ts';
import {boundDeclaration,p2metadata,p2id} from './fixtures/part-two-core.ts';
import {p3input,p3routine,p3revision} from './fixtures/part-three.ts';
const sources=JSON.parse(readFileSync(new URL('./fixtures/part-four-moisturizer-sources.json',import.meta.url),'utf8'));
function fixture(text=sources[0].ingredientNames.join(', ')){
 const x=p3input(),item=p3routine(p2id(600));item.reference={kind:'manual',name:'CeraVe PM Facial Moisturizing Lotion'};
 x.context.routine=p3revision(p2id(601),{completeness:'complete',items:[item]});x.context.assessments=[];x.context.profile!.data.secondaryGoals=['oiliness'];
 x.partTwo=normalize(boundDeclaration(text,'public'),LOCAL_DICTIONARY_RELEASE,p2metadata);
 return {x,input:{context:x.context,partTwo:x.partTwo,requestedUse:x.requestedUse,intent:'replace' as const,candidateRoutineItemId:null,selectedComparatorId:null,knowledge:ISOLATED_423_EDUCATION,now:x.now}};
}
test('untried 19/24 literal candidates explain dryness-relevant functions and replacement without a past-use report',()=>{
 for(const source of sources){const f=fixture(source.ingredientNames.join(', '));const out=buildFoundationInsights(f.input),reason=out.insights.find(i=>i.id==='foundation:F01:ingredient_relevance');
  assert(reason,'missing untried ingredient relevance');assert.equal(reason.state,'limited');assert.match(reason.explanation,/Glycerin.*water/i);assert.match(reason.explanation,/does not establish.*finished product/i);assert.match(reason.action!,/CeraVe PM.*moisturizing/);assert.match(reason.action!,/better results.*feel.*value.*not established/i);
  assert(reason.factIds.length);assert(ISOLATED_423_EDUCATION.cards.find(card=>card.ingredientId==='glycerin')!.sourceIds.every(id=>reason.sourceIds.includes(id)));assert(reason.contextRevisionIds.includes(f.x.context.profile!.id));assert.equal(out.insights.find(i=>i.ruleId==='F04')!.state,'unknown');assert.equal(out.insights.find(i=>i.ruleId==='F02')!.state,'unknown');assert.equal(out.comparison.state,'selected');
 }
});
test('conditional, unclear, unresolved identity, expired source and unavailable education cannot create definite ingredient relevance',()=>{
 for(const change of ['conditional','unclear','unresolved','expired_source','expired_knowledge','other_goal','other_use'] as const){const f=fixture(change==='conditional'?'May contain: Glycerin':change==='unresolved'?'Ethylhexylglycerin':'Glycerin');
  if(change==='unclear'){const source=boundDeclaration('Glycerin','public');source.declaration.sections[0].entries[0].uncertaintyReasons=['ocr_dispute'];f.input.partTwo=normalize(source,LOCAL_DICTIONARY_RELEASE,p2metadata);}
  if(change==='expired_source')f.input.now=f.x.partTwo.expiresAt;
  if(change==='expired_knowledge')f.input.knowledge={...ISOLATED_423_EDUCATION,provenance:{...ISOLATED_423_EDUCATION.provenance,revoked:true}};
  if(change==='other_goal')f.x.context.profile!.data.primaryGoal={state:'known',value:'oiliness'};
  if(change==='other_use')f.input.requestedUse={purpose:'cleansing',site:'face',useForm:'rinse_off'};
  assert.equal(buildFoundationInsights(f.input).insights.some(i=>i.id==='foundation:F01:ingredient_relevance'),false,change);
 }
});

import {ScientificClaimSchema} from '../src/contracts/ScientificClaim.ts';
import {buildScientificManifest,assessScientificDecision} from '../src/domain/part-four/scientificDecision.ts';
import {scientificClaimHash,claimSourcePin} from '../src/domain/part-four/claimApplicability.ts';
import {partFourBindingRelease} from '../src/domain/part-four/release.ts';
import {evaluatePersonalResult} from '../src/domain/part-three/evaluate.ts';
import {assembleFoundation} from '../src/domain/part-four/assemble.ts';
test('actual matcher contradiction must not leave a positive consider action in goal-context insights',()=>{
 const f=fixture();assert.equal(f.x.partTwo.state,'ready');if(f.x.partTwo.state!=='ready')throw Error('Expected ready fixture');f.x.binding.routineRevision=f.x.context.routine!.id;const until=f.x.partTwo.expiresAt,claim=ScientificClaimSchema.parse({id:'G01-01',family:'G01',tier:'decision_candidate',scope:'formula_transfer',sourceRefs:[{id:'synthetic:conflict',url:'https://fixture.invalid/source',locator:'Synthetic only',retrievedAt:f.x.now.slice(0,10),bodySha256:null}],endpoint:{name:'fixture function',direction:'benefit',result:'Synthetic only',limitations:['Synthetic only, no clinical admission.']},applicability:[{field:'ingredientId',expected:['glycerin'],reason:'Synthetic identity predicate'}],copy:{reason:'Synthetic only',action:'Synthetic only',qualifications:['Synthetic only']},admission:{status:'pending',scientificReviewer:null,operationRights:null},nonGoals:[],contradictions:[]});
 const manifest=buildScientificManifest([claim],[{claimId:claim.id,claimHash:scientificClaimHash(claim),status:'approved',reviewerId:'synthetic:reviewer',qualificationRef:'synthetic:qualification',reviewedAt:f.x.now,sourcePins:claim.sourceRefs.map(claimSourcePin),rights:{grantId:'synthetic:grant',version:'1',process:true,store:true,display:true,export:false,validUntil:until,revoked:false},validUntil:until}]);
 const science=assessScientificDecision({manifest,context:f.x.context,partTwo:f.x.partTwo,now:f.x.now,evidence:{ownerId:f.x.context.ownerId,partTwoBindingKey:f.x.partTwo.bindingKey,partTwoRevision:f.x.partTwo.resultRevision,sourceDigest:f.x.partTwo.output.reading.binding.dependencyDigest,contextRevision:f.x.context.revision,manifestHash:manifest.contentHash,claims:[{claimId:claim.id,goal:'dryness',features:{ingredientId:{state:'contradiction',values:['glycerin','other'],factIds:['synthetic:fact'],contextRevisionIds:[],sourceIds:[],validUntil:until}}}]}});
 assert.equal(science.assessments[0].assessment.state,'contradiction');f.x.binding.releases.partFour=partFourBindingRelease('approved423',manifest.contentHash);f.x.scientificDecision=science;
 const r=evaluatePersonalResult(f.x),packet=assembleFoundation({...f.input,scientificDecision:science,scientificManifest:manifest},r)!;assert.equal(packet.decisionState,'conflict');assert.match(packet.action,/conflicting/);assert.equal(packet.insights.find(i=>i.id==='foundation:F01:ingredient_relevance')!.action,null);
});
