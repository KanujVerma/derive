import type { ProductTruthSnapshotV1 } from '../../../src/contracts/ProductTruthSnapshot.ts';
/** Server-only explicitly marked acceptance fixtures. Never selected by request prose. */
export const FIXTURE_CASE='11111111-1111-4111-8111-111111111111';
export const FIXTURE_SNAPSHOT='22222222-2222-4222-8222-222222222222';
export const FIXTURE_PRODUCT='33333333-3333-4333-8333-333333333333';
export const FIXTURE_VARIANT='44444444-4444-4444-8444-444444444444';
export const FIXTURE_FORMULA='55555555-5555-4555-8555-555555555555';
export function fixtureSnapshot(caseId=FIXTURE_CASE,snapshotId=FIXTURE_SNAPSHOT):ProductTruthSnapshotV1 {
 return {schemaVersion:1,snapshotId,createdAt:'2026-09-26T00:00:00Z',resolutionCaseId:caseId,caseRevision:1,resolverVersion:'local-fixture/v1',state:'verified_product_formula',identityStatus:'identified',product:{productId:FIXTURE_PRODUCT,variantId:FIXTURE_VARIANT,brand:'Development fixture',name:'Moisturizer'},formula:{formulaVersionId:FIXTURE_FORMULA,verificationStatus:'verified',appliesToSelectedVariant:true,ingredients:['Water','Glycerin'],observedAt:'2026-09-26T00:00:00Z',provenanceType:'founder_review',publicSourceUrl:null},identifiers:[],evidence:[],catalogReferences:{productId:FIXTURE_PRODUCT,variantId:FIXTURE_VARIANT,formulaVersionId:FIXTURE_FORMULA},unknownFields:['public_source'],conflicts:[],nextRequiredEvidence:'none',customerConfirmation:'not_required',founderReview:'resolved'};
}
