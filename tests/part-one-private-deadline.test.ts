import assert from 'node:assert/strict';
import test from 'node:test';
import { createPartOneBoundedFetch } from '../supabase/functions/_shared/part-one-bounded-fetch.ts';
test('private server SDK deadline includes a body that stalls after successful headers',async()=>{
 const call=createPartOneBoundedFetch(async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array([123]));}})),15,100);
 await assert.rejects(call('http://127.0.0.1/synthetic'),/transport_deadline/);
});
test('private server SDK caps actual streamed bytes without trusting Content-Length',async()=>{
 const call=createPartOneBoundedFetch(async()=>new Response(new Uint8Array(101),{headers:{'content-length':'1'}}),1000,100);
 await assert.rejects(call('http://127.0.0.1/synthetic'),/response_too_large/);
});
test('private server SDK preserves complete JSON and rejects pre-cancelled operations',async()=>{
 const call=createPartOneBoundedFetch(async()=>new Response('{"safe":true}',{status:200}),1000,100);
 assert.deepEqual(await(await call('http://127.0.0.1/synthetic')).json(),{safe:true});
 const controller=new AbortController();controller.abort();await assert.rejects(call('http://127.0.0.1/synthetic',{signal:controller.signal}),/deadline/);
});
