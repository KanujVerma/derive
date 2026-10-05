import { CaptureCommitResultSchema, type CaptureCommitResult } from '../../../src/contracts/PartOne.ts';
import { CapturePrivateCommitRequestSchema, type CapturePrivateCommitRequest } from '../../../src/contracts/PartOnePrivate.ts';
import { PrivateEvidenceContextSchema, evaluatePrivateEvidence, type PrivateEvidenceContext, type PrivateEvidencePorts } from './part-one-private-evidence.ts';
import { normalizeDatabaseDates, PartOneHttpError } from './part-one-runtime.ts';
export interface PrivateCommitPorts {
 ownerId:string;
 operation(action:string,payload:Record<string,unknown>):Promise<unknown>;
 service(action:string,payload:Record<string,unknown>):Promise<unknown>;
 /** Trusted server configuration only. Absent in the deployed-default handler.
  * A caller's review checkbox, role or reviewId never supplies this authority. */
 evidencePorts?(context:PrivateEvidenceContext):Promise<PrivateEvidencePorts>|PrivateEvidencePorts;
}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new PartOneHttpError('invalid_server_projection',500);return value as Record<string,unknown>;}
export async function privateTextHash(text:string):Promise<string>{const bytes=new TextEncoder().encode(text),digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
/** Source persistence is atomically owner-bound and conservatively partial.
 * Reviewed graph admission is a separate CAS over those exact immutable rows.
 * No accepted response reaches the UI before final admission; save does its own CAS. */
export async function commitPrivateCapture(captureSessionId:string,requestInput:CapturePrivateCommitRequest,ports:PrivateCommitPorts):Promise<CaptureCommitResult|Record<string,unknown>> {
 const request=CapturePrivateCommitRequestSchema.parse(requestInput);
 const partial=object(normalizeDatabaseDates(await ports.operation('captures/observations',{captureSessionId,...request})));
 if(partial.conflict===true)return partial;
 const sourceReceipt=CaptureCommitResultSchema.parse(partial);
 if(sourceReceipt.capture.captureSessionId!==captureSessionId.toLowerCase() || sourceReceipt.capture.packageObservationId!==request.packageObservationId.toLowerCase())throw new PartOneHttpError('private_commit_binding_changed',409);
 const prepared=object(normalizeDatabaseDates(await ports.service('review/prepare',{ownerId:ports.ownerId,captureSessionId,idempotencyKey:request.idempotencyKey,reviewId:request.reviewId})));
 if(prepared.conflict===true)return prepared;
 if(prepared.replay)return CaptureCommitResultSchema.parse(prepared.replay);
 const context=PrivateEvidenceContextSchema.parse(prepared.context);
 if(context.ownerId!==ports.ownerId || context.capture.captureSessionId!==captureSessionId.toLowerCase() || context.capture.packageObservationId!==request.packageObservationId.toLowerCase())throw new PartOneHttpError('private_review_binding_changed',409);
 const evidence=ports.evidencePorts?await ports.evidencePorts(context):{hash:privateTextHash};
 const evaluation=await evaluatePrivateEvidence(context,evidence);
 const applied=object(normalizeDatabaseDates(await ports.service(evaluation.capturedSource ? 'source/apply' : 'review/apply',{ownerId:ports.ownerId,captureSessionId,idempotencyKey:request.idempotencyKey,
  reviewId:request.reviewId,sourceCommitId:prepared.sourceCommitId,expectedCaptureRevision:prepared.captureRevision,expectedResultRevision:prepared.resultRevision,
  evaluation,authorityPolicy:evidence.authority?.policy??null})));
 if(applied.conflict===true)return applied;
 return CaptureCommitResultSchema.parse(applied);
}
