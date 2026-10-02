import assert from 'node:assert/strict';
import test from 'node:test';
import { normalize, LOCAL_DICTIONARY_RELEASE } from '../src/domain/part-two/index.ts';
import { sourceReading, boundDeclaration, boundLabelDeclaration, p2metadata } from './fixtures/part-two-core.ts';
import { componentHarness, control, textContent, press } from './ux-profile-render.ts';
import type { PartTwoView } from '../src/presentation/part-two/controller.ts';
import React from 'react';
const modulePath='src/components/check/part-two/PartTwoIngredients.tsx';
function view(text:string):PartTwoView { const input=sourceReading(text); return {target:{ownerId:input.binding.ownerId,scanId:input.binding.scanId,captureSessionId:input.binding.captureSessionId,generation:input.binding.generation,evidenceRevision:input.binding.evidenceRevision},result:normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata),loading:false,error:null}; }
test('A01/A28/A30 actual inline rows keep literal text, source-only limits and reachable detail actions',()=>{
  const v=view('Niacinamide, PG-6-Decyltetradecanol'); assert.equal(v.result?.state,'ready');
  const h=componentHarness(modulePath,'PartTwoInlineView',{view:v,now:Date.parse(p2metadata.createdAt)});
  let nodes=h.render(); assert.match(textContent(nodes),/Photo reading.*Package not confirmed.*May be incomplete/);
  press(control(nodes,'Ingredient details: Niacinamide')); nodes=h.render(); assert.match(textContent(nodes),/Listed as: Niacinamide/); press(control(nodes,'Ingredient source and reference')); nodes=h.render(); assert.match(textContent(nodes),/Synthetic private label/);
  press(control(nodes,'Ingredient details: PG-6-Decyltetradecanol')); nodes=h.render(); assert.match(textContent(nodes),/Details unavailable for this name/); assert(!textContent(nodes).includes('PPG-6-Decyltetradeceth'));
  const revoked=h.render({view:{...v,result:null,error:'Ingredient evidence unavailable'}}); assert(control(revoked,'Close ingredient detail')); assert.match(textContent(revoked),/Ingredient evidence unavailable/); assert(!textContent(revoked).includes('PG-6-Decyltetradecanol'));
});
test('A09/A10 conditional and quantities remain attributed in actual UI',()=>{
  const v=view('May contain (+/-): CI 77491, CI 77492');const h=componentHarness(modulePath,'PartTwoInlineView',{view:v,now:Date.parse(p2metadata.createdAt)});
  let nodes=h.render();assert.match(textContent(nodes),/May contain/);press(control(nodes,'Ingredient details: CI 77491'));nodes=h.render();assert.match(textContent(nodes),/May contain/);
  const quantity=componentHarness(modulePath,'PartTwoInlineView',{view:view('Salicylic Acid (2% w/w)'),now:Date.parse(p2metadata.createdAt)});nodes=quantity.render();press(control(nodes,'Ingredient details: Salicylic Acid'));assert.match(textContent(quantity.render()),/Printed amount:.*2% w\/w/);
});
test('A04 published attribution remains distinct from unconfirmed package',()=>{
  const input=boundDeclaration('Water','public');const v={...view('Water'),result:normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata)};
  const nodes=componentHarness(modulePath,'PartTwoInlineView',{view:v,now:Date.parse(p2metadata.createdAt)}).render();assert.match(textContent(nodes),/Published list.*Package not confirmed/);
});
test('A24/A26 deadline and terminal failure hide derived rows; inert controls render visibly',()=>{
  const v=view('Niacinamide');const nodes=componentHarness(modulePath,'PartTwoInlineView',{view:v,now:Date.parse('2099-01-01T00:00:00Z')}).render();assert(!textContent(nodes).includes('Niacinamide'));assert.match(textContent(nodes),/unavailable/);
  const controls=view('Un\u202eknown');const safe=componentHarness(modulePath,'PartTwoInlineView',{view:controls,now:Date.parse(p2metadata.createdAt)}).render();assert(!textContent(safe).includes('\u202e'));assert.match(textContent(safe),/U\+202E/);
});
test('A31 actual tap shows the original formulation-role sentence with reference and rights attribution',()=>{
  const v=view('Glycerin, Unknown ingredient');
  const h=componentHarness(modulePath,'PartTwoInlineView',{view:v,now:Date.parse(p2metadata.createdAt)});
  press(control(h.render(),'Ingredient details: Glycerin'));
  let nodes=h.render();assert.match(textContent(nodes),/Glycerin has a reference humectant role/);assert(!textContent(nodes).includes('CC BY 4.0'));press(control(nodes,'Ingredient source and reference'));nodes=h.render();assert.match(textContent(nodes),/European Commission CosIng/);assert.match(textContent(nodes),/CC BY 4.0/);
  assert(control(nodes,'View role reference'));assert(control(nodes,'View reference license'));
  press(control(nodes,'Ingredient details: Unknown ingredient'));assert(!textContent(h.render()).includes('reference humectant role'));
});
test('review actual Check and saved sheet composition use one primary list and retain authorized original fallback',async()=>{
 const {normalize:run}=await import('../src/domain/part-two/index.ts');
 for(const saved of [false,true]){
  const input=boundDeclaration('Glycerin, Water','public'),norm=run(input,LOCAL_DICTIONARY_RELEASE,p2metadata);
  assert.equal(norm.state,'ready');
  const target={ownerId:input.binding.authenticatedOwnerId,scanId:input.binding.scanId,captureSessionId:null,generation:input.binding.generation,evidenceRevision:input.binding.evidenceRevision};
  const result={scanId:target.scanId,generation:target.generation,resultRevision:target.evidenceRevision,declarationState:'partial',identity:'exact',work:'complete',snapshotId:input.binding.snapshotId,declarationId:input.binding.declarationId,scope:'public',freshness:{state:'fresh',observedAt:p2metadata.createdAt,expiresAt:input.binding.expiresAt},display:{selectedIdentity:null,candidates:[],sections:[{sectionId:input.declaration.sections[0].sectionId,kind:'ingredients',text:'Glycerin, Water',expiresAt:input.binding.expiresAt}],sources:[],limitations:[]},allowedActions:['save_partial']};
  const transport={normalize:async(request:any)=>{input.binding.requestId=request.requestId;return run(input,LOCAL_DICTIONARY_RELEASE,p2metadata);}};
  const h=componentHarness('src/components/check/part-one/PartOneResultSheet.tsx','PartOneResultSheet',{view:{owner:target.ownerId,result,saved,loading:false,error:null,scrollOffset:0},ingredientEnabled:true,ingredientTransport:transport,...(saved?{savedInterpretationId:'synthetic-save'}:{}),onClose(){},onSave(){},onSelect(){},onSearch(){},onRefresh(){},onFullChange(){}},{effects:true,modules:{
   '../../ui/Button':{Button:'Button'},'../../../services/partTwo':{PART_TWO_ENABLED:true,partTwoTransport:transport,partTwoSavedTransport:()=>transport},
   '../result-sheet/ResultSheetSurface':{ResultSheetSurface:(props:any)=>React.createElement('Surface',props,props.summary,props.compactActions,props.children)},
   '../../../services/productCatalog':{createCatalogRequestId:()=>`test-${saved}`},
  }});
  try{
   assert(textContent(h.render()).includes('Glycerin, Water'),'original stays visible during initial load');await new Promise(resolve=>setImmediate(resolve));h.render();const nodes=h.render();
   assert(control(nodes,'Ingredient details: Glycerin'));assert(!textContent(nodes).includes('Glycerin, Water'),'ready enrichment replaces the primary original list');assert.match(textContent(nodes),/Partial list/);
   press(control(nodes,'Original ingredient wording'));assert(textContent(h.render()).includes('Glycerin, Water'),'exact source wording remains explicitly available');
  }finally{h.dispose();}
 }
});
test('review a 40-row list expands beside the tapped ingredient and keeps internal codes out of consumer copy',()=>{
 const v=view(['Glycerin',...Array.from({length:39},(_,n)=>`Unknown ingredient ${n+1}`)].join(', '));
 const h=componentHarness(modulePath,'PartTwoInlineView',{view:v,now:Date.parse(p2metadata.createdAt)});
 press(control(h.render(),'Ingredient details: Glycerin'));const nodes=h.render();
 const explanation=nodes.findIndex(n=>n.type==='Text'&&String(n.props.children).includes('reference humectant role'));
 const second=nodes.indexOf(control(nodes,'Ingredient details: Unknown ingredient 1'));
 assert(explanation>=0&&explanation<second,'detail must occur before the following row, not after all 40');
 assert(!textContent(nodes).includes('whole_list_completeness_unestablished'));assert(!textContent(nodes).includes('reviewed ingredient identity'));
 assert.match(textContent(nodes),/Listed as: Glycerin/);
 assert(!control(nodes,'Ingredient source and reference').props.accessibilityState.expanded,'rights details start secondary');
});
test('review public partial and uncertain lists retain section and evidence qualifiers near the rows',()=>{
 const input=boundDeclaration('Glycerin','public'); const v={...view('Glycerin'),result:normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata)};
 const h=componentHarness(modulePath,'PartTwoInlineView',{view:v,now:Date.parse(p2metadata.createdAt)});assert.match(textContent(h.render()),/Partial list.*Missing text remains unknown/);
 const sections=sourceReading('Retinol');sections.sections[0].kind='active';sections.sections.push({...sections.sections[0],sectionId:'inactive-section',rawText:'Glycerin',kind:'inactive'},{...sections.sections[0],sectionId:'may-section',rawText:'CI 77491',kind:'may_contain'});
 const nodes=h.render({view:{...view('Retinol'),result:normalize(sections,LOCAL_DICTIONARY_RELEASE,p2metadata)}});assert.match(textContent(nodes),/Active ingredients/);assert.match(textContent(nodes),/Inactive ingredients/);assert.match(textContent(nodes),/May contain/);
});
test('review withdrawal retains only numeric detail layout and keeps Close at the held bottom',()=>{
 const v=view('Glycerin, Mystery Name');const h=componentHarness(modulePath,'PartTwoInlineView',{view:v,now:Date.parse(p2metadata.createdAt)});
 press(control(h.render(),'Ingredient details: Glycerin'));let nodes=h.render();press(control(nodes,'Ingredient source and reference'));nodes=h.render();
 const detail=control(nodes,'Inline ingredient explanation');detail.props.onLayout({nativeEvent:{layout:{height:440,y:70}}});
 const row=nodes[nodes.indexOf(control(nodes,'Ingredient details: Glycerin'))-2];assert.equal(row.type,'View');row.props.onLayout({nativeEvent:{layout:{height:510,y:0}}});
 const gone=h.render({view:{...v,result:null,error:'Ingredient evidence unavailable'}});const held=control(gone,'Inline ingredient explanation');assert.equal(held.props.style.minHeight,440);
 const ghost=gone[gone.indexOf(held)-1];assert.equal(ghost.props.style.paddingTop,70);assert.equal(ghost.props.style.minHeight,510);
 assert.equal(control(gone,'Close ingredient detail').props.style.marginTop,'auto');
 for(const forbidden of ['Glycerin','Mystery Name','Synthetic private label','CosIng','humectant','View role reference'])assert(!textContent(gone).includes(forbidden),forbidden);
});
test('review exact admitted claims appear as Label says without ingredient-absence or benefit inference',()=>{
 const input=boundLabelDeclaration('fragrance-free','claim','public');const v={...view('Glycerin'),result:normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata)};
 let nodes=componentHarness(modulePath,'PartTwoInlineView',{view:v,now:Date.parse(p2metadata.createdAt)}).render();assert.match(textContent(nodes),/Label says:.*fragrance-free/);assert.match(textContent(nodes),/Reported claim; not independently verified/);assert(!textContent(nodes).includes('contains no fragrance'));
 input.labelAssertions![0].transcription='uncertain';nodes=componentHarness(modulePath,'PartTwoInlineView',{view:{...v,result:normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata)},now:Date.parse(p2metadata.createdAt)}).render();assert(!textContent(nodes).includes('Label says:'));
});
test('review actual sheet never restores revoked original attribution on blocked-to-pending retries',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});const input=boundDeclaration('Glycerin, Water','public'),ready=normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata);assert.equal(ready.state,'ready');
 const {output,...base}=ready as Extract<NonNullable<PartTwoView['result']>,{state:'ready'}>;void output;const target={ownerId:input.binding.authenticatedOwnerId,scanId:input.binding.scanId,captureSessionId:null,generation:input.binding.generation,evidenceRevision:input.binding.evidenceRevision};let calls=0;
 const transport={normalize:async(request:any)=>++calls===1?{...base,requestId:request.requestId,state:'blocked',resultRevision:2,reasonCodes:['source_withdrawn'],permittedText:null}:{...base,requestId:request.requestId,state:'pending',resultRevision:3,permittedText:null}};
 const result={scanId:target.scanId,generation:target.generation,resultRevision:target.evidenceRevision,declarationState:'accepted',identity:'exact',work:'complete',snapshotId:input.binding.snapshotId,declarationId:input.binding.declarationId,scope:'public',freshness:{state:'fresh',observedAt:p2metadata.createdAt,expiresAt:input.binding.expiresAt},display:{selectedIdentity:null,candidates:[],sections:[{sectionId:'original',kind:'ingredients',text:'Glycerin, Water',expiresAt:input.binding.expiresAt}],sources:[{observationId:'source',label:'Revoked label source',url:'https://example.test/revoked-label',observedAt:p2metadata.createdAt,expiresAt:input.binding.expiresAt}],limitations:[]},allowedActions:[]};
 const h=componentHarness('src/components/check/part-one/PartOneResultSheet.tsx','PartOneResultSheet',{view:{owner:target.ownerId,result,saved:false,loading:false,error:null,scrollOffset:0},ingredientEnabled:true,ingredientTransport:transport,localDraft:(denied:boolean)=>React.createElement('Text',{},denied?'Reopen private source':'Cached private source text'),onClose(){},onSave(){},onSelect(){},onSearch(){},onRefresh(){},onFullChange(){}},{effects:true,modules:{'../../ui/Button':{Button:'Button'},'../../../services/partTwo':{PART_TWO_ENABLED:true,partTwoTransport:transport,partTwoSavedTransport:()=>transport},'../result-sheet/ResultSheetSurface':{ResultSheetSurface:(p:any)=>React.createElement('Surface',p,p.summary,p.compactActions,p.children)},'../../../services/productCatalog':{createCatalogRequestId:()=>`source-${calls}`}}});
 const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();h.render();return h.render();};
 try{const initial=h.render();const summary=initial.find(n=>n.type==='View'&&n.props.onLayout&&n.props.style?.gap!==undefined);assert(summary);summary.props.onLayout({nativeEvent:{layout:{height:480}}});let nodes=await settle();const held=nodes.find(n=>n.type==='View'&&n.props.onLayout&&n.props.style?.minHeight===480);assert(held,'withdrawal retains numeric measured summary height');assert(!textContent(nodes).includes('Revoked label source'));assert(!textContent(nodes).includes('Published ingredient declaration'));assert.match(textContent(nodes),/Ingredient evidence unavailable/);assert(!textContent(nodes).includes('Cached private source text'));assert(textContent(nodes).includes('Reopen private source'));t.mock.timers.tick(15000);nodes=await settle();assert.equal(calls,2);assert(!textContent(nodes).includes('Cached private source text'));assert(!textContent(nodes).includes('Published ingredient declaration'));assert(!textContent(nodes).includes('Revoked label source'));assert(!nodes.some(n=>n.props.label==='View source: Revoked label source'));assert(!textContent(nodes).includes('Glycerin, Water'));}finally{h.dispose();}
});
test('review the mounted 15-second poll accepts 20-second success, settles failure, and retries without original-text resurrection',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});
 const seed=view('Glycerin');const waits:{request:any;resolve:(v:any)=>void;reject:(e:Error)=>void}[]=[];let id=0;
 const transport={normalize:(request:any)=>new Promise((resolve,reject)=>waits.push({request,resolve,reject}))};
 const h=componentHarness(modulePath,'PartTwoIngredients',{target:seed.target,enabled:true,transport,fallback:React.createElement('Text',{},'Private original fallback')},{effects:true,modules:{'../../../services/productCatalog':{createCatalogRequestId:()=>`mounted-${++id}`}}});
 const ready=(request:any)=>{const input=sourceReading('Glycerin');input.binding.requestId=request.requestId;return normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata);};
 const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 try{
  assert(textContent(h.render()).includes('Private original fallback'));t.mock.timers.tick(15000);assert.equal(waits.length,1);t.mock.timers.tick(5000);waits[0].resolve(ready(waits[0].request));await settle();assert(control(h.render(),'Ingredient details: Glycerin'));assert(!textContent(h.render()).includes('Private original fallback'));
  t.mock.timers.tick(10000);assert.equal(waits.length,2);t.mock.timers.tick(15000);assert.equal(waits.length,2);t.mock.timers.tick(5000);waits[1].reject(Error('slow response'));await settle();assert.match(textContent(h.render()),/unavailable/);
  t.mock.timers.tick(10000);assert.equal(waits.length,3);assert(!textContent(h.render()).includes('Private original fallback'),'retry cannot restore a previously refused private original');waits[2].resolve(ready(waits[2].request));await settle();assert(control(h.render(),'Ingredient details: Glycerin'));
 }finally{h.dispose();await settle();}
});
test('A20/A29 actual private interpretation button sends the viewed capture revision and ignores late account feedback',async()=>{
  const v=view('Glycerin'); const calls:{path:string;body:any}[]=[];let finish:((value:any)=>void)|null=null;
  const invoke=async(path:string,body:string)=>{calls.push({path,body:JSON.parse(body)});return await new Promise<any>(resolve=>{finish=resolve;});};
  const h=componentHarness('src/components/check/part-two/PartTwoPrivateInterpretation.tsx','PartTwoPrivateInterpretation',{target:v.target,result:{},enabled:true,invoke},{modules:{
    '../../ui/Button':{Button:'Button'},
    './PartTwoIngredients':{PartTwoIngredients:(props:any)=>{props.onView?.(v);return React.createElement('View');}},
    '../../../services/productCatalog':{createCatalogRequestId:()=>p2metadata.snapshotId},
  }});
  h.render();const button=control(h.render(),'Save ingredient interpretation');assert.equal(button.props.disabled,false);press(button);
  await Promise.resolve();assert.equal(calls[0].path,'part-two/capture-interpretations');assert.deepEqual(calls[0].body,{captureSessionId:v.target!.captureSessionId,bindingKey:v.result!.bindingKey,expectedPartTwoRevision:1});
  h.render({target:{...v.target,ownerId:'other'}});
  const resolve=finish as unknown as (value:any)=>void;resolve({error:null,data:{state:'saved',interpretationId:p2metadata.snapshotId,bindingKey:v.result!.bindingKey,resultRevision:1}});
  await new Promise(resolve=>setImmediate(resolve));assert(!textContent(h.render()).includes('Ingredient interpretation saved'));
});
