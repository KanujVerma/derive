import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {normalize} from '../src/domain/part-two/index.ts';
import {ORDINARY_PART_THREE_RELEASE_SELECTION} from '../src/domain/part-three/release.ts';
import {boundDeclaration,p2metadata,p2now,p2id} from './fixtures/part-two-core.ts';
import {p3context} from './fixtures/part-three.ts';
import {componentHarness,control,textContent,press} from './ux-profile-render.ts';
import type {PartThreePorts} from '../src/components/check/part-three/usePartThreeCheck';
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('actual scanner sheet shows compact source context and approved details while P3 is unavailable; profile changes and refusal remove old copy',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:Date.parse(p2now)});
 const input=boundDeclaration('Petrolatum, Sorbitol, Propylene Glycol','public');input.bundle.predicate.variantMarket={passed:false,evidenceIds:[p2id(7)],reasons:['market_unknown']};
 let context=p3context();context.profile!.id=p2id(900);let refused=false,identityRefused=false,sequence=100;
 const ports:PartThreePorts={releaseSelection:ORDINARY_PART_THREE_RELEASE_SELECTION,partFourSelection:{education:'approved423',science:'pending_candidates'},context:async()=>{if(refused)throw Error('Context refused');return context;},identity:async()=>{if(identityRefused)throw Error('Identity refused');return null;},session:owner=>({ownerId:owner,accountGeneration:1,encounterId:p2id(80)}),transport:{request:async()=>({kind:'unavailable',reason:'evidence_unavailable'})},createId:()=>p2id(sequence++)};
 const ingredientTransport={normalize:async(request:any)=>{input.binding.requestId=request.requestId;return normalize(input,ORDINARY_PART_THREE_RELEASE_SELECTION.dictionaryRelease,p2metadata);}};
 const result={scanId:input.binding.scanId,generation:input.binding.generation,resultRevision:input.binding.evidenceRevision,declarationState:'partial',identity:'exact',work:'complete',snapshotId:input.binding.snapshotId,declarationId:input.binding.declarationId,scope:'public',freshness:{state:'fresh',observedAt:p2now,expiresAt:input.binding.expiresAt},display:{selectedIdentity:{id:p2id(11),name:'Synthetic source lotion',brand:'Synthetic',variantText:'',expiresAt:input.binding.expiresAt,image:null},candidates:[],sections:[],sources:[],limitations:[]},allowedActions:['save_partial']};
 const h=componentHarness('src/components/check/part-one/PartOneResultSheet.tsx','PartOneResultSheet',{view:{owner:context.ownerId,result,saved:false,loading:false,error:null,scrollOffset:0},personalEnabled:true,personalPorts:ports,ingredientEnabled:true,ingredientTransport,onClose(){},onSave(){},onSelect(){},onSearch(){},onRefresh(){},onFullChange(){}},{effects:true,modules:{
  'expo-network':{useNetworkState:()=>({isConnected:true,isInternetReachable:true})},
  '../../../services/partThree':{PART_FOUR_ENABLED:true,PART_FOUR_CLIENT_SELECTION:{education:'approved423',science:'pending_candidates'}},
  '../../../services/partTwo':{PART_TWO_ENABLED:true,partTwoTransport:ingredientTransport,partTwoSavedTransport:()=>ingredientTransport},
  '../../../services/productCatalog':{createCatalogRequestId:()=>p2id(sequence++)},
  '../result-sheet/ResultSheetSurface':{ResultSheetSurface:(p:any)=>React.createElement('Surface',p,p.summary,p.compactActions,p.children)},
 }});
 try{
  for(let i=0;i<8;i++){h.render();await settle();}
  let nodes=h.render();let text=textContent(nodes);assert.match(text,/dryness goal.*Petrolatum/i);assert(!/Personal assessment unavailable/.test(text));
  assert.equal(nodes.filter(n=>n.props.accessibilityLabel==='Ingredient context summary').length,1);
  const surface=nodes.find(n=>n.type==='Surface')!;assert(surface.props.summary,'source context must be in the compact sheet summary');
  press(control(nodes,'Ingredient details: Sorbitol'));assert.match(textContent(h.render()),/hold water/i);
  identityRefused=true;t.mock.timers.tick(10000);for(let i=0;i<4;i++){h.render();await settle();}assert(!/dryness goal/.test(textContent(h.render())));
  identityRefused=false;t.mock.timers.tick(10000);for(let i=0;i<4;i++){h.render();await settle();}assert.match(textContent(h.render()),/dryness goal/);
  context=structuredClone(context);context.revision++;context.profile!.revision=context.revision;context.profile!.data.primaryGoal={state:'known',value:'oiliness'};
  t.mock.timers.tick(10000);for(let i=0;i<4;i++){h.render();await settle();}assert(!/dryness goal/.test(textContent(h.render())));
  refused=true;t.mock.timers.tick(10000);for(let i=0;i<4;i++){h.render();await settle();}assert(!/dryness goal|reported skin/.test(textContent(h.render())));
  nodes=h.render({view:{owner:null,result:null,saved:false,loading:false,error:null,scrollOffset:0}});assert(!/Petrolatum|Sorbitol|dryness goal/.test(textContent(nodes)));
 }finally{h.dispose();}
});
