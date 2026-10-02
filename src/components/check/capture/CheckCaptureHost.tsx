import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CHECK_PHOTO_CAPTURE_ENABLED } from '../../../presentation/capture/capabilities';
import { ProductEvidenceCapture } from './ProductEvidenceCapture';
import { createCheckCaptureBridge, type CheckCaptureHandoff } from '../../../presentation/capture/checkCaptureAdapter';
import { createLiveFreeEvidenceProcessor } from '../../../presentation/capture/liveFreeEvidenceProcessor';
import { pendingCaptureProcessor, type CaptureEvidence, type CaptureHandoff, type CaptureProcessor, type CaptureRole } from '../../../presentation/capture/productEvidence';

interface Props {
  onClose: () => void;
  onCaptureReady: (handoff: CheckCaptureHandoff) => void;
  processor?: CaptureProcessor;
  initialRole?: CaptureRole;
  initialEvidence?: readonly CaptureEvidence[];
  photoCaptureEnabled?: boolean;
  resumeKey?: number;
  onSearch?: () => void;
  live?: boolean;
  detectionPaused?: boolean;
  catalogSearch?: (query: string) => Promise<import('../../../contracts/ProductCatalog').CatalogProductSummary[]>;
  onCatalogSelect?: (product: import('../../../contracts/ProductCatalog').CatalogProductSummary) => void;
  companion?: React.ReactNode;
}

export function CheckCaptureHost({ onClose, onCaptureReady, processor, initialRole = 'barcode', initialEvidence = [], photoCaptureEnabled = CHECK_PHOTO_CAPTURE_ENABLED, resumeKey = 0, onSearch, live = false, detectionPaused = false, catalogSearch, onCatalogSelect, companion = null }: Props) {
  const [appActive, setAppActive] = useState(() => AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const activeRef = useRef(appActive);
  const delivered = useRef(false);
  const pendingHandoff = useRef<CaptureHandoff | null>(null);
  const lastResumeKey = useRef(resumeKey);
  if (lastResumeKey.current !== resumeKey) {
    lastResumeKey.current = resumeKey;
    delivered.current = false;
    pendingHandoff.current = null;
  }
  const selectedProcessor = useMemo(() => processor ?? (live ? createLiveFreeEvidenceProcessor() : pendingCaptureProcessor), [processor, live]);
  const bridge = useMemo(() => createCheckCaptureBridge(selectedProcessor), [selectedProcessor]);
  const handoffRef = useRef((handoff: CaptureHandoff) => onCaptureReady(bridge.handoff(handoff)));
  handoffRef.current = handoff => onCaptureReady(bridge.handoff(handoff));
  const deliver = (handoff: CaptureHandoff) => {
    if (delivered.current) return;
    if (!activeRef.current) { pendingHandoff.current ??= handoff; return; }
    delivered.current = true;
    pendingHandoff.current = null;
    handoffRef.current(handoff);
  };
  useEffect(() => {
    activeRef.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const subscription = AppState.addEventListener('change', state => {
      activeRef.current = state === 'active';
      setAppActive(activeRef.current);
      // Keep completed customer evidence local until foreground; do not lose it
      // behind a capture lock or issue a second resolver call on resume.
      if (activeRef.current && pendingHandoff.current) deliver(pendingHandoff.current);
    });
    return () => { activeRef.current = false; delivered.current = true; pendingHandoff.current = null; subscription.remove(); };
  }, []);

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
            hostOwnsResults
            initialEvidence={initialEvidence}
            photoCaptureEnabled={photoCaptureEnabled}
            resumeKey={resumeKey}
            onSearch={onSearch}
            detectionPaused={detectionPaused || !appActive}
            catalogSearch={catalogSearch}
            onCatalogSelect={product => { if (activeRef.current && !delivered.current && onCatalogSelect) { delivered.current = true; onCatalogSelect(product); } }}
            processor={bridge.processor}
            onEvidenceReady={deliver}
          />
          {companion}
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}
