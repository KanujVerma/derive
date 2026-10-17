/** A processing receipt only. It contains no product truth, formula or verdict. */
export type IngredientPanelFailure = 'unreadable' | 'conflicting_evidence' | 'no_product_evidence' | 'incomplete_panel' | 'unconfirmed' | 'unavailable';
export interface IngredientPanelAttemptReceipt {
  kind: 'ingredient_panel_attempt';
  scanSessionId: string;
  requestId: string;
  rootCaseId: string | null;
  parentSnapshotId: string | null;
  attemptsUsed: 1 | 2;
  outcome: 'retake' | 'unavailable' | 'exhausted' | 'in_progress';
  reason: IngredientPanelFailure;
  fallbackActions: readonly ('product_link' | 'verified_catalog' | 'retry_later')[];
}

export type IngredientPanelReceiptBinding = Pick<IngredientPanelAttemptReceipt, 'scanSessionId' | 'requestId'> & {
  rootCaseId?: string | null; parentSnapshotId?: string | null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reasons = new Set<IngredientPanelFailure>(['unreadable', 'conflicting_evidence', 'no_product_evidence', 'incomplete_panel', 'unconfirmed', 'unavailable']);
const fields = ['kind', 'scanSessionId', 'requestId', 'rootCaseId', 'parentSnapshotId', 'attemptsUsed', 'outcome', 'reason', 'fallbackActions'];
const fallbacks = ['product_link', 'verified_catalog', 'retry_later'];

export function parseIngredientPanelAttemptReceipt(value: unknown, expected: IngredientPanelReceiptBinding): IngredientPanelAttemptReceipt {
  const fail = (): never => { throw new Error('Ingredient processing could not be confirmed'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const r = value as IngredientPanelAttemptReceipt;
  if (Object.keys(r).length !== fields.length || Object.keys(r).some(key => !fields.includes(key))
    || r.kind !== 'ingredient_panel_attempt' || !UUID.test(r.scanSessionId) || !UUID.test(r.requestId)
    || r.scanSessionId !== expected.scanSessionId || r.requestId !== expected.requestId
    || (r.rootCaseId !== null && (typeof r.rootCaseId !== 'string' || !UUID.test(r.rootCaseId)))
    || (r.parentSnapshotId !== null && (typeof r.parentSnapshotId !== 'string' || !UUID.test(r.parentSnapshotId)))
    || (r.rootCaseId === null) !== (r.parentSnapshotId === null)
    || r.rootCaseId !== (expected.rootCaseId ?? null) || r.parentSnapshotId !== (expected.parentSnapshotId ?? null)
    || (r.attemptsUsed !== 1 && r.attemptsUsed !== 2) || !reasons.has(r.reason)
    || !['retake', 'unavailable', 'exhausted', 'in_progress'].includes(r.outcome)
    || (r.outcome === 'exhausted' && r.attemptsUsed !== 2)
    || (r.attemptsUsed === 2 && r.outcome !== 'exhausted' && r.outcome !== 'in_progress')
    || (r.outcome === 'unavailable' && r.reason !== 'unavailable')
    || (r.outcome === 'in_progress' && r.reason !== 'unavailable')
    || !Array.isArray(r.fallbackActions)
    || (r.outcome === 'exhausted' ? r.fallbackActions.length !== 3 || r.fallbackActions.some((v, i) => v !== fallbacks[i]) : r.fallbackActions.length !== 0)) return fail();
  return Object.freeze({ ...r, fallbackActions: Object.freeze([...r.fallbackActions]) });
}

/** The catalog service uses this typed, sanitized signal instead of a fake S6 case. */
export class IngredientPanelAttemptResponseError extends Error {
  readonly receipt: IngredientPanelAttemptReceipt;
  constructor(receipt: IngredientPanelAttemptReceipt) {
    super('Ingredient panel processing did not establish a verified formula');
    this.name = 'IngredientPanelAttemptResponseError';
    this.receipt = receipt;
  }
}
