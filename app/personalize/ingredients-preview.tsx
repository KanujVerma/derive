import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IngredientEvidenceCard } from '@/src/components/check/PublishedProductIngredients';
import { colors, spacing, typography } from '@/src/constants/theme';
import { publicEnvironment } from '@/src/config/environment';

/** Development-only visual fixture under the existing allowed personalization route. No ingredient lookup or persistence. */
export default function IngredientPreview() {
  const insets = useSafeAreaInsets();
  if (!__DEV__ || publicEnvironment.buildFlavor !== 'development') return <View><Text>Preview unavailable.</Text></View>;
  return <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
    <Stack.Screen options={{ headerShown: false }} />
    <Text style={styles.caption}>DEVELOPMENT PREVIEW · SYNTHETIC DATA</Text>
    <Text style={styles.heading}>Ingredients, right here.</Text>
    <Text style={styles.body}>A visual test of the actual ingredient card. This is not a retrieved product or a coverage result.</Text>
    <IngredientEvidenceCard item={{ source: 'open_beauty_facts', sourceUrl: 'https://world.openbeautyfacts.org/product/0012044038840',
      sourceLicense: 'ODbL-1.0', retrievedAt: '2026-09-30T00:00:00Z', sourceModifiedAt: null, barcode: '0012044038840',
      productName: 'Synthetic cosmetic fixture', brand: 'Fixture', quantity: null,
      ingredientsText: 'Water, Glycerin, Petrolatum, Dimethicone, Sodium Hyaluronate, Parfum',
      matchBasis: 'barcode', formulaVerified: false, canonicalProductId: null }} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { paddingHorizontal: spacing.xl, gap: spacing.md, backgroundColor: colors.canvas, flexGrow: 1 },
  heading: { color: colors.ink, fontSize: typography.sizes.screenTitle, fontWeight: typography.weights.semibold },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  caption: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
});
