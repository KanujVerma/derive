import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {handlePersonalRequest,type PartThreePorts} from '../supabase/functions/part-three/handler.ts';
import {projectScientificFeatures} from '../src/domain/part-four/featureProjection.ts';
import {PENDING_SCIENTIFIC_MANIFEST} from '../src/domain/part-four/scientificDecision.ts';
import {parsePartFourClientSelection} from '../src/domain/part-four/clientRelease.ts';
import {ORDINARY_PART_THREE_RELEASE_SELECTION,selectedPartThreeRelease} from '../src/domain/part-three/release.ts';
import {normalize} from '../src/domain/part-two/index.ts';
import {sha256,canonicalJson} from '../src/domain/part-two/hash.ts';
import {p3input,p3routine,p3assessment,p3revision} from './fixtures/part-three.ts';
import {boundDeclaration,p2metadata,p2id} from './fixtures/part-two-core.ts';
import {componentHarness,control,press,textContent} from './ux-profile-render.ts';
const settle=()=>new Promise<void>(r=>setImmediate(r));
// The compiled original bundle is exercised; product/source/storage authority
// remains synthetic. The pinned ingredient text is not a live acquisition.
const releaseSelection=ORDINARY_PART_THREE_RELEASE_SELECTION;
const dictionaryRelease=releaseSelection.dictionaryRelease;
const semanticHash=selectedPartThreeRelease(releaseSelection).releaseHash;
test('compiled original P2/P3 bundle produces a mounted normalized untried Check with 423 education, comparison, exact Save and cold reopen',async t=>{
 const x=p3input();x.context.profile!.id=p2id(360);
 const literalSource=JSON.parse(readFileSync(new URL('./fixtures/part-four-moisturizer-sources.json',import.meta.url),'utf8'))[0];x.partTwo=normalize(boundDeclaration(literalSource.ingredientNames.join(', '),'public'),dictionaryRelease,p2metadata);
 const currentItem=p3routine(p2id(361));currentItem.reference={kind:'manual',name:'CeraVe PM Facial Moisturizing Lotion'};currentItem.startedOn={state:'known',value:{value:x.now.slice(0,10),precision:'day'}};
 const report=p3assessment(currentItem);report.id=p2id(363);report.goalOrPurpose={state:'known',value:'dryness'};report.textureExperience={state:'known',value:'comfortable'};report.reportingPeriod={start:currentItem.startedOn,end:currentItem.startedOn};x.context.routine=p3revision(p2id(362),{completeness:'complete',items:[currentItem]});x.context.assessments=[];x.context.profile!.data.secondaryGoals=['oiliness'];
 t.mock.timers.enable({apis:['Date'],now:Date.parse(x.now)});
 let serial=370,packet:any=null,saved:any=null,savedRequest:any=null;
 const host:PartThreePorts={releaseSelection,partFourEnabled:true,partFourEducation:'approved423',partFourDecisionEvidence:{manifest:PENDING_SCIENTIFIC_MANIFEST,load:async(binding,input)=>projectScientificFeatures({manifest:PENDING_SCIENTIFIC_MANIFEST,binding,...input,now:x.now})},ownerId:x.context.ownerId,now:()=>x.now,identity:async()=>({name:'Vanicream Daily Facial Moisturizer',expiresAt:x.partTwo.expiresAt}),normalize:async()=>normalize(boundDeclaration(literalSource.ingredientNames.join(', '),'public'),dictionaryRelease,p2metadata),context:async()=>x.context,history:async()=>({items:[],nextCursor:null,atRevision:x.context.revision}),worker:async(action,payload)=>{if(action==='saved/input')return {partTwo:x.partTwo,pinnedSnapshotId:p2id(12),request:savedRequest};if(action==='encounter/read')return {};if(action==='prepare')return {resultId:p2id(365),resultRevision:2,leaseToken:p2id(366)};if(action==='provider/gate')return {allowed:false};if(action==='publish'){packet=payload.result;return {kind:'result',result:packet,replayed:false};}if(action==='read')return {kind:'result',result:packet,replayed:true};if(action==='save'){assert.equal(payload.expectedPacketHash,sha256(canonicalJson(packet)));assert.equal(payload.expectedBindingHash,sha256(canonicalJson(packet.binding)));saved=JSON.parse(JSON.stringify(packet));return {kind:'saved',savedAssessmentId:p2id(367),resultRevision:packet.resultRevision,replayed:false};}throw Error(action);}};
 const ports={releaseSelection,partFourSelection:parsePartFourClientSelection('approved423','pending_candidates'),context:async()=>x.context,session:()=>({ownerId:x.context.ownerId,accountGeneration:1,encounterId:p2id(368)}),createId:()=>p2id(serial++),transport:{request:async(r:any)=>{if(r.operation==='evaluate')savedRequest=r;if(r.operation==='read_saved')return {kind:'historical',savedAssessmentId:p2id(367),savedAt:x.now,assessmentWhenSaved:saved,currentAssessment:'unavailable'};if(r.operation==='saved_basis')return {kind:'saved_basis',partTwo:x.partTwo,pinnedSnapshotId:p2id(12),request:savedRequest};return handlePersonalRequest(r,host);}}};
 const props={ownerId:x.context.ownerId,enabled:true,ports,details:{target:{ownerId:x.context.ownerId,scanId:x.partTwo.scanId,captureSessionId:null,generation:x.partTwo.generation,evidenceRevision:x.partTwo.evidenceRevision},result:x.partTwo,loading:false,error:null}};
 const options={effects:true,modules:{'../../../services/partThree':{PART_THREE_ENABLED:true,PART_FOUR_ENABLED:true,PART_FOUR_CLIENT_SELECTION:ports.partFourSelection},'../../ui/Button':{Button:'Button'},'../../ui/ChoiceChip':{ChoiceChip:'ChoiceChip'}}};
 const current=componentHarness('tests/fixtures/part-four-mounted-hook.tsx','MountedPartFour',props,options);
 let cold:ReturnType<typeof componentHarness>|null=null;
 try{for(let i=0;i<8;i++){current.render();await settle();}press(control(current.render(),'Choose test use'));for(let i=0;i<5;i++){current.render();await settle();}
  const check=current.render().find(n=>n.type==='span')!.props.check;assert.equal(check.view.result.binding.releases.releaseHash,semanticHash);assert.equal(check.view.result.binding.releases.dictionary,'derive-original-exact20-v1');assert.match(check.view.result.partFour.formula.knowledgeVersion,/423/);assert.equal(check.view.result.partFour.scientificDecision.manifestHash,PENDING_SCIENTIFIC_MANIFEST.contentHash);assert.equal(check.view.result.partFour.formula.ingredients.length,19);assert.match(textContent(current.render()),/Glycerin.*water/);assert.match(textContent(current.render()),/Ingredient relevance to dryness/);assert.doesNotMatch(textContent(current.render()),/Keep CeraVe PM/);assert.match(textContent(current.render()),/Secondary goal: oiliness/);assert.match(check.view.result.partFour.action,/Compare this candidate with CeraVe PM.*moisturizing/);assert.equal(check.view.result.partFour.insights.find((i:any)=>i.ruleId==='F04').state,'unknown');assert.equal(check.view.result.partFour.decisionState,'pending');
  await check.save();for(let i=0;i<3;i++){current.render();await settle();}assert.equal(current.render().find(n=>n.type==='span')!.props.check.view.savedAssessmentId,p2id(367));
  current.dispose();cold=componentHarness('tests/fixtures/part-four-mounted-hook.tsx','MountedPartFour',{...props,savedAssessmentId:p2id(367)},options);
  for(let i=0;i<9;i++){cold.render();await settle();}const reopened=cold.render().find(n=>n.type==='span')!.props.check;
  assert.deepEqual(reopened.view.historical.assessmentWhenSaved,saved);assert.match(textContent(cold.render()),/Glycerin.*water/);assert.match(textContent(cold.render()),/Assessment when saved/);assert.ok(reopened.view.result,reopened.view.error??'Missing current result after saved reopen');assert.equal(reopened.view.result.binding.releases.releaseHash,semanticHash);assert.equal(reopened.view.result.binding.releases.partFour.scientificManifestHash,PENDING_SCIENTIFIC_MANIFEST.contentHash);
 }finally{current.dispose();cold?.dispose();}
});
