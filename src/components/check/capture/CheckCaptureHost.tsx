import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CHECK_PHOTO_CAPTURE_ENABLED } from '../../../presentation/capture/capabilities';
import { ProductEvidenceCapture } from './ProductEvidenceCapture';
import { createCheckCaptureBridge, type CheckCaptureHandoff } from '../../../presentation/capture/checkCaptureAdapter';
import { createLiveFreeEvidenceProcessor } from '../../../presentation/capture/liveFreeEvidenceProcessor';
import { pendingCaptureProcessor, type CaptureEvidence, type CaptureHandoff, type CaptureProcessor, type CaptureRole } from '../../../presentation/capture/productEvidence';

import { createIngredientPanelSession, type IngredientPanelSession } from '../../../presentation/capture/ingredientPanelSession';

interface Props {
  onClose: () => void;
  onCaptureReady: (handoff: CheckCaptureHandoff) => void;
  processor?: CaptureProcessor;
  initialRole?: CaptureRole;
  initialEvidence?: readonly CaptureEvidence[];
  photoCaptureEnabled?: boolean;
  resumeKey?: number;
  onSearch?: () => void;
  onProductLink?: () => void;
  ingredientPanels?: IngredientPanelSession;
  live?: boolean;
  detectionPaused?: boolean;
  catalogSearch?: (query: string) => Promise<import('../../../contracts/ProductCatalog').CatalogProductSummary[]>;
  onCatalogSelect?: (product: import('../../../contracts/ProductCatalog').CatalogProductSummary) => void;
  companion?: React.ReactNode;
}

export function CheckCaptureHost({ onClose, onCaptureReady, processor, initialRole = 'barcode', initialEvidence = [], photoCaptureEnabled = CHECK_PHOTO_CAPTURE_ENABLED, resumeKey = 0, onSearch, onProductLink, ingredientPanels: suppliedPanels, live = false, detectionPaused = false, catalogSearch, onCatalogSelect, companion = null }: Props) {
  const [ownedPanels] = useState(createIngredientPanelSession);
  const ingredientPanels = suppliedPanels ?? ownedPanels;
  const [appActive, setAppActive] = useState(() => AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const activeRef = useRef(appActive);
  const delivered = useRef(false);
  const pendingHandoff = useRef<{ handoff: CaptureHandoff; generation: number } | null>(null);
  const lastResumeKey = useRef(resumeKey);
  if (lastResumeKey.current !== resumeKey) {
    lastResumeKey.current = resumeKey;
    delivered.current = false;
    pendingHandoff.current = null;
  }
  const selectedProcessor = useMemo(() => processor ?? (live ? createLiveFreeEvidenceProcessor(ingredientPanels) : pendingCaptureProcessor), [processor, live, ingredientPanels]);
  const bridge = useMemo(() => createCheckCaptureBridge(selectedProcessor, ingredientPanels), [selectedProcessor, ingredientPanels]);
  useEffect(() => () => bridge.cancel(), [bridge]);
  const handoffRef = useRef((handoff: CaptureHandoff) => onCaptureReady(bridge.handoff(handoff)));
  handoffRef.current = handoff => onCaptureReady(bridge.handoff(handoff));
  const generation = ingredientPanels.getGeneration();
  const deliver = (handoff: CaptureHandoff, producingGeneration = generation) => {
    if (delivered.current || producingGeneration !== ingredientPanels.getGeneration()) return;
    if (!activeRef.current) { pendingHandoff.current ??= { handoff, generation: producingGeneration }; return; }
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
      if (activeRef.current && pendingHandoff.current) {
        const pending = pendingHandoff.current; pendingHandoff.current = null;
        deliver(pending.handoff, pending.generation);
      }
    });
    return () => { activeRef.current = false; delivered.current = true; pendingHandoff.current = null; subscription.remove(); };
  }, []);

  const close = () => {
    activeRef.current = false; delivered.current = true; pendingHandoff.current = null;
    bridge.cancel(); onClose();
  };

  return (
    // Capture belongs above the floating tab bar, not inside its content inset.
    // Native modal roots need their own provider for correct device safe areas.
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={close}>
      <SafeAreaProvider>
        <View style={{ flex: 1 }}>
          <ProductEvidenceCapture
            onClose={close}
            initialRole={initialRole}
            autoFinishBarcode
            hostOwnsResults
            initialEvidence={initialEvidence}
            photoCaptureEnabled={photoCaptureEnabled}
            resumeKey={resumeKey}
            onSearch={onSearch}
            onProductLink={onProductLink}
            ingredientPanels={ingredientPanels}
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
