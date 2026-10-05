import { CaptureSessionSchema, ScanResultSchema } from '../../contracts/PartOne.ts';
import type { CaptureSession, ScanResult, SaveRequest } from '../../contracts/PartOne.ts';
import { CapturePrivateCommitRequestSchema, CaptureRecoverySchema, PrivateCaptureCapabilitySchema } from '../../contracts/PartOnePrivate.ts';
import type { CapturePrivateCommitRequest, CaptureRecovery, PrivateCaptureCapability } from '../../contracts/PartOnePrivate.ts';
import type { PartOnePrivateTransport } from '../../services/partOnePrivateClient.ts';
import type { PreparedLabelUpload, LabelDerivativeOcrBinding } from '../../services/partOneUpload.ts';
import type { CaptureDraft, CaptureBinding } from './capture.ts';
import type { DraftLineRef } from './captureReview.ts';

export type PrivateCaptureStage = 'disabled' | 'temporary' | 'checking_policy' | 'disclosure' | 'uploading' | 'committing' | 'saving' |
  'saved_partial' | 'saved_accepted' | 'recovering' | 'removing' | 'removed' | 'conflict' | 'unavailable';
export type PrivateCaptureState = { ownerId: string | null; stage: PrivateCaptureStage; capture: CaptureSession | null;
  result: ScanResult | null; recovery: CaptureRecovery | null; capability: PrivateCaptureCapability | null;
  error: string | null; saveId: string | null; pendingEdits: CapturePrivateCommitRequest['edits']; photoRoles: Record<string, 'ingredients' | 'package'>; disclosureAccepted: boolean };
type Intent = { idempotencyKey: string; capture: CaptureSession; result: ScanResult; draft: CaptureDraft | null;
  sourceObservations: CapturePrivateCommitRequest['sourceObservations']; edits: CapturePrivateCommitRequest['edits'];
  assets: CapturePrivateCommitRequest['assets']; review: CapturePrivateCommitRequest['review']; request: CapturePrivateCommitRequest | null; cleanupStarted: boolean; uploaded: boolean };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const busy = (stage: PrivateCaptureStage) => ['checking_policy','uploading','committing','saving','recovering','removing'].includes(stage);
const draftContent = (draft: CaptureDraft) => JSON.stringify([draft.captureEpoch, draft.binding, draft.shots, draft.edits, draft.coverage, draft.review]);
const sameCapture = (a: CaptureSession, b: CaptureSession) => a.captureSessionId === b.captureSessionId && a.scanId === b.scanId &&
  a.generation === b.generation && a.packageObservationId === b.packageObservationId && a.deletionEpoch === b.deletionEpoch && a.itemId === b.itemId && a.candidateId === b.candidateId;
function savedStage(recovery: CaptureRecovery): 'saved_partial' | 'saved_accepted' {
  const result = recovery.boundResult ?? recovery.result;
  return result.scope === 'private_package' && result.declarationState === 'accepted' && result.conflictIds.length === 0 &&
    result.freshness.state === 'fresh' && Boolean(result.freshness.expiresAt && Date.parse(result.freshness.expiresAt) > Date.now()) ? 'saved_accepted' : 'saved_partial';
}
/** No persistent outbox/cache. Every action is explicit, owner-bound and fenced by its operation epoch. */
export function createPrivateCaptureController(options: { enabled: boolean; transport: PartOnePrivateTransport;
  sanitize: (uri: string, cropRegion: number[], binding?: LabelDerivativeOcrBinding) => Promise<PreparedLabelUpload>; currentOwner: () => string | null;
  currentDraft?: () => CaptureDraft | null; createId: () => string; now?: () => number;
  reviewId?: string | (() => string | null); onSaved?: (recovery: CaptureRecovery, saveId: string | null) => void; onRemoved?: (id: string) => void }) {
  const now = options.now ?? Date.now; let retentionTimer: ReturnType<typeof setTimeout> | null = null; let expiryNotificationPending = false; let epoch = 0, active: AbortController | null = null, intent: Intent | null = null;
  let state: PrivateCaptureState = { ownerId: null, stage: options.enabled ? 'temporary' : 'disabled', capture: null, result: null,
    recovery: null, capability: null, error: null, saveId: null, pendingEdits: [], photoRoles: {}, disclosureAccepted: false };
  const listeners = new Set<() => void>();
  const update = (next: Partial<PrivateCaptureState>, defer = false) => {
    if ('recovery' in next && next.recovery !== state.recovery && retentionTimer) { clearTimeout(retentionTimer); retentionTimer = null; }
    state = { ...state, ...next };
    if (!defer) { for (const listener of [...listeners]) listener(); }
    else if (!expiryNotificationPending) { expiryNotificationPending = true; void Promise.resolve().then(() => {
      expiryNotificationPending = false; for (const listener of [...listeners]) listener();
    }); }
  };
  const stop = () => { epoch++; active?.abort(); active = null; };
  const begin = () => { stop(); active = new AbortController(); return { token: epoch, signal: active.signal, owner: state.ownerId }; };
  const current = (operation: { token: number; owner: string | null; signal: AbortSignal }) => operation.token === epoch && !operation.signal.aborted &&
    operation.owner !== null && operation.owner === state.ownerId && operation.owner === options.currentOwner();
  const expireRecoveryIfNeeded = () => {
    if (!state.recovery || privateRecoveryRetentionDeadline(state.recovery) > now()) return false;
    stop(); intent = null; update({ stage: 'conflict', recovery: null, result: null, pendingEdits: [], photoRoles: {}, disclosureAccepted: false,
      error: 'Private evidence retention expired. Reopen to request currently permitted evidence.' }, true); return true;
  };
  const scheduleRecoveryExpiry = () => {
    if (retentionTimer) clearTimeout(retentionTimer);
    const deadline = state.recovery ? privateRecoveryRetentionDeadline(state.recovery) : Infinity;
    if (!Number.isFinite(deadline)) return;
    if (expireRecoveryIfNeeded()) return;
    retentionTimer = setTimeout(scheduleRecoveryExpiry, Math.min(60000, Math.max(1, deadline - now())));
    if (typeof retentionTimer === 'object' && 'unref' in retentionTimer) retentionTimer.unref();
  };
  const policyCurrent = () => Boolean(options.enabled && state.capability?.enabled && state.capability.expiresAt && Date.parse(state.capability.expiresAt) > now());
  const fail = (operation: ReturnType<typeof begin>, error: unknown) => {
    if (!current(operation)) return;
    const code = error instanceof Error ? error.message : '';
    const uncertainCommit = ['committing','saving'].includes(state.stage), changed = code.toLowerCase().includes('revision changed') || code.includes('binding_changed') || code === 'private_draft_changed';
    update({ ...(uncertainCommit || changed ? { recovery: null, result: null, pendingEdits: [] } : {}), stage: code.toLowerCase().includes('revision changed') || code.includes('binding_changed') || code === 'private_draft_changed' ? 'conflict' : 'unavailable',
      error: code === 'private_draft_changed' ? 'This draft changed while saving. Review its current text and start a new save.' :
        code.toLowerCase().includes('revision changed') || code.includes('binding_changed') ? 'The product or private evidence changed. Reopen and review before saving again.' :
        'Private evidence could not be saved or read. Nothing is queued on this device. Retry when connected.', disclosureAccepted: false });
  };
  const verify = (operation: ReturnType<typeof begin>, expected: CaptureSession, response?: CaptureSession) => {
    expireRecoveryIfNeeded();
    if (!current(operation)) throw new Error('private_capture_cancelled');
    if (response && !sameCapture(expected, response)) throw new Error('private_binding_changed');
    if (intent?.draft && options.currentDraft) {
      const actual = options.currentDraft(); if (!actual || draftContent(actual) !== draftContent(intent.draft)) throw new Error('private_draft_changed');
    }
  };
  function snapshotIntent(draft: CaptureDraft | null, capture: CaptureSession, result: ScanResult): Intent {
    if (draft && (draft.binding.ownerId !== state.ownerId || draft.binding.captureSessionId !== capture.captureSessionId ||
      draft.binding.packageObservationId !== capture.packageObservationId || draft.binding.generation !== capture.generation ||
      draft.binding.scanId !== capture.scanId || draft.binding.itemId !== capture.itemId || draft.binding.deletionEpoch !== capture.deletionEpoch)) throw new Error('private_binding_changed');
    const sourceObservations = draft ? draft.shots.flatMap(shot => shot.observations.map(observation => ({ observationId: options.createId(), revision: 1 as const, role: state.photoRoles[shot.evidenceId] ?? 'ingredients', coordinateSpace: 'source_original' as const, derivedFromObservationIds: [], observation: clone(observation) }))) : clone(state.recovery?.sourceObservations ?? []);
    const edits: CapturePrivateCommitRequest['edits'] = draft ? [] : [...clone(state.recovery?.edits ?? []).map(({ actorOwnerId: _owner, ...edit }) => edit), ...clone(state.pendingEdits)];
    if (draft) {
      const sourceIds = new Map<string,string>(); let at = 0;
      for (const shot of draft.shots) for (let observationIndex = 0; observationIndex < shot.observations.length; observationIndex++) sourceIds.set(`${shot.evidenceId}:${observationIndex}`, sourceObservations[at++].observationId);
      const previous = new Map<string,{ id: string; revision: number; lines: string[] }>();
      for (const edit of draft.edits) {
        const base = sourceIds.get(`${edit.observationEvidenceId}:${edit.observationIndex}`); if (!base) throw new Error('private_binding_changed');
        const key = `${edit.observationEvidenceId}:${edit.observationIndex}`, prior = previous.get(key), observationId = options.createId();
        const lines = prior ? [...prior.lines] : sourceObservations.find(value => value.observationId === base)!.observation.lines.map(line => line.text);
        if (edit.lineIndex === null) { lines.splice(0, lines.length, ...edit.text.split('\n')); } else lines[edit.lineIndex] = edit.text;
        edits.push({ observationId, supersedesId: prior?.id ?? base, revision: (prior?.revision ?? 1) + 1, text: lines.join('\n'), ...{ replacementText: edit.text },
          reason: 'Operator correction of the photographed label; original recognition retained',
          sourceRef: edit.lineIndex === null ? null : { evidenceId: edit.observationEvidenceId, observationIndex: edit.observationIndex, lineIndex: edit.lineIndex } });
        previous.set(key, { id: observationId, revision: (prior?.revision ?? 1) + 1, lines });
      }
    }
    return { idempotencyKey: options.createId(), capture: clone(capture), result: clone(result), draft: draft ? clone(draft) : null,
      sourceObservations, edits, assets: draft ? [] : clone(state.recovery?.assets.map(value => value.asset) ?? []),
      review: draft ? { reviewState: clone(draft.review), coverage: clone(draft.coverage) } : clone(state.recovery?.review ?? null), request: null, cleanupStarted: false, uploaded: false };
  }
  async function disclose(draft: CaptureDraft | null, capture: CaptureSession, result: ScanResult) {
    if (!options.enabled || !state.ownerId || state.ownerId !== options.currentOwner() || busy(state.stage)) return false;
    const operation = begin(); update({ stage: 'checking_policy', error: null, disclosureAccepted: false });
    try {
      const capability = PrivateCaptureCapabilitySchema.parse(await options.transport.capability(operation.signal));
      verify(operation, capture); update({ capability });
      if (!capability.enabled || !capability.expiresAt || Date.parse(capability.expiresAt) <= now()) {
        intent = null; update({ stage: 'disabled', recovery: null, result: null, pendingEdits: [], error: 'Private upload and retention are disabled. Your temporary draft remains unsaved.' }); return false;
      }
      intent = snapshotIntent(draft, capture, result); update({ stage: 'disclosure', capture, result }); return true;
    } catch (error) { fail(operation, error); return false; }
  }
  async function confirmSave() {
    if (state.stage !== 'disclosure' || !state.disclosureAccepted || !policyCurrent() || !intent) return false;
    const operation = begin(), transaction = intent; update({ error: null });
    try {
      verify(operation, transaction.capture);
      for (const shot of transaction.draft?.shots ?? []) {
        if (transaction.assets.some(asset => asset.evidenceId === shot.evidenceId)) continue;
        update({ stage: 'uploading' });
        const derivativeBinding = { evidenceId: shot.evidenceId, captureSessionId: transaction.capture.captureSessionId, generation: transaction.capture.generation,
          languages: shot.observations.at(-1)?.languageConfig ?? ['en-US'], correctionEnabled: false };
        const prepared = await options.sanitize(shot.uri, [0, 0, 1, 1], derivativeBinding);
        try {
          verify(operation, transaction.capture);
          const receipt = await options.transport.upload(transaction.capture.captureSessionId, { idempotencyKey: `${transaction.idempotencyKey}:${shot.evidenceId}`,
            evidenceId: shot.evidenceId, packageObservationId: transaction.capture.packageObservationId, expectedGeneration: transaction.capture.generation,
            expectedResultRevision: transaction.result.resultRevision, expectedCaptureRevision: transaction.capture.captureRevision, expectedDeletionEpoch: transaction.capture.deletionEpoch }, prepared, operation.signal);
          transaction.uploaded = true; verify(operation, transaction.capture, receipt.capture); transaction.capture = clone(receipt.capture); transaction.result = clone(receipt.result);
          transaction.assets.push(clone(receipt.asset));
          if (prepared.derivativeObservation) {
            const originalIds = transaction.sourceObservations.filter(entry => entry.coordinateSpace === 'source_original' && entry.observation.evidenceId === shot.evidenceId).map(entry => entry.observationId);
            transaction.sourceObservations.push({ observationId: options.createId(), revision: 1, role: state.photoRoles[shot.evidenceId] ?? 'ingredients',
              coordinateSpace: 'sanitized_derivative', derivedFromObservationIds: originalIds, observation: clone(prepared.derivativeObservation) });
          }
        } finally { prepared.bytes.fill(0); }
      }
      verify(operation, transaction.capture); update({ stage: 'committing' });
      transaction.request ??= CapturePrivateCommitRequestSchema.parse({ schemaVersion: 2, idempotencyKey: transaction.idempotencyKey,
        expectedGeneration: transaction.capture.generation, expectedResultRevision: transaction.result.resultRevision, expectedCaptureRevision: transaction.capture.captureRevision,
        expectedDeletionEpoch: transaction.capture.deletionEpoch, packageObservationId: transaction.capture.packageObservationId, assets: transaction.assets,
        sourceObservations: transaction.sourceObservations, edits: transaction.edits, review: transaction.review, reviewId: typeof options.reviewId === 'function' ? options.reviewId() : options.reviewId ?? null });
      const receipt = await options.transport.commit(transaction.capture.captureSessionId, transaction.request, operation.signal);
      verify(operation, transaction.capture, receipt.capture); transaction.capture = clone(receipt.capture); transaction.result = clone(receipt.result);
      update({ stage: 'saving', capture: receipt.capture, result: receipt.result });
      let saveId: string | null = null;
      if (receipt.result.snapshotId && receipt.result.allowedActions.some(action => action === 'save' || action === 'save_partial')) {
      const saveRequest: SaveRequest = { idempotencyKey: `${transaction.idempotencyKey}:save`, scanId: receipt.result.scanId,
        expectedGeneration: receipt.result.generation, expectedResultRevision: receipt.result.resultRevision, selectedSnapshotId: receipt.result.snapshotId,
        selectedDeclarationId: receipt.result.declarationId };
      const saved = await options.transport.saveResult(saveRequest, operation.signal); saveId = saved.saveId; verify(operation, transaction.capture);
      }
      const recovery = CaptureRecoverySchema.parse(await options.transport.recover(transaction.capture.captureSessionId, operation.signal));
      verify(operation, transaction.capture, recovery.capture); intent = null;
      update({ stage: savedStage(recovery), recovery, result: recovery.boundResult ?? recovery.result, capture: recovery.capture, saveId,
        pendingEdits: [], photoRoles: Object.fromEntries(recovery.sourceObservations.map(entry => [entry.observation.evidenceId, entry.role])), disclosureAccepted: false }); scheduleRecoveryExpiry();
      if (!state.recovery) return false; options.onSaved?.(recovery, saveId); return true;
    } catch (error) {
      if (error instanceof Error && error.message === 'private_draft_changed' && transaction.uploaded && !transaction.cleanupStarted && current(operation)) {
        transaction.cleanupStarted = true;
        try { await options.transport.remove(transaction.capture.captureSessionId, operation.signal); }
        catch { /* The server expiry/outbox remains responsible if this cleanup is offline. */ }
      }
      fail(operation, error); return false;
    }
  }
  async function recover(owner: string, id: string) {
    if (!options.enabled || owner !== options.currentOwner()) return false;
    stop(); intent = null; update({ ownerId: owner, stage: 'recovering', recovery: null, capture: null, result: null, pendingEdits: [], photoRoles: {}, error: null, saveId: null });
    const operation = begin();
    try {
      const value = CaptureRecoverySchema.parse(await options.transport.recover(id, operation.signal));
      if (!current(operation)) return false;
      if (value.capture.captureSessionId !== id) throw new Error('private_binding_changed');
      update({ stage: savedStage(value), recovery: value, capture: value.capture, result: value.boundResult ?? value.result, photoRoles: Object.fromEntries(value.sourceObservations.map(entry => [entry.observation.evidenceId, entry.role])) }); scheduleRecoveryExpiry(); return state.recovery !== null;
    } catch (error) { fail(operation, error); return false; }
  }
  async function remove() {
    const capture = state.capture; if (!capture || !state.ownerId || state.ownerId !== options.currentOwner()) return false;
    const operation = begin(); intent = null; update({ stage: 'removing', recovery: null, result: null, pendingEdits: [], error: null, disclosureAccepted: false });
    try {
      await options.transport.remove(capture.captureSessionId, operation.signal);
      if (!current(operation)) return false;
      update({ stage: 'removed', capture: null, saveId: null }); options.onRemoved?.(capture.captureSessionId); return true;
    } catch (error) { fail(operation, error); if (current(operation)) update({ error: 'Private evidence could not be removed. It remains saved until deletion succeeds. Retry when connected.' }); return false; }
  }
  return {
    getState: () => { expireRecoveryIfNeeded(); return state; },
    isCurrentOwner: () => state.ownerId !== null && state.ownerId === options.currentOwner(),
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    setOwner(owner: string | null) { if (state.ownerId === owner) return; stop(); intent = null; update({ ownerId: owner, stage: options.enabled ? 'temporary' : 'disabled',
      capture: null, result: null, recovery: null, capability: null, pendingEdits: [], photoRoles: {}, error: null, saveId: null, disclosureAccepted: false }); },
    bind(owner: string, capture: CaptureSession, result: ScanResult) {
      if (owner !== options.currentOwner()) return false;
      capture = CaptureSessionSchema.parse(capture); result = ScanResultSchema.parse(result);
      if (capture.scanId !== result.scanId || capture.generation !== result.generation) return false;
      if (state.capture && sameCapture(state.capture, capture)) { if (!busy(state.stage)) update({ capture, result }); return true; }
      stop(); intent = null; update({ ownerId: owner, capture, result, recovery: null, pendingEdits: [], photoRoles: {}, error: null, saveId: null,
        stage: options.enabled ? 'temporary' : 'disabled', disclosureAccepted: false }); return true;
    },
    discloseDraft(draft: CaptureDraft) { return state.capture && state.result ? disclose(draft, state.capture, state.result) : Promise.resolve(false); },
    discloseChanges() { expireRecoveryIfNeeded(); return state.recovery?.editable && state.capture && state.pendingEdits.length ? disclose(null, state.capture, state.recovery.result) : Promise.resolve(false); },
    acceptDisclosure(accepted: boolean) { if (state.stage === 'disclosure') update({ disclosureAccepted: accepted }); },
    confirmSave,
    cancelDisclosure() { if (state.stage === 'disclosure' || state.stage === 'checking_policy') { stop(); intent = null; update({ stage: state.recovery ? savedStage(state.recovery) : 'temporary', disclosureAccepted: false, error: null }); } },
    cancelSave: remove,
    retry() { if (!intent || state.stage !== 'unavailable') return Promise.resolve(false); update({ stage: 'disclosure', disclosureAccepted: false }); return Promise.resolve(true); },
    recover,
    remove,
    setPhotoRole(evidenceId: string, role: 'ingredients' | 'package') {
      if (busy(state.stage) || state.stage === 'disclosure' || state.ownerId !== options.currentOwner() || !options.currentDraft?.()?.shots.some(shot => shot.evidenceId === evidenceId)) return false;
      intent = null; update({ photoRoles: { ...state.photoRoles, [evidenceId]: role }, disclosureAccepted: false }); return true;
    },
    correctLine(ref: DraftLineRef, text: string, originalObservationId?: string) {
      expireRecoveryIfNeeded();
      const recovery = state.recovery; if (!recovery?.editable || busy(state.stage) || state.stage === 'disclosure' || state.ownerId !== options.currentOwner() || !text.trim() || text.length > 4000) return false;
      const source = originalObservationId ? recovery.sourceObservations.find(value => value.observationId === originalObservationId) :
        recovery.sourceObservations.filter(value => value.observation.evidenceId === ref.evidenceId)[ref.observationIndex];
      if (!source?.observation.lines[ref.lineIndex] || source.observation.evidenceId !== ref.evidenceId) return false;
      const matching = privateSourceEditChain(source.observationId, [...recovery.edits, ...state.pendingEdits]);
      if (!matching || matching.some(edit => edit.sourceRef && edit.sourceRef.evidenceId !== ref.evidenceId)) return false;
      const lines = source.observation.lines.map(line => line.text);
      for (const edit of matching) { if (edit.sourceRef) lines[edit.sourceRef.lineIndex] = privateEditReplacement(edit);
        else lines.splice(0, lines.length, ...edit.text.split('\n')); }
      lines[ref.lineIndex] = text; const prior = matching.at(-1);
      update({ pendingEdits: [...state.pendingEdits, { observationId: options.createId(), supersedesId: prior?.observationId ?? source.observationId,
        revision: (prior?.revision ?? 1) + 1, text: lines.join('\n'), ...{ replacementText: text },
        reason: 'Operator correction of saved private label; original recognition retained', sourceRef: { ...clone(ref), observationIndex: matching.find(edit => edit.sourceRef)?.sourceRef?.observationIndex ?? ref.observationIndex } }], error: null }); return true;
    },
    close() { stop(); intent = null; update({ capture: null, result: null, recovery: null, pendingEdits: [], photoRoles: {}, capability: null,
      stage: options.enabled ? 'temporary' : 'disabled', error: null, saveId: null, disclosureAccepted: false }); },
  };
}
export type PrivateCaptureController = ReturnType<typeof createPrivateCaptureController>;

/** Permission-filtered label readings remain private and partial, even when their barcode matches a catalog item. */
export function privateCapturedLabelProjection(state: PrivateCaptureState, ownerId: string, now = Date.now()) {
  const recovery = state.recovery, result = recovery?.boundResult ?? recovery?.result;
  if (state.ownerId !== ownerId || !recovery || !result || result.scope !== 'private_package' ||
    !['saved_partial','saved_accepted','disclosure','checking_policy'].includes(state.stage) ||
    privateRecoveryRetentionDeadline(recovery) <= now || result.freshness.state !== 'fresh' ||
    !result.freshness.expiresAt || Date.parse(result.freshness.expiresAt) <= now ||
    result.scanId !== recovery.capture.scanId || result.generation !== recovery.capture.generation) return null;
  const outcome = recovery.capturedSource, candidate = outcome?.candidate;
  if (outcome) {
    if (!candidate || candidate.ownerId !== ownerId || candidate.captureSessionId !== recovery.capture.captureSessionId ||
      candidate.packageObservationId !== recovery.capture.packageObservationId || candidate.generation !== recovery.capture.generation ||
      candidate.deletionEpoch !== recovery.capture.deletionEpoch || candidate.captureRevision + 1 !== recovery.capture.captureRevision ||
      candidate.resultRevision + 1 !== result.resultRevision || candidate.selectedItemId !== result.itemId ||
      candidate.targetSnapshotId !== result.snapshotId || candidate.targetDeclarationId !== result.declarationId ||
      Date.parse(candidate.expiresAt) <= now || outcome.state === 'blocked') return null;
    return { kind: 'partial' as const, conflict: outcome.state === 'conflict' || candidate.contradictions.length > 0,
      sections: outcome.facts.sections.map(section => ({ id: section.sectionId, kind: section.kind, text: section.rawText })),
      capturedText: outcome.facts.capturedText.map(entry => ({ id: entry.observationId, text: entry.rawText, attributedEdit: entry.attributedEdit })),
      association: candidate.association, name: candidate.name?.value ?? null, gaps: [...new Set([...candidate.gaps.map(gap => gap.code), ...candidate.reasonCodes, ...outcome.reasonCodes])],
      contradictions: candidate.contradictions.map(entry => ({ kind: entry.kind, values: entry.values })), limitations: result.display.limitations };
  }
  const sections = result.display.sections.filter(section => Date.parse(section.expiresAt) > now)
    .map(section => ({ id: section.sectionId, kind: section.kind, text: section.text }));
  if (!sections.length) return null;
  return { kind: state.stage === 'saved_accepted' && result.declarationState === 'accepted' && !result.conflictIds.length ? 'accepted' as const : 'partial' as const,
    conflict: result.declarationState === 'conflict' || result.conflictIds.length > 0, sections,
    capturedText: [], association: null, name: null, gaps: [], contradictions: [], limitations: result.display.limitations };
}

export function privateEditReplacement(edit: CapturePrivateCommitRequest['edits'][number]): string {
  if ('replacementText' in edit && typeof edit.replacementText === 'string') return edit.replacementText;
  return edit.sourceRef ? edit.text.split('\n')[edit.sourceRef.lineIndex] ?? edit.text : edit.text;
}

/** The immutable supersedes graph, not transport row order or pass index, defines a correction history. */
export function privateSourceEditChain(sourceObservationId: string, edits: CapturePrivateCommitRequest['edits']): CapturePrivateCommitRequest['edits'] | null {
  const chain: CapturePrivateCommitRequest['edits'] = [], visited = new Set([sourceObservationId]);
  let parent = sourceObservationId, revision = 1;
  for (let count = 0; count <= edits.length; count++) {
    const children = edits.filter(edit => edit.supersedesId === parent);
    if (children.length === 0) return chain;
    if (children.length !== 1) return null;
    const next = children[0];
    if (next.revision !== revision + 1 || visited.has(next.observationId)) return null;
    visited.add(next.observationId); chain.push(next); parent = next.observationId; revision = next.revision;
  }
  return null;
}

/** Recovery may clear session metadata before it fails. The retained local binding still fences that exact private projection. */
export function privateCaptureProjectionBlocked(state: PrivateCaptureState,
  result: Pick<ScanResult, 'scope' | 'scanId' | 'generation'> | null, ownerId: string | null, binding: CaptureBinding | null): boolean {
  if (!ownerId || state.ownerId !== ownerId || !state.error || state.recovery || result?.scope !== 'private_package' ||
    !['conflict','unavailable','disabled'].includes(state.stage)) return false;
  const context = state.capture ?? (binding?.ownerId === ownerId ? binding : null);
  return Boolean(context && context.scanId === result.scanId && context.generation === result.generation);
}

/** The recovery DTO has no independent history permission deadline. All cached history therefore expires with its asset dependencies. */
export function privateRecoveryRetentionDeadline(recovery: CaptureRecovery): number {
  const hasHistory = recovery.sourceObservations.length > 0 || recovery.edits.length > 0 || recovery.review !== null ||
    recovery.capturedSource !== null && recovery.capturedSource !== undefined ||
    (recovery.boundResult ?? recovery.result).scope === 'private_package' && (recovery.boundResult ?? recovery.result).display.sections.length > 0;
  if (hasHistory && recovery.assets.length === 0) return 0;
  const assets = new Map(recovery.assets.map(entry => [entry.asset.evidenceId, Date.parse(entry.expiresAt)]));
  // Local OCR/review uses the client photo ID; immutable extractor references
  // use the server record ID. Keep each namespace bound to its recovered asset.
  const records = new Set(recovery.assets.flatMap(entry => entry.recordId ? [entry.recordId] : [entry.asset.evidenceId]));
  if (recovery.sourceObservations.some(entry => !assets.has(entry.observation.evidenceId)) ||
    recovery.review?.reviewState.assemblies.some(assembly => assembly.lines.some(line => line.sources.some(source => !assets.has(source.evidenceId)))) ||
    recovery.capturedSource?.candidate?.assetBindings.some(binding => !records.has(binding.evidenceId)) ||
    recovery.capturedSource?.facts.capturedText.some(entry => entry.sourceRefs.some(ref => !records.has(ref.assetEvidenceId)))) return 0;
  const values = [...assets.values()]; if (values.some(value => !Number.isFinite(value))) return 0;
  return values.length ? Math.min(...values) : Infinity;
}
