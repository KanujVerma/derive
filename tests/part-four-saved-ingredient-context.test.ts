import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { normalize } from '../src/domain/part-two/index.ts';
import { ORDINARY_PART_THREE_RELEASE_SELECTION } from '../src/domain/part-three/release.ts';
import { assembleFoundation } from '../src/domain/part-four/assemble.ts';
import { evaluatePersonalResult } from '../src/domain/part-three/evaluate.ts';
import { partThreeTarget, emptyPartThreeChoices } from '../src/presentation/part-three/target.ts';
import { boundDeclaration, p2metadata, p2now, p2id } from './fixtures/part-two-core.ts';
import { p3context, p3input } from './fixtures/part-three.ts';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const sheet = 'src/components/check/part-three/PartThreeSavedAssessmentSheet.tsx';
function fixture(expiresAt?: string) {
 const input = boundDeclaration('Dimethicone, Fragrance, Water', 'public');
 if (expiresAt) input.binding.expiresAt = expiresAt;
 const partTwo = normalize(input, ORDINARY_PART_THREE_RELEASE_SELECTION.dictionaryRelease, p2metadata);
 if (partTwo.state !== 'ready') throw Error('Fixture not ready');
 let context = p3context(); context.profile!.id = p2id(900); context.profile!.data.reactivity = 'reacts_easily';
 let basis = structuredClone(partTwo), refused = false;
 const selection = {education:'approved423', science:'pending_candidates'} as const;
 const session = {ownerId:context.ownerId, accountGeneration:1, encounterId:p2id(901), generation:1};
 const target = partThreeTarget(context, partTwo, session, emptyPartThreeChoices(), null, null, true, selection, ORDINARY_PART_THREE_RELEASE_SELECTION)!;
 const historical = evaluatePersonalResult({...p3input(), releaseSelection:ORDINARY_PART_THREE_RELEASE_SELECTION, partTwo, context, binding:{...target.binding,attemptId:p2id(904)}, resultId:p2id(902), requestedUse:target.request.use});
 historical.partFour=assembleFoundation({releaseSelection:ORDINARY_PART_THREE_RELEASE_SELECTION,context,partTwo,requestedUse:{purpose:null,site:null,useForm:null},intent:'unanswered',candidateRoutineItemId:null,selectedComparatorId:null},historical) ?? undefined;
 const before = structuredClone(historical);
 let serial=910;
 const transport = {request:async(r:any)=> {
  if(refused) throw Error('Saved evidence withdrawn');
  if(r.operation==='identity')return {kind:'identity',identity:null};
  if(r.operation==='saved_basis')return {kind:'saved_basis',partTwo:basis,pinnedSnapshotId:p2id(12),request:null};
  if(r.operation==='read_saved')return {kind:'historical',savedAssessmentId:p2id(903),savedAt:p2now,assessmentWhenSaved:historical,currentAssessment:'unavailable'};
  return {kind:'unavailable',reason:'evidence_unavailable'};
 }};
 const options = {effects:true,modules:{
  '../../../services/partThree':{PART_THREE_ENABLED:true,PART_FOUR_ENABLED:true,PART_FOUR_CLIENT_SELECTION:selection,PART_THREE_RELEASE_SELECTION:ORDINARY_PART_THREE_RELEASE_SELECTION,
   partThreeTransport:transport,loadPartThreeContext:async()=>context,partThreeEncounter:(owner:string)=>({...session,ownerId:owner}),subscribePartThreeSession:()=>()=>{}},
  '../../../services/productCatalog':{createCatalogRequestId:()=>p2id(serial++)},
  '../result-sheet/ResultSheetSurface':{ResultSheetSurface:(p:any)=>React.createElement('Surface',p,p.summary,p.compactActions,p.children)},
  '../../ui/Button':{Button:'Button'},'../../ui/ChoiceChip':{ChoiceChip:'ChoiceChip'},
 }};
 return {owner:context.ownerId, before, historical, options,
  setContext(value:typeof context){context=value;},context,
  setBasis(value:typeof basis){basis=value;},basis,
  withdraw(){refused=true;},
  mount(){return componentHarness(sheet,'PartThreeSavedAssessmentSheet',{ownerId:context.ownerId,savedAssessmentId:p2id(903),onClose(){}},options);}};
}
async function ready(h:ReturnType<typeof componentHarness>){for(let i=0;i<8;i++){h.render();await settle();}return h.render();}

test('cold saved sheet displays one saved answer and pinned ingredient basis despite current profile changes',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:Date.parse(p2now)});
 const f=fixture();let h=f.mount();
 try {
  await ready(h);h.dispose();h=f.mount();
  let text=textContent(await ready(h));
  assert.match(text,/Dimethicone/);assert(!/Current Check|When saved|With your current profile|Uses your current profile/.test(text));assert.deepEqual(f.historical,f.before);
  const next=structuredClone(f.context);next.revision++;next.profile!.revision=next.revision;next.profile!.data.primaryGoal={state:'known',value:'oiliness'};next.profile!.data.reactivity='generally_tolerates';f.setContext(next);
  t.mock.timers.tick(10000);text=textContent(await ready(h));assert.match(text,/Dimethicone/);assert.deepEqual(f.historical,f.before);
 }finally{h.dispose();}
});
test('saved context disappears on wrong owner or refused saved evidence',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:Date.parse(p2now)});
 const f=fixture(),h=f.mount();
 try{
  assert.match(textContent(await ready(h)),/Dimethicone/);
  assert.doesNotMatch(textContent(h.render({ownerId:p2id(999)})),/Dimethicone/);
  h.render({ownerId:f.owner});assert.match(textContent(await ready(h)),/Dimethicone/);
  f.withdraw();t.mock.timers.tick(10000);assert.doesNotMatch(textContent(await ready(h)),/Dimethicone/);
 }finally{h.dispose();}
});
test('saved context clears at evidence expiry and rejects withdrawn source permissions',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:Date.parse(p2now)});
 const f=fixture(new Date(Date.parse(p2now)+1500).toISOString());
 const h=f.mount();try{
  assert.match(textContent(await ready(h)),/Dimethicone/);
  t.mock.timers.tick(1500);assert.doesNotMatch(textContent(h.render()),/Dimethicone/);
 }finally{h.dispose();}
 const g=fixture(),revoked=structuredClone(g.basis);(revoked.output.reading.dependencyManifest.sourceRefs[0] as {permitted:boolean}).permitted=false;g.setBasis(revoked);
 const withdrawn=g.mount();try{assert.doesNotMatch(textContent(await ready(withdrawn)),/Dimethicone/);}finally{withdrawn.dispose();}
});

test('independently authorized historical ingredients survive the short current-result lease but not source expiry',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:Date.parse(p2now)});
 const f=fixture(new Date(Date.parse(p2now)+1500).toISOString());
 f.historical.partFour=assembleFoundation({releaseSelection:ORDINARY_PART_THREE_RELEASE_SELECTION,context:f.context,partTwo:f.basis,requestedUse:{purpose:null,site:null,useForm:null},intent:'unanswered',candidateRoutineItemId:null,selectedComparatorId:null},f.historical) ?? undefined;
 assert(f.historical.partFour);
 f.historical.evaluatedAt=new Date(Date.parse(p2now)-60000).toISOString();
 f.historical.validUntil=new Date(Date.parse(p2now)-1).toISOString();
 const h=f.mount();try{
  await ready(h);
  let nodes=h.render();assert(control(nodes,'Ingredient details: Dimethicone, position 1'));
  press(control(nodes,'Ingredient details: Dimethicone, position 1'));assert.match(textContent(h.render()),/Dimethicone makes skin feel smoother/);assert(!textContent(h.render()).includes('Listed as: Dimethicone'));
  assert(Date.parse(f.historical.validUntil)<Date.now(),'The historical verdict timestamp is preserved');
  t.mock.timers.tick(1500);nodes=h.render();assert.match(textContent(nodes),/Product details unavailable/);
  assert(!nodes.some(n=>n.props.accessibilityLabel==='Ingredient details: Dimethicone, position 1'));
 }finally{h.dispose();}
});
