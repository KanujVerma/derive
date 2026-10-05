import { z } from 'zod';
import { CodeSchema, DeclarationSectionSchema, PartOneIdSchema, VariantSchema } from './PartOne.ts';

export const CAPTURED_SOURCE_EXTRACTOR_VERSION = 'part-one-private-source-1';
const id=PartOneIdSchema,ids=z.array(id),date=z.iso.datetime({offset:false}),revision=z.number().int().nonnegative();
const region=z.array(z.number().finite().min(0).max(1)).length(4).refine(r=>r[2]>0&&r[3]>0&&r[0]+r[2]<=1.000001&&r[1]+r[3]<=1.000001);
export const CapturedSourceRefSchema=z.strictObject({observationId:id,revision:z.number().int().positive(),start:revision,end:revision,assetEvidenceId:id,text:z.string().min(1),region});
const refs=z.array(CapturedSourceRefSchema);
const section=z.strictObject({kind:z.enum(['ingredients','active','inactive','may_contain']),observationId:id,revision:z.number().int().positive(),start:revision,end:revision,startCovered:z.boolean(),endCovered:z.boolean(),lineCoverageComplete:z.literal(false),lineRefs:refs,headerRefs:refs,endRefs:refs,uncertaintyReasons:z.array(z.string())});
const gap=z.strictObject({code:z.string(),observationIds:ids,details:z.string().nullable()});
const contradiction=z.strictObject({kind:z.enum(['barcode','variant','market','category','source_reading','selection']),field:z.string().nullable(),values:z.array(z.string()),refs});
export const CapturedSourceCandidateSchema=z.strictObject({schemaVersion:z.literal(1),sourceKind:z.literal('captured_label_extractor'),extractorVersion:z.literal(CAPTURED_SOURCE_EXTRACTOR_VERSION),candidateId:id,ownerId:id,captureSessionId:id,packageObservationId:id,generation:revision,deletionEpoch:revision,captureRevision:revision,resultRevision:revision,selectedItemId:id.nullable(),selectedSnapshotId:id.nullable(),targetSnapshotId:id.nullable(),targetDeclarationId:id,observedAt:date,expiresAt:date,
 assetBindings:z.array(z.strictObject({evidenceId:id,attestationId:id,storageObjectId:id,contentHash:z.string(),objectVersion:z.string()})),
 observationBindings:z.array(z.strictObject({observationId:id,revision:z.number().int().positive(),textHash:z.string(),recordHash:z.string(),current:z.boolean()})),
 packageIdentity:z.strictObject({code:CodeSchema,canonicalGtin14:z.string(),evidenceRefs:refs}).nullable(),name:z.strictObject({value:z.string(),refs}).nullable(),variant:VariantSchema,variantRefs:z.record(z.string(),refs),category:z.enum(['cosmetic','drug','unknown']),categoryRefs:refs,packageMarket:z.string().nullable(),marketRefs:refs,sections:z.array(section),gaps:z.array(gap),contradictions:z.array(contradiction),association:z.enum(['unknown','candidate','barcode_matches_catalog_same_asset','barcode_matches_catalog_unlinked_assets','contradiction']),reasonCodes:z.array(z.string())});
export const GenericCapturedSourceOutcomeSchema=z.strictObject({schemaVersion:z.literal(1),sourceKind:z.literal('captured_label_extractor'),state:z.enum(['partial','conflict','blocked']),candidate:CapturedSourceCandidateSchema.nullable(),facts:z.strictObject({sections:z.array(DeclarationSectionSchema),capturedText:z.array(z.strictObject({observationId:id,revision:z.number().int().positive(),rawText:z.string(),sourceRefs:refs,attributedEdit:z.boolean()}))}),reasonCodes:z.array(z.string()),absenceClaimsAllowed:z.literal(false),catalogVerified:z.literal(false),acceptanceEligible:z.literal(false)});
export type CapturedSourceRef=z.infer<typeof CapturedSourceRefSchema>;
export type CapturedSourceCandidate=z.infer<typeof CapturedSourceCandidateSchema>;
export type GenericCapturedSourceOutcome=z.infer<typeof GenericCapturedSourceOutcomeSchema>;
