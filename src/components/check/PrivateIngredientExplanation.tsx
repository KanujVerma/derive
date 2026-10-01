import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { colors, spacing, typography } from '@/src/constants/theme';
import type { IngredientExplanationRequest, IngredientExplanationResult } from '@/src/contracts/IngredientExplanation';
import { requestIngredientExplanation, ingredientExplanationKey } from '@/src/presentation/external-products/ingredientExplanation';
import { useAuthStore } from '@/src/stores/authStore';
import { currentCustomerOwner } from '@/src/presentation/personal-decision/customerGateway';
import { supabase } from '@/src/services/supabase';

type Props = { ownerId: string; productName: string; ingredientsText: string;
  category: IngredientExplanationRequest['category']; contextRevision: number };
type State = { scope: string; kind: 'loading' | 'error' } | { scope: string; kind: 'result'; result: IngredientExplanationResult };
const messages: Record<Exclude<IngredientExplanationResult, { status: 'answer' }>['status'], string> = {
  configuration_required: 'AI wording is not configured on this test backend. Your local ingredient notes still work.',
  personalization_disabled: 'Personal AI explanations are not enabled for this test. Your ingredient notes are still available.',
  profile_missing: 'Save a skin profile first to use this explanation.',
  context_unavailable: 'Your saved profile could not be read. No AI answer was generated.',
  context_changed: 'Your profile changed during the request. Tap again to use the updated profile.',
  rate_limited: 'The model allowance is temporarily full. Your local ingredient notes still work.',
  unavailable: 'The model could not be reached. Your local ingredient notes still work.',
  no_answer: 'The model did not return a usable explanation. Your local ingredient notes still work.',
};

/** Optional consented AI wording, independent of the locally computed notes. */
export function PrivateIngredientExplanation(props: Props) {
  const owner = useAuthStore(s => s.sessionUserId);
  const request: IngredientExplanationRequest = { productName: props.productName, ingredientsText: props.ingredientsText,
    category: props.category, contextSharingConsent: true };
  const scope = owner === props.ownerId && currentCustomerOwner() === props.ownerId
    ? props.ownerId + ':' + props.contextRevision + ':' + ingredientExplanationKey(request) : '';
  const live = useRef(scope); live.current = scope;
  const lifecycle = useRef({ mounted: false, generation: 0 });
  useEffect(() => {
    lifecycle.current.mounted = true;
    lifecycle.current.generation += 1;
    return () => { lifecycle.current.mounted = false; lifecycle.current.generation += 1; };
  }, []);
  const [state, setState] = useState<State | null>(null);
  const busy = useRef<string | null>(null);
  useEffect(() => { setState(null); busy.current = null; }, [scope]);
  const current = () => lifecycle.current.mounted && useAuthStore.getState().sessionUserId === props.ownerId
    && currentCustomerOwner() === props.ownerId ? live.current : '';
  const run = async () => {
    if (!supabase || !scope || current() !== scope || busy.current === scope) return;
    busy.current = scope; setState({ scope, kind: 'loading' });
    try {
      const result = await requestIngredientExplanation(request, scope, current, supabase);
      if (current() === scope) setState({ scope, kind: 'result', result });
    } catch { if (current() === scope) setState({ scope, kind: 'error' }); }
    finally { if (busy.current === scope) busy.current = null; }
  };
  if (!scope || !supabase) return null;
  if (!props.productName.trim() || props.productName.length > 180) return <Text style={styles.caption}>
    This product name is too long for the AI test. The local ingredient notes remain available.
  </Text>;
  const visible = state?.scope === scope ? state : null;
  return <View style={styles.section}>
    <Button label="Get a personal explanation" variant="outline" size="medium"
      disabled={visible?.kind === 'loading'} onPress={() => {
        const selectedScope = scope;
        const selectedGeneration = lifecycle.current.generation;
        Alert.alert('Allow a personal explanation?',
          'For this explanation only, send this ingredient text, product name, and your saved skin goals, type and reactivity to Google. No identity, photos, pregnancy answers, prescriptions or reaction history. AI guidance is not a verified safety or compatibility result.',
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Allow this explanation', onPress: () => {
            if (lifecycle.current.generation === selectedGeneration && current() === selectedScope) void run();
          } }]);
      }} />
    {visible?.kind === 'loading' && <ActivityIndicator accessibilityLabel="Writing ingredient explanation" color={colors.brand} />}
    {visible?.kind === 'error' && <Text style={styles.body} accessibilityLiveRegion="polite">AI wording could not complete. Your local ingredient notes are still available.</Text>}
    {visible?.kind === 'result' && (visible.result.status === 'answer' ? <>
      <Text style={styles.title}>Your personal ingredient notes</Text>
      {visible.result.sentences.map((sentence, index) => <Text key={index} selectable style={styles.body}>{sentence}</Text>)}
      <Text style={styles.caption}>Generated with {visible.result.model}. Not a diagnosis, allergy finding or proof that this product is safe for you.</Text>
    </> : <Text style={styles.body} accessibilityLiveRegion="polite">{messages[visible.result.status]}</Text>)}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: spacing.sm }, title: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  caption: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
});
