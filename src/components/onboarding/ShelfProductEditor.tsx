import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { ProductCategorySchema, type Product, type ProductCategory } from '../../types/schema';
import { shelfProductIdentity } from '../../utils/shelfProducts';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { TextField } from '../ui/TextField';

interface Props {
  product?: Product;
  existingProducts: readonly Product[];
  onSave: (details: { brand: string; name: string; category: ProductCategory }) => void;
  onCancel: () => void;
}

const CATEGORY_LABELS: Partial<Record<ProductCategory, string>> = {
  body_care: 'Body care',
  hair_care: 'Hair care',
};

export function ShelfProductEditor({ product, existingProducts, onSave, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  const [brand, setBrand] = useState(product?.brand ?? '');
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState<ProductCategory | null>(product?.category ?? null);
  const duplicate = existingProducts.some((other) =>
    other.id !== product?.id && shelfProductIdentity(other) === shelfProductIdentity({ brand, name })
  );
  const canSave = !!brand.trim() && !!name.trim() && category !== null && !duplicate;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{product ? 'Edit product' : 'Add a product'}</Text>
          <TouchableOpacity
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Close product editor"
            style={styles.closeButton}
          >
            <Icon name="close" size={20} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.description}>
            Enter the name from the package. We do not yet have verified formula details for a product you add or correct.
          </Text>
          <TextField label="Brand" value={brand} onChangeText={setBrand} placeholder="Brand on the package" autoCapitalize="words" />
          <TextField label="Exact product name" value={name} onChangeText={setName} placeholder="Name on the package" autoCapitalize="words" />
          {duplicate && <Text style={styles.duplicateNotice} accessibilityRole="alert">This product is already on your shelf. Edit that entry instead.</Text>}
          <Text style={styles.categoryLabel}>Category</Text>
          <View style={styles.categories} accessibilityRole="radiogroup">
            {ProductCategorySchema.options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.categoryChip, category === option && styles.categoryChipSelected]}
                onPress={() => setCategory(option)}
                accessibilityRole="radio"
                accessibilityLabel={CATEGORY_LABELS[option] ?? option.charAt(0).toUpperCase() + option.slice(1)}
                accessibilityState={{ checked: category === option }}
                aria-checked={category === option}
              >
                <Text style={[styles.categoryText, category === option && styles.categoryTextSelected]}>
                  {CATEGORY_LABELS[option] ?? option.charAt(0).toUpperCase() + option.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Button label="Cancel" variant="outline" size="medium" onPress={onCancel} style={styles.footerButton} />
          <Button
            label={product ? 'Save changes' : 'Save product'}
            variant="primary"
            size="medium"
            disabled={!canSave}
            onPress={() => category && onSave({ brand, name, category })}
            style={styles.footerButton}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: typography.sizes.sectionTitle, fontWeight: typography.weights.bold, color: colors.ink },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  description: { fontSize: typography.sizes.bodyRegular, color: colors.inkMuted, lineHeight: 22, marginBottom: spacing.lg },
  duplicateNotice: { color: colors.actionPause.text, fontSize: typography.sizes.caption, lineHeight: 19, marginBottom: spacing.md },
  categoryLabel: { fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold, color: colors.ink, marginBottom: spacing.sm },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  categoryChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.full, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  categoryChipSelected: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  categoryText: { color: colors.inkMuted, fontSize: typography.sizes.caption },
  categoryTextSelected: { color: colors.brandDark, fontWeight: typography.weights.semibold },
  footer: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  footerButton: { flex: 1 },
});
