import {z} from 'zod';
import {EvidenceReviewSchema} from './EvidenceReview.ts';
import {canonicalJson} from '../domain/part-two/hash.ts';
import {contextGoalSchema} from './PersonalContextV2Schema.ts';
const id=z.string().min(1).max(200), text=z.string().min(1).max(4000), hash=z.string().regex(/^[a-f0-9]{64}$/), date=z.iso.datetime();
export const ClaimFieldSchema=z.enum(['ingredientId','amountPercent','amountBasis','amountSubject','chemicalForm','vehicleBridge','site','useForm','frequency','duration','population','endpoint','formulaVersionId','productId','variantId','labelAssertionId','routineOtherMedication','routineSunProtection','timingRelation','purpose','broadSpectrum','pH','indication']);
export type ClaimField=z.infer<typeof ClaimFieldSchema>;
export const ScientificClaimSchema=z.strictObject({
 id,family:z.enum(['G01','G02','G03','G04','G05']),tier:z.enum(['decision_candidate','reference','policy']),
 scope:z.enum(['ingredient_reference','formula_transfer','class_evidence','label_direction','policy_reference']),
 sourceRefs:z.array(z.strictObject({id,url:z.url(),locator:text,retrievedAt:z.union([z.iso.date(),date]),bodySha256:hash.nullable()})).min(1).max(20),
 endpoint:z.strictObject({name:text,direction:z.enum(['benefit','null','risk','context']),result:text,limitations:z.array(text).max(30)}),
 applicability:z.array(z.strictObject({field:ClaimFieldSchema,expected:z.array(text).min(1).max(20),reason:text})).max(30),
 copy:z.strictObject({reason:text,action:text.nullable(),qualifications:z.array(text).max(30)}),
 admission:z.strictObject({status:z.literal('pending'),scientificReviewer:z.null(),operationRights:z.null()}),
 nonGoals:z.array(text).max(30),contradictions:z.array(text).max(30),
}).superRefine((claim,ctx)=>{if(new Set(claim.applicability.map(p=>p.field)).size!==claim.applicability.length)ctx.addIssue({code:'custom',message:'Duplicate applicability field'});});
export type ScientificClaim=z.infer<typeof ScientificClaimSchema>;
/** Server-owned immutable admission, supplied separately from editorial/research
 * records. No client, model, or claim record can approve its own scientific use. */
export const ClaimAdmissionSchema=z.strictObject({claimId:id,claimHash:hash,status:z.enum(['approved','rejected']),reviewerId:id,qualificationRef:id,reviewedAt:date,sourcePins:z.array(hash).min(1).max(20),review:EvidenceReviewSchema.optional(),
 rights:z.strictObject({grantId:id,version:id,process:z.boolean(),store:z.boolean(),display:z.boolean(),export:z.boolean(),validUntil:date,revoked:z.boolean()}),validUntil:date}).superRefine((a,c)=>{const r=a.review;if(r&&(r.claimHash!==a.claimHash||canonicalJson([...r.sourcePins].sort())!==canonicalJson([...a.sourcePins].sort())||r.checkedAt!==a.reviewedAt||r.reviewer.id!==a.reviewerId||r.contentHash!==a.qualificationRef||r.decision!==(a.status==='rejected'?'rejected':'approved')))c.addIssue({code:'custom',message:'Admission differs from exact review provenance'});});
export type ClaimAdmission=z.infer<typeof ClaimAdmissionSchema>;
export const ClaimFeatureSchema=z.strictObject({state:z.enum(['known','unknown','contradiction']),values:z.array(text).max(100).nullable(),factIds:z.array(id).max(100),contextRevisionIds:z.array(id).max(100),sourceIds:z.array(id).max(100),validUntil:date}).superRefine((v,ctx)=>{if(v.state==='known'&&(!v.values?.length||!v.factIds.length&&!v.contextRevisionIds.length))ctx.addIssue({code:'custom',message:'Known feature requires value and evidence'});});
export type ClaimFeature=z.infer<typeof ClaimFeatureSchema>;
export const ClaimAssessmentSchema=z.strictObject({claimId:id,claimHash:hash,family:z.enum(['G01','G02','G03','G04','G05']),state:z.enum(['supported','reference','pending','unknown','mismatch','contradiction','unavailable','rejected']),
 reasons:z.array(text).max(60),missingFields:z.array(ClaimFieldSchema).max(30),factIds:z.array(id).max(1000),contextRevisionIds:z.array(id).max(1000),sourceIds:z.array(id).max(1000),admissionId:id.nullable(),validUntil:date.nullable(),reason:text.nullable(),action:text.nullable()});
export type ClaimAssessment=z.infer<typeof ClaimAssessmentSchema>;
export const ScientificManifestSchema=z.strictObject({version:z.literal('part-four-science-candidates/v1'),contentHash:hash,claims:z.array(ScientificClaimSchema).max(50),admissions:z.array(ClaimAdmissionSchema).max(50)}).superRefine((m,ctx)=>{if(new Set(m.claims.map(c=>c.id)).size!==m.claims.length)ctx.addIssue({code:'custom',message:'Duplicate scientific claim'});});
export type ScientificManifest=z.infer<typeof ScientificManifestSchema>;
export const ScientificFeaturesEnvelopeSchema=z.strictObject({ownerId:id,partTwoBindingKey:id,partTwoRevision:z.number().int().nonnegative(),sourceDigest:id,contextRevision:z.number().int().nonnegative(),manifestHash:hash,claims:z.array(z.strictObject({claimId:id,goal:contextGoalSchema.nullable(),features:z.partialRecord(ClaimFieldSchema,ClaimFeatureSchema)})).max(50)});
export type ScientificFeaturesEnvelope=z.infer<typeof ScientificFeaturesEnvelopeSchema>;
export const ScientificDecisionPacketSchema=z.strictObject({version:z.literal('part-four-scientific-decision/v1'),manifestHash:hash,assessments:z.array(z.strictObject({goal:contextGoalSchema.nullable(),assessment:ClaimAssessmentSchema})).max(100),sourceRefs:z.array(z.strictObject({id,url:z.url(),locator:text,retrievedAt:z.union([z.iso.date(),date]),bodySha256:hash.nullable(),reviewedAt:date,validUntil:date})).max(100),unresolvedGoals:z.array(contextGoalSchema).max(9),coverage:z.literal('bounded_claims_not_full_goal_coverage')});
export type ScientificDecisionPacket=z.infer<typeof ScientificDecisionPacketSchema>;
