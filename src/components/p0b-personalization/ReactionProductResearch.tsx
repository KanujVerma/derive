import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { colors, spacing } from '@/src/constants/theme';
import { namedIngredientBrand } from '@/src/contracts/WebProductIngredients';
import { validWebIngredientQuery } from '@/src/presentation/external-products/webProductIngredients';
import { reactionResearch } from '@/src/services/reactionIngredientResearch';
import { currentCustomerOwner } from '@/src/presentation/personal-decision/customerGateway';
import { reactionIngredientFlags } from '@/src/domain/reactionIngredientFlags';

/** Inline public research for the reported product, separate from the privately saved experience. */
export function ReactionProductResearch({ ownerId, name, auto = true }: { ownerId: string; name: string; auto?: boolean }) {
  useSyncExternalStore(reactionResearch.subscribe, reactionResearch.getSnapshot);
  const [expanded, setExpanded] = useState(false);
  const product = { key: name.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    name: name.trim(), brand: namedIngredientBrand(name) };
  const scope = JSON.stringify([ownerId, product]);
  const current = currentCustomerOwner() === ownerId;
  const eligible = validWebIngredientQuery({ barcode: '', name: product.name, brand: product.brand, size: null });
  useEffect(() => {
    setExpanded(false);
    if (auto && current && eligible) void reactionResearch.research(ownerId, product);
  }, [scope, auto, current, eligible]);
  if (!current) return null;
  const record = reactionResearch.record(ownerId, product);
  const evidence = record?.status === 'found' ? record.evidence : null;
  const flags = evidence ? reactionIngredientFlags(evidence.ingredientsText) : [];
  return <View style={styles.section} accessibilityLiveRegion="polite">
    <Text style={styles.heading}>Ingredients worth reviewing</Text>
    <Text style={styles.caption}>Only the product name goes into research. Your symptoms and notes stay out of the search.</Text>
    {!eligible ? <Text style={styles.body}>Add the brand and any part of the product name you remember. We will look for the matching product.</Text>
      : !record ? <Button label="Find published ingredients" variant="outline" size="medium" onPress={() => void reactionResearch.research(ownerId, product)} />
        : record.status === 'loading' ? <Text style={styles.body}>Looking for a matching published ingredient list. You can save your report while we look.</Text>
          : !evidence ? <><Text style={styles.body}>{record.status === 'ambiguous'
            ? record.candidates?.length ? 'Which product did you use?' : 'We found different possibilities but could not resolve the product yet. Your report is still saved.'
            : record.status === 'rate_limited' ? 'Ingredient research is temporarily limited. Your report can still be saved.'
              : 'A matching ingredient list is not available yet. Your report can still be saved and used as product history.'}</Text>
            {record.status === 'ambiguous' && record.candidates?.map(candidate => <Button key={candidate.name}
              label={candidate.name} variant="outline" size="medium" onPress={() => void reactionResearch.choose(ownerId, product, candidate)} />)}
            <Button label="Try ingredient search again" variant="ghost" size="medium" onPress={() => void reactionResearch.research(ownerId, product, true)} /></>
            : <>
              <Text style={styles.body}>Published list for {evidence.productName}</Text>
              {flags.length ? flags.slice(0, 8).map(flag => <View key={flag.id} style={styles.flag}>
                <Text style={styles.heading}>{flag.matchedLabel}</Text><Text style={styles.body}>{flag.explanation}</Text>
              </View>) : <Text style={styles.body}>No ingredient matched our current research flags. This is not an all clear and does not explain your reaction.</Text>}
              {flags.length > 8 && <Text style={styles.caption}>More flagged entries are included in the ingredient list below.</Text>}
              <Text style={styles.caption}>These are possible concerns, not your confirmed triggers. The current published formula may differ from the package you used.</Text>
              <Button label={expanded ? 'Hide ingredient list' : 'Show ingredient list'} variant="ghost" size="medium" onPress={() => setExpanded(!expanded)} />
              {expanded && <Text selectable style={styles.body}>{evidence.ingredientsText}</Text>}
              <Button label="Published product source" variant="ghost" size="medium" onPress={() => { void Linking.openURL(evidence.sourceUrl).catch(() => {}); }} />
              {[...new Map(flags.flatMap(flag => flag.sources).map(source => [source.url, source])).values()].map(source =>
                <Button key={source.url} label={source.label} variant="ghost" size="medium" onPress={() => { void Linking.openURL(source.url).catch(() => {}); }} />)}
              <Text style={styles.caption}>Published product facts are kept on this device for up to seven days. They are separate from your saved report and removed here when you sign out or delete your account.</Text>
            </>}
    <Text style={styles.caption}>If a rash persists or recurs, a clinician can help distinguish irritation from allergy and investigate the cause.</Text>
  </View>;
}
const styles = StyleSheet.create({
  section: { alignSelf: 'stretch', gap: spacing.sm, paddingVertical: spacing.md },
  heading: { color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  body: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  caption: { color: colors.inkMuted, fontSize: 12, lineHeight: 18 },
  flag: { gap: spacing.xs, paddingVertical: spacing.xs },
});
