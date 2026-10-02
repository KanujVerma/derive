/** Synthetic fixture review authority only. This file is never imported by app
 * or deployed Edge handlers. The fixture author must pin the sanitized JPEG
 * hash from their fixed gold artifact before submitting any capture request. */
import { hashPrivateObservation } from '../../supabase/functions/_shared/part-one-private-evidence.ts';
import type { PrivateEvidenceContext, PrivateEvidencePorts, PrivateObservationRecord, PrivateReviewedReceipt, PrivateReviewAuthorityPolicy } from '../../supabase/functions/_shared/part-one-private-evidence.ts';
import type { Variant } from '../../src/contracts/PartOne.ts';

export const SYNTHETIC_PRIVATE_VARIANT: Variant = Object.freeze({ brand: 'Example', line: 'Daily', form: 'toner', scent: 'unscented', shade: 'clear', spf: 'not applicable', strength: 'standard', size: '100', unit: 'ml', packCount: 1, packagingLevel: 'each' });
export const SYNTHETIC_PRIVATE_INGREDIENT_TEXT = 'Ingredients: 1,2-Hexanediol, Aqua (Water, Eau), PPG-6-Decyltetradeceth-30, PEG-240/HDI Copolymer';
export const SYNTHETIC_PRIVATE_EDIT_TEXT = SYNTHETIC_PRIVATE_INGREDIENT_TEXT.slice('Ingredients: '.length);
export const SYNTHETIC_PRIVATE_PACKAGE_TEXT = [...Object.values(SYNTHETIC_PRIVATE_VARIANT).map(String), 'US', 'Cosmetic', '3606000537538'].join('\n');
export const syntheticPrivateLines = (text: string) => text.split('\n').map((text, index) => ({ text, alternatives: [] as string[], region: [0.1,index / 20,0.8,0.04], confidence: 0.99 }));

export function createSyntheticPrivateReviewBuilder(gold: { sanitizedAssetHash: string; width: number; height: number; assetsByRole?: Partial<Record<'ingredients'|'package',{sanitizedAssetHash:string;width:number;height:number}>>; sanitizerVersion: string; recognizer: string; recognizerVersion: string; hash: PrivateEvidencePorts['hash']; authorityPolicy: PrivateReviewAuthorityPolicy }) {
  // Gold is passed by the fixed-artifact test setup, not read from prepared rows.
  if (!gold.sanitizedAssetHash || !gold.authorityPolicy.permissionEvidence.startsWith('Synthetic local fixture:')) throw new Error('fixed_synthetic_gold_required');
  const pinned = Object.freeze({ ...gold, authorityPolicy: Object.freeze({ ...gold.authorityPolicy }) });
  return async (input: PrivateEvidenceContext): Promise<PrivateReviewedReceipt> => {
    const derivativeHeads = input.observations.filter(o => o.coordinateSpace === 'sanitized_derivative');
    if ((input.assets.length !== 1 && input.assets.length !== 2) || derivativeHeads.length !== 2 || input.observations.length > 4 || !input.item || !input.reviewRequest) throw new Error('synthetic_gold_evidence_set_mismatch');
    const ingredients = derivativeHeads.find(o => o.role === 'ingredients'), pkg = derivativeHeads.find(o => o.role === 'package');
    if (!ingredients || !pkg || pkg.kind !== 'ocr' || pkg.rawText !== SYNTHETIC_PRIVATE_PACKAGE_TEXT || ingredients.rawText !== (ingredients.kind === 'edit' ? SYNTHETIC_PRIVATE_EDIT_TEXT : SYNTHETIC_PRIVATE_INGREDIENT_TEXT)) throw new Error('synthetic_gold_transcript_mismatch');
    if (input.item.name !== 'Example Daily toner' || JSON.stringify(input.item.variant) !== JSON.stringify(SYNTHETIC_PRIVATE_VARIANT) || input.item.conflictIds.length || !input.item.barcodeAssertions.some(a => a.namespace === 'gtin' && a.canonical === '03606000537538')) throw new Error('synthetic_gold_identity_mismatch');
    const roleAsset = (observation: PrivateObservationRecord) => {
      const asset = input.assets.find(a => observation.assetEvidenceIds.length === 1 && observation.assetEvidenceIds[0] === a.evidenceId);
      const expected = pinned.assetsByRole?.[observation.role] ?? pinned;
      if (!asset || asset.contentHash !== expected.sanitizedAssetHash || asset.width !== expected.width || asset.height !== expected.height || asset.sanitizerVersion !== pinned.sanitizerVersion || !asset.metadataStripped || asset.status !== 'active') throw new Error('synthetic_gold_image_mismatch');
      return asset;
    };
    if (new Set(input.observations.flatMap(o => o.assetEvidenceIds)).size !== input.assets.length) throw new Error('synthetic_gold_evidence_set_mismatch');
    for (const observation of [...input.observations,...input.priorObservations]) {
      const asset = roleAsset(observation);
      if (observation.uncertaintyReasons.length || observation.status !== 'active') throw new Error('synthetic_gold_lineage_mismatch');
      if (observation.coordinateSpace === 'source_original' && (observation.kind !== 'ocr' || observation.derivedFromObservationIds.length)) throw new Error('synthetic_gold_original_lineage_mismatch');
      if (observation.coordinateSpace === 'sanitized_derivative' && observation.derivedFromObservationIds.some(id => ![...input.observations,...input.priorObservations].some(original => original.observationId === id && original.kind === 'ocr' && original.coordinateSpace === 'source_original' && original.role === observation.role && JSON.stringify(original.assetEvidenceIds) === JSON.stringify(observation.assetEvidenceIds)))) throw new Error('synthetic_gold_derivative_lineage_mismatch');
      if (observation.kind === 'ocr') {
        const text = observation.role === 'package' ? SYNTHETIC_PRIVATE_PACKAGE_TEXT : SYNTHETIC_PRIVATE_INGREDIENT_TEXT;
        const ocr = observation.ocr;
        if (observation.rawText !== text || observation.revision !== 1 || !ocr || ocr.evidenceId !== asset.clientEvidenceId || ocr.recognizer !== pinned.recognizer || ocr.recognizerVersion !== pinned.recognizerVersion || ocr.status !== 'recognized' || ocr.sourceWidth !== asset.width || ocr.sourceHeight !== asset.height || ocr.correctionEnabled || JSON.stringify(ocr.languageConfig) !== '["en"]' || JSON.stringify(ocr.orientationTransform) !== '[1,0,0,0,1,0,0,0,1]' || JSON.stringify(ocr.lines) !== JSON.stringify(syntheticPrivateLines(text))) throw new Error('synthetic_gold_ocr_mismatch');
      } else if (observation.coordinateSpace !== 'sanitized_derivative' || observation.rawText !== SYNTHETIC_PRIVATE_EDIT_TEXT || observation.revision !== 2 || !observation.edit || observation.edit.text !== SYNTHETIC_PRIVATE_EDIT_TEXT || !input.priorObservations.some(p => p.observationId === observation.supersedesId && p.kind === 'ocr' && p.coordinateSpace === 'sanitized_derivative' && p.rawText === SYNTHETIC_PRIVATE_INGREDIENT_TEXT)) throw new Error('synthetic_gold_edit_mismatch');
    }
    const ref = (observation: PrivateObservationRecord, text: string) => {
      const start = observation.rawText.indexOf(text); if (start < 0) throw new Error('synthetic_gold_literal_missing');
      const lineIndex = observation.rawText.slice(0,start).split('\n').length - 1;
      return { observationId:observation.observationId,revision:observation.revision,start,end:start+text.length,assetEvidenceId:roleAsset(observation).evidenceId,text,region:[0.1,lineIndex/20,0.8,0.04] };
    };
    const start = ingredients.kind === 'ocr' ? 13 : 0;
    return { schemaVersion:1,ownerId:input.ownerId,captureSessionId:input.capture.captureSessionId,packageObservationId:input.capture.packageObservationId,generation:input.capture.generation,deletionEpoch:input.capture.deletionEpoch,reviewId:input.reviewRequest.reviewId,authorityPolicyId:pinned.authorityPolicy.policyId,authorityPolicyVersion:pinned.authorityPolicy.version,reviewedAt:input.now,expiresAt:pinned.authorityPolicy.expiresAt,permissionEvidence:pinned.authorityPolicy.permissionEvidence,selectedItemId:input.item.itemId,selectedSnapshotId:input.item.snapshotId,assetBindings:input.assets.map(asset => ({ evidenceId:asset.evidenceId,attestationId:asset.attestationId,storageObjectId:asset.storageObjectId,contentHash:asset.contentHash,objectVersion:asset.objectVersion })),observationBindings:await Promise.all(input.observations.map(async o => ({ observationId:o.observationId,revision:o.revision,...await hashPrivateObservation(o,pinned.hash) }))),packageIdentity:{code:{raw:'3606000537538',symbology:'ean13',namespace:'gtin',retailerId:null},evidenceRefs:[ref(pkg,'3606000537538')]},category:'cosmetic',categoryRefs:[ref(pkg,'Cosmetic')],variant:{...SYNTHETIC_PRIVATE_VARIANT},variantRefs:Object.fromEntries(Object.entries(SYNTHETIC_PRIVATE_VARIANT).map(([key,value]) => [key,[ref(pkg,String(value))]])),packageMarket:'US',marketRefs:[ref(pkg,'US')],sections:[{ kind:'ingredients',observationId:ingredients.observationId,revision:ingredients.revision,start,end:ingredients.rawText.length,startCovered:true,endCovered:true,lineCoverageComplete:true,lineRefs:[ref(ingredients,ingredients.rawText.slice(start))],uncertaintyReasons:[] }],conflictIds:[],uncertaintyReasons:[] };
  };
}
