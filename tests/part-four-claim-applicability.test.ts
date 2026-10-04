import assert from 'node:assert/strict';
import test from 'node:test';
const imported=await import('../src/domain/part-four/claimApplicability.ts').catch(()=>null);
test('claim applicability module exists before admission can affect decisions',()=>assert(imported,'Missing deterministic claim applicability implementation'));
const now='2026-10-04T03:00:00.000Z',later='2026-10-05T03:00:00.000Z';
const claim={id:'fixture:G02',family:'G02',tier:'decision_candidate',scope:'formula_transfer',sourceRefs:[{id:'source:trial',url:'https://example.com/trial',locator:'Synthetic independent matcher fixture',retrievedAt:'2026-10-03',bodySha256:null}],endpoint:{name:'measured oiliness',direction:'benefit',result:'Some measures improved; a different measure was null.',limitations:['Not acne efficacy.']},applicability:[{field:'ingredientId',expected:['niacinamide'],reason:'Exact ingredient identity.'},{field:'amountPercent',expected:['2'],reason:'Studied amount.'},{field:'vehicleBridge',expected:['reviewed-match'],reason:'Dose alone is insufficient.'},{field:'useForm',expected:['leave_on'],reason:'Do not transfer to cleanser.'}],copy:{reason:'Synthetic evidence-matched oiliness relevance; this product was not studied.',action:'Review the supported cosmetic option.',qualifications:['Not a response promise.']},admission:{status:'pending',scientificReviewer:null,operationRights:null},nonGoals:['acne','pore size'],contradictions:[]};
const feature=(values:string[])=>({state:'known',values,factIds:['fact:exact'],contextRevisionIds:[],sourceIds:['source:formula'],validUntil:later});
const features={ingredientId:feature(['niacinamide']),amountPercent:feature(['2']),vehicleBridge:feature(['reviewed-match']),useForm:feature(['leave_on'])};
function admission(){assert(imported);return {claimId:claim.id,claimHash:imported.scientificClaimHash(claim),status:'approved',reviewerId:'synthetic:reviewer',qualificationRef:'synthetic:qualification',reviewedAt:now,sourcePins:claim.sourceRefs.map(imported.claimSourcePin),rights:{grantId:'synthetic:grant',version:'1',process:true,store:true,display:true,export:true,validUntil:later,revoked:false},validUntil:later};}
function evaluate(overrides:Record<string,unknown>={},extra:Record<string,unknown>={}){assert(imported);return imported.assessScientificClaim(claim,{now,features:{...features,...overrides},admissions:[admission()],...extra});}
test('matching synthetic reviewed evidence produces bounded reason/action with trace and minimum expiry',()=>{const r=evaluate();assert.equal(r.state,'supported');assert.match(r.reason!,/not studied/);assert(r.factIds.includes('fact:exact'));assert.equal(r.validUntil,later);});
test('pending research cannot approve itself even when all applicability fields match',()=>{const r=evaluate({}, {admissions:[]});assert.equal(r.state,'pending');assert.equal(r.action,null);});
test('same amount without reviewed vehicle remains unknown and identifies only missing bridge',()=>{const r=evaluate({vehicleBridge:{...feature([]),state:'unknown',values:null}});assert.equal(r.state,'unknown');assert.deepEqual(r.missingFields,['vehicleBridge']);assert.equal(r.reason,null);});
test('known cleanser mismatch and contradictory dose are separate explicit states',()=>{assert.equal(evaluate({useForm:feature(['rinse_off'])}).state,'mismatch');assert.equal(evaluate({amountPercent:{...feature(['2','10']),state:'contradiction'}}).state,'contradiction');});
test('irrelevant unknown pH does not suppress a claim that does not require pH',()=>assert.equal(evaluate({pH:{...feature([]),state:'unknown',values:null}}).state,'supported'));
test('expired feature, revoked source, changed claim and missing operation rights fail closed',()=>{
 assert.equal(evaluate({amountPercent:{...feature(['2']),validUntil:now}}).state,'unknown');
 assert.equal(evaluate({}, {withdrawnDependencies:['source:trial']}).state,'unavailable');
 const bad=admission();bad.claimHash='f'.repeat(64);assert.equal(evaluate({}, {admissions:[bad]}).state,'pending');
 const denied=admission();denied.rights.store=false;assert.equal(evaluate({}, {admissions:[denied]}).state,'unavailable');
});
test('reference-only source never earns a product action and synthetic review must pin the exact sources',()=>{
 assert(imported);const ref={...claim,tier:'reference',scope:'ingredient_reference'};const a={...admission(),claimHash:imported.scientificClaimHash(ref)};
 const r=imported.assessScientificClaim(ref,{now,features,admissions:[a]});assert.equal(r.state,'reference');assert.equal(r.action,null);
 const wrong=admission();wrong.sourcePins=['a'.repeat(64)];assert.equal(evaluate({}, {admissions:[wrong]}).state,'pending');
});
test('display and durable retention admission do not confer or require export rights',()=>{
 const limited=admission();limited.rights.export=false;
 assert.equal(evaluate({}, {admissions:[limited]}).state,'supported');
});
