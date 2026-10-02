import type { ContextGoal, ContextProductReference, PersonalContextRevision, PersonalContextSnapshot, PersonalExperienceInput, PersonalProfileInput, ReportedFrequency } from './PersonalContext.ts';
/** Unknown, unsure and withheld are distinct; none is represented by domain values. */
export type Answer<T> = { state: 'known'; value: T } | { state: 'unanswered' } | { state: 'unsure' } | { state: 'withheld' };
export type PurposeId = 'moisturizing' | 'cleansing' | 'sun_protection' | 'other';
export type ApplicationSite = 'face' | 'body' | 'hands' | 'scalp' | 'lips' | 'eye_area' | 'other';
export type UseForm = 'leave_on' | 'rinse_off' | 'other';
export interface ReportedAnswer<T> { answer: Answer<T>; provenance: 'self_report' }
export type ReportedDate = Answer<{ value: string; precision: 'day' | 'month' | 'year' }>;
export interface PersonalProfileV2 extends Omit<PersonalProfileInput, 'primaryGoal'> { primaryGoal: Answer<ContextGoal> }
export interface ReportedUseContextV2 {
  timing: 'am' | 'pm' | 'both' | 'unknown'; frequency: ReportedFrequency;
  startedOn: ReportedDate; stoppedOn: ReportedDate;
  duration: { count: number; unit: 'days' | 'weeks' | 'months' | 'years' } | null;
  reportedPurpose?: ReportedAnswer<PurposeId>; applicationSite?: ReportedAnswer<ApplicationSite>; useForm?: ReportedAnswer<UseForm>;
}
export interface PersonalRoutineItemV2 extends ReportedUseContextV2 { id: string; reference: ContextProductReference; state: 'current' | 'paused' | 'stopped' | 'occasional' }
export interface PersonalRoutineV2 { completeness: 'partial' | 'complete' | 'unknown'; items: PersonalRoutineItemV2[] }
export interface PersonalExperienceV2 extends Omit<PersonalExperienceInput, 'useContext' | 'occurred'> { occurred:{start:ReportedDate;end:ReportedDate};useContext: ReportedUseContextV2 | null }
export type PreferenceTarget = { kind: 'ingredient'; identity: { kind: 'resolved'; ingredientId: string } | { kind: 'unresolved'; originalTerm: string } } | { kind: 'product'; reference: ContextProductReference } | { kind: 'routine' };
export interface ConfirmedPreference {
  id: string; revision: number; kind: 'avoid_ingredient' | 'avoid_product' | 'no_extra_step'; target: PreferenceTarget;
  strength: 'decisive' | 'prefer'; status: 'confirmed'; confirmedAt: string;
  source: { kind: 'structured' } | { kind: 'note'; noteId: string; noteRevisionId: string; supportingSpan: string; adoptedIndependently: boolean };
}
export interface ProductAssessment {
  id: string; reference: ContextProductReference; useContext: ReportedUseContextV2;
  reportingPeriod: { start: ReportedDate; end: ReportedDate };
  goalOrPurpose: Answer<ContextGoal | PurposeId>;
  perceivedHelp: 'helps' | 'mixed' | 'not_helping' | 'unsure' | 'unanswered' | 'withheld';
  satisfaction: 'satisfied' | 'mixed' | 'dissatisfied' | 'unsure' | 'unanswered' | 'withheld';
  assessedAt: string; supersedesRevisionId?: string | null;
}
export interface ContextNoteInput { id: string; scope: 'profile' | 'routine_item' | 'experience'; targetRef: string | null; text: string }
export type ContextNote = PersonalContextRevision<ContextNoteInput>;
export interface SetupPayloadV2 {
  profile: PersonalProfileV2; routine: PersonalRoutineV2; experiences: PersonalExperienceV2[];
  preferences: ConfirmedPreference[]; assessments: ProductAssessment[]; notes: ContextNoteInput[];
  setupAnswers: { currentProducts: 'unanswered' | 'none' | 'unsure' | 'reported'; pastProducts: 'unanswered' | 'none' | 'unsure' | 'reported' };
}
export interface PersonalContextV2 {
  version: 'personal-context-v2'; ownerId: string; revision: number;
  profile: PersonalContextRevision<PersonalProfileV2> | null; routine: PersonalContextRevision<PersonalRoutineV2> | null;
  experiences: PersonalContextRevision<PersonalExperienceV2>[]; preferences: PersonalContextRevision<ConfirmedPreference>[];
  assessments: PersonalContextRevision<ProductAssessment>[]; notes: ContextNote[];
  historyTruncated: boolean; historyRevision: string | null; legacy: PersonalContextSnapshot['legacy'];
  setupRevision: string | null; setupAnswers: SetupPayloadV2['setupAnswers'] | null;
}
export type PersonalContextV2Request = { operation: 'read_context_v2' } | { operation: 'save_setup'; requestId: string; baseContextRevision: number; setup: SetupPayloadV2 } | { operation: 'delete_context_record'; requestId: string; baseContextRevision: number; record: { kind: 'profile' | 'routine_item' | 'experience' | 'assessment' | 'note' | 'preference'; id: string | null } };
export interface SetupWriteResult { contextRevision: number; revisionReferences: { setup: string; profile: string; routine: string; experiences: Record<string,string>; preferences: Record<string,string>; assessments: Record<string,string>; notes: Record<string,string> }; replayed: boolean }
export interface ContextDeleteResult { contextRevision: number; deletedRevisionIds: string[]; replayed: boolean }
