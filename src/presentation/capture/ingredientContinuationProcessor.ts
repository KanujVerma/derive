import type { ContinueProductIngredientsInput, ContinueProductIngredientsResult } from '../../contracts/ProductIdentityResolver.ts';
import type { RequestedEvidenceAction } from '../check/result-sheet/model.ts';
import { createFreeEvidenceProcessor } from './freeEvidenceProcessor.ts';
import type { CaptureEvidence } from './productEvidence.ts';

type Dependencies = Omit<Parameters<typeof createFreeEvidenceProcessor>[0], 'resolve'> & {
  continueIngredients(input: ContinueProductIngredientsInput): Promise<ContinueProductIngredientsResult>;
};

/** The original facts remain immutable. Only the requested ingredient role is uploaded to its owner-bound child. */
export function createIngredientContinuationProcessor(action: RequestedEvidenceAction, isCurrent: () => boolean, deps: Dependencies) {
  const processor = createFreeEvidenceProcessor({ ...deps,
    getOwnerId: () => isCurrent() && deps.getOwnerId?.() === action.binding.ownerId ? action.binding.ownerId : null,
    resolve: async input => {
      if (!isCurrent()) throw new Error('Stale ingredient capture');
      const evidencePhoto = input.evidencePhotos?.find(photo => photo.role === 'ingredients');
      if (!evidencePhoto) throw new Error('Ingredient photo required');
      const result = await deps.continueIngredients({ operation: 'continue_ingredients', requestId: input.requestId,
        rootCaseId: action.binding.caseId, parentSnapshotId: action.binding.snapshotId, evidencePhoto });
      if (!isCurrent() || result.attemptId !== action.binding.caseId || result.attemptRevision !== 2
        || result.parentSnapshotId !== action.binding.snapshotId || result.caseId === action.binding.caseId
        || result.truthSnapshot?.resolutionCaseId !== result.caseId
        || result.product?.productId !== action.binding.productId
        || (result.product?.variantId ?? null) !== action.binding.variantId) throw new Error('Stale ingredient continuation');
      return result;
    },
  });
  return { process: (evidence: readonly CaptureEvidence[]) => processor.process(evidence.filter(item => item.role === 'ingredients')),
    resolutionFor: processor.resolutionFor };
}
