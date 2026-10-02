import assert from 'node:assert/strict';
import test from 'node:test';
import { normalize, LOCAL_DICTIONARY_RELEASE } from '../src/domain/part-two/index.ts';
import { sourceReading, boundDeclaration, p2metadata } from './fixtures/part-two-core.ts';
import { componentHarness, control, textContent, press } from './ux-profile-render.ts';
import type { PartTwoView } from '../src/presentation/part-two/controller.ts';
import React from 'react';
const modulePath='src/components/check/part-two/PartTwoIngredients.tsx';
function view(text:string):PartTwoView { const input=sourceReading(text); return {target:{ownerId:input.binding.ownerId,scanId:input.binding.scanId,captureSessionId:input.binding.captureSessionId,generation:input.binding.generation,evidenceRevision:input.binding.evidenceRevision},result:normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata),loading:false,error:null}; }
test('A01/A28/A30 actual inline rows keep literal text, source-only limits and reachable detail actions',()=>{
  const v=view('Niacinamide, PG-6-Decyltetradecanol'); assert.equal(v.result?.state,'ready');
  const h=componentHarness(modulePath,'PartTwoInlineView',{view:v,now:Date.parse(p2metadata.createdAt)});
  let nodes=h.render(); assert.match(textContent(nodes),/Photo reading.*Package not confirmed.*May be incomplete/);
  press(control(nodes,'Ingredient details: Niacinamide')); nodes=h.render(); assert.match(textContent(nodes),/observed name maps/); assert.match(textContent(nodes),/Synthetic private label/);
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
  const nodes=h.render();assert.match(textContent(nodes),/Glycerin has a reference humectant role/);assert.match(textContent(nodes),/European Commission CosIng/);assert.match(textContent(nodes),/CC BY 4.0/);
  assert(control(nodes,'View role reference'));assert(control(nodes,'View reference license'));
  press(control(nodes,'Ingredient details: Unknown ingredient'));assert(!textContent(h.render()).includes('reference humectant role'));
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
