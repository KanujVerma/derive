import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountSettingsButton } from '@/src/components/account/AccountSettingsButton';
import { colors, radii, spacing, typography } from '@/src/constants/theme';

/** Information architecture shell only. No member or demo records are read here. */
export default function MyStuffScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Stuff</Text>
        <AccountSettingsButton />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
        <Text style={styles.intro}>Products you use and checks you save will appear here.</Text>
        {['Skin profile', 'Current products', 'Check history'].map((label) => (
          <View key={label} style={styles.card}>
            <Text style={styles.cardTitle}>{label}</Text>
            <Text style={styles.cardBody}>Nothing saved yet.</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 64, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.ink, fontSize: typography.sizes.screenTitle, fontWeight: typography.weights.bold },
  content: { padding: spacing.lg, gap: spacing.md },
  intro: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: 23, marginBottom: spacing.sm },
  card: { borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.xs },
  cardTitle: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
  cardBody: { color: colors.inkMuted, fontSize: typography.sizes.caption },
});
