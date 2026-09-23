import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountSettingsButton } from '../account/AccountSettingsButton';
import { colors, radii, spacing, typography } from '../../constants/theme';

/** No routine reads or writes: K-PAID-1 owns the later managed-care presentation. */
export function PreviewPlanShell() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Plan</Text>
        <AccountSettingsButton />
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.overline}>MANAGED SKINCARE</Text>
          <Text style={styles.heading}>Care that keeps your routine on track</Text>
          <Text style={styles.body}>A managed plan can bring your products, schedule, and ongoing adjustments together. No plan is connected in this preview.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 64, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.ink, fontSize: typography.sizes.screenTitle, fontWeight: typography.weights.bold },
  content: { padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
  overline: { color: colors.brand, fontSize: typography.sizes.micro, fontWeight: typography.weights.bold },
  heading: { color: colors.ink, fontSize: typography.sizes.sectionTitle, fontWeight: typography.weights.semibold },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: 23 },
});
