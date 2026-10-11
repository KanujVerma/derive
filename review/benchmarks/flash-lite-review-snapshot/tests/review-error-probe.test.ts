import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {probe} from '../review/benchmarks/cloud-runner/review-probe.ts';
test('bounded HTTP error is retained without key and claim prevents a second call',async()=>{
 const old=process.cwd(),key=process.env.GEMINI_API_KEY,proxy=process.env.NODE_USE_ENV_PROXY,dir=mkdtempSync(join(tmpdir(),'review-error-test-'));
 try{
  process.chdir(dir);process.env.GEMINI_API_KEY='fake-test-secret';process.env.NODE_USE_ENV_PROXY='1';let calls=0;
  const fake:any=async()=>{calls++;return new Response(JSON.stringify({error:{code:400,status:'INVALID_ARGUMENT',message:'schema error fake-test-secret'}}).replace('fake-test-secret','\\u0066ake-test-secret'),{status:400});};
  const out=await probe(fake);assert.equal(out.status,400);assert.equal(out.outcome,'http_error');assert.equal(out.errorStatus,'INVALID_ARGUMENT');assert.equal(out.errorMessage,'schema error [REDACTED]');
  const files=readdirSync(dir,{recursive:true}).map(String).filter(p=>p.endsWith('.json'));assert.ok(files.length>=2);
  for(const f of files)assert.equal(readFileSync(join(dir,f),'utf8').includes('fake-test-secret'),false);
  await assert.rejects(()=>probe(fake),/EEXIST/);assert.equal(calls,1);
 }finally{process.chdir(old);if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;if(proxy===undefined)delete process.env.NODE_USE_ENV_PROXY;else process.env.NODE_USE_ENV_PROXY=proxy;rmSync(dir,{recursive:true,force:true});}
});
