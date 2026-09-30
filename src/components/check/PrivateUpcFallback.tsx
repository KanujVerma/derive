import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/src/constants/theme';
import { Button } from '@/src/components/ui/Button';
import { PrivateIngredientSearch } from '@/src/components/check/PrivateIngredientSearch';
import { publicEnvironment } from '@/src/config/environment';
import { supabase } from '@/src/services/supabase';
import { useAuthStore } from '@/src/stores/authStore';
import { requestPrivateUpcLookup, validPrivateBarcode } from '@/src/presentation/external-products/privateLookup';
import { createPrivateCheckFallback, createPrivateCheckRequestMemo, privateCheckEnabled, visiblePrivateCheckState,
  type PrivateCheckState } from '@/src/presentation/external-products/checkFallback';

/** Private identity evidence after a canonical barcode miss; never a formula or personal decision. */
export function PrivateUpcFallback({ barcode, ownerId: checkOwnerId }: { barcode: string; ownerId: string | null }) {
  const sessionOwnerId = useAuthStore(state => state.sessionUserId);
  const ownerId = checkOwnerId === sessionOwnerId ? checkOwnerId : null;
  const liveOwner = useRef(ownerId);
  liveOwner.current = ownerId;
  const enabled = privateCheckEnabled(__DEV__, publicEnvironment.buildFlavor,
    process.env.EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED);
  const [state, setState] = useState<PrivateCheckState | null>(null);
  const controller = useRef<ReturnType<typeof createPrivateCheckFallback> | null>(null);
  const requestMemo = useRef(createPrivateCheckRequestMemo());

  useEffect(() => {
    setState(null);
    if (!enabled || !ownerId || !supabase) return;
    const client = supabase;
    const current = createPrivateCheckFallback({ ownerId, barcode,
      getOwner: () => liveOwner.current === useAuthStore.getState().sessionUserId ? liveOwner.current : null,
      request: manual => requestMemo.current(ownerId + ':' + barcode,
        () => requestPrivateUpcLookup(barcode, ownerId,
          () => liveOwner.current === useAuthStore.getState().sessionUserId ? liveOwner.current : null, client), manual),
      publish: setState,
    });
    controller.current = current;
    void current.start();
    return () => { current.dispose(); if (controller.current === current) controller.current = null; };
  }, [enabled, ownerId, barcode]);

  if (!enabled) return null;
  if (!supabase) return <Text style={styles.body}>External lookup needs the local Supabase test connection.</Text>;
  if (!validPrivateBarcode(barcode)) return <Text style={styles.body}>This barcode could not be validated. Try another scan or search by name.</Text>;
  const visible = visiblePrivateCheckState(state, ownerId, barcode);
  if (!ownerId) return <Text style={styles.body}>A signed-in test session is needed for external lookup.</Text>;
  const result = visible?.kind === 'result' ? visible.result : null;
  const limited = result?.status === 'rate_limited';
  const needsTester = visible?.kind === 'error' && visible.code === 'PRIVATE_TESTER_REQUIRED';
  const loading = !visible || visible.kind === 'loading';
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={styles.title}>External product lookup · private test</Text>
      {loading && <View style={styles.loading}><ActivityIndicator color={colors.brand} />
        <Text style={styles.body}>Looking for a possible barcode match…</Text></View>}
      {result && result.candidates.map((candidate, index) => (
        <View key={candidate.sourceRecordId + ':' + index} style={styles.candidate}>
          <Text style={styles.caption}>{result.status === 'ambiguous' ? 'Possible match — confirm the label' : 'Possible product match'}</Text>
          {candidate.brand && <Text style={styles.body}>{candidate.brand}</Text>}
          <Text style={styles.title}>{candidate.name}</Text>
          {candidate.size && <Text style={styles.body}>{candidate.size}</Text>}
          <Text style={styles.caption}>UPCitemdb · retrieved {new Date(candidate.retrievedAt).toLocaleDateString()}</Text>
          <Text style={styles.caption}>Barcode {candidate.sourceBarcode}</Text>
          <PrivateIngredientSearch ownerId={ownerId} query={{ barcode: candidate.observedBarcode,
            name: candidate.name, brand: candidate.brand, size: candidate.size }} />
        </View>
      ))}
      {result && result.candidates.length > 0 && <Text style={styles.body}>
        This identifies a possible product only. Ingredients, formula and personal fit are not verified. Nothing is saved to your products.
      </Text>}
      {result?.truncated && <Text style={styles.body}>More possible matches exist; this list is incomplete.</Text>}
      {limited && <Text style={styles.body}>The shared free lookup allowance is temporarily full. Wait at least 11 seconds before trying again; the daily allowance may also be exhausted.</Text>}
      {result && result.candidates.length === 0 && !limited && <Text style={styles.body}>
        {result.status === 'not_found' ? 'No external match found. Try searching by name below.'
          : result.status === 'incomplete' ? 'The external record was incomplete. Try searching by name below.'
          : 'External lookup is unavailable right now. You can still search by name below.'}
      </Text>}
      {visible?.kind === 'error' && <Text style={styles.body}>
        {needsTester ? 'This account is not on the private tester list.' : visible.code === 'SIGN_IN_REQUIRED'
          ? 'Your session needs to be refreshed before external lookup.' : 'External lookup is unavailable. Search by name or try again.'}
      </Text>}
      {needsTester && <Text selectable style={styles.caption}>Tester account ID: {ownerId}</Text>}
      {!loading && <Button label="Retry external lookup" variant="outline" size="medium"
        onPress={() => { void controller.current?.retry(); }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md, marginVertical: spacing.md },
  candidate: { gap: spacing.xs, paddingBottom: spacing.sm },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.ink, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  caption: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
});
