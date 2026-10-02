import React from 'react';
import type { CaptureBinding, MemoryLabelDraft } from '../../../presentation/part-one/capture';
import { captureMatchesCurrentResult } from '../../../presentation/part-one/captureFlow';
import type { CaptureResultContext } from '../../../presentation/part-one/captureFlow';
import { PartOneLabelCapture } from './PartOneLabelCapture';

type Props = { open: boolean; draft: MemoryLabelDraft; binding: CaptureBinding | null; owner: string | null;
  result: CaptureResultContext | null; productLabel: string; privatePanel?: React.ReactNode; interactionLocked?: boolean; onPackagePhotoAdded?: (evidenceId: string) => void; onClose: () => void; onChange: () => void };
/** This stable mount boundary keeps a pending system picker attached to its original unresolved scan. */
export function PartOneActiveCapture({ open, draft, binding, owner, result, productLabel, privatePanel, interactionLocked, onPackagePhotoAdded, onClose, onChange }: Props) {
  if (!open || !binding || !captureMatchesCurrentResult(binding, owner, result)) return null;
  return <PartOneLabelCapture draft={draft} binding={binding} productLabel={productLabel} privatePanel={privatePanel} interactionLocked={interactionLocked} onPackagePhotoAdded={onPackagePhotoAdded} onClose={onClose} onChange={onChange} />;
}
