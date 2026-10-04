import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {ScanResultSchema} from '../src/contracts/PartOne.ts';
const owner='00000000-0000-4000-8000-000000000910',scanId='00000000-0000-4000-8000-000000000911';
function entryFixture(){
 const index=new URL('../supabase/functions/part-one/index.ts',import.meta.url),nativeRequire=createRequire(index);
 const env:Record<string,string>={SUPABASE_URL:'https://snojlbqovlawewwqbviz.supabase.co',SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',DERIVE_CHECK_RELEASE:'derive-original-personal-v1',DERIVE_OBF_SOURCE_RELEASE:'derive-obf-public-content-v1'};
 let handler!:(r:Request)=>Promise<Response>,fetches=0,authValid=true;const background:Promise<unknown>[]=[],rpcCalls:Array<{service:boolean;action:string;payload:Record<string,unknown>}>=[];
 const result=ScanResultSchema.parse({schemaVersion:1,requestId:owner,scanId,generation:0,resultRevision:1,identity:'pending',itemId:null,candidateIds:[],snapshotId:null,declarationId:null,declarationState:'none',scope:null,packageConfirmation:'unconfirmed',work:'queued',jobId:owner,subscriptionId:null,reasonCodes:[],nextCheckAfter:null,conflictIds:[],evidenceIds:[],allowedActions:['rescan','retry'],freshness:{observedAt:null,expiresAt:null,state:'unknown'},display:{resultRevision:1,selectedIdentity:null,candidates:[],sections:[],sources:[],limitations:[]}});
 const createClient=(_url:string,key:string)=>({auth:{getUser:async()=>({data:{user:authValid?{id:owner}:null},error:authValid?null:{status:401}})},rpc:async(_name:string,p:{p_action:string;p_payload:Record<string,unknown>})=>{
  rpcCalls.push({service:key==='synthetic-service',action:p.p_action,payload:p.p_payload});
  if(p.p_action==='public/policy')return {data:{allowed:true,policyVersion:'derive-obf-public-content-v1',expiresAt:'2027-01-04T00:00:00.000Z'},error:null};
  if(p.p_action==='public/budget')return {data:{allowed:true},error:null};if(p.p_action==='claim')return {data:{job:null},error:null};
  return {data:p.p_action==='scans/read'?result:{},error:null};
 }});
 const transport={pinsResolvedAddresses:true,resolve:async()=>['93.184.216.34'],fetch:async()=>{fetches++;return new Response(JSON.stringify({products:[{code:'3606000537538',product_name:'Synthetic public lotion',brands:'Fixture'}]}),{headers:{'content-type':'application/json'}});}};
 const output=ts.transpileModule(readFileSync(index,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 // Run the exact entrypoint and real handler/services. Replace only SDK I/O,
 // transport I/O, env and lifetime registration; no Auth/SQL/TLS is claimed.
 new Function('require','exports','Deno','EdgeRuntime',output)(
  (specifier:string)=>specifier==='npm:@supabase/supabase-js@2.116.0'?{createClient}:specifier==='../_shared/part-one-pinned-transport.ts'?{createOpenBeautyFactsTransport:()=>transport}:nativeRequire(specifier),{},
  {env:{get:(name:string)=>env[name]},serve:(fn:typeof handler)=>{handler=fn;}},{waitUntil:(work:Promise<unknown>)=>{background.push(work);}});
 return {handler,env,rpcCalls,background,denyAuth:()=>{authValid=false;},get fetches(){return fetches;}};
}
const request=(path:string,method='GET',body?:unknown)=>new Request('https://derive.invalid/functions/v1/part-one'+path,{method,headers:{authorization:'Bearer synthetic'},...(body?{body:JSON.stringify(body)}:{})});
test('actual ordinary entrypoint wires search and one bounded background claim after an authorized scan poll',async()=>{
 const f=entryFixture();assert.equal((await f.handler(request('/search','POST',{query:'Synthetic lotion'}))).status,200);assert.equal(f.fetches,1);assert.equal(f.background.length,0);
 assert.equal((await f.handler(request('/scans/'+scanId))).status,202);assert.equal(f.background.length,1);await Promise.all(f.background);
 assert.equal(f.rpcCalls.filter(c=>c.action==='claim').length,1);assert.ok(f.rpcCalls.find(c=>c.action==='scans/read'&&!c.service));assert.ok(f.rpcCalls.find(c=>c.action==='claim'&&c.service));
});
test('actual entrypoint source selection and Auth refusal perform no provider work or background claim',async()=>{
 for(const blocked of ['source','project','auth']){const f=entryFixture();if(blocked==='source')delete f.env.DERIVE_OBF_SOURCE_RELEASE;if(blocked==='project')f.env.SUPABASE_URL='https://other.supabase.co';if(blocked==='auth')f.denyAuth();
 const response=await f.handler(request('/search','POST',{query:'Synthetic lotion'}));assert.equal(response.status,blocked==='auth'?401:503);assert.equal(f.fetches,0);assert.equal(f.background.length,0);assert.equal(f.rpcCalls.some(c=>c.service),false);}
});
