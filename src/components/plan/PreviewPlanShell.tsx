import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootShellHeader } from '../shell/RootShellHeader';
import { GroupedSection } from '../ui/GroupedSection';
import { colors, layout, spacing, typography } from '../../constants/theme';

const managedBenefits = [
  'Routine built for you',
  'Adjusted from your check-ins',
  'Products purchased separately',
] as const;

/** No routine reads or writes; K-PAID-1 owns enrollment. */
export function PreviewPlanShell() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <RootShellHeader title="Plan" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
        <Text style={styles.name}>Managed Skincare</Text>
        <Text style={styles.price}>$25/month</Text>
        <Text style={styles.summary}>Your full skincare routine, managed over time.</Text>
        <GroupedSection>
          {managedBenefits.map((benefit) => (
            <View key={benefit} style={styles.row}>
              <Text style={styles.rowText}>{benefit}</Text>
            </View>
          ))}
        </GroupedSection>
        <Text style={styles.status}>Enrollment coming soon</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.lg },
  name: { color: colors.ink, fontSize: typography.sizes.sectionTitle, fontWeight: typography.weights.semibold },
  price: { color: colors.brand, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold, marginTop: spacing.xxs },
  summary: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, marginTop: spacing.md, marginBottom: spacing.xl },
  row: { minHeight: 54, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  rowText: { color: colors.ink, fontSize: typography.sizes.bodyRegular },
  status: { color: colors.inkMuted, fontSize: typography.sizes.caption, marginTop: spacing.sm },
});
