import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { CatalogProductSearch } from '@/src/components/catalog/CatalogProductSearch';
import { Button } from '@/src/components/ui/Button';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { QuestionGroup } from '@/src/components/ui/QuestionGroup';
import { Screen } from '@/src/components/ui/Screen';
import { colors, radii, spacing, typography } from '@/src/constants/theme';
import type { FreeSavedProduct } from '@/src/contracts/FreeContext';
import { createProductEntryController, getProductEntryOwner } from '@/src/presentation/my-stuff/myStuffRemote';
import { useAuthStore } from '@/src/stores/authStore';
import { useFreeAccessStore } from '@/src/stores/freeAccessStore';
import type { ProductEntryController } from '@/src/presentation/my-stuff/productEntry';

export interface ProductEntryProps {
  ownerId: string | null;
  onSaved: (product: FreeSavedProduct) => void;
  onClose: () => void;
  /** Runtime/fixtures can supply a controller without pretending persistence succeeded. */
  controller?: ProductEntryController;
}

/** Shelf creation returns the acknowledged record. Saving does not create routine use. */
export function ProductEntry({ ownerId, onSaved, onClose, controller: suppliedController }: ProductEntryProps) {
  const [controller] = useState(() => suppliedController ?? createProductEntryController());
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  useEffect(() => {
    const sync = () => controller.setOwner(ownerId && getProductEntryOwner() === ownerId ? ownerId : null);
    sync();
    const stopAuth = useAuthStore.subscribe(sync), stopAccess = useFreeAccessStore.subscribe(sync);
    return () => { stopAuth(); stopAccess(); controller.setOwner(null); };
  }, [controller, ownerId]);
  const current = !!ownerId && state.ownerId === ownerId && getProductEntryOwner() === ownerId;
  if (!current || state.status === 'unavailable') return <Screen scrollable>
    <Text style={styles.title}>Add product</Text>
    <Text style={styles.copy}>Saving products is unavailable in this session.</Text>
    <View style={styles.actions}><Button label="Back to My Stuff" variant="outline" onPress={onClose} /></View>
  </Screen>;
  const locked = state.status === 'saving' || state.status === 'error' || state.status === 'saved';
  const product = state.draft.product;
  const manual = product && !product.productId ? product : null;
  const save = () => { void controller.save().then(saved => {
    if (saved && controller.getState().ownerId === ownerId && getProductEntryOwner() === ownerId) controller.deliverAcknowledgement(saved, onSaved);
  }); };
  return <Screen scrollable>
    <Text style={styles.title}>Add product</Text>
    <Text style={styles.copy}>Save a product without running a Check. Your saved collection is separate from your routine.</Text>
    {!locked && <View style={styles.questionGroup}><CatalogProductSearch embedded label="Find a product" actionLabel="Choose" keepFocusAfterSelect={false}
      onSelect={item => controller.selectCatalog({ productId: item.productId, name: item.name, brand: item.brand })} /></View>}
    {product?.productId ? <View style={styles.section}>
      <Text style={styles.product}>{product.name}</Text>
      {product.brand ? <Text style={styles.copy}>{product.brand}</Text> : null}
      <Text style={styles.copy}>Saved as a product name. Package and formula details are not recorded here.</Text>
      <Button label="Enter a product name instead" variant="ghost" disabled={locked} onPress={() => controller.enterManual({ name: '' })} />
    </View> : <QuestionGroup label="Or enter a product name" support="Names you enter stay unverified." style={styles.questionGroup}>
      <View style={styles.fields}>
        <TextInput accessibilityLabel="Product name" placeholder="Product name" placeholderTextColor={colors.inkMuted} style={styles.input}
        editable={!locked} maxLength={180} value={manual?.name ?? ''} onChangeText={name => controller.enterManual({ name, brand: manual?.brand })} />
        <TextInput accessibilityLabel="Product brand, optional" placeholder="Brand, optional" placeholderTextColor={colors.inkMuted} style={styles.input}
        editable={!locked} maxLength={120} value={manual?.brand ?? ''} onChangeText={brand => controller.enterManual({ name: manual?.name ?? '', brand })} />
      </View>
    </QuestionGroup>}
    <QuestionGroup label="Do you use this product?" style={styles.questionGroup}>
      <View style={styles.choices}>{([['using', 'I use it'], ['considering', "I'm considering it"], ['stopped', 'I stopped using it']] as const).map(([value, label]) =>
        <ChoiceChip key={value} label={label} selectionType="single" selected={state.draft.state === value} disabled={locked} onSelect={() => controller.chooseState(value)} />)}</View>
    </QuestionGroup>
    <View style={styles.actions}>
      {state.error ? <Text accessibilityRole="alert" style={styles.error}>{state.error}</Text> : null}
      <Button label={state.status === 'error' ? 'Retry save' : 'Save product'} loading={state.status === 'saving'} disabled={state.status === 'saved'} onPress={save} />
      <Button label="Back to My Stuff" variant="ghost" onPress={onClose} />
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: typography.sizes.screenTitle, lineHeight: typography.lineHeights.screenTitle, fontWeight: typography.weights.bold, marginBottom: spacing.xs },
  copy: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  section: { marginTop: spacing.xxl, gap: spacing.xs },
  questionGroup: { marginTop: spacing.xxl },
  fields: { gap: spacing.sm },
  actions: { marginTop: spacing.xxl, gap: spacing.sm },
  product: { color: colors.ink, fontSize: typography.sizes.bodyLarge, lineHeight: typography.lineHeights.bodyLarge, fontWeight: typography.weights.semibold },
  input: { minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, color: colors.ink, backgroundColor: colors.surface, fontSize: typography.sizes.bodyRegular },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { color: colors.actionStop.text, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
});
