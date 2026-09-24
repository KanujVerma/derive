import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootShellHeader } from '../shell/RootShellHeader';
import { Button } from '../ui/Button';
import { colors, layout, spacing, typography } from '../../constants/theme';

/** No mock member products, offers, or checkout. */
export function PreviewShopShell() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <RootShellHeader title="Shop" />
      <View style={styles.content}>
        <Text style={styles.heading}>Coming soon</Text>
        <Text style={styles.body}>Buying options for products you check with Derive.</Text>
        <Button label="Check a Product" variant="brand" onPress={() => router.push('/(tabs)/check')} style={styles.action} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.xl },
  heading: { color: colors.ink, fontSize: typography.sizes.sectionTitle, fontWeight: typography.weights.semibold },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, marginTop: spacing.sm },
  action: { marginTop: spacing.xl },
});
