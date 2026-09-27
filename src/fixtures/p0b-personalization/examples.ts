import { createContextDraft, createRoutineDraft, manualRoutineItem, type ContextDraft, type RoutineDraft } from '../../presentation/p0b-personalization/draft';
/** Composition examples only. These are not a customer's stored context. */
export const basicContext: ContextDraft = { ...createContextDraft(), intent: { state: 'answered', value: 'add' }, primaryGoal: { state: 'answered', value: 'redness' }, reactivity: { state: 'answered', value: 'reacts_easily' }, treatments: { state: 'answered', value: [] }, sensitivities: { state: 'withheld' } };
export const partialRoutine: RoutineDraft = { ...createRoutineDraft(), completeness: 'partial', items: [{ ...manualRoutineItem('00000000-0000-4000-8000-000000000001', 'My moisturizer'), timing: 'pm', frequency: { kind: 'qualitative', value: 'few_times_week' } }] };
/** Report-only example: unknown date/formula and no asserted tolerance. */
export const noReactionReport = { id: '00000000-0000-4000-8000-000000000002', reference: { kind: 'manual' as const, label: 'My cream', verification: 'unverified' as const }, kind: 'no_reaction_reported' as const, occurred: { start: null, end: null }, useContext: null, symptoms: [], note: null };
