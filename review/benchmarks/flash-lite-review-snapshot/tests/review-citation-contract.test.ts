import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectFixture} from '../review/benchmarks/facts-first-v2/protocol.ts';
import {copyAuditFields,validateCopyAudit} from '../src/domain/personalized-sheet/copyClaimAudit.ts';
import {prepareBundleReview} from '../src/domain/personalized-sheet/decisionBundleCopy.ts';
import {prepareJevDecisionBundle,JEV_BUNDLE_PROTOCOL} from '../src/domain/personalized-sheet/jevDecisionBundle.ts';
import {PERSONALIZED_JEV_MODEL} from '../src/domain/personalized-sheet/jevDecisionProtocol.ts';
const data=JSON.parse(fs.readFileSync(new URL('../review/benchmarks/facts-first-v3/cases.json',import.meta.url),'utf8'));
const i=projectFixture(data.cases.find((x:any)=>x.id==='sunscreen-preference-stays-scoped'))!;
const b:any={version:JEV_BUNDLE_PROTOCOL,inputHash:prepareJevDecisionBundle(i).inputHash,actual:i.allowedActions[0],hypothetical:(i.question?.options??[]).map(o=>({optionId:o.id,action:i.allowedActions[0]})),materiallyDifferentQuestionId:null,resolvedModel:PERSONALIZED_JEV_MODEL,usage:{inputTokens:1,outputTokens:1}};
const p:any={action:b.actual,headline:'Keep your current moisturizer',reason:'It helps your dryness.',nextStep:'Keep your current moisturizer.',why:[{id:'routine-fit',title:'Dryness',body:'Your current moisturizer helps your dryness.',evidenceIds:[],personalFactIds:['current-benefit']}],tradeoffs:[],selectedQuestionId:null,cautionIds:[]};
const rows=()=>copyAuditFields(p).map(f=>({...f,supported:true,evidenceIds:[],personalFactIds:['current-benefit'],issue:'none'}));
test('supported fields still require an actual reference',()=>{const a=rows();a[0].personalFactIds=[];assert.throws(()=>validateCopyAudit(i,p,a),/unreferenced_copy_audit/);});
test('unsupported field may honestly have no supporting reference',()=>{const a:any[]=rows();a[0]={...a[0],supported:false,personalFactIds:[],issue:'unsupported_instruction'};assert.equal(validateCopyAudit(i,p,a)[0].supported,false);});
test('personal-only support remains valid',()=>assert.equal(validateCopyAudit(i,p,rows()).length,5));
test('unrelated point citation remains rejected',()=>{const a=rows();a[3].personalFactIds=['sunscreen-finish'];assert.throws(()=>validateCopyAudit(i,p,a),/copy_audit_citation_mismatch/);});
test('review prompt explicitly rejects fabricated support and explains empty arrays',()=>{const r=prepareBundleReview(i,b,p);const t=r.request.contents[0].parts[0].text;assert.match(t,/supported:true field must cite at least one/);assert.match(t,/Both arrays may be empty only for a supported:false/);assert.match(t,/Never invent or attach an unrelated citation/);});

// Deliberately small independent evaluator for the subset emitted above.
import {COPY_AUDIT_SCHEMA} from '../src/domain/personalized-sheet/copyClaimAudit.ts';
function matches(s:any,v:any):boolean {
 if(s.anyOf)return s.anyOf.some((b:any)=>matches(b,v));
 if(s.type==='OBJECT')return !!v&&typeof v==='object'&&!Array.isArray(v)&&s.required.every((k:string)=>k in v)&&Object.entries(s.properties).every(([k,c])=>matches(c,v[k]));
 if(s.type==='ARRAY')return Array.isArray(v)&&v.length>=(s.minItems??0)&&v.length<=(s.maxItems??Infinity)&&v.every(x=>matches(s.items,x));
 if(s.type==='STRING')return typeof v==='string'&&(!s.enum||s.enum.includes(v));
 if(s.type==='BOOLEAN')return typeof v==='boolean';
 throw Error('unknown schema shape');
}
test('generation schema rejects the three observed empty supported rows',()=>{
 for(const field of ['nextStep','why.1.title','tradeoffs.0.title'])assert.equal(matches(COPY_AUDIT_SCHEMA,[{field,text:'Example',supported:true,evidenceIds:[],personalFactIds:[],issue:'none'}]),false);
});
test('generation schema permits each reference type and both together',()=>{
 for(const [evidenceIds,personalFactIds] of [[['e1'],[]],[[],['f1']],[['e1'],['f1']]])assert.equal(matches(COPY_AUDIT_SCHEMA,[{field:'headline',text:'Example',supported:true,evidenceIds,personalFactIds,issue:'none'}]),true);
});
test('generation schema allows honest unsupported rows without invented citations',()=>{
 for(const issue of ['unsupported_causation','unsupported_generalization','unsupported_comparison','unsupported_instruction','other'])assert.equal(matches(COPY_AUDIT_SCHEMA,[{field:'headline',text:'Example',supported:false,evidenceIds:[],personalFactIds:[],issue}]),true);
});
test('runtime rejects a supported boolean with an unsupported issue even if schema permits it',()=>{
 const a:any[]=rows();a[0].issue='other';assert.equal(matches(COPY_AUDIT_SCHEMA,a),true);assert.throws(()=>validateCopyAudit(i,p,a),/invalid_copy_audit/);
});
test('runtime rejects invented and duplicate references despite structural schema acceptance',()=>{
 for(const refs of [['invented'],['current-benefit','current-benefit']]){const a=rows();a[0].personalFactIds=refs;assert.equal(matches(COPY_AUDIT_SCHEMA,a),true);assert.throws(()=>validateCopyAudit(i,p,a),/invalid_copy_audit_reference/);}
});
test('schema correction has a new review identity and is actually bound to request',()=>{
 const r=prepareBundleReview(i,b,p);assert.match(r.request.contents[0].parts[0].text,/decision-bundle-review\/v5/);assert.deepEqual(r.request.generationConfig.responseSchema.properties.fieldChecks,COPY_AUDIT_SCHEMA);
});
