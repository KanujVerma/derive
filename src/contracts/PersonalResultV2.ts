import { PartFourPacketSchema } from './PartFour.ts';
import { z } from 'zod';
import {reportedDateSchema,useContextV2Schema} from './PersonalContextV2Schema.ts';
import {referenceSchema} from '../../supabase/functions/personal-context/validate.ts';
import { PartTwoSpanSchema } from './PartTwo.ts';
import {EligibleMenuSchema} from '../domain/part-three/provider.ts';
import {eligibleMenuFor} from '../domain/part-three/menu.ts';
import {PART_THREE_RELEASE} from '../domain/part-three/release.ts';
import { canonicalJson } from '../domain/part-two/hash.ts';
const id=z.string().min(1).max(200), rev=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), date=z.iso.datetime({offset:false});
const refs=z.array(id).max(1000);
export const DecisionSubjectV2Schema=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('declaration'),itemId:id,snapshotId:id,declarationId:id,declarationRevision:rev,productId:id.nullable(),variantId:id.nullable(),formulaVersionId:id.nullable(),packageScope:z.enum(['published_version','confirmed_package'])}),
 z.strictObject({kind:z.literal('source_reading'),captureSessionId:id,observationId:id}),
]);
export const DecisionBindingV2Schema=z.strictObject({ownerId:id,accountGeneration:rev,encounterId:id,attemptId:id,generation:rev,intent:z.enum(['add','replace','check_current','unanswered','unsure','withheld']),comparatorId:id.nullable(),encounterInputs:z.strictObject({candidateRoutineItemId:id.nullable(),selectedManualReportIds:refs,use:z.strictObject({purpose:z.enum(['moisturizing','cleansing','sun_protection','other']).nullable(),site:z.enum(['face','body','hands','scalp','lips','eye_area','other']).nullable(),useForm:z.enum(['leave_on','rinse_off','other']).nullable()})}),subject:DecisionSubjectV2Schema,
 scanId:id,captureSessionId:id.nullable(),partOneGeneration:rev,partOneRevision:rev,partTwoRevision:rev,partTwoBindingKey:id,sourceDigest:id,fieldPermissionEpoch:rev,deletionEpoch:rev,policyEpoch:rev,dictionaryEpoch:rev,
 contextRevision:rev,profileRevision:id.nullable(),routineRevision:id.nullable(),historyRevision:id.nullable(),assessmentRevisions:refs,preferenceRevisions:refs,noteRevisions:refs,overlayRevision:id.nullable(),
 releases:z.strictObject({releaseHash:id,rule:id,evidence:id,question:id,template:id,policy:id,dictionary:id,locale:z.literal('en'),partFour:z.strictObject({releaseId:id,releaseHash:id,knowledgeVersion:id,knowledgeHash:id}).optional()}),
 refinement:z.strictObject({candidateSetHash:id,projectionVersion:id,promptVersion:id,adapterVersion:id,configuredModel:id,resolvedModel:id.nullable()}).nullable(),
});
export type DecisionBindingV2=z.infer<typeof DecisionBindingV2Schema>;
const dependencies=z.strictObject({sourceIds:refs,sourceFields:refs,contextRevisionIds:refs,factIds:refs,occurrenceIds:refs,releaseIds:refs,validUntil:date});
export const FindingV2Schema=z.strictObject({id,kind:z.enum(['avoidance','sensitivity','experience','purpose_value','current_help','comparison','preference_tradeoff','evidence_limit']),subject:z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('declaration'),itemId:id,declarationId:id}),z.strictObject({kind:z.literal('source_reading'),observationId:id}),z.strictObject({kind:z.literal('report'),recordId:id,relation:z.enum(['exact_version','product_family','selected_manual'])}),z.strictObject({kind:z.literal('comparison'),candidateItemId:id,comparatorId:id})]),
 allowedPropositionId:id,ruleId:id,ruleVersion:id,applicability:z.enum(['eligible','inapplicable','insufficient']),consequence:z.enum(['decisive','concern','value','optional','information']),supportState:z.enum(['supported','limited','unknown']),mandatoryVisibility:z.boolean(),factRefs:refs,reportRefs:refs,evidenceCardRefs:refs,requiredQualifierIds:refs,blockingGapIds:refs,templateId:id,templateVersion:id,
 arguments:z.strictObject({reportTrace:z.strictObject({recordId:id,reference:referenceSchema,role:z.enum(['candidate','comparator']),period:z.strictObject({start:reportedDateSchema,end:reportedDateSchema}),useContext:useContextV2Schema.nullable()}).nullable(),name:z.string().max(500).nullable(),relation:z.enum(['exact_version','product_family','selected_manual']).nullable(),scope:z.enum(['published_version','confirmed_package','source_reading','report','comparison']),detail:z.enum(['reaction','ineffective','liked','tolerated','no_reaction_reported','finished','helps','mixed','not_helping','replacement','already_helpful','different_use','self','preference','conditional','unresolved']).nullable()}),dependencies});
export const MaterialGapSchema=z.strictObject({id,affectedPropositionIds:refs,state:z.enum(['missing','unsure','withheld','conflict','unavailable']),reason:z.enum(['identity_or_use','avoidance_unresolved','formula_association','relevant_history','purpose_coverage','purpose_or_site','intent','current_status']),recoverableBy:z.enum(['user','evidence','reviewer','none'])});
export const EligibleQuestionSchema=z.strictObject({id,version:id,missingInput:z.enum(['intent','current_status','primary_goal']),ruleIds:refs,affectedPropositionIds:refs,branches:z.array(z.strictObject({answer:id,outcome:z.enum(['replacement','extra_step','unknown','current','inactive','purpose_value'])})).min(2).max(8),sensitivity:z.literal('ordinary'),relevanceReason:z.enum(['replacement_or_extra','current_or_inactive','purpose_for_need']),writeScope:z.enum(['encounter','routine','profile']),suppressionKey:id,priority:z.tuple([rev,rev,rev,rev,rev])});
export const DecisionSummarySchema=z.strictObject({judgment:z.enum(['worth_considering','check_first','skip','not_enough_info']),displayVariant:z.enum(['default','worth_keeping']),namedDecision:z.strictObject({itemId:id.nullable(),name:z.string().max(500),intent:z.enum(['add','replace','check_current','unanswered','unsure','withheld'])}),primaryFindingId:id.nullable(),affirmativePremiseIds:refs,overridingFindingIds:refs,consideredConstraintIds:refs,materialGapIds:refs,scope:z.enum(['published_version','confirmed_package','source_reading','report','comparison'])});
const selectionSchema=z.strictObject({selectedTradeoffId:id.nullable(),selectedQuestionId:id.nullable(),provider:z.literal('jev'),resolvedModel:id.nullable(),usage:z.strictObject({inputTokens:rev.max(2000),outputTokens:rev.max(32768)}).nullable(),elapsedMs:z.number().finite().nonnegative().max(60000),contractVersion:z.literal('part-three-selection/v1'),outcome:z.enum(['accepted','abstained','invalid','timeout','unavailable','disallowed'])});
export const RefinementTraceSchema=z.strictObject({callId:id,menu:EligibleMenuSchema,originalQuestion:EligibleQuestionSchema.nullable(),baselineTradeoffId:id.nullable(),selection:selectionSchema,applied:z.boolean()});
export const PersonalResultV2Schema=z.strictObject({schemaVersion:z.literal('personal-result/v2'),partFour:PartFourPacketSchema.optional(),resultId:id,resultRevision:rev,generation:rev,state:z.enum(['pending','ready','unavailable','blocked','expired','invalidated','failed']),binding:DecisionBindingV2Schema,evaluatedAt:date,validUntil:date,summary:DecisionSummarySchema.nullable(),findings:z.array(FindingV2Schema).max(100),materialGaps:z.array(MaterialGapSchema).max(100),question:EligibleQuestionSchema.nullable(),refinementStatus:z.enum(['off','eligible','accepted','abstained','invalid','timeout','unavailable','disallowed']),selectedTradeoffId:id.nullable(),refinementTrace:RefinementTraceSchema.nullable(),ruleResults:z.array(z.strictObject({ruleId:id,state:z.enum(['eligible','inapplicable','insufficient']),reason:id})).max(100)}).superRefine((r,ctx)=>{
 const issue=(message:string)=>ctx.addIssue({code:'custom',message});
 if(r.partFour){const f=r.partFour,b=r.binding,k=b.releases.partFour;if(!k||k.releaseId!==f.releaseId||k.knowledgeVersion!==f.formula.knowledgeVersion||k.knowledgeHash!==f.formula.knowledgeHash||f.contextRevision!==b.contextRevision||f.formula.partTwoBindingKey!==b.partTwoBindingKey||f.formula.partTwoRevision!==b.partTwoRevision||f.formula.dependencyDigest!==b.sourceDigest||Date.parse(f.formula.expiresAt)<Date.parse(r.validUntil))issue('Part Four differs from exact binding');}
 for(const rows of [r.findings,r.materialGaps])if(new Set(rows.map(x=>x.id)).size!==rows.length)issue('Duplicate IDs');
 const findings=new Map(r.findings.map(x=>[x.id,x])), gaps=new Set(r.materialGaps.map(x=>x.id));
 if(r.generation!==r.binding.generation||r.state!=='expired'&&Date.parse(r.validUntil)<=Date.parse(r.evaluatedAt))issue('Invalid binding or lease');
 if(r.state!=='ready'&&r.summary)issue('Non-ready judgment');
 for(const f of r.findings){if(f.blockingGapIds.some(x=>!gaps.has(x))||Date.parse(f.dependencies.validUntil)<Date.parse(r.validUntil))issue('Invalid finding dependency');}
 if(r.selectedTradeoffId&&(!findings.has(r.selectedTradeoffId)||findings.get(r.selectedTradeoffId)!.mandatoryVisibility))issue('Optional selection cannot hide mandatory content');
 if(r.summary){const s=r.summary;if([s.primaryFindingId,...s.affirmativePremiseIds,...s.overridingFindingIds,...s.consideredConstraintIds].some(x=>x!==null&&!findings.has(x))||s.materialGapIds.some(x=>!gaps.has(x)))issue('Invalid summary references');
 const positive=s.judgment==='worth_considering';
 if(positive&&(!s.affirmativePremiseIds.length||s.materialGapIds.length||s.overridingFindingIds.length||!s.primaryFindingId||s.affirmativePremiseIds.some(x=>!['purpose_value','current_help'].includes(findings.get(x)!.kind)||findings.get(x)!.supportState!=='supported')))issue('Unearned positive');
 if(s.displayVariant==='worth_keeping'&&(!positive||s.namedDecision.intent!=='check_current'||!s.affirmativePremiseIds.some(x=>findings.get(x)!.kind==='current_help')))issue('Unearned keep');
 if(s.judgment==='skip'&&!s.overridingFindingIds.some(x=>findings.get(x)!.consequence==='decisive'&&findings.get(x)!.supportState==='supported'))issue('Unearned skip');
 if(s.judgment==='check_first'&&!s.overridingFindingIds.some(x=>findings.get(x)!.consequence==='concern')&&!s.materialGapIds.length)issue('Unearned concern');
 }
 if(r.refinementTrace){const trace=r.refinementTrace,pin=r.binding.refinement,menu=eligibleMenuFor(r.binding,r.findings,trace.originalQuestion);if(!pin||!menu||canonicalJson(menu)!==canonicalJson(trace.menu)||pin.candidateSetHash!==menu.candidateSetHash||pin.projectionVersion!==PART_THREE_RELEASE.refinement.projection||pin.promptVersion!==PART_THREE_RELEASE.refinement.prompt||pin.adapterVersion!==PART_THREE_RELEASE.refinement.adapter||pin.configuredModel!==PART_THREE_RELEASE.refinement.configuredModel||pin.resolvedModel!==trace.selection.resolvedModel||r.refinementStatus!==trace.selection.outcome)issue('Invalid refinement basis');
 for(const [job,chosen] of [['prioritize_tradeoff',trace.selection.selectedTradeoffId],['select_question',trace.selection.selectedQuestionId]] as const)if(chosen!==null&&!trace.menu.jobs.find(j=>j.id===job)?.options.some(o=>o.id===chosen))issue('Ineligible selection');
 if(['accepted','abstained'].includes(trace.selection.outcome)&&(trace.selection.resolvedModel!==pin?.configuredModel||trace.selection.usage===null))issue('Unpinned resolved model');
 if(trace.applied&&trace.selection.outcome!=='accepted')issue('Invalid application');
 if(trace.baselineTradeoffId!==r.findings.find(f=>f.consequence==='optional')?.id&&!(trace.baselineTradeoffId===null&&!r.findings.some(f=>f.consequence==='optional')))issue('Invalid baseline');
 const expectedTradeoff=trace.applied&&trace.selection.selectedTradeoffId!==null?trace.selection.selectedTradeoffId:trace.baselineTradeoffId;if(r.selectedTradeoffId!==expectedTradeoff)issue('Selection was not applied faithfully');
 if(trace.applied&&trace.selection.selectedQuestionId===null&&r.question!==null)issue('Question none was not applied');
 if(!trace.applied&&canonicalJson(r.question)!==canonicalJson(trace.originalQuestion))issue('Fallback lost baseline question');
 if(r.question&&canonicalJson(r.question)!==canonicalJson(trace.originalQuestion))issue('Refinement invented question');
 }else if(r.binding.refinement||r.refinementStatus!=='off')issue('Missing refinement trace');
 if(r.question&&new Set(r.question.branches.map(x=>x.outcome)).size<2)issue('Question has no material branches');
});
export type PersonalResultV2=z.infer<typeof PersonalResultV2Schema>;
export type FindingV2=z.infer<typeof FindingV2Schema>;
export type MaterialGap=z.infer<typeof MaterialGapSchema>;
export type EligibleQuestion=z.infer<typeof EligibleQuestionSchema>;
export const ProductPurposeFactSchema=z.strictObject({factId:id,revision:rev,itemId:id,variantId:id.nullable(),purposeId:z.enum(['moisturizing','cleansing']),site:z.enum(['face','body','hands','scalp','lips','eye_area','other']),useForm:z.enum(['leave_on','rinse_off','other']),basis:z.literal('admitted_label_assertion'),assertionId:id,partTwoFactId:id,spans:z.array(PartTwoSpanSchema).min(1),declarationId:id,declarationRevision:rev,sourceRevision:rev,packageScope:z.enum(['published_version','confirmed_package']),mappingId:id,mappingVersion:id,operations:z.strictObject({evaluate:z.literal(true),externalProcess:z.boolean()}),dependencies});
export type ProductPurposeFact=z.infer<typeof ProductPurposeFactSchema>;
export function sameDecisionBinding(a:DecisionBindingV2,b:DecisionBindingV2):boolean{return canonicalJson(a)===canonicalJson(b);}
