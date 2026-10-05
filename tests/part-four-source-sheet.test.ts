import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {normalize} from '../src/domain/part-two/index.ts';
import {ORDINARY_PART_THREE_RELEASE_SELECTION} from '../src/domain/part-three/release.ts';
import {boundDeclaration,p2metadata,p2now,p2id} from './fixtures/part-two-core.ts';
import {p3context} from './fixtures/part-three.ts';
import {componentHarness,control,textContent,press} from './ux-profile-render.ts';
import type {PartThreePorts} from '../src/components/check/part-three/usePartThreeCheck';
import {p3input} from './fixtures/part-three.ts';
import {evaluatePersonalResult} from '../src/domain/part-three/evaluate.ts';
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('ready unknown decision leads with useful context; qualifications expand and historical and mandatory findings remain visible',()=>{
 const x=p3input();x.requestedUse={purpose:null,site:null,useForm:null};x.binding.encounterInputs.use=x.requestedUse;const unknown=evaluatePersonalResult(x);
 assert.equal(unknown.summary?.judgment,'not_enough_info');
 const fallback=React.createElement('Text',null,'For dryness: Petrolatum slows water loss.');
 const view={target:null,result:unknown,question:null,historical:null,savedAssessmentId:null,savedAt:null,loading:false,saving:false,error:null};
 const h=componentHarness('src/components/check/part-three/PartThreeSummary.tsx','PartThreeSummary',{view,fallback});
 let text=textContent(h.render());assert.match(text,/Personal Fit.*Not enough info/);assert(!text.includes('For dryness'));assert.match(text,/Review the listed ingredients/);
 assert.match(text,/unresolved|clarification|judgment/i);
 const historical={kind:'historical' as const,savedAssessmentId:p2id(88),savedAt:x.now,assessmentWhenSaved:unknown,currentAssessment:'unavailable' as const};
 assert.match(textContent(h.render({view:{...view,historical}})),/Personal Fit.*Not enough info/);assert(!/Current Check|When saved|Assessment when saved/.test(textContent(h.render())));
 x.context.profile!.data.sensitivities={status:'reported',values:['Glycerin']};const concern=evaluatePersonalResult(x);
 const concernText=textContent(h.render({view:{...view,result:concern}}));assert.match(concernText,/reported as a sensitivity/);assert.match(concernText,/Check first/);
});
test('actual scanner sheet shows compact source context and approved details while P3 is unavailable; profile changes and refusal remove old copy',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:Date.parse(p2now)});
 const input=boundDeclaration('Petrolatum, Sorbitol, Propylene Glycol','public');input.bundle.predicate.variantMarket={passed:false,evidenceIds:[p2id(7)],reasons:['market_unknown']};
 let context=p3context();context.profile!.id=p2id(900);let refused=false,identityRefused=false,sequence=100;
 const ports:PartThreePorts={releaseSelection:ORDINARY_PART_THREE_RELEASE_SELECTION,partFourSelection:{education:'approved423',science:'pending_candidates'},context:async()=>{if(refused)throw Error('Context refused');return context;},identity:async()=>{if(identityRefused)throw Error('Identity refused');return null;},session:owner=>({ownerId:owner,accountGeneration:1,encounterId:p2id(80)}),transport:{request:async()=>({kind:'unavailable',reason:'evidence_unavailable'})},createId:()=>p2id(sequence++)};
 const ingredientTransport={normalize:async(request:any)=>{input.binding.requestId=request.requestId;return normalize(input,ORDINARY_PART_THREE_RELEASE_SELECTION.dictionaryRelease,p2metadata);}};
 const result={scanId:input.binding.scanId,generation:input.binding.generation,resultRevision:input.binding.evidenceRevision,declarationState:'partial',identity:'exact',work:'complete',snapshotId:input.binding.snapshotId,declarationId:input.binding.declarationId,scope:'public',freshness:{state:'fresh',observedAt:p2now,expiresAt:input.binding.expiresAt},display:{selectedIdentity:{id:p2id(11),name:'Synthetic source lotion',brand:'Synthetic',variantText:'',expiresAt:input.binding.expiresAt,image:null},candidates:[],sections:[],sources:[],limitations:[]},allowedActions:['save_partial']};
 const h=componentHarness('src/components/check/part-one/PartOneResultSheet.tsx','PartOneResultSheet',{view:{owner:context.ownerId,result,saved:false,loading:false,error:null,scrollOffset:0},personalEnabled:true,personalPorts:ports,ingredientEnabled:true,ingredientTransport,onClose(){},onSave(){},onSelect(){},onSearch(){},onRefresh(){},onFullChange(){}},{effects:true,modules:{
  '../part-three/PartThreeControls':{PartThreeControls:()=>null,PartThreeSaveControl:()=>null},
  'expo-network':{useNetworkState:()=>({isConnected:true,isInternetReachable:true})},
  '../../../services/partThree':{PART_FOUR_ENABLED:true,PART_FOUR_CLIENT_SELECTION:{education:'approved423',science:'pending_candidates'}},
  '../../../services/partTwo':{PART_TWO_ENABLED:true,partTwoTransport:ingredientTransport,partTwoSavedTransport:()=>ingredientTransport},
  '../../../services/productCatalog':{createCatalogRequestId:()=>p2id(sequence++)},
  '../result-sheet/ResultSheetSurface':{ResultSheetSurface:(p:any)=>React.createElement('Surface',p,p.summary,p.compactActions,p.footer,p.children)},
 }});
 try{
  for(let i=0;i<8;i++){h.render();await settle();}
  let nodes=h.render();let text=textContent(nodes);assert.match(text,/For dryness.*Petrolatum/i);assert(!/Personal assessment unavailable/.test(text));
  assert.equal(nodes.filter(n=>n.props.accessibilityLabel==='Ingredient context summary').length,1);
  const surface=nodes.find(n=>n.type==='Surface')!;assert(surface.props.summary);const summary=componentHarness('src/components/check/part-three/PartThreeSummary.tsx','PartThreeSummary',{view:{target:null,result:null,question:null,historical:null,savedAssessmentId:null,savedAt:null,loading:false,saving:false,error:null}});assert(!textContent(summary.render()).includes('Ingredient context'));assert(text.indexOf('Personal Fit')<text.indexOf('For dryness'),'Personal Fit leads; ingredient context stays below the fold');
  press(control(nodes,'Ingredient details: Sorbitol'));assert.match(textContent(h.render()),/hold water/i);
  identityRefused=true;t.mock.timers.tick(10000);for(let i=0;i<4;i++){h.render();await settle();}assert(!/For dryness/.test(textContent(h.render())));
  identityRefused=false;t.mock.timers.tick(10000);for(let i=0;i<4;i++){h.render();await settle();}assert.match(textContent(h.render()),/For dryness/);
  context=structuredClone(context);context.revision++;context.profile!.revision=context.revision;context.profile!.data.primaryGoal={state:'known',value:'oiliness'};
  t.mock.timers.tick(10000);for(let i=0;i<4;i++){h.render();await settle();}assert(!/For dryness/.test(textContent(h.render())));
  refused=true;t.mock.timers.tick(10000);for(let i=0;i<4;i++){h.render();await settle();}assert(!/For dryness|reported skin/.test(textContent(h.render())));
  nodes=h.render({view:{owner:null,result:null,saved:false,loading:false,error:null,scrollOffset:0}});assert(!/Petrolatum|Sorbitol|For dryness/.test(textContent(nodes)));
 }finally{h.dispose();}
});
