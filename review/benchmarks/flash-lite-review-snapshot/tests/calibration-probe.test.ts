import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {calibration} from './review-calibration.ts';import {calibrationProbe} from '../review/benchmarks/cloud-runner/calibration-probe.ts';
import {copyAuditFields} from '../src/domain/personalized-sheet/copyClaimAudit.ts';
async function sandbox(fn:()=>Promise<void>){const old=process.cwd(),dir=mkdtempSync(join(tmpdir(),'review-calibration-')),key=process.env.GEMINI_API_KEY,proxy=process.env.NODE_USE_ENV_PROXY;process.chdir(dir);process.env.GEMINI_API_KEY='fake-test-secret';process.env.NODE_USE_ENV_PROXY='1';try{await fn();}finally{process.chdir(old);if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;if(proxy===undefined)delete process.env.NODE_USE_ENV_PROXY;else process.env.NODE_USE_ENV_PROXY=proxy;rmSync(dir,{recursive:true,force:true});}}
test('six frozen controls differ only in target body and do not send expected outcomes',()=>{
 const normalize=(p:any)=>{const x=structuredClone(p);x.why[0].body='TARGET';return x;};
 assert.equal(calibration.length,6);assert.equal(calibration.filter(c=>c.expectedSupported).length,3);
 for(const c of calibration){assert.deepEqual(normalize(c.proposal),normalize(calibration[0].proposal));assert.equal(JSON.stringify(c.prepared.request).includes('expectedSupported'),false);}
});
test('six calls are spaced, scored separately, and cannot be replayed',async()=>sandbox(async()=>{
 let calls=0,time=100000;const starts:number[]=[];
 const fake:any=async(_u:any,init:any)=>{starts.push(time);const c=calibration[calls++],ctx=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
 const fieldChecks=copyAuditFields(c.proposal as any).map(f=>({...f,issue:f.field===c.targetField&&!c.expectedSupported?'other':'none',evidenceIds:[],personalFactIds:f.field===c.targetField&&!c.expectedSupported?[]:['current-feel']}));
 const value={fieldChecks,actualSupported:true,copySupported:c.expectedSupported,personalContextMatched:true,contradicted:false,questionRelevant:true,branches:ctx.bundle.hypothetical.map((b:any)=>({optionId:b.optionId,supported:true,contradicted:false,scopeMatched:true}))};
 return new Response(JSON.stringify({modelVersion:'gemini-3.5-flash-lite',candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:10,totalTokenCount:20}}));};
 const result=await calibrationProbe(fake,async ms=>{time+=ms;},()=>time);assert.equal(calls,6);assert.equal(result.summary.correct,6);assert.equal(result.summary.falsePositives,0);assert.equal(result.summary.falseNegatives,0);assert.equal(result.summary.decisionJudgmentStable,true);for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=25000);
 await assert.rejects(()=>calibrationProbe(fake,async()=>{},()=>time),/EEXIST/);assert.equal(calls,6);
}));
test('rate-limit failure stops the panel and is not counted as a correct rejection',async()=>sandbox(async()=>{
 let calls=0;const result=await calibrationProbe((async()=>{calls++;return new Response('{}',{status:429});}) as any,async()=>{},()=>100000);
 assert.equal(calls,1);assert.equal(result.summary.correct,0);assert.equal(result.summary.transportFailures,1);assert.equal(result.summary.contractFailures,0);assert.equal(result.summary.decisionJudgmentStable,null);assert.equal(result.summary.completed,false);assert.equal(result.results[0].status,429);
}));
