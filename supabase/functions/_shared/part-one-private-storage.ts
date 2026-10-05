import {PartOneHttpError,rpcErrorToHttp,normalizeDatabaseDates} from './part-one-runtime.ts';
import {verifyPrivateJpeg,PrivateImageError,PART_ONE_MAX_UPLOAD_BYTES} from './part-one-jpeg.ts';

export interface PrivateUploadBinding {
 captureSessionId:string;packageObservationId:string;idempotencyKey:string;evidenceId:string;
 expectedGeneration:number;expectedResultRevision:number;expectedCaptureRevision:number;expectedDeletionEpoch:number;
}
export interface PrivateStorageObject {id:string;version:string;size:number}
/** Only the server's approved private Storage client is injected. Customer
 * bucket insert/update/list permissions remain closed. Object paths never reuse. */
export interface PrivateStoragePorts {
 upload(bucket:string,name:string,bytes:Uint8Array,options:{contentType:'image/jpeg';upsert:false;signal:AbortSignal}):Promise<void>;
 inspect(bucket:string,name:string):Promise<PrivateStorageObject|null>;
 remove(bucket:string,name:string,expected:{id:string;version:string}):Promise<void>;
 sign(bucket:string,name:string,seconds:number):Promise<string>;
}
export interface PrivateUploadPorts {
 ownerId:string;
 operation(action:string,payload:Record<string,unknown>):Promise<unknown>;
 service(action:string,payload:Record<string,unknown>):Promise<unknown>;
 storage:PrivateStoragePorts;
 now?:()=>number;
}
function object(input:unknown):Record<string,unknown>{if(!input||typeof input!=='object'||Array.isArray(input))throw new PartOneHttpError('invalid_server_projection',500);return input as Record<string,unknown>;}
function conflict(input:Record<string,unknown>):void{if(input.conflict===true)throw new PartOneHttpError(String(input.code??'operation_conflict'),409);}
async function digest(bytes:Uint8Array):Promise<string>{const hash=await crypto.subtle.digest('SHA-256',new Uint8Array(bytes));return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
async function boundedBytes(request:Request):Promise<Uint8Array>{
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='image/jpeg')throw new PartOneHttpError('jpeg_required',415);
 const length=Number(request.headers.get('content-length'));
 if(Number.isFinite(length)&&length>PART_ONE_MAX_UPLOAD_BYTES)throw new PartOneHttpError('payload_too_large',413);
 const reader=request.body?.getReader();if(!reader)throw new PartOneHttpError('invalid_payload',400);
 const chunks:Uint8Array[]=[];let total=0;
 const timeout=new AbortController();const timer=setTimeout(()=>timeout.abort(),15000);
 let rejectAbort:(error:Error)=>void=()=>{};const timed=()=>rejectAbort(new PartOneHttpError('upload_timeout',408));const cancelled=()=>rejectAbort(new PartOneHttpError('upload_cancelled',409));
 const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject;timeout.signal.addEventListener('abort',timed,{once:true});request.signal.addEventListener('abort',cancelled,{once:true});});
 try{
  if(request.signal.aborted)throw new PartOneHttpError('upload_cancelled',409);
  while(true){const {done,value}=await Promise.race([reader.read(),aborted]);if(done)break;total+=value.byteLength;
   if(total>PART_ONE_MAX_UPLOAD_BYTES)throw new PartOneHttpError('payload_too_large',413);chunks.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
 }catch(error){void reader.cancel().catch(()=>{});throw error;}finally{clearTimeout(timer);timeout.signal.removeEventListener('abort',timed);request.signal.removeEventListener('abort',cancelled);reader.releaseLock();}
}
/** Gate/owner check before reading bytes; actual byte hash/dimensions and trusted
 * decoder output, never client metadata claims, form the sanitation receipt. */
export async function uploadPrivateDerivative(request:Request,binding:PrivateUploadBinding,ports:PrivateUploadPorts):Promise<unknown>{
 const authorized=object(await ports.operation('captures/upload-authorize',binding as unknown as Record<string,unknown>));conflict(authorized);
 const bytes=await boundedBytes(request);let dimensions:{width:number;height:number};
 try{dimensions=verifyPrivateJpeg(bytes);}catch(error){if(error instanceof PrivateImageError)throw new PartOneHttpError(error.code,error.code==='payload_too_large'?413:422);throw error;}
 const contentHash=await digest(bytes);
 const ticket=object(await ports.operation('captures/upload-reserve',{...binding,contentHash,...dimensions,byteLength:bytes.length}));conflict(ticket);
 if(ticket.replay)return normalizeDatabaseDates(ticket.replay);
 if(typeof ticket.ticketId!=='string'||typeof ticket.bucketId!=='string'||typeof ticket.objectName!=='string')throw new PartOneHttpError('invalid_server_projection',500);
 const key={ticketId:ticket.ticketId,ownerId:ports.ownerId};
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
 const cancel=()=>controller.abort();request.signal.addEventListener('abort',cancel,{once:true});
 try{
  const permit=object(await ports.service('upload/dispatch',key));conflict(permit);
  if(permit.allowed!==true)throw new PartOneHttpError('upload_cancelled',409);
  await ports.storage.upload(ticket.bucketId,ticket.objectName,bytes,{contentType:'image/jpeg',upsert:false,signal:controller.signal});
  const result=object(await ports.service('upload/attest',{...key,contentHash,...dimensions,byteLength:bytes.length,sanitizerVersion:'part-one-jpeg-verified-1'}));
  // Rejection after Storage success queues deletion in that same DB transaction.
  conflict(result);return normalizeDatabaseDates(result);
 }catch(error){
  await ports.service('upload/abort',{...key,reason:controller.signal.aborted?'transport_unknown':'upload_failed'}).catch(()=>{});
  if(error instanceof PartOneHttpError)throw error;
  throw new PartOneHttpError('private_upload_unavailable',503);
 }finally{clearTimeout(timer);request.signal.removeEventListener('abort',cancel);}
}
export interface PrivateCleanupPorts {
 service(action:string,payload:Record<string,unknown>):Promise<unknown>;
 storage:Pick<PrivateStoragePorts,'inspect'|'remove'>;
}
/** A service-only consumer deletes actual bytes and acknowledges only after a
 * fresh absence check. Expected version never deletes a replacement object. */
export async function consumePrivateCleanupOnce(ports:PrivateCleanupPorts):Promise<{claimed:boolean;deleted?:boolean;blocked?:boolean}>{
 const claimed=object(await ports.service('cleanup/claim',{}));if(!claimed.claim)return{claimed:false};
 const claim=object(claimed.claim);const key={objectId:claim.objectId,leaseToken:claim.leaseToken};
 if(typeof claim.bucketId!=='string'||typeof claim.objectName!=='string'||typeof claim.objectVersion!=='string'||typeof claim.objectId!=='string')throw new PartOneHttpError('invalid_server_projection',500);
 try{
  const current=await ports.storage.inspect(claim.bucketId,claim.objectName);
  if(current&&(current.id!==claim.objectId||current.version!==claim.objectVersion)){
   await ports.service('cleanup/blocked',{...key,reason:'storage_version_changed'});return{claimed:true,blocked:true};
  }
  const permit=object(await ports.service('cleanup/dispatch',key));if(permit.allowed!==true)return{claimed:true,blocked:true};
  if(current)await ports.storage.remove(claim.bucketId,claim.objectName,{id:claim.objectId,version:claim.objectVersion});
  const after=await ports.storage.inspect(claim.bucketId,claim.objectName);
  if(after){await ports.service('cleanup/retry',{...key,reason:'storage_not_absent'});return{claimed:true,deleted:false};}
  const acknowledged=object(await ports.service('cleanup/ack',key));return{claimed:true,deleted:acknowledged.deleted===true};
 }catch{await ports.service('cleanup/retry',{...key,reason:'storage_outcome_unknown'});return{claimed:true,deleted:false};}
}
/** SQL performs owner/lifecycle filtering before exposing any locator. Short
 * signed access remains private and cannot outlive current evidence rights. */
export async function recoverPrivateCapture(captureSessionId:string,ports:Pick<PrivateUploadPorts,'operation'|'storage'|'now'>):Promise<unknown>{
 const recovered=object(normalizeDatabaseDates(await ports.operation('captures/evidence',{captureSessionId})));conflict(recovered);
 if(!Array.isArray(recovered.assets))throw new PartOneHttpError('invalid_server_projection',500);
 const now=ports.now?.()??Date.now();const assets:Array<Record<string,unknown>>=[];
 for(const value of recovered.assets){const entry=object(value);const locator=object(entry.storage);const asset=object(entry.asset);
  const expires=Date.parse(String(entry.expiresAt));const seconds=Math.min(60,Math.floor((expires-now)/1000));
  if(seconds<1)continue;
  const current=await ports.storage.inspect(String(locator.bucketId),String(locator.objectName));
  if(!current||current.id!==asset.storageObjectId||current.version!==locator.objectVersion)continue;
  const url=await ports.storage.sign(String(locator.bucketId),String(locator.objectName),seconds);
  const {storage,...safe}=entry;assets.push({...safe,signedAccess:{url,expiresAt:new Date(now+seconds*1000).toISOString()}});
 }
 // Signing is an external asynchronous hop: bind a final rights/deletion read
 // so account/capture removal cannot return stale transcripts or signed refs.
 const fresh=object(normalizeDatabaseDates(await ports.operation('captures/evidence',{captureSessionId})));
 conflict(fresh);
 const freshIds=new Set(Array.isArray(fresh.assets)?fresh.assets.map(a=>String(object(a).attestationId)):[]);
 const clean={...fresh,assets:assets.filter(a=>freshIds.has(String(a.attestationId)))};
 return clean;
}
export {rpcErrorToHttp};
