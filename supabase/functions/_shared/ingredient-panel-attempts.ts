import type { IngredientPanelAttemptReceipt, IngredientPanelFailure } from '../../../src/contracts/IngredientPanelAttempt.ts';
import type { PhotoExtractionAdapter, PhotoExtractionOutcome } from './photo-extraction-adapter.ts';

interface AttemptRpc {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
}
export interface IngredientPanelSubmission {
  userId: string;
  scanSessionId: string;
  requestId: string;
  requestFingerprint: string;
  storagePath: string;
  rootCaseId?: string;
  parentSnapshotId?: string;
}
export class IngredientPanelBoundaryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(conflict = false) {
    super(conflict ? 'This ingredient submission belongs to different evidence' : 'Ingredient processing is unavailable');
    this.code = conflict ? 'INGREDIENT_ATTEMPT_CONFLICT' : 'INGREDIENT_PROCESSING_UNAVAILABLE';
    this.status = conflict ? 409 : 503;
  }
}
export async function ingredientEvidenceFingerprint(storagePath: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`ingredients\u0000${storagePath}`));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
const reasons = new Set<IngredientPanelFailure>(['unreadable', 'conflicting_evidence', 'no_product_evidence', 'incomplete_panel', 'unconfirmed', 'unavailable']);
function checked(value: unknown): { decision: string; attemptsUsed: 1 | 2; reason?: IngredientPanelFailure; leaseId?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new IngredientPanelBoundaryError();
  const r = value as Record<string, unknown>;
  if ((r.attemptsUsed !== 1 && r.attemptsUsed !== 2) || !['reserved', 'replayed', 'busy', 'exhausted', 'settled'].includes(String(r.decision))
    || (r.decision === 'reserved' && (typeof r.leaseId !== 'string' || !/^[0-9a-f-]{36}$/i.test(r.leaseId)))
    || (r.decision !== 'reserved' && r.decision !== 'busy' && r.decision !== 'exhausted' && !reasons.has(r.reason as IngredientPanelFailure))) {
    throw new IngredientPanelBoundaryError();
  }
  return r as ReturnType<typeof checked>;
}
function failureFor(outcome: PhotoExtractionOutcome): IngredientPanelFailure {
  if (outcome.kind === 'retake') {
    // Ingredient capture must ask for the panel, not change roles to a front label.
    return outcome.reason === 'identity_not_visible' ? 'unconfirmed' : outcome.reason;
  }
  // Candidate identity is not a formula. Neither OCR ingredients nor confidence
  // scores are accepted by the truth writer from this boundary.
  return outcome.kind === 'catalog_lookup_required' ? 'unconfirmed' : 'unavailable';
}

/** Call only after server Auth, owner/root and private-object grant checks.
 * The production caller supplies no producer: no provider configuration, image
 * download, transport or endpoint activation is introduced here. The injected
 * decoder is a deterministic seam for the existing neutral adapter and tests.
 */
export async function processIngredientPanelAttempt(admin: AttemptRpc, input: IngredientPanelSubmission,
  observation?: { adapter: PhotoExtractionAdapter; raw: unknown }): Promise<IngredientPanelAttemptReceipt> {
  const args = { p_user_id: input.userId, p_scan_session_id: input.scanSessionId,
    p_root_case_id: input.rootCaseId ?? null, p_parent_snapshot_id: input.parentSnapshotId ?? null };
  const reserved = await admin.rpc('reserve_product_ingredient_panel', { ...args, p_request_id: input.requestId,
    p_request_fingerprint: input.requestFingerprint, p_evidence_fingerprint: await ingredientEvidenceFingerprint(input.storagePath) });
  if (reserved.error) throw new IngredientPanelBoundaryError(reserved.error.code === '23505' || reserved.error.code === '23514');
  let result = checked(reserved.data);
  if (result.decision === 'reserved') {
    let reason: IngredientPanelFailure = 'unavailable';
    try {
      if (observation) reason = failureFor(observation.adapter.decode(observation.raw,
        { evidenceId: await ingredientEvidenceFingerprint(input.storagePath), role: 'ingredients' }));
    } catch { /* Sanitized unavailable, with the reservation charge retained. */ }
    const settled = await admin.rpc('settle_product_ingredient_panel', { ...args, p_lease_id: result.leaseId, p_reason: reason });
    if (settled.error) throw new IngredientPanelBoundaryError();
    result = checked(settled.data);
    if (result.decision !== 'settled' && result.decision !== 'replayed') throw new IngredientPanelBoundaryError();
  }
  const outcome = result.decision === 'busy' ? 'in_progress' : result.attemptsUsed === 2 ? 'exhausted'
    : result.reason === 'unavailable' ? 'unavailable' : 'retake';
  return { kind: 'ingredient_panel_attempt', scanSessionId: input.scanSessionId, requestId: input.requestId,
    rootCaseId: input.rootCaseId ?? null, parentSnapshotId: input.parentSnapshotId ?? null,
    attemptsUsed: result.attemptsUsed, outcome, reason: result.decision === 'busy' ? 'unavailable' : result.reason ?? 'unavailable',
    fallbackActions: outcome === 'exhausted' ? ['product_link', 'verified_catalog', 'retry_later'] : [] };
}

/** Noncharging continuity registration, before an eligible Scan case is returned. */
export async function bindIngredientScanToCase(admin: AttemptRpc, input: {
  userId: string; scanSessionId: string; rootCaseId: string; parentSnapshotId: string;
}): Promise<void> {
  const result = await admin.rpc('bind_product_ingredient_scan', { p_user_id: input.userId, p_scan_session_id: input.scanSessionId,
    p_root_case_id: input.rootCaseId, p_parent_snapshot_id: input.parentSnapshotId });
  if (result.error || typeof result.data !== 'string' || !/^[0-9a-f-]{36}$/i.test(result.data)) {
    throw new IngredientPanelBoundaryError(result.error?.code === '23505' || result.error?.code === '23514');
  }
}
