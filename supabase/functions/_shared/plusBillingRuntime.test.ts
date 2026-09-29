import Stripe from 'npm:stripe@22.0.0';
import {verifyPlusStripeEvent,boundedBody,requirePlusEnabled,requirePurchaseGate,ServiceError} from './plusBillingRuntime.ts';
function assert(value:boolean,message='assertion failed'){if(!value)throw new Error(message);}
async function rejectsCode(run:()=>Promise<unknown>,code:string){
 try{await run();throw new Error('Expected rejection');}catch(error){assert(error instanceof ServiceError&&error.code===code);}
}
const secret='whsec_private_fixture_only';
const stripe=new Stripe('sk_test_private_fixture_only',{httpClient:Stripe.createFetchHttpClient()});
async function signature(body:string,time=Math.floor(Date.now()/1000)){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${time}.${body}`)));
 return `t=${time},v1=${[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}`;
}
const body=JSON.stringify({id:'evt_fixture',object:'event',created:1800000000,type:'invoice.paid',livemode:false,data:{object:{id:'in_fixture'}}});
Deno.test('exact raw body passes real Stripe signature verification',async()=>{
 const event=await verifyPlusStripeEvent(body,await signature(body),stripe,secret,false);assert(event.id==='evt_fixture');
});
Deno.test('tampered body and stale signature fail before event processing',async()=>{
 await rejectsCode(()=>verifyPlusStripeEvent(body+' ',signatureFixture,stripe,secret,false),'INVALID_SIGNATURE');
 await rejectsCode(async()=>verifyPlusStripeEvent(body,await signature(body,Math.floor(Date.now()/1000)-1000),stripe,secret,false),'INVALID_SIGNATURE');
});
const signatureFixture=await signature(body);
Deno.test('valid signature from wrong mode is not accepted',async()=>{
 await rejectsCode(async()=>verifyPlusStripeEvent(body,await signature(body),stripe,secret,true),'INVALID_EVENT');
});
Deno.test('streaming body enforces actual byte cap, not declared content length',async()=>{
 const req=new Request('https://example.test',{method:'POST',body:'123456',headers:{'content-length':'1'}});
 await rejectsCode(()=>boundedBody(req,5),'INVALID_PAYLOAD');
 assert(await boundedBody(new Request('https://example.test',{method:'POST',body:'hé'}),3)==='hé');
});
Deno.test('billing and purchase readiness are default-off and independent',()=>{
 const billing=Deno.env.get('DERIVE_PLUS_BILLING_ENABLED'),gate=Deno.env.get('DERIVE_PLUS_US_STOREFRONT_GATE_READY');
 try{
  Deno.env.delete('DERIVE_PLUS_BILLING_ENABLED');Deno.env.delete('DERIVE_PLUS_US_STOREFRONT_GATE_READY');
  try{requirePlusEnabled();throw new Error('Expected disabled');}catch(e){assert(e instanceof ServiceError&&e.code==='PLUS_BILLING_DISABLED');}
  Deno.env.set('DERIVE_PLUS_BILLING_ENABLED','true');requirePlusEnabled();
  try{requirePurchaseGate();throw new Error('Expected storefront not ready');}catch(e){assert(e instanceof ServiceError&&e.code==='PLUS_BILLING_DISABLED');}
 }finally{
  if(billing===undefined)Deno.env.delete('DERIVE_PLUS_BILLING_ENABLED');else Deno.env.set('DERIVE_PLUS_BILLING_ENABLED',billing);
  if(gate===undefined)Deno.env.delete('DERIVE_PLUS_US_STOREFRONT_GATE_READY');else Deno.env.set('DERIVE_PLUS_US_STOREFRONT_GATE_READY',gate);
 }
});
