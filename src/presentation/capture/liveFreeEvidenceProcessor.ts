import { prepareFreeProductEvidence, uploadFreeProductEvidence, readFreeProductEvidenceStatus } from '../../services/remote/freeProductEvidence.ts';
import { createCatalogRequestId, resolveCatalogIdentity, continueCatalogIngredients } from '../../services/productCatalog.ts';
import { createFreeEvidenceProcessor } from './freeEvidenceProcessor.ts';
import { readProductEvidencePhoto } from './readProductEvidencePhoto.ts';
import { createIngredientContinuationProcessor } from './ingredientContinuationProcessor.ts';
import { useAuthStore } from '../../stores/authStore';

export function createLiveFreeEvidenceProcessor() {
  return createFreeEvidenceProcessor({
    getOwnerId: () => {
      const auth = useAuthStore.getState();
      return auth.status === 'SIGNED_IN' ? auth.sessionUserId : null;
    },
    readPhoto: readProductEvidencePhoto,
    createRequestId: createCatalogRequestId,
    prepare: prepareFreeProductEvidence,
    upload: uploadFreeProductEvidence,
    status: readFreeProductEvidenceStatus,
    resolve: resolveCatalogIdentity,
  });
}

/** Capture remains bound to the displayed owner/case/snapshot until the child is returned. */
export function createLiveIngredientContinuationProcessor(action: import('../check/result-sheet/model').RequestedEvidenceAction,
  isCurrent: () => boolean) {
  return createIngredientContinuationProcessor(action, isCurrent, {
    getOwnerId: () => {
      const auth = useAuthStore.getState();
      return auth.status === 'SIGNED_IN' ? auth.sessionUserId : null;
    },
    readPhoto: readProductEvidencePhoto, createRequestId: createCatalogRequestId,
    prepare: prepareFreeProductEvidence, upload: uploadFreeProductEvidence, status: readFreeProductEvidenceStatus,
    continueIngredients: continueCatalogIngredients,
  });
}
