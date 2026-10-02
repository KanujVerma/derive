import type { CaptureBinding, MemoryLabelDraft } from './capture.ts';
export type CaptureResultContext = { scanId: string; generation: number; itemId: string | null };
export type CaptureDisplayContext = CaptureResultContext & { display: { selectedIdentity: { id: string; brand: string | null; name: string; variantText: string | null } | null } };
/** Existing session metadata alone cannot resume a removed/expired memory draft. */
export function resumeLocalCapture(draft: MemoryLabelDraft, binding: CaptureBinding | null, owner: string, result: CaptureResultContext, scrollOffset: number): CaptureBinding | null {
  if (!binding || !captureMatchesCurrentResult(binding, owner, result) || !draft.read(binding)) return null;
  draft.begin(binding, scrollOffset);
  return binding;
}

/** A capture that started unresolved keeps that original context through same-generation catalog enrichment.
 * Its null item binding never adopts the new identity; owner, scan and generation remain strict. */
export function captureMatchesCurrentResult(binding: CaptureBinding | null, owner: string | null, result: CaptureResultContext | null): boolean {
  return Boolean(binding && result && owner && binding.ownerId === owner && binding.scanId === result.scanId
    && binding.generation === result.generation && (binding.itemId === null || binding.itemId === result.itemId));
}

/** A late capture creation reply cannot silently adopt an item published after the explicit request. */
export function captureResponseMatchesRequest(owner: string, currentOwner: string | null,
  requested: CaptureResultContext, response: CaptureResultContext, current: CaptureResultContext | null): boolean {
  return owner === currentOwner && response.scanId === requested.scanId && response.generation === requested.generation &&
    response.itemId === requested.itemId && Boolean(current && current.scanId === requested.scanId && current.generation === requested.generation);
}

/** Freeze the displayed package context when the capture starts, never from later polling updates. */
export function localCaptureProductLabel(binding: CaptureBinding, result: CaptureDisplayContext): string {
  if (binding.itemId === null) return 'Unresolved product · original capture';
  const identity = result.display.selectedIdentity;
  return identity?.id === binding.itemId ? [identity.brand, identity.name, identity.variantText].filter(Boolean).join(' ') : 'Selected product · original capture';
}
