import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radii, spacing, typography } from '../../../constants/theme';
import type { CaptureRole, PhotoRole } from '../../../presentation/capture/productEvidence';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';

const photoOptions: { role: PhotoRole; label: string }[] = [
  { role: 'front_label', label: 'Front label' },
  { role: 'ingredients', label: 'Ingredients' },
  { role: 'packaging', label: 'Packaging' },
];

type Props = {
  onOpenCapture(role: CaptureRole): void;
  onSearchName(): void;
};

/** Entry for the canonical free Check. The camera remains the primary action. */
export function CaptureEntry({ onOpenCapture, onSearchName }: Props) {
  const [showPhotos, setShowPhotos] = useState(false);
  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <View style={styles.iconCircle}><Icon name="scan" size={30} color={colors.brand} /></View>
        <Text style={styles.title}>Scan a barcode</Text>
        <Text style={styles.description}>Point your camera at the barcode on a product package.</Text>
        <Button label="Scan barcode" variant="brand" onPress={() => onOpenCapture('barcode')} style={styles.primary} />
        <Pressable accessibilityRole="button" accessibilityLabel="Search by name" onPress={onSearchName} style={styles.nameAction}>
          <Icon name="search" size={17} color={colors.brand} />
          <Text style={styles.nameText}>Search by name</Text>
        </Pressable>
      </View>

      <View style={styles.otherWays}>
        <Pressable accessibilityRole="button" accessibilityLabel="Other ways to identify" accessibilityState={{ expanded: showPhotos }} onPress={() => setShowPhotos((open) => !open)} style={styles.otherWaysToggle}>
          <Text style={styles.otherWaysTitle}>Other ways to identify</Text>
          <Text style={styles.otherWaysHint}>{showPhotos ? 'Hide' : 'Use package photos'}</Text>
        </Pressable>
        {showPhotos && (
          <View style={styles.photoOptions}>
            {photoOptions.map(({ role, label }) => (
              <Pressable key={role} accessibilityRole="button" accessibilityLabel={`Photograph ${label.toLowerCase()}`} onPress={() => onOpenCapture(role)} style={styles.photoOption}>
                <Text style={styles.photoText}>{label}</Text>
              </Pressable>
            ))}
            <Text style={styles.photoNote}>Photos may help find a possible product. They do not verify its formula.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.lg },
  hero: { alignItems: 'center', padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title: { color: colors.ink, fontSize: typography.sizes.screenTitle, lineHeight: typography.lineHeights.screenTitle, fontWeight: typography.weights.semibold, textAlign: 'center' },
  description: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, textAlign: 'center', marginTop: spacing.xs },
  primary: { alignSelf: 'stretch', marginTop: spacing.xl },
  nameAction: { minHeight: layout.minTouchTarget, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  nameText: { color: colors.brand, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  otherWays: { borderRadius: radii.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, overflow: 'hidden' },
  otherWaysToggle: { minHeight: layout.minTouchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  otherWaysTitle: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  otherWaysHint: { color: colors.brand, fontSize: typography.sizes.caption },
  photoOptions: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
  photoOption: { minHeight: layout.minTouchTarget, borderRadius: radii.sm, backgroundColor: colors.canvasMuted, justifyContent: 'center', paddingHorizontal: spacing.md },
  photoText: { color: colors.ink, fontSize: typography.sizes.bodyRegular },
  photoNote: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption, marginTop: spacing.xs },
});
