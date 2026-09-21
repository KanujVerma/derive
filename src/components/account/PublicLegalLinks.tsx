import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { publicLegalLinks } from '../../config/environment';
import { colors, spacing, typography } from '../../constants/theme';

export function PublicLegalLinks() {
  const links = [
    publicLegalLinks.privacyUrl ? { label: 'Privacy Policy', url: publicLegalLinks.privacyUrl } : null,
    publicLegalLinks.supportUrl ? { label: 'Support', url: publicLegalLinks.supportUrl } : null,
  ].filter((link): link is { label: string; url: string } => Boolean(link));
  if (links.length === 0) return null;

  return (
    <View style={styles.row}>
      {links.map((link) => (
        <Pressable
          key={link.label}
          accessibilityRole="link"
          onPress={() => void Linking.openURL(link.url)}
        >
          <Text style={styles.link}>{link.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  link: {
    color: colors.brand,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
  },
});
