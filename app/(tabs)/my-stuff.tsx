import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootShellHeader } from '@/src/components/shell/RootShellHeader';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { colors, layout, spacing, typography } from '@/src/constants/theme';

const sections = [
  { title: 'Skin profile', status: 'Not set up' },
  { title: 'Current products', status: 'None yet' },
  { title: 'Check history', status: 'None yet' },
] as const;

/** Information architecture only; no member or demo records are read here. */
export default function MyStuffScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <RootShellHeader title="My Stuff" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
        <GroupedSection>
          {sections.map(({ title, status }) => (
            <View key={title} style={styles.row}>
              <Text style={styles.rowTitle}>{title}</Text>
              <Text style={styles.rowStatus}>{status}</Text>
            </View>
          ))}
        </GroupedSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.lg },
  row: { minHeight: 68, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  rowTitle: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  rowStatus: { color: colors.inkMuted, fontSize: typography.sizes.caption, marginTop: spacing.xxs },
});
