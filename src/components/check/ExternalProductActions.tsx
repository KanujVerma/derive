import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { PrivateIngredientQuery } from '@/src/contracts/PrivateIngredientSearch';
import { Button } from '@/src/components/ui/Button';
import { colors, spacing } from '@/src/constants/theme';
import { customerController, currentCustomerOwner } from '@/src/presentation/personal-decision/customerGateway';
import { captureCustomerFunctionClient } from '@/src/presentation/personal-decision/customerController';
import { describeExternalSavedContext } from '@/src/presentation/external-products/savedContext';
import { createExternalProductSaver, type ExternalProductSaveState } from '@/src/presentation/external-products/saveProduct';
import { ingredientQueryKey } from '@/src/presentation/external-products/ingredientSearch';
import { listFreeProducts, saveFreeProduct } from '@/src/services/remote/freeContext';
import { createCatalogRequestId } from '@/src/services/productCatalog';
import { supabase } from '@/src/services/supabase';
import { useAuthStore } from '@/src/stores/authStore';

export function ExternalProductActions({ ownerId, query }: { ownerId: string; query: PrivateIngredientQuery }) {
  const router = useRouter();
  const sessionOwner = useAuthStore(state => state.sessionUserId);
  const contextState = useSyncExternalStore(customerController.subscribe, customerController.getState);
  const key = ingredientQueryKey(query);
  const live = useRef<{ owner: string | null; key: string }>({ owner: ownerId, key });
  live.current = { owner: sessionOwner === ownerId && currentCustomerOwner() === ownerId ? ownerId : null, key };
  const [state, setState] = useState<ExternalProductSaveState | null>(null);
  const [historyScope, setHistoryScope] = useState<string | null>(null);
  const saver = useRef<ReturnType<typeof createExternalProductSaver> | null>(null);
  useEffect(() => {
    setState(null);
    const client = () => captureCustomerFunctionClient(ownerId, supabase, currentCustomerOwner,
      changed => customerController.setOwner(changed));
    const current = createExternalProductSaver({ ownerId, query, createId: createCatalogRequestId,
      getOwner: () => live.current.owner === currentCustomerOwner() ? live.current.owner : null,
      getQueryKey: () => live.current.key,
      list: async cursor => listFreeProducts(50, cursor, await client()),
      save: async request => saveFreeProduct(request, await client()), publish: setState });
    saver.current = current;
    return () => { current.dispose(); if (saver.current === current) saver.current = null; };
  }, [ownerId, key]);
  if (live.current.owner !== ownerId) return null;
  const visible = state?.ownerId === ownerId && state.queryKey === key ? state : null;
  const context = describeExternalSavedContext(ownerId, contextState.status,
    contextState.ownerId === ownerId ? contextState.context : null, contextState.displayLabels);
  const historyOpen = historyScope === JSON.stringify([ownerId, key]);
  const openHistory = () => {
    if (currentCustomerOwner() === ownerId) router.push({ pathname: '/personalize', params: { p0b: '1', mode: 'history' } });
  };
  const confirmSave = () => {
    const selected = saver.current;
    Alert.alert('Does this match your bottle?', query.name + '\n\nSave the name to My Stuff as a product you confirmed. Ingredients and formula remain unverified.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Matches — save', onPress: () => {
        if (saver.current === selected && live.current.owner === ownerId && live.current.key === key) void selected?.save(true);
      } },
    ]);
  };
  return <View style={styles.section}>
    <Button label={historyOpen ? 'Hide reported history' : 'Your reported history'} variant="ghost" size="medium"
      onPress={() => {
        if (live.current.owner === ownerId && currentCustomerOwner() === ownerId) {
          setHistoryScope(historyOpen ? null : JSON.stringify([ownerId, key]));
        }
      }} />
    {historyOpen && <View style={styles.section}>
    {context.kind === 'loading' ? <Text style={styles.body}>Loading your saved profile and reaction reports…</Text>
      : context.kind === 'unavailable' ? <><Text style={styles.body}>Your saved context could not be loaded. This is not a personalized assessment.</Text>
        <Button label="Reload saved context" variant="outline" onPress={() => { if (currentCustomerOwner() === ownerId) void customerController.load(); }} /></>
      : <>
        {context.profile && <Text style={styles.body}>{context.profile}</Text>}
        {context.reports.map(report => <View key={report.id} style={styles.report}>
          <Text style={styles.body}>You reported a reaction to {report.product}.</Text>
          {report.symptoms.length > 0 && <Text style={styles.body}>Reported symptoms: {report.symptoms.join(', ')}.</Text>}
          {report.note && <Text style={styles.body}>{report.note}</Text>}
        </View>)}
        {!context.reports.length && <Text style={styles.body}>No reaction report appears in the loaded saved history.</Text>}
        {context.incomplete && <Text style={styles.body}>This history is incomplete. Other reports may exist.</Text>}
      </>}
    <Text style={styles.body}>Barcode recognition does not supply an ingredient list. This panel shows your reported history, not an ingredient comparison or a personal-fit result. A shared brand alone does not establish shared ingredients or the cause of a reaction.</Text>
    <Button label="View or record a past reaction" variant="outline" size="medium" onPress={openHistory} />
    </View>}
    {visible?.kind === 'saved' ? <><Text style={styles.body} accessibilityLiveRegion="polite">Saved to My Stuff · added by you, formula unverified.</Text>
      <Button label="Open My Stuff" variant="outline" size="medium" onPress={() => { if (currentCustomerOwner() === ownerId) router.push('/(tabs)/my-stuff'); }} /></>
      : <Button label="Save product to My Stuff" variant="brand" size="medium" loading={visible?.kind === 'saving'} disabled={visible?.kind === 'saving'} onPress={confirmSave} />}
    {visible?.kind === 'error' && <Text style={styles.body} accessibilityRole="alert">The product could not be saved. Try again; no successful save has been confirmed.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginVertical: spacing.md },
  title: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  body: { color: colors.inkMuted, fontSize: 15, lineHeight: 22 },
  report: { gap: spacing.xs, paddingVertical: spacing.xs },
});
