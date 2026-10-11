import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {copyReviewProbe} from '../review/benchmarks/cloud-runner/copy-review-probe.ts';
import {copyAuditFields} from '../src/domain/personalized-sheet/copyClaimAudit.ts';
import evidence from './heavy-settled.json' with {type:'json'};
const wrap=(value:any,model='gemini-3.5-flash-lite')=>new Response(JSON.stringify({modelVersion:model,candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:10,totalTokenCount:20}}));
async function sandbox(fn:()=>Promise<void>){const old=process.cwd(),dir=mkdtempSync(join(tmpdir(),'fresh-copy-review-')),key=process.env.GEMINI_API_KEY,proxy=process.env.NODE_USE_ENV_PROXY;process.chdir(dir);process.env.GEMINI_API_KEY='fake-test-secret';process.env.NODE_USE_ENV_PROXY='1';try{await fn();}finally{process.chdir(old);if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;if(proxy===undefined)delete process.env.NODE_USE_ENV_PROXY;else process.env.NODE_USE_ENV_PROXY=proxy;rmSync(dir,{recursive:true,force:true});}}
test('fresh copy then bound review makes exactly two calls and refuses replay',async()=>sandbox(async()=>{
 const proposal:any=structuredClone(evidence.checkpoints.find(c=>c.phase==='copy')!.value);
 // A synthetic mock response, not a modification of retained live evidence.
 proposal.why[0].personalFactIds.push('current-benefit');let calls=0;
 const fetcher:any=async(_url:any,init:any)=>{calls++;if(calls===1)return wrap(proposal);
  const ctx=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);assert.deepEqual(ctx.proposal,proposal);
  const fieldChecks=copyAuditFields(proposal).map(f=>{const m=/^(why|tradeoffs)\.(\d+)\./.exec(f.field);const pt=m?proposal[m[1]][Number(m[2])]:null;return {...f,issue:'none',evidenceIds:pt?.evidenceIds??[],personalFactIds:pt?.personalFactIds??['current-benefit']};});
  return wrap({fieldChecks,actualSupported:true,copySupported:true,personalContextMatched:true,contradicted:false,questionRelevant:true,branches:ctx.bundle.hypothetical.map((b:any)=>({optionId:b.optionId,supported:true,contradicted:false,scopeMatched:true}))});};
 const out=await copyReviewProbe(fetcher);assert.equal(calls,2);assert.deepEqual(out.phases.map((p:any)=>p.outcome),['parsed','parsed']);assert.ok(out.score);
 await assert.rejects(()=>copyReviewProbe(fetcher),/EEXIST/);assert.equal(calls,2);
}));
test('copy rejection prevents review dispatch',async()=>sandbox(async()=>{let calls=0;const out=await copyReviewProbe((async()=>{calls++;return wrap({bad:true});}) as any);assert.equal(calls,1);assert.equal(out.score,null);assert.equal(out.phases[0].outcome,'invalid_bundle_copy');}));
test('wrong provider model prevents review dispatch',async()=>sandbox(async()=>{let calls=0;const out=await copyReviewProbe((async()=>{calls++;return wrap({},'wrong-model');}) as any);assert.equal(calls,1);assert.equal(out.phases[0].outcome,'invalid_response');}));
import {createFrameWriter} from '../review/benchmarks/cloud-runner/frame-log.ts';
test('a failed durable review checkpoint cannot produce an admitted score',async()=>sandbox(async()=>{
 const proposal:any=structuredClone(evidence.checkpoints.find(c=>c.phase==='copy')!.value);proposal.why[0].personalFactIds.push('current-benefit');let calls=0;
 const fetcher:any=async(_u:any,init:any)=>{calls++;if(calls===1)return wrap(proposal);const ctx=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
 const fieldChecks=copyAuditFields(proposal).map(f=>{const m=/^(why|tradeoffs)\.(\d+)\./.exec(f.field);const pt=m?proposal[m[1]][Number(m[2])]:null;return {...f,issue:'none',evidenceIds:pt?.evidenceIds??[],personalFactIds:pt?.personalFactIds??['current-benefit']};});
 return wrap({fieldChecks,actualSupported:true,copySupported:true,personalContextMatched:true,contradicted:false,questionRelevant:true,branches:ctx.bundle.hypothetical.map((b:any)=>({optionId:b.optionId,supported:true,contradicted:false,scopeMatched:true}))});};
 const factory:any=(...args:any[])=>{const w=(createFrameWriter as any)(...args);return {...w,write(frame:any){if(frame.kind==='checkpoint'&&frame.phase==='review')throw Error('disk failure');return w.write(frame);}};};
 const out=await copyReviewProbe(fetcher,factory);assert.equal(calls,2);assert.equal(out.score,null);assert.notEqual(out.phases[1].outcome,'parsed');
}));
