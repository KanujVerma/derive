import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/src/constants/theme';
import { Button } from '@/src/components/ui/Button';
import { PublishedProductIngredients } from '@/src/components/check/PublishedProductIngredients';
import { ExternalProductActions } from '@/src/components/check/ExternalProductActions';
import { ResultSheetSurface } from '@/src/components/check/result-sheet/ResultSheetSurface';
import { CheckResultView } from '@/src/components/check/result-sheet/CheckResultContent';
import { publicEnvironment } from '@/src/config/environment';
import { supabase } from '@/src/services/supabase';
import { useAuthStore } from '@/src/stores/authStore';
import { requestPrivateUpcLookup, validPrivateBarcode } from '@/src/presentation/external-products/privateLookup';
import { createPrivateCheckFallback, createPrivateCheckRequestMemo, privateCheckEnabled, visiblePrivateCheckState,
  type PrivateCheckState } from '@/src/presentation/external-products/checkFallback';
import { sourceLimitedProductKey, type SourceLimitedAnalysis } from '@/src/presentation/personal-decision/sourceLimitedAnalysis';
import { customerController } from '@/src/presentation/personal-decision/customerGateway';

/** Private identity evidence and source limited local findings, never a canonical formula or packet. */
export function PrivateUpcFallback({ barcode, ownerId: checkOwnerId, sheet, children }: {
  barcode: string; ownerId: string | null;
  sheet?: { presentationKey: string; onClose: () => void };
  children?: React.ReactNode;
}) {
  const sessionOwnerId = useAuthStore(state => state.sessionUserId);
  const ownerId = checkOwnerId === sessionOwnerId ? checkOwnerId : null;
  const liveOwner = useRef(ownerId);
  liveOwner.current = ownerId;
  const enabled = privateCheckEnabled(__DEV__, publicEnvironment.buildFlavor,
    process.env.EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED);
  const [state, setState] = useState<PrivateCheckState | null>(null);
  const controller = useRef<ReturnType<typeof createPrivateCheckFallback> | null>(null);
  const requestMemo = useRef(createPrivateCheckRequestMemo());
  const [analysis, setAnalysis] = useState<SourceLimitedAnalysis | null>(null);
  const personalState = useSyncExternalStore(customerController.subscribe, customerController.getState);
  const liveProductKey = useRef<string | null>(null);
  const onAnalysis = useCallback((value: SourceLimitedAnalysis | null) => {
    if (liveOwner.current !== ownerId || useAuthStore.getState().sessionUserId !== ownerId) return;
    if (value && (value.ownerId !== ownerId || value.productKey !== liveProductKey.current)) return;
    setAnalysis(value);
  }, [ownerId]);

  useEffect(() => {
    setState(null);
    setAnalysis(null);
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
  const candidate = result?.status === 'found' ? result.candidates[0] : null;
  const query = { barcode, name: candidate?.name ?? null, brand: candidate?.brand ?? null, size: candidate?.size ?? null };
  const candidateKey = candidate ? sourceLimitedProductKey(query) : null;
  liveProductKey.current = candidateKey;
  const currentAnalysis = analysis && analysis.ownerId === ownerId && analysis.productKey === candidateKey
    && personalState.ownerId === ownerId && personalState.status === 'ready'
    && personalState.context?.revision === analysis.contextRevision ? analysis : null;
  const verdict = currentAnalysis?.verdict ?? { state: 'unknown' as const, label: 'Not enough information', findings: [],
    reason: candidate ? 'Finding ingredients and comparing them with your saved skin details and product experiences.'
      : 'An exact product and ingredient list are needed before assessing personal fit.' };
  const summary = <View style={styles.summary}>
    <Text style={styles.caption}>PRODUCT LOOKUP · PRIVATE TEST</Text>
    {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brand} />
      <Text style={styles.body}>Looking for a possible barcode match…</Text></View>
      : <CheckResultView section="summary" facts={{ brand: candidate?.brand ?? '',
        name: candidate?.name ?? (result?.status === 'ambiguous' ? 'Confirm the matching product' : 'Product details unavailable'),
        categoryLabel: candidate?.size ?? '', formula: null, source: null }}
        verdict={verdict} />}
  </View>;
  const content = <View style={sheet ? styles.summary : styles.card} accessibilityLiveRegion="polite">
      {!sheet && <>
      <Text style={styles.caption}>PRODUCT LOOKUP · PRIVATE TEST</Text>
      {loading && <View style={styles.loading}><ActivityIndicator color={colors.brand} />
        <Text style={styles.body}>Looking for a possible barcode match…</Text></View>}
      </>}
      {result && (!sheet || result.status === 'ambiguous') && result.candidates.map((candidate, index) => (
        <View key={candidate.sourceRecordId + ':' + index} style={styles.candidate}>
          <Text style={styles.caption}>{result.status === 'ambiguous' ? 'Check that this matches your label' : 'Possible product match'}</Text>
          {candidate.brand && <Text style={styles.body}>{candidate.brand}</Text>}
          <Text style={styles.title}>{candidate.name}</Text>
          {candidate.size && <Text style={styles.body}>{candidate.size}</Text>}
          <Text style={styles.caption}>UPCitemdb · retrieved {new Date(candidate.retrievedAt).toLocaleDateString()}</Text>
          <Text style={styles.caption}>Barcode {candidate.sourceBarcode}</Text>
        </View>
      ))}
      {sheet && candidate && <Text style={styles.caption}>UPCitemdb · retrieved {new Date(candidate.retrievedAt).toLocaleDateString()} · Barcode {candidate.sourceBarcode}</Text>}
      {currentAnalysis && <CheckResultView section="findings" showIdentity={false}
        facts={{ brand: candidate?.brand ?? '', name: candidate?.name ?? '', categoryLabel: '', formula: null, source: null }} verdict={verdict} />}
      {result && <PublishedProductIngredients ownerId={ownerId} query={query} onAnalysis={onAnalysis} />}
      {result?.candidates.map((candidate, index) => <ExternalProductActions key={candidate.sourceRecordId + ':' + index}
        ownerId={ownerId} query={{ barcode: candidate.observedBarcode,
          name: candidate.name, brand: candidate.brand, size: candidate.size }} />)}
      {result && result.candidates.length > 0 && <Text style={styles.body}>
        Confirm the listing matches your bottle before saving. Published ingredients and local findings do not verify its package formula or predict your individual tolerance.
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
      {needsTester && <Text selectable style={styles.caption}>Tester account {ownerId}</Text>}
      {!loading && <Button label="Retry external lookup" variant="outline" size="medium"
        onPress={() => { void controller.current?.retry(); }} />}
      {children}
    </View>;
  return sheet ? <ResultSheetSurface presentationKey={JSON.stringify([ownerId, barcode, sheet.presentationKey])}
    summary={summary} keepDetailsMounted onClose={sheet.onClose} dismissLabel="Close product result">
    {content}
  </ResultSheetSurface> : content;
}

const styles = StyleSheet.create({
  summary: { gap: spacing.md },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md, marginVertical: spacing.md },
  candidate: { gap: spacing.xs, paddingBottom: spacing.sm },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.ink, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  caption: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
});
