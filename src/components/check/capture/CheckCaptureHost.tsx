import React, { useMemo } from 'react';
import { ProductEvidenceCapture } from './ProductEvidenceCapture';
import { createCheckCaptureBridge, type CheckCaptureHandoff } from '../../../presentation/capture/checkCaptureAdapter';
import { pendingCaptureProcessor, type CaptureProcessor } from '../../../presentation/capture/productEvidence';

interface Props {
  onClose: () => void;
  onCaptureReady: (handoff: CheckCaptureHandoff) => void;
  processor?: CaptureProcessor;
}

export function CheckCaptureHost({ onClose, onCaptureReady, processor = pendingCaptureProcessor }: Props) {
  const bridge = useMemo(() => createCheckCaptureBridge(processor), [processor]);

  return (
    <ProductEvidenceCapture
      onClose={onClose}
      processor={bridge.processor}
      onEvidenceReady={(handoff) => onCaptureReady(bridge.handoff(handoff))}
    />
  );
}
