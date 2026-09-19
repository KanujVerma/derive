/**
 * Shared weekly check-in helpers.
 *
 * Canonical context tags are CONTEXT, not proven causes.
 * Medication/supplement and cycle tags are historical context only.
 */
import {
  AdherenceLevelSchema,
  CHECK_IN_CONTEXT_TAGS,
  CheckInContextTagLabels,
  CheckInContextTagSchema,
  GoalSchema,
  IrritationLevelSchema,
  SkinStateSchema,
  type AdherenceLevel,
  type CheckIn,
  type CheckInContextTag,
  type Goal,
  type IrritationLevel,
  type SkinState,
} from '../types/schema.ts';
import type { CheckInInput, CheckInResult } from './types.ts';

export const CHECK_IN_NOTE_MAX_LENGTH = 4000;
export const CHECK_IN_CADENCE_MS = 7 * 24 * 60 * 60 * 1000;

export { CHECK_IN_CONTEXT_TAGS, CheckInContextTagLabels };

export type DbCheckInRow = {
  id?: unknown;
  user_id?: unknown;
  skin_state?: unknown;
  irritation?: unknown;
  notes?: unknown;
  context_tags?: unknown;
  context_note?: unknown;
  adherence?: unknown;
  primary_goal?: unknown;
  ai_analysis_sentence?: unknown;
  created_at?: unknown;
};

export function normalizeContextTags(tags: unknown): CheckInContextTag[] | null {
  if (tags == null) return [];
  if (!Array.isArray(tags)) return null;

  const seen = new Set<CheckInContextTag>();
  for (const tag of tags) {
    if (typeof tag !== 'string') return null;
    const parsed = CheckInContextTagSchema.safeParse(tag);
    if (!parsed.success) return null;
    seen.add(parsed.data);
  }

  return CHECK_IN_CONTEXT_TAGS.filter((tag) => seen.has(tag));
}

export function toggleContextTag(
  selected: readonly CheckInContextTag[],
  tag: CheckInContextTag
): CheckInContextTag[] {
  const next = new Set(selected);
  if (next.has(tag)) next.delete(tag);
  else next.add(tag);
  return CHECK_IN_CONTEXT_TAGS.filter((item) => next.has(item));
}

function optionalBoundedText(value: unknown): string | undefined | null {
  if (value == null) return undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > CHECK_IN_NOTE_MAX_LENGTH) return null;
  return trimmed;
}

export function isCheckInDueFromLatest(
  latestCreatedAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!latestCreatedAt) return true;
  const latestMs = Date.parse(latestCreatedAt);
  if (Number.isNaN(latestMs)) return true;
  return now.getTime() - latestMs >= CHECK_IN_CADENCE_MS;
}

export function authorCheckInAnalysis(input: {
  skinState: SkinState;
  irritation: IrritationLevel;
  hasContext: boolean;
}): { sentence: string; adjustmentProposed: boolean } {
  const adjustmentProposed = input.irritation !== 'none';

  let sentence: string;
  if (input.irritation !== 'none') {
    sentence =
      'Check-in recorded. You reported some irritation, so Derive will treat this as a tolerance signal.';
  } else if (input.skinState === 'worse') {
    sentence =
      'Check-in recorded. Your skin felt worse this week, and Derive will keep watching this trend.';
  } else {
    sentence = 'Check-in recorded. Your skin appears stable based on what you reported.';
  }

  if (input.hasContext) {
    sentence += ' Additional context recorded for longitudinal comparison.';
  }

  return { sentence, adjustmentProposed };
}

export function formatCheckInContextLine(tags: readonly CheckInContextTag[]): string | undefined {
  if (!tags.length) return undefined;
  return `Context: ${tags.map((tag) => CheckInContextTagLabels[tag]).join(' · ')}`;
}

export function memberReportedContextText(checkIn: Pick<CheckIn, 'contextNote' | 'notes'>): string | undefined {
  const preferred = checkIn.contextNote?.trim();
  if (preferred) return preferred;
  const legacy = checkIn.notes?.trim();
  return legacy || undefined;
}

export function buildCheckInSubmission(fields: {
  primaryGoal?: Goal;
  skinState: SkinState;
  irritation: IrritationLevel;
  adherence: AdherenceLevel;
  contextTags: readonly CheckInContextTag[];
  contextNote: string;
}): Omit<CheckInInput, 'userId'> {
  return {
    primaryGoal: fields.primaryGoal,
    skinState: fields.skinState,
    irritation: fields.irritation,
    adherence: fields.adherence,
    contextTags: [...fields.contextTags],
    contextNote: fields.contextNote.trim() || undefined,
  };
}

export function mapDbCheckIn(row: DbCheckInRow | null | undefined): CheckIn | null {
  if (!row) return null;
  if (typeof row.id !== 'string' || typeof row.user_id !== 'string') return null;
  if (typeof row.created_at !== 'string') return null;

  const skinState = SkinStateSchema.safeParse(row.skin_state);
  const irritation = IrritationLevelSchema.safeParse(row.irritation);
  if (!skinState.success || !irritation.success) return null;

  const contextTags = normalizeContextTags(row.context_tags ?? []);
  if (contextTags === null) return null;

  const notes = optionalBoundedText(row.notes);
  if (notes === null) return null;
  const contextNote = optionalBoundedText(row.context_note);
  if (contextNote === null) return null;

  let adherence: AdherenceLevel | undefined;
  if (row.adherence != null) {
    const parsed = AdherenceLevelSchema.safeParse(row.adherence);
    if (!parsed.success) return null;
    adherence = parsed.data;
  }

  let primaryGoal: Goal | undefined;
  if (row.primary_goal != null) {
    const parsed = GoalSchema.safeParse(row.primary_goal);
    if (!parsed.success) return null;
    primaryGoal = parsed.data;
  }

  const aiAnalysisSentence =
    typeof row.ai_analysis_sentence === 'string' && row.ai_analysis_sentence.trim()
      ? row.ai_analysis_sentence.trim()
      : undefined;

  const mapped: CheckIn = {
    id: row.id,
    userId: row.user_id,
    skinState: skinState.data,
    irritation: irritation.data,
    contextTags,
    adjustmentProposed: irritation.data !== 'none',
    createdAt: row.created_at,
  };

  if (primaryGoal) mapped.primaryGoal = primaryGoal;
  if (adherence) mapped.adherence = adherence;
  if (notes) mapped.notes = notes;
  if (contextNote) mapped.contextNote = contextNote;
  if (aiAnalysisSentence) mapped.aiAnalysisSentence = aiAnalysisSentence;

  return mapped;
}

export function mapCheckInResult(raw: unknown): CheckInResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const checkInSource = data.checkIn;
  if (!checkInSource || typeof checkInSource !== 'object') return null;

  const checkInObj = checkInSource as Record<string, unknown>;
  const mapped = mapDbCheckIn({
    id: checkInObj.id,
    user_id: checkInObj.userId ?? checkInObj.user_id,
    skin_state: checkInObj.skinState ?? checkInObj.skin_state,
    irritation: checkInObj.irritation,
    notes: checkInObj.notes,
    context_tags: checkInObj.contextTags ?? checkInObj.context_tags,
    context_note: checkInObj.contextNote ?? checkInObj.context_note,
    adherence: checkInObj.adherence,
    primary_goal: checkInObj.primaryGoal ?? checkInObj.primary_goal,
    ai_analysis_sentence: checkInObj.aiAnalysisSentence ?? checkInObj.ai_analysis_sentence,
    created_at: checkInObj.createdAt ?? checkInObj.created_at,
  });
  if (!mapped) return null;

  if (typeof data.aiAnalysisSentence === 'string' && data.aiAnalysisSentence.trim()) {
    mapped.aiAnalysisSentence = data.aiAnalysisSentence.trim();
  }

  const adjustmentProposed =
    typeof data.adjustmentProposed === 'boolean'
      ? data.adjustmentProposed
      : mapped.adjustmentProposed;
  mapped.adjustmentProposed = adjustmentProposed;

  const result: CheckInResult = {
    checkIn: mapped,
    aiAnalysisSentence: mapped.aiAnalysisSentence || 'Check-in recorded.',
    adjustmentProposed,
  };

  if (typeof data.proposedAdjustmentSummary === 'string' && data.proposedAdjustmentSummary.trim()) {
    result.proposedAdjustmentSummary = data.proposedAdjustmentSummary.trim();
  }

  return result;
}

export function containsForbiddenCausalCheckInCopy(text: string): boolean {
  const lowered = text.toLowerCase();
  const forbidden = [
    'caused your breakout',
    'caused your acne',
    'caused this flare',
    'diet is causing',
    'alcohol caused',
    'stress caused',
    'cycle caused',
    'cycle triggered',
    'your diet is causing',
    'stop medication',
    'change dose',
    'change schedule',
    'substitute prescription',
  ];
  return forbidden.some((phrase) => lowered.includes(phrase));
}
