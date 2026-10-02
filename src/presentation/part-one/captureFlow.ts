import type { CaptureBinding, MemoryLabelDraft } from './capture.ts';
/** Existing session metadata alone cannot resume a removed/expired memory draft. */
export function resumeLocalCapture(draft: MemoryLabelDraft, binding: CaptureBinding | null, owner: string, result: { scanId: string; generation: number; itemId: string | null }, scrollOffset: number): CaptureBinding | null {
  if (!binding || !captureMatchesCurrentResult(binding, owner, result) || !draft.read(binding)) return null;
  draft.begin(binding, scrollOffset);
  return binding;
}

export function captureMatchesCurrentResult(binding: CaptureBinding | null, owner: string | null, result: { scanId: string; generation: number; itemId: string | null } | null): boolean {
  return Boolean(binding && result && owner && binding.ownerId === owner && binding.scanId === result.scanId
    && binding.generation === result.generation && binding.itemId === result.itemId);
}
