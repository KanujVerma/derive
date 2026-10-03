import assert from 'node:assert/strict';
import test from 'node:test';
import { profileV2Schema, productAssessmentSchema } from '../src/contracts/PersonalContextV2Schema.ts';
import { createContextDraft } from '../src/presentation/p0b-personalization/draft.ts';
import { profileToStorage, profileFromStorage } from '../src/presentation/p0b-personalization/storageAdapter.ts';
import { migrateProfileV1 } from '../src/services/context/migrateV2.ts';
import { setupToStorageV2 } from '../src/presentation/p0b-personalization/setupStorageV2.ts';
import { createSetupBundle, addCurrentProduct, currentUseItem, manualUnverifiedReference, toggleCurrentFeedback } from '../src/presentation/p0b-personalization/setup.ts';
import { componentHarness, control, press } from './ux-profile-render.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('optional structured texture and scoped spending survive profile edits without inferring old preferences',()=>{
 const old=createContextDraft(); assert.equal(profileToStorage(old).texturePreference,undefined);
 const draft={...old,texturePreference:{state:'answered' as const,value:'lightweight' as const},spendingPreference:{state:'answered' as const,value:{currency:'USD',scope:'per_product' as const,amountMinor:2500,period:'purchase' as const}}};
 const profile=profileToStorage(draft);const v2=profileV2Schema.parse(migrateProfileV1(profile));
 assert.deepEqual(v2.texturePreference,{state:'known',value:'lightweight'});
 assert.deepEqual(v2.spendingPreference,{state:'known',value:draft.spendingPreference.value});
 const restored=profileFromStorage(profile);assert.deepEqual(restored.texturePreference,draft.texturePreference);assert.deepEqual(restored.spendingPreference,draft.spendingPreference);
 assert.equal(profileV2Schema.safeParse({...v2,spendingPreference:{state:'known',value:{...draft.spendingPreference.value,amountMinor:-1}}}).success,false);
 assert.equal(profileV2Schema.safeParse({...v2,spendingPreference:{state:'known',value:{...draft.spendingPreference.value,currency:'usd'}}}).success,false);
});
test('unknown, unsure and withheld preference states remain distinct',()=>{
 for(const state of ['unanswered','unsure','withheld'] as const){const draft={...createContextDraft(),spendingPreference:{state},texturePreference:{state}};const profile=migrateProfileV1(profileToStorage(draft));assert.deepEqual(profile.spendingPreference,{state});assert.deepEqual(profile.texturePreference,{state});}
});
test('structured too-heavy feedback coexists with helpfulness and does not invent satisfaction',()=>{
 let bundle=addCurrentProduct(createSetupBundle(id(1)),currentUseItem(id(2),manualUnverifiedReference('Cream')));
 bundle=toggleCurrentFeedback(toggleCurrentFeedback(bundle,id(2),'helpful'),id(2),'too_heavy');let serial=5;
 const stored=setupToStorageV2(createContextDraft(),bundle,()=>id(++serial),'2026-10-03T21:00:00Z');
 assert.equal(stored.assessments[0].perceivedHelp,'helps');assert.equal(stored.assessments[0].satisfaction,'unanswered');assert.deepEqual(productAssessmentSchema.parse(stored.assessments[0]).textureExperience,{state:'known',value:'too_heavy'});
});
test('initial setup hides unused free text while retaining preferences and structured completion',()=>{
 const h=componentHarness('src/components/p0b-personalization/ContextFlow.tsx','ContextFlow',{setup:true,durableSetup:true,ownerId:id(1),collectIntent:false,createId:()=>id(2),onSetup(){},onApply(){},onSkip(){}});
 for(let i=0;i<4;i++)press(control(h.render(),'Continue'));
 const tree=JSON.stringify(h.render());assert(!tree.includes('Anything else'));assert(!tree.includes('not interpreted or used in Check'));assert(tree.includes('Save skin profile'));
});

import { parseSpendingAmount } from '../src/presentation/p0b-personalization/spendingInput.ts';
test('amount parsing uses declared minor units and rejects truncation, negatives and exponent syntax',()=>{assert.equal(parseSpendingAmount('25.09'),2509);assert.equal(parseSpendingAmount('0'),0);for(const value of ['','-1','1.234','1e3','NaN','01','1000000'])assert.equal(parseSpendingAmount(value),null);});
test('invalid spending text cannot silently save an unanswered limit',()=>{
 let applied=0;
 const h=componentHarness('src/components/p0b-personalization/ContextFlow.tsx','ContextFlow',{initialDraft:createContextDraft(),onApply(){applied++;},onSkip(){}});
 const input=control(h.render(),'Spending amount');input.props.onChangeText('1.234');press(control(h.render(),'Save skin profile'));
 assert.equal(applied,0);assert.match(JSON.stringify(h.render()),/Enter a spending amount/);
});
