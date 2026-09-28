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
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error();
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 4 || keys.some(key => typeof key !== 'string') ||
        keys.sort().join(',') !== 'abstain,needsMoreContext,overlap,routineContribution') throw new Error();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const data = (key: keyof SoftJudgmentV0): unknown => {
      const descriptor = descriptors[key];
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) throw new Error();
      return descriptor.value;
    };
    const routineContribution = data('routineContribution');
    const overlap = data('overlap');
    const needsMoreContext = data('needsMoreContext');
    const abstain = data('abstain');
    if (!CONTRIBUTIONS.includes(routineContribution as Contribution) || !OVERLAPS.includes(overlap as Overlap) ||
        typeof needsMoreContext !== 'boolean' || typeof abstain !== 'boolean' ||
        (abstain && routineContribution !== 'unclear') ||
        (routineContribution === 'unclear' && !abstain) ||
        (overlap === 'unknown' && !needsMoreContext)) throw new Error();
    return { routineContribution: routineContribution as Contribution, overlap: overlap as Overlap, needsMoreContext, abstain };
  } catch {
    throw new Error('SCHEMA_INVALID');
  }
}
