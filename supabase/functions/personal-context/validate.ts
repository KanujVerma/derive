import { z } from 'zod';
import type { PersonalContextRequest } from '../../../src/contracts/PersonalContext.ts';
const uuid = z.uuid().transform(value => value.toLowerCase());
const shortText = (max: number) => z.string().trim().min(1).max(max).refine(v => !/[\x00-\x1f\x7f]/.test(v), 'Control characters are not allowed');
const goal = z.enum(['breakouts','dark_spots','dryness','oiliness','texture','redness','fine_lines','simplify','maintain']);
const answer = z.enum(['yes','no','unsure','unanswered','withheld']);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === v; }, 'Date is invalid');
const unique = <T>(items: T[]) => new Set(items).size === items.length;
const structuredAnswer = <T extends z.ZodType>(value:T) => z.discriminatedUnion('state',[z.strictObject({state:z.literal('known'),value}), ...(['unanswered','unsure','withheld'] as const).map(state=>z.strictObject({state:z.literal(state)}))]);
export const profileSchema = z.strictObject({
  texturePreference: structuredAnswer(z.enum(['lightweight','rich','no_preference'])).optional(),
  spendingPreference: structuredAnswer(z.strictObject({currency:z.string().regex(/^[A-Z]{3}$/),scope:z.enum(['per_product','routine']),amountMinor:z.number().int().nonnegative().max(100000000),period:z.enum(['purchase','month'])})).optional(),
  intent: z.enum(['add','replace','check_current','unanswered','withheld']), primaryGoal: goal.nullable(), secondaryGoals: z.array(goal).max(2).refine(unique),
  skinBehavior: z.enum(['dry_tight','comfortable','oily_shiny','combination','unsure','unanswered','withheld']),
  reactivity: z.enum(['reacts_easily','generally_tolerates','unsure','unanswered','withheld']),
  reproductive: z.strictObject({ pregnancy: answer, tryingToConceive: answer, nursing: answer }),
  sensitivities: z.strictObject({ status: z.enum(['none_known','reported','unsure','unanswered','withheld']), values: z.array(shortText(100)).max(10).refine(values => unique(values.map(value => value.toLowerCase()))) }).refine(v => (v.status === 'reported') === (v.values.length > 0)),
  treatments: z.strictObject({ status: z.enum(['none','reported','unsure','unanswered','withheld']), values: z.array(z.enum(['topical_retinoid','benzoyl_peroxide','exfoliating_acid','other_prescription'])).max(4).refine(unique) }).refine(v => (v.status === 'reported') === (v.values.length > 0)),
}).refine(v => !v.primaryGoal || !v.secondaryGoals.includes(v.primaryGoal));
export const referenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('catalog'), productId: uuid, variantId: uuid.nullable(), formulaVersionId: uuid.nullable() }).refine(v => v.formulaVersionId === null || v.variantId !== null),
  z.strictObject({ kind: z.literal('manual'), name: shortText(180), brand: shortText(120).optional() }),
]);
export const frequencySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('unknown') }),
  z.strictObject({ kind: z.literal('qualitative'), value: z.enum(['daily','most_days','few_times_week','weekly','less_often','as_needed']) }),
  z.strictObject({ kind: z.literal('exact'), count: z.number().finite().positive().max(100), unit: z.enum(['day','week','month']) }),
]);
const useFields = {
  timing: z.enum(['am','pm','both','unknown']), frequency: frequencySchema, startedOn: date.nullable(), stoppedOn: date.nullable(),
  duration: z.strictObject({ count: z.number().finite().positive().max(1000), unit: z.enum(['days','weeks','months','years']) }).nullable(),
};
const chronological = (v: { startedOn: string | null; stoppedOn: string | null }) => !v.startedOn || !v.stoppedOn || v.startedOn <= v.stoppedOn;
export const useContextSchema = z.strictObject(useFields).refine(chronological);
const itemSchema = z.strictObject({ id: uuid, reference: referenceSchema, state: z.enum(['current','paused','stopped','occasional']), ...useFields }).refine(chronological);
export const routineSchema = z.strictObject({ completeness: z.enum(['partial','complete','unknown']), items: z.array(itemSchema).max(50).refine(v => unique(v.map(i => i.id))) });
export const experienceSchema = z.strictObject({
  id: uuid, reference: referenceSchema, kind: z.enum(['reacted','tolerated','no_reaction_reported','liked','finished','ineffective']),
  occurred: z.strictObject({ start: date.nullable(), end: date.nullable() }).refine(v => !v.start || !v.end || v.start <= v.end),
  useContext: useContextSchema.nullable(), symptoms: z.array(shortText(100)).max(10).refine(unique), note: shortText(500).nullable(),
});
const writeFields = { requestId: uuid, baseRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) };
const requestSchema = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('get_context') }),
  z.strictObject({ operation: z.literal('get_revision'), revisionId: uuid }),
  z.strictObject({ operation: z.literal('get_experiences'), atRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), limit: z.number().int().min(1).max(50).optional(), cursor: uuid.optional(), productId: uuid.optional() }),
  z.strictObject({ operation: z.literal('save_profile'), ...writeFields, profile: profileSchema }),
  z.strictObject({ operation: z.literal('save_routine'), ...writeFields, routine: routineSchema }),
  z.strictObject({ operation: z.literal('append_experience'), ...writeFields, supersedesRevisionId: uuid.nullable(), experience: experienceSchema }),
]);
export class PersonalContextRequestError extends Error {}
export function parsePersonalContextRequest(value: unknown): PersonalContextRequest {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) throw new PersonalContextRequestError('Invalid personal context fields');
  return parsed.data as PersonalContextRequest;
}
