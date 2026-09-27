import { z } from 'zod';
import { GoalSchema } from '../../types/schema.ts';
import type { DecisionBinding, PersonalDecisionPacketV1 } from '../../contracts/PersonalDecision.ts';

const ref = z.string().min(1).max(200).refine((value) => value.trim().length > 0);
const refs = z.array(ref).max(100);
const text = z.string().max(600);
const texts = z.array(text).max(30);
const section = z.enum(['profile', 'routine', 'history']);
const category = z.enum(['moisturizer', 'cleanser', 'sunscreen', 'serum', 'treatment']);
const evidenceNeedCode = z.enum([
  'exact_identity', 'verified_formula', 'formula_conflict', 'profile_context', 'routine_completeness',
  'application_schedule', 'current_treatments', 'sensitivity_context', 'ingredient_alias_review',
  'reproductive_context', 'individual_tolerance', 'exact_prior_formula', 'current_formula_experience',
  'reviewed_claim', 'supported_rule', 'clinician_review',
]);
export const decisionBindingSchema: z.ZodType<DecisionBinding> = z.strictObject({
  ownerId: ref, productSnapshotId: ref, productSnapshotRevision: ref, sourceBoundaryRevision: ref,
  productId: ref.nullable(), variantId: ref.nullable(), formulaVersionId: ref.nullable(),
  profileRevision: ref.nullable(), routineRevision: ref.nullable(), historyRevision: ref.nullable(),
});
const evidence = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('product_fact'), snapshotRevision: ref, sourceId: ref, sourceRevision: ref,
    scope: z.enum(['identity', 'formula', 'category']), productId: ref, variantId: ref.nullable(), formulaVersionId: ref.nullable() }),
  z.strictObject({ kind: z.literal('routine_product_fact'), ownerId: ref, routineRevision: ref, routineItemId: ref,
    productId: ref, variantId: ref.nullable(), formulaVersionId: ref.nullable(), scope: z.enum(['category', 'formula']), sourceId: ref, sourceRevision: ref }),
  z.strictObject({ kind: z.literal('context_fact'), section, ownerId: ref, revision: ref, recordId: ref }),
  z.strictObject({ kind: z.literal('reviewed_claim'), claimId: ref, claimRevision: ref, sourceId: ref, sourceRevision: ref,
    applicability: z.enum(['applicable', 'uncertain']), limitations: texts }),
  z.strictObject({ kind: z.literal('observation'), observationId: ref, source: z.enum(['raw_text', 'model', 'commercial']) }),
]);
const evidenceIndexes = z.array(z.number().int().nonnegative()).max(100);
const display = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('role_match'), goal: GoalSchema, category, evidenceIndexes }),
  z.strictObject({ kind: z.literal('routine_relation'), routineItemIds: refs, role: z.union([category, z.literal('unknown')]),
    timing: z.enum(['am', 'pm', 'both', 'unknown']),
    frequency: z.enum(['daily', 'few_times_weekly', 'weekly', 'occasional', 'unknown']), evidenceIndexes }),
  z.strictObject({ kind: z.literal('prior_reaction'), historyEventId: ref, historicalFormulaVersionId: ref.nullable(), evidenceIndexes }),
  z.strictObject({ kind: z.literal('routine_experience'), routineItemIds: refs, historyEventId: ref, outcome: z.enum(['reaction', 'ineffective']), evidenceIndexes }),
  z.strictObject({ kind: z.literal('ingredient_context'), ingredient: z.string().min(1).max(120),
    context: z.enum(['reported_sensitivity', 'reactivity', 'treatment_overlap', 'pregnancy', 'trying_to_conceive', 'nursing']), evidenceIndexes }),
  z.strictObject({ kind: z.literal('evidence_gap'), code: evidenceNeedCode, evidenceIndexes }),
]);
const finding = z.strictObject({
  id: ref, kind: z.enum(['goal_role_match', 'role_redundancy', 'replacement_candidate', 'active_overlap',
    'reported_ingredient_sensitivity', 'reactive_active', 'prior_product_reaction', 'reproductive_context_caution',
    'routine_experience_caution', 'formula_changed', 'missing_evidence', 'no_supported_rule']),
  applicability: z.enum(['applicable', 'uncertain', 'not_applicable']),
  severity: z.enum(['informational', 'caution', 'blocker']), confidence: z.enum(['supported', 'limited', 'unknown']),
  ruleId: ref, ruleVersion: ref, evidence: z.array(evidence).max(100), uncertainty: texts,
  evidenceNeedIds: refs, display: display.optional(),
});

/** Strict renderer-local transport boundary; authentication and source approval stay with the host. */
export const personalDecisionPacketSchema: z.ZodType<PersonalDecisionPacketV1> = z.strictObject({
  schemaVersion: z.literal('personal-decision/v1'), id: ref, evaluatedAt: z.iso.datetime(), binding: decisionBindingSchema,
  versions: z.strictObject({ engine: ref, policy: ref, projection: z.literal('p0b-product-evaluation/v1') }),
  findings: z.array(finding).min(1).max(100),
  routineImpacts: z.array(z.strictObject({ id: ref,
    kind: z.enum(['adds_role', 'duplicates_role', 'replacement_candidate', 'active_overlap', 'keep_current', 'none', 'unknown']),
    candidate: z.strictObject({ productId: ref.nullable(), variantId: ref.nullable(), formulaVersionId: ref.nullable() }),
    routineItemIds: refs, findingIds: refs, uncertainty: texts,
  })).max(100),
  evidenceNeeds: z.array(z.strictObject({ id: ref, code: evidenceNeedCode,
    state: z.enum(['missing', 'unknown', 'withheld', 'conflict']), critical: z.boolean(), findingIds: refs,
  })).max(100),
  action: z.strictObject({ kind: z.enum(['COULD_WORK', 'USE_WITH_CAUTION', 'KEEP_CURRENT', 'SKIP', 'NOT_ENOUGH_INFORMATION']),
    findingIds: refs, primaryFindingId: ref,
    nextStep: z.enum(['consider_use', 'keep_current', 'skip_product', 'confirm_formula', 'add_context', 'review_routine', 'ask_clinician']),
  }),
});
