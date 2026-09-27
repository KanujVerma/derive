import { createContextDraft, createRoutineDraft, manualRoutineItem, type ContextDraft, type RoutineDraft } from '../../presentation/p0b-personalization/draft';
/** Composition examples only. These are not a customer's stored context. */
export const basicContext: ContextDraft = { ...createContextDraft(), intent: { state: 'answered', value: 'add' }, primaryGoal: { state: 'answered', value: 'comfort' }, reactivity: { state: 'answered', value: 'reacts_easily' }, treatments: { state: 'answered', value: [] }, sensitivities: { state: 'withheld' } };
export const partialRoutine: RoutineDraft = { ...createRoutineDraft(), completeness: 'partial', items: [{ ...manualRoutineItem('manual-1', 'My moisturizer'), timing: 'pm', frequency: { kind: 'qualitative', value: 'few_times_weekly' } }] };
