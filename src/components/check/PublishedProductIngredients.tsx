import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { colors, spacing, typography } from '@/src/constants/theme';
import type { ProductIngredientQuery, ProductIngredientLookup } from '@/src/contracts/ProductIngredientLookup';
import { productIngredientKey, requestProductIngredients, publishedIngredientUrl } from '@/src/presentation/external-products/productIngredients';
import { manufacturerIngredientPage } from '@/src/presentation/external-products/manufacturerIngredients';
import { PersonalIngredientNotes } from '@/src/components/check/PersonalIngredientNotes';
import { supabase } from '@/src/services/supabase';
import { useAuthStore } from '@/src/stores/authStore';

type State = { scope: string } & ({ kind: 'loading' } | { kind: 'result'; result: ProductIngredientLookup } | { kind: 'error' });
/** Private evidence lookup. No Google/model call or automatic persistence. */
export function PublishedProductIngredients({ query, ownerId }: { query: ProductIngredientQuery; ownerId: string }) {
  const sessionOwner = useAuthStore(s => s.sessionUserId);
  const key = productIngredientKey(query);
  const scope = sessionOwner === ownerId ? ownerId + ':' + key : '';
  const live = useRef(scope); live.current = scope;
  const memo = useRef<{ scope: string; promise: Promise<ProductIngredientLookup> } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    if (!scope || !supabase) { memo.current = null; return; }
    let disposed = false;
    const current = () => useAuthStore.getState().sessionUserId === ownerId ? live.current : '';
    setState({ scope, kind: 'loading' });
    // Deduplicate React effect replay, but a customer-requested retry can make a fresh call.
    if (memo.current?.scope !== scope) memo.current = { scope,
      promise: requestProductIngredients(query, ownerId, current, supabase) };
    void memo.current.promise.then(result => {
      if (!disposed && current() === scope) setState({ scope, kind: 'result', result });
    }).catch(() => { if (!disposed && current() === scope) setState({ scope, kind: 'error' }); });
    return () => { disposed = true; };
  }, [scope, attempt]);
  if (!scope || !supabase) return null;
  const visible = state?.scope === scope ? state : null;
  const loading = !visible || visible.kind === 'loading';
  const result = visible?.kind === 'result' ? visible.result : null;
  const manufacturerUrl = manufacturerIngredientPage(query);
  return <View style={styles.section} accessibilityLiveRegion="polite">
    <Text style={styles.title}>Published ingredients</Text>
    {loading && <View style={styles.row}><ActivityIndicator color={colors.brand} /><Text style={styles.body}>Checking free ingredient sources…</Text></View>}
    {result?.evidence.map(item => <View key={item.source} style={styles.section}>
      <Text style={styles.title}>{item.productName}</Text>
      <Text selectable style={styles.body}>{item.ingredientsText}</Text>
      <Text style={styles.caption}>{item.source === 'open_beauty_facts' ? 'Open Beauty Facts contributors · ODbL 1.0 · barcode match' : 'DailyMed public drug label · name/variant match, not barcode verification'}</Text>
      <Text style={styles.caption}>Retrieved {new Date(item.retrievedAt).toLocaleDateString()}{item.sourceModifiedAt ? ` · Source updated ${new Date(item.sourceModifiedAt).toLocaleDateString(undefined, item.source === 'dailymed' ? { timeZone: 'UTC' } : undefined)}` : ''}</Text>
      <Button label="Open ingredient source" size="medium" variant="outline" onPress={() => {
        if (publishedIngredientUrl(item.source, item.sourceUrl)) void Linking.openURL(item.sourceUrl).catch(() => {});
      }} />
    </View>)}
    {result && result.evidence.length > 1 && <Text style={styles.body}>Two sources returned lists. They are shown separately because versions can differ; compare them with your package.</Text>}
    {result && result.evidence.length > 0 && <Text style={styles.caption}>Compare the product variant and ingredients with your bottle. This is a published list, not a verified personal-fit result. No ingredient data is saved.</Text>}
    {result && result.evidence.length === 0 && <Text style={styles.body}>
      {result.status === 'rate_limited' ? 'Ingredient lookup is temporarily rate limited. Try again later.'
        : result.status === 'unavailable' ? 'An ingredient source could not be reached. Try again, or check your package.'
        : result.status === 'ambiguous' ? 'Several label variants matched. Check the exact product name and SPF on your package.'
        : 'These sources do not have an ingredient list for this product yet. Check the ingredient panel on your package.'}
    </Text>}
    {visible?.kind === 'error' && <Text style={styles.body}>Ingredient lookup could not complete. Your barcode result is still available.</Text>}
    {!loading && <PersonalIngredientNotes ownerId={ownerId} evidence={result?.evidence ?? []} productKey={key}
      productName={query.name ?? 'Unidentified product'}
      category={/\b(deodorant|antiperspirant|shampoo|conditioner|hair)\b/i.test(query.name ?? '') ? 'other_personal_care' : 'skincare'} />}
    {!loading && !result?.evidence.length && manufacturerUrl && <>
      <Text style={styles.caption}>You can check the manufacturer’s ingredient page directly. Derive does not import its list or analyze it.</Text>
      <Button label="Open manufacturer ingredients" variant="outline" size="medium" onPress={() => {
        if (live.current === scope && useAuthStore.getState().sessionUserId === ownerId) void Linking.openURL(manufacturerUrl).catch(() => {});
      }} />
    </>}
    {!loading && <Button label="Retry ingredient lookup" variant="outline" size="medium" onPress={() => {
      if (live.current !== scope || useAuthStore.getState().sessionUserId !== ownerId) return;
      memo.current = null; setAttempt(n => n + 1);
    }} />}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginTop: spacing.sm }, row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  title: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  caption: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
});
