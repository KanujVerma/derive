import { z } from 'zod';
import { NormalizationResultSchema } from './PartTwo.ts';
/** Server-owned routine/formula association and permission projection. Incoming
 * HTTP requests never supply this authority. Failed states retain no formula bytes. */
const id=z.string().min(1).max(200), revision=z.number().int().nonnegative(), digest=z.string().regex(/^[a-f0-9]{64}$/), date=z.iso.datetime();
export const ExactRoutineReferenceSchema=z.strictObject({kind:z.literal('catalog'),productId:id,variantId:id,formulaVersionId:id});
export const RoutineFormulaRequestSchema=z.strictObject({version:z.literal('routine-formula-request/v1'),ownerId:id,contextRevision:revision,routineRevisionId:id,routineItemId:id,routineItemHash:digest,reference:ExactRoutineReferenceSchema,knowledgeVersion:id,knowledgeHash:digest});
export type RoutineFormulaRequest=z.infer<typeof RoutineFormulaRequestSchema>;
const sourcePermission=z.strictObject({observationId:id,sourceRevision:revision,policyId:id,policyVersion:id,grantId:id,grantVersion:id,evaluate:z.boolean(),display:z.boolean(),store:z.boolean(),revoked:z.boolean(),validUntil:date});
const authorization=z.strictObject({authorityId:id,authorityRevision:revision,checkedAt:date,validUntil:date,evaluate:z.boolean(),display:z.boolean(),store:z.boolean(),revoked:z.boolean(),withdrawnDependencies:z.array(id).max(3000),sourcePermissions:z.array(sourcePermission).max(1000)});
const association=z.strictObject({id,revision,reference:ExactRoutineReferenceSchema,partOneItemId:id,partOneSnapshotId:id,declarationId:id,declarationRevision:revision,partTwoSnapshotId:id,partTwoBindingKey:id,partTwoRevision:revision,dependencyDigest:digest,sourceDependencies:z.array(id).min(1).max(1000),validUntil:date,revoked:z.boolean()});
export const RoutineFormulaReadyEvidenceSchema=z.strictObject({version:z.literal('routine-formula-evidence/v1'),request:RoutineFormulaRequestSchema,state:z.literal('ready'),association,authorization,partTwo:NormalizationResultSchema});
export const RoutineFormulaEvidenceSchema=z.discriminatedUnion('state',[RoutineFormulaReadyEvidenceSchema,...(['missing','denied','conflict','stale','unavailable','pending'] as const).map(state=>z.strictObject({version:z.literal('routine-formula-evidence/v1'),request:RoutineFormulaRequestSchema,state:z.literal(state),reasonCodes:z.array(id).min(1).max(30)}))]);
export type RoutineFormulaReadyEvidence=z.infer<typeof RoutineFormulaReadyEvidenceSchema>;
export type RoutineFormulaEvidence=z.infer<typeof RoutineFormulaEvidenceSchema>;
