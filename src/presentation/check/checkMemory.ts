import type { FreeContextRequest } from '../../contracts/FreeContext.ts';
import type { ProductResolutionResult } from '../../contracts/ProductIdentityResolver.ts';
import type { ShellPresentation } from '../../utils/shellPresentation.ts';

type CheckRequest = Extract<FreeContextRequest, { operation: 'record_check' }>;
type SaveStatus = 'unavailable' | 'idle' | 'saving' | 'saved' | 'failed';

export function validateCheckResolution(result: ProductResolutionResult, knownProductId?: string): ProductResolutionResult {
  if (knownProductId && result.product && result.product.productId !== knownProductId) {
    throw new Error('Catalog and resolver identities disagree');
  }
  return result;
}

export function selectSavableCheckCaseId(input: {
  caseId: string | null;
  liveOwner: string | null;
  resultOwner: string | null;
  hasError: boolean;
}): string | null {
  return input.caseId && input.liveOwner && input.resultOwner === input.liveOwner && !input.hasError
    ? input.caseId : null;
}

export function selectFreeCheckOwner(input: {
  shell: ShellPresentation;
  authStatus: 'INITIALIZING' | 'SIGNED_OUT' | 'SIGNED_IN';
  sessionUserId: string | null;
  accessStatus: string;
  accessUserId: string | null;
  accessOwnerId: string | null;
}): string | null {
  const ownerId = input.sessionUserId;
  return input.shell === 'local_free_integration' && input.authStatus === 'SIGNED_IN'
    && ownerId && input.accessStatus === 'READY'
    && input.accessUserId === ownerId && input.accessOwnerId === ownerId ? ownerId : null;
}

/** One customer action per owner and shown scan case. A failed response keeps its request ID for retry. */
export function createCheckMemorySaver(
  record: (request: CheckRequest) => Promise<unknown>,
  createRequestId: () => string,
) {
  const attempts = new Map<string, { requestId: string; status: Exclude<SaveStatus, 'idle' | 'unavailable'> }>();
  const keyFor = (ownerId: string, caseId: string) => JSON.stringify([ownerId, caseId]);

  return {
    status(ownerId: string | null, caseId: string | null): SaveStatus {
      if (!ownerId || !caseId) return 'unavailable';
      return attempts.get(keyFor(ownerId, caseId))?.status ?? 'idle';
    },
    async save(ownerId: string | null, caseId: string | null): Promise<SaveStatus> {
      if (!ownerId || !caseId) return 'unavailable';
      const key = keyFor(ownerId, caseId);
      let attempt = attempts.get(key);
      if (attempt?.status === 'saving' || attempt?.status === 'saved') return attempt.status;
      if (!attempt) {
        attempt = { requestId: createRequestId(), status: 'saving' };
        attempts.set(key, attempt);
      } else {
        attempt.status = 'saving';
      }
      try {
        await record({ operation: 'record_check', requestId: attempt.requestId, caseId });
        attempt.status = 'saved';
      } catch {
        attempt.status = 'failed';
      }
      return attempt.status;
    },
  };
}
