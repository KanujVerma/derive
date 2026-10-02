import { z } from 'zod';
import { AttributedEditSchema, CaptureSessionSchema, OcrObservationSchema, PartOneIdSchema,
  SanitizedAssetSchema, ScanResultSchema, CaptureCommitResultSchema } from './PartOne.ts';
const version = z.number().int().nonnegative();
const date = z.iso.datetime({ offset: false });
const text = z.string().max(50000);
const ids = z.array(PartOneIdSchema).max(100);
const lineRef = z.strictObject({ evidenceId: PartOneIdSchema, observationIndex: version, lineIndex: version });
const sourceSpan = lineRef.safeExtend({ region: z.array(z.number().finite()).length(4), rawText: text, correctionRevision: version.nullable() });
const previewLine = z.strictObject({ text, rawText: text, correctionRevision: version.nullable(), actorOwnerId: PartOneIdSchema.nullable(), sources: z.array(sourceSpan).min(1).max(6) });
const section = z.enum(['unknown', 'ingredients', 'active', 'inactive', 'explanatory']);
/** User review is persisted as attributed private work. It is never an acceptance predicate or trusted receipt. */
export const CaptureReviewStateSchema = z.strictObject({ active: z.boolean(), revision: version, assemblyRevision: version,
  mode: z.enum(['unknown', 'cosmetic', 'drug_facts']), samePackagePhotoIds: ids,
  assignments: z.array(z.strictObject({ ref: lineRef, section, language: z.string().max(100) })).max(2000),
  packageConflicts: z.array(z.strictObject({ evidenceId: PartOneIdSchema, reason: z.string().min(1).max(500) })).max(6),
  gaps: z.array(z.strictObject({ id: z.string().max(100), kind: z.enum(['right_edge','left_edge','tail','glare','hidden_line','fold','active','inactive']),
    status: z.enum(['missing','operator_observed']), observedRefs: z.array(lineRef).max(2000) })).max(20),
  boundaries: z.strictObject({ start: z.array(lineRef).max(2000), end: z.array(lineRef).max(2000) }),
  assemblies: z.array(z.strictObject({ revision: version, supersedesRevision: version.nullable(), section, language: z.string().max(100),
    sameDeclarationObservedBy: PartOneIdSchema, lines: z.array(previewLine).max(2000) })).max(50),
});
export const CaptureCoverageSchema = z.strictObject({ startSeen: z.boolean(), endSeen: z.boolean(), missingRegions: z.array(z.string().max(100)).max(50),
  requiredSections: z.array(z.string().max(100)).max(10), observedSections: z.array(z.string().max(100)).max(10), associationContradictions: z.array(z.string().max(500)).max(50) });
export const CaptureLocalReviewSchema = z.strictObject({ reviewState: CaptureReviewStateSchema, coverage: CaptureCoverageSchema });
export const CaptureSourceObservationSchema = z.strictObject({ observationId: PartOneIdSchema, revision: z.literal(1), role:z.enum(['ingredients','package']).default('ingredients'), observation: OcrObservationSchema });
export const CaptureSourceEditSchema = AttributedEditSchema.safeExtend({ sourceRef: lineRef.nullable().optional(), replacementText:text.optional() });
export const CapturePrivateCommitRequestSchema = z.strictObject({ schemaVersion: z.literal(2), idempotencyKey: z.string().min(1).max(200),
  expectedGeneration: version, expectedResultRevision: version, expectedCaptureRevision: version, expectedDeletionEpoch: version,
  packageObservationId: PartOneIdSchema, assets: z.array(SanitizedAssetSchema).max(6),
  sourceObservations: z.array(CaptureSourceObservationSchema).max(36), edits: z.array(CaptureSourceEditSchema).max(100),
  review: CaptureLocalReviewSchema.nullable(), reviewId: PartOneIdSchema.nullable(),
}).superRefine((request, context) => {
  for (const field of ['evidenceId','storageObjectId'] as const)
    if (new Set(request.assets.map(asset => asset[field].toLowerCase())).size !== request.assets.length)
      context.addIssue({ code:'custom',path:['assets'],message:'Duplicate private asset reference' });
  const observations = [...request.sourceObservations.map(value => value.observationId), ...request.edits.map(value => value.observationId)].map(id=>id.toLowerCase());
  if (new Set(observations).size !== observations.length) context.addIssue({code:'custom',message:'Duplicate immutable observation id'});
});
export const CaptureUploadBindingSchema = z.strictObject({ idempotencyKey: z.string().min(1).max(200), evidenceId: PartOneIdSchema,
  packageObservationId: PartOneIdSchema, expectedGeneration: version, expectedResultRevision: version,
  expectedCaptureRevision: version, expectedDeletionEpoch: version });
export const PRIVATE_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
const headerNames = { idempotencyKey:'x-part-one-idempotency-key', evidenceId:'x-part-one-evidence-id', packageObservationId:'x-part-one-package-observation-id',
  expectedGeneration:'x-part-one-generation',expectedResultRevision:'x-part-one-result-revision',expectedCaptureRevision:'x-part-one-capture-revision',expectedDeletionEpoch:'x-part-one-deletion-epoch' } as const;
export function privateUploadHeaders(binding: CaptureUploadBinding): Record<string,string> {
  const valid=CaptureUploadBindingSchema.parse(binding), result:Record<string,string>={'content-type':'image/jpeg'};
  for (const key of Object.keys(headerNames) as (keyof typeof headerNames)[]) result[headerNames[key]]=String(valid[key]);
  return result;
}
export function parsePrivateUploadHeaders(headers: Headers): CaptureUploadBinding {
  const values:Record<string,unknown>={};
  for (const key of Object.keys(headerNames) as (keyof typeof headerNames)[]) {
    const value=headers.get(headerNames[key]);
    values[key]=key.startsWith('expected') && value!==null && /^\d+$/.test(value) ? Number(value) : value;
  }
  return CaptureUploadBindingSchema.parse(values);
}
export const CaptureUploadReceiptSchema = z.strictObject({ schemaVersion:z.literal(1),capture:CaptureSessionSchema,result:ScanResultSchema,
  asset:SanitizedAssetSchema,attestationId:PartOneIdSchema,expiresAt:date }).superRefine((value,context)=>{
  if(value.capture.scanId.toLowerCase()!==value.result.scanId.toLowerCase() || value.capture.generation!==value.result.generation)
    context.addIssue({code:'custom',message:'Upload receipt capture/result mismatch'});
});
export const CapturePrivateCommitResultSchema = CaptureCommitResultSchema;
const recoveredAsset = z.strictObject({recordId:PartOneIdSchema.nullable(),asset:SanitizedAssetSchema,attestationId:PartOneIdSchema,expiresAt:date,
  signedAccess:z.strictObject({url:z.url(),expiresAt:date}).nullable()});
export const CaptureRecoverySchema = z.strictObject({schemaVersion:z.literal(1),capture:CaptureSessionSchema,editable:z.boolean(),
  result:ScanResultSchema,boundResult:ScanResultSchema.nullable(),assets:z.array(recoveredAsset).max(6),
  sourceObservations:z.array(CaptureSourceObservationSchema).max(36),
  edits:z.array(CaptureSourceEditSchema.safeExtend({actorOwnerId:PartOneIdSchema})).max(100),
  declarationIds:ids,review:CaptureLocalReviewSchema.nullable(),reviewReceiptId:PartOneIdSchema.nullable(),
}).superRefine((value,context)=>{
  const bound=value.boundResult;
  if(bound && (bound.scanId.toLowerCase()!==value.capture.scanId.toLowerCase() || bound.generation!==value.capture.generation || bound.itemId!==value.capture.itemId))
    context.addIssue({code:'custom',message:'Recovery package result mismatch'});
  if(value.editable && (value.result.scanId.toLowerCase()!==value.capture.scanId.toLowerCase() || value.result.generation!==value.capture.generation || value.result.itemId!==value.capture.itemId))
    context.addIssue({code:'custom',message:'Editable recovery has changed binding'});
  for(const entry of value.assets) if(entry.signedAccess && Date.parse(entry.signedAccess.expiresAt)>Date.parse(entry.expiresAt))
    context.addIssue({code:'custom',message:'Asset access outlives evidence'});
});
export type CaptureUploadBinding = z.infer<typeof CaptureUploadBindingSchema>;
export type CaptureUploadReceipt = z.infer<typeof CaptureUploadReceiptSchema>;
export type CapturePrivateCommitRequest = z.infer<typeof CapturePrivateCommitRequestSchema>;
export type CaptureRecovery = z.infer<typeof CaptureRecoverySchema>;
export type CaptureLocalReview = z.infer<typeof CaptureLocalReviewSchema>;
export const PrivateCaptureCapabilitySchema = z.strictObject({schemaVersion:z.literal(1),enabled:z.boolean(),reasonCode:z.string(),
  policyVersion:z.string().nullable(),retentionSeconds:z.number().int().positive().nullable(),deletionDeadlineSeconds:z.number().int().positive().nullable(),expiresAt:date.nullable(),
}).superRefine((value,context)=>{if(value.enabled && (!value.policyVersion || !value.retentionSeconds || !value.deletionDeadlineSeconds || !value.expiresAt))
  context.addIssue({code:'custom',message:'Enabled private capability requires explicit lifecycle policy'});});
export type PrivateCaptureCapability=z.infer<typeof PrivateCaptureCapabilitySchema>;

export const PrivateCaptureListSchema=z.strictObject({captures:z.array(z.strictObject({capture:CaptureSessionSchema,editable:z.boolean(),boundResult:ScanResultSchema.nullable()})).max(50)});
export type PrivateCaptureSummary=z.infer<typeof PrivateCaptureListSchema>['captures'][number];
