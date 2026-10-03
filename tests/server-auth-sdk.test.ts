import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { authorizeServerUser, authorizeServerIdentity, classifyServerAuthFailure } from '../supabase/functions/_shared/server-auth.ts';
import { createPartOneBoundedFetch } from '../supabase/functions/_shared/part-one-bounded-fetch.ts';
import { handlePartOneRequest, PartOneHttpError } from '../supabase/functions/_shared/part-one-runtime.ts';
import { handlePartTwoRequest, PartTwoHttpError } from '../supabase/functions/_shared/part-two-runtime.ts';

const owner = 'ae000000-0000-4000-8000-000000000001';
const scan = 'ae000000-0000-4000-8000-000000000002';
const result = {schemaVersion:1,requestId:owner,scanId:scan,generation:0,resultRevision:1,
  identity:'pending',itemId:null,candidateIds:[],snapshotId:null,declarationId:null,declarationState:'none',scope:null,
  packageConfirmation:'unconfirmed',work:'deferred_budget',jobId:owner,subscriptionId:null,nextCheckAfter:null,
  display:{resultRevision:1,selectedIdentity:null,candidates:[],sections:[],sources:[],limitations:['Worker unavailable']},
  reasonCodes:['worker_unavailable'],conflictIds:[],evidenceIds:[],allowedActions:['rescan','retry'],
  freshness:{observedAt:null,expiresAt:null,state:'unknown'}};
const userReply = () => Response.json({id:owner,aud:'authenticated',role:'authenticated',
  created_at:'2026-01-01T00:00:00Z',app_metadata:{},user_metadata:{}});

function setup(part: 1 | 2, transport: typeof fetch, deadlineMs = 1000) {
  const client = createClient('http://127.0.0.1:1', 'synthetic-public-key', {
    global:{headers:{Authorization:'Bearer synthetic-test-token'},fetch:createPartOneBoundedFetch(transport,deadlineMs)},
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  });
  let operations = 0, workers = 0, authenticatedOwner: string | null = null;
  async function authorize() {
    authenticatedOwner = await authorizeServerUser(client.auth,(code,status) =>
      part === 1 ? new PartOneHttpError(code,status) : new PartTwoHttpError(code,status));
    return authenticatedOwner;
  }
  async function invoke() {
    return part === 1
      ? handlePartOneRequest(new Request(`http://localhost/part-one/scans/${scan}`), {
        authorize:async()=>{await authorize();},operation:async()=>{operations++;return result;},
      })
      : handlePartTwoRequest(new Request('http://localhost/part-two/saved-details', {
        method:'POST',body:JSON.stringify({saveId:scan,requestId:owner}),
      }), {authorize,operation:async()=>{operations++;return {result:null};},worker:async()=>{workers++;return null;}});
  }
  return {client,invoke,counts:()=>({operations,workers,authenticatedOwner})};
}

for (const part of [1,2] as const) {
  for (const status of [401,403,429,500,502,503,504]) {
    test(`Part ${part}: actual Auth SDK HTTP ${status} is classified before any owner operation`,async()=>{
      const p = setup(part,async()=>Response.json({code:status===401?'bad_jwt':'synthetic_failure',msg:'Synthetic refusal'},{status}));
      const response = await p.invoke();
      assert.equal(response.status,status===401||status===403?status:503);
      assert.deepEqual(await response.json(),{code:status===401?'unauthorized':status===403?'forbidden':'auth_unavailable'});
      assert.deepEqual(p.counts(),{operations:0,workers:0,authenticatedOwner:null});
    });
  }
  test(`Part ${part}: actual SDK network rejection returns 503 and the same client can retry`,async()=>{
    let fail = true, requests = 0;
    const p = setup(part,async(input)=>{assert.match(String(input),/\/auth\/v1\/user$/);requests++;
      if(fail) throw new TypeError('Synthetic offline transport');return userReply();});
    assert.equal((await p.invoke()).status,503);
    assert.deepEqual(p.counts(),{operations:0,workers:0,authenticatedOwner:null});
    fail=false;
    assert.equal((await p.invoke()).status,part===1?202:200);
    assert.deepEqual(p.counts(),{operations:1,workers:0,authenticatedOwner:owner});
    assert.equal(requests,2,'retry performs fresh SDK authentication');
  });
  for (const stalled of ['headers','body'] as const) {
    test(`Part ${part}: actual SDK stalled ${stalled} deadline is retryable, cancels transport and fences owner RPC`,async()=>{
      let fail = true, aborted = false, cancelled = false;
      const p = setup(part,async(_input,init)=>{
        if(!fail)return userReply();
        init?.signal?.addEventListener('abort',()=>{aborted=true;},{once:true});
        if(stalled==='headers')return new Promise<Response>(()=>{});
        return new Response(new ReadableStream<Uint8Array>({
          start(controller){controller.enqueue(new TextEncoder().encode('{'));},
          cancel(){cancelled=true;},
        }),{headers:{'content-type':'application/json'}});
      },25);
      const started = performance.now();
      const response = await p.invoke();
      assert.equal(response.status,503);
      assert.deepEqual(await response.json(),{code:'auth_unavailable'});
      assert.ok(performance.now()-started<1500,'deadline includes unfinished response body');
      assert.equal(aborted,true);
      if(stalled==='body')assert.equal(cancelled,true);
      assert.deepEqual(p.counts(),{operations:0,workers:0,authenticatedOwner:null});
      fail=false;
      assert.equal((await p.invoke()).status,part===1?202:200);
      assert.deepEqual(p.counts(),{operations:1,workers:0,authenticatedOwner:owner});
    });
  }
}

test('missing sessions and users remain unauthorized; unknown upstream errors fail closed as unavailable',async()=>{
  assert.deepEqual(classifyServerAuthFailure({name:'AuthSessionMissingError'}),{code:'unauthorized',status:401});
  assert.deepEqual(classifyServerAuthFailure({name:'AuthRetryableFetchError',status:0}),{code:'auth_unavailable',status:503});
  assert.deepEqual(classifyServerAuthFailure(new Error('Synthetic unexpected failure')),{code:'auth_unavailable',status:503});
  await assert.rejects(authorizeServerUser({getUser:async()=>({data:{user:null},error:null})},
    (code,status)=>new PartOneHttpError(code,status)),(error:unknown)=>error instanceof PartOneHttpError&&error.status===401);
  await assert.rejects(authorizeServerUser({getUser:async()=>{throw new Error('Synthetic thrown transport');}},
    (code,status)=>new PartOneHttpError(code,status)),(error:unknown)=>error instanceof PartOneHttpError&&error.status===503);
});

for (const endpoint of ['part-three','personal-context'] as const) {
  for (const status of [401,403,429,500,503]) {
    test(`${endpoint}: full SDK identity authorization preserves refusal/transient classification and no owner work`,async()=>{
      const p=setup(1,async()=>Response.json({code:'synthetic_failure',msg:'Synthetic Auth failure'},{status}));
      let ownerWork=0;
      await assert.rejects(async()=>{
        await authorizeServerIdentity(p.client.auth,(code,status)=>new PartOneHttpError(code,status));ownerWork++;
      },(error:unknown)=>error instanceof PartOneHttpError&&error.status===(status===401||status===403?status:503));
      assert.equal(ownerWork,0);
    });
  }
  test(`${endpoint}: actual SDK identity retry reauthorizes the full user after an upstream network failure`,async()=>{
    let fail=true,requests=0,ownerWork=0;
    const p=setup(1,async()=>{requests++;if(fail)throw new TypeError('Synthetic unavailable Auth');return userReply();});
    const authorize=async()=>{const u=await authorizeServerIdentity(p.client.auth,(code,status)=>new PartOneHttpError(code,status));ownerWork++;return u;};
    await assert.rejects(authorize,(error:unknown)=>error instanceof PartOneHttpError&&error.status===503);
    assert.equal(ownerWork,0);fail=false;
    const u=await authorize();assert.equal(u.id,owner);assert.equal(u.role,'authenticated');assert.equal(ownerWork,1);assert.equal(requests,2);
  });
}
