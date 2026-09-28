import React, { useMemo } from 'react';
import { Modal, View } from 'react-native';
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
  detectionPaused?: boolean;
  companion?: React.ReactNode;
}

export function CheckCaptureHost({ onClose, onCaptureReady, processor, initialRole = 'barcode', live = false, detectionPaused = false, companion = null }: Props) {
  const selectedProcessor = useMemo(() => processor ?? (live ? createLiveFreeEvidenceProcessor() : pendingCaptureProcessor), [processor, live]);
  const bridge = useMemo(() => createCheckCaptureBridge(selectedProcessor), [selectedProcessor]);

  return (
    // Capture belongs above the floating tab bar, not inside its content inset.
    // Native modal roots need their own provider for correct device safe areas.
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          <ProductEvidenceCapture
            onClose={onClose}
            initialRole={initialRole}
            autoFinishBarcode
            detectionPaused={detectionPaused}
            processor={bridge.processor}
            onEvidenceReady={(handoff) => onCaptureReady(bridge.handoff(handoff))}
          />
          {companion}
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}
