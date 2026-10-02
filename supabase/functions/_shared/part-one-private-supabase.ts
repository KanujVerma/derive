import {PartOneHttpError,rpcErrorToHttp} from './part-one-runtime.ts';
import type {PrivateStoragePorts} from './part-one-private-storage.ts';
// Narrow server SDK interface keeps credentials/configuration out of this module.
export interface PrivateStorageClient {
 rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{code?:string;message:string}|null}>;
 storage:{from(bucket:string):{
  upload(name:string,bytes:ArrayBuffer,options:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>;
  remove(names:string[]):PromiseLike<{data:unknown;error:unknown}>;
  createSignedUrl(name:string,seconds:number):PromiseLike<{data:{signedUrl?:string}|null;error:unknown}>;
 }};
}
export function privateService(client:PrivateStorageClient){return async(action:string,payload:Record<string,unknown>):Promise<unknown>=>{
 const {data,error}=await client.rpc('part_one_private_service',{p_action:action,p_payload:payload});
 if(error)throw rpcErrorToHttp(error.code,error.message);return data;
};}
/** Service-only Storage access. No customer bucket grants, path reuse/upsert,
 * public URLs or direct SQL Storage ownership edits are used. */
export function createPrivateStoragePorts(client:PrivateStorageClient):PrivateStoragePorts{
 const service=privateService(client);
 return {
  async upload(bucket,name,bytes,options){
   if(options.signal.aborted)throw new PartOneHttpError('upload_cancelled',409);
   const {error}=await client.storage.from(bucket).upload(name,new Uint8Array(bytes).buffer,{contentType:options.contentType,upsert:false,cacheControl:'0'});
   if(error)throw new PartOneHttpError('storage_upload_failed',503);
   if(options.signal.aborted)throw new PartOneHttpError('upload_outcome_unknown',503);
  },
  async inspect(bucket,name){const data=await service('storage/inspect',{bucketId:bucket,objectName:name});
   if(data===null)return null;
   const value=data as Record<string,unknown>;
   if(typeof value.id!=='string'||typeof value.version!=='string'||typeof value.size!=='number')throw new PartOneHttpError('invalid_storage_projection',503);
   return {id:value.id,version:value.version,size:value.size};
  },
  async remove(bucket,name,expected){
   // Opaque names are never reused and all customer insert/update grants remain
   // closed. Version precheck is repeated immediately before the Storage API.
   const value=await service('storage/delete-authorize',{bucketId:bucket,objectName:name,objectId:expected.id,objectVersion:expected.version}) as Record<string,unknown>;
   if(value.absent===true)return;
   if(value.allowed!==true)throw new PartOneHttpError('storage_version_changed',409);
   const {error}=await client.storage.from(bucket).remove([name]);if(error)throw new PartOneHttpError('storage_delete_failed',503);
  },
  async sign(bucket,name,seconds){
   const value=await service('storage/sign-authorize',{bucketId:bucket,objectName:name}) as Record<string,unknown>;
   if(value.allowed!==true)throw new PartOneHttpError('private_asset_unavailable',409);
   const ttl=Math.min(seconds,Number(value.maxSeconds),60);
   if(!Number.isInteger(ttl)||ttl<1)throw new PartOneHttpError('private_asset_unavailable',409);
   const {data,error}=await client.storage.from(bucket).createSignedUrl(name,ttl);
   if(error||!data?.signedUrl)throw new PartOneHttpError('private_asset_unavailable',503);return data.signedUrl;
  },
 };
}
