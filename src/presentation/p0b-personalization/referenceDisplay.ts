import type { RoutineReference } from './draft.ts';
/** Optional labels affect presentation only, and never replace a report's saved reference. */
export function referenceDisplayLabel(reference: RoutineReference, available: readonly Extract<RoutineReference, { kind: 'catalog' }>[]): string {
  if (reference.kind === 'manual') return reference.label;
  return available.find(item => item.productId === reference.productId && item.variantId === reference.variantId && item.formulaVersionId === reference.formulaVersionId)?.label ?? reference.label;
}
