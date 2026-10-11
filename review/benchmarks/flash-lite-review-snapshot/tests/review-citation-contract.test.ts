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
test('review prompt explicitly rejects fabricated support and explains empty arrays',()=>{const r=prepareBundleReview(i,b,p);const t=r.request.contents[0].parts[0].text;assert.match(t,/issue:none only when all propositions/);assert.match(t,/Both arrays may be empty only for a non-none issue/);assert.match(t,/Never invent or attach an unrelated citation/);});

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
 const r=prepareBundleReview(i,b,p);assert.match(r.request.contents[0].parts[0].text,/decision-bundle-review\/v9/);assert.equal(r.request.generationConfig.responseSchema.properties.fieldChecks.minItems,5);
});

import {buildReviewAuditWireSchema,decodeReviewAuditWire} from '../src/domain/personalized-sheet/reviewAuditWire.ts';
const wireRows=()=>rows().map(({supported,...r})=>r);
test('wire rejects the old ambiguous boolean field rather than repairing it',()=>assert.throws(()=>decodeReviewAuditWire(rows()),/invalid_copy_audit/));
test('wire issue remains unchanged and alone determines support',()=>{
 const a=wireRows();a[0].issue='other';a[0].personalFactIds=[];const out:any=decodeReviewAuditWire(a);
 assert.equal(out[0].supported,false);assert.equal(out[0].issue,'other');assert.deepEqual(out[0].personalFactIds,[]);
 assert.equal(validateCopyAudit(i,p,out)[0].supported,false);
});
test('compact schema still relies on runtime to reject point-inappropriate references',()=>{
 const a=wireRows();a[3].personalFactIds=['sunscreen-finish'];assert.equal(matches(buildReviewAuditWireSchema(i,p),a),true);assert.throws(()=>validateCopyAudit(i,p,decodeReviewAuditWire(a)),/copy_audit_citation_mismatch/);
});
test('bound wire schema rejects issue none without references',()=>{
 const a=wireRows();a[2].personalFactIds=[];assert.equal(matches(buildReviewAuditWireSchema(i,p),a),false);
});
test('bound wire schema permits honest non-none rows without references',()=>{
 const a=wireRows();a[2].personalFactIds=[];a[2].issue='unsupported_instruction';assert.equal(matches(buildReviewAuditWireSchema(i,p),a),true);
});
test('wire decoding never fixes fabricated or duplicate references',()=>{
 for(const refs of [['invented'],['current-benefit','current-benefit']]){const a=wireRows();a[0].personalFactIds=refs;assert.throws(()=>validateCopyAudit(i,p,decodeReviewAuditWire(a)),/invalid_copy_audit_reference/);}
});
test('wire schema does not replace exact ordered runtime field coverage',()=>{
 const a=wireRows();[a[0],a[1]]=[a[1],a[0]];assert.equal(matches(buildReviewAuditWireSchema(i,p),a),true);assert.throws(()=>validateCopyAudit(i,p,decodeReviewAuditWire(a)),/invalid_copy_audit/);
});
test('unsupported classification cannot be hidden behind copySupported true',()=>{
 const fieldChecks=wireRows();fieldChecks[2].issue='unsupported_instruction';fieldChecks[2].personalFactIds=[];
 const raw={fieldChecks,actualSupported:true,copySupported:true,personalContextMatched:true,contradicted:false,questionRelevant:false,branches:b.hypothetical.map((o:any)=>({optionId:o.optionId,supported:true,contradicted:false,scopeMatched:true}))};
 assert.throws(()=>prepareBundleReview(i,b,p).parseResponse(raw),/inconsistent_copy_audit/);
 raw.copySupported=false;const review=prepareBundleReview(i,b,p).parseResponse(raw);assert.equal(review.fieldChecks[2].supported,false);
});

import {assembleReviewedBundle} from '../src/domain/personalized-sheet/decisionBundleCopy.ts';
test('wire output becomes a canonical checkpoint that still assembles',()=>{
 const raw={fieldChecks:wireRows(),actualSupported:true,copySupported:true,personalContextMatched:true,contradicted:false,questionRelevant:false,branches:b.hypothetical.map((o:any)=>({optionId:o.optionId,supported:true,contradicted:false,scopeMatched:true}))};
 const prepared=prepareBundleReview(i,b,p),review=prepared.parseResponse(raw);
 assert.equal(review.fieldChecks.every(c=>c.supported),true);
 assert.deepEqual(assembleReviewedBundle(i,b,p,review),p);
 assert.throws(()=>prepared.parseResponse({...raw,fieldChecks:review.fieldChecks}),/invalid_copy_audit/);
 assert.throws(()=>prepared.validateCheckpoint(raw),/invalid_copy_audit/);
 const tampered=structuredClone(review);tampered.fieldChecks[0].issue='other';assert.throws(()=>assembleReviewedBundle(i,b,p,tampered),/invalid_copy_audit/);
});
test('oversized bound review requests fail before a dispatch can be prepared',()=>{
 const large=structuredClone(p);large.headline='H'.repeat(80);large.reason='R'.repeat(360);large.nextStep='N'.repeat(200);
 const point=(n:number)=>({id:`p${n}`,title:'T'.repeat(80),body:String(n)+'B'.repeat(449),personalFactIds:['current-benefit'],evidenceIds:[]});
 large.why=[point(1),point(2),point(3)];large.tradeoffs=[point(4),point(5)];
 // Full Unicode bodies use up to four bytes per character in the request.
 for(const q of [...large.why,...large.tradeoffs])q.body=q.body.replaceAll('B','界');
 const bigInput=structuredClone(i);bigInput.evidence=bigInput.evidence.map(e=>({...e,statement:'界'.repeat(20000)}));
 const bigBundle=structuredClone(b);bigBundle.inputHash=prepareJevDecisionBundle(bigInput).inputHash;
 assert.throws(()=>prepareBundleReview(bigInput,bigBundle,large),/request_budget/);
});
