import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { componentHarness,control,textContent,press } from './ux-profile-render.ts';
import { p3input,p3routine,p3revision } from './fixtures/part-three.ts';
import { p2id } from './fixtures/part-two-core.ts';
import { evaluatePersonalResult } from '../src/domain/part-three/evaluate.ts';
import { emptyPartThreeChoices,partThreeTarget } from '../src/presentation/part-three/target.ts';
import { canonicalJson } from '../src/domain/part-two/hash.ts';
import type { PartThreePorts } from '../src/components/check/part-three/usePartThreeCheck';
import type { PartThreeRequest,PartThreeResponse } from '../src/contracts/PartThreeService.ts';
import type { PartThreeView } from '../src/presentation/part-three/controller.ts';
const emptyView=():PartThreeView=>({target:null,result:null,question:null,historical:null,savedAssessmentId:null,savedAt:null,loading:false,saving:false,error:null});
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
const surface={ResultSheetSurface:(p:any)=>React.createElement('Surface',p,p.summary,p.compactActions,p.children)};
test('judge-first card preserves reason/scope and mandatory concerns; history is explicitly separate',()=>{
 const x=p3input();x.context.profile!.data.sensitivities={status:'reported',values:['Glycerin']};const r=evaluatePersonalResult(x);
 const h=componentHarness('src/components/check/part-three/PartThreeSummary.tsx','PartThreeSummary',{view:{...emptyView(),result:r}});
 let content=textContent(h.render());assert.match(content,/Synthetic face lotion.*Check first.*reported as a sensitivity.*Package not confirmed/);assert(!/safe|score|percent|risk level/i.test(content));
 content=textContent(h.render({view:{...emptyView(),historical:{kind:'historical',savedAssessmentId:p2id(88),savedAt:x.now,assessmentWhenSaved:r,currentAssessment:'unavailable'}}}));assert.match(content,/Assessment when saved.*Check first.*Current reassessment is separate.*Current assessment.*unavailable/);
 content=textContent(h.render({view:emptyView()}));assert(!content.includes('Glycerin'));assert(!content.includes('Check first'));
});
test('explicit current/comparator/use selection preserves manual relation and rejects silent overflow',()=>{
 const x=p3input(),item=p3routine(p2id(70));x.context.routine=p3revision('routine',{completeness:'partial',items:[item]});
 const choice=emptyPartThreeChoices();let updated:any=null;
 const check={enabled:true,view:emptyView(),context:x.context,choices:choice,update:(v:any)=>{updated=v;},save(){},refresh(){},questionAnswer(){},questionSkip(){},interact(){},exposeQuestion(){return null;}};
 const h=componentHarness('src/components/check/part-three/PartThreeControls.tsx','PartThreeControls',{check},{modules:{'../../ui/Button':{Button:'Button'},'../../ui/ChoiceChip':{ChoiceChip:'ChoiceChip'}}});
 press(control(h.render(),'Compare or describe this check'));let nodes=h.render();press(control(nodes,'Synthetic current item'));assert.equal(updated.comparatorId,item.id);assert.equal(updated.candidateRoutineItemId,null);
 press(control(nodes,'Check a current item'));nodes=h.render({check:{...check,choices:updated}});press(control(nodes,'This is Synthetic current item'));assert.equal(updated.candidateRoutineItemId,item.id);
 press(control(nodes,'Face'));assert.equal(updated.use.site,'face');assert.equal(updated.intent,'check_current');
});
function mounted(saved=false,erasedChoices=false,realCollapsed=false){
 const x=p3input();let sequence=100,online=true,network=true,sessionOwner=x.context.ownerId,bodyRefused=false;
 const calls:PartThreeRequest[]=[];const original={operation:'evaluate' as const,requestId:p2id(99),encounterId:p2id(80),accountGeneration:1,generation:1,scanId:x.partTwo.scanId,captureSessionId:x.partTwo.captureSessionId,expectedPartOneGeneration:x.partTwo.generation,expectedPartOneRevision:x.partTwo.evidenceRevision,intent:'replace' as const,comparatorId:null,candidateRoutineItemId:null,selectedManualReportIds:[],use:x.requestedUse,savedAssessmentId:null};
 let latest:ReturnType<typeof evaluatePersonalResult>|null=null;
 const ports:PartThreePorts={context:async()=>{if(bodyRefused)throw Error('Offline');return x.context;},session:(owner)=>owner===sessionOwner?{ownerId:owner,accountGeneration:1,encounterId:p2id(80)}:null,online:()=>online,createId:()=>p2id(sequence++),transport:{request:async(request)=>{
  calls.push(request);
  if(bodyRefused)throw Error('Evidence refused');
  if(request.operation==='saved_basis')return {kind:'saved_basis',partTwo:x.partTwo,pinnedSnapshotId:p2id(12),request:erasedChoices?null:original};
  if(request.operation==='read_saved')return {kind:'historical',savedAssessmentId:p2id(88),savedAt:x.now,assessmentWhenSaved:evaluatePersonalResult(x),currentAssessment:'unavailable'};
  if(request.operation==='evaluate'){
   const choices={intent:request.intent,comparatorId:request.comparatorId,candidateRoutineItemId:request.candidateRoutineItemId,selectedManualReportIds:request.selectedManualReportIds,use:request.use};
   const t=partThreeTarget(x.context,x.partTwo,{ownerId:x.context.ownerId,accountGeneration:request.accountGeneration,encounterId:request.encounterId,generation:request.generation},choices,request.savedAssessmentId)!;
   latest=evaluatePersonalResult({...x,binding:{...t.binding,attemptId:request.requestId},requestedUse:request.use,selectedManualReportIds:request.selectedManualReportIds,candidateRoutineItemId:request.candidateRoutineItemId});return {kind:'result',result:latest,replayed:false};
  }
  if(request.operation==='read')return {kind:'result',result:latest!,replayed:true};
  if(request.operation==='save')return {kind:'saved',savedAssessmentId:p2id(88),resultRevision:request.expectedResultRevision,replayed:false};
  return {kind:'acknowledged'};
 }}};
 const details={target:{ownerId:x.context.ownerId,scanId:x.partTwo.scanId,captureSessionId:x.partTwo.captureSessionId,generation:x.partTwo.generation,evidenceRevision:x.partTwo.evidenceRevision},result:x.partTwo,loading:false,error:null};
 const p1={scanId:x.partTwo.scanId,generation:x.partTwo.generation,resultRevision:x.partTwo.evidenceRevision,declarationState:'partial',identity:'exact',work:'complete',snapshotId:p2id(12),declarationId:p2id(10),scope:'public',freshness:{state:'fresh',observedAt:x.now,expiresAt:x.partTwo.expiresAt},display:{selectedIdentity:null,candidates:[],sections:[{sectionId:p2id(17),kind:'ingredients',text:'Original synthetic facts',expiresAt:x.partTwo.expiresAt}],sources:[],limitations:[]},allowedActions:['save_partial']};
 const sheet=componentHarness('src/components/check/part-one/PartOneResultSheet.tsx','PartOneResultSheet',{view:{owner:x.context.ownerId,result:p1,saved:false,loading:false,error:null,scrollOffset:0},personalEnabled:true,personalPorts:ports,ingredientEnabled:realCollapsed,ingredientTransport:realCollapsed?{normalize:async(request:any)=>{const result=structuredClone(x.partTwo);result.requestId=request.requestId;if(result.state==='ready'){result.output.reading.binding.requestId=request.requestId;if(result.output.kind==='bound')result.output.productFacts.binding.requestId=request.requestId;}return result;}}:undefined,savedAssessmentId:saved?p2id(88):null,onClose(){},onRefresh(){},onSelect(){},onSave(){},onSearch(){},onFullChange(){}},{effects:true,modules:{'expo-network':{useNetworkState:()=>({isConnected:network,isInternetReachable:network})},'../../ui/Button':{Button:'Button'},'../../ui/ChoiceChip':{ChoiceChip:'ChoiceChip'},'../../../services/productCatalog':{createCatalogRequestId:()=>p2id(sequence++)},...(realCollapsed?{react:{useLayoutEffect:()=>{}},'react-native-gesture-handler':{GestureHandlerRootView:'GestureHandlerRootView'},'react-native-reanimated':{ReduceMotion:{System:'System'}},'@gorhom/bottom-sheet':{__esModule:true,default:'BottomSheet',BottomSheetScrollView:'BottomSheetScrollView',BottomSheetBackdrop:'BottomSheetBackdrop'}}:{'../result-sheet/ResultSheetSurface':surface,'../part-two/PartTwoIngredients':{usePartTwoView:()=>details,PartTwoIngredientsView:()=>React.createElement('Text',{},'Original synthetic facts')}})}});
 return {sheet,calls,ports,x,refuse:()=>{bodyRefused=true;},offline:()=>{online=false;},networkOffline:()=>{network=false;},logout:()=>{sessionOwner='';}};
}
test('actual canonical sheet orders judgment before factual evidence and saves assessment separately',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:Date.parse(p3input().now)});const f=mounted();try{
  for(let i=0;i<6;i++){f.sheet.render();await settle();}
  let nodes=f.sheet.render();press(control(nodes,'Compare or describe this check'));nodes=f.sheet.render();press(control(nodes,'Add to my routine'));nodes=f.sheet.render();press(control(nodes,'Moisturizing'));nodes=f.sheet.render();press(control(nodes,'Face'));nodes=f.sheet.render();press(control(nodes,'Leave on'));
  for(let i=0;i<4;i++){f.sheet.render();await settle();}
  nodes=f.sheet.render();const content=textContent(nodes);assert.match(content,/Worth considering/);assert(content.indexOf('Worth considering')<content.indexOf('Original synthetic facts'));assert(control(nodes,'Save product without verified ingredients'));
  press(control(nodes,'Save this assessment'));await settle();nodes=f.sheet.render();assert(control(nodes,'Assessment saved'));assert(f.calls.some(r=>r.operation==='save'));assert(control(nodes,'Save product without verified ingredients'));
  f.refuse();t.mock.timers.tick(10000);await settle();nodes=f.sheet.render();assert(!textContent(nodes).includes('Worth considering'));assert(control(nodes,'Save product without verified ingredients'));
 }finally{f.sheet.dispose();}
});
test('saved reopen uses pinned saved_basis and current context, restores intent and hides bodies offline/logout',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:Date.parse(p3input().now)});const f=mounted(true);try{
  for(let i=0;i<6;i++){f.sheet.render();await settle();}let nodes=f.sheet.render();assert.match(textContent(nodes),/Assessment when saved.*Worth considering.*Current assessment.*Not enough info/);
  const evaluation=f.calls.find((r):r is Extract<PartThreeRequest,{operation:'evaluate'}>=>r.operation==='evaluate');assert(evaluation);assert.equal(evaluation.savedAssessmentId,p2id(88));assert.equal(evaluation.intent,'replace');assert.equal(canonicalJson(evaluation.use),canonicalJson(f.x.requestedUse));assert(f.calls.some(r=>r.operation==='saved_basis'));
  f.offline();nodes=f.sheet.render();assert(!textContent(nodes).includes('Worth considering'));assert(!textContent(nodes).includes('Assessment when saved'));
  f.logout();nodes=f.sheet.render();assert(!textContent(nodes).includes('Synthetic face lotion'));
 }finally{f.sheet.dispose();}
});
test('choice changes hide former authority while retaining measured summary space above touch targets',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:Date.parse(p3input().now)});const f=mounted(true);try{
  for(let i=0;i<6;i++){f.sheet.render();await settle();}
  const before=f.sheet.render();const summary=before.find(n=>n.type==='Surface')!.props.summary;
  summary.props.onLayout({nativeEvent:{layout:{height:300}}});
  press(control(before,'Compare or describe this check'));press(control(f.sheet.render(),'Cleansing'));
  const changed=f.sheet.render();assert(!textContent(changed).split('Current assessment')[1].includes('Worth considering'));
  assert.equal(changed.find(n=>n.type==='Surface')!.props.summary.props.style.minHeight,300);
  for(let i=0;i<4;i++){f.sheet.render();await settle();}
  assert.equal(f.sheet.render().find(n=>n.type==='Surface')!.props.summary.props.style.minHeight,300);
 }finally{f.sheet.dispose();}
});
test('persistent saved index reaches product-linked and standalone assessments after restart using owned scan only',async()=>{
 const owner=p2id(3),savedAt=p3input().now;const record={saveId:p2id(44),captureSessionId:null,result:{scanId:p2id(1),resultRevision:1,declarationState:'partial',freshness:{state:'fresh',expiresAt:'2099-01-01T00:00:00Z'},display:{selectedIdentity:{name:'Synthetic saved product',expiresAt:'2099-01-01T00:00:00Z'}}}};
 const items=[{savedAssessmentId:p2id(88),scanId:p2id(1),savedAt},{savedAssessmentId:p2id(89),scanId:p2id(99),savedAt:'2026-10-01T10:00:00Z'}];
 const privateState={ownerId:owner,stage:'temporary',result:null};const controller={subscribe:()=>()=>{},getState:()=>privateState,setOwner(){},close(){}};
 let reads=0;
 const modules={
  'expo-router':{useFocusEffect(){}},'../ui/Button':{Button:'Button'},
  '../../services/partOne':{listPartOneSaves:async()=>[record],readPartOneSave:async()=>{reads++;return record;}},
  '../../stores/authStore':{useAuthStore:{getState:()=>({sessionUserId:owner})}},
  '../../presentation/part-one/privateCaptureController':{createPrivateCaptureController:()=>controller},
  '../../services/partOnePrivate':{PART_ONE_PRIVATE_ENABLED:false,partOnePrivateTransport:{}},
  '../../../modules/derive-label-ocr':{preparePrivateLabelUpload(){}},
  '../../services/productCatalog':{createCatalogRequestId:()=>p2id(2)},
  '../../services/partThree':{PART_THREE_ENABLED:true,listPartThreeSaved:async()=>items,subscribePartThreeSession:()=>()=>{}},
  '../check/part-three/PartThreeSavedAssessmentSheet':{PartThreeSavedAssessmentSheet:'AssessmentSheet'},
 };
 for(let restart=0;restart<2;restart++){
  const h=componentHarness('src/components/my-stuff/PartOneSavedProducts.tsx','PartOneSavedProducts',{ownerId:owner},{effects:true,modules});try{
   h.render();await settle();let nodes=h.render();assert(control(nodes,'Open assessment saved 2026-10-02'));assert(control(nodes,'Open assessment saved 2026-10-01'));
   press(control(nodes,'Open assessment saved 2026-10-02'));await settle();nodes=h.render();assert.equal(nodes.find(n=>n.type==='PartOneResultSheet')?.props.savedAssessmentId,p2id(88));assert.equal(reads,restart+1);
   press(control(nodes,'Open assessment saved 2026-10-01'));nodes=h.render();assert.equal(nodes.find(n=>n.type==='AssessmentSheet')?.props.savedAssessmentId,p2id(89));assert.equal(reads,restart+1,'unmatched scan never borrows another saved product');
   assert.equal(h.render({ownerId:p2id(9)}).length,0);
  }finally{h.dispose();}
 }
});

test('L09 native connectivity event hides current and historical bodies before polling or TTL expiry',async t=>{t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:Date.parse(p3input().now)});const f=mounted(true);try{for(let i=0;i<6;i++){f.sheet.render();await settle();}assert(textContent(f.sheet.render()).includes('Worth considering'));f.networkOffline();const nodes=f.sheet.render();assert(!textContent(nodes).includes('Worth considering'));assert(!textContent(nodes).includes('Assessment when saved'));assert(control(nodes,'Save product without verified ingredients'));}finally{f.sheet.dispose();}});

test('erased encounter choices retain safe saved evidence for fresh explicit reassessment',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:Date.parse(p3input().now)});const f=mounted(true,true);try{for(let i=0;i<6;i++){f.sheet.render();await settle();}const req=f.calls.find((r):r is Extract<PartThreeRequest,{operation:'evaluate'}>=>r.operation==='evaluate');assert(req);assert.equal(req.intent,'unanswered');assert.equal(req.comparatorId,null);assert.deepEqual(req.selectedManualReportIds,[]);assert.deepEqual(req.use,{purpose:null,site:null,useForm:null});assert.equal(req.savedAssessmentId,p2id(88));assert(textContent(f.sheet.render()).includes('Current assessment'));}finally{f.sheet.dispose();}
});

test('review 1: actual collapsed ResultSheetSurface obtains evidence and judgment before details mount',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:Date.parse(p3input().now)});const raf=globalThis.requestAnimationFrame,caf=globalThis.cancelAnimationFrame;globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};const f=mounted(false,false,true);try{
  for(let i=0;i<12;i++){f.sheet.render();await settle();}
  let nodes=f.sheet.render(),content=textContent(nodes);assert.match(content,/Not enough info/);assert(f.calls.some(r=>r.operation==='evaluate'));assert(!content.includes('Ingredient details'),'The actual collapsed surface must keep disclosure children unmounted');
  press(control(nodes,'Compare or describe this check'));nodes=f.sheet.render();press(control(nodes,'Add to my routine'));nodes=f.sheet.render();press(control(nodes,'Moisturizing'));nodes=f.sheet.render();press(control(nodes,'Face'));nodes=f.sheet.render();press(control(nodes,'Leave on'));
  for(let i=0;i<8;i++){f.sheet.render();await settle();}content=textContent(f.sheet.render());assert.match(content,/Worth considering/);assert(!content.includes('Ingredient details'));assert(!content.includes('Original synthetic facts'));
 }finally{f.sheet.dispose();globalThis.requestAnimationFrame=raf;globalThis.cancelAnimationFrame=caf;}
});
test('review 8: selected catalog comparators use safe resolved names or stable distinguishable use labels',()=>{
 const x=p3input(),a=p3routine(p2id(70)),b=p3routine(p2id(71));a.reference={kind:'catalog',productId:p2id(72),variantId:null,formulaVersionId:null};b.reference={kind:'catalog',productId:p2id(73),variantId:null,formulaVersionId:null};b.reportedPurpose!.answer={state:'known',value:'cleansing'};b.useForm!.answer={state:'known',value:'rinse_off'};x.context.routine=p3revision('routine',{completeness:'partial',items:[a,b]});let selected:any;
 const check={enabled:true,view:emptyView(),context:x.context,displayLabels:{},choices:emptyPartThreeChoices(),update:(value:any)=>selected=value,save(){},refresh(){},questionAnswer(){},questionSkip(){},interact(){},exposeQuestion(){}};
 const h=componentHarness('src/components/check/part-three/PartThreeControls.tsx','PartThreeControls',{check},{modules:{'../../ui/Button':{Button:'Button'},'../../ui/ChoiceChip':{ChoiceChip:'ChoiceChip'}}});press(control(h.render(),'Compare or describe this check'));const nodes=h.render();const options=nodes.filter(n=>typeof n.props.label==='string'&&n.props.label.startsWith('Catalog item '));assert.equal(options.length,2);assert(options[0].props.label.includes('moisturizing'));assert(options[1].props.label.includes('cleansing'));assert.notEqual(options[0].props.label,options[1].props.label);press(options[1]);assert.equal(selected.comparatorId,b.id);
 const named=h.render({check:{...check,displayLabels:{[a.reference.productId+':null:null']:'Current name: Original catalog moisturizer',[b.reference.productId+':null:null']:'Current name: Original catalog cleanser'}}});assert(control(named,'Current name: Original catalog moisturizer'));press(control(named,'Current name: Original catalog cleanser'));assert.equal(selected.comparatorId,b.id);
});

test('review residual: identical catalog display details withhold selection until permitted variant names distinguish it', () => {
 const x = p3input();
 const a = p3routine(p2id(74)), b = p3routine(p2id(75));
 const productId = p2id(76);
 a.reference = { kind: 'catalog', productId, variantId: p2id(77), formulaVersionId: null };
 b.reference = { kind: 'catalog', productId, variantId: p2id(78), formulaVersionId: null };
 x.context.routine = p3revision('routine', { completeness: 'partial', items: [a, b] });
 let selected: any = null;
 const check = { enabled: true, view: emptyView(), context: x.context, displayLabels: {}, choices: emptyPartThreeChoices(), update: (value: any) => selected = value, save() {}, refresh() {}, questionAnswer() {}, questionSkip() {}, interact() {}, exposeQuestion() {} };
 const h = componentHarness('src/components/check/part-three/PartThreeControls.tsx', 'PartThreeControls', { check }, { modules: { '../../ui/Button': { Button: 'Button' }, '../../ui/ChoiceChip': { ChoiceChip: 'ChoiceChip' } } });
 try {
  press(control(h.render(), 'Compare or describe this check'));
  let nodes = h.render();
  const options = nodes.filter(n => typeof n.props.label === 'string' && n.props.label.startsWith('Catalog item '));
  assert.equal(options.length, 2);
  assert.equal(options[0].props.label, options[1].props.label);
  for (const option of options) { assert.equal(option.props.disabled, true); option.props.onSelect(); }
  assert.equal(selected, null, 'Ambiguous labels cannot silently choose a different saved variant');
  assert(textContent(nodes).includes('Selection is unavailable until they can be distinguished'));
  nodes = h.render({ check: { ...check, choices: { ...check.choices, intent: 'check_current' } } });
  for (const option of nodes.filter(n => typeof n.props.label === 'string' && n.props.label.startsWith('This is Catalog item '))) { assert.equal(option.props.disabled, true); option.props.onSelect(); }
  assert.equal(selected, null, 'Current-item selection uses the same ambiguity guard');
  const displayLabels = { [`${productId}:${p2id(77)}:null`]: 'Current name: Original lotion small bottle', [`${productId}:${p2id(78)}:null`]: 'Current name: Original lotion large bottle' };
  nodes = h.render({ check: { ...check, displayLabels } });
  const named = control(nodes, 'Current name: Original lotion large bottle');
  assert.equal(named.props.disabled, false);
  press(named);
  const chosen = selected as { comparatorId: string; use: typeof check.choices.use } | null;
  assert(chosen, 'Distinct permitted names allow an explicit selection');
  assert.equal(chosen.comparatorId, b.id);
  assert.deepEqual(chosen.use, check.choices.use, 'Display disambiguation adds no purpose or formula authority');
 } finally { h.dispose(); }
});
