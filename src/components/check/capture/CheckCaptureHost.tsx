import React, { useMemo } from 'react';
import { Modal } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
    // Capture belongs above the floating tab bar, not inside its content inset.
    // Native modal roots need their own provider for correct device safe areas.
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaProvider>
        <ProductEvidenceCapture
          onClose={onClose}
          initialRole={initialRole}
          autoFinishBarcode
          processor={bridge.processor}
          onEvidenceReady={(handoff) => onCaptureReady(bridge.handoff(handoff))}
        />
      </SafeAreaProvider>
    </Modal>
  );
}
