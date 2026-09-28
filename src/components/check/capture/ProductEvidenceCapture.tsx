import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, LayoutAnimation, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radii, spacing, typography } from '../../../constants/theme';
import { Icon } from '../../ui/Icon';
import { captureRecovery } from '../../../presentation/capture/captureRecovery';
import { createCaptureOperationGate } from '../../../presentation/capture/captureOperationGate';
import { canObserveLiveBarcode, isObservedRetailBarcode, stillPhotoRole, type CaptureIntent } from '../../../presentation/capture/autoCapture';
import {
  captureRoles, createCaptureSession, pendingCaptureProcessor, reduceCapture, toCaptureHandoff,
  type CaptureAction, type CaptureHandoff, type CaptureProcessor, type CaptureRole, type PhotoRole,
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
  const [intent, setIntent] = useState<CaptureIntent>('auto');
  const [showCorrection, setShowCorrection] = useState(false);
  const [previewRole, setPreviewRole] = useState<PhotoRole | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [canCollectMore, setCanCollectMore] = useState(true);
  const camera = useRef<CameraView>(null);
  const mounted = useRef(true);
  const currentSession = useRef(session);
  const previewActive = useRef(false);
  const latestIntent = useRef(intent);
  latestIntent.current = intent;
  const scanLocked = useRef(false);
  const requestSequence = useRef(0);
  const operations = useRef(createCaptureOperationGate()).current;
  const currentEvidence = intent === 'auto' ? undefined : session.evidence.find((item) => item.role === role);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
      operations.cancel();
    };
  }, [operations]);

  const dispatchCapture = (action: CaptureAction) => {
    currentSession.current = reduceCapture(currentSession.current, action);
    setSession(currentSession.current);
  };
  const setPreview = (uri: string | null) => {
    previewActive.current = uri !== null;
    setPreviewUri(uri);
  };

  const close = () => {
    mounted.current = false;
    requestSequence.current += 1;
    operations.cancel();
    onClose();
  };

  const animateOptions = () => {
    if (Platform.OS === 'ios') LayoutAnimation.configureNext({ duration: 180,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  };

  const selectRole = (nextRole: CaptureRole) => {
    operations.whenIdle(() => {
      scanLocked.current = currentSession.current.evidence.some((item) => item.role === nextRole);
      setRole(nextRole);
      setIntent(nextRole);
      latestIntent.current = nextRole;
      animateOptions();
      setShowCorrection(false);
      setPreview(null);
      setPreviewRole(null);
      setError(null);
      setCanRetry(false);
      void Haptics.selectionAsync().catch(() => {});
    });
  };

  const capturePhoto = async () => {
    if (intent === 'barcode' || busy) return;
    await operations.run(async (isCurrent) => {
      setBusy(true);
      setError(null);
      try {
        const photo = await camera.current?.takePictureAsync({ quality: 0.85 });
        if (!isCurrent()) return;
        if (!photo?.uri) throw new Error('No photo returned');
        setPreviewRole(stillPhotoRole(intent));
        setPreview(photo.uri);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } catch {
        if (isCurrent()) setError('Could not take the photo. Please try again.');
      } finally {
        if (isCurrent()) setBusy(false);
      }
    });
  };

  const usePhoto = () => {
    if (!previewUri || !previewRole) return;
    dispatchCapture({ type: 'photo', role: previewRole, uri: previewUri });
    setPreview(null);
    setPreviewRole(null);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const onBarcode = ({ data, type }: BarcodeScanningResult) => {
    if (!mounted.current || currentSession.current.phase !== 'collecting'
      || !canObserveLiveBarcode(latestIntent.current, { busy: operations.isBusy(), hasPreview: previewActive.current, locked: scanLocked.current }) || !isObservedRetailBarcode(data, type)) return;
    operations.whenIdle(() => {
      scanLocked.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (autoFinishBarcode && !currentSession.current.evidence.some((item) => item.kind === 'local_photo')) {
        mounted.current = false;
        onEvidenceReady(toCaptureHandoff(reduceCapture(currentSession.current, { type: 'barcode', value: data })));
        return;
      }
      dispatchCapture({ type: 'barcode', value: data });
    });
  };

  const retake = () => {
    requestSequence.current += 1;
    dispatchCapture({ type: 'retake', role });
    setPreview(null);
    scanLocked.current = false;
    setError(null);
    setCanRetry(false);
    void Haptics.selectionAsync().catch(() => {});
  };

  const processEvidence = async () => {
    if (!mounted.current || !currentSession.current.evidence.length || currentSession.current.phase === 'processing') return;
    await operations.run(async (isCurrent) => {
      const sequence = ++requestSequence.current;
      // Native barcode callbacks may precede the next React render.
      const evidence = currentSession.current.evidence;
      dispatchCapture({ type: 'process' });
      setError(null);
      setCanRetry(false);
      try {
        const result = await processor.process(evidence);
        if (!isCurrent() || sequence !== requestSequence.current) return;
        dispatchCapture({ type: 'resolved', result });
      } catch (cause) {
        if (!isCurrent() || sequence !== requestSequence.current) return;
        dispatchCapture({ type: 'resolved', result: { state: 'insufficient_evidence', candidates: [] } });
        const recovery = captureRecovery(cause);
        setCanRetry(recovery.canRetry);
        setCanCollectMore(recovery.canCollectMore);
        setError(recovery.message);
      }
    });
  };

  const collectMore = () => {
    requestSequence.current += 1;
    dispatchCapture({ type: 'collect_more' });
    selectRole(captureRoles.find((candidate) => !currentSession.current.evidence.some((item) => item.role === candidate)) ?? 'front_label');
  };

  const finish = () => {
    if (!mounted.current) return;
    mounted.current = false;
    onEvidenceReady(toCaptureHandoff(currentSession.current));
  };

  return (
    <View style={styles.root}>
      {permission?.granted && session.phase === 'collecting' && !currentEvidence && !previewUri ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['upc_a', 'ean13', 'ean8'] }}
          onBarcodeScanned={intent === 'auto' || intent === 'barcode' ? onBarcode : undefined}
        />
      ) : previewUri ? (
        <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : currentEvidence?.kind === 'local_photo' && session.phase === 'collecting' ? (
        <Image source={{ uri: currentEvidence.value }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}
      <View style={[styles.top, { paddingTop: Math.max(insets.top, spacing.md) }]}>
        <CameraGlass style={styles.topControl}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close product capture" onPress={close} style={styles.iconButton}>
            <Icon name="close" size={20} color={colors.inkInverse} />
          </Pressable>
        </CameraGlass>
        <CameraGlass style={styles.topControl}>
          <Pressable accessibilityRole="button" accessibilityLabel={torch ? 'Turn flashlight off' : 'Turn flashlight on'} accessibilityState={{ selected: torch, disabled: busy || !permission?.granted || session.phase !== 'collecting' || previewUri !== null }} disabled={busy || !permission?.granted || session.phase !== 'collecting' || previewUri !== null} onPress={() => operations.whenIdle(() => setTorch((value) => !value))} style={styles.iconButton}>
            <Icon name="flashlight" size={20} color={torch ? colors.brandLight : colors.inkInverse} />
          </Pressable>
        </CameraGlass>
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
            {(intent === 'auto' || intent === 'barcode') && !currentEvidence && !previewUri ? (
              // Alignment aid only: Expo still detects barcodes across the whole preview.
              <View testID="barcode-alignment-guide" style={styles.barcodeGuide}>
                <View style={[styles.guideCorner, styles.guideTopLeft]} />
                <View style={[styles.guideCorner, styles.guideTopRight]} />
                <View style={[styles.guideCorner, styles.guideBottomLeft]} />
                <View style={[styles.guideCorner, styles.guideBottomRight]} />
              </View>
            ) : null}
          </View>
          {(showCorrection || previewUri) && <CameraGlass style={styles.modeMenu}>
            <ScrollView style={styles.controlScroll} contentContainerStyle={styles.controlContent}>
              {previewUri && <Text style={styles.modeTitle}>Which part is in this photo?</Text>}
              <View style={styles.roleRow}>
                {showCorrection && !previewUri && <Pressable accessibilityRole="button" accessibilityLabel="Auto" accessibilityState={{ selected: intent === 'auto' }} onPress={() => operations.whenIdle(() => { setIntent('auto'); latestIntent.current = 'auto'; animateOptions(); setShowCorrection(false); scanLocked.current = currentSession.current.evidence.some((item) => item.kind === 'barcode'); })} style={[styles.roleChip, intent === 'auto' && styles.roleChipActive]}>
                  <Text style={[styles.roleText, intent === 'auto' && styles.roleTextActive]}>Auto</Text>
                  {intent === 'auto' && <Icon name="check" size={18} color={colors.brandDark} />}
                </Pressable>}
                {captureRoles.map((item) => {
                  if (previewUri && item === 'barcode') return null;
                  const saved = session.evidence.some((entry) => entry.role === item);
                  const selected = previewUri ? previewRole === item : intent === item;
                  return (
                    <Pressable key={item} accessibilityRole="button" accessibilityLabel={`${roleLabels[item]}${saved ? ', captured' : ''}`} accessibilityState={{ selected: previewUri ? previewRole === item : intent === item, disabled: busy }} disabled={busy} onPress={() => { if (previewUri && item !== 'barcode') operations.whenIdle(() => setPreviewRole(item)); else selectRole(item); }} style={[styles.roleChip, selected && styles.roleChipActive]}>
                      <Text style={[styles.roleText, selected && styles.roleTextActive]}>{roleLabels[item]}</Text>
                      {selected && <Icon name="check" size={18} color={colors.brandDark} />}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </CameraGlass>}
          <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            {!previewUri && currentEvidence && <CameraGlass style={styles.guidancePill}><Text style={styles.prompt}>{roleLabels[role]} saved</Text></CameraGlass>}
            {!previewUri && !currentEvidence && intent !== 'auto' && <CameraGlass style={styles.guidancePill}><Text style={styles.prompt}>{prompts[role]}</Text></CameraGlass>}
            {previewUri && <CameraGlass style={styles.guidancePill}><Text style={styles.hint}>Photos do not verify the formula.</Text></CameraGlass>}
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.captureActions}>
                {previewUri ? (
                  <View style={styles.actionRow}><Action label="Retake" secondary onPress={() => { setPreview(null); setPreviewRole(null); }} />{previewRole && <Action label="Use photo" onPress={usePhoto} />}</View>
                ) : currentEvidence ? (
                  <View style={styles.actionRow}><Action label="Retake" secondary onPress={retake} /><Action label="Review evidence" onPress={() => void processEvidence()} /></View>
                ) : intent === 'barcode' ? (
                  <View style={styles.actionRow}>{session.evidence.length > 0 && <Action label="Review evidence" onPress={() => void processEvidence()} />}</View>
                ) : (
                  <View style={styles.actionRow}>
                    <Pressable accessibilityRole="button" accessibilityLabel={intent === 'auto' ? 'Take package photo' : `Take ${roleLabels[role]} photo`} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => void capturePhoto()} style={[styles.shutter, busy && styles.shutterBusy]}>
                      {busy ? <ActivityIndicator color={colors.inkInverse} /> : <View style={styles.shutterInner} />}
                    </Pressable>
                    {session.evidence.length > 0 && <Action label="Review evidence" onPress={() => void processEvidence()} />}
                  </View>
                )}
            </View>
            {!previewUri && !currentEvidence && <View style={[styles.selectorSlot, { bottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
              <CameraGlass style={styles.selectorPill}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Capture options, ${intent === 'auto' ? 'Auto' : roleLabels[role]}`} accessibilityState={{ expanded: showCorrection, disabled: busy }} disabled={busy} onPress={() => operations.whenIdle(() => { animateOptions(); setShowCorrection((value) => !value); })} style={styles.selectorButton}>
                  <Text style={styles.selectorText} numberOfLines={1}>{intent === 'auto' ? 'Auto' : roleLabels[role]}</Text>
                  <Icon name={showCorrection ? 'up' : 'down'} size={14} color={colors.inkInverse} />
                </Pressable>
              </CameraGlass>
            </View>}
          </View>
        </View>
      ) : (
        <View style={[styles.outcomeWrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <ScrollView contentContainerStyle={styles.outcomeScroll}>
            <Text style={styles.outcomeTitle}>{session.phase === 'processing' ? 'Reviewing evidence' : session.phase === 'candidates' ? 'Possible product' : session.phase === 'ambiguous' ? 'Several possible products' : session.phase === 'candidate_selected' ? 'Candidate noted' : session.phase === 'unknown' ? 'Product unknown' : 'More evidence needed'}</Text>
            <Text style={styles.outcomeBody}>{session.phase === 'processing' ? 'Checking the details you captured.' : session.phase === 'candidate_selected' ? 'Your selection is recorded as a possible match. It does not add verification.' : session.phase === 'unknown' ? 'We could not identify this product from the available evidence.' : session.phase === 'insufficient_evidence' ? 'We could not confirm this product. Try its barcode or search by name. Automatic photo identification is not available yet.' : 'Choose a possible match if you recognize it. Your choice does not verify the product or formula.'}</Text>
            {session.phase === 'processing' && <ActivityIndicator color={colors.brand} size="large" />}
            {(session.phase === 'candidates' || session.phase === 'ambiguous') && session.candidates.map((candidate) => (
              <Pressable key={candidate.id} accessibilityRole="button" onPress={() => { dispatchCapture({ type: 'confirm_candidate', candidateId: candidate.id }); void Haptics.selectionAsync().catch(() => {}); }} style={styles.candidate}>
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

function CameraGlass({ children, style }: { children: React.ReactNode; style: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.cameraGlass, style]}>
      <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cameraGlassTint]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  cameraGlass: { overflow: 'hidden', borderWidth: 0 },
  cameraGlassTint: { backgroundColor: 'rgba(30,54,44,0.72)' },
  top: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  topControl: { width: layout.minTouchTarget + spacing.xs, height: layout.minTouchTarget + spacing.xs, borderRadius: radii.full },
  iconButton: { minWidth: layout.minTouchTarget, minHeight: layout.minTouchTarget, width: layout.minTouchTarget + spacing.xs, height: layout.minTouchTarget + spacing.xs, alignItems: 'center', justifyContent: 'center' },
  collecting: { flex: 1 },
  modeMenu: { position: 'absolute', right: spacing.md, bottom: 126, zIndex: 2, width: 210, maxHeight: 260, padding: spacing.xs, borderRadius: radii.lg },
  modeTitle: { color: colors.inkInverse, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold, textAlign: 'center' },
  guideArea: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  barcodeGuide: { width: '88%', maxWidth: 320, height: '68%', maxHeight: 320, minHeight: 120 },
  guideCorner: { position: 'absolute', width: 38, height: 38, borderColor: colors.inkInverse },
  guideTopLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: radii.xs },
  guideTopRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: radii.xs },
  guideBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: radii.xs },
  guideBottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: radii.xs },
  bottom: { flexShrink: 1, position: 'relative', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  guidancePill: { maxWidth: '100%', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full },
  selectorSlot: { position: 'absolute', right: spacing.xs, width: 112 },
  selectorPill: { width: 112, height: 52, borderRadius: radii.full },
  selectorButton: { minHeight: layout.minTouchTarget, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxs, paddingHorizontal: spacing.xs },
  selectorText: { color: colors.inkInverse, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold, flexShrink: 1 },
  controlScroll: { flexGrow: 0, flexShrink: 1 },
  controlContent: { paddingBottom: spacing.xs },
  captureActions: { flexShrink: 0 },
  prompt: { color: colors.inkInverse, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.medium, lineHeight: typography.lineHeights.bodyRegular, textAlign: 'center' },
  hint: { color: colors.brandLight, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption, marginTop: spacing.xs, textAlign: 'center' },
  roleRow: { flexDirection: 'column', gap: spacing.xxs },
  roleChip: { minHeight: layout.minTouchTarget, borderRadius: radii.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  roleChipActive: { backgroundColor: colors.brandLight, borderColor: colors.brand },
  roleText: { color: colors.inkInverse, textAlign: 'center', fontSize: typography.sizes.caption, fontWeight: typography.weights.medium },
  roleTextActive: { color: colors.brandDark },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  action: { minHeight: layout.ctaHeight, minWidth: 116, maxWidth: '100%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  secondaryAction: { backgroundColor: 'rgba(30,54,44,0.72)', borderWidth: 1, borderColor: colors.inkInverse },
  actionText: { color: colors.inkInverse, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold, textAlign: 'center' },
  secondaryText: { color: colors.inkInverse },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: colors.inkInverse, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.brand },
  shutterBusy: { opacity: 0.6 },
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
