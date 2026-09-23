import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountSettingsButton } from '../account/AccountSettingsButton';
import { colors, radii, spacing, typography } from '../../constants/theme';

/** Free presentation preview: no mock membership products or offers. */
export function PreviewShopShell() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Shop</Text>
        <AccountSettingsButton />
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.heading}>Start with a product check</Text>
          <Text style={styles.body}>This local preview has one sourced product sample. There are no live offers or saved products here.</Text>
          <Pressable onPress={() => router.push('/(tabs)/check')} style={styles.action} accessibilityRole="button" accessibilityLabel="Go to Check">
            <Text style={styles.actionText}>Go to Check</Text>
          </Pressable>
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
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  heading: { color: colors.ink, fontSize: typography.sizes.sectionTitle, fontWeight: typography.weights.semibold },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: 23 },
  action: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  actionText: { color: colors.brand, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
});
