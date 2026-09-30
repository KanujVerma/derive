import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { publicEnvironment } from '../src/config/environment';
import { useAuthStore } from '../src/stores/authStore';
import { supabase } from '../src/services/supabase';
import type { PrivateUpcLookup } from '../src/contracts/PrivateUpcLookup';
import { requestPrivateUpcLookup } from '../src/presentation/external-products/privateLookup';
import { normalizeBarcode } from '../src/utils/barcode';

/** Separate private evaluation route; does not compete with the active Check writer. */
export default function PrivateUpcTest() {
  const insets = useSafeAreaInsets();
  const ownerId = useAuthStore(state => state.sessionUserId);
  const [permission, requestPermission] = useCameraPermissions();
  const [barcode, setBarcode] = useState('');
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ ownerId: string; barcode: string; data: PrivateUpcLookup } | null>(null);
  const sequence = useRef(0);
  const locked = useRef(false);
  const enabled = __DEV__ && publicEnvironment.buildFlavor === 'development';
  useEffect(() => {
    sequence.current++; locked.current = false; setCamera(false); setBusy(false);
    setBarcode(''); setResult(null); setMessage('');
    return () => { sequence.current++; };
  }, [ownerId]);

  async function lookup(value: string) {
    if (!enabled || !supabase || !ownerId || locked.current) return;
    locked.current = true;
    const current = ++sequence.current;
    setCamera(false); setBusy(true); setMessage(''); setResult(null); setBarcode(value);
    try {
      const response = await requestPrivateUpcLookup(value, ownerId,
        () => useAuthStore.getState().sessionUserId, supabase);
      if (current !== sequence.current) return;
      setResult({ ownerId, barcode: value, data: response });
      if (response.status === 'rate_limited') setMessage('Testing allowance reached. Wait before trying again; the daily allowance may also be exhausted.');
      else if (response.status === 'not_found' || response.status === 'incomplete') setMessage('No usable product record. Try a different barcode.');
      else if (response.status !== 'found' && response.status !== 'ambiguous') setMessage('Product lookup is temporarily unavailable.');
    } catch (error) {
      if (current === sequence.current) setMessage(error instanceof Error && error.message === 'INVALID_BARCODE'
        ? 'Enter all digits of the printed barcode.' : error instanceof Error && error.message === 'PRIVATE_TESTER_REQUIRED'
          ? 'This account is not enabled for private testing.' : 'Sign in to an enabled test account, then try again.');
    } finally {
      if (current === sequence.current) { locked.current = false; setBusy(false); }
    }
  }
  const visible = result?.ownerId === ownerId ? result : null;
  if (!enabled) return <View style={{ padding: 32, paddingTop: insets.top + 32 }}><Text>Private test unavailable in this build.</Text></View>;
  return <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 18 }} keyboardShouldPersistTaps="handled">
    <Stack.Screen options={{ title: 'Private barcode test', headerShown: false }} />
    <Text style={{ fontSize: 26, fontWeight: '600' }}>Private barcode test</Text>
    <Text>Real UPCitemdb lookup. Possible identity only—not verified ingredients or a personal rating. Nothing is saved to your shelf or our catalog.</Text>
    {!ownerId && <Text>Sign in to an enabled test account first.</Text>}
    <TextInput accessibilityLabel="Product barcode" value={barcode} onChangeText={setBarcode}
      keyboardType="number-pad" placeholder="Printed UPC/EAN" editable={!busy}
      style={{ borderWidth: 1, borderColor: '#777', borderRadius: 12, padding: 16 }} />
    <Pressable accessibilityRole="button" disabled={busy || !ownerId || !supabase}
      onPress={() => void lookup(barcode.trim())} style={{ padding: 16, backgroundColor: '#e2e9e3', borderRadius: 12 }}>
      <Text>Look up barcode</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={busy || !ownerId || !supabase}
      onPress={async () => {
        const allowed = permission?.granted || (await requestPermission()).granted;
        if (allowed) setCamera(true); else setMessage('Camera permission denied. You can type the barcode instead.');
      }} style={{ padding: 16, borderWidth: 1, borderRadius: 12 }}>
      <Text>Scan barcode</Text>
    </Pressable>
    {camera && <>
      <CameraView style={{ height: 300, borderRadius: 12 }} facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a'] }}
        onBarcodeScanned={event => {
          const normalized = normalizeBarcode(event.data);
          if (normalized) void lookup(normalized);
        }} />
      <Pressable accessibilityRole="button" onPress={() => setCamera(false)}><Text>Close camera</Text></Pressable>
    </>}
    {busy && <ActivityIndicator accessibilityLabel="Looking up product" />}
    {!!message && <Text accessibilityRole="alert">{message}</Text>}
    {visible?.data.candidates.map((candidate, index) => <View key={candidate.sourceRecordId + ':' + index} style={{ padding: 18, borderWidth: 1, borderRadius: 12, gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>Possible match: {candidate.name}</Text>
      <Text>{candidate.brand ?? 'Brand not supplied'} · {candidate.size ?? 'Size not supplied'}</Text>
      <Text>Barcode: {visible.barcode}</Text>
      <Text>Source: UPCitemdb · Retrieved {candidate.retrievedAt}</Text>
      <Text>Compare the variant and size with your package. Ingredients and category are not verified.</Text>
    </View>)}
  </ScrollView>;
}
