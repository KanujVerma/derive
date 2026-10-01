import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/src/components/ui/Button';
import { colors, radii, spacing } from '@/src/constants/theme';
import type { PublishedIngredientEvidence } from '@/src/contracts/ProductIngredientLookup';
import { buildPersonalIngredientInsights, type PersonalIngredientInsights } from '@/src/presentation/external-products/personalIngredientInsights';
import { customerController, currentCustomerOwner } from '@/src/presentation/personal-decision/customerGateway';
import { useAuthStore } from '@/src/stores/authStore';
import { PrivateIngredientExplanation } from '@/src/components/check/PrivateIngredientExplanation';
import type { WebIngredientEvidence } from '@/src/contracts/WebProductIngredients';

type PastedState = { scope: string; draft: string; compared: string | null };

/** Keep the existing rule wording intact; separate its evidence caveat from findings. */
function IngredientFindings({ notes }: { notes: PersonalIngredientInsights }) {
  const hasDisclosure = notes.status === 'ready' && notes.sentences.length > 1;
  const findings = hasDisclosure ? notes.sentences.slice(0, -1) : notes.sentences;
  return <View style={styles.findings}>
    {findings.map((sentence, index) => <View key={index} style={styles.finding}>
      <Text style={styles.bullet} accessibilityElementsHidden importantForAccessibility="no">•</Text>
      <Text style={styles.body}>{sentence}</Text>
    </View>)}
    {hasDisclosure && <Text style={styles.disclosure}>{notes.sentences[notes.sentences.length - 1]}</Text>}
  </View>;
}

/** Local comparison is never sent or saved; optional AI uses its separate explicit action. */
export function PersonalIngredientNotes({ ownerId, evidence, webEvidence = null, productKey, productName = 'Product from your bottle', category = 'other_personal_care' }: {
  ownerId: string; evidence: PublishedIngredientEvidence[]; productKey?: string; productName?: string;
  webEvidence?: WebIngredientEvidence | null;
  category?: 'skincare' | 'other_personal_care';
}) {
  const router = useRouter();
  const sessionOwner = useAuthStore(state => state.sessionUserId);
  const state = useSyncExternalStore(customerController.subscribe, customerController.getState);
  const identity = productKey ?? JSON.stringify([evidence.slice(0, 3).map(item => [item.barcode, item.productName, item.sourceUrl]), webEvidence?.sourceUrl]);
  const scope = sessionOwner === ownerId && currentCustomerOwner() === ownerId ? JSON.stringify([ownerId, identity]) : '';
  const liveScope = useRef(scope); liveScope.current = scope;
  const [pasted, setPasted] = useState<PastedState | null>(null);
  const [editorScope, setEditorScope] = useState<string | null>(null);
  useEffect(() => { setPasted(null); }, [scope]);
  useEffect(() => { setEditorScope(null); }, [scope]);
  const isCurrent = () => Boolean(scope) && liveScope.current === scope
    && useAuthStore.getState().sessionUserId === ownerId && currentCustomerOwner() === ownerId;
  if (!scope) return null;
  const currentPasted = pasted?.scope === scope ? pasted : null;
  const contextReady = state.ownerId === ownerId && state.status === 'ready' && state.context?.ownerId === ownerId;
  const context = contextReady ? state.context : null;
  const contextError = state.ownerId === ownerId && state.status === 'error';
  // Never relabel web evidence as a database source or combine competing formulas.
  const lists: Array<PublishedIngredientEvidence | WebIngredientEvidence> = evidence.length
    ? evidence.slice(0, 3) : webEvidence ? [webEvidence] : [];
  const results = contextReady ? lists.map(item => ({ item, source: 'source' in item ? item.source : 'published_web', sourceUrl: item.sourceUrl,
    notes: buildPersonalIngredientInsights(context, [item], 'published', category) })) : [];
  const manual = contextReady && !lists.length && currentPasted?.compared
    ? buildPersonalIngredientInsights(context, [{ ingredientsText: currentPasted.compared }], 'user_label', category) : null;
  const missingProfile = contextReady && (!context?.profile || context.profile.ownerId !== ownerId);
  const editorOpen = editorScope === scope;
  return <View style={styles.card}>
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>PERSONAL INGREDIENT NOTES</Text>
      <Text style={styles.title}>What this means for your skin</Text>
      <Text style={styles.caption}>Based on your saved skin details and this ingredient list. Cosmetic guidance, not a diagnosis or a safety verdict.</Text>
    </View>
    {!contextReady && (contextError
      ? <><Text style={styles.body}>Your saved profile could not be loaded, so personalized ingredient notes are unavailable.</Text>
        <Button label="Reload saved profile" variant="outline" size="medium" onPress={() => { if (isCurrent()) void customerController.load(); }} /></>
      : <Text style={styles.body}>Loading your saved profile for local ingredient notes…</Text>)}
    {missingProfile && <><Text style={styles.body}>Save your skin type, goals or reactivity to compare this ingredient list with that context.</Text>
      <Button label="Add skin context" variant="outline" size="medium" onPress={() => {
        if (isCurrent()) router.push({ pathname: '/personalize', params: { p0b: '1', mode: 'profile' } });
      }} /></>}
    {!missingProfile && results.map(({ item, source, sourceUrl, notes }) => <View key={source + ':' + sourceUrl} style={styles.result} accessibilityLiveRegion="polite">
      {results.length > 1 && <Text style={styles.caption}>{source === 'open_beauty_facts' ? 'Open Beauty Facts list' : 'DailyMed list'} · compared separately</Text>}
      <IngredientFindings notes={notes} />
      {notes.status === 'ready' && context && <PrivateIngredientExplanation ownerId={ownerId}
        productName={item.productName} ingredientsText={item.ingredientsText} category={category} contextRevision={context.revision} />}
    </View>)}
    {!lists.length && <>
      <Text style={styles.body}>We need an ingredient list before we can explain how this product relates to your skin.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Add label ingredients"
        accessibilityState={{ expanded: editorOpen }} style={styles.editorToggle}
        onPress={() => { if (isCurrent()) setEditorScope(editorOpen ? null : scope); }}>
        <View style={styles.editorTitle}>
          <Text style={styles.label}>Add label ingredients</Text>
          <Text style={styles.caption}>Paste from your bottle · compared on this device</Text>
        </View>
        <Text style={styles.toggleSymbol} accessibilityElementsHidden importantForAccessibility="no">{editorOpen ? '−' : '+'}</Text>
      </Pressable>
      {editorOpen && <View style={styles.editor}>
        <Text style={styles.caption}>Paste the ingredient panel below. This local comparison does not save the text or send it to AI. Any optional AI explanation is a separate action.</Text>
        <TextInput multiline maxLength={24_000} value={currentPasted?.draft ?? ''} style={styles.input}
          accessibilityLabel="Ingredients from your bottle" placeholder="Water, Glycerin, Parfum"
          placeholderTextColor={colors.inkMuted} autoCorrect={false} autoCapitalize="none" textAlignVertical="top"
          onChangeText={draft => { if (isCurrent()) setPasted({ scope, draft: draft.slice(0, 24_000), compared: null }); }} />
        <Button label="Compare with my skin" variant="secondary" size="medium"
          disabled={!contextReady || missingProfile || !currentPasted?.draft.trim()} onPress={() => {
            if (isCurrent() && currentPasted?.draft.trim()) setPasted({ ...currentPasted, compared: currentPasted.draft });
          }} />
      </View>}
      {manual && !missingProfile && <View style={styles.result} accessibilityLiveRegion="polite">
        <Text style={styles.caption}>From the label text you added</Text>
        <IngredientFindings notes={manual} />
        {manual.status === 'ready' && context && currentPasted?.compared && <PrivateIngredientExplanation ownerId={ownerId}
          productName={productName} ingredientsText={currentPasted.compared} category={category} contextRevision={context.revision} />}
      </View>}
    </>}
    <Text style={styles.footnote}>These notes are calculated on your device.</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, marginTop: spacing.sm, padding: spacing.lg, borderRadius: radii.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  heading: { gap: spacing.xs },
  eyebrow: { color: colors.brand, fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  result: { gap: spacing.sm },
  findings: { gap: spacing.sm },
  finding: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  bullet: { color: colors.brand, fontSize: 18, lineHeight: 22 },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22, flexShrink: 1 },
  caption: { color: colors.inkMuted, fontSize: 13, lineHeight: 19 },
  disclosure: { color: colors.inkMuted, fontSize: 13, lineHeight: 19, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  footnote: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 },
  label: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  editorToggle: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.canvas },
  editorTitle: { gap: spacing.xxs, flex: 1 },
  toggleSymbol: { color: colors.brand, fontSize: 24, lineHeight: 28 },
  editor: { gap: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radii.md, color: colors.ink,
    backgroundColor: colors.surface, minHeight: 120, maxHeight: 240, padding: spacing.md, fontSize: 15, lineHeight: 22 },
});
