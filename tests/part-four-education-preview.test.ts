import assert from 'node:assert/strict';
import test from 'node:test';
import { educationPreviewPacket, educationPreviewCases } from '../src/presentation/part-four/educationPreview.ts';
import { componentHarness,textContent } from './ux-profile-render.ts';
const route='app/part-four-education-preview.tsx';
test('educational preview uses exact amended/new copy and preserves lack of product or personal authority',()=>{
 for(const which of ['revisions','expansion'] as const){const p=educationPreviewPacket(which,'2026-10-04T02:15:00Z');assert.deepEqual(p.formula.ingredients.map(i=>i.observedName),educationPreviewCases[which]);assert.ok(p.formula.ingredients.every(i=>i.card?.editorial));assert.equal(p.formula.binding.kind,'capture');assert.ok(p.formula.sourceRefs.every(s=>s.sourceUrl===null));assert.equal(p.contextRevision,0);assert.equal(p.decisionState,'pending');}
});
test('reference route is unavailable in release builds or without explicit development fixture opt-in',()=>{
 const prior=process.env.EXPO_PUBLIC_PART_THREE_FIXTURE_UI;try{process.env.EXPO_PUBLIC_PART_THREE_FIXTURE_UI='true';const modules={'expo-router':{Redirect:'Redirect',useLocalSearchParams:()=>({})}};
 assert.ok(!textContent(componentHarness(route,'default',{}, {modules,developmentRuntime:false}).render()).includes('Local education reference'));
 process.env.EXPO_PUBLIC_PART_THREE_FIXTURE_UI='false';assert.ok(!textContent(componentHarness(route,'default',{}, {modules}).render()).includes('Local education reference'));
 }finally{if(prior===undefined)delete process.env.EXPO_PUBLIC_PART_THREE_FIXTURE_UI;else process.env.EXPO_PUBLIC_PART_THREE_FIXTURE_UI=prior;}
});
