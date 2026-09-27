import type { FreeProductEvidenceUpload, PrepareFreeProductEvidenceInput } from '../../contracts/FreeProductEvidence.ts';
import type { FreeProductEvidenceStatus } from '../../services/remote/freeProductEvidence.ts';
import type { ProductPhoto } from './readProductEvidencePhoto.ts';

type Attempt = { requestId: string; target: FreeProductEvidenceUpload; photo: ProductPhoto };
type StatusDependencies = {
  status(input: PrepareFreeProductEvidenceInput): Promise<FreeProductEvidenceStatus>;
  assertOwner(): void;
};

/** One read-only lookup after a failed ACK, never another upload or grant request.
 * Confirms the immutable object and metadata, not a byte digest or authenticity.
 */
export async function reconcileFreeEvidenceUpload(attempt: Attempt, deps: StatusDependencies): Promise<boolean> {
  deps.assertOwner();
  if (attempt.photo.mimeType !== attempt.target.mimeType || attempt.photo.bytes.byteLength <= 0
    || attempt.photo.bytes.byteLength > attempt.target.maxBytes) return false;
  let status: FreeProductEvidenceStatus;
  try {
    status = await deps.status({ requestId: attempt.requestId, role: attempt.target.role, mimeType: attempt.photo.mimeType });
  } catch {
    deps.assertOwner();
    return false;
  }
  deps.assertOwner();
  const actual = status.target;
  return status.uploaded === true && !!actual && actual.bucket === attempt.target.bucket
    && actual.storagePath === attempt.target.storagePath && actual.role === attempt.target.role
    && actual.mimeType === attempt.photo.mimeType && actual.maxBytes === attempt.target.maxBytes
    && status.objectBytes === attempt.photo.bytes.byteLength;
}

/** Optional standalone adapter; copy bytes once so a changing local URI cannot alter a retry. */
export function createImmutableEvidenceUploadAttempt(attempt: Attempt, deps: StatusDependencies & {
  upload(target: FreeProductEvidenceUpload, bytes: ArrayBuffer): Promise<void>;
}) {
  const retained: Attempt = { requestId: attempt.requestId, target: { ...attempt.target },
    photo: { mimeType: attempt.photo.mimeType, bytes: attempt.photo.bytes.slice(0) } };
  let uploaded = false;
  return {
    async upload(): Promise<void> {
      deps.assertOwner();
      if (uploaded) return;
      if (retained.photo.mimeType !== retained.target.mimeType || retained.photo.bytes.byteLength <= 0
        || retained.photo.bytes.byteLength > retained.target.maxBytes) throw new Error('Photo upload failed');
      try {
        await deps.upload(retained.target, retained.photo.bytes);
        deps.assertOwner();
        uploaded = true;
      } catch (error) {
        deps.assertOwner();
        if (await reconcileFreeEvidenceUpload(retained, deps)) { uploaded = true; return; }
        throw error;
      }
    },
  };
}
