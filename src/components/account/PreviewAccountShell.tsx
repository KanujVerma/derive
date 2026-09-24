import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../ui/Icon';
import { colors, spacing, typography } from '../../constants/theme';

/** Local scanner shell has no connected account or membership record. */
export function PreviewAccountShell() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="back" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Account & Settings</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.body}>No account set up.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm },
  back: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { color: colors.ink, fontSize: typography.sizes.sectionTitle, fontWeight: typography.weights.semibold },
  content: { padding: spacing.lg },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: 23 },
});
