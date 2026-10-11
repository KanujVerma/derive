import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectFixture} from '../review/benchmarks/facts-first-v2/protocol.ts';
import {buildBoundBundleCopySchema,buildBundleCopyRequest,validateBundleCopy} from '../src/domain/personalized-sheet/decisionBundleCopy.ts';
import {prepareJevDecisionBundle,JEV_BUNDLE_PROTOCOL} from '../src/domain/personalized-sheet/jevDecisionBundle.ts';
import {PERSONALIZED_JEV_MODEL} from '../src/domain/personalized-sheet/jevDecisionProtocol.ts';
import {PERSONALIZED_PROPOSAL_SCHEMA} from '../src/domain/personalized-sheet/geminiProvider.ts';
const dataset=JSON.parse(fs.readFileSync(new URL('../review/benchmarks/facts-first-v3/cases.json',import.meta.url),'utf8'));
const inputFor=(id='sunscreen-preference-stays-scoped')=>projectFixture(dataset.cases.find((f:any)=>f.id===id))!;
function bundleFor(input:any){const actual=input.allowedActions[0];return {version:JEV_BUNDLE_PROTOCOL,inputHash:prepareJevDecisionBundle(input).inputHash,actual,hypothetical:(input.question?.options??[]).map((o:any)=>({optionId:o.id,action:actual})),materiallyDifferentQuestionId:null,resolvedModel:PERSONALIZED_JEV_MODEL,usage:{inputTokens:1,outputTokens:1}};}
function proposalFor(input:any,bundle:any){return {action:bundle.actual,headline:'Keep your current moisturizer',reason:'It already addresses the dryness you reported.',nextStep:'Keep using your current moisturizer.',why:[{id:'routine-fit',title:'Your current routine',body:'You reported that your current moisturizer helps your dryness.',evidenceIds:[],personalFactIds:[input.personalFacts[0].id]}],tradeoffs:[],selectedQuestionId:null,cautionIds:[...input.mandatoryCautionIds]};}

test('every eligible fixture receives only its bound references and locked action',()=>{
 for(const fixture of dataset.cases){const input=projectFixture(fixture);if(!input)continue;const bundle=bundleFor(input),schema=buildBoundBundleCopySchema(input,bundle);
  assert.deepEqual(schema.properties.action.enum,[bundle.actual]);
  for(const key of ['why','tradeoffs'] as const){const p=schema.properties[key].items.properties;assert.deepEqual(p.personalFactIds.items.enum,input.personalFacts.map(f=>f.id));assert.equal(p.personalFactIds.minItems,1);assert.deepEqual(p.evidenceIds.items.enum,input.evidence.map(f=>f.id));}
 }
});
test('sunscreen fixture excludes unrelated IDs from other cases',()=>{const i=inputFor(),s=buildBoundBundleCopySchema(i,bundleFor(i));assert.deepEqual(s.properties.why.items.properties.evidenceIds.items.enum,['candidate-feel']);assert.deepEqual(s.properties.why.items.properties.personalFactIds.items.enum,['current-benefit','sunscreen-finish']);});
test('valid personal-history-only point remains accepted without evidence IDs',()=>{const i=inputFor(),b=bundleFor(i),p=proposalFor(i,b);assert.deepEqual(validateBundleCopy(i,b,p),p);});
test('all prior reference failures remain rejected',()=>{const i=inputFor(),b=bundleFor(i);const changes=[(p:any)=>p.why[0].evidenceIds=['invented'],(p:any)=>p.why[0].personalFactIds=['current-feel'],(p:any)=>p.why[0].personalFactIds=[],(p:any)=>p.why[0].personalFactIds=['current-benefit','current-benefit'],(p:any)=>p.why[0].evidenceIds=['candidate-feel','candidate-feel'],(p:any)=>p.why[0].title='',(p:any)=>p.why[0].unexpected=true,(p:any)=>p.why[0].evidenceIds='candidate-feel'];for(const change of changes){const p=proposalFor(i,b);change(p);assert.throws(()=>validateBundleCopy(i,b,p),/invalid_bundle_copy_reference/);}});
test('empty evidence pool uses a zero-length array without invalid empty enum',()=>{const i=inputFor();i.evidence=[];const s=buildBoundBundleCopySchema(i,bundleFor(i));assert.equal(s.properties.why.items.properties.evidenceIds.maxItems,0);assert.equal('enum' in s.properties.why.items.properties.evidenceIds.items,false);});
test('empty and populated mandatory cautions use exact cardinality',()=>{const i=inputFor();let s=buildBoundBundleCopySchema(i,bundleFor(i));assert.equal(s.properties.cautionIds.maxItems,0);i.mandatoryCautionIds=['one','two'];s=buildBoundBundleCopySchema(i,bundleFor(i));assert.deepEqual(s.properties.cautionIds.items.enum,['one','two']);assert.equal(s.properties.cautionIds.minItems,2);assert.equal(s.properties.cautionIds.maxItems,2);});
test('schema is isolated across requests and does not mutate shared base',()=>{const before=JSON.stringify(PERSONALIZED_PROPOSAL_SCHEMA),i=inputFor(),b=bundleFor(i),a=buildBoundBundleCopySchema(i,b),c=buildBoundBundleCopySchema(i,b);a.properties.why.items.properties.personalFactIds.items.enum!.push('bad');assert.equal(c.properties.why.items.properties.personalFactIds.items.enum!.includes('bad'),false);assert.equal(JSON.stringify(PERSONALIZED_PROPOSAL_SCHEMA),before);});
test('duplicate or missing context fails before asking for impossible copy',()=>{const i=inputFor();i.personalFacts.push({...i.personalFacts[0]});assert.throws(()=>buildBoundBundleCopySchema(i,bundleFor(i)));const empty=inputFor();empty.personalFacts=[];assert.throws(()=>buildBoundBundleCopySchema(empty,bundleFor(empty)));});
test('request includes the bound schema and leaves selection to later review',()=>{const i=inputFor(),b=bundleFor(i),r=buildBundleCopyRequest(i,b);assert.deepEqual(r.generationConfig.responseSchema,buildBoundBundleCopySchema(i,b));assert.match(r.contents[0].parts[0].text,/selectedQuestionId:null/);});

test('null-only selection and text limits mirror admission',()=>{const i=inputFor(),s=buildBoundBundleCopySchema(i,bundleFor(i));assert.deepEqual(s.properties.selectedQuestionId,{type:'NULL'});assert.equal(s.properties.reason.maxLength,360);assert.equal(s.properties.nextStep.maxLength,200);assert.equal(s.properties.why.items.properties.body.maxLength,450);});

test('reference namespaces cannot be swapped',()=>{const i=inputFor(),b=bundleFor(i);for(const field of ['evidenceIds','personalFactIds']){const p=proposalFor(i,b);p.why[0][field]=[field==='evidenceIds'?i.personalFacts[0].id:i.evidence[0].id];assert.throws(()=>validateBundleCopy(i,b,p),/invalid_bundle_copy_reference/);}});
