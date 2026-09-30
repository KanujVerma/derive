import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PrivateIngredientQuery } from '@/src/contracts/PrivateIngredientSearch';
import { Button } from '@/src/components/ui/Button';
import { colors, spacing, typography } from '@/src/constants/theme';
import { supabase } from '@/src/services/supabase';
import { useAuthStore } from '@/src/stores/authStore';
import { createPrivateIngredientController, ingredientQueryKey, privateIngredientAnswerDocument,
  requestPrivateIngredientSearch, safeIngredientSourceUrl, type PrivateIngredientState } from '@/src/presentation/external-products/ingredientSearch';

/** Explicit private search; optional consented AI commentary never becomes canonical personal fit. */
export function PrivateIngredientSearch({ query, ownerId }: { query: PrivateIngredientQuery; ownerId: string }) {
  const sessionOwnerId = useAuthStore(state => state.sessionUserId);
  const activeOwner = ownerId === sessionOwnerId ? ownerId : null;
  const key = ingredientQueryKey(query);
  const live = useRef({ ownerId: activeOwner, key });
  live.current = { ownerId: activeOwner, key };
  const [state, setState] = useState<PrivateIngredientState | null>(null);
  const [open, setOpen] = useState(false);
  const controller = useRef<ReturnType<typeof createPrivateIngredientController> | null>(null);
  const requestedPersonalization = useRef(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setState(null); setOpen(false);
    if (!activeOwner || !supabase) return;
    const client = supabase;
    const current = createPrivateIngredientController({ ownerId: activeOwner, queryKey: key,
      currentScope: () => live.current.ownerId === useAuthStore.getState().sessionUserId
        ? live.current.ownerId + ':' + live.current.key : '',
      request: () => requestPrivateIngredientSearch(query, activeOwner,
        () => live.current.ownerId === useAuthStore.getState().sessionUserId ? live.current.ownerId : null,
        () => live.current.key, client, requestedPersonalization.current),
      publish: next => { setState(next); if (next.kind === 'result' && next.result.status === 'grounded_answer') setOpen(true); },
    });
    controller.current = current;
    return () => { current.dispose(); if (controller.current === current) controller.current = null; };
  }, [activeOwner, key]);

  if (!activeOwner || !supabase) return null;
  const visible = state?.ownerId === activeOwner && state.queryKey === key ? state : null;
  const loading = visible?.kind === 'loading';
  const result = visible?.kind === 'result' ? visible.result : null;
  const answer = result?.status === 'grounded_answer' ? result : null;
  const runSearch = (personalized: boolean) => {
    if (loading || live.current.ownerId !== activeOwner || live.current.key !== key
      || useAuthStore.getState().sessionUserId !== activeOwner) return;
    requestedPersonalization.current = personalized;
    setOpen(false);
    void controller.current?.run();
  };
  const errorText = result?.status === 'configuration_required' ? 'Ingredient search is not configured on this local test backend.'
    : result?.status === 'rate_limited' ? 'The search provider’s quota is temporarily exhausted. Try again later.'
    : result?.status === 'no_grounded_answer' ? 'No source-backed answer was available. Check the printed ingredient label instead.'
    : result?.status === 'unavailable' ? 'Ingredient search is unavailable right now. You can try again later.'
    : result?.status === 'personalization_disabled' ? 'Personalized AI search is waiting for approved paid-provider setup. Ingredients-only search stays separate.'
    : result?.status === 'profile_missing' ? 'Save your optional skin profile in My Stuff first, or search ingredients only.'
    : result?.status === 'context_unavailable' ? 'Your saved skin context could not be read. Try again or search ingredients only.'
    : result?.status === 'context_changed' ? 'Your saved skin context changed during the search. Tap again to use the latest version.'
    : visible?.kind === 'error' ? visible.code === 'PRIVATE_TESTER_REQUIRED' ? 'This account is not on the private ingredient-search tester list.'
      : visible.code === 'SIGN_IN_REQUIRED' ? 'Refresh your test session before searching.' : 'Ingredient search is unavailable. You can try again later.' : null;
  return (
    <View style={styles.section}>
      <Button label={loading ? 'Finding published ingredients…' : 'Find published ingredients'} variant="outline" size="medium"
        disabled={loading} onPress={() => runSearch(false)} />
      <Button label="Ingredients + my skin" variant="outline" size="medium" disabled={loading}
        onPress={() => Alert.alert('Share basic skin context with Google?',
          'For this search only, send your saved skin goals, skin type and reactivity to Gemini. No identity, photos, pregnancy answers, prescriptions or reaction history. The answer is AI guidance, not verified personal fit.',
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Allow this search', onPress: () => runSearch(true) }])} />
      {loading && <ActivityIndicator color={colors.brand} accessibilityLabel="Searching published product information" />}
      {errorText && <Text style={styles.body} accessibilityLiveRegion="polite">{errorText}</Text>}
      {visible?.kind === 'error' && visible.code === 'PRIVATE_TESTER_REQUIRED'
        && <Text selectable style={styles.caption}>Tester account ID: {activeOwner}</Text>}
      {answer && <Button label="View search answer" variant="outline" size="medium" onPress={() => setOpen(true)} />}
      <Text style={styles.caption}>Public product information may differ from your package. Optional AI context is separate from verified personal fit.</Text>
      <Modal visible={open && Boolean(answer)} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <Button label="Close search answer" variant="outline" size="medium" onPress={() => setOpen(false)} />
            <Text style={styles.warning}>Public web evidence only. Not package-verified ingredients, medical advice or a personal-fit result.</Text>
            {answer?.answerKind === 'contextual_web_guidance' && <Text style={styles.caption}>
              AI commentary uses the basic skin context saved when you requested this answer. It does not identify an allergy or prove this product is safe for you.
            </Text>}
            {answer && <Text style={styles.caption}>Retrieved {new Date(answer.retrievedAt).toLocaleString()}</Text>}
          </View>
          {answer && <WebView source={{ html: privateIngredientAnswerDocument(answer), baseUrl: 'about:blank' }}
            style={styles.webview} originWhitelist={['*']} javaScriptEnabled={false} domStorageEnabled={false}
            mixedContentMode="never" allowFileAccess={false} allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false} sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
            incognito cacheEnabled={false} setSupportMultipleWindows={false} allowsBackForwardNavigationGestures={false}
            onShouldStartLoadWithRequest={request => {
              if (request.url === 'about:blank') return true;
              if (request.isTopFrame !== false && safeIngredientSourceUrl(request.url)) {
                void Linking.openURL(request.url).catch(() => {});
              }
              return false;
            }} />}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginTop: spacing.sm },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  caption: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  warning: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  modal: { flex: 1, backgroundColor: colors.surface },
  header: { gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  webview: { flex: 1, backgroundColor: colors.surface },
});
