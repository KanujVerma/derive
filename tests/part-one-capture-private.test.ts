import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { readFileSync } from 'node:fs';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';
import { MemoryLabelDraft } from '../src/presentation/part-one/capture.ts';
import * as controllerRuntime from '../src/presentation/part-one/privateCaptureController.ts';
import { createPrivateLabelSanitizer } from '../src/services/partOneUpload.ts';
import type { ScanResult } from '../src/contracts/PartOne.ts';
import type { CapturePrivateCommitRequest, CaptureRecovery } from '../src/contracts/PartOnePrivate.ts';
import type { PartOnePrivateTransport } from '../src/services/partOnePrivateClient.ts';
import type { GenericCapturedSourceOutcome } from '../src/contracts/PartOneCapturedSource.ts';
const id=(n:number)=>`ca000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const capture={schemaVersion:1 as const,captureSessionId:id(1),packageObservationId:id(2),scanId:id(3),generation:1,captureRevision:0,deletionEpoch:0,itemId:id(4),candidateId:null};
const owner=id(10),binding={...capture,ownerId:owner,sheetSessionId:id(3)};
const result:ScanResult={schemaVersion:1,requestId:id(5),scanId:id(3),generation:1,resultRevision:1,identity:'exact',itemId:id(4),candidateIds:[],snapshotId:id(6),declarationId:null,declarationState:'partial',scope:'private_package',
 packageConfirmation:'unconfirmed',work:'complete',jobId:null,subscriptionId:null,nextCheckAfter:null,display:{resultRevision:1,selectedIdentity:{id:id(4),name:'Synthetic label',brand:null,variantText:'100 ml',expiresAt:'2027-01-01T00:00:00.000Z',image:null},candidates:[],sections:[],sources:[],limitations:[]},reasonCodes:[],conflictIds:[],evidenceIds:[],allowedActions:['save_partial','add_photo'],freshness:{observedAt:'2026-10-01T00:00:00.000Z',expiresAt:'2027-01-01T00:00:00.000Z',state:'fresh'}};
const asset={evidenceId:id(7),storageObjectId:id(8),contentHash:'synthetic-jpeg-sha256',width:10,height:10,metadataStripped:true as const};
const cap={schemaVersion:1 as const,enabled:true,reasonCode:'synthetic_only',policyVersion:'synthetic-local-v1',retentionSeconds:3600,deletionDeadlineSeconds:60,expiresAt:'2027-01-01T00:00:00.000Z'};
const prepared=()=>({bytes:new Uint8Array([255,216,1,2,255,217]),mimeType:'image/jpeg' as const,width:10,height:10,sourceWidth:10,sourceHeight:10,orientationTransform:[1,0,0,0,1,0,0,0,1],cropRegion:[0,0,1,1],recipeVersion:'derive-private-jpeg-v1' as const});
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function setup(extra:Partial<PartOnePrivateTransport>={},config:{enabled?:boolean;reviewId?:string}={}) {
 let liveOwner:string|null=owner, next=100, bytes:Uint8Array|undefined, uploads=0, saves=0, removals=0;
 const requests:CapturePrivateCommitRequest[]=[];
 const draft=new MemoryLabelDraft(()=>0);draft.begin(binding,55);
 const ticket=draft.addPhoto(binding,id(7),'file:///synthetic-managed-label.img');if(ticket==='cap_reached')throw Error();
 await draft.recognize(ticket,{recognize:async input=>({evidenceId:input.evidenceId,captureSessionId:input.captureSessionId,generation:input.generation,recognizer:'synthetic_fixture',recognizerVersion:'v1',languageConfig:input.languages,correctionEnabled:false,sourceWidth:10,sourceHeight:10,orientationTransform:[1,0,0,0,1,0,0,0,1],status:'recognized',lines:['Ingredients: 1,2-Hexanediol,','PEG-240/HDI Copolymer.'].map(text=>({text,region:[.1,.1,.8,.1],alternatives:[],confidence:1}))})},()=>binding);
 let recovery:CaptureRecovery={schemaVersion:1,capture,editable:true,result,boundResult:result,assets:[{recordId:null,asset,attestationId:id(9),expiresAt:cap.expiresAt,signedAccess:{url:'http://127.0.0.1/synthetic-private-jpeg',expiresAt:cap.expiresAt}}],sourceObservations:[],edits:[],declarationIds:[],review:null,reviewReceiptId:null,capturedSource:null};
 const transport:PartOnePrivateTransport={list:async()=>[],capability:async()=>cap,upload:async(_id,_bind,photo)=>{uploads++;bytes=photo.bytes;return{schemaVersion:1,capture,result,asset,attestationId:id(9),expiresAt:cap.expiresAt};},commit:async(_id,request)=>{requests.push(request);recovery={...recovery,sourceObservations:request.sourceObservations,edits:request.edits.map(edit=>({...edit,actorOwnerId:owner})),review:request.review};return{schemaVersion:1,capture,result,assetIds:[id(8)],observationIds:[],declarationIds:[]};},recover:async()=>recovery,remove:async()=>{removals++;},saveResult:async()=>{saves++;return{saveId:id(50)};},...extra};
 const controller=controllerRuntime.createPrivateCaptureController({enabled:config.enabled??true,transport,sanitize:async()=>prepared(),currentOwner:()=>liveOwner,currentDraft:()=>draft.read(binding),createId:()=>id(next++),reviewId:config.reviewId});
 controller.setOwner(owner);controller.bind(owner,capture,result);
 const ui=componentHarness('src/components/check/part-one/PartOnePrivateCapturePanel.tsx','PartOnePrivateCapturePanel',{controller,ownerId:owner,draft,binding},{modules:{'../../../presentation/part-one/privateCaptureController':controllerRuntime,'react-native':{View:'View',Text:'Text',TextInput:'TextInput',Image:'Image',Pressable:'Pressable',StyleSheet:{create:(v:unknown)=>v}}}});
 return{controller,ui,draft,requests,transport,get bytes(){return bytes},get uploads(){return uploads},get saves(){return saves},get removals(){return removals},setOwner(value:string|null){liveOwner=value},setRecovery(value:CaptureRecovery){recovery=value},get recovery(){return recovery}};
}
async function saveMounted(f:Awaited<ReturnType<typeof setup>>) {press(control(f.ui.render(),'Review private photo and text save'));await tick();press(control(f.ui.render(),'I agree to the disclosed private photo and text upload'));press(control(f.ui.render(),'Save disclosed private label evidence'));await tick();}
test('A17/A19 actual private UI disclosure, roles, binary upload, save and restart originals stay partial',async()=>{
 const f=await setup();try{
  press(control(f.ui.render(),'Photo 1 is a package or barcode view'));assert.equal(f.uploads,0);
  press(control(f.ui.render(),'Review private photo and text save'));await tick();assert.match(textContent(f.ui.render()),/3600\s+seconds/);assert.equal(control(f.ui.render(),'Save disclosed private label evidence').props.disabled,true);assert.equal(f.uploads,0);
  press(control(f.ui.render(),'I agree to the disclosed private photo and text upload'));press(control(f.ui.render(),'Save disclosed private label evidence'));await tick();
  assert.equal(f.uploads,1);assert.equal(f.saves,1);assert.equal(f.requests[0].sourceObservations[0].role,'package');assert.equal(f.requests[0].reviewId,null);assert.deepEqual([...f.bytes!],[0,0,0,0,0,0]);assert.match(textContent(f.ui.render()),/partial or uncertain/);
  f.controller.close();await f.controller.recover(owner,capture.captureSessionId);assert.match(textContent(f.ui.render()),/1,2-Hexanediol/);assert.match(textContent(f.ui.render()),/PEG-240\/HDI Copolymer/);
  press(control(f.ui.render(),'Remove saved private label evidence'));await tick();assert.equal(f.removals,1);assert(!textContent(f.ui.render()).includes('PEG-240'));
 }finally{f.draft.remove();}
});
test('A16 real saved correction handlers compose full transcripts and one linear revision chain',async()=>{
 const f=await setup();try{await saveMounted(f);
  press(control(f.ui.render(),`Correct saved ingredients photo 1 recognition 1 line 1`));control(f.ui.render(),'Saved correction for line 1').props.onChangeText('Ingredients: 1,3-Hexanediol,');press(control(f.ui.render(),'Apply saved private correction to line 1'));
  press(control(f.ui.render(),`Correct saved ingredients photo 1 recognition 1 line 2`));control(f.ui.render(),'Saved correction for line 2').props.onChangeText('PEG-240/HDI Copolymer.\nAqua (Water, Eau)');press(control(f.ui.render(),'Apply saved private correction to line 2'));
  const edits=f.controller.getState().pendingEdits;assert.equal(edits[0].text,'Ingredients: 1,3-Hexanediol,\nPEG-240/HDI Copolymer.');assert.equal(edits[1].supersedesId,edits[0].observationId);assert.equal(edits[1].revision,3);assert.equal(edits[1].text,'Ingredients: 1,3-Hexanediol,\nPEG-240/HDI Copolymer.\nAqua (Water, Eau)');
  press(control(f.ui.render(),'Review private correction save'));await tick();press(control(f.ui.render(),'I agree to the disclosed private photo and text upload'));press(control(f.ui.render(),'Save disclosed private label evidence'));await tick();assert.equal(f.uploads,1);assert.equal(f.requests[1].edits.length,2);
  f.controller.close();await f.controller.recover(owner,capture.captureSessionId);assert.match(textContent(f.ui.render()),/Original recognition:\s+Ingredients: 1,2-Hexanediol/);assert.match(textContent(f.ui.render()),/Your private correction/);assert.match(textContent(f.ui.render()),/Aqua \(Water, Eau\)/);
 }finally{f.draft.remove();}
});
test('A16 local multiline corrections preserve untouched lines before initial upload',async()=>{
 const f=await setup();try{f.draft.edit(binding,id(7),'Ingredients: 1,3-Hexanediol,',{evidenceId:id(7),observationIndex:0,lineIndex:0});f.draft.edit(binding,id(7),'PEG-240/HDI Copolymer.\nAqua (Water, Eau)',{evidenceId:id(7),observationIndex:0,lineIndex:1});await saveMounted(f);const edits=f.requests[0].edits;assert.equal(edits[1].supersedesId,edits[0].observationId);assert.equal(edits[1].revision,3);assert.equal(edits[1].text,'Ingredients: 1,3-Hexanediol,\nPEG-240/HDI Copolymer.\nAqua (Water, Eau)');}finally{f.draft.remove();}
});
test('A19 owner switch and close fence late uploads, hide private text and never clean using the new account',async()=>{
 let release!:(value:any)=>void;const f=await setup({upload:()=>new Promise(resolve=>{release=resolve})});try{
  press(control(f.ui.render(),'Review private photo and text save'));await tick();f.controller.acceptDisclosure(true);const pending=f.controller.confirmSave();await tick();f.setOwner(id(99));assert.equal(f.ui.render().length,0);f.controller.setOwner(id(99));release({schemaVersion:1,capture,result,asset,attestationId:id(9),expiresAt:cap.expiresAt});assert.equal(await pending,false);assert.equal(f.requests.length,0);assert.equal(f.removals,0);assert.equal(f.controller.getState().recovery,null);
 }finally{f.draft.remove();}
});
test('A19 draft mutation after server upload performs one original-owner cleanup and cannot commit',async()=>{
 const f=await setup({upload:async()=>{f.draft.edit(binding,id(7),'Changed',{evidenceId:id(7),observationIndex:0,lineIndex:0});return{schemaVersion:1,capture,result,asset,attestationId:id(9),expiresAt:cap.expiresAt}}});try{await saveMounted(f);assert.equal(f.removals,1);assert.equal(f.requests.length,0);assert.equal(f.controller.getState().stage,'conflict');}finally{f.draft.remove();}
});
test('A18 cancellation removes capture and fences ignored-abort commit; offline retry reuses request IDs',async()=>{
 let release!:(value:any)=>void;const f=await setup({commit:()=>new Promise(resolve=>{release=resolve})});try{
  press(control(f.ui.render(),'Review private photo and text save'));await tick();f.controller.acceptDisclosure(true);const pending=f.controller.confirmSave();await tick();press(control(f.ui.render(),'Cancel private save and remove uploaded evidence'));await tick();release({schemaVersion:1,capture,result,assetIds:[],observationIds:[],declarationIds:[]});assert.equal(await pending,false);assert.equal(f.removals,1);assert.equal(f.controller.getState().stage,'removed');
 }finally{f.draft.remove();}
 let attempt=0;const ids:string[]=[];const r=await setup({commit:async(_id,request)=>{ids.push(request.idempotencyKey);if(++attempt===1)throw Error('offline');return{schemaVersion:1,capture,result,assetIds:[],observationIds:[],declarationIds:[]}}});try{await saveMounted(r);assert.equal(r.controller.getState().stage,'unavailable');press(control(r.ui.render(),'Retry private save with disclosure'));await tick();r.controller.acceptDisclosure(true);await r.controller.confirmSave();assert.deepEqual(ids,[ids[0],ids[0]]);assert.equal(r.uploads,1);}finally{r.draft.remove();}
});
test('A19 disabled policy prevents any upload; unresolved private note does not invent a public save',async()=>{
 const f=await setup({capability:async()=>({...cap,enabled:false})});try{press(control(f.ui.render(),'Review private photo and text save'));await tick();assert.equal(f.uploads,0);assert.equal(f.controller.getState().stage,'disabled');}finally{f.draft.remove();}
 const r=await setup({commit:async()=>({schemaVersion:1,capture,result:{...result,snapshotId:null,allowedActions:['add_photo']},assetIds:[],observationIds:[],declarationIds:[]})});try{await saveMounted(r);assert.equal(r.saves,0);assert.equal(r.controller.getState().stage,'saved_partial');}finally{r.draft.remove();}
});
test('A07 only returned server readiness changes accepted status; fixture review ID never enters app composition',async()=>{
 const f=await setup({}, {reviewId:id(999)});try{await saveMounted(f);assert.equal(f.requests[0].reviewId,id(999));assert.equal(f.controller.getState().stage,'saved_partial');const accepted={...result,declarationState:'accepted' as const,declarationId:id(80),packageConfirmation:'photo_supported' as const};f.setRecovery({...f.recovery,result:accepted,boundResult:accepted});await f.controller.recover(owner,capture.captureSessionId);assert.equal(f.controller.getState().stage,'saved_accepted');}finally{f.draft.remove();}
 const source=readFileSync(new URL('../src/components/check/CheckProductScreen.tsx',import.meta.url),'utf8');assert(!source.includes('reviewId:'));assert.match(source,/privateCapture.bind\(owner, capture, result\)/);assert.match(source,/interactionLocked=\{privateWorking\}/);
 const saved=readFileSync(new URL('../src/components/my-stuff/PartOneSavedProducts.tsx',import.meta.url),'utf8');assert.match(saved,/partOnePrivateTransport.list\(\)/);assert.match(saved,/privateController.recover\(ownerId, record.captureSessionId\)/);assert.match(saved,/PartOnePrivateCapturePanel controller=\{privateController\}/);
});
test('A25 native upload boundary requires local files, explicit valid crop, bounded JPEG and safe errors',async()=>{
 let calls=0;const sanitize=createPrivateLabelSanitizer({prepareUpload:async()=>{calls++;return{status:'prepared',base64:'/9gBAv/Z',...prepared(),bytes:undefined}}});await assert.rejects(sanitize('https://example.invalid/photo',[0,0,1,1]),/unavailable/);assert.equal(calls,0);await assert.rejects(sanitize('file:///synthetic',[0,0,2,1]),/invalid_crop/);
 const payload={status:'prepared',base64:'/9gBAv/Z',mimeType:'image/jpeg',width:10,height:10,sourceWidth:10,sourceHeight:10,orientationTransform:[1,0,0,0,1,0,0,0,1],cropRegion:[0,0,1,1],recipeVersion:'derive-private-jpeg-v1'};const valid=await createPrivateLabelSanitizer({prepareUpload:async()=>payload})('file:///synthetic',[0,0,1,1]);assert.deepEqual([...valid.bytes],[255,216,1,2,255,217]);assert(!('uri' in valid));
 await assert.rejects(createPrivateLabelSanitizer({prepareUpload:async()=>({...payload,base64:'AAAA'})})('file:///synthetic'),/invalid_sanitized/);await assert.rejects(createPrivateLabelSanitizer({prepareUpload:async()=>{throw Error('sensitive URI and transcript')}})('file:///synthetic'),error=>error instanceof Error&&error.message==='local_sanitizer_failed');
});
test('Saved correction controls use stable friendly photo roles and numbers without exposing evidence UUIDs',async()=>{
 const f=await setup();try{
  await saveMounted(f);const original=f.recovery.sourceObservations[0];
  f.setRecovery({...f.recovery,assets:[{...f.recovery.assets[0],signedAccess:null},{...f.recovery.assets[0],attestationId:id(703),asset:{...asset,evidenceId:id(701),storageObjectId:id(704)},signedAccess:null}],sourceObservations:[original,{...original,observationId:id(700),role:'package',observation:{...original.observation,evidenceId:id(701)}},{...original,observationId:id(702)}]});
  await f.controller.recover(owner,capture.captureSessionId);
  const nodes=f.ui.render();assert(control(nodes,'Correct saved ingredients photo 1 recognition 1 line 1'));
  assert(control(nodes,'Correct saved package photo 2 recognition 1 line 1'));
  assert(control(nodes,'Correct saved ingredients photo 1 recognition 2 line 1'));
  assert(!nodes.some(node=>typeof node.props.accessibilityLabel==='string' && node.props.accessibilityLabel.includes(id(7))));
 }finally{f.draft.remove();}
});
test('Recovered mixed-order image assets and source observations share the exact same mounted photo numbers',async()=>{
 const f=await setup();try{
  await saveMounted(f);const original=f.recovery.sourceObservations[0], saved=f.recovery.assets[0];
  const pkg={...original,observationId:id(800),role:'package' as const,observation:{...original.observation,evidenceId:id(801)}};
  const pkgAsset={...saved,attestationId:id(802),asset:{...saved.asset,evidenceId:id(801),storageObjectId:id(803)},signedAccess:{...saved.signedAccess!,url:'http://127.0.0.1/package-ordered-first'}};
  const orphanAsset={...saved,attestationId:id(804),asset:{...saved.asset,evidenceId:id(805),storageObjectId:id(806)},signedAccess:{...saved.signedAccess!,url:'http://127.0.0.1/asset-without-ocr'}};
  f.setRecovery({...f.recovery,sourceObservations:[original,pkg],assets:[pkgAsset,orphanAsset,saved]});await f.controller.recover(owner,capture.captureSessionId);
  const nodes=f.ui.render();assert.equal(control(nodes,'Saved private sanitized photo 1').props.source.uri,saved.signedAccess!.url);
  assert.equal(control(nodes,'Saved private sanitized photo 2').props.source.uri,pkgAsset.signedAccess.url);
  assert.equal(control(nodes,'Saved private sanitized photo 3').props.source.uri,orphanAsset.signedAccess.url);
  assert(control(nodes,'Correct saved ingredients photo 1 recognition 1 line 1'));assert(control(nodes,'Correct saved package photo 2 recognition 1 line 1'));
 }finally{f.draft.remove();}
});
test('A17 My Stuff actual list and open handlers recover saved private notes and deduplicate linked saves',async()=>{
 const f=await setup();await saveMounted(f);let focus=false,cleanup:(()=>void)|undefined,listCalls=0,recoverCalls=0;
 const transport={...f.transport,list:async()=>{listCalls++;return[{capture,editable:true,boundResult:result}]},recover:async()=>{recoverCalls++;return f.recovery}};
 const ui=componentHarness('src/components/my-stuff/PartOneSavedProducts.tsx','PartOneSavedProducts',{ownerId:owner},{modules:{
  'expo-router':{useFocusEffect:(callback:()=>()=>void)=>{if(!focus){focus=true;cleanup=callback()}}},'../ui/Button':{Button:'Button'},
  '../../services/partOne':{listPartOneSaves:async()=>[],readPartOneSave:async()=>({saveId:id(50),captureSessionId:id(1),result}),deletePartOneSave:async()=>{}},
  '../../services/partOnePrivate':{PART_ONE_PRIVATE_ENABLED:true,partOnePrivateTransport:transport},'../../../modules/derive-label-ocr':{preparePrivateLabelUpload:async()=>prepared()},
  '../../services/productCatalog':{createCatalogRequestId:()=>id(500)},'../../stores/authStore':{useAuthStore:{getState:()=>({sessionUserId:owner})}},
  '../../presentation/part-one/privateCaptureController':controllerRuntime,'../../../presentation/part-one/privateCaptureController':controllerRuntime,
  'react-native':{View:'View',Text:'Text',TextInput:'TextInput',Image:'Image',Pressable:'Pressable',StyleSheet:{create:(v:unknown)=>v}},
 }});
 try{ui.render();await tick();assert.equal(listCalls,1);press(control(ui.render(),'Open saved private label note'));await tick();assert.equal(recoverCalls,1);const sheet=ui.render().find(node=>node.type==='PartOneResultSheet');assert(sheet);assert.equal(sheet.props.view.result.itemId,capture.itemId);assert.equal(sheet.props.localDraft.props.ownerId,owner);sheet.props.onClose();assert(!ui.render().some(node=>node.type==='PartOneResultSheet'));}finally{cleanup?.();f.draft.remove();}
});
test('A16 reordered repeated OCR passes and same-transaction edits follow immutable source ancestry and chain tip',async()=>{
 const f=await setup();try{
  await saveMounted(f);const original=f.recovery.sourceObservations[0];
  const otherPass={...original,observationId:id(900),observation:{...original.observation,lines:original.observation.lines.map(line=>({...line,text:'Other recognition pass'}))}};
  const first={observationId:id(902),supersedesId:original.observationId,revision:2,text:'Ingredients: 1,3-Hexanediol,\nPEG-240/HDI Copolymer.',replacementText:'Ingredients: 1,3-Hexanediol,',reason:'Synthetic operator edit',sourceRef:{evidenceId:id(7),observationIndex:0,lineIndex:0},actorOwnerId:owner};
  const second={...first,observationId:id(901),supersedesId:first.observationId,revision:3,text:'Ingredients: 1,3-Hexanediol,\nPEG-240/HDI Copolymer; Aqua (Water, Eau).',replacementText:'PEG-240/HDI Copolymer; Aqua (Water, Eau).',sourceRef:{...first.sourceRef,lineIndex:1}};
  f.setRecovery({...f.recovery,sourceObservations:[otherPass,original],edits:[second,first]});await f.controller.recover(owner,capture.captureSessionId);
  const nodes=f.ui.render();assert.match(textContent(nodes),/Your private correction/);
  press(control(nodes,'Correct saved ingredients photo 1 recognition 2 line 2'));assert.equal(control(f.ui.render(),'Saved correction for line 2').props.value,second.replacementText);
  control(f.ui.render(),'Saved correction for line 2').props.onChangeText('PEG-240/HDI Copolymer; Aqua (Water, Eau); Glycerin.');press(control(f.ui.render(),'Apply saved private correction to line 2'));
  const next=f.controller.getState().pendingEdits[0];assert.equal(next.supersedesId,second.observationId);assert.equal(next.revision,4);assert.equal(next.sourceRef!.observationIndex,0);assert.equal(next.text,'Ingredients: 1,3-Hexanediol,\nPEG-240/HDI Copolymer; Aqua (Water, Eau); Glycerin.');
  assert.deepEqual(controllerRuntime.privateSourceEditChain(original.observationId,[second,first])?.map(edit=>edit.revision),[2,3]);
 }finally{f.draft.remove();}
});
test('A16 forked or skipped correction history cannot choose a guessed latest edit',async()=>{
 const f=await setup();try{
  await saveMounted(f);const base=f.recovery.sourceObservations[0].observationId;
  const edit={observationId:id(950),supersedesId:base,revision:2,text:'Changed',replacementText:'Changed',reason:'Synthetic correction',sourceRef:{evidenceId:id(7),observationIndex:0,lineIndex:0},actorOwnerId:owner};
  const fork={...edit,observationId:id(951)};assert.equal(controllerRuntime.privateSourceEditChain(base,[edit,fork]),null);assert.equal(controllerRuntime.privateSourceEditChain(base,[{...edit,revision:4}]),null);
  f.setRecovery({...f.recovery,edits:[edit,fork]});await f.controller.recover(owner,capture.captureSessionId);assert.match(textContent(f.ui.render()),/Correction history is uncertain/);
  assert(!f.ui.render().some(node=>node.props.accessibilityLabel==='Correct saved ingredients photo 1 recognition 1 line 1'));
  assert.equal(f.controller.correctLine({evidenceId:id(7),observationIndex:0,lineIndex:0},'New',base),false);
 }finally{f.draft.remove();}
});
test('A19 uncertain private commit, revision conflict and disabled capability invalidate recovered accepted text and photos',async()=>{
 for(const failure of ['offline after partial source persistence','Private result revision changed']){
  const f=await setup();try{await saveMounted(f);const accepted={...result,declarationState:'accepted' as const,declarationId:id(980),packageConfirmation:'photo_supported' as const};f.setRecovery({...f.recovery,result:accepted,boundResult:accepted});await f.controller.recover(owner,capture.captureSessionId);
   assert.equal(f.controller.getState().stage,'saved_accepted');f.controller.correctLine({evidenceId:id(7),observationIndex:0,lineIndex:0},'Corrected');
   f.transport.commit=async()=>{throw Error(failure)};press(control(f.ui.render(),'Review private correction save'));await tick();f.controller.acceptDisclosure(true);await f.controller.confirmSave();
   assert.equal(f.controller.getState().recovery,null);assert.equal(f.controller.getState().result,null);assert(!textContent(f.ui.render()).includes('accepted by server review'));assert(!f.ui.render().some(node=>node.type==='Image'));assert(control(f.ui.render(),'Reopen private evidence after conflict'));
  }finally{f.draft.remove();}
 }
 const f=await setup();try{await saveMounted(f);f.controller.correctLine({evidenceId:id(7),observationIndex:0,lineIndex:0},'Corrected');f.transport.capability=async()=>({...cap,enabled:false});await f.controller.discloseChanges();assert.equal(f.controller.getState().recovery,null);assert.equal(f.controller.getState().result,null);assert(!f.ui.render().some(node=>node.type==='Image'));}finally{f.draft.remove();}
 const saved=readFileSync(new URL('../src/components/my-stuff/PartOneSavedProducts.tsx',import.meta.url),'utf8');assert.match(saved,/privateReadBlocked \? null : selected.result/);
});
test('A19 real My Stuff selected private sheet hides old accepted projection after uncertain correction commit',async()=>{
 const f=await setup();await saveMounted(f);const accepted={...result,declarationState:'accepted' as const,declarationId:id(990),packageConfirmation:'photo_supported' as const};f.setRecovery({...f.recovery,result:accepted,boundResult:accepted});
 let focus=false,cleanup:(()=>void)|undefined,controller!:ReturnType<typeof controllerRuntime.createPrivateCaptureController>;
 const factory={...controllerRuntime,createPrivateCaptureController:(options:Parameters<typeof controllerRuntime.createPrivateCaptureController>[0])=>{controller=controllerRuntime.createPrivateCaptureController(options);return controller;}};
 const transport={...f.transport,commit:async()=>{throw Error('offline after server persisted partial correction')}};
 const ui=componentHarness('src/components/my-stuff/PartOneSavedProducts.tsx','PartOneSavedProducts',{ownerId:owner},{modules:{
  'expo-router':{useFocusEffect:(callback:()=>()=>void)=>{if(!focus){focus=true;cleanup=callback()}}},'../ui/Button':{Button:'Button'},
  '../../services/partOne':{listPartOneSaves:async()=>[{saveId:id(50),captureSessionId:id(1),result:accepted}],readPartOneSave:async()=>({saveId:id(50),captureSessionId:id(1),result:accepted}),deletePartOneSave:async()=>{}},
  '../../services/partOnePrivate':{PART_ONE_PRIVATE_ENABLED:true,partOnePrivateTransport:transport},'../../../modules/derive-label-ocr':{preparePrivateLabelUpload:async()=>prepared()},
  '../../services/productCatalog':{createCatalogRequestId:()=>id(500)},'../../stores/authStore':{useAuthStore:{getState:()=>({sessionUserId:owner})}},
  '../../presentation/part-one/privateCaptureController':factory,'../../../presentation/part-one/privateCaptureController':controllerRuntime,
  'react-native':{View:'View',Text:'Text',TextInput:'TextInput',Image:'Image',Pressable:'Pressable',StyleSheet:{create:(v:unknown)=>v}},
 }});
 try{ui.render();await tick();press(control(ui.render(),'Open Synthetic label'));await tick();assert.equal(ui.render().find(node=>node.type==='PartOneResultSheet')!.props.view.result.declarationState,'accepted');
  controller.correctLine({evidenceId:id(7),observationIndex:0,lineIndex:0},'Corrected');await controller.discloseChanges();controller.acceptDisclosure(true);await controller.confirmSave();
  const sheet=ui.render().find(node=>node.type==='PartOneResultSheet')!;assert.equal(sheet.props.view.result,null);assert.match(sheet.props.view.error,/could not be saved or read/);
  const check=readFileSync(new URL('../src/components/check/CheckProductScreen.tsx',import.meta.url),'utf8');assert.match(check,/privateCaptureProjectionBlocked\(privateState, partOneView.result, liveCheckOwner, labelBinding\)/);assert.match(check,/privateCapture.recover\(liveCheckOwner, privateReadId\)/);
 }finally{cleanup?.();f.draft.remove();}
});
test('A19 failed recovery with cleared session still fences the exact retained private binding and refresh target',async()=>{
 const f=await setup();try{
  await saveMounted(f);f.transport.recover=async()=>{throw Error('private policy disabled or unavailable')};await f.controller.recover(owner,capture.captureSessionId);
  const state=f.controller.getState();assert.equal(state.capture,null);assert.equal(state.recovery,null);
  assert.equal(controllerRuntime.privateCaptureProjectionBlocked(state,result,owner,binding),true);
  assert.equal(controllerRuntime.privateCaptureProjectionBlocked(state,{...result,scope:'public'},owner,binding),false);
  assert.equal(controllerRuntime.privateCaptureProjectionBlocked(state,{...result,scanId:id(1000)},owner,binding),false);
  assert.equal(controllerRuntime.privateCaptureProjectionBlocked(state,{...result,generation:2},owner,binding),false);
  assert.equal(controllerRuntime.privateCaptureProjectionBlocked(state,result,id(1000),binding),false);
  assert.equal(controllerRuntime.privateCaptureProjectionBlocked(state,result,owner,{...binding,ownerId:id(1000)}),false);
  assert.equal(controllerRuntime.privateCaptureProjectionBlocked(state,result,owner,null),false);
  const source=readFileSync(new URL('../src/components/check/CheckProductScreen.tsx',import.meta.url),'utf8');assert.match(source,/privateReadId = privateState.capture\?\.captureSessionId \?\? \(labelBinding\?\.ownerId === liveCheckOwner/);
 }finally{f.draft.remove();}
});
test('A25 mounted offline retention expiry withdraws originals, corrections, assemblies and readiness; fresh recovery is required',async t=>{
 const start=Date.parse('2026-10-02T00:00:00.000Z');t.mock.timers.enable({apis:['Date','setTimeout'],now:start});
 const f=await setup();let cursor=0,notifications=0;const slots:any[]=[],effects:Array<()=>void>=[];
 const react={...React,useState(initial:any){const at=cursor++;if(!(at in slots))slots[at]=typeof initial==='function'?initial():initial;return[slots[at],(value:any)=>{slots[at]=typeof value==='function'?value(slots[at]):value}];},
  useSyncExternalStore(subscribe:(listener:()=>void)=>()=>void,getSnapshot:()=>unknown){const at=cursor++;if(!(at in slots))slots[at]=subscribe(()=>notifications++);return getSnapshot();},
  useEffect(effect:()=>void|(()=>void),dependencies:unknown[]){const at=cursor++,old=slots[at];if(!old||dependencies.some((value,index)=>value!==old.dependencies[index])){effects.push(()=>{old?.cleanup?.();slots[at]={dependencies,cleanup:effect()}})}}};
 const ui=componentHarness('src/components/check/part-one/PartOnePrivateCapturePanel.tsx','PartOnePrivateCapturePanel',{controller:f.controller,ownerId:owner},{modules:{react,'../../../presentation/part-one/privateCaptureController':controllerRuntime,'react-native':{View:'View',Text:'Text',TextInput:'TextInput',Image:'Image',Pressable:'Pressable',StyleSheet:{create:(v:unknown)=>v}}}});
 const render=()=>{cursor=0;const nodes=ui.render();while(effects.length)effects.shift()!();return nodes;};
 try{
  await saveMounted(f);const original=f.recovery.sourceObservations[0];const ref={evidenceId:id(7),observationIndex:0,lineIndex:0};
  const edit={observationId:id(1100),supersedesId:original.observationId,revision:2,text:'PRIVATE CORRECTION\nPEG-240/HDI Copolymer.',replacementText:'PRIVATE CORRECTION',reason:'Synthetic operator correction',sourceRef:ref,actorOwnerId:owner};
  const review=f.recovery.review!;const expiresAt=new Date(start+3000).toISOString(),signedExpiry=new Date(start+1000).toISOString();
  const recovered:CaptureRecovery=extractedPartial({...f.recovery,edits:[edit],assets:[{...f.recovery.assets[0],expiresAt,signedAccess:{...f.recovery.assets[0].signedAccess!,expiresAt:signedExpiry}}],review:{...review,reviewState:{...review.reviewState,assemblies:[{revision:1,supersedesRevision:null,section:'ingredients',language:'en',sameDeclarationObservedBy:owner,lines:[{text:'PRIVATE ASSEMBLY',rawText:'PRIVATE ASSEMBLY',correctionRevision:null,actorOwnerId:null,sources:[{...ref,region:[.1,.1,.8,.1],rawText:'PRIVATE ASSEMBLY',correctionRevision:null}]}]}]}}});
  f.setRecovery(recovered);await f.controller.recover(owner,capture.captureSessionId);f.draft.remove();
  assert.match(textContent(render()),/Read from this private label/);assert.match(textContent(render()),/1,2-Hexanediol/);assert.match(textContent(render()),/PRIVATE CORRECTION/);assert.match(textContent(render()),/PRIVATE ASSEMBLY/);assert(render().some(node=>node.type==='Image'));
  t.mock.timers.tick(1000);assert(!render().some(node=>node.type==='Image'));assert.match(textContent(render()),/PRIVATE CORRECTION/,'Signed access expiry alone does not shorten explicit underlying asset retention');
  f.controller.correctLine(ref,'UNSAVED PRIVATE EDIT',original.observationId);const before=notifications;t.mock.timers.tick(2000);await Promise.resolve();assert(notifications>before,'Mounted subscription is notified automatically at asset expiry');
  const expired=render();assert(!textContent(expired).includes('Read from this private label'));assert(!textContent(expired).includes('Hexanediol'));assert(!textContent(expired).includes('PRIVATE CORRECTION'));assert(!textContent(expired).includes('PRIVATE ASSEMBLY'));assert(!textContent(expired).includes('UNSAVED PRIVATE EDIT'));assert(!expired.some(node=>node.type==='Image'));assert.equal(f.controller.getState().recovery,null);assert.equal(f.controller.getState().result,null);assert.equal(f.controller.getState().pendingEdits.length,0);
  f.transport.recover=async()=>{throw Error('offline')};press(control(expired,'Reopen private evidence after conflict'));await tick();assert(!textContent(render()).includes('Hexanediol'));
  f.transport.recover=async()=>recovered;assert.equal(await f.controller.recover(owner,capture.captureSessionId),false,'An expired recovery response cannot restore cached history');
  f.transport.recover=async()=>({...recovered,assets:recovered.assets.map(entry=>({...entry,expiresAt:new Date(Date.now()+10000).toISOString(),signedAccess:null}))});assert.equal(await f.controller.recover(owner,capture.captureSessionId),true);assert.match(textContent(render()),/Read from this private label/);assert.match(textContent(render()),/1,2-Hexanediol/);assert.match(textContent(render()),/PRIVATE CORRECTION/);
 }finally{for(const slot of slots){if(typeof slot==='function')slot();else slot?.cleanup?.();}f.controller.close();f.draft.remove();t.mock.timers.reset();}
});
test('A25 history without an underlying asset deadline has no invented independent permission',async()=>{
 const f=await setup();try{await saveMounted(f);f.setRecovery({...f.recovery,assets:[]});assert.equal(await f.controller.recover(owner,capture.captureSessionId),false);assert.equal(f.controller.getState().recovery,null);assert.equal(f.controller.getState().result,null);assert(!textContent(f.ui.render()).includes('Hexanediol'));}finally{f.controller.close();f.draft.remove();}
});
test('A16 upload derivative recognition is a separate immutable observation; original edits and dimensions are never rewritten',async()=>{
 const f=await setup();try{
  const draft=f.draft.read(binding)!;const original=draft.shots[0].observations[0];original.sourceWidth=5120;original.sourceHeight=1280;
  // Use an immutable observed original in a new draft rather than mutating the controller snapshot.
  f.draft.remove();f.draft.begin(binding,55);const ticket=f.draft.addPhoto(binding,id(7),'file:///large-original.img');if(ticket==='cap_reached')throw Error();
  await f.draft.recognize(ticket,{recognize:async input=>({...original,evidenceId:input.evidenceId,captureSessionId:input.captureSessionId,generation:input.generation,languageConfig:input.languages})},()=>binding);
  f.draft.edit(binding,id(7),'Original-only operator correction',{evidenceId:id(7),observationIndex:0,lineIndex:0});
  let expectedBinding:unknown;const controller=controllerRuntime.createPrivateCaptureController({enabled:true,transport:f.transport,currentOwner:()=>owner,currentDraft:()=>f.draft.read(binding),createId:(()=>{let next=1200;return()=>id(next++)})(),sanitize:async(_uri,_crop,bound)=>{
   expectedBinding=bound;return{...prepared(),derivativeObservation:{...original,evidenceId:bound!.evidenceId,captureSessionId:bound!.captureSessionId,generation:bound!.generation,languageConfig:bound!.languages,sourceWidth:10,sourceHeight:10,orientationTransform:[1,0,0,0,1,0,0,0,1],lines:original.lines.map(line=>({...line,text:'Independent exact JPEG recognition'}))}};
  }});
  controller.setOwner(owner);controller.bind(owner,capture,result);await controller.discloseDraft(f.draft.read(binding)!);controller.acceptDisclosure(true);await controller.confirmSave();
  const request=f.requests[0],source=request.sourceObservations.find(entry=>entry.coordinateSpace==='source_original')!,derivative=request.sourceObservations.find(entry=>entry.coordinateSpace==='sanitized_derivative')!;
  assert.deepEqual(expectedBinding,{evidenceId:id(7),captureSessionId:id(1),generation:1,languages:original.languageConfig,correctionEnabled:false});assert.equal(source.observation.sourceWidth,5120);assert.equal(source.observation.lines[0].text,'Ingredients: 1,2-Hexanediol,');
  assert.deepEqual(derivative.derivedFromObservationIds,[source.observationId]);assert.equal(derivative.observation.lines[0].text,'Independent exact JPEG recognition');assert.equal(request.edits[0].supersedesId,source.observationId);assert(!request.edits.some(edit=>edit.supersedesId===derivative.observationId));controller.close();
 }finally{f.controller.close();f.draft.remove();}
});
test('A25 native sanitizer binding requires exact JPEG derivative dimensions, identity orientation and matching capture',async()=>{
 const f=await setup();try{const original=f.draft.read(binding)!.shots[0].observations[0];const bound={evidenceId:id(7),captureSessionId:id(1),generation:1,languages:original.languageConfig,correctionEnabled:false};
  const payload={status:'prepared',base64:'/9gBAv/Z',mimeType:'image/jpeg',width:10,height:10,sourceWidth:5120,sourceHeight:1280,orientationTransform:[0,-1,1,1,0,0,0,0,1],cropRegion:[0,0,1,1],recipeVersion:'derive-private-jpeg-v1',derivativeObservation:original};
  const valid=await createPrivateLabelSanitizer({prepareUpload:async input=>{assert.equal(input.generation,1);assert.equal(input.evidenceId,id(7));return payload}})('file:///rotated-original',[0,0,1,1],bound);
  assert.equal(valid.sourceWidth,5120);assert.equal(valid.derivativeObservation!.sourceWidth,10);assert.deepEqual(valid.derivativeObservation!.orientationTransform,[1,0,0,0,1,0,0,0,1]);
  for(const derivativeObservation of [{...original,sourceWidth:5120},{...original,orientationTransform:[0,-1,1,1,0,0,0,0,1]},{...original,generation:2}])await assert.rejects(createPrivateLabelSanitizer({prepareUpload:async()=>({...payload,derivativeObservation})})('file:///original',[0,0,1,1],bound));
  await assert.rejects(createPrivateLabelSanitizer({prepareUpload:async()=>({...payload,derivativeObservation:undefined})})('file:///original',[0,0,1,1],bound),/missing_derivative/);
 }finally{f.controller.close();f.draft.remove();}
});

function extractedPartial(recovery:CaptureRecovery):CaptureRecovery {
 const text='1,2-Hexanediol, PEG-240/HDI Copolymer; Aqua (Water, Eau).',original=recovery.sourceObservations[0];
 const derivative={...original,observationId:id(1300),coordinateSpace:'sanitized_derivative' as const,derivedFromObservationIds:[original.observationId],observation:{...original.observation,lines:[{text,region:[.1,.1,.8,.1],confidence:null,alternatives:[]}]}};
 const ref={observationId:derivative.observationId,revision:1,start:0,end:text.length,assetEvidenceId:asset.evidenceId,text,region:[.1,.1,.8,.1]};
 const section={sectionId:id(1301),kind:'ingredients' as const,rawText:text,startCovered:false,endCovered:false,lineCoverageComplete:false,entries:[{entryId:id(1302),sectionId:id(1301),order:0,rawToken:text,sourceSpans:[{observationId:derivative.observationId,imageId:asset.evidenceId,sourceRevision:1,start:0,end:text.length,region:ref.region,transformation:[]}],canonicalIngredientId:null,aliasVersion:'synthetic-test',mapping:'unresolved' as const,quantity:null,conditional:null,uncertaintyReasons:['coverage_unknown']}]};
 const outcome:GenericCapturedSourceOutcome={schemaVersion:1,sourceKind:'captured_label_extractor',state:'partial',absenceClaimsAllowed:false,catalogVerified:false,acceptanceEligible:false,
  candidate:{schemaVersion:1,sourceKind:'captured_label_extractor',extractorVersion:'part-one-private-source-1',candidateId:id(1303),ownerId:owner,captureSessionId:capture.captureSessionId,packageObservationId:capture.packageObservationId,generation:capture.generation,deletionEpoch:capture.deletionEpoch,captureRevision:capture.captureRevision,resultRevision:result.resultRevision,selectedItemId:result.itemId,selectedSnapshotId:result.snapshotId,targetSnapshotId:id(1304),targetDeclarationId:id(1305),observedAt:result.freshness.observedAt!,expiresAt:cap.expiresAt,
   assetBindings:[{evidenceId:asset.evidenceId,attestationId:id(9),storageObjectId:asset.storageObjectId,contentHash:asset.contentHash,objectVersion:'synthetic-v1'}],observationBindings:[{observationId:derivative.observationId,revision:1,textHash:'synthetic-text',recordHash:'synthetic-record',current:true}],packageIdentity:null,name:{value:'Unregistered synthetic label',refs:[ref]},
   variant:{brand:null,line:null,form:null,scent:null,shade:null,spf:null,strength:null,size:null,unit:null,packCount:null,packagingLevel:null},variantRefs:{},category:'unknown',categoryRefs:[],packageMarket:null,marketRefs:[],
   sections:[{kind:'ingredients',observationId:derivative.observationId,revision:1,start:0,end:text.length,startCovered:false,endCovered:false,lineCoverageComplete:false,lineRefs:[ref],headerRefs:[],endRefs:[],uncertaintyReasons:['coverage_unknown']}],gaps:[{code:'ocr_panel_coverage_unverified',observationIds:[derivative.observationId],details:null}],contradictions:[],association:'candidate',reasonCodes:['ingredient_header_not_observed']},
  facts:{sections:[section],capturedText:[{observationId:derivative.observationId,revision:1,rawText:text,sourceRefs:[ref],attributedEdit:false}]},reasonCodes:['coverage_unknown']};
 const applied=(value:ScanResult)=>({...value,snapshotId:id(1304),declarationId:id(1305),resultRevision:value.resultRevision+1,display:{...value.display,resultRevision:value.resultRevision+1}});
 return{...recovery,capture:{...recovery.capture,captureRevision:recovery.capture.captureRevision+1},result:applied(recovery.result),boundResult:recovery.boundResult?applied(recovery.boundResult):null,sourceObservations:[...recovery.sourceObservations,derivative],capturedSource:outcome};
}
test('Generic recovered source facts render exact private partial readings, association and coverage without catalog or absence claims',async()=>{
 const f=await setup();try{await saveMounted(f);const recovered=extractedPartial(f.recovery);f.setRecovery(recovered);assert.equal(await f.controller.recover(owner,capture.captureSessionId),true);f.draft.remove();
  assert.notEqual(recovered.capturedSource!.candidate!.selectedSnapshotId,recovered.boundResult!.snapshotId,'The input public snapshot and new applied private snapshot are distinct');assert.equal(recovered.capturedSource!.candidate!.targetSnapshotId,recovered.boundResult!.snapshotId);assert.equal(recovered.capturedSource!.candidate!.targetDeclarationId,recovered.boundResult!.declarationId);
  const nodes=f.ui.render(),text=textContent(nodes);assert.match(text,/Read from this private label · partial or uncertain/);assert.match(text,/Possible product association · needs review/);assert.match(text,/unlisted ingredients cannot be ruled out/);assert.match(text,/Missing regions and unobserved text remain unknown/);assert.match(text,/Text recognition cannot establish that the whole label panel was captured/);assert.match(text,/An ingredient section heading has not been observed/);assert(!text.includes('ocr_panel_coverage_unverified'));
  assert.equal(control(nodes,'Private label reading: Ingredients read from label').props.children,recovered.capturedSource!.facts.sections[0].rawText);assert.match(text,/1,2-Hexanediol, PEG-240\/HDI Copolymer; Aqua \(Water, Eau\)\./);assert(!text.includes('accepted by server review'));
  f.controller.close();assert(!textContent(f.ui.render()).includes('Unregistered synthetic label'));await f.controller.recover(owner,capture.captureSessionId);assert.match(textContent(f.ui.render()),/Unregistered synthetic label/);
  press(control(f.ui.render(),'Correct saved ingredients photo 1 recognition 2 line 1'));control(f.ui.render(),'Saved correction for line 1').props.onChangeText('Local edit');press(control(f.ui.render(),'Cancel saved private correction for line 1'));assert.equal(f.controller.getState().pendingEdits.length,0);
  f.setOwner(id(1399));assert.equal(f.ui.render().length,0);f.controller.setOwner(id(1399));assert.equal(f.controller.getState().recovery,null);
 }finally{f.controller.close();f.draft.remove();}
});
test('Generic contradiction readings stay visibly partial; stale owner, capture, revision and orphan assets fail closed',async()=>{
 const f=await setup();try{await saveMounted(f);const recovered=extractedPartial(f.recovery),outcome=recovered.capturedSource!;
  outcome.state='conflict';outcome.candidate!.association='contradiction';outcome.candidate!.contradictions=[{kind:'source_reading',field:'ingredients',values:['1,2-Hexanediol','1,3-Hexanediol'],refs:outcome.facts.capturedText[0].sourceRefs}];f.setRecovery(recovered);await f.controller.recover(owner,capture.captureSessionId);assert.match(textContent(f.ui.render()),/Some label readings disagree/);assert.match(textContent(f.ui.render()),/Conflicting\s+label text\s+readings:\s+1,2-Hexanediol \/ 1,3-Hexanediol/);
  const state=f.controller.getState(),candidate=outcome.candidate!;
  for(const mismatch of [{ownerId:id(1399)},{captureSessionId:id(1399)},{packageObservationId:id(1399)},{generation:2},{deletionEpoch:1},{captureRevision:1},{captureRevision:2},{resultRevision:2},{resultRevision:3},{selectedItemId:id(1399)},{targetSnapshotId:candidate.selectedSnapshotId},{targetSnapshotId:id(1399)},{targetDeclarationId:id(1399)},{expiresAt:'2025-01-01T00:00:00.000Z'}])assert.equal(controllerRuntime.privateCapturedLabelProjection({...state,recovery:{...recovered,capturedSource:{...outcome,candidate:{...candidate,...mismatch}}}},owner),null);
  f.setRecovery({...recovered,capturedSource:{...outcome,candidate:{...candidate,assetBindings:[{...candidate.assetBindings[0],evidenceId:id(1399)}]}}});assert.equal(await f.controller.recover(owner,capture.captureSessionId),false);assert.equal(f.controller.getState().recovery,null);
 }finally{f.controller.close();f.draft.remove();}
});
test('Generic recovery keeps server evidence IDs distinct from client photo IDs at mounted retention checks',async()=>{
 const f=await setup();try{await saveMounted(f);const recovered=extractedPartial(f.recovery),serverId=id(1450);
  recovered.assets[0].recordId=serverId;
  recovered.capturedSource=JSON.parse(JSON.stringify(recovered.capturedSource,(_key,value)=>value===asset.evidenceId?serverId:value));
  assert.equal(controllerRuntime.privateRecoveryRetentionDeadline(recovered),Date.parse(cap.expiresAt));
  f.setRecovery(recovered);assert.equal(await f.controller.recover(owner,capture.captureSessionId),true);assert.match(textContent(f.ui.render()),/Read from this private label/);
  const wrong=structuredClone(recovered);wrong.capturedSource!.candidate!.assetBindings[0].evidenceId=asset.evidenceId;
  assert.equal(controllerRuntime.privateRecoveryRetentionDeadline(wrong),0,'A client ID cannot stand in for a different immutable server evidence record');
  wrong.capturedSource!.candidate!.assetBindings[0].evidenceId=id(1451);assert.equal(controllerRuntime.privateRecoveryRetentionDeadline(wrong),0);
 }finally{f.controller.close();f.draft.remove();}
});
test('Private projected sections expire independently and accepted package semantics are not downgraded to global claims',async t=>{
 const start=Date.parse('2026-10-02T00:00:00.000Z');t.mock.timers.enable({apis:['Date','setTimeout'],now:start});const f=await setup();try{await saveMounted(f);
  const section={sectionId:id(1400),kind:'ingredients' as const,text:'Aqua (Water, Eau); 1,2-Hexanediol.',evidenceIds:[asset.evidenceId],policyId:id(1401),observedAt:new Date(start).toISOString(),expiresAt:new Date(start+1000).toISOString()};
  const partial={...result,display:{...result.display,sections:[section]}};f.setRecovery({...f.recovery,result:partial,boundResult:partial});await f.controller.recover(owner,capture.captureSessionId);assert(control(f.ui.render(),'Private label reading: Ingredients read from label'));t.mock.timers.tick(1000);assert(!f.ui.render().some(node=>node.props.accessibilityLabel==='Private label reading: Ingredients read from label'));
  const accepted={...partial,declarationState:'accepted' as const,declarationId:id(1402),packageConfirmation:'photo_supported' as const,display:{...partial.display,sections:[{...section,expiresAt:cap.expiresAt}]}};f.setRecovery({...f.recovery,result:accepted,boundResult:accepted});await f.controller.recover(owner,capture.captureSessionId);assert.match(textContent(f.ui.render()),/Accepted declaration for this private package/);assert(!textContent(f.ui.render()).includes('This is not a complete ingredient list'));
 }finally{f.controller.close();f.draft.remove();t.mock.timers.reset();}
});
