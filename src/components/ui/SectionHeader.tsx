import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, layout, spacing, textStyles, typography } from '../../constants/theme';

export interface SectionHeaderAction {
  label: string; accessibilityLabel: string; onPress: () => void; disabled?: boolean;
}
export function SectionHeader({ title, action }: { title: string; action?: SectionHeaderAction }) {
  return <View style={styles.row}>
    <Text style={[textStyles.sectionHeading, styles.title]} accessibilityRole="header">{title}</Text>
    {action ? <Pressable onPress={action.onPress} disabled={action.disabled} accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel} accessibilityState={{ disabled: Boolean(action.disabled) }} style={styles.action}>
      <Text style={[styles.actionText, action.disabled && styles.disabled]}>{action.label}</Text>
    </Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  action: { minWidth: layout.minTouchTarget, minHeight: layout.minTouchTarget, justifyContent: 'center', paddingHorizontal: spacing.xs },
  actionText: { color: colors.brand, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  disabled: { color: colors.inkMuted },
});
