import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appleVisionLabelRecognizer, isNativeLabelOcrAvailable } from '../../../../modules/derive-label-ocr';
import { createDraftCacheLifecycle, isAppCacheFileUri, LOCAL_OCR_MESSAGES, localOcrAvailable,
  PART_ONE_DRAFT_CACHE_DIRECTORY } from '../../../services/partOneOcr';
import { createCatalogRequestId } from '../../../services/productCatalog';
import { captureBindingsEqual, draftReadiness } from '../../../presentation/part-one/capture';
import type { CaptureBinding, MemoryLabelDraft } from '../../../presentation/part-one/capture';

const draftCache = Platform.OS === 'ios' ? createDraftCacheLifecycle({
  cacheRoot: Paths.cache.uri, draftRoot: new Directory(Paths.cache, PART_ONE_DRAFT_CACHE_DIRECTORY).uri,
  removeDraftDirectory: () => { const directory = new Directory(Paths.cache, PART_ONE_DRAFT_CACHE_DIRECTORY); if (directory.exists) directory.delete(); },
  createDraftDirectory: () => new Directory(Paths.cache, PART_ONE_DRAFT_CACHE_DIRECTORY).create({ idempotent: true, intermediates: true }),
  moveFile: (source, destination) => new File(source).move(new File(destination)),
}) : null;
/** Call on application startup. Also runs before this module can expose capture actions. */
export function initializePartOneDraftCache() { return draftCache?.initialize() ?? false; }
const captureCacheInitialized = initializePartOneDraftCache();
export const PART_ONE_LOCAL_CAPTURE_AVAILABLE = captureCacheInitialized && __DEV__ && localOcrAvailable({
  evaluationEnabled: process.env.EXPO_PUBLIC_PART_ONE_OCR_EVALUATION === 'true',
  platform: Platform.OS, nativeAvailable: isNativeLabelOcrAvailable,
});

/** Only app-owned picker/camera cache copies may be removed. Library originals are never touched. */
export async function purgeLocalCaptureFile(uri: string) {
  if (!uri.startsWith('file://')) return;
  const file = new File(uri);
  if (!isAppCacheFileUri(file.uri, Paths.cache.uri)) return;
  if (file.exists) file.delete();
}

type Props = { draft: MemoryLabelDraft; binding: CaptureBinding; onClose: () => void; onChange: () => void;
  productLabel?: string };
export function PartOneLabelCapture({ draft, binding, onClose, onChange, productLabel = 'Selected product' }: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>(LOCAL_OCR_MESSAGES.unsaved);
  const [, refresh] = useState(0);
  const camera = useRef<CameraView>(null);
  const mounted = useRef(true);
  const currentBinding = useRef(binding); currentBinding.current = binding;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setBusy(false); setCameraActive(false); setMessage(LOCAL_OCR_MESSAGES.unsaved); },
    [binding.ownerId, binding.sheetSessionId, binding.scanId, binding.generation, binding.captureSessionId, binding.itemId, binding.candidateId, binding.deletionEpoch]);
  const current = draft.read(binding);
  const readiness = current ? draftReadiness(current, false) : null;
  const capReached = (current?.shots.length ?? 0) >= 6;
  const stillBound = (expected: CaptureBinding) => mounted.current &&
    captureBindingsEqual(expected, currentBinding.current);
  const update = () => { if (mounted.current) { refresh(value => value + 1); onChange(); } };
  const close = () => { draft.back(binding); setCameraActive(false); onClose(); };
  const addAndRead = async (uri: string, expected: CaptureBinding) => {
    // Bind before opening picker/camera; an account/product change during acquisition must
    // never assign the old package image to the new selection.
    let localUri = uri;
    try {
      const evidenceId = createCatalogRequestId();
      if (!draftCache) throw new Error('local_capture_cache_unavailable');
      localUri = draftCache.stage(uri, evidenceId);
      if (!stillBound(expected)) { draft.discardPhoto(localUri); return; }
      const ticket = draft.addPhoto(expected, evidenceId, localUri);
      if (ticket === 'cap_reached') { draft.discardPhoto(localUri); setMessage(LOCAL_OCR_MESSAGES.cap_reached); return; }
      update();
      const applied = await draft.recognize(ticket, appleVisionLabelRecognizer, () => currentBinding.current);
      if (!stillBound(expected)) return;
      if (applied === 'busy') setMessage('A photo is already being read locally. Add the next photo after it finishes.');
      else if (applied === 'applied') {
        const status = draft.read(currentBinding.current)?.shots.find(shot => shot.evidenceId === ticket.evidenceId)?.observation?.status;
        setMessage(status && status !== 'recognized' && status !== 'cancelled' ? LOCAL_OCR_MESSAGES[status] :
          'Readable text is a temporary preview. Check the whole panel and add overlapping views of missing sections.');
      }
      update();
    } catch {
      if (!draft.read(currentBinding.current)?.shots.some(shot => shot.uri === localUri)) draft.discardPhoto(localUri);
      if (stillBound(expected)) setMessage(LOCAL_OCR_MESSAGES.failed);
    }
  };
  const pick = async () => {
    if (busy || capReached) return;
    const expected = { ...currentBinding.current };
    setBusy(true); setCameraActive(false);
    try {
      // System selected-photo picker: no full-library or location permission request.
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false,
        quality: 1, exif: false, allowsMultipleSelection: false });
      if (result.canceled) { if (stillBound(expected)) setMessage(LOCAL_OCR_MESSAGES.picker_cancelled); }
      else if (result.assets[0]) await addAndRead(result.assets[0].uri, expected);
    } catch { if (stillBound(expected)) setMessage(LOCAL_OCR_MESSAGES.failed); }
    finally { if (stillBound(expected)) setBusy(false); }
  };
  const openCamera = async () => {
    if (busy || capReached) return;
    const expected = { ...currentBinding.current };
    try {
      const allowed = permission?.granted || (await requestPermission()).granted;
      if (!stillBound(expected)) return;
      if (allowed) setCameraActive(true); else setMessage(LOCAL_OCR_MESSAGES.camera_denied);
    } catch { if (stillBound(expected)) setMessage(LOCAL_OCR_MESSAGES.failed); }
  };
  const takePhoto = async () => {
    if (busy || capReached || !camera.current) return;
    const expected = { ...currentBinding.current };
    setBusy(true);
    try {
      const image = await camera.current.takePictureAsync({ quality: 1, exif: false });
      if (stillBound(expected)) setCameraActive(false); if (image?.uri) await addAndRead(image.uri, expected);
    } catch { if (stillBound(expected)) setMessage(LOCAL_OCR_MESSAGES.failed); }
    finally { if (stillBound(expected)) setBusy(false); }
  };
  const remove = () => { draft.remove(); onChange(); onClose(); };
  const retryPhoto = async (evidenceId: string) => {
    if (busy) return;
    const expected = { ...currentBinding.current }, existing = draft.read(expected);
    if (!existing) return;
    setBusy(true);
    try {
      const outcome = await draft.recognize({ binding: expected, captureEpoch: existing.captureEpoch, evidenceId },
        appleVisionLabelRecognizer, () => currentBinding.current);
      if (stillBound(expected)) {
        const status = draft.read(expected)?.shots.find(shot => shot.evidenceId === evidenceId)?.observation?.status;
        setMessage(outcome === 'busy' ? 'A photo is already being read locally. Try again after it finishes.' :
          status && status !== 'recognized' && status !== 'cancelled' ? LOCAL_OCR_MESSAGES[status] : LOCAL_OCR_MESSAGES.unsaved);
        update();
      }
    } catch { if (stillBound(expected)) setMessage(LOCAL_OCR_MESSAGES.failed); }
    finally { if (stillBound(expected)) setBusy(false); }
  };
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}
    supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}>
    <View onAccessibilityEscape={close} style={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel="Back to product result" onPress={close} style={styles.action}>
          <Text style={styles.actionText}>Back to product</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Scan ingredients</Text>
        <Text style={styles.product}>{productLabel}</Text>
        <Text style={styles.body}>Start with the full ingredient panel. Keep the first and last lines visible. For glare or curved labels, add a view with some overlap.</Text>
        <Text accessibilityLiveRegion="polite" style={styles.status}>{message}</Text>
        {!PART_ONE_LOCAL_CAPTURE_AVAILABLE && <Text style={styles.status}>Local photo evaluation is disabled on this build.</Text>}
        {busy && <View style={styles.progress}><ActivityIndicator accessibilityLabel="Reading photo locally" /><Text style={styles.body}>Reading on this device…</Text></View>}
        {cameraActive && permission?.granted && <View style={styles.cameraBox}>
          <CameraView ref={camera} facing="back" style={StyleSheet.absoluteFill} active={!busy} />
        </View>}
        {cameraActive ? <Pressable accessibilityRole="button" accessibilityLabel="Capture ingredient panel" disabled={busy || capReached}
          onPress={() => void takePhoto()} style={styles.action}><Text style={styles.actionText}>Capture ingredient panel</Text></Pressable> :
          <Pressable accessibilityRole="button" accessibilityLabel="Use camera for ingredient panel" disabled={busy || capReached || !PART_ONE_LOCAL_CAPTURE_AVAILABLE}
            onPress={() => void openCamera()} style={styles.action}><Text style={styles.actionText}>Use camera</Text></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel={current?.shots.length ? 'Add overlapping ingredient photo from selected photos' : 'Choose ingredient photo'}
          disabled={busy || capReached || !PART_ONE_LOCAL_CAPTURE_AVAILABLE} onPress={() => void pick()} style={styles.action}>
          <Text style={styles.actionText}>{current?.shots.length ? 'Add photo' : 'Choose photo'}</Text>
        </Pressable>
        {capReached && <Text style={styles.status}>{LOCAL_OCR_MESSAGES.cap_reached}</Text>}
        {current?.shots.map((shot, index) => <View key={shot.evidenceId} style={styles.preview}>
          <Text accessibilityRole="header" style={styles.product}>Photo {index + 1} · local preview</Text>
          {shot.observation?.lines.map((line, lineIndex) => <Text key={lineIndex} selectable style={styles.body}>{line.text}</Text>)}
          {!shot.observation && <Text style={styles.body}>Text has not been recognized.</Text>}
          {shot.observation?.status !== 'recognized' && <Pressable accessibilityRole="button" accessibilityLabel={`Retry local text recognition for photo ${index + 1}`}
            disabled={busy || !PART_ONE_LOCAL_CAPTURE_AVAILABLE} onPress={() => void retryPhoto(shot.evidenceId)} style={styles.action}>
            <Text style={styles.actionText}>Read photo {index + 1} again</Text>
          </Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} onPress={() => { draft.removePhoto(binding, shot.evidenceId); update(); }} style={styles.action}>
            <Text style={styles.actionText}>Remove photo {index + 1}</Text>
          </Pressable>
        </View>)}
        {readiness?.state === 'partial' && <Text style={styles.body}>This draft remains partial. Confirmation cannot fill hidden text or missing sections.</Text>}
        <Text style={styles.body}>{LOCAL_OCR_MESSAGES.unsaved} It expires after 30 minutes without activity and is removed when this sheet session ends.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Remove temporary ingredient draft" onPress={remove} style={styles.action}><Text style={styles.actionText}>Remove draft</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel ingredient capture and return to product" onPress={close} style={styles.action}><Text style={styles.actionText}>Cancel</Text></Pressable>
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F3EC' }, content: { paddingHorizontal: 20, gap: 14, paddingBottom: 20 },
  title: { fontSize: 26, fontWeight: '600', color: '#252B27' }, product: { fontSize: 19, fontWeight: '600', color: '#252B27' },
  body: { fontSize: 17, lineHeight: 25, color: '#353B36' }, status: { fontSize: 17, lineHeight: 25, color: '#353B36' },
  action: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#6A746A', borderRadius: 14 },
  actionText: { fontSize: 17, color: '#252B27' }, cameraBox: { height: 300, overflow: 'hidden', borderRadius: 14 },
  progress: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, preview: { gap: 8, paddingVertical: 10 },
});
