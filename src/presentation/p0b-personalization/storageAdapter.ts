import type { PersonalProfileInput, PersonalRoutineInput, PersonalExperienceInput, ContextProductReference, ReportedUseContext } from '../../contracts/PersonalContext.ts';
import type { ContextDraft, Answer, ListAnswer, RoutineDraft, RoutineReference } from './draft.ts';
import { createContextDraft } from './draft.ts';
import type { ExperienceDraft } from './experience.ts';
const assertNever = (value: never): never => { throw new Error(`Unsupported context value ${String(value)}`); };
function fromAnswer<T>(answer: Answer<T>): T | 'unanswered' | 'withheld' {
  switch (answer.state) { case 'answered': return answer.value; case 'unanswered': return 'unanswered'; case 'withheld': return 'withheld'; default: return assertNever(answer); }
}
function toAnswer<T>(value: T | 'unanswered' | 'withheld'): Answer<T> { return value === 'unanswered' ? { state: 'unanswered' } : value === 'withheld' ? { state: 'withheld' } : { state: 'answered', value };  }
function fromList<T, N extends 'none' | 'none_known'>(answer: ListAnswer<T>, none: N): { status: N | 'reported' | 'unsure' | 'unanswered' | 'withheld'; values: T[] } {
  switch (answer.state) { case 'answered': return { status: answer.value.length ? 'reported' : none, values: [...answer.value] }; case 'unsure': case 'unanswered': case 'withheld': return { status: answer.state, values: [] }; default: return assertNever(answer); }
}
function toList<T>(status: 'none' | 'none_known' | 'reported' | 'unsure' | 'unanswered' | 'withheld', values: T[]): ListAnswer<T> {
  switch (status) { case 'none': case 'none_known': return { state: 'answered', value: [] }; case 'reported': return { state: 'answered', value: [...values] }; case 'unsure': case 'unanswered': case 'withheld': return { state: status }; default: return assertNever(status); }
}
export function profileToStorage(draft: ContextDraft): PersonalProfileInput {
  const behavior = fromAnswer(draft.behavior);
  return { intent: fromAnswer(draft.intent), primaryGoal: draft.primaryGoal.state === 'answered' ? draft.primaryGoal.value : null, secondaryGoals: [...draft.secondaryGoals], skinBehavior: behavior === 'balanced' ? 'comfortable' : behavior === 'oily' ? 'oily_shiny' : behavior, reactivity: fromAnswer(draft.reactivity), reproductive: { pregnancy: fromAnswer(draft.pregnancy), tryingToConceive: fromAnswer(draft.trying), nursing: fromAnswer(draft.nursing) }, treatments: fromList(draft.treatments, 'none'), sensitivities: fromList(draft.sensitivities, 'none_known') };
}
export function profileFromStorage(profile: PersonalProfileInput): ContextDraft {
  return { ...createContextDraft(), intent: toAnswer(profile.intent), primaryGoal: profile.primaryGoal ? { state: 'answered', value: profile.primaryGoal } : { state: 'unanswered' }, secondaryGoals: [...profile.secondaryGoals], behavior: toAnswer(profile.skinBehavior === 'comfortable' ? 'balanced' : profile.skinBehavior === 'oily_shiny' ? 'oily' : profile.skinBehavior), reactivity: toAnswer(profile.reactivity), pregnancy: toAnswer(profile.reproductive.pregnancy), trying: toAnswer(profile.reproductive.tryingToConceive), nursing: toAnswer(profile.reproductive.nursing), treatments: toList(profile.treatments.status, profile.treatments.values), sensitivities: toList(profile.sensitivities.status, profile.sensitivities.values) };
}
/** Manual brand metadata survives edits; product labels never establish identity. */
export function referenceToStorage(reference: RoutineReference): ContextProductReference {
  switch (reference.kind) {
    case 'manual': { const brand = 'brand' in reference && typeof reference.brand === 'string' ? reference.brand : undefined; return { kind: 'manual', name: reference.label, ...(brand ? { brand } : {}) }; }
    case 'catalog': return { kind: 'catalog', productId: reference.productId, variantId: reference.variantId, formulaVersionId: reference.formulaVersionId };
    default: return assertNever(reference);
  }
}
export function referenceFromStorage(reference: ContextProductReference): RoutineReference {
  switch (reference.kind) { case 'manual': return { ...reference, label: reference.name, verification: 'unverified' }; case 'catalog': return { ...reference, label: 'Saved catalog product' }; default: return assertNever(reference); }
}
function copyUse(use: Partial<ReportedUseContext> & Pick<ReportedUseContext, 'timing' | 'frequency'>): ReportedUseContext { return { timing: use.timing, frequency: { ...use.frequency }, startedOn: use.startedOn ?? null, stoppedOn: use.stoppedOn ?? null, duration: use.duration ? { ...use.duration } : null }; }
export function routineToStorage(draft: RoutineDraft): PersonalRoutineInput { return { completeness: draft.completeness, items: draft.items.map(item => ({ id: item.id, state: item.status, reference: referenceToStorage(item.reference), ...copyUse(item) })) }; }
export function routineFromStorage(routine: PersonalRoutineInput): RoutineDraft { return { completeness: routine.completeness, items: routine.items.map(item => ({ id: item.id, status: item.state, reference: referenceFromStorage(item.reference), ...copyUse(item) })) }; }
export function experienceToStorage(draft: ExperienceDraft): PersonalExperienceInput { if (!draft.kind) throw new Error('Choose what you experienced.'); return { id: draft.id, reference: referenceToStorage(draft.reference), kind: draft.kind, occurred: { ...draft.occurred }, useContext: draft.useContext ? copyUse(draft.useContext) : null, symptoms: [...draft.symptoms], note: draft.note }; }
export function experienceFromStorage(experience: PersonalExperienceInput): ExperienceDraft { return { id: experience.id, reference: referenceFromStorage(experience.reference), kind: experience.kind, occurred: { ...experience.occurred }, useContext: experience.useContext ? copyUse(experience.useContext) : null, symptoms: [...experience.symptoms], note: experience.note }; }
