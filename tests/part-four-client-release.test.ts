import assert from 'node:assert/strict';
import test from 'node:test';
import { partThreeTarget } from '../src/presentation/part-three/target.ts';
import { partFourBindingRelease } from '../src/domain/part-four/release.ts';
import { PENDING_SCIENTIFIC_MANIFEST } from '../src/domain/part-four/scientificDecision.ts';
import { handlePersonalRequest, type PartThreePorts } from '../supabase/functions/part-three/handler.ts';
import { projectScientificFeatures } from '../src/domain/part-four/featureProjection.ts';
import { createPartThreeController } from '../src/presentation/part-three/controller.ts';
import { p3input,p3routine,p3assessment,p3revision } from './fixtures/part-three.ts';
import { boundDeclaration,p2metadata,p2id } from './fixtures/part-two-core.ts';

test('423 and pending science reach the client publication and exact Save boundary',async()=>{
 const x=p3input();x.context.profile!.id=p2id(349);const selection={education:'approved423',science:'pending_candidates'} as const;
 const choices={intent:x.binding.intent,comparatorId:null,candidateRoutineItemId:null,selectedManualReportIds:[],use:x.requestedUse};
 const target=partThreeTarget(x.context,x.partTwo,{ownerId:x.context.ownerId,accountGeneration:1,encounterId:p2id(350),generation:1},choices,null,null,true,selection)!;
 assert.deepEqual(target.binding.releases.partFour,partFourBindingRelease('approved423',PENDING_SCIENTIFIC_MANIFEST.contentHash));
 let packet:any=null,saved:any=null;
 const ports:PartThreePorts={partFourEnabled:true,partFourEducation:'approved423',partFourDecisionEvidence:{manifest:PENDING_SCIENTIFIC_MANIFEST,load:async(binding,input)=>projectScientificFeatures({manifest:PENDING_SCIENTIFIC_MANIFEST,binding,...input,now:x.now})},ownerId:x.context.ownerId,now:()=>x.now,normalize:async()=>x.partTwo,context:async()=>x.context,history:async()=>({items:[],nextCursor:null,atRevision:x.context.revision}),worker:async(action,payload)=>{
  if(action==='encounter/read')return {};if(action==='prepare')return {resultId:p2id(351),resultRevision:2,leaseToken:p2id(352)};
  if(action==='provider/gate')return {allowed:false};if(action==='publish'){packet=payload.result;return {kind:'result',result:packet,replayed:false};}
  if(action==='read')return {kind:'result',result:packet,replayed:true};if(action==='save'){saved=payload;return {kind:'saved',savedAssessmentId:p2id(353),resultRevision:packet.resultRevision,replayed:false};}throw Error(action);
 }};
 const controller=createPartThreeController({request:r=>handlePersonalRequest(r,ports)},()=>p2id(354),()=>{},()=>Date.parse(x.now));
 controller.bind(target);assert.equal(await controller.evaluate(),true);
 assert.match(controller.getView().result!.partFour!.formula.knowledgeVersion,/423/);
 assert.equal(controller.getView().result!.partFour!.scientificDecision!.manifestHash,PENDING_SCIENTIFIC_MANIFEST.contentHash);
 assert.equal(await controller.save(),p2id(353));assert.ok(saved.expectedPacketHash);assert.equal(controller.getView().savedAssessmentId,p2id(353));
 const legacy={...target,binding:{...target.binding,releases:{...target.binding.releases,partFour:partFourBindingRelease()}}};
 controller.bind(legacy);assert.equal(await controller.evaluate(),false);assert.equal(controller.getView().result,null,'unselected scientific/423 tuple never silently accepted');
});

import {componentHarness,control,press,textContent} from './ux-profile-render.ts';
import {parsePartFourClientSelection} from '../src/domain/part-four/clientRelease.ts';
import {normalize,LOCAL_DICTIONARY_RELEASE} from '../src/domain/part-two/index.ts';
import {readFileSync} from 'node:fs';
const settle=()=>new Promise<void>(r=>setImmediate(r));
test('mounted hook accepts only compiled 423/science selection and preserves it through Save and cold sheet reopen',async t=>{
 const x=p3input();x.context.profile!.id=p2id(360);
 const literalSource=JSON.parse(readFileSync(new URL('./fixtures/part-four-moisturizer-sources.json',import.meta.url),'utf8'))[0];x.partTwo=normalize(boundDeclaration(literalSource.ingredientNames.join(', '),'public'),LOCAL_DICTIONARY_RELEASE,p2metadata);
 const currentItem=p3routine(p2id(361));currentItem.reference={kind:'manual',name:'CeraVe PM Facial Moisturizing Lotion'};currentItem.startedOn={state:'known',value:{value:x.now.slice(0,10),precision:'day'}};
 const report=p3assessment(currentItem);report.id=p2id(363);report.goalOrPurpose={state:'known',value:'dryness'};report.textureExperience={state:'known',value:'comfortable'};report.reportingPeriod={start:currentItem.startedOn,end:currentItem.startedOn};x.context.routine=p3revision(p2id(362),{completeness:'complete',items:[currentItem]});x.context.assessments=[p3revision(p2id(364),report)];x.context.profile!.data.secondaryGoals=['oiliness'];
 t.mock.timers.enable({apis:['Date'],now:Date.parse(x.now)});
 let serial=370,packet:any=null,saved:any=null,savedRequest:any=null;
 const host:PartThreePorts={partFourEnabled:true,partFourEducation:'approved423',partFourDecisionEvidence:{manifest:PENDING_SCIENTIFIC_MANIFEST,load:async(binding,input)=>projectScientificFeatures({manifest:PENDING_SCIENTIFIC_MANIFEST,binding,...input,now:x.now})},ownerId:x.context.ownerId,now:()=>x.now,identity:async()=>({name:'Vanicream Daily Facial Moisturizer',expiresAt:x.partTwo.expiresAt}),normalize:async()=>x.partTwo,context:async()=>x.context,history:async()=>({items:[],nextCursor:null,atRevision:x.context.revision}),worker:async(action,payload)=>{if(action==='saved/input')return {partTwo:x.partTwo,pinnedSnapshotId:p2id(12),request:savedRequest};if(action==='encounter/read')return {};if(action==='prepare')return {resultId:p2id(365),resultRevision:2,leaseToken:p2id(366)};if(action==='provider/gate')return {allowed:false};if(action==='publish'){packet=payload.result;return {kind:'result',result:packet,replayed:false};}if(action==='read')return {kind:'result',result:packet,replayed:true};if(action==='save'){saved=structuredClone(packet);return {kind:'saved',savedAssessmentId:p2id(367),resultRevision:packet.resultRevision,replayed:false};}throw Error(action);}};
 const ports={partFourSelection:parsePartFourClientSelection('approved423','pending_candidates'),context:async()=>x.context,session:()=>({ownerId:x.context.ownerId,accountGeneration:1,encounterId:p2id(368)}),createId:()=>p2id(serial++),transport:{request:async(r:any)=>{if(r.operation==='evaluate')savedRequest=r;if(r.operation==='read_saved')return {kind:'historical',savedAssessmentId:p2id(367),savedAt:x.now,assessmentWhenSaved:saved,currentAssessment:'unavailable'};if(r.operation==='saved_basis')return {kind:'saved_basis',partTwo:x.partTwo,pinnedSnapshotId:p2id(12),request:savedRequest};return handlePersonalRequest(r,host);}}};
 const props={ownerId:x.context.ownerId,enabled:true,ports,details:{target:{ownerId:x.context.ownerId,scanId:x.partTwo.scanId,captureSessionId:null,generation:x.partTwo.generation,evidenceRevision:x.partTwo.evidenceRevision},result:x.partTwo,loading:false,error:null}};
 const options={effects:true,modules:{'../../../services/partThree':{PART_THREE_ENABLED:true,PART_FOUR_ENABLED:true,PART_FOUR_CLIENT_SELECTION:ports.partFourSelection},'../../ui/Button':{Button:'Button'},'../../ui/ChoiceChip':{ChoiceChip:'ChoiceChip'}}};
 const current=componentHarness('tests/fixtures/part-four-mounted-hook.tsx','MountedPartFour',props,options);
 let cold:ReturnType<typeof componentHarness>|null=null;
 try{for(let i=0;i<8;i++){current.render();await settle();}press(control(current.render(),'Choose test use'));for(let i=0;i<5;i++){current.render();await settle();}
  const check=current.render().find(n=>n.type==='span')!.props.check;assert.match(check.view.result.partFour.formula.knowledgeVersion,/423/);assert.equal(check.view.result.partFour.scientificDecision.manifestHash,PENDING_SCIENTIFIC_MANIFEST.contentHash);assert.equal(check.view.result.partFour.formula.ingredients.length,19);assert.match(textContent(current.render()),/Keep CeraVe PM.*dryness.*reported benefit/);assert.match(textContent(current.render()),/Secondary goal: oiliness/);assert.match(check.view.result.partFour.action,/Keep CeraVe PM/);
  await check.save();for(let i=0;i<3;i++){current.render();await settle();}assert.equal(current.render().find(n=>n.type==='span')!.props.check.view.savedAssessmentId,p2id(367));
  current.dispose();cold=componentHarness('tests/fixtures/part-four-mounted-hook.tsx','MountedPartFour',{...props,savedAssessmentId:p2id(367)},options);
  for(let i=0;i<9;i++){cold.render();await settle();}const reopened=cold.render().find(n=>n.type==='span')!.props.check;
  assert.deepEqual(reopened.view.historical.assessmentWhenSaved,saved);assert(!/Current Check|When saved|Assessment when saved/.test(textContent(cold.render())));assert.ok(reopened.view.result,reopened.view.error??'Missing current result after saved reopen');assert.equal(reopened.view.result.binding.releases.partFour.scientificManifestHash,PENDING_SCIENTIFIC_MANIFEST.contentHash);
 }finally{current.dispose();cold?.dispose();}
});
test('untried candidate shows ingredient goal and automatic replacement reasoning, with exact Save and cold reopen',async t=>{
 const x=p3input();x.context.profile!.id=p2id(360);
 const literalSource=JSON.parse(readFileSync(new URL('./fixtures/part-four-moisturizer-sources.json',import.meta.url),'utf8'))[0];x.partTwo=normalize(boundDeclaration(literalSource.ingredientNames.join(', '),'public'),LOCAL_DICTIONARY_RELEASE,p2metadata);
 const currentItem=p3routine(p2id(361));currentItem.reference={kind:'manual',name:'CeraVe PM Facial Moisturizing Lotion'};currentItem.startedOn={state:'known',value:{value:x.now.slice(0,10),precision:'day'}};
 const report=p3assessment(currentItem);report.id=p2id(363);report.goalOrPurpose={state:'known',value:'dryness'};report.textureExperience={state:'known',value:'comfortable'};report.reportingPeriod={start:currentItem.startedOn,end:currentItem.startedOn};x.context.routine=p3revision(p2id(362),{completeness:'complete',items:[currentItem]});x.context.assessments=[];x.context.profile!.data.secondaryGoals=['oiliness'];
 t.mock.timers.enable({apis:['Date'],now:Date.parse(x.now)});
 let serial=370,packet:any=null,saved:any=null,savedRequest:any=null;
 const host:PartThreePorts={partFourEnabled:true,partFourEducation:'approved423',partFourDecisionEvidence:{manifest:PENDING_SCIENTIFIC_MANIFEST,load:async(binding,input)=>projectScientificFeatures({manifest:PENDING_SCIENTIFIC_MANIFEST,binding,...input,now:x.now})},ownerId:x.context.ownerId,now:()=>x.now,identity:async()=>({name:'Vanicream Daily Facial Moisturizer',expiresAt:x.partTwo.expiresAt}),normalize:async()=>x.partTwo,context:async()=>x.context,history:async()=>({items:[],nextCursor:null,atRevision:x.context.revision}),worker:async(action,payload)=>{if(action==='saved/input')return {partTwo:x.partTwo,pinnedSnapshotId:p2id(12),request:savedRequest};if(action==='encounter/read')return {};if(action==='prepare')return {resultId:p2id(365),resultRevision:2,leaseToken:p2id(366)};if(action==='provider/gate')return {allowed:false};if(action==='publish'){packet=payload.result;return {kind:'result',result:packet,replayed:false};}if(action==='read')return {kind:'result',result:packet,replayed:true};if(action==='save'){saved=structuredClone(packet);return {kind:'saved',savedAssessmentId:p2id(367),resultRevision:packet.resultRevision,replayed:false};}throw Error(action);}};
 const ports={partFourSelection:parsePartFourClientSelection('approved423','pending_candidates'),context:async()=>x.context,session:()=>({ownerId:x.context.ownerId,accountGeneration:1,encounterId:p2id(368)}),createId:()=>p2id(serial++),transport:{request:async(r:any)=>{if(r.operation==='evaluate')savedRequest=r;if(r.operation==='read_saved')return {kind:'historical',savedAssessmentId:p2id(367),savedAt:x.now,assessmentWhenSaved:saved,currentAssessment:'unavailable'};if(r.operation==='saved_basis')return {kind:'saved_basis',partTwo:x.partTwo,pinnedSnapshotId:p2id(12),request:savedRequest};return handlePersonalRequest(r,host);}}};
 const props={ownerId:x.context.ownerId,enabled:true,ports,details:{target:{ownerId:x.context.ownerId,scanId:x.partTwo.scanId,captureSessionId:null,generation:x.partTwo.generation,evidenceRevision:x.partTwo.evidenceRevision},result:x.partTwo,loading:false,error:null}};
 const options={effects:true,modules:{'../../../services/partThree':{PART_THREE_ENABLED:true,PART_FOUR_ENABLED:true,PART_FOUR_CLIENT_SELECTION:ports.partFourSelection},'../../ui/Button':{Button:'Button'},'../../ui/ChoiceChip':{ChoiceChip:'ChoiceChip'}}};
 const current=componentHarness('tests/fixtures/part-four-mounted-hook.tsx','MountedPartFour',props,options);
 let cold:ReturnType<typeof componentHarness>|null=null;
 try{for(let i=0;i<8;i++){current.render();await settle();}press(control(current.render(),'Choose test use'));for(let i=0;i<5;i++){current.render();await settle();}
  const check=current.render().find(n=>n.type==='span')!.props.check;assert.match(check.view.result.partFour.formula.knowledgeVersion,/423/);assert.equal(check.view.result.partFour.scientificDecision.manifestHash,PENDING_SCIENTIFIC_MANIFEST.contentHash);assert.equal(check.view.result.partFour.formula.ingredients.length,19);assert.match(textContent(current.render()),/Glycerin.*water/);assert.match(textContent(current.render()),/Ingredient relevance to dryness/);assert.doesNotMatch(textContent(current.render()),/Keep CeraVe PM/);assert.match(textContent(current.render()),/Secondary goal: oiliness/);assert.match(check.view.result.partFour.action,/Compare this candidate with CeraVe PM.*moisturizing/);assert.equal(check.view.result.partFour.insights.find((i:any)=>i.ruleId==='F04').state,'unknown');assert.equal(check.view.result.partFour.decisionState,'pending');
  await check.save();for(let i=0;i<3;i++){current.render();await settle();}assert.equal(current.render().find(n=>n.type==='span')!.props.check.view.savedAssessmentId,p2id(367));
  current.dispose();cold=componentHarness('tests/fixtures/part-four-mounted-hook.tsx','MountedPartFour',{...props,savedAssessmentId:p2id(367)},options);
  for(let i=0;i<9;i++){cold.render();await settle();}const reopened=cold.render().find(n=>n.type==='span')!.props.check;
  assert.deepEqual(reopened.view.historical.assessmentWhenSaved,saved);assert.match(textContent(cold.render()),/Glycerin.*water/);assert(!/Current Check|When saved|Assessment when saved/.test(textContent(cold.render())));assert.ok(reopened.view.result,reopened.view.error??'Missing current result after saved reopen');assert.equal(reopened.view.result.binding.releases.partFour.scientificManifestHash,PENDING_SCIENTIFIC_MANIFEST.contentHash);
 }finally{current.dispose();cold?.dispose();}
});
test('unknown client release/hash selection is refused rather than silently accepted',()=>{
 assert.throws(()=>parsePartFourClientSelection('all_ingredients','expert_approved'));
});
