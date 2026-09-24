import { prepareFreeProductEvidence, uploadFreeProductEvidence } from '../../services/remote/freeProductEvidence.ts';
import { createCatalogRequestId, resolveCatalogIdentity } from '../../services/productCatalog.ts';
import { createFreeEvidenceProcessor } from './freeEvidenceProcessor.ts';
import { readProductEvidencePhoto } from './readProductEvidencePhoto.ts';

export function createLiveFreeEvidenceProcessor() {
  return createFreeEvidenceProcessor({
    readPhoto: readProductEvidencePhoto,
    createRequestId: createCatalogRequestId,
    prepare: prepareFreeProductEvidence,
    upload: uploadFreeProductEvidence,
    resolve: resolveCatalogIdentity,
  });
}
