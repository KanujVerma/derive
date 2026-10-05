/** Serialized actual Edge authentication outage/recovery. Only this task's Auth
 * container may be stopped. RPC counters prove denial before owner SQL. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
const endpoint=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(endpoint!=='http://127.0.0.1:59721'||process.env.PART_ONE_DB_CONTAINER!=='supabase_db_derive-check-part-three-integration'||!process.env.PART_ONE_DOCKER_CONFIG)throw Error('Exact isolated integration stack required');
const authContainer='supabase_auth_derive-check-part-three-integration';
const run=args=>new Promise((resolve,reject)=>{const p=spawn('/opt/homebrew/bin/docker',['--config',process.env.PART_ONE_DOCKER_CONFIG,...args]);let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.once('error',reject);p.once('close',c=>c===0?resolve(out.trim()):reject(Error('Task-owned Docker operation failed')));});
const sql=q=>run(['exec',process.env.PART_ONE_DB_CONTAINER,'psql','-U','postgres','-d','postgres','-Atq','-v','ON_ERROR_STOP=1','-c',q]);
const client=createClient(endpoint,anon,{auth:{persistSession:false,autoRefreshToken:false}}),admin=createClient(endpoint,key,{auth:{persistSession:false,autoRefreshToken:false}});
let owner,token,stopped=false,checks=0;
const endpointOutcomes=[];
const outcome=(phase,path,r)=>endpointOutcomes.push({phase,path,status:r.status,code:typeof r.body?.code==='string'?r.body.code:null});
const check=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const requests=[['part-one/scans',{}],['part-two/normalize',{}],['part-three',{operation:'list_saved'}],['personal-context',{operation:'read_context_v2'}]];
async function request(path,body,credential){const r=await fetch(endpoint+'/functions/v1/'+path,{method:'POST',headers:{apikey:anon,'content-type':'application/json',...(credential?{authorization:'Bearer '+credential}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});return {status:r.status,body:await r.json()};}
const rpcCount=()=>sql("select coalesce(sum(calls),0)::text from extensions.pg_stat_statements where query ~ '(part_one_(operation|worker)|part_two_(operation|worker|resolve)|part_three_worker|read_personal_context_v2|save_personal_context_setup|delete_personal_context_record)' and query not like '%pg_stat_statements%';");
try{
 const {data,error}=await client.auth.signInAnonymously();if(error)throw Error('Synthetic anonymous Auth failed');owner=data.user.id;token=data.session.access_token;
 const beforeInvalid=await rpcCount();
 for(const [path,body]of requests){const missing=await request(path,body,null);outcome('missing_bearer',path,missing);check(missing.status,401,path+' missing bearer');const invalid=await request(path,body,'not-a-jwt');outcome('invalid_bearer',path,invalid);check([401,403].includes(invalid.status),true,path+' explicit invalid bearer remains unauthorized/forbidden');}
 check(await rpcCount(),beforeInvalid,'Missing and invalid bearer perform zero owner-scoped RPCs');
 const before=await rpcCount();
 await run(['stop','--time','5',authContainer]);stopped=true;
 for(const [path,body]of requests){const r=await request(path,body,token);outcome('auth_outage',path,r);check(r.status,503,path+' Auth transport outage remains retryable');check(r.body.code,'auth_unavailable',path+' shares classifier');}
 check(await rpcCount(),before,'Auth outage performs zero owner-scoped RPCs');
 await run(['start',authContainer]);stopped=false;
 let healthy=false;for(let n=0;n<30;n++){const r=await fetch(endpoint+'/auth/v1/health',{headers:{apikey:anon}}).catch(()=>null);if(r?.ok){healthy=true;break;}await new Promise(r=>setTimeout(r,250));}check(healthy,true,'Own Auth recovers');
 for(const [path,body]of requests){const r=await request(path,body,token);outcome('recovered_retry',path,r);check([401,403,503].includes(r.status),false,path+' legitimate retry reaches its own operation');}
 check((await request('personal-context',{operation:'read_context_v2'},token)).status,200,'Actual context retry succeeds');
 console.log(JSON.stringify({suite:'combined-four-entrypoint-auth-outage',checks,status:'passed',actualAuthEdgeSql:true,zeroOwnerRpcBeforeAuthentication:true,zeroOwnerRpcDuringOutage:true,endpointOutcomes,synthetic:true}));
}finally{
 if(stopped)await run(['start',authContainer]);
 if(owner){const removed=await admin.auth.admin.deleteUser(owner);if(removed.error)throw Error('Synthetic Auth cleanup failed');}
}
