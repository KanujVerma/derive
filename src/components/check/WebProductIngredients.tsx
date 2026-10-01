import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { colors, radii, spacing, typography } from '@/src/constants/theme';
import type { ProductIngredientQuery } from '@/src/contracts/ProductIngredientLookup';
import type { WebIngredientEvidence, WebProductIngredientLookup } from '@/src/contracts/WebProductIngredients';
import { requestWebProductIngredients, validWebIngredientQuery, webProductIngredientKey } from '@/src/presentation/external-products/webProductIngredients';
import { currentCustomerOwner } from '@/src/presentation/personal-decision/customerGateway';
import { supabase } from '@/src/services/supabase';
import { useAuthStore } from '@/src/stores/authStore';
import { useFreeAccessStore } from '@/src/stores/freeAccessStore';
import { ingredientLookupCopy } from '@/src/presentation/external-products/ingredientLookupCopy';

type Props = { ownerId: string; query: ProductIngredientQuery; enabled: boolean;
  onEvidence?: (evidence: WebIngredientEvidence | null) => void; onComplete?: () => void };
type State = { scope: string; epoch: number } & ({ kind: 'loading' } | { kind: 'error' }
  | { kind: 'result'; result: WebProductIngredientLookup });

/** Ephemeral published web evidence, kept inline and separate from package confirmation. */
export function WebProductIngredients({ ownerId, query, enabled, onEvidence, onComplete }: Props) {
  const sessionOwner = useAuthStore(state => state.sessionUserId);
  const authStatus = useAuthStore(state => state.status);
  const accessScope = useFreeAccessStore(state => [state.status, state.userId, state.access?.userId].join('|'));
  const stableQuery = useMemo(() => ({ barcode: query.barcode, name: query.name, brand: query.brand, size: query.size }),
    [query.barcode, query.name, query.brand, query.size]);
  const key = webProductIngredientKey(stableQuery);
  const scope = useMemo(() => ownerId && sessionOwner === ownerId && currentCustomerOwner() === ownerId
    && validWebIngredientQuery(stableQuery) ? ownerId + ':' + key : '',
  [ownerId, sessionOwner, authStatus, accessScope, key, stableQuery]);
  const live = useRef({ scope, epoch: 0, enabled });
  if (live.current.scope !== scope) live.current = { scope, epoch: live.current.epoch + 1, enabled };
  else live.current.enabled = enabled;
  const epoch = live.current.epoch;
  const mounted = useRef(false);
  const memo = useRef<{ scope: string; epoch: number; promise: Promise<WebProductIngredientLookup> } | null>(null);
  const callback = useRef(onEvidence); callback.current = onEvidence;
  const complete = useRef(onComplete); complete.current = onComplete;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!scope) { memo.current = null; setState(null); return; }
    if (memo.current && (memo.current.scope !== scope || memo.current.epoch !== epoch)) memo.current = null;
    if (!enabled) return;
    let disposed = false;
    const current = () => mounted.current && live.current.enabled && live.current.scope === scope
      && live.current.epoch === epoch && useAuthStore.getState().sessionUserId === ownerId
      && currentCustomerOwner() === ownerId ? scope : '';
    setState({ scope, epoch, kind: 'loading' });
    if (!memo.current) memo.current = { scope, epoch, promise: supabase
      ? requestWebProductIngredients(stableQuery, ownerId, current, supabase)
      : Promise.resolve({ status: 'configuration_required' }) };
    void memo.current.promise.then(result => {
      if (!disposed && current() === scope) {
        setState({ scope, epoch, kind: 'result', result }); complete.current?.();
      }
    }).catch(() => {
      if (!disposed && current() === scope) {
        setState({ scope, epoch, kind: 'error' }); complete.current?.();
      }
    });
    return () => { disposed = true; };
  }, [scope, epoch, enabled, attempt, stableQuery, ownerId]);

  const visible = state?.scope === scope && state.epoch === epoch ? state : null;
  const result = visible?.kind === 'result' ? visible.result : null;
  const evidence = result?.status === 'found' ? result.evidence : null;
  const missing = ingredientLookupCopy(result && result.status !== 'found' ? result.status : 'unavailable');
  useEffect(() => { callback.current?.(enabled && scope ? evidence : null); }, [enabled, scope, epoch, evidence]);

  if (!enabled || !scope) return null;
  const loading = !visible || visible.kind === 'loading';
  return <View style={styles.section} accessibilityLiveRegion="polite">
    {loading && <View style={styles.statusCard}>
      <View style={styles.row}><ActivityIndicator color={colors.brand} accessibilityLabel="Finding published ingredients" />
        <Text style={styles.title}>Finding your ingredient list</Text></View>
      <Text style={styles.body}>Checking published product pages for a matching list.</Text>
    </View>}
    {evidence && <View style={styles.evidenceCard}>
      <View style={styles.headingRow}><Text style={styles.title}>Ingredient list</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>Published online</Text></View></View>
      <Text style={styles.productName}>{evidence.productName}</Text>
      <Text selectable style={styles.ingredients}>{evidence.ingredientsText}</Text>
      <View style={styles.sourceRow}>
        <Text style={styles.caption}>{evidence.sourceName}</Text>
        <Text style={styles.caption}>Retrieved {new Date(evidence.retrievedAt).toLocaleDateString(undefined,
          { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
      </View>
      <Text style={styles.caption}>This published list may differ from your package. Compare it with the ingredients printed on your bottle.</Text>
    </View>}
    {!loading && !evidence && <View style={styles.statusCard}>
      <Text style={styles.title}>{missing.title}</Text>
      <Text style={styles.body}>{missing.body}</Text>
      <Button label="Try ingredient search again" variant="ghost" size="medium" style={styles.retry}
        onPress={() => {
          if (!mounted.current || !live.current.enabled || live.current.scope !== scope || live.current.epoch !== epoch
            || useAuthStore.getState().sessionUserId !== ownerId || currentCustomerOwner() !== ownerId) return;
          memo.current = null; setAttempt(value => value + 1);
        }} />
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center', justifyContent: 'space-between' },
  evidenceCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  statusCard: { backgroundColor: colors.canvasMuted, borderRadius: radii.md, padding: spacing.md, gap: spacing.xs },
  badge: { backgroundColor: colors.brandLight, borderRadius: radii.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  badgeText: { color: colors.brandDark, fontSize: typography.sizes.micro, fontWeight: typography.weights.semibold },
  title: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  productName: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  ingredients: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: 25 },
  sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: spacing.sm },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  caption: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  retry: { alignSelf: 'flex-start', marginLeft: -spacing.sm },
});
