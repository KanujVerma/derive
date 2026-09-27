import { hasVerifiedPackageFormula } from '../../contracts/ProductTruthSnapshot.ts';
import type { ProductTruthSnapshotV1 } from '../../contracts/ProductTruthSnapshot.ts';
import type { DecisionKnowledge, P0BProductEvaluationProjectionV1 } from '../../contracts/PersonalDecision.ts';
/** Category is separate accepted server evidence; snapshots currently omit this fact. */
export interface TrustedSnapshotEnvelope { snapshot:ProductTruthSnapshotV1; runtime?:'authoritative'|'local_fixture'; categoryProvenance?:{productId:string;category:string;source_reference:string;catalog_verified_at:string}; category?:DecisionKnowledge<string>; categorySources?:Array<{id:string;revision:string}>; categoryBoundaryRevision?:string }
export function projectTrustedSnapshot({snapshot:s,category,categorySources=[],categoryBoundaryRevision}:TrustedSnapshotEnvelope):P0BProductEvaluationProjectionV1 {
 const revision=String(s.caseRevision), sourceId=s.snapshotId;
 const identityConflict=s.conflicts.some(c=>c.status==='unresolved'&&c.code!=='ingredient_mismatch');
 const identified=s.identityStatus==='identified'&&s.product&&s.catalogReferences.productId===s.product.productId&&!identityConflict;
 const formulaConflict=s.conflicts.some(c=>c.status==='unresolved');
 const exact=hasVerifiedPackageFormula(s);
 return {schemaVersion:'p0b-product-evaluation/v1',snapshotId:s.snapshotId,snapshotRevision:revision,sourceBoundaryRevision:`p0a/v1:${s.resolverVersion}${categoryBoundaryRevision?`:category:${categoryBoundaryRevision}`:''}`,
 identity:identified?{state:'known',value:{productId:s.product!.productId,variantId:s.product!.variantId&&s.catalogReferences.variantId===s.product!.variantId?s.product!.variantId:null},sourceIds:[sourceId]}:identityConflict?{state:'conflict',reason:'Unresolved identity conflict',sourceIds:[sourceId]}:{state:'unknown',reason:'Product family is unresolved'},
 formula:exact?{state:'known',value:{formulaVersionId:s.formula!.formulaVersionId,ingredients:[...s.formula!.ingredients]},sourceIds:[sourceId]}:formulaConflict?{state:'conflict',reason:'Unresolved snapshot conflict',sourceIds:[sourceId]}:{state:'unknown',reason:'Exact package formula is unverified'},
 category:category??{state:'unknown',reason:'Snapshot does not establish category'},sources:[{id:sourceId,revision},...categorySources]};
}
