import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { CatalogProductSummary } from '../../contracts/ProductCatalog';
import { searchCatalogProducts } from '../../services/productCatalog';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { catalogImagePresentation } from '../../presentation/check/result-sheet/model';
import { Icon } from '../ui/Icon';
import { createCatalogSearchController } from '../../presentation/catalog/searchController';

interface Props {
  onSelect: (product: CatalogProductSummary) => void;
  search?: (query: string) => Promise<CatalogProductSummary[]>;
  selectedIds?: readonly string[];
  actionLabel?: string;
  label?: string;
  placeholder?: string;
  keepFocusAfterSelect?: boolean;
  onQueryChange?: (query: string) => void;
  errorCopy?: string;
  emptyCopy?: string;
  embedded?: boolean;
  preserveSelection?: boolean;
  focusKey?: string | number;
}

export function CatalogProductSearch({
  onSelect, selectedIds = [], actionLabel = 'Add', label = 'Add product',
  search = searchCatalogProducts,
  placeholder = 'Search brand or product name', keepFocusAfterSelect = true, onQueryChange,
  errorCopy = 'Search is unavailable right now. You can still add a product manually.',
  emptyCopy = 'No catalog match yet. Try another name or add it manually.',
  embedded = false, preserveSelection = false, focusKey,
}: Props) {
  const [state, setState] = useState({ query: '', resultQuery: '', items: [] as CatalogProductSummary[], loading: false, error: false });
  const { query, loading, error } = state;
  const inputRef = useRef<TextInput>(null);
  const searchRef = useRef(search);
  searchRef.current = search;
  const controllerRef = useRef<ReturnType<typeof createCatalogSearchController<CatalogProductSummary>> | null>(null);
  const controller = () => {
    if (!controllerRef.current) controllerRef.current = createCatalogSearchController(value => searchRef.current(value), setState);
    return controllerRef.current;
  };
  useEffect(() => () => { controllerRef.current?.dispose(); controllerRef.current = null; }, []);
  const lastFocusKey = useRef(focusKey);
  useEffect(() => {
    if (lastFocusKey.current === focusKey) return;
    lastFocusKey.current = focusKey;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focusKey]);

  const select = (item: CatalogProductSummary) => {
    controller().select(preserveSelection);
    if (!preserveSelection) onQueryChange?.('');
    if (keepFocusAfterSelect) inputRef.current?.focus();
    else inputRef.current?.blur();
    onSelect(item);
  };

  return (
    <View style={[styles.container, embedded && styles.embedded]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={query}
        onChangeText={(value) => { controller().setQuery(value); onQueryChange?.(value); }}
        onSubmitEditing={() => { void controller().submit(); }}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Search catalog products"
        returnKeyType="search"
      />
      {query.trim().length === 1 && <Text style={styles.helper}>Type at least 2 characters.</Text>}
      {loading && <View style={styles.status}><ActivityIndicator size="small" color={colors.brand} /><Text style={styles.helper}>Searching products...</Text></View>}
      {error && <Text style={styles.helper} accessibilityRole="alert">{errorCopy}</Text>}
      {!loading && !error && query.trim().length >= 2 && state.resultQuery === query.trim() && state.items.length === 0 && (
        <Text style={styles.helper}>{emptyCopy}</Text>
      )}
      {!loading && !error && state.resultQuery === query.trim() && state.items.map((item) => {
        const alreadyAdded = selectedIds.includes(item.productId);
        const image = catalogImagePresentation(item.imageUrl);
        return (
          <TouchableOpacity
            key={item.productId}
            style={styles.result}
            onPress={() => select(item)}
            disabled={alreadyAdded}
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel} ${item.brand} ${item.name}`}
            accessibilityState={{ disabled: alreadyAdded }}
          >
            <View style={styles.thumbnail} accessible accessibilityLabel={image.kind === 'catalog' ? image.label : 'No product image available'}>
              {image.kind === 'catalog'
                ? <Image source={{ uri: image.uri }} style={styles.thumbnailImage} resizeMode="contain" />
                : <Icon name="bottle" size={24} color={colors.brand} />}
            </View>
            <View style={styles.resultCopy}>
              <Text style={styles.brand}>{item.brand}</Text>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.category}>{item.category.replace('_', ' ')}</Text>
            </View>
            <Text style={[styles.action, alreadyAdded && styles.actionDisabled]}>{alreadyAdded ? 'Added' : actionLabel}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.xs },
  embedded: { borderWidth: 0, borderRadius: 0, padding: 0, backgroundColor: 'transparent' },
  label: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.canvas },
  helper: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: 19 },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  result: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingVertical: spacing.sm, gap: spacing.sm },
  thumbnail: { width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbnailImage: { width: 56, height: 56 },
  resultCopy: { flex: 1 },
  brand: { color: colors.inkMuted, fontSize: typography.sizes.caption },
  name: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  category: { color: colors.inkMuted, fontSize: typography.sizes.micro, textTransform: 'capitalize' },
  action: { color: colors.brand, fontSize: typography.sizes.caption, fontWeight: typography.weights.bold },
  actionDisabled: { color: colors.inkMuted },
});
