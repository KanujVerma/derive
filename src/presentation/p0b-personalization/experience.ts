import type { RoutineFrequency, RoutineReference } from './draft';
export type ExperienceKind = 'reacted' | 'tolerated' | 'no_reaction_reported' | 'liked' | 'finished' | 'ineffective';
export interface ReportedUseDraft {
  timing: 'am' | 'pm' | 'both' | 'unknown'; frequency: RoutineFrequency;
  startedOn: string | null; stoppedOn: string | null;
  duration: { count: number; unit: 'days' | 'weeks' | 'months' | 'years' } | null;
}
export interface ExperienceDraft {
  id: string; reference: RoutineReference; kind: ExperienceKind | null;
  occurred: { start: string | null; end: string | null }; useContext: ReportedUseDraft | null;
  symptoms: string[]; note: string | null;
}
export interface ExperienceEdit { draft: ExperienceDraft; supersedesRevisionId: string | null }
export function createExperienceDraft(id: string, initial?: ExperienceDraft): ExperienceDraft {
  return initial ? { ...initial, reference: { ...initial.reference }, occurred: { ...initial.occurred }, useContext: initial.useContext ? { ...initial.useContext, frequency: { ...initial.useContext.frequency }, duration: initial.useContext.duration ? { ...initial.useContext.duration } : null } : null, symptoms: [...initial.symptoms] } : { id, reference: { kind: 'manual', label: '', verification: 'unverified' }, kind: null, occurred: { start: null, end: null }, useContext: null, symptoms: [], note: null };
}
export function prepareExperienceEdit(initial: ExperienceDraft, revisionId: string): ExperienceEdit {
  return { draft: createExperienceDraft(initial.id, initial), supersedesRevisionId: revisionId };
}
export function unknownUseContext(): ReportedUseDraft { return { timing: 'unknown', frequency: { kind: 'unknown' }, startedOn: null, stoppedOn: null, duration: null }; }
export function validReportedDate(value: string | null): boolean {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateReportedUse(use: ReportedUseDraft): string | null {
  if (!validReportedDate(use.startedOn) || !validReportedDate(use.stoppedOn)) return 'Enter a real date as YYYY-MM-DD, or leave it blank.';
  if (use.startedOn && use.stoppedOn && use.startedOn > use.stoppedOn) return 'The end date must be on or after the start date.';
  if (use.frequency.kind === 'exact' && (!Number.isFinite(use.frequency.count) || use.frequency.count <= 0 || use.frequency.count > 100)) return 'Use an exact count from 1 to 100.';
  if (use.duration && (!Number.isFinite(use.duration.count) || use.duration.count <= 0 || use.duration.count > 1000)) return 'Use a duration count from 1 to 1000.';
  return null;
}
export function validateExperienceDraft(draft: ExperienceDraft): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(draft.id)) return 'A report needs a valid UUID.';
  if (!draft.reference.label.trim() || draft.reference.label.trim().length > 180) return 'Enter a product name of up to 180 characters.';
  if (draft.reference.kind === 'catalog' && draft.reference.formulaVersionId && !draft.reference.variantId) return 'A formula reference needs its variant reference.';
  if (!draft.kind) return 'Choose what you experienced.';
  if (!validReportedDate(draft.occurred.start) || !validReportedDate(draft.occurred.end)) return 'Enter a real date as YYYY-MM-DD, or leave it blank.';
  if (draft.occurred.start && draft.occurred.end && draft.occurred.start > draft.occurred.end) return 'The end date must be on or after the start date.';
  if (draft.symptoms.length > 10 || new Set(draft.symptoms).size !== draft.symptoms.length || draft.symptoms.some(value => !value.trim() || value.length > 100 || /[\x00-\x1f\x7f]/.test(value))) return 'Use up to ten distinct symptoms, each up to 100 characters.';
  if (draft.note !== null && (!draft.note.trim() || draft.note.length > 500 || /[\x00-\x1f\x7f]/.test(draft.note))) return 'Use a note of up to 500 characters.';
  return draft.useContext ? validateReportedUse(draft.useContext) : null;
}
/** A name identifies a product family, not the formula used in a historical report. */
export function selectExperienceCatalogProduct(reference: Extract<RoutineReference, { kind: 'catalog' }>): Extract<RoutineReference, { kind: 'catalog' }> {
  return { kind: 'catalog', label: reference.label, productId: reference.productId, variantId: null, formulaVersionId: null };
}
export function unambiguousExperiencePackage(productId: string, available: readonly Extract<RoutineReference, { kind: 'catalog' }>[]): Extract<RoutineReference, { kind: 'catalog' }> | null {
  const exact = new Map(available.filter(reference => reference.productId === productId && reference.variantId && reference.formulaVersionId).map(reference => [reference.variantId + ':' + reference.formulaVersionId, reference]));
  return exact.size === 1 ? [...exact.values()][0] : null;
}
/** This function is invoked only by the customer's separate package/formula confirmation. */
export function confirmExperiencePackage(reference: Extract<RoutineReference, { kind: 'catalog' }>, available: readonly Extract<RoutineReference, { kind: 'catalog' }>[]): Extract<RoutineReference, { kind: 'catalog' }> {
  const exact = unambiguousExperiencePackage(reference.productId, available);
  return exact ? { ...reference, variantId: exact.variantId, formulaVersionId: exact.formulaVersionId } : reference;
}
