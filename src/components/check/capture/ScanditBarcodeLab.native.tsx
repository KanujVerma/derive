import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { publicEnvironment } from '../../../config/environment';
import type { DataCaptureContext, Camera } from 'scandit-react-native-datacapture-core';
import type { BarcodeCapture, BarcodeCaptureListener } from 'scandit-react-native-datacapture-barcode';

type ScanResources = {
  context: DataCaptureContext;
  camera: Camera;
  capture: BarcodeCapture;
  listener: BarcodeCaptureListener;
};
type CaptureView = React.ComponentType<{ context: DataCaptureContext; style: StyleProp<ViewStyle> }>;

async function stopResources(active: ScanResources) {
  active.capture.isEnabled = false;
  active.capture.removeListener(active.listener);
  try {
    const { FrameSourceState } = await import('scandit-react-native-datacapture-core');
    await active.camera.switchToDesiredState(FrameSourceState.Off);
    await active.context.removeMode(active.capture);
    await active.context.setFrameSource(null);
    await active.context.dispose();
  } catch {
    // The native view may already be gone when a development route closes.
  }
}

// Deliberately isolated from the customer Check camera. This trial comparison
// decodes retail barcodes only; it never resolves or verifies product identity.
export default function ScanditBarcodeLab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<{ value: string; type: string } | null>(null);
  const [view, setView] = useState<{ component: CaptureView; context: DataCaptureContext } | null>(null);
  const resources = useRef<ScanResources | null>(null);
  const mounted = useRef(true);
  const license = process.env.EXPO_PUBLIC_SCANDIT_LICENSE_KEY?.trim();
  const available = __DEV__ && publicEnvironment.buildFlavor === 'development';
  const expoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const NativeCaptureView = view?.component;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const active = resources.current;
      resources.current = null;
      if (active) void stopResources(active);
    };
  }, []);

  const start = async () => {
    if (!available || expoGo || !license || !permission?.granted || starting || resources.current) return;
    setStarting(true);
    setError(null);
    try {
      // Loading only after the development-build guard keeps Expo Go usable.
      const core = await import('scandit-react-native-datacapture-core');
      const barcode = await import('scandit-react-native-datacapture-barcode');
      if (!mounted.current) return;
      const context = core.DataCaptureContext.forLicenseKey(license);
      const settings = new barcode.BarcodeCaptureSettings();
      settings.enableSymbologies([barcode.Symbology.EAN13UPCA, barcode.Symbology.EAN8, barcode.Symbology.UPCE]);
      settings.codeDuplicateFilter = 500;
      const capture = new barcode.BarcodeCapture(settings);
      const listener: BarcodeCaptureListener = {
        didScan: async (mode, session) => {
          const observation = session.newlyRecognizedBarcode;
          if (!observation?.data || !mounted.current) return;
          mode.isEnabled = false;
          setDecoded({ value: observation.data, type: observation.symbology });
        },
      };
      capture.addListener(listener);
      const camera = core.Camera.withSettings(barcode.BarcodeCapture.createRecommendedCameraSettings());
      if (!camera) throw new Error('No device camera available.');
      resources.current = { context, camera, capture, listener };
      await context.addMode(capture);
      if (!mounted.current) throw new Error('Capture closed.');
      await context.setFrameSource(camera);
      if (!mounted.current) throw new Error('Capture closed.');
      setView({ component: core.DataCaptureView, context });
      await camera.switchToDesiredState(core.FrameSourceState.On);
    } catch (cause) {
      const active = resources.current;
      resources.current = null;
      if (active) await stopResources(active);
      if (mounted.current) {
        setView(null);
        setError(cause instanceof Error ? cause.message : 'Scandit could not start.');
      }
    } finally {
      if (mounted.current) setStarting(false);
    }
  };

  const scanAgain = () => {
    setDecoded(null);
    if (resources.current) resources.current.capture.isEnabled = true;
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.back}><Text style={styles.backText}>← Back</Text></Pressable>
      <Text style={styles.title}>Scandit barcode lab</Text>
      <Text style={styles.note}>Development comparison only. A decoded barcode is not a verified product or formula.</Text>
      {!available ? <Text>Unavailable outside a development build.</Text>
        : expoGo ? <Text>Expo Go cannot load Scandit. Install a custom development build on this phone.</Text>
        : !license ? <Text>Add EXPO_PUBLIC_SCANDIT_LICENSE_KEY to this worktree’s ignored .env.local, then rebuild the development app.</Text>
        : !permission?.granted ? <Pressable onPress={() => void requestPermission()} style={styles.action}><Text style={styles.actionText}>Allow camera</Text></Pressable>
        : null}
      {available && !expoGo && license && permission?.granted && !view && !starting ? (
        <Pressable onPress={() => void start()} style={styles.action}><Text style={styles.actionText}>Start Scandit scanner</Text></Pressable>
      ) : null}
      {starting ? <ActivityIndicator style={styles.loading} /> : null}
      {view && NativeCaptureView ? <View style={styles.preview}><NativeCaptureView context={view.context} style={StyleSheet.absoluteFill} /><View pointerEvents="none" style={styles.guide} /></View> : null}
      {decoded ? <View style={styles.result}><Text style={styles.label}>Decoded {decoded.type}</Text><Text selectable style={styles.code}>{decoded.value}</Text><Pressable onPress={scanAgain} style={styles.action}><Text style={styles.actionText}>Scan another</Text></Pressable></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, backgroundColor: '#f6f3ec' },
  back: { paddingVertical: 8, alignSelf: 'flex-start' },
  backText: { color: '#285747', fontSize: 16 },
  title: { fontSize: 25, fontWeight: '700', marginTop: 12, color: '#18241f' },
  note: { fontSize: 14, lineHeight: 21, marginVertical: 12, color: '#52645a' },
  action: { backgroundColor: '#285747', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  actionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loading: { margin: 20 },
  preview: { flex: 1, minHeight: 250, overflow: 'hidden', borderRadius: 16, backgroundColor: '#222', marginTop: 16 },
  guide: { position: 'absolute', top: '38%', left: '12%', width: '76%', height: '24%', borderWidth: 2, borderColor: '#fff', borderRadius: 12 },
  result: { paddingVertical: 16 },
  label: { color: '#52645a' },
  code: { fontSize: 22, fontWeight: '700', color: '#18241f' },
  error: { color: '#a02424', paddingVertical: 12 },
});
