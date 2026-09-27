import { prepareFreeProductEvidence, uploadFreeProductEvidence, readFreeProductEvidenceStatus } from '../../services/remote/freeProductEvidence.ts';
import { createCatalogRequestId, resolveCatalogIdentity } from '../../services/productCatalog.ts';
import { createFreeEvidenceProcessor } from './freeEvidenceProcessor.ts';
import { readProductEvidencePhoto } from './readProductEvidencePhoto.ts';
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
