import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmedPreference,preferenceProductChoices,preferenceSetup } from '../src/presentation/p0b-personalization/preferences.ts';
import { createPreferenceController,type PreferencePorts } from '../src/presentation/p0b-personalization/preferenceController.ts';
import { p3context,p3routine,p3revision,p3assessment } from './fixtures/part-three.ts';
import {p2id,p2now} from './fixtures/part-two-core.ts';
import type {ConfirmedPreference,PersonalContextV2,PersonalContextV2Request} from '../src/contracts/PersonalContextV2.ts';
import {createContextDraft} from '../src/presentation/p0b-personalization/draft.ts';
import {setupToStorageV2} from '../src/presentation/p0b-personalization/setupStorageV2.ts';
import {createSetupBundle,addCurrentProduct,currentUseItem,manualUnverifiedReference,toggleCurrentFeedback,setAdditionalNote} from '../src/presentation/p0b-personalization/setup.ts';
import {componentHarness,control,press,textContent} from './ux-profile-render.ts';
const preference=(id=p2id(50),target:ConfirmedPreference['target']={kind:'ingredient',identity:{kind:'resolved',ingredientId:'glycerin'}})=>confirmedPreference({id,kind:target.kind==='ingredient'?'avoid_ingredient':target.kind==='product'?'avoid_product':'no_extra_step',target,strength:'decisive',confirmed:true,confirmedAt:p2now});
function context(){const c=p3context(),item=p3routine(p2id(70));c.profile!.data.primaryGoal={state:'withheld'};item.startedOn={state:'known',value:{value:'2025-12',precision:'month'}};c.routine=p3revision('routine',{completeness:'partial',items:[item]});const {id:ignoredId,reference:ignoredReference,state:ignoredState,...use}=item;c.experiences=[p3revision('experience',{id:p2id(71),reference:item.reference,kind:'liked',occurred:{start:{state:'unsure'},end:{state:'withheld'}},useContext:use,symptoms:[],note:null})];c.assessments=[p3revision('assessment',{...p3assessment(item),id:p2id(72),useContext:use})];c.notes=[p3revision('note',{id:p2id(73),scope:'profile',targetRef:null,text:'Private raw note: avoid everything?'} )];c.preferences=[p3revision('pref',preference())];c.setupAnswers={currentProducts:'reported',pastProducts:'unsure'};return c;}
const settle=()=>new Promise<void>(r=>setImmediate(r));
test('explicit identity/unresolved target/strength and confirmation never infer a sensitivity or family',()=>{
 assert.throws(()=>confirmedPreference({id:p2id(50),kind:'avoid_ingredient',target:{kind:'ingredient',identity:{kind:'resolved',ingredientId:'glycerin'}},strength:'prefer',confirmed:false,confirmedAt:p2now}),/Confirm/);
 assert.throws(()=>preference(p2id(50),{kind:'ingredient',identity:{kind:'resolved',ingredientId:'guessed-alcohol-family'}}),/reviewed exact/);
 const raw='  My original Alcohol-ish term  ';assert.equal((preference(p2id(50),{kind:'ingredient',identity:{kind:'unresolved',originalTerm:raw}}).target as any).identity.originalTerm,raw);
 assert.throws(()=>preference(p2id(50),{kind:'ingredient',identity:{kind:'unresolved',originalTerm:'x'.repeat(101)}}),/100 characters/);
 const c=context(),products=preferenceProductChoices(c);assert.equal(products.length,1);assert.equal(products[0].reference.kind,'manual');const product=preference(p2id(51),{kind:'product',reference:products[0].reference});assert.deepEqual(product.target,{kind:'product',reference:c.routine!.data.items[0].reference});
});
test('full preference write preserves exact v2 context, dates, uncertainty, liked reports, assessments and private notes',()=>{
 const c=context(),next=[...c.preferences.map(p=>p.data),preference(p2id(51),{kind:'routine'})];const payload=preferenceSetup(c,next);
 for(const field of ['profile','routine'] as const)assert.deepEqual(payload[field],c[field]!.data);
 for(const field of ['experiences','assessments','notes'] as const)assert.deepEqual(payload[field],c[field].map(i=>i.data));assert.deepEqual(payload.setupAnswers,c.setupAnswers);assert.equal(payload.preferences.length,2);
 assert.throws(()=>preferenceSetup({...c,historyTruncated:true},next),/history is incomplete/);
 assert.throws(()=>preferenceSetup(c,Array.from({length:21},(_,n)=>preference(p2id(100+n)))),/No records were dropped/);
});
test('setup retains explicit preferences; feedback and raw notes never create them',()=>{
 let b=addCurrentProduct(createSetupBundle(p2id(3)),currentUseItem(p2id(70),manualUnverifiedReference('Cream')));b=toggleCurrentFeedback(b,p2id(70),'stung');b=setAdditionalNote(b,'I might avoid this ingredient');let serial=100;
 assert.deepEqual(setupToStorageV2(createContextDraft(),b,()=>p2id(serial++),p2now).preferences,[]);
 const p=preference();assert.deepEqual(setupToStorageV2(createContextDraft(),{...b,preferences:[p]},()=>p2id(serial++),p2now).preferences,[p]);
});
test('note source remains dependent until explicit independent adoption',()=>{
 const existing={...preference(),source:{kind:'note' as const,noteId:p2id(73),noteRevisionId:p2id(74),supportingSpan:'Private raw note',adoptedIndependently:false}};
 const edit={id:existing.id,existing,kind:existing.kind,target:existing.target,strength:'prefer' as const,confirmed:true,confirmedAt:p2now};assert.deepEqual(confirmedPreference(edit).source,existing.source);assert.deepEqual(confirmedPreference({...edit,independent:true}).source,{kind:'structured'});assert.equal(confirmedPreference(edit).revision,2);
});
test('remote failure retains draft and retries exact request ID/base revision; stale context never silently rebases',async()=>{
 let owner:string|null=p2id(3),fail=true,ids=90;const writes:Exclude<PersonalContextV2Request,{operation:'read_context_v2'}>[]=[];const c=context();
 const ports:PreferencePorts={owner:()=>owner,createId:()=>p2id(ids++),read:async()=>c,write:async(_,r)=>{writes.push(r);if(fail)throw Error('offline');return {contextRevision:2,deletedRevisionIds:[],replayed:false};}};
 const ctrl=createPreferenceController(ports);ctrl.setOwner(owner);await ctrl.load();ctrl.update([preference(p2id(55),{kind:'routine'})]);assert.equal(await ctrl.save(),false);assert.equal(ctrl.getState().preferences[0].id,p2id(55));fail=false;assert(await ctrl.save());assert.deepEqual(writes[0],writes[1]);assert.equal(writes[0].baseContextRevision,1);
 owner=p2id(9);ctrl.setOwner(owner);assert.deepEqual(ctrl.getState().preferences,[]);assert.equal(ctrl.getState().context,null);ctrl.close();
});
test('owner reset rejects a late read/write and deletion uses dedicated historical erasure while keeping other draft edits',async()=>{
 let owner:string|null=p2id(3),resolve!:(c:PersonalContextV2)=>void;const late=createPreferenceController({owner:()=>owner,createId:()=>p2id(90),read:async()=>new Promise(r=>{resolve=r;}),write:async()=>({contextRevision:2,deletedRevisionIds:[],replayed:false})});late.setOwner(owner);const pending=late.load();owner=p2id(9);late.setOwner(owner);resolve(context());assert.equal(await pending,false);assert.equal(late.getState().context,null);late.close();
 owner=p2id(3);const c=context(),requests:PersonalContextV2Request[]=[];let loaded=0;
 const ctrl=createPreferenceController({owner:()=>owner,createId:()=>p2id(90),read:async()=>++loaded===1?c:{...c,revision:2,preferences:[]},write:async(_,r)=>{requests.push(r);return {contextRevision:2,deletedRevisionIds:[],replayed:false};}});ctrl.setOwner(owner);await ctrl.load();ctrl.update([preference(),preference(p2id(55),{kind:'routine'})]);assert(await ctrl.remove(p2id(50)));assert.equal(requests[0].operation,'delete_context_record');assert.deepEqual(ctrl.getState().preferences.map(p=>p.id),[p2id(55)]);assert.equal(ctrl.getState().context?.revision,2);ctrl.close();
});
test('live preference component reaches explicit create/edit/delete and save without note inference',async()=>{
 let c=context(),ids=90;const writes:Exclude<PersonalContextV2Request,{operation:'read_context_v2'}>[]=[];let saved=0;
 const ports:PreferencePorts={owner:()=>p2id(3),createId:()=>p2id(ids++),read:async()=>c,write:async(_,r)=>{writes.push(r);if(r.operation==='delete_context_record')c={...c,revision:2,preferences:[]};return {contextRevision:2,deletedRevisionIds:[],replayed:false};}};
 const h=componentHarness('src/components/p0b-personalization/PreferenceContext.tsx','PreferenceContext',{ownerId:p2id(3),ports,onSaved(){saved++;},onClose(){}},{effects:true,modules:{'../ui/Screen':{Screen:'ScrollView'},'../ui/Button':{Button:'Button'},'../ui/ChoiceChip':{ChoiceChip:'ChoiceChip'}}});try{
  h.render();await settle();let nodes=h.render();assert.match(textContent(nodes),/Sensitivity and reaction reports remain separate/);press(control(nodes,'Add a confirmed preference'));nodes=h.render();press(control(nodes,'An extra skincare step'));nodes=h.render();press(control(nodes,'Firm constraint'));nodes=h.render();press(control(nodes,'I confirm this choice and its strength'));nodes=h.render();press(control(nodes,'Use confirmed preference'));nodes=h.render();press(control(nodes,'Save confirmed preferences'));await settle();assert.equal(saved,1);assert.equal(writes[0].operation,'save_setup');assert.equal((writes[0] as any).setup.preferences.length,2);assert.deepEqual((writes[0] as any).setup.notes,c.notes.map(n=>n.data));
  nodes=h.render();press(control(nodes,'Remove preference: Glycerin'));nodes=h.render();press(control(nodes,'Confirm preference removal'));await settle();assert.equal(writes[1].operation,'delete_context_record');
 }finally{h.dispose();}
});
test('fresh durable setup saves existing answers without the contextual preference editor',()=>{
 let received:any=null,serial=90;const h=componentHarness('src/components/p0b-personalization/ContextFlow.tsx','ContextFlow',{setup:true,durableSetup:true,ownerId:p2id(3),createId:()=>p2id(serial++),collectIntent:false,onSetup:(b:any)=>{received=b;},onApply(){},onSkip(){}},{modules:{'../ui/Button':{Button:'Button'},'../ui/ChoiceChip':{ChoiceChip:'ChoiceChip'}}});
 for(let n=0;n<4;n++){assert(!h.render().some(node=>node.props.label==='Add a confirmed preference'));press(control(h.render(),'Continue'));}assert(!h.render().some(node=>node.props.label==='Add a confirmed preference'));press(control(h.render(),'Save skin profile'));assert.deepEqual(received.preferences??[],[]);h.dispose();
});
test('stale CAS stops without hidden refresh, and ambiguous removal retries exact erasure request',async()=>{
 const owner=p2id(3),c=context();let loads=0,ids=90;const attempts:Exclude<PersonalContextV2Request,{operation:'read_context_v2'}>[]=[];
 const ctrl=createPreferenceController({owner:()=>owner,createId:()=>p2id(ids++),read:async()=>{loads++;return c;},write:async(_,r)=>{attempts.push(r);throw Object.assign(Error('changed'),{code:'STALE_CONTEXT'});}});ctrl.setOwner(owner);await ctrl.load();ctrl.update([preference(p2id(55),{kind:'routine'})]);assert.equal(await ctrl.save(),false);assert.match(ctrl.getState().error!,/saved context changed.*draft remains/);assert.equal(await ctrl.save(),false);assert.equal(loads,1);assert.deepEqual(attempts[0],attempts[1]);ctrl.close();
 let reads=0;attempts.length=0;const remove=createPreferenceController({owner:()=>owner,createId:()=>p2id(ids++),read:async()=>++reads===1?c:{...c,revision:2,preferences:[]},write:async(_,r)=>{attempts.push(r);if(attempts.length===1)throw Error('response lost');return {contextRevision:2,deletedRevisionIds:[],replayed:true};}});remove.setOwner(owner);await remove.load();assert.equal(await remove.remove(p2id(50)),false);assert.equal(remove.getState().preferences.length,0);assert.equal(remove.getState().context!.preferences.length,0);assert.equal(remove.getState().pendingRemoval,p2id(50));remove.update([preference(),preference(p2id(55),{kind:'routine'})]);assert.deepEqual(remove.getState().preferences.map(p=>p.id),[p2id(55)]);assert.equal(remove.getState().pendingRemoval,p2id(50));assert.equal(await remove.save(),false);assert.equal(attempts.length,1);assert(await remove.remove(p2id(50)));assert.deepEqual(attempts[0],attempts[1]);assert.deepEqual(remove.getState().preferences.map(p=>p.id),[p2id(55)]);remove.close();
});
test('confirmed preference UI supports explicit edit and manual owned reference while retaining all meaning',()=>{
 const c=context();let received:ConfirmedPreference[]=[];const props={preferences:c.preferences.map(p=>p.data),products:preferenceProductChoices(c),createId:()=>p2id(99),onChange:(p:ConfirmedPreference[])=>{received=p;},now:()=>p2now};
 const h=componentHarness('src/components/p0b-personalization/PreferenceChoices.tsx','PreferenceChoices',props,{modules:{'../ui/Button':{Button:'Button'},'../ui/ChoiceChip':{ChoiceChip:'ChoiceChip'}}});
 press(control(h.render(),'Edit preference: Glycerin'));let nodes=h.render();press(control(nodes,'Preference, with possible tradeoffs'));nodes=h.render();press(control(nodes,'I confirm this choice and its strength'));nodes=h.render();press(control(nodes,'Use confirmed preference edit'));assert.equal(received[0].id,p2id(50));assert.equal(received[0].revision,2);assert.equal(received[0].strength,'prefer');assert.equal(received[0].target.kind,'ingredient');
 h.render({preferences:received});press(control(h.render(),'Add a confirmed preference'));nodes=h.render();press(control(nodes,'A recorded product'));nodes=h.render();press(control(nodes,'Avoid recorded product: Synthetic current item · manual report, unverified'));nodes=h.render();press(control(nodes,'I confirm this choice and its strength'));nodes=h.render();press(control(nodes,'Use confirmed preference'));assert.deepEqual(received[1].target,{kind:'product',reference:c.routine!.data.items[0].reference});h.dispose();
});
test('catalog avoidance uses the exact owned reference and requires a permitted display name for new selection',()=>{
 const c=context();const reference={kind:'catalog' as const,productId:p2id(80),variantId:p2id(81),formulaVersionId:p2id(82)};c.routine!.data.items.push({...p3routine(p2id(83)),reference});
 assert.equal(preferenceProductChoices(c).find(p=>p.reference.kind==='catalog')?.selectable,false);
 const key=`${reference.productId}:${reference.variantId}:${reference.formulaVersionId}`;const selected=preferenceProductChoices(c,{[key]:'Synthetic named catalog product'}).find(p=>p.reference.kind==='catalog')!;assert(selected.selectable);assert.match(selected.label,/Synthetic named catalog product/);assert.deepEqual(preference(p2id(51),{kind:'product',reference:selected.reference}).target,{kind:'product',reference});
});
