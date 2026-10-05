import { z } from 'zod';
import { PartOneIdSchema, SaveRequestSchema, CaptureCommitResultSchema, type CaptureCommitResult, type SaveRequest } from '../contracts/PartOne.ts';
import { CapturePrivateCommitRequestSchema, CaptureRecoverySchema, CaptureUploadReceiptSchema, PrivateCaptureCapabilitySchema, PrivateCaptureListSchema,
  PRIVATE_UPLOAD_MAX_BYTES, privateUploadHeaders, type CapturePrivateCommitRequest, type CaptureRecovery,
  type CaptureUploadBinding, type CaptureUploadReceipt, type PrivateCaptureCapability, type PrivateCaptureSummary } from '../contracts/PartOnePrivate.ts';
import type { PreparedLabelUpload } from './partOneUpload.ts';
export interface PartOnePrivateTransport {
  list(signal?:AbortSignal):Promise<PrivateCaptureSummary[]>;
  capability(signal?:AbortSignal):Promise<PrivateCaptureCapability>;
  upload(captureId:string,binding:CaptureUploadBinding,prepared:PreparedLabelUpload,signal?:AbortSignal):Promise<CaptureUploadReceipt>;
  commit(captureId:string,request:CapturePrivateCommitRequest,signal?:AbortSignal):Promise<CaptureCommitResult>;
  recover(captureId:string,signal?:AbortSignal):Promise<CaptureRecovery>;
  remove(captureId:string,signal?:AbortSignal):Promise<void>;
  saveResult(request:SaveRequest,signal?:AbortSignal):Promise<{saveId:string}>;
}
export class PartOnePrivateConflict extends Error { readonly current:unknown; constructor(current:unknown) { super('Private result revision changed'); this.current=current; } }
export type PrivateInvokeOptions={method:'GET'|'POST'|'DELETE';body?:string|ArrayBuffer;headers?:Record<string,string>;signal?:AbortSignal;timeout:number};
export type PrivateClientPorts={enabled:()=>boolean;invoke:(path:string,options:PrivateInvokeOptions)=>Promise<{data:unknown;error:unknown}>};
export function createPartOnePrivateTransport(ports:PrivateClientPorts):PartOnePrivateTransport {
async function privateCall(path:string,method:'GET'|'POST'|'DELETE',body?:string|Uint8Array,headers?:Record<string,string>,signal?:AbortSignal):Promise<unknown> {
  if(!ports.enabled()) throw new Error('private_capture_disabled');
  if(signal?.aborted) throw new Error('private_capture_cancelled');
  const {data,error}=await ports.invoke(`part-one${path}`,{method,...(body===undefined?{}:{body:body instanceof Uint8Array?new Uint8Array(body).buffer:body}),...(headers?{headers}:{}),...(signal?{signal}:{}),timeout:20000});
  if(signal?.aborted) throw new Error('private_capture_cancelled');
  if(error) {
    if(typeof error==='object' && 'context' in error && error.context instanceof Response) {
      if(error.context.status===409) throw new PartOnePrivateConflict(await error.context.json());
      if(error.context.status===423) throw new Error('private_capture_disabled');
      if(error.context.status===413) throw new Error('private_photo_too_large');
    }
    throw new Error('private_capture_unavailable');
  }
  return data;
}
const canonical=(id:string)=>PartOneIdSchema.parse(id).toLowerCase();
return {
  list:async signal=>PrivateCaptureListSchema.parse(await privateCall('/captures','GET',undefined,undefined,signal)).captures,
  capability:async signal=>PrivateCaptureCapabilitySchema.parse(await privateCall('/private-capability','GET',undefined,undefined,signal)),
  upload:async(id,binding,prepared,signal)=>{
    if(prepared.mimeType!=='image/jpeg'||prepared.bytes.byteLength===0||prepared.bytes.byteLength>PRIVATE_UPLOAD_MAX_BYTES)
      throw new Error('private_photo_too_large');
    const expected=canonical(id), receipt=CaptureUploadReceiptSchema.parse(await privateCall(`/captures/${expected}/assets`,'POST',prepared.bytes,privateUploadHeaders(binding),signal));
    if(receipt.capture.captureSessionId!==expected || receipt.capture.packageObservationId!==canonical(binding.packageObservationId) ||
      receipt.capture.generation!==binding.expectedGeneration || receipt.capture.deletionEpoch!==binding.expectedDeletionEpoch || receipt.asset.evidenceId!==canonical(binding.evidenceId))
      throw new Error('private_upload_binding_changed');
    return receipt;
  },
  commit:async(id,request,signal)=>{
    const expected=canonical(id), valid=CapturePrivateCommitRequestSchema.parse(request);
    const result=CaptureCommitResultSchema.parse(await privateCall(`/captures/${expected}/observations`,'POST',JSON.stringify(valid),{'content-type':'application/json'},signal));
    if(result.capture.captureSessionId!==expected || result.capture.packageObservationId!==canonical(valid.packageObservationId)) throw new Error('private_commit_binding_changed');
    return result;
  },
  recover:async(id,signal)=>{
    const expected=canonical(id),result=CaptureRecoverySchema.parse(await privateCall(`/captures/${expected}/evidence`,'GET',undefined,undefined,signal));
    if(result.capture.captureSessionId!==expected) throw new Error('private_recovery_binding_changed');
    return result;
  },
  remove:async(id,signal)=>{
    const expected=canonical(id),receipt=z.strictObject({deleted:z.literal(true),id:PartOneIdSchema}).parse(await privateCall(`/captures/${expected}`,'DELETE',undefined,undefined,signal));
    if(receipt.id!==expected) throw new Error('private_remove_binding_changed');
  },
  saveResult:async(request,signal)=>z.strictObject({saveId:PartOneIdSchema,snapshotAtSaveId:PartOneIdSchema,captureSessionId:PartOneIdSchema.nullable().optional(),result:z.unknown()}).transform(value=>({saveId:value.saveId}))
    .parse(await privateCall('/saves','POST',JSON.stringify(SaveRequestSchema.parse(request)),{'content-type':'application/json'},signal)),
};
}
