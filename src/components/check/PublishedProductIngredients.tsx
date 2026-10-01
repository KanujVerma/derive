import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { colors, radii, spacing, typography } from '@/src/constants/theme';
import type { ProductIngredientQuery, ProductIngredientLookup, PublishedIngredientEvidence } from '@/src/contracts/ProductIngredientLookup';
import { productIngredientKey, requestProductIngredients } from '@/src/presentation/external-products/productIngredients';
import { PersonalIngredientNotes } from '@/src/components/check/PersonalIngredientNotes';
import { supabase } from '@/src/services/supabase';
import { useAuthStore } from '@/src/stores/authStore';

type State = { scope: string } & ({ kind: 'loading' } | { kind: 'result'; result: ProductIngredientLookup } | { kind: 'error' });

/** Source information stays inside the result, without opening a website or WebView. */
export function IngredientEvidenceCard({ item }: { item: PublishedIngredientEvidence }) {
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const identity = JSON.stringify([item.source, item.sourceUrl, item.retrievedAt, item.ingredientsText]);
  const expanded = detailsFor === identity;
  return <View style={styles.evidenceCard}>
    <View style={styles.headingRow}>
      <Text style={styles.title}>Ingredient list</Text>
      <View style={styles.badge}><Text style={styles.badgeText}>Published list</Text></View>
    </View>
    <Text style={styles.caption}>{item.source === 'open_beauty_facts' ? 'Open Beauty Facts' : 'DailyMed'} · {item.matchBasis === 'barcode' ? 'Barcode match' : 'Name / variant match'}</Text>
    <Text selectable style={styles.ingredients}>{item.ingredientsText}</Text>
    <Text style={styles.caption}>Check this list against your bottle; formulas can change.</Text>
    <Button label={expanded ? 'Hide source details' : 'Source details'} size="medium" variant="ghost"
      onPress={() => setDetailsFor(expanded ? null : identity)} />
    {expanded && <View style={styles.sourceDetails}>
      <Text style={styles.caption}>{item.productName}</Text>
      <Text style={styles.caption}>Retrieved {new Date(item.retrievedAt).toLocaleDateString()}{item.sourceModifiedAt ? ` · Updated ${new Date(item.sourceModifiedAt).toLocaleDateString(undefined, item.source === 'dailymed' ? { timeZone: 'UTC' } : undefined)}` : ''}</Text>
      <Text style={styles.caption}>{item.source === 'open_beauty_facts' ? 'Contributed data · ODbL 1.0' : 'Public drug label · not barcode verification'}</Text>
      <Text selectable style={styles.caption}>{item.sourceUrl}</Text>
      <Text style={styles.caption}>Source evidence only. Not a package-verified formula; this list is not saved.</Text>
    </View>}
  </View>;
}
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
  return <View style={styles.section} accessibilityLiveRegion="polite">
    {loading && <View style={styles.statusCard}><View style={styles.row}><ActivityIndicator color={colors.brand} /><Text style={styles.title}>Finding ingredients</Text></View><Text style={styles.body}>Checking published lists for this product…</Text></View>}
    {result?.evidence.map(item => <IngredientEvidenceCard key={item.source + ':' + key} item={item} />)}
    {result && result.evidence.length > 1 && <Text style={styles.body}>Two sources returned lists. They are shown separately because versions can differ; compare them with your package.</Text>}
    {result && result.evidence.length === 0 && <View style={styles.statusCard}><Text style={styles.title}>Ingredient list unavailable</Text><Text style={styles.body}>
      {result.status === 'rate_limited' ? 'Ingredient lookup is temporarily rate limited. Try again later.'
        : result.status === 'unavailable' ? 'An ingredient source could not be reached. Try again, or check your package.'
        : result.status === 'ambiguous' ? 'Several label variants matched. Check the exact product name and SPF on your package.'
        : 'The connected sources have no matching list. Add the ingredient text from your bottle below to get local notes.'}
    </Text></View>}
    {visible?.kind === 'error' && <View style={styles.statusCard}><Text style={styles.title}>Ingredient lookup interrupted</Text><Text style={styles.body}>Your product match is still here. Retry below, or add the ingredient text from your bottle.</Text></View>}
    {!loading && <PersonalIngredientNotes ownerId={ownerId} evidence={result?.evidence ?? []} productKey={key}
      productName={query.name ?? 'Unidentified product'}
      category={/\b(deodorant|antiperspirant|shampoo|conditioner|hair)\b/i.test(query.name ?? '') ? 'other_personal_care' : 'skincare'} />}
    {!loading && <Button label="Refresh ingredient lookup" variant="ghost" size="medium" onPress={() => {
      if (live.current !== scope || useAuthStore.getState().sessionUserId !== ownerId) return;
      memo.current = null; setAttempt(n => n + 1);
    }} />}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginTop: spacing.sm }, row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center', justifyContent: 'space-between' },
  evidenceCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  statusCard: { backgroundColor: colors.canvasMuted, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
  badge: { backgroundColor: colors.brandLight, borderRadius: radii.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  badgeText: { color: colors.brandDark, fontSize: typography.sizes.micro, fontWeight: typography.weights.semibold },
  ingredients: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: 25 },
  sourceDetails: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: spacing.xs },
  title: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  caption: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
});
