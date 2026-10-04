import test from 'node:test';
import assert from 'node:assert/strict';
const moduleUrl=new URL('../supabase/functions/_shared/part-one-pinned-transport.ts',import.meta.url);
async function transport(){try{return (await import(moduleUrl.href)).createOpenBeautyFactsTransport();}catch(e){if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return null;throw e;}}
test('ordinary OBF transport rejects rebinding and unapproved destinations before opening a socket',async()=>{
 const t=await transport();assert.ok(t);
 const options={method:'GET' as const,headers:{Accept:'application/json','User-Agent':'Synthetic'},redirect:'manual' as const,signal:new AbortController().signal,resolvedAddresses:['93.184.216.34']};
 for(const url of ['http://world.openbeautyfacts.org/cgi/search.pl','https://world.openbeautyfacts.org.evil.test/','https://user:secret@world.openbeautyfacts.org/','https://world.openbeautyfacts.org:444/','https://world.openbeautyfacts.org/#fragment'])await assert.rejects(t.fetch(url,options));
 for(const resolvedAddresses of [[],['127.0.0.1'],['::1'],['93.184.216.34','10.0.0.1']])await assert.rejects(t.fetch('https://world.openbeautyfacts.org/cgi/search.pl',{...options,resolvedAddresses}));
 await assert.rejects(t.resolve('metadata.internal',options.signal));
});

import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
test('Edge compatibility keeps TLS hostname while connecting only to the validated literal IP',async()=>{
 const external=createRequire(moduleUrl),calls:any[]=[],sockets:any[]=[];
 const fakeRequest=(options:any,reply:any)=>{calls.push(options);options.createConnection?.();
  queueMicrotask(()=>reply({headers:{'content-type':'application/json'},statusCode:204,destroy(){}}));
  return {once(){return this;},end(){}};};
 const output=ts.transpileModule(readFileSync(moduleUrl,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports:any={};
 new Function('require','exports','globalThis',output)((id:string)=>id==='node:https'?{request:fakeRequest}:id==='node:net'?{createConnection:(options:any)=>{sockets.push(options);return {once(){return this;}};}}:external(id),exports,{Deno:{version:{deno:'synthetic-edge'}}});
 const result=await exports.createOpenBeautyFactsTransport().fetch('https://world.openbeautyfacts.org/cgi/search.pl',{method:'GET',headers:{'User-Agent':'Synthetic'},redirect:'manual',signal:new AbortController().signal,resolvedAddresses:['93.184.216.34']});
 assert.equal(result.status,204);assert.equal(calls[0].hostname,'world.openbeautyfacts.org');assert.equal(calls[0].servername,'world.openbeautyfacts.org');assert.equal(calls[0].rejectUnauthorized,true);assert.equal(calls[0].agent,undefined);assert.deepEqual(sockets,[{host:'93.184.216.34',port:443}]);
});

test('an Edge compatibility runtime that ignores the pinned callback cannot send HTTP',async()=>{
 const external=createRequire(moduleUrl);let ended=false,destroyed=false;
 const fakeRequest=()=>({once(){return this;},destroy(){destroyed=true;},end(){ended=true;}});
 const output=ts.transpileModule(readFileSync(moduleUrl,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports:any={};
 new Function('require','exports','globalThis',output)((id:string)=>id==='node:https'?{request:fakeRequest}:external(id),exports,{Deno:{version:{deno:'unsupported-fixture'}}});
 await assert.rejects(exports.createOpenBeautyFactsTransport().fetch('https://world.openbeautyfacts.org/',{method:'GET',headers:{'User-Agent':'Synthetic'},redirect:'manual',signal:new AbortController().signal,resolvedAddresses:['93.184.216.34']}),/pinned_socket_not_used/);
 assert.equal(destroyed,true);assert.equal(ended,false);
});
