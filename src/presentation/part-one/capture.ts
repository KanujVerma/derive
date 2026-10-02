import { PART_ONE_OCR_LIMITS, validateOcrObservation } from '../../services/partOneOcr.ts';
import type { LocalLabelRecognizer, LocalOcrInput, OcrObservation } from '../../services/partOneOcr.ts';

export type CaptureBinding = {
  ownerId: string; sheetSessionId: string; scanId: string; generation: number;
  captureSessionId: string; packageObservationId: string; itemId: string | null; candidateId: string | null; deletionEpoch: number;
};
export type DraftCoverage = { startSeen: boolean; endSeen: boolean; missingRegions: string[];
  requiredSections: string[]; observedSections: string[]; associationContradictions: string[] };
export type DraftEdit = { revision: number; supersedesRevision: number | null; observationEvidenceId: string;
  actorOwnerId: string; text: string };
export type DraftShot = { evidenceId: string; uri: string; observation: OcrObservation | null; observations: OcrObservation[] };
export type CaptureDraft = { binding: CaptureBinding; captureEpoch: number; scrollOffset: number;
  shots: DraftShot[]; edits: DraftEdit[]; coverage: DraftCoverage; lastActivityAt: number };
export type CaptureTicket = { binding: CaptureBinding; captureEpoch: number; evidenceId: string };

export function captureBindingsEqual(a: CaptureBinding, b: CaptureBinding) {
  return a.ownerId === b.ownerId && a.sheetSessionId === b.sheetSessionId && a.scanId === b.scanId &&
    a.generation === b.generation && a.captureSessionId === b.captureSessionId &&
    a.packageObservationId === b.packageObservationId && a.itemId === b.itemId && a.candidateId === b.candidateId && a.deletionEpoch === b.deletionEpoch;
}
const sameBinding = captureBindingsEqual;
const emptyCoverage = (): DraftCoverage => ({ startSeen: false, endSeen: false, missingRegions: [],
  requiredSections: ['ingredients'], observedSections: [], associationContradictions: [] });
// Plain serializable value copying works on Hermes builds without structuredClone.
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

/** Instance-local state only. The owner supplies current binding on every operation. No serialization. */
export class MemoryLabelDraft {
  private draft: CaptureDraft | null = null;
  private epoch = 0;
  private recognizing = false;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupInFlight: Promise<void> = Promise.resolve();
  private readonly pendingPhotoCleanup = new Set<string>();
  private readonly now: () => number;
  private readonly releasePhoto: (uri: string) => Promise<void>;
  /** releasePhoto must delete only app-owned picker/camera cache copies, never the user's original library asset. */
  constructor(now: () => number = Date.now, releasePhoto: (uri: string) => Promise<void> = async () => {}) {
    this.now = now; this.releasePhoto = releasePhoto;
  }
  private release(uris: string[]) {
    for (const uri of uris) this.pendingPhotoCleanup.add(uri);
    this.cleanupInFlight = this.cleanupInFlight.catch(() => {}).then(async () => {
      let failed = false;
      for (const uri of this.pendingPhotoCleanup) {
        try { await this.releasePhoto(uri); this.pendingPhotoCleanup.delete(uri); }
        catch { failed = true; }
      }
      if (failed) throw new Error('local_capture_cleanup_failed');
    });
    // The controller may await flushCleanup for evidence; no raw URI/error is logged.
    this.cleanupInFlight.catch(() => {});
  }
  flushCleanup() { return this.cleanupInFlight; }
  discardPhoto(uri: string) { this.release([uri]); }
  private touch(draft: CaptureDraft) {
    draft.lastActivityAt = this.now();
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = setTimeout(() => this.remove(), PART_ONE_OCR_LIMITS.draftInactivityMs);
    const timer = this.expiryTimer as unknown as { unref?: () => void };
    timer.unref?.();
  }
  private current(binding: CaptureBinding) {
    if (this.draft && (this.now() - this.draft.lastActivityAt >= PART_ONE_OCR_LIMITS.draftInactivityMs ||
      !sameBinding(binding, this.draft.binding))) this.remove();
    return this.draft;
  }
  begin(binding: CaptureBinding, scrollOffset: number): CaptureDraft {
    const existing = this.current(binding);
    if (existing) { this.touch(existing); return clone(existing); }
    this.draft = { binding: { ...binding }, captureEpoch: ++this.epoch, scrollOffset, shots: [], edits: [],
      coverage: emptyCoverage(), lastActivityAt: this.now() };
    this.touch(this.draft);
    return clone(this.draft);
  }
  read(binding: CaptureBinding): CaptureDraft | null {
    const draft = this.current(binding);
    return draft ? clone(draft) : null;
  }
  /** Back/cancel within the sheet keeps the short-lived draft and original scroll. */
  back(binding: CaptureBinding) {
    const draft = this.current(binding);
    if (draft) this.touch(draft);
    return draft?.scrollOffset ?? null;
  }
  remove() { this.release(this.draft?.shots.map(shot => shot.uri) ?? []); this.draft = null; ++this.epoch;
    if (this.expiryTimer) clearTimeout(this.expiryTimer); this.expiryTimer = null; }
  endSheet() { this.remove(); }
  accountChanged() { this.remove(); }
  addPhoto(binding: CaptureBinding, evidenceId: string, uri: string): CaptureTicket | 'cap_reached' {
    const draft = this.current(binding);
    if (!draft) throw new Error('no_current_capture');
    if (!uri.startsWith('file://')) throw new Error('local_photo_required');
    if (draft.shots.some(shot => shot.evidenceId === evidenceId)) throw new Error('duplicate_evidence');
    if (draft.shots.length >= PART_ONE_OCR_LIMITS.maxImages) return 'cap_reached';
    draft.shots.push({ evidenceId, uri, observation: null, observations: [] }); this.touch(draft);
    return { binding: { ...binding }, captureEpoch: draft.captureEpoch, evidenceId };
  }
  removePhoto(binding: CaptureBinding, evidenceId: string) {
    const draft = this.current(binding); if (!draft) return;
    this.release(draft.shots.filter(shot => shot.evidenceId === evidenceId).map(shot => shot.uri));
    draft.shots = draft.shots.filter(shot => shot.evidenceId !== evidenceId);
    draft.edits = draft.edits.filter(edit => edit.observationEvidenceId !== evidenceId);
    draft.coverage = emptyCoverage(); this.touch(draft);
  }
  setCoverage(binding: CaptureBinding, coverage: DraftCoverage) {
    const draft = this.current(binding); if (!draft) throw new Error('no_current_capture');
    draft.coverage = clone(coverage); this.touch(draft);
  }
  edit(binding: CaptureBinding, evidenceId: string, text: string) {
    const draft = this.current(binding);
    if (!draft?.shots.some(shot => shot.evidenceId === evidenceId && shot.observation)) throw new Error('no_observation');
    const previous = draft.edits.filter(edit => edit.observationEvidenceId === evidenceId).at(-1);
    draft.edits.push({ revision: draft.edits.length + 1, supersedesRevision: previous?.revision ?? null,
      observationEvidenceId: evidenceId, actorOwnerId: binding.ownerId, text }); this.touch(draft);
  }
  async recognize(ticket: CaptureTicket, recognizer: LocalLabelRecognizer, getCurrentBinding: () => CaptureBinding,
    languages = ['en-US']): Promise<'applied' | 'stale' | 'busy'> {
    if (this.recognizing) return 'busy';
    const draft = this.current(getCurrentBinding());
    const shot = draft?.shots.find(value => value.evidenceId === ticket.evidenceId);
    if (!draft || !shot || ticket.captureEpoch !== draft.captureEpoch || !sameBinding(ticket.binding, draft.binding)) return 'stale';
    const input: LocalOcrInput = { uri: shot.uri, evidenceId: shot.evidenceId,
      captureSessionId: ticket.binding.captureSessionId, generation: ticket.binding.generation, languages,
      correctionEnabled: false };
    this.recognizing = true;
    try {
      const observation = validateOcrObservation(await recognizer.recognize(input), input);
      const current = this.current(getCurrentBinding());
      const target = current?.shots.find(value => value.evidenceId === ticket.evidenceId);
      if (!current || !target || current.captureEpoch !== ticket.captureEpoch || !sameBinding(current.binding, ticket.binding)) return 'stale';
      target.observations.push(clone(observation)); target.observation = clone(observation); this.touch(current);
      return 'applied';
    } finally { this.recognizing = false; }
  }
}

export function draftReadiness(draft: CaptureDraft, identityConfirmed: boolean) {
  void identityConfirmed; // Intended identity confirmation cannot erase coverage gaps.
  const c = draft.coverage;
  const reasons = [...c.missingRegions, ...c.associationContradictions];
  if (!c.startSeen) reasons.push('missing_start');
  if (!c.endSeen) reasons.push('missing_end');
  for (const section of c.requiredSections) if (!c.observedSections.includes(section)) reasons.push(`missing_section:${section}`);
  if (draft.shots.some(shot => shot.observation?.lines.some(line => line.alternatives.some(text => text !== line.text)))) reasons.push('recognition_alternatives');
  if (draft.shots.some(shot => new Set(shot.observations.filter(observation => observation.status === 'recognized')
    .map(observation => observation.lines.map(line => line.text).join('\n'))).size > 1)) reasons.push('recognition_disagreement');
  // Even complete local previews cannot satisfy approved durable retention/commit rights.
  return { state: reasons.length ? 'partial' as const : 'preview_only' as const, reasons,
    canCommit: false as const, canPublish: false as const, addPhoto: reasons.length > 0 && draft.shots.length < 6 };
}

export type AttributedLine = { text: string; lineage: { evidenceId: string; lineIndex: number; region: number[] }[] };
/** Explicit overlap indexes are required. Equal chemical tokens alone never justify a merge. */
type DeclarationView = { binding: CaptureBinding; observation: OcrObservation; declarationAssociationId: string;
  sectionId: string; language: string };
export function mergeAlignedViews(a: DeclarationView, b: DeclarationView,
  overlap: { aStart: number; bStart: number; length: number } | null) {
  const lines = (observation: OcrObservation): AttributedLine[] => observation.lines.map((line, lineIndex) =>
    ({ text: line.text, lineage: [{ evidenceId: observation.evidenceId, lineIndex, region: [...line.region] }] }));
  if (!sameBinding(a.binding, b.binding) || !overlap || !a.declarationAssociationId ||
    a.declarationAssociationId !== b.declarationAssociationId || a.sectionId !== b.sectionId || a.language !== b.language ||
    a.observation.evidenceId === b.observation.evidenceId ||
    a.observation.status !== 'recognized' || b.observation.status !== 'recognized' ||
    a.observation.captureSessionId !== a.binding.captureSessionId || b.observation.captureSessionId !== b.binding.captureSessionId ||
    a.observation.generation !== a.binding.generation || b.observation.generation !== b.binding.generation) {
    return { status: 'unmerged' as const, views: [lines(a.observation), lines(b.observation)] };
  }
  const { aStart, bStart, length } = overlap;
  const aa = lines(a.observation), bb = lines(b.observation);
  if (![aStart, bStart, length].every(Number.isInteger) || aStart < 0 || bStart !== 0 || length < 1 ||
    aStart + length !== aa.length || length > bb.length ||
    aa.slice(aStart).some((line, index) => line.text !== bb[index].text)) return { status: 'unmerged' as const, views: [aa, bb] };
  for (let i = 0; i < length; i++) aa[aStart + i].lineage.push(...bb[i].lineage);
  return { status: 'merged' as const, lines: [...aa, ...bb.slice(length)] };
}

/** Neither pass is selected as truth when configurations disagree. Both originals remain. */
export function compareRecognitionPasses(original: OcrObservation, assisted: OcrObservation) {
  const sameEvidence = original.evidenceId === assisted.evidenceId && original.captureSessionId === assisted.captureSessionId &&
    original.generation === assisted.generation;
  const discrepancy = !sameEvidence || original.lines.map(line => line.text).join('\n') !== assisted.lines.map(line => line.text).join('\n');
  return { observations: [clone(original), clone(assisted)], discrepancy, dependentAcceptanceBlocked: discrepancy };
}
