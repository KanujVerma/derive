import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CatalogProductSummary } from '../../../contracts/ProductCatalog';
import { ingredientPanelGuidance, type IngredientPanelState } from '../../../presentation/capture/ingredientPanelSession';
import { colors, layout, radii, spacing, typography } from '../../../constants/theme';
import { CatalogProductSearch } from '../../catalog/CatalogProductSearch';

type Props = {
  state: IngredientPanelState;
  onRetake(): void;
  onRetryLater(): void;
  onProductLink?: () => void;
  catalogSearch?: (query: string) => Promise<CatalogProductSummary[]>;
  onCatalogSelect?: (product: CatalogProductSummary) => void;
};

/** This recovery surface makes no verdict from missing or extracted ingredients. */
export function IngredientPanelRecovery({ state, onRetake, onRetryLater, onProductLink, catalogSearch, onCatalogSelect }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const exhausted = state.phase === 'fallback';
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text accessibilityRole="header" style={styles.title}>{exhausted ? 'Try another way' : 'One ingredient photo retake'}</Text>
    <Text accessibilityLiveRegion="polite" style={styles.body}>{exhausted
      ? 'We could not confirm the ingredients after two attempts. No ingredient-based verdict is available from these photos.'
      : ingredientPanelGuidance(state.reason)}</Text>
    {!exhausted && <RecoveryAction label="Retake ingredient panel" onPress={onRetake} />}
    {onProductLink && <RecoveryAction label="Use product link" onPress={onProductLink} />}
    {catalogSearch && onCatalogSelect && <RecoveryAction label="Search verified catalog" onPress={() => setSearchOpen(true)} />}
    {searchOpen && catalogSearch && onCatalogSelect && <View style={styles.search}>
      <Text style={styles.body}>Choose the exact product, size and variant. A catalog shortlist alone does not confirm the formula in your package.</Text>
      <CatalogProductSearch label="Exact product search" actionLabel="Check" keepFocusAfterSelect={false}
        search={async query => (await catalogSearch(query)).filter(product => product.formulaState === 'verified_variant_available')}
        onSelect={onCatalogSelect} emptyCopy="No verified catalog formula found. Use a product link or try later."
        errorCopy="Search is unavailable right now. Use a product link or try later." />
    </View>}
    <RecoveryAction label="Retry later" onPress={onRetryLater} />
  </ScrollView>;
}

function RecoveryAction({ label, onPress }: { label: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.action}>
    <Text style={styles.actionText}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.canvas },
  title: { fontSize: typography.sizes.screenTitle, fontWeight: typography.weights.semibold, color: colors.ink },
  body: { fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, color: colors.inkMuted },
  action: { minHeight: layout.ctaHeight, padding: spacing.md, borderRadius: radii.full, backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold, color: colors.inkInverse },
  search: { gap: spacing.sm },
});
