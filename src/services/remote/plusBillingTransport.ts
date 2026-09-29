import { plusBillingAccessSchema,parsePlusBillingLink,plusBillingRequestSchema,type PlusBillingAccess } from '../../contracts/PlusBilling.ts';
export type PlusBillingClient={functions:{invoke:(name:string,options:{body:object})=>Promise<{data:unknown;error:unknown}>}};
export class PlusBillingError extends Error {
 readonly code:string;
 constructor(code:string){super('Plus billing unavailable');this.name='PlusBillingError';this.code=code;}
}
async function invoke(name:string,body:object,client:PlusBillingClient|null):Promise<unknown>{
 if(!client)throw new PlusBillingError('PLUS_BILLING_UNAVAILABLE');
 const result=await client.functions.invoke(name,{body});
 if(result.error){
  const error=result.error as {context?:unknown};
  if(error.context instanceof Response){
   try{
    const packet=await error.context.clone().json() as {code?:unknown};
    if(typeof packet.code==='string'&&['PLUS_BILLING_DISABLED','PERMANENT_ACCOUNT_REQUIRED','PLUS_BILLING_BUSY',
     'PLUS_ALREADY_SUBSCRIBED','PLUS_BILLING_UNAVAILABLE','INVALID_PAYLOAD','UNAUTHORIZED'].includes(packet.code))throw new PlusBillingError(packet.code);
   }catch(parsed){if(parsed instanceof PlusBillingError)throw parsed;}
  }
  throw new PlusBillingError('PLUS_BILLING_UNAVAILABLE');
 }
 return result.data;
}
export function plusBillingTransport(client:PlusBillingClient|null){
 return {
  async access(ownerId:string):Promise<PlusBillingAccess>{
   const packet=plusBillingAccessSchema.parse(await invoke('plus-billing-state',{},client));
   if(packet.ownerId!==ownerId)throw new PlusBillingError('PLUS_OWNER_CHANGED');
   return packet;
  },
  async checkout(requestId:string):Promise<string>{
   return parsePlusBillingLink(await invoke('create-plus-checkout',plusBillingRequestSchema.parse({requestId}),client),'checkout');
  },
  async portal(requestId:string):Promise<string>{
   return parsePlusBillingLink(await invoke('plus-billing-portal',plusBillingRequestSchema.parse({requestId}),client),'portal');
  },
 };
}
