import React, { useMemo } from 'react';
import { ProductEvidenceCapture } from './ProductEvidenceCapture';
import { createCheckCaptureBridge, type CheckCaptureHandoff } from '../../../presentation/capture/checkCaptureAdapter';
import { createLiveFreeEvidenceProcessor } from '../../../presentation/capture/liveFreeEvidenceProcessor';
import { pendingCaptureProcessor, type CaptureProcessor, type CaptureRole } from '../../../presentation/capture/productEvidence';

interface Props {
  onClose: () => void;
  onCaptureReady: (handoff: CheckCaptureHandoff) => void;
  processor?: CaptureProcessor;
  initialRole?: CaptureRole;
  live?: boolean;
}

export function CheckCaptureHost({ onClose, onCaptureReady, processor, initialRole = 'barcode', live = false }: Props) {
  const selectedProcessor = useMemo(() => processor ?? (live ? createLiveFreeEvidenceProcessor() : pendingCaptureProcessor), [processor, live]);
  const bridge = useMemo(() => createCheckCaptureBridge(selectedProcessor), [selectedProcessor]);

  return (
    <ProductEvidenceCapture
      onClose={onClose}
      initialRole={initialRole}
      autoFinishBarcode
      processor={bridge.processor}
      onEvidenceReady={(handoff) => onCaptureReady(bridge.handoff(handoff))}
    />
  );
}
