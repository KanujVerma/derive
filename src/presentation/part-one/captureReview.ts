import { captureBindingsEqual, draftReadiness } from './capture.ts';
import type { CaptureBinding, CaptureDraft, DraftCoverage, MemoryLabelDraft } from './capture.ts';
import type { LocalLabelRecognizer } from '../../services/partOneOcr.ts';

export type DraftSection = 'unknown' | 'ingredients' | 'active' | 'inactive' | 'explanatory';
export type DraftLineRef = { evidenceId: string; observationIndex: number; lineIndex: number };
export type DraftGapKind = 'right_edge' | 'left_edge' | 'tail' | 'glare' | 'hidden_line' | 'fold' | 'active' | 'inactive';
export type DraftSourceSpan = DraftLineRef & { region: number[]; rawText: string; correctionRevision: number | null };
export type DraftPreviewLine = { text: string; rawText: string; correctionRevision: number | null;
  actorOwnerId: string | null; sources: DraftSourceSpan[] };
export type DraftAssembly = { revision: number; supersedesRevision: number | null; section: DraftSection; language: string;
  sameDeclarationObservedBy: string; lines: DraftPreviewLine[] };
export type DraftReviewState = { active: boolean; revision: number; assemblyRevision: number; mode: 'unknown' | 'cosmetic' | 'drug_facts';
  samePackagePhotoIds: string[]; assignments: { ref: DraftLineRef; section: DraftSection; language: string }[];
  packageConflicts: { evidenceId: string; reason: string }[];
  gaps: { id: string; kind: DraftGapKind; status: 'missing' | 'operator_observed'; observedRefs: DraftLineRef[] }[];
  boundaries: { start: DraftLineRef[]; end: DraftLineRef[] }; assemblies: DraftAssembly[] };
export type ReviewActionResult = { ok: true } | { ok: false; reason: string };
function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
export const lineRefKey = (ref: DraftLineRef) => `${ref.evidenceId}:${ref.observationIndex}:${ref.lineIndex}`;
const sameRef = (a: DraftLineRef, b: DraftLineRef) => lineRefKey(a) === lineRefKey(b);
/** Picker/camera/retry controls snapshot this handler before awaiting native acquisition. */
export function createCapturePhotoHandlers(store: MemoryLabelDraft, getCurrentBinding: () => CaptureBinding,
  dependencies: { stage: (uri: string, evidenceId: string) => string; createEvidenceId: () => string;
    recognizer: LocalLabelRecognizer; onChange: () => void; isActive?: () => boolean }) {
  const binding = { ...getCurrentBinding() }, epoch = store.read(binding)?.captureEpoch;
  let importedEvidenceId: string | null = null;
  const isCurrent = () => (dependencies.isActive?.() ?? true) && captureBindingsEqual(binding, getCurrentBinding()) && epoch !== undefined &&
    store.read(getCurrentBinding())?.captureEpoch === epoch;
  return {
    isCurrent,
    getImportedEvidenceId: () => importedEvidenceId,
    async importPhoto(uri: string) {
      let localUri = uri;
      try {
        const evidenceId = dependencies.createEvidenceId(); importedEvidenceId = evidenceId; localUri = dependencies.stage(uri, evidenceId);
        if (!isCurrent()) { store.discardPhoto(localUri); return 'stale' as const; }
        const ticket = store.addPhoto(binding, evidenceId, localUri);
        if (ticket === 'cap_reached') { store.discardPhoto(localUri); return 'cap_reached' as const; }
        dependencies.onChange();
        const result = await store.recognize(ticket, dependencies.recognizer, getCurrentBinding, ['en-US'], isCurrent);
        if (isCurrent()) dependencies.onChange(); return result;
      } catch {
        if (!store.read(getCurrentBinding())?.shots.some(shot => shot.uri === localUri)) store.discardPhoto(localUri);
        return isCurrent() ? 'failed' as const : 'stale' as const;
      }
    },
    async retry(evidenceId: string) {
      if (!isCurrent() || epoch === undefined) return 'stale' as const;
      try {
        const result = await store.recognize({ binding, captureEpoch: epoch, evidenceId }, dependencies.recognizer, getCurrentBinding, ['en-US'], isCurrent);
        if (isCurrent()) dependencies.onChange(); return result;
      } catch { return isCurrent() ? 'failed' as const : 'stale' as const; }
    },
  };
}
export const DRAFT_GAP_PROMPTS: Record<DraftGapKind, string> = {
  right_edge: 'The right edge is cut off. Add a photo of that side with some overlap.',
  left_edge: 'The left edge is cut off. Add a photo of that side with some overlap.',
  tail: 'The final lines are missing. Add the bottom or tail of the declaration with overlap.',
  glare: 'Glare hides a region. Add a photo from a different angle with some overlap.',
  hidden_line: 'A finger or obstruction hides a line. Add a clear view of that line with overlap.',
  fold: 'A fold or curved region is unreadable. Add a view of that region with overlap.',
  active: 'The active ingredients section is missing. Add that section and its printed quantities.',
  inactive: 'The inactive ingredients section is missing. Add the complete inactive declaration.',
};

export function resolveDraftLine(draft: CaptureDraft, ref: DraftLineRef) {
  const shot = draft.shots.find(value => value.evidenceId === ref.evidenceId);
  const observation = shot?.observations[ref.observationIndex];
  const line = observation?.lines[ref.lineIndex];
  if (!shot || !observation || observation.status !== 'recognized' || !line ||
    observation.captureSessionId !== draft.binding.captureSessionId || observation.generation !== draft.binding.generation) return null;
  const edit = draft.edits.filter(value => value.observationEvidenceId === ref.evidenceId &&
    value.observationIndex === ref.observationIndex && value.lineIndex === ref.lineIndex).at(-1);
  return { text: edit?.text ?? line.text, rawText: line.text, correctionRevision: edit?.revision ?? null,
    actorOwnerId: edit?.actorOwnerId ?? null, sources: [{ ...ref, rawText: line.text, region: [...line.region], correctionRevision: edit?.revision ?? null }] } satisfies DraftPreviewLine;
}
export function latestPhotoRefs(draft: CaptureDraft, evidenceId: string): DraftLineRef[] {
  const shot = draft.shots.find(value => value.evidenceId === evidenceId);
  if (!shot?.observation || shot.observation.status !== 'recognized') return [];
  const observationIndex = shot.observations.length - 1;
  return shot.observation.lines.map((_line, lineIndex) => ({ evidenceId, observationIndex, lineIndex }));
}
function coverageFor(draft: CaptureDraft, review: DraftReviewState): DraftCoverage {
  return { startSeen: review.boundaries.start.length > 0, endSeen: review.boundaries.end.length > 0,
    missingRegions: review.gaps.filter(value => value.status === 'missing').map(value => value.kind),
    requiredSections: review.mode === 'drug_facts' ? ['active', 'inactive'] : review.mode === 'cosmetic' ? ['ingredients'] : ['label_scope'],
    observedSections: [...new Set(review.assignments.filter(value => value.section !== 'unknown' && value.section !== 'explanatory' &&
      resolveDraftLine(draft, value.ref)).map(value => value.section))], associationContradictions: [...new Set([
        ...draft.coverage.associationContradictions, ...review.packageConflicts.map(value => value.reason)])] };
}
function validRefs(draft: CaptureDraft, refs: DraftLineRef[]) {
  return refs.length > 0 && new Set(refs.map(lineRefKey)).size === refs.length && refs.every(ref => resolveDraftLine(draft, ref));
}

/** The live controls call these same handlers. The captured epoch and owner cannot migrate to a new draft. */
export function createCaptureReviewHandlers(store: MemoryLabelDraft, getCurrentBinding: () => CaptureBinding, onChange: () => void = () => {}) {
  const binding = { ...getCurrentBinding() }, epoch = store.read(binding)?.captureEpoch;
  function current() {
    const actual = getCurrentBinding();
    if (!captureBindingsEqual(binding, actual)) return null;
    const draft = store.read(actual);
    return draft && draft.captureEpoch === epoch ? draft : null;
  }
  function update(change: (draft: CaptureDraft, review: DraftReviewState) => string | void): ReviewActionResult {
    const draft = current(); if (!draft) return { ok: false, reason: 'stale_capture' };
    const review = copy(draft.review), reason = change(draft, review);
    if (reason) return { ok: false, reason };
    review.active = true; review.revision++;
    store.setReview(binding, draft.captureEpoch, review, coverageFor(draft, review)); onChange(); return { ok: true };
  }
  return {
    setMode(mode: DraftReviewState['mode']) { return update((_draft, review) => { review.mode = mode; }); },
    confirmPackage(evidenceId: string, confirmed: boolean) { return update((draft, review) => {
      if (!draft.shots.some(value => value.evidenceId === evidenceId)) return 'unknown_photo';
      review.samePackagePhotoIds = review.samePackagePhotoIds.filter(id => id !== evidenceId);
      if (confirmed) review.samePackagePhotoIds.push(evidenceId);
    }); },
    reportPackageConflict(evidenceId: string) { return update((draft, review) => {
      if (!draft.shots.some(value => value.evidenceId === evidenceId)) return 'unknown_photo';
      if (!review.packageConflicts.some(value => value.evidenceId === evidenceId)) review.packageConflicts.push({ evidenceId, reason: 'operator_package_mismatch' });
    }); },
    assignLines(refs: DraftLineRef[], section: DraftSection, language: string) { return update((draft, review) => {
      if (!validRefs(draft, refs)) return 'invalid_source_lines';
      if (language && !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language)) return 'invalid_language_tag';
      review.assignments = review.assignments.filter(value => !refs.some(ref => sameRef(ref, value.ref)));
      review.assignments.push(...refs.map(ref => ({ ref: copy(ref), section, language })));
    }); },
    setPhotoLanguage(evidenceId: string, language: string) { return update((draft, review) => {
      const refs = latestPhotoRefs(draft, evidenceId);
      if (!validRefs(draft, refs)) return 'invalid_source_lines';
      if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language)) return 'invalid_language_tag';
      for (const ref of refs) {
        const assignment = review.assignments.find(value => sameRef(value.ref, ref));
        if (assignment) assignment.language = language;
        else review.assignments.push({ ref: copy(ref), section: 'unknown', language });
      }
    }); },
    markBoundary(boundary: 'start' | 'end', refs: DraftLineRef[]) { return update((draft, review) => {
      if (refs.length && !validRefs(draft, refs)) return 'invalid_source_lines';
      review.boundaries[boundary] = copy(refs);
    }); },
    reportGap(kind: DraftGapKind) { return update((_draft, review) => {
      const old = review.gaps.find(value => value.kind === kind);
      if (old) { old.status = 'missing'; old.observedRefs = []; }
      else review.gaps.push({ id: `gap-${kind}`, kind, status: 'missing', observedRefs: [] });
    }); },
    resolveGap(id: string, refs: DraftLineRef[]) { return update((draft, review) => {
      if (!validRefs(draft, refs)) return 'invalid_source_lines';
      const gap = review.gaps.find(value => value.id === id); if (!gap) return 'unknown_gap';
      gap.status = 'operator_observed'; gap.observedRefs = copy(refs);
    }); },
    correctLine(ref: DraftLineRef, text: string): ReviewActionResult {
      const draft = current(); if (!draft) return { ok: false, reason: 'stale_capture' };
      if (!resolveDraftLine(draft, ref) || !text.trim() || text.length > 4000) return { ok: false, reason: 'invalid_correction' };
      store.edit(binding, ref.evidenceId, text, ref); onChange(); return { ok: true };
    },
    removePhoto(evidenceId: string): ReviewActionResult {
      if (!current()) return { ok: false, reason: 'stale_capture' };
      store.removePhoto(binding, evidenceId); onChange(); return { ok: true };
    },
    assemble(refs: DraftLineRef[], sameDeclarationObserved: boolean): ReviewActionResult {
      return update((draft, review) => {
        if (!sameDeclarationObserved) return 'same_declaration_not_observed';
        if (draft.coverage.associationContradictions.length || review.packageConflicts.length) return 'package_conflict';
        if (!validRefs(draft, refs)) return 'invalid_source_lines';
        const groups: DraftLineRef[][] = [];
        for (const ref of refs) {
          const group = groups.find(value => value[0].evidenceId === ref.evidenceId);
          if (group) group.push(ref); else groups.push([ref]);
        }
        if (groups.length < 2) return 'two_distinct_views_required';
        const assignments = refs.map(ref => review.assignments.find(value => sameRef(value.ref, ref)));
        const first = assignments[0];
        if (!first || !first.language || first.section === 'unknown' || first.section === 'explanatory' ||
          assignments.some(value => !value || value.section !== first.section || value.language !== first.language)) return 'section_or_language_mismatch';
        if (groups.some(group => !review.samePackagePhotoIds.includes(group[0].evidenceId))) return 'same_package_not_observed';
        for (const group of groups) {
          group.sort((a, b) => a.lineIndex - b.lineIndex);
          if (group.some((ref, index) => ref.observationIndex !== group[0].observationIndex ||
            (index > 0 && ref.lineIndex !== group[index - 1].lineIndex + 1))) return 'noncontiguous_source_lines';
        }
        let merged = groups[0].map(ref => resolveDraftLine(draft, ref)!);
        for (const group of groups.slice(1)) {
          const next = group.map(ref => resolveDraftLine(draft, ref)!);
          const candidates: number[] = [];
          for (let length = 1; length <= Math.min(merged.length, next.length); length++) {
            if (merged.slice(-length).every((line, at) => line.rawText === next[at].rawText)) candidates.push(length);
          }
          if (candidates.length !== 1) return candidates.length ? 'ambiguous_repeated_overlap' : 'no_matching_overlap';
          const overlap = candidates[0], one = next[0].rawText;
          // One isolated ingredient name cannot establish overlap across two photos.
          if (overlap === 1 && (one.length < 32 || !/\s/.test(one))) return 'insufficient_overlap';
          for (let i = 0; i < overlap; i++) {
            const old = merged[merged.length - overlap + i], incoming = next[i];
            if (old.text !== incoming.text) return 'corrected_overlap_disagrees';
            old.sources.push(...incoming.sources);
          }
          merged.push(...next.slice(overlap));
        }
        const previous = review.assemblies.filter(value => value.section === first.section && value.language === first.language).at(-1);
        review.assemblies.push({ revision: ++review.assemblyRevision, supersedesRevision: previous?.revision ?? null,
          section: first.section, language: first.language, sameDeclarationObservedBy: binding.ownerId, lines: copy(merged) });
      });
    },
  };
}

export function buildLocalDraftSummary(draft: CaptureDraft | null) {
  if (!draft || !draft.shots.length) return null;
  const readiness = draftReadiness(draft, false), prompts = draft.review.gaps.filter(gap => gap.status === 'missing').map(gap => DRAFT_GAP_PROMPTS[gap.kind]);
  if (!draft.coverage.startSeen) prompts.push('Select a visible start line, or add a photo showing the declaration start.');
  if (!draft.coverage.endSeen) prompts.push('Select a visible final line, or add a photo showing the declaration end.');
  for (const section of draft.coverage.requiredSections) if (!draft.coverage.observedSections.includes(section)) {
    if (section === 'active' || section === 'inactive') prompts.push(DRAFT_GAP_PROMPTS[section]);
  }
  const latest = draft.review.assemblies.filter(assembly => !draft.review.assemblies.some(other => other.supersedesRevision === assembly.revision));
  const assemblies = latest.map(assembly => ({ ...copy(assembly), stale: assembly.lines.some(line => line.sources.some(source => {
    const current = resolveDraftLine(draft, source);
    const assignment = draft.review.assignments.find(value => sameRef(value.ref, source));
    return !current || current.text !== line.text || current.correctionRevision !== source.correctionRevision ||
      !assignment || assignment.section !== assembly.section || assignment.language !== assembly.language ||
      !draft.review.samePackagePhotoIds.includes(source.evidenceId);
  })) }));
  const reasons = [...readiness.reasons]; if (assemblies.some(assembly => assembly.stale)) reasons.push('assembly_needs_review');
  if (draft.review.packageConflicts.length) prompts.push('A package mismatch was reported. Return to the product and rescan; confirmation or a correction cannot clear it.');
  if (reasons.includes('section_or_language_unreviewed')) prompts.push('Review the language and section of each readable line; explanatory text stays separate.');
  if (reasons.includes('label_scope_unknown')) prompts.push('Choose the label type, or keep its scope uncertain.');
  return { state: reasons.length ? 'partial' as const : readiness.state, reasons, prompts: [...new Set(prompts)], assemblies,
    photos: draft.shots.map((shot, index) => ({ evidenceId: shot.evidenceId, photoNumber: index + 1,
      lines: latestPhotoRefs(draft, shot.evidenceId).map(ref => ({ ref, ...resolveDraftLine(draft, ref)! })),
      samePackageObserved: draft.review.samePackagePhotoIds.includes(shot.evidenceId) })),
    limitations: ['Temporary local draft. No private text or photos are saved or uploaded.',
      'Coverage is marked by you; OCR confidence and product confirmation do not prove a complete declaration.'], canCommit: false as const };
}
