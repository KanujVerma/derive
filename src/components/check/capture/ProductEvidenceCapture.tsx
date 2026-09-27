import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radii, spacing, typography } from '../../../constants/theme';
import { Icon } from '../../ui/Icon';
import { captureRecovery } from '../../../presentation/capture/captureRecovery';
import { createCaptureOperationGate } from '../../../presentation/capture/captureOperationGate';
import {
  captureRoles, createCaptureSession, pendingCaptureProcessor, reduceCapture, toCaptureHandoff,
  type CaptureHandoff, type CaptureProcessor, type CaptureRole, type PhotoRole,
} from '../../../presentation/capture/productEvidence';

const roleLabels: Record<CaptureRole, string> = {
  barcode: 'Barcode', front_label: 'Front label', ingredients: 'Ingredients', packaging: 'Packaging',
};
const prompts: Record<CaptureRole, string> = {
  barcode: 'Place the barcode inside the frame',
  front_label: 'Frame the product name and brand',
  ingredients: 'Fill the frame with the ingredient list',
  packaging: 'Capture a useful package detail',
};

interface Props {
  onClose: () => void;
  onEvidenceReady: (handoff: CaptureHandoff) => void;
  processor?: CaptureProcessor;
  initialRole?: CaptureRole;
  autoFinishBarcode?: boolean;
}

export function ProductEvidenceCapture({ onClose, onEvidenceReady, processor = pendingCaptureProcessor, initialRole = 'barcode', autoFinishBarcode = false }: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [session, setSession] = useState(createCaptureSession);
  const [role, setRole] = useState<CaptureRole>(initialRole);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [canCollectMore, setCanCollectMore] = useState(true);
  const camera = useRef<CameraView>(null);
  const scanLocked = useRef(false);
  const requestSequence = useRef(0);
  const operations = useRef(createCaptureOperationGate()).current;
  const currentEvidence = session.evidence.find((item) => item.role === role);

  useEffect(() => () => {
    requestSequence.current += 1;
    operations.cancel();
  }, [operations]);

  const close = () => {
    requestSequence.current += 1;
    operations.cancel();
    onClose();
  };

  const selectRole = (nextRole: CaptureRole) => {
    operations.whenIdle(() => {
      scanLocked.current = !!session.evidence.find((item) => item.role === nextRole);
      setRole(nextRole);
      setPreviewUri(null);
      setError(null);
      setCanRetry(false);
      void Haptics.selectionAsync().catch(() => {});
    });
  };

  const capturePhoto = async () => {
    if (role === 'barcode' || busy) return;
    await operations.run(async (isCurrent) => {
      setBusy(true);
      setError(null);
      try {
        const photo = await camera.current?.takePictureAsync({ quality: 0.85 });
        if (!isCurrent()) return;
        if (!photo?.uri) throw new Error('No photo returned');
        setPreviewUri(photo.uri);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch {
        if (isCurrent()) setError('Could not take the photo. Please try again.');
      } finally {
        if (isCurrent()) setBusy(false);
      }
    });
  };

  const usePhoto = () => {
    if (!previewUri || role === 'barcode') return;
    setSession((previous) => reduceCapture(previous, { type: 'photo', role, uri: previewUri }));
    setPreviewUri(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const onBarcode = ({ data }: BarcodeScanningResult) => {
    if (role !== 'barcode' || scanLocked.current || !/^\d{8,14}$/.test(data)) return;
    scanLocked.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (autoFinishBarcode && !session.evidence.some((item) => item.kind === 'local_photo')) {
      onEvidenceReady(toCaptureHandoff(reduceCapture(session, { type: 'barcode', value: data })));
      return;
    }
    setSession((previous) => reduceCapture(previous, { type: 'barcode', value: data }));
  };

  const retake = () => {
    requestSequence.current += 1;
    setSession((previous) => reduceCapture(previous, { type: 'retake', role }));
    setPreviewUri(null);
    scanLocked.current = false;
    setError(null);
    setCanRetry(false);
    void Haptics.selectionAsync().catch(() => {});
  };

  const processEvidence = async () => {
    if (!session.evidence.length || session.phase === 'processing') return;
    await operations.run(async (isCurrent) => {
      const sequence = ++requestSequence.current;
      const evidence = session.evidence;
      setSession((previous) => reduceCapture(previous, { type: 'process' }));
      setError(null);
      setCanRetry(false);
      try {
        const result = await processor.process(evidence);
        if (!isCurrent() || sequence !== requestSequence.current) return;
        setSession((previous) => reduceCapture(previous, { type: 'resolved', result }));
      } catch (cause) {
        if (!isCurrent() || sequence !== requestSequence.current) return;
        setSession((previous) => reduceCapture(previous, { type: 'resolved', result: { state: 'insufficient_evidence', candidates: [] } }));
        const recovery = captureRecovery(cause);
        setCanRetry(recovery.canRetry);
        setCanCollectMore(recovery.canCollectMore);
        setError(recovery.message);
      }
    });
  };

  const collectMore = () => {
    requestSequence.current += 1;
    setSession((previous) => reduceCapture(previous, { type: 'collect_more' }));
    selectRole(captureRoles.find((candidate) => !session.evidence.some((item) => item.role === candidate)) ?? 'front_label');
  };

  const finish = () => onEvidenceReady(toCaptureHandoff(session));

  return (
    <View style={styles.root}>
      {permission?.granted && session.phase === 'collecting' && !currentEvidence && !previewUri ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8'] }}
          onBarcodeScanned={role === 'barcode' ? onBarcode : undefined}
        />
      ) : previewUri ? (
        <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : currentEvidence?.kind === 'local_photo' && session.phase === 'collecting' ? (
        <Image source={{ uri: currentEvidence.value }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}
      <View style={[styles.top, { paddingTop: Math.max(insets.top, spacing.md) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close product capture" onPress={close} style={styles.iconButton}>
          <Icon name="close" size={20} color={colors.inkInverse} />
        </Pressable>
        <Text style={styles.topTitle}>Capture product</Text>
        <View style={styles.iconButton} />
      </View>

      {session.phase === 'collecting' && !permission?.granted ? (
        <View style={styles.permissionCenter}>
          <Text style={styles.permissionTitle}>Camera access</Text>
          <Text style={styles.permissionText}>Use your camera to capture the package details you have.</Text>
          <Action label={permission?.canAskAgain === false ? 'Open Settings' : 'Enable camera'} onPress={() => {
            if (permission?.canAskAgain === false) void Linking.openSettings();
            else void requestPermission();
          }} />
        </View>
      ) : session.phase === 'collecting' ? (
        <View style={styles.collecting}>
          <View pointerEvents="none" style={styles.guideArea}>
            {role === 'barcode' && !currentEvidence && !previewUri ? (
              // Alignment aid only: Expo still detects barcodes across the whole preview.
              <View testID="barcode-alignment-guide" style={styles.barcodeGuide} />
            ) : null}
          </View>
          <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.panel}>
              <ScrollView style={styles.controlScroll} contentContainerStyle={styles.controlContent}>
                <Text style={styles.prompt}>{previewUri ? `Review ${roleLabels[role].toLowerCase()}` : currentEvidence ? `${roleLabels[role]} saved` : prompts[role]}</Text>
                <Text style={styles.hint}>{role === 'barcode' ? 'Hold steady. The barcode scans automatically.' : 'Capture package details. Photos do not verify the formula.'}</Text>
                <View style={styles.roleRow}>
                  {captureRoles.map((item) => {
                    const saved = session.evidence.some((entry) => entry.role === item);
                    return (
                      <Pressable key={item} accessibilityRole="button" accessibilityLabel={`${roleLabels[item]}${saved ? ', captured' : ''}`} accessibilityState={{ selected: role === item, disabled: busy }} disabled={busy} onPress={() => selectRole(item)} style={[styles.roleChip, role === item && styles.roleChipActive]}>
                        <Text style={[styles.roleText, role === item && styles.roleTextActive]}>{saved ? '✓ ' : ''}{roleLabels[item]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {error && <Text style={styles.error}>{error}</Text>}
              </ScrollView>
              <View style={styles.captureActions}>
                {previewUri ? (
                  <View style={styles.actionRow}><Action label="Retake" secondary onPress={() => setPreviewUri(null)} /><Action label="Use photo" onPress={usePhoto} /></View>
                ) : currentEvidence ? (
                  <View style={styles.actionRow}><Action label="Retake" secondary onPress={retake} /><Action label="Review evidence" onPress={() => void processEvidence()} /></View>
                ) : role === 'barcode' ? (
                  <View style={styles.actionRow}><Text style={styles.scanHint}>Scanning barcode…</Text>{session.evidence.length > 0 && <Action label="Review evidence" onPress={() => void processEvidence()} />}</View>
                ) : (
                  <View style={styles.actionRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Take ${roleLabels[role]} photo`} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void capturePhoto()} style={[styles.shutter, busy && styles.shutterBusy]}>
                      {busy ? <ActivityIndicator color={colors.inkInverse} /> : <View style={styles.shutterInner} />}
                    </Pressable>
                    {session.evidence.length > 0 && <Action label="Review evidence" onPress={() => void processEvidence()} />}
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.outcomeWrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <ScrollView contentContainerStyle={styles.outcomeScroll}>
            <Text style={styles.outcomeTitle}>{session.phase === 'processing' ? 'Reviewing evidence' : session.phase === 'candidates' ? 'Possible product' : session.phase === 'ambiguous' ? 'Several possible products' : session.phase === 'candidate_selected' ? 'Candidate noted' : session.phase === 'unknown' ? 'Product unknown' : 'More evidence needed'}</Text>
            <Text style={styles.outcomeBody}>{session.phase === 'processing' ? 'Checking the details you captured.' : session.phase === 'candidate_selected' ? 'Your selection is recorded as a possible match. It does not add verification.' : session.phase === 'unknown' ? 'We could not identify this product from the available evidence.' : session.phase === 'insufficient_evidence' ? 'We could not confirm this product. Try its barcode or search by name. Automatic photo identification is not available yet.' : 'Choose a possible match if you recognize it. Your choice does not verify the product or formula.'}</Text>
            {session.phase === 'processing' && <ActivityIndicator color={colors.brand} size="large" />}
            {(session.phase === 'candidates' || session.phase === 'ambiguous') && session.candidates.map((candidate) => (
              <Pressable key={candidate.id} accessibilityRole="button" onPress={() => { setSession((previous) => reduceCapture(previous, { type: 'confirm_candidate', candidateId: candidate.id })); void Haptics.selectionAsync().catch(() => {}); }} style={styles.candidate}>
                <Text style={styles.candidateLabel}>{candidate.label}</Text>
                <Text style={styles.candidateDetail}>{candidate.detail ?? 'Possible match. Formula unverified.'}</Text>
              </Pressable>
            ))}
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.outcomeActions}>
              {error && canRetry && <Action label="Try review again" onPress={() => void processEvidence()} />}
              {session.phase !== 'processing' && (canCollectMore
                ? <Action label="Add or retake evidence" secondary onPress={collectMore} />
                : <Action label="Close capture" secondary onPress={close} />)}
              {session.phase !== 'processing' && !error && <Action label="Continue with evidence" onPress={finish} />}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function Action({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, secondary && styles.secondaryAction]}><Text style={[styles.actionText, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  top: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm, backgroundColor: 'rgba(23,26,24,0.7)' },
  iconButton: { minWidth: layout.minTouchTarget, minHeight: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flexShrink: 1, textAlign: 'center', color: colors.inkInverse, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold },
  collecting: { flex: 1 },
  guideArea: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  barcodeGuide: { width: '90%', maxWidth: 340, height: 140, borderWidth: 2, borderColor: colors.inkInverse, borderRadius: radii.md, backgroundColor: 'rgba(23,26,24,0.12)' },
  bottom: { flexShrink: 1, maxHeight: '75%', paddingHorizontal: spacing.md },
  panel: { flexShrink: 1, padding: spacing.md, borderRadius: radii.xl, backgroundColor: 'rgba(23,26,24,0.94)' },
  controlScroll: { flexGrow: 0, flexShrink: 1 },
  controlContent: { paddingBottom: spacing.sm },
  captureActions: { flexShrink: 0, paddingTop: spacing.sm },
  prompt: { color: colors.inkInverse, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold, lineHeight: typography.lineHeights.bodyLarge },
  hint: { color: '#E6E9E5', fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption, marginTop: spacing.xs },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.sm },
  roleChip: { flexBasis: '45%', flexGrow: 1, minHeight: layout.minTouchTarget, borderRadius: radii.full, borderWidth: 1, borderColor: '#A9B5AC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  roleChipActive: { backgroundColor: colors.surface },
  roleText: { color: colors.inkInverse, textAlign: 'center', fontSize: typography.sizes.caption, fontWeight: typography.weights.medium },
  roleTextActive: { color: colors.ink },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  action: { minHeight: layout.ctaHeight, minWidth: 116, maxWidth: '100%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  secondaryAction: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.surface },
  actionText: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold, textAlign: 'center' },
  secondaryText: { color: colors.inkInverse },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.surface },
  shutterBusy: { opacity: 0.6 },
  scanHint: { color: colors.inkInverse, minHeight: layout.minTouchTarget, textAlignVertical: 'center' },
  error: { color: '#FFD5D1', fontSize: typography.sizes.caption, marginVertical: spacing.xs },
  permissionCenter: { flex: 1, padding: spacing.xl, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  permissionTitle: { color: colors.inkInverse, fontSize: typography.sizes.screenTitle, fontWeight: typography.weights.semibold },
  permissionText: { color: colors.inkInverse, fontSize: typography.sizes.bodyRegular, textAlign: 'center' },
  outcomeWrap: { flex: 1, backgroundColor: colors.canvas },
  outcomeScroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, gap: spacing.md },
  outcomeTitle: { fontSize: typography.sizes.screenTitle, color: colors.ink, fontWeight: typography.weights.semibold },
  outcomeBody: { fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, color: colors.inkMuted },
  candidate: { minHeight: 72, borderRadius: radii.md, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface, padding: spacing.md, justifyContent: 'center' },
  candidateLabel: { color: colors.ink, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold },
  candidateDetail: { color: colors.inkMuted, fontSize: typography.sizes.caption, marginTop: spacing.xxs },
  outcomeActions: { gap: spacing.sm, marginTop: spacing.md },
});
