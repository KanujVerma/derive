import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { colors, spacing, typography } from '@/src/constants/theme';
import type { IngredientExplanationRequest, IngredientExplanationResult } from '@/src/contracts/IngredientExplanation';
import { requestIngredientExplanation, ingredientExplanationKey } from '@/src/presentation/external-products/ingredientExplanation';
import { useAuthStore } from '@/src/stores/authStore';
import { currentCustomerOwner } from '@/src/presentation/personal-decision/customerGateway';
import { supabase } from '@/src/services/supabase';
import type { PersonalProfileInput } from '@/src/contracts/PersonalContext';
import { cosmeticContextFromPersonalProfile } from '@/src/domain/ingredient-context';
import { hasSupportedExplanationCue } from '@/src/domain/ingredient-explanation-eligibility';

type Props = { ownerId: string; productName: string; ingredientsText: string;
  category: IngredientExplanationRequest['category']; contextRevision: number; localContext?: PersonalProfileInput | null };
type State = { scope: string; kind: 'loading' | 'error' } | { scope: string; kind: 'result'; result: IngredientExplanationResult };
const messages: Record<Exclude<IngredientExplanationResult, { status: 'answer' }>['status'], string> = {
  configuration_required: 'AI wording is not configured on this test backend. Your local ingredient notes still work.',
  personalization_disabled: 'Personal AI explanations are not enabled for this test. Your ingredient notes are still available.',
  profile_missing: 'Save a skin profile first to use this explanation.',
  context_unavailable: 'Your saved profile could not be read. No AI answer was generated.',
  context_changed: 'Your profile changed during the request. Tap again to use the updated profile.',
  rate_limited: 'Please wait at least 11 seconds before trying again. The private test allowance may also be full. Your local analysis remains available.',
  unavailable: 'The model could not be reached. Your local ingredient notes still work.',
  no_answer: 'The extra AI check did not add a supported finding. Your personal analysis is shown above.',
};

/** Optional consented source-limited wording. It does not replace the Personal Fit verdict. */
export function PrivateIngredientExplanation(props: Props) {
  const owner = useAuthStore(s => s.sessionUserId);
  const request: IngredientExplanationRequest = { productName: props.productName, ingredientsText: props.ingredientsText,
    category: props.category, contextSharingConsent: true, provider: 'jev' };
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
  // The core explanation is already calculated locally. Do not offer a model
  // action that has no supported cue, then mislabel its abstention as a failure.
  if (props.localContext !== undefined && !hasSupportedExplanationCue(props.ingredientsText, props.category,
    cosmeticContextFromPersonalProfile(props.localContext))) return null;
  if (!props.productName.trim() || props.productName.length > 180) return <Text style={styles.caption}>
    This product name is too long for the AI test. The local ingredient notes remain available.
  </Text>;
  const visible = state?.scope === scope ? state : null;
  return <View style={styles.section}>
    <Text style={styles.caption}>Your personal analysis above is automatic. This optional check sends only the disclosed context to AI.</Text>
    <Button label="More detail with AI" variant="outline" size="medium"
      disabled={visible?.kind === 'loading'} onPress={() => {
        const selectedScope = scope;
        const selectedGeneration = lifecycle.current.generation;
        Alert.alert('Allow a personal explanation?',
          'For this explanation only, send the ingredients and your saved skin goals, type and reactivity to TypeSafe. No identity, photos, pregnancy answers, prescriptions or reaction history. AI guidance is not a verified safety or compatibility result.',
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Allow this explanation', onPress: () => {
            if (lifecycle.current.generation === selectedGeneration && current() === selectedScope) void run();
          } }]);
      }} />
    {visible?.kind === 'loading' && <ActivityIndicator accessibilityLabel="Writing ingredient explanation" color={colors.brand} />}
    {visible?.kind === 'error' && <Text style={styles.body} accessibilityLiveRegion="polite">AI wording could not complete. Your local ingredient notes are still available.</Text>}
    {visible?.kind === 'result' && (visible.result.status === 'answer' ? <>
      <Text style={styles.title}>Your personal ingredient notes</Text>
      {visible.result.sentences.map((sentence, index) => <Text key={index} selectable style={styles.body}>{sentence}</Text>)}
      <Text style={styles.caption}>Assessed with {visible.result.model}. Not a diagnosis, allergy finding or proof that this product is safe for you.</Text>
    </> : <Text style={styles.body} accessibilityLiveRegion="polite">{messages[visible.result.status]}</Text>)}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: spacing.sm }, title: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  caption: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
});
