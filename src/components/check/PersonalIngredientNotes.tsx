import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/src/components/ui/Button';
import { colors, spacing } from '@/src/constants/theme';
import type { PublishedIngredientEvidence } from '@/src/contracts/ProductIngredientLookup';
import { buildPersonalIngredientInsights } from '@/src/presentation/external-products/personalIngredientInsights';
import { customerController, currentCustomerOwner } from '@/src/presentation/personal-decision/customerGateway';
import { useAuthStore } from '@/src/stores/authStore';
import { PrivateIngredientExplanation } from '@/src/components/check/PrivateIngredientExplanation';

const GUIDANCE_URL = 'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dermatologists-tips-relieve-dry-skin';
type PastedState = { scope: string; draft: string; compared: string | null };

/** Local comparison is never sent or saved; optional AI uses its separate explicit action. */
export function PersonalIngredientNotes({ ownerId, evidence, productKey, productName = 'Product from your bottle', category = 'other_personal_care' }: {
  ownerId: string; evidence: PublishedIngredientEvidence[]; productKey?: string; productName?: string;
  category?: 'skincare' | 'other_personal_care';
}) {
  const router = useRouter();
  const sessionOwner = useAuthStore(state => state.sessionUserId);
  const state = useSyncExternalStore(customerController.subscribe, customerController.getState);
  const identity = productKey ?? JSON.stringify(evidence.slice(0, 3).map(item => [item.barcode, item.productName, item.sourceUrl]));
  const scope = sessionOwner === ownerId && currentCustomerOwner() === ownerId ? JSON.stringify([ownerId, identity]) : '';
  const liveScope = useRef(scope); liveScope.current = scope;
  const [pasted, setPasted] = useState<PastedState | null>(null);
  useEffect(() => { setPasted(null); }, [scope]);
  const isCurrent = () => Boolean(scope) && liveScope.current === scope
    && useAuthStore.getState().sessionUserId === ownerId && currentCustomerOwner() === ownerId;
  if (!scope) return null;
  const currentPasted = pasted?.scope === scope ? pasted : null;
  const contextReady = state.ownerId === ownerId && state.status === 'ready' && state.context?.ownerId === ownerId;
  const context = contextReady ? state.context : null;
  const contextError = state.ownerId === ownerId && state.status === 'error';
  const lists = evidence.slice(0, 3);
  const results = contextReady ? lists.map(item => ({ item, source: item.source, sourceUrl: item.sourceUrl,
    notes: buildPersonalIngredientInsights(context, [item], 'published', category) })) : [];
  const manual = contextReady && !lists.length && currentPasted?.compared
    ? buildPersonalIngredientInsights(context, [{ ingredientsText: currentPasted.compared }], 'user_label', category) : null;
  const missingProfile = contextReady && (!context?.profile || context.profile.ownerId !== ownerId);
  return <View style={styles.section}>
    <Text style={styles.title}>Why it may/may not suit your skin</Text>
    <Text style={styles.caption}>Local ingredient rules, not AI or a personal-fit rating. Only your saved skin goals, skin type and reactivity are used.</Text>
    {!contextReady && (contextError
      ? <><Text style={styles.body}>Your saved profile could not be loaded, so personalized ingredient notes are unavailable.</Text>
        <Button label="Reload saved profile" variant="outline" size="medium" onPress={() => { if (isCurrent()) void customerController.load(); }} /></>
      : <Text style={styles.body}>Loading your saved profile for local ingredient notes…</Text>)}
    {missingProfile && <><Text style={styles.body}>Save your skin type, goals or reactivity to compare this ingredient list with that context.</Text>
      <Button label="Add skin context" variant="outline" size="medium" onPress={() => {
        if (isCurrent()) router.push({ pathname: '/personalize', params: { p0b: '1', mode: 'profile' } });
      }} /></>}
    {!missingProfile && results.map(({ item, source, sourceUrl, notes }) => <View key={source + ':' + sourceUrl} style={styles.section} accessibilityLiveRegion="polite">
      {results.length > 1 && <Text style={styles.caption}>{source === 'open_beauty_facts' ? 'Open Beauty Facts list' : 'DailyMed list'} · compared separately</Text>}
      {notes.sentences.map((sentence, index) => <Text key={index} style={styles.body}>{sentence}</Text>)}
      {notes.status === 'ready' && context && <PrivateIngredientExplanation ownerId={ownerId}
        productName={item.productName} ingredientsText={item.ingredientsText} category={category} contextRevision={context.revision} />}
    </View>)}
    {!lists.length && <>
      <Text style={styles.label}>Paste ingredients from your bottle</Text>
      <Text style={styles.caption}>If lookup has no list, paste the ingredient panel here to try the comparison. Pasting and comparing here is local and does not save this text or send it to AI. Any optional AI explanation is a separate action.</Text>
      <TextInput multiline maxLength={24_000} value={currentPasted?.draft ?? ''} style={styles.input}
        accessibilityLabel="Ingredients from your bottle" placeholder="For example: Water, Glycerin, Parfum"
        placeholderTextColor={colors.inkMuted} autoCorrect={false} autoCapitalize="none" textAlignVertical="top"
        onChangeText={draft => { if (isCurrent()) setPasted({ scope, draft: draft.slice(0, 24_000), compared: null }); }} />
      <Button label="Compare pasted ingredients with my skin" variant="outline" size="medium"
        disabled={!contextReady || missingProfile || !currentPasted?.draft.trim()} onPress={() => {
          if (isCurrent() && currentPasted?.draft.trim()) setPasted({ ...currentPasted, compared: currentPasted.draft });
        }} />
      {manual && !missingProfile && <View style={styles.section} accessibilityLiveRegion="polite">
        {manual.sentences.map((sentence, index) => <Text key={index} style={styles.body}>{sentence}</Text>)}
        {manual.status === 'ready' && context && currentPasted?.compared && <PrivateIngredientExplanation ownerId={ownerId}
          productName={productName} ingredientsText={currentPasted.compared} category={category} contextRevision={context.revision} />}
      </View>}
    </>}
    <Button label="Read dermatologist ingredient guidance" variant="ghost" size="medium" onPress={() => {
      if (isCurrent()) void Linking.openURL(GUIDANCE_URL).catch(() => {});
    }} />
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginTop: spacing.sm },
  title: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  body: { color: colors.inkMuted, fontSize: 15, lineHeight: 22 },
  caption: { color: colors.inkMuted, fontSize: 13, lineHeight: 19 },
  label: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.ink,
    minHeight: 120, maxHeight: 240, padding: spacing.md, fontSize: 15, lineHeight: 22 },
});
