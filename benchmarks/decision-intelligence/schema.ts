export const CONTRIBUTIONS = ['incremental', 'redundant', 'replacement_candidate', 'unclear'] as const;
export const OVERLAPS = ['none', 'partial', 'strong', 'unknown'] as const;
export type Contribution = typeof CONTRIBUTIONS[number];
export type Overlap = typeof OVERLAPS[number];

/** A non-authoritative signal. This schema has no customer action or safety decision. */
export interface SoftJudgmentV0 {
  routineContribution: Contribution;
  overlap: Overlap;
  needsMoreContext: boolean;
  abstain: boolean;
}

export function parseSoftJudgment(value: unknown): SoftJudgmentV0 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('SCHEMA_INVALID');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join(',') !== 'abstain,needsMoreContext,overlap,routineContribution' ||
      !CONTRIBUTIONS.includes(v.routineContribution as Contribution) ||
      !OVERLAPS.includes(v.overlap as Overlap) ||
      typeof v.needsMoreContext !== 'boolean' || typeof v.abstain !== 'boolean' ||
      (v.abstain && v.routineContribution !== 'unclear') ||
      (v.routineContribution === 'unclear' && !v.abstain) ||
      (v.overlap === 'unknown' && !v.needsMoreContext)) throw new Error('SCHEMA_INVALID');
  return v as unknown as SoftJudgmentV0;
}
