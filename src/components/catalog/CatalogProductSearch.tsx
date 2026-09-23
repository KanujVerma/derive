import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { CatalogProductSummary } from '../../contracts/ProductCatalog';
import { searchCatalogProducts } from '../../services/productCatalog';
import { colors, radii, spacing, typography } from '../../constants/theme';

interface Props {
  onSelect: (product: CatalogProductSummary) => void;
  selectedIds?: readonly string[];
  actionLabel?: string;
  label?: string;
  placeholder?: string;
  keepFocusAfterSelect?: boolean;
  onQueryChange?: (query: string) => void;
  errorCopy?: string;
  emptyCopy?: string;
}

export function CatalogProductSearch({
  onSelect, selectedIds = [], actionLabel = 'Add', label = 'Add Product',
  placeholder = 'Search brand or product name', keepFocusAfterSelect = true, onQueryChange,
  errorCopy = 'Search is unavailable right now. You can still add a product manually.',
  emptyCopy = 'No catalog match yet. Try another name or add it manually.',
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ query: string; items: CatalogProductSummary[] }>({ query: '', items: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    const cleaned = query.trim();
    const version = ++requestVersion.current;
    if (cleaned.length < 2) {
      setResults({ query: '', items: [] });
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      searchCatalogProducts(cleaned)
        .then((items) => { if (requestVersion.current === version) setResults({ query: cleaned, items }); })
        .catch(() => { if (requestVersion.current === version) { setResults({ query: cleaned, items: [] }); setError(true); } })
        .finally(() => { if (requestVersion.current === version) setLoading(false); });
    }, 275);
    return () => { clearTimeout(timer); requestVersion.current++; };
  }, [query]);

  const select = (item: CatalogProductSummary) => {
    onSelect(item);
    setQuery('');
    onQueryChange?.('');
    setResults({ query: '', items: [] });
    if (keepFocusAfterSelect) inputRef.current?.focus();
    else inputRef.current?.blur();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={query}
        onChangeText={(value) => { setQuery(value); setResults({ query: '', items: [] }); onQueryChange?.(value); }}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSubtle}
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Search catalog products"
        returnKeyType="search"
      />
      {query.trim().length === 1 && <Text style={styles.helper}>Type at least 2 characters.</Text>}
      {loading && <View style={styles.status}><ActivityIndicator size="small" color={colors.brand} /><Text style={styles.helper}>Searching products...</Text></View>}
      {error && <Text style={styles.helper} accessibilityRole="alert">{errorCopy}</Text>}
      {!loading && !error && query.trim().length >= 2 && results.query === query.trim() && results.items.length === 0 && (
        <Text style={styles.helper}>{emptyCopy}</Text>
      )}
      {!loading && !error && results.query === query.trim() && results.items.map((item) => {
        const alreadyAdded = selectedIds.includes(item.productId);
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
  label: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.canvas },
  helper: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: 19 },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  result: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingVertical: spacing.sm, gap: spacing.sm },
  resultCopy: { flex: 1 },
  brand: { color: colors.inkMuted, fontSize: typography.sizes.caption },
  name: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  category: { color: colors.inkMuted, fontSize: typography.sizes.micro, textTransform: 'capitalize' },
  action: { color: colors.brand, fontSize: typography.sizes.caption, fontWeight: typography.weights.bold },
  actionDisabled: { color: colors.inkMuted },
});
