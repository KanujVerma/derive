import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radii, spacing, typography } from '../../../constants/theme';
import { Icon } from '../../ui/Icon';
import { GlassContainer } from '../../ui/GlassContainer';
import { CaptureProcessingError } from '../../../presentation/capture/freeEvidenceProcessor';
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
}

export function ProductEvidenceCapture({ onClose, onEvidenceReady, processor = pendingCaptureProcessor, initialRole = 'barcode' }: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [session, setSession] = useState(createCaptureSession);
  const [role, setRole] = useState<CaptureRole>(initialRole);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const camera = useRef<CameraView>(null);
  const scanLocked = useRef(false);
  const requestSequence = useRef(0);
  const currentEvidence = session.evidence.find((item) => item.role === role);

  const selectRole = (nextRole: CaptureRole) => {
    scanLocked.current = !!session.evidence.find((item) => item.role === nextRole);
    setRole(nextRole);
    setPreviewUri(null);
    setError(null);
    setCanRetry(false);
    void Haptics.selectionAsync().catch(() => {});
  };

  const capturePhoto = async () => {
    if (role === 'barcode' || busy) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await camera.current?.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) throw new Error('No photo returned');
      setPreviewUri(photo.uri);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      setError('Could not take the photo. Please try again.');
    } finally {
      setBusy(false);
    }
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
    setSession((previous) => reduceCapture(previous, { type: 'barcode', value: data }));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
    const sequence = ++requestSequence.current;
    const evidence = session.evidence;
    setSession((previous) => reduceCapture(previous, { type: 'process' }));
    setError(null);
    setCanRetry(false);
    try {
      const result = await processor.process(evidence);
      if (sequence !== requestSequence.current) return;
      setSession((previous) => reduceCapture(previous, { type: 'resolved', result }));
    } catch (cause) {
      if (sequence !== requestSequence.current) return;
      setSession((previous) => reduceCapture(previous, { type: 'resolved', result: { state: 'insufficient_evidence', candidates: [] } }));
      setCanRetry(!(cause instanceof CaptureProcessingError && (cause.code === 'PHOTO_TOO_LARGE' || cause.code === 'PHOTO_MIME_UNSUPPORTED')));
      setError(cause instanceof CaptureProcessingError && cause.code === 'PHOTO_TOO_LARGE'
        ? 'This photo is too large. Retake it and try again.'
        : cause instanceof CaptureProcessingError && cause.code === 'PHOTO_MIME_UNSUPPORTED'
          ? 'This photo format could not be used. Retake it and try again.'
          : 'We could not review this evidence yet. Your captures are still here.');
    }
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
        <Pressable accessibilityRole="button" accessibilityLabel="Close product capture" onPress={onClose} style={styles.iconButton}>
          <Icon name="close" size={20} color={colors.inkInverse} />
        </Pressable>
        <Text style={styles.topTitle}>Product evidence</Text>
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
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <GlassContainer tintColor={colors.glass.tintDark} style={styles.panel}>
            <Text style={styles.prompt}>{previewUri ? `Review ${roleLabels[role].toLowerCase()}` : currentEvidence ? `${roleLabels[role]} saved` : prompts[role]}</Text>
            <Text style={styles.hint}>Photos and scans are evidence. Product and formula details need verification.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleRow}>
              {captureRoles.map((item) => {
                const saved = session.evidence.some((entry) => entry.role === item);
                return (
                  <Pressable key={item} accessibilityRole="button" accessibilityLabel={`${roleLabels[item]}${saved ? ', captured' : ''}`} onPress={() => selectRole(item)} style={[styles.roleChip, role === item && styles.roleChipActive]}>
                    <Text style={[styles.roleText, role === item && styles.roleTextActive]}>{saved ? '✓ ' : ''}{roleLabels[item]}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {error && <Text style={styles.error}>{error}</Text>}
            {previewUri ? (
              <View style={styles.actionRow}><Action label="Retake" secondary onPress={() => setPreviewUri(null)} /><Action label="Use photo" onPress={usePhoto} /></View>
            ) : currentEvidence ? (
              <View style={styles.actionRow}><Action label="Retake" secondary onPress={retake} /><Action label="Review evidence" onPress={() => void processEvidence()} /></View>
            ) : role === 'barcode' ? (
              <View style={styles.actionRow}><Text style={styles.scanHint}>Scanning barcode…</Text>{session.evidence.length > 0 && <Action label="Review evidence" onPress={() => void processEvidence()} />}</View>
            ) : (
              <View style={styles.actionRow}><Pressable accessibilityRole="button" accessibilityLabel={`Take ${roleLabels[role]} photo`} disabled={busy} onPress={() => void capturePhoto()} style={styles.shutter}><View style={styles.shutterInner} /></Pressable>{session.evidence.length > 0 && <Action label="Review evidence" onPress={() => void processEvidence()} />}</View>
            )}
          </GlassContainer>
        </View>
      ) : (
        <View style={[styles.outcomeWrap, { paddingTop: Math.max(insets.top, spacing.md) + 72, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <ScrollView contentContainerStyle={styles.outcomeScroll}>
            <Text style={styles.outcomeTitle}>{session.phase === 'processing' ? 'Reviewing evidence' : session.phase === 'candidates' ? 'Possible product' : session.phase === 'ambiguous' ? 'Several possible products' : session.phase === 'candidate_selected' ? 'Candidate noted' : session.phase === 'unknown' ? 'Product unknown' : 'More evidence needed'}</Text>
            <Text style={styles.outcomeBody}>{session.phase === 'processing' ? 'Checking the details you captured.' : session.phase === 'candidate_selected' ? 'Your selection is recorded as a possible match. Product and formula details still need verification.' : session.phase === 'unknown' ? 'We could not identify this product from the available evidence.' : session.phase === 'insufficient_evidence' ? 'A clearer label or ingredient list may help identify this product.' : 'Choose a possible match if you recognize it. This does not verify the product or formula.'}</Text>
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
              {session.phase !== 'processing' && <Action label="Add or retake evidence" secondary onPress={collectMore} />}
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
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.md, backgroundColor: 'rgba(23,26,24,0.45)' },
  iconButton: { minWidth: layout.minTouchTarget, minHeight: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.inkInverse, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold },
  bottom: { marginTop: 'auto', paddingHorizontal: spacing.md },
  panel: { padding: spacing.md },
  prompt: { color: colors.inkInverse, fontSize: typography.sizes.sectionTitle, fontWeight: typography.weights.semibold, lineHeight: typography.lineHeights.sectionTitle },
  hint: { color: '#E6E9E5', fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption, marginTop: spacing.xs },
  roleRow: { gap: spacing.xs, paddingVertical: spacing.md },
  roleChip: { minHeight: layout.minTouchTarget, borderRadius: radii.full, borderWidth: 1, borderColor: '#A9B5AC', justifyContent: 'center', paddingHorizontal: spacing.md },
  roleChipActive: { backgroundColor: colors.surface },
  roleText: { color: colors.inkInverse, fontSize: typography.sizes.caption, fontWeight: typography.weights.medium },
  roleTextActive: { color: colors.ink },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  action: { minHeight: layout.ctaHeight, minWidth: 116, paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  secondaryAction: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.surface },
  actionText: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold, textAlign: 'center' },
  secondaryText: { color: colors.inkInverse },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.surface },
  scanHint: { color: colors.inkInverse, minHeight: layout.minTouchTarget, textAlignVertical: 'center' },
  error: { color: '#FFD5D1', fontSize: typography.sizes.caption, marginVertical: spacing.xs },
  permissionCenter: { flex: 1, padding: spacing.xl, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  permissionTitle: { color: colors.inkInverse, fontSize: typography.sizes.screenTitle, fontWeight: typography.weights.semibold },
  permissionText: { color: colors.inkInverse, fontSize: typography.sizes.bodyRegular, textAlign: 'center' },
  outcomeWrap: { flex: 1, backgroundColor: colors.canvas },
  outcomeScroll: { paddingHorizontal: spacing.xl, gap: spacing.md },
  outcomeTitle: { fontSize: typography.sizes.screenTitle, color: colors.ink, fontWeight: typography.weights.semibold },
  outcomeBody: { fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, color: colors.inkMuted },
  candidate: { minHeight: 72, borderRadius: radii.md, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface, padding: spacing.md, justifyContent: 'center' },
  candidateLabel: { color: colors.ink, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold },
  candidateDetail: { color: colors.inkMuted, fontSize: typography.sizes.caption, marginTop: spacing.xxs },
  outcomeActions: { gap: spacing.sm, marginTop: spacing.md },
});
