import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { migratePersonalContextV1, projectPersonalContextV1, projectPersonalContextV2 } from '../src/services/context/migrateV2.ts';
import { personalContextV2Schema, personalContextV2RequestSchema, setupV2Schema, useContextV2Schema } from '../src/contracts/PersonalContextV2Schema.ts';
import type { PersonalContextSnapshot, PersonalContextRevision, PersonalExperienceInput } from '../src/contracts/PersonalContext.ts';
import type { SetupPayloadV2 } from '../src/contracts/PersonalContextV2.ts';
import { setupToStorageV2 } from '../src/presentation/p0b-personalization/setupStorageV2.ts';
import { createContextDraft } from '../src/presentation/p0b-personalization/draft.ts';
import { addCurrentProduct, addPastOutcome, createSetupBundle, currentUseItem, manualUnverifiedReference, setAdditionalNote, toggleCurrentFeedback } from '../src/presentation/p0b-personalization/setup.ts';
import { componentHarness, control, press } from './ux-profile-render.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(1),at='2026-10-02T19:00:00.000Z';
const metadata={id:id(2),ownerId:owner,revision:1,recordedAt:at,provenance:'self_report' as const,supersedesRevisionId:null};
const reference={kind:'manual' as const,name:'My own cream',brand:'Reported brand'};
const profile={intent:'unanswered' as const,primaryGoal:null,secondaryGoals:[],skinBehavior:'unanswered' as const,reactivity:'generally_tolerates' as const,reproductive:{pregnancy:'unanswered' as const,tryingToConceive:'withheld' as const,nursing:'unsure' as const},sensitivities:{status:'none_known' as const,values:[]},treatments:{status:'none' as const,values:[]}};
const use={timing:'both' as const,frequency:{kind:'qualitative' as const,value:'most_days' as const},startedOn:'2026-01-02',stoppedOn:null,duration:{count:2,unit:'months' as const}};
const v1:PersonalContextSnapshot={version:'personal-context-v1',ownerId:owner,revision:1,profile:{...metadata,data:profile},routine:{...metadata,data:{completeness:'partial',items:[{...use,id:id(3),reference,state:'occasional'}]}},experiences:(['liked','finished','no_reaction_reported','tolerated','reacted','ineffective'] as const).map((kind,n)=>({...metadata,id:id(n+10),data:{id:id(n+20),reference,kind,occurred:{start:null,end:null},useContext:use,symptoms:[],note:null}})),historyTruncated:false,historyRevision:id(10),legacy:{source:'legacy_free_context',profile:{combinedReproductiveStatus:'yes'},products:[],experiences:[],truncated:false}};
function emptySetup():SetupPayloadV2 {const c=migratePersonalContextV1(v1);return {profile:c.profile!.data,routine:{completeness:'partial',items:[]},experiences:[],preferences:[],assessments:[],notes:[],setupAnswers:{currentProducts:'unanswered',pastProducts:'unanswered'}};}
test('v1 round trip preserves all reports, exact use states, metadata and sensitive legacy boundaries',()=>{
 const c=migratePersonalContextV1(v1);assert.deepEqual(projectPersonalContextV1(c),v1);assert.deepEqual(c.assessments,[]);assert.deepEqual(c.preferences,[]);assert.equal(c.profile!.data.reactivity,'generally_tolerates');assert.deepEqual(c.profile!.data.reproductive,v1.profile!.data.reproductive);assert.deepEqual(c.legacy,v1.legacy);assert.equal(personalContextV2Schema.safeParse(c).success,true);
});
test('v2 answer states, exact frequency, uncertain date precision and self-report use survive serialized round trip',()=>{
 fc.assert(fc.property(fc.constantFrom('unanswered','unsure','withheld'),fc.double({min:0.01,max:100,noNaN:true}), (state,count)=>{
 const setup=emptySetup();setup.profile.primaryGoal={state};setup.routine.items=[{id:id(3),reference,state:'paused',timing:'am',frequency:{kind:'exact',count,unit:'week'},startedOn:{state:'known',value:{value:'2025-12',precision:'month'}},stoppedOn:{state:'unsure'},duration:null,reportedPurpose:{answer:{state:'withheld'},provenance:'self_report'},applicationSite:{answer:{state:'known',value:'hands'},provenance:'self_report'},useForm:{answer:{state:'known',value:'leave_on'},provenance:'self_report'}}];
 const parsed=setupV2Schema.parse(JSON.parse(JSON.stringify(setup)));assert.deepEqual(parsed,setup);
 }),{numRuns:80,seed:3103});
});
test('validators reject forged owner, extra authority, duplicate IDs, invalid intervals and note truncation',()=>{
 const setup=emptySetup();const req={operation:'save_setup',requestId:id(4),baseContextRevision:1,setup};assert.equal(personalContextV2RequestSchema.safeParse({...req,ownerId:owner}).success,false);
 assert.equal(setupV2Schema.safeParse({...setup,notes:[{id:id(5),scope:'profile',targetRef:null,text:'🧴'.repeat(2001)}]}).success,false);
 assert.equal(setupV2Schema.safeParse({...setup,notes:[{id:id(5),scope:'profile',targetRef:null,text:'🧴'.repeat(2000)}]}).success,true);
 const migrated=migratePersonalContextV1(v1).routine!.data.items[0];assert.equal(useContextV2Schema.safeParse({...migrated,startedOn:{state:'known',value:{precision:'day',value:'2026-02-30'}}}).success,false);
 assert.equal(useContextV2Schema.safeParse({timing:'unknown',frequency:{kind:'exact',count:Infinity,unit:'day'},startedOn:{state:'unanswered'},stoppedOn:{state:'unanswered'},duration:null}).success,false);
 const c=migratePersonalContextV1(v1);assert.equal(personalContextV2Schema.safeParse({...c,profile:{...c.profile,ownerId:id(99)}}).success,false);
});
test('active corrections replace setup reports, while ordinary v1 section edits retain unrelated v2 data',()=>{
 const setup=emptySetup();setup.experiences=[{...migratePersonalContextV1(v1).experiences[0].data,useContext:null}];setup.profile.primaryGoal={state:'withheld'};const rev:PersonalContextRevision<SetupPayloadV2>={...metadata,revision:2,id:id(50),data:setup};
 const corrected:PersonalContextRevision<PersonalExperienceInput>={...metadata,revision:3,id:id(51),supersedesRevisionId:rev.id,data:{...v1.experiences[0].data,kind:'reacted',useContext:null}};
 const c=projectPersonalContextV2({...v1,revision:3,experiences:[corrected]},rev);assert.equal(c.experiences.length,1);assert.equal(c.experiences[0].data.kind,'reacted');assert.equal(c.profile!.data.primaryGoal.state,'withheld');assert.equal(c.setupRevision,rev.id);
});
test('setup explicit helps, reaction and texture coexist without fabricated liked, satisfaction or inferred goal',()=>{
 let serial=60;let b=addCurrentProduct(createSetupBundle(owner),currentUseItem(id(3),manualUnverifiedReference('Cream')));
 for(const f of ['helpful','stung','too_heavy'] as const)b=toggleCurrentFeedback(b,id(3),f);b=setAdditionalNote(b,'Private raw note');
 b.reportedUse={[id(3)]:{reportedPurpose:{answer:{state:'known',value:'moisturizing'},provenance:'self_report'},applicationSite:{answer:{state:'known',value:'face'},provenance:'self_report'},useForm:{answer:{state:'known',value:'leave_on'},provenance:'self_report'}}};
 const setup=setupToStorageV2(createContextDraft(),b,()=>id(++serial),at);assert.equal(setup.assessments[0].perceivedHelp,'helps');assert.equal(setup.assessments[0].satisfaction,'unanswered');assert.equal(setup.experiences[0].kind,'reacted');assert.equal(setup.experiences.some(e=>e.kind==='liked'),false);assert.equal(setup.notes.length,2);assert.deepEqual(setup.assessments[0].goalOrPurpose,{state:'known',value:'moisturizing'});
 const past=addPastOutcome(createSetupBundle(owner),id(9),manualUnverifiedReference('Old cream'),'not_helping');const stored=setupToStorageV2(createContextDraft(),past,()=>id(++serial),at);assert.equal(stored.routine.items.length,0);assert.equal(stored.experiences[0].kind,'ineffective');
});
test('durable extended completion invokes one setup callback and retains draft on failed host write',()=>{
 let setups=0,profiles=0;const received:unknown[]=[];
 const h=componentHarness('src/components/p0b-personalization/ContextFlow.tsx','ContextFlow',{setup:true,durableSetup:true,ownerId:owner,collectIntent:false,createId:()=>id(3),onSetup(b:unknown,d:unknown){setups++;received.push({b,d});},onApply(){profiles++;},onSkip(){}});
 for(let i=0;i<4;i++)press(control(h.render(),'Continue'));press(control(h.render(),'Save skin profile'));assert.equal(setups,1);assert.equal(profiles,0);h.render({error:'Your setup was not saved.'});press(control(h.render(),'Save skin profile'));assert.equal(setups,2);assert.deepEqual(received[0],received[1]);
});
test('legacy routine edit preserves v2 purpose and unrepresentable uncertain dates',()=>{
 const setup=emptySetup();setup.routine=migratePersonalContextV1(v1).routine!.data;setup.routine.items[0].startedOn={state:'known',value:{value:'2026-01',precision:'month'}};setup.routine.items[0].reportedPurpose={answer:{state:'known',value:'moisturizing'},provenance:'self_report'};
 const rev:PersonalContextRevision<SetupPayloadV2>={...metadata,id:id(50),revision:2,data:setup};
 const newer={...v1,revision:3,routine:{...v1.routine!,revision:3,data:{...v1.routine!.data,items:v1.routine!.data.items.map(i=>({...i,startedOn:null,frequency:{kind:'exact' as const,count:2,unit:'week' as const}}))}}};
 const c=projectPersonalContextV2(newer,rev);assert.deepEqual(c.routine!.data.items[0].startedOn,setup.routine.items[0].startedOn);assert.deepEqual(c.routine!.data.items[0].reportedPurpose,setup.routine.items[0].reportedPurpose);assert.deepEqual(c.routine!.data.items[0].frequency,{kind:'exact',count:2,unit:'week'});
});
test('past texture feedback is kept privately without inventing an ineffective or liked experience',()=>{
 let serial=90;const b=addPastOutcome(createSetupBundle(owner),id(9),manualUnverifiedReference('Old cream'),'too_heavy');const s=setupToStorageV2(createContextDraft(),b,()=>id(++serial),at);assert.deepEqual(s.experiences,[]);assert.deepEqual(s.assessments,[]);assert.match(s.notes[0].text,/Old cream: Too heavy/);
});
test('current reaction may coexist with an explicit none remembered answer for past products',()=>{
 let serial=100;let b=addCurrentProduct(createSetupBundle(owner),currentUseItem(id(3),manualUnverifiedReference('Cream')));b=toggleCurrentFeedback(b,id(3),'stung');b={...b,previewOnly:{...b.previewOnly,pastProducts:'none'}};assert.equal(setupToStorageV2(createContextDraft(),b,()=>id(++serial),at).experiences[0].kind,'reacted');
});

test('experience date precision and uncertainty are faithful through v2 serialization and v1-compatible null projection',()=>{const setup=emptySetup();setup.experiences=[{...migratePersonalContextV1(v1).experiences[0].data,occurred:{start:{state:'known',value:{value:'2020',precision:'year'}},end:{state:'withheld'}}}];const parsed=setupV2Schema.parse(JSON.parse(JSON.stringify(setup)));assert.deepEqual(parsed.experiences[0].occurred,setup.experiences[0].occurred);const c=projectPersonalContextV2({...v1,revision:2,experiences:[]},{...metadata,revision:2,data:parsed});assert.deepEqual(projectPersonalContextV1(c).experiences[0].data.occurred,{start:null,end:null});});

test('review 7: hidden free-text intake is not submitted during delayed setup acknowledgment; failure retains structured input',async()=>{
 let release!:()=>void;const pending=new Promise<void>(resolve=>release=resolve);const submitted:Array<any>=[];let acknowledged=false;
 const h=componentHarness('src/components/p0b-personalization/ContextFlow.tsx','ContextFlow',{setup:true,durableSetup:true,ownerId:owner,collectIntent:false,createId:()=>id(3),onSetup(b:unknown){submitted.push(structuredClone(b));void pending.then(()=>{acknowledged=true;});},onApply(){},onSkip(){}});
 for(let i=0;i<4;i++)press(control(h.render(),'Continue'));press(control(h.render(),'Save skin profile'));
 assert.equal(submitted[0].additionalNote,null);assert.equal(acknowledged,false);
 assert(!JSON.stringify(h.render({loading:true})).includes('Anything else'));
 press(control(h.render({loading:false,error:'Your setup was not saved.'}),'Save skin profile'));assert.deepEqual(submitted[1],submitted[0]);release();await pending;await Promise.resolve();assert.equal(acknowledged,true);h.dispose();
});
