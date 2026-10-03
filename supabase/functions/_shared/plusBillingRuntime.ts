import Stripe from 'npm:stripe@22.0.0';
import { createClient,type SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';
import { plusBillingRequestSchema } from '../../../src/contracts/PlusBilling.ts';

export const corsHeaders={
 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
};
export class ServiceError extends Error {
 readonly code:string;readonly status:number;
 constructor(code:string,message:string,status:number){super(message);this.code=code;this.status=status;}
}
export function jsonResponse(body:unknown,status=200):Response{
 return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json',
  'Cache-Control':'private, no-store, max-age=0',Pragma:'no-cache'}});
}
export function errorResponse(error:unknown):Response{
 if(error instanceof ServiceError)return jsonResponse({code:error.code,error:error.message},error.status);
 console.error('Plus billing failed:',error instanceof Error?error.name:'unknown');
 return jsonResponse({code:'PLUS_BILLING_UNAVAILABLE',error:'Plus billing is temporarily unavailable'},503);
}
export async function boundedBody(req:Request,maxBytes:number):Promise<string>{
 const reader=req.body?.getReader();if(!reader)return '';
 const chunks:Uint8Array[]=[];let length=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;
   if(length>maxBytes){await reader.cancel();throw new ServiceError('INVALID_PAYLOAD','Request is too large',413);}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const buffer=new Uint8Array(length);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
 return new TextDecoder('utf-8',{fatal:true}).decode(buffer);
}
export async function readJsonObject(req:Request):Promise<Record<string,unknown>>{
 const body=await boundedBody(req,10_000);
 try{const parsed=JSON.parse(body);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return parsed;}
 catch{throw new ServiceError('INVALID_PAYLOAD','A JSON object is required',400);}
}
export function value(name:string):string {
  const configured=(Deno.env.get(name)??'').trim();
  if(!configured)throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Plus billing is not configured',503);
  return configured;
}
export function requirePlusEnabled():void {
  if(Deno.env.get('DERIVE_PLUS_BILLING_ENABLED')!=='true') {
    throw new ServiceError('PLUS_BILLING_DISABLED','Plus billing is not available yet',503);
  }
}
export function requirePurchaseGate():void {
  requirePlusEnabled();
  if(Deno.env.get('DERIVE_PLUS_US_STOREFRONT_GATE_READY')!=='true') {
    throw new ServiceError('PLUS_BILLING_DISABLED','Plus checkout is not available yet',503);
  }
}
export function expectedLiveMode():boolean {
  const mode=value('DERIVE_PLUS_STRIPE_MODE');
  if(!['test','live'].includes(mode))throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Plus billing is not configured',503);
  return mode==='live';
}
export function stripeClient():Stripe {
  const key=value('STRIPE_SECRET_KEY');
  const prefix=expectedLiveMode()?'sk_live_':'sk_test_';
  if(!key.startsWith(prefix))throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Stripe mode does not match server configuration',503);
  return new Stripe(key,{httpClient:Stripe.createFetchHttpClient(),timeout:20_000,maxNetworkRetries:0});
}
export async function verifyPlusStripeEvent(raw:string,signature:string,stripe:Stripe,secret:string,live:boolean):Promise<Stripe.Event>{
 let event:Stripe.Event;
 try{event=await stripe.webhooks.constructEventAsync(raw,signature,secret,undefined,Stripe.createSubtleCryptoProvider());}
 catch{throw new ServiceError('INVALID_SIGNATURE','Stripe signature could not be verified',400);}
 if(event.livemode!==live)throw new ServiceError('INVALID_EVENT','Stripe mode does not match',400);
 return event;
}
export function plusAdmin():SupabaseClient {
  return createClient(value('SUPABASE_URL'),value('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
}
export function redirect(name:string):string {
  const raw=value(name);let url:URL;
  try{url=new URL(raw);}catch{throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Billing return page is not configured',503);}
  if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Billing return page is not configured',503);
  return url.toString();
}
export async function permanentOwner(req:Request){
  const authorization=req.headers.get('authorization');
  if(!authorization?.startsWith('Bearer '))throw new ServiceError('UNAUTHORIZED','Authentication required',401);
  const userClient=createClient(value('SUPABASE_URL'),value('SUPABASE_ANON_KEY'),{
   global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error}=await userClient.auth.getUser();
  if(error||!user)throw new ServiceError('UNAUTHORIZED','Invalid or expired session',401);
  if(user.is_anonymous!==false||!user.email||!user.email_confirmed_at) {
    throw new ServiceError('PERMANENT_ACCOUNT_REQUIRED','Sign in with a verified account before buying Plus',403);
  }
  return {user,admin:plusAdmin()};
}
export async function requestId(req:Request):Promise<string>{
  try{return plusBillingRequestSchema.parse(await readJsonObject(req)).requestId;}
  catch{throw new ServiceError('INVALID_PAYLOAD','A request ID is required',400);}
}
export async function rpc(admin:SupabaseClient,name:string,params:Record<string,unknown>):Promise<unknown>{
  const {data,error}=await admin.rpc(name,params);
  if(error)throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Plus billing could not be synchronized',503);
  return data;
}
export async function acquire(admin:SupabaseClient,userId:string):Promise<string>{
  const token=crypto.randomUUID();
  if(await rpc(admin,'acquire_plus_billing_lease',{p_user_id:userId,p_token:token})!==true) {
    throw new ServiceError('PLUS_BILLING_BUSY','Billing is updating. Try again shortly.',503);
  }
  return token;
}
export async function release(admin:SupabaseClient,userId:string,token:string):Promise<void>{
  await rpc(admin,'release_plus_billing_lease',{p_user_id:userId,p_token:token});
}
export async function customerBinding(admin:SupabaseClient,userId:string):Promise<string|null>{
  const {data,error}=await admin.from('plus_billing_customers').select('stripe_customer_id').eq('user_id',userId).maybeSingle();
  if(error)throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Billing account could not be read',503);
  return data?.stripe_customer_id??null;
}
export async function allowedPrice(stripe:Stripe):Promise<string>{
  const id=value('STRIPE_PLUS_PRICE_ID');
  if(!/^price_[A-Za-z0-9]+$/.test(id))throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Plus price is not configured',503);
  const price=await stripe.prices.retrieve(id);
  if(!price.active||price.livemode!==expectedLiveMode()||price.currency!=='usd'||price.unit_amount!==499
    ||price.type!=='recurring'||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1
    ||price.recurring?.usage_type!=='licensed'||price.transform_quantity!==null) {
    throw new ServiceError('PLUS_BILLING_UNAVAILABLE','Plus requires the configured monthly price',503);
  }
  return id;
}
