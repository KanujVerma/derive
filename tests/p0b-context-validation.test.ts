import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePersonalContextRequest } from '../supabase/functions/personal-context/validate.ts';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const item = { id, reference: { kind: 'manual', name: 'Retinol' }, state: 'current', timing: 'unknown', frequency: { kind: 'qualitative', value: 'few_times_week' }, startedOn: null, stoppedOn: null, duration: null };
const routine = { completeness: 'partial', items: [item] };
const request = { operation: 'save_routine', requestId: id, baseRevision: 0, routine };
const profile = { intent: 'add', primaryGoal: 'dryness', secondaryGoals: ['maintain'], skinBehavior: 'dry_tight', reactivity: 'unsure', reproductive: { pregnancy: 'unanswered', tryingToConceive: 'withheld', nursing: 'no' }, sensitivities: { status: 'unanswered', values: [] }, treatments: { status: 'reported', values: ['topical_retinoid'] } };
const experience = { id, reference: { kind: 'manual', name: 'Old lotion' }, kind: 'no_reaction_reported', occurred: { start: null, end: null }, useContext: null, symptoms: [], note: null };

test('P0-B qualitative frequency and partial routine remain reported rather than inferred', () => {
  const parsed = parsePersonalContextRequest(request);
  assert.equal(parsed.operation, 'save_routine');
  if (parsed.operation !== 'save_routine') throw new Error('Wrong operation');
  assert.deepEqual(parsed.routine.items[0].frequency, { kind: 'qualitative', value: 'few_times_week' });
  assert.equal(parsed.routine.completeness, 'partial');
  assert.equal(parsed.routine.items[0].startedOn, null);
  const exact = parsePersonalContextRequest({ ...request, routine: { completeness:'complete',items:[{...item,frequency:{kind:'exact',count:2,unit:'week'}}] } });
  if (exact.operation !== 'save_routine') throw new Error('Wrong operation');
  assert.deepEqual(exact.routine.items[0].frequency,{kind:'exact',count:2,unit:'week'});
});
test('P0-B rejects forged ownership, derived facts, duplicate routine IDs, and stale-write-invalid bases', () => {
  for (const bad of [
    { ...request,userId:id },{ ...request,baseRevision:-1 },
    { ...request,routine:{...routine,items:[{...item,activeClasses:['retinoid']}]} },
    { ...request,routine:{...routine,items:[item,item]} },
    { ...request,routine:{...routine,items:Array.from({length:51},()=>item)} },
  ]) assert.throws(() => parsePersonalContextRequest(bad));
});
test('P0-B separate reproductive answers preserve unanswered, withheld, and no', () => {
  const parsed=parsePersonalContextRequest({operation:'save_profile',requestId:id,baseRevision:0,profile});
  if(parsed.operation!=='save_profile') throw new Error('Wrong operation');
  assert.deepEqual(parsed.profile.reproductive,{pregnancy:'unanswered',tryingToConceive:'withheld',nursing:'no'});
  assert.throws(()=>parsePersonalContextRequest({operation:'save_profile',requestId:id,baseRevision:0,profile:{...profile,reproductive:{pregnancy:'yes'}}}));
});
test('P0-B goal and sensitivity lists cannot contradict their explicit states', () => {
  for(const changed of [
    {...profile,secondaryGoals:['dryness']},
    {...profile,sensitivities:{status:'none_known',values:['fragrance']}},
    {...profile,treatments:{status:'withheld',values:['topical_retinoid']}},
    {...profile,secondaryGoals:['oiliness','texture','maintain']},
  ]) assert.throws(()=>parsePersonalContextRequest({operation:'save_profile',requestId:id,baseRevision:0,profile:changed}));
});
test('P0-B no reaction reported remains distinct from tolerance and unknown use dates', () => {
  const parsed=parsePersonalContextRequest({operation:'append_experience',requestId:id,baseRevision:0,supersedesRevisionId:null,experience});
  if(parsed.operation!=='append_experience') throw new Error('Wrong operation');
  assert.equal(parsed.experience.kind,'no_reaction_reported');assert.deepEqual(parsed.experience.occurred,{start:null,end:null});assert.equal(parsed.experience.useContext,null);
});
test('P0-B rejects invalid calendar dates, reverse intervals and incomplete formula chains', () => {
  assert.throws(()=>parsePersonalContextRequest({...request,routine:{...routine,items:[{...item,startedOn:'2026-02-30'}]}}));
  assert.throws(()=>parsePersonalContextRequest({...request,routine:{...routine,items:[{...item,startedOn:'2026-09-10',stoppedOn:'2026-09-01'}]}}));
  assert.throws(()=>parsePersonalContextRequest({operation:'append_experience',requestId:id,baseRevision:0,supersedesRevisionId:null,experience:{...experience,occurred:{start:'2026-09-10',end:'2026-09-01'}}}));
  assert.throws(()=>parsePersonalContextRequest({...request,routine:{...routine,items:[{...item,reference:{kind:'catalog',productId:id,variantId:null,formulaVersionId:id}}]}}));
});
test('P0-B effective history requests require bounded paging at an explicit snapshot revision', () => {
  assert.deepEqual(parsePersonalContextRequest({operation:'get_experiences',atRevision:3,productId:id}),{operation:'get_experiences',atRevision:3,productId:id});
  assert.throws(()=>parsePersonalContextRequest({operation:'get_experiences',atRevision:0,limit:51}));
  assert.throws(()=>parsePersonalContextRequest({operation:'get_experiences',atRevision:-1}));
  assert.throws(()=>parsePersonalContextRequest({operation:'get_experiences',atRevision:0,ownerId:id}));
});
test('P0-B UUID casing cannot hide catalog history or duplicate a stable routine item', () => {
  const upper=id.toUpperCase();
  const parsed=parsePersonalContextRequest({...request,routine:{completeness:'partial',items:[{...item,id:upper,reference:{kind:'catalog',productId:upper,variantId:null,formulaVersionId:null}}]}});
  if(parsed.operation!=='save_routine') throw new Error('Wrong operation');
  assert.equal(parsed.routine.items[0].id,id);
  assert.deepEqual(parsed.routine.items[0].reference,{kind:'catalog',productId:id,variantId:null,formulaVersionId:null});
  assert.throws(()=>parsePersonalContextRequest({...request,routine:{...routine,items:[item,{...item,id:upper}]}}));
});
test('P0-B sensitivity names cannot double-count case-only repeats after trimming', () => {
  assert.throws(()=>parsePersonalContextRequest({operation:'save_profile',requestId:id,baseRevision:0,profile:{...profile,sensitivities:{status:'reported',values:[' Fragrance ','fragrance']}}}));
  const parsed=parsePersonalContextRequest({operation:'save_profile',requestId:id,baseRevision:0,profile:{...profile,sensitivities:{status:'reported',values:[' Fragrance ','Lanolin']}}});
  if(parsed.operation!=='save_profile') throw new Error('Wrong operation');
  assert.deepEqual(parsed.profile.sensitivities.values,['Fragrance','Lanolin']);
});
