import { z } from 'zod';
import type { ProductTruthSnapshotV1 } from './ProductTruthSnapshot.ts';
import { hasVerifiedPackageFormula } from './ProductTruthSnapshot.ts';

const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(1000);
const publicUrl = z.string().regex(/^https:\/\/[^/@?#]+(?:\/[^?#]*)?$/).nullable();
const schema = z.object({
  schemaVersion: z.literal(1), snapshotId: uuid, createdAt: z.iso.datetime({ offset: true }),
  resolutionCaseId: uuid, caseRevision: z.number().int().positive(), resolverVersion: text,
  state: z.enum(['verified_product_formula','identified_formula_unverified','ambiguous_candidates','formula_only','insufficient_evidence']),
  product: z.object({productId:uuid,brand:text,name:text,variantId:uuid.optional(),variantName:text.optional(),regionCode:text.optional()}).strict().nullable(),
  identityStatus:z.enum(['identified','unresolved']),
  formula:z.object({formulaVersionId:uuid,verificationStatus:z.literal('verified'),appliesToSelectedVariant:z.boolean(),
    ingredients:z.array(z.string().min(1).max(300)).min(1).max(300), observedAt:z.iso.datetime({offset:true}),
    provenanceType:z.enum(['manufacturer','package_label','regulator','founder_review']),publicSourceUrl:publicUrl}).strict().nullable(),
  identifiers:z.array(z.object({type:z.literal('gtin'),value:z.string().regex(/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/),status:z.literal('customer_observed')}).strict()).max(20),
  evidence:z.array(z.object({evidenceId:uuid,type:z.enum(['barcode','typed_identity','front_label','ingredients','packaging']),
    source:z.enum(['device_barcode','member_input','trusted_ocr','founder_review']),authority:z.literal('candidate')}).strict()).max(20),
  catalogReferences:z.object({productId:uuid.nullable(),variantId:uuid.nullable(),formulaVersionId:uuid.nullable()}).strict(),
  unknownFields:z.array(z.enum(['product','variant','region','formula','public_source'])).max(5),
  conflicts:z.array(z.object({code:z.enum(['identity_mismatch','region_mismatch','ingredient_mismatch','identifier_conflict']),status:z.enum(['unresolved','reviewed'])}).strict()).max(4),
  nextRequiredEvidence:z.enum(['none','front_label','ingredients','variant_selection','manual_review']),
  customerConfirmation:z.enum(['not_required','required']),founderReview:z.enum(['not_needed','pending','resolved','dismissed']),
}).strict();

/** Reject a malformed supplied snapshot; never manufacture one from labels/legacy output. */
export function parseProductTruthSnapshot(value:unknown):ProductTruthSnapshotV1 {
  const result = schema.parse(value) as ProductTruthSnapshotV1;
  if (result.identityStatus !== (result.product ? 'identified':'unresolved')
    || result.catalogReferences.productId !== (result.product?.productId ?? null)
    || result.catalogReferences.variantId !== (result.product?.variantId ?? null)
    || result.catalogReferences.formulaVersionId !== (result.formula?.formulaVersionId ?? null)
    || (result.state === 'verified_product_formula' && !hasVerifiedPackageFormula(result))
    || (result.state === 'formula_only' && (!result.formula || result.product || result.formula.appliesToSelectedVariant))
    || (!['verified_product_formula','formula_only'].includes(result.state) && result.formula !== null)
    || (['ambiguous_candidates','insufficient_evidence','formula_only'].includes(result.state) && result.product !== null)
    || (result.state === 'identified_formula_unverified' && !result.product)) {
    throw new Error('Inconsistent product truth snapshot');
  }
  return result;
}
