import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Application from 'expo-application';
import { getBuildDiagnostics, publicEnvironment } from '../../config/environment';
import { colors, radii, spacing, typography } from '../../constants/theme';

/** Visible only in a Remote staging bundle, including before membership activation. */
export function BuildDiagnostics() {
  const details = getBuildDiagnostics(publicEnvironment);
  if (!details) return null;

  const version = Application.nativeApplicationVersion ?? 'unknown';
  const nativeBuild = Application.nativeBuildVersion;
  return (
    <View style={styles.card} accessibilityLabel="Remote staging build diagnostics">
      <Text style={styles.heading}>REMOTE STAGING BUILD</Text>
      <Text style={styles.detail}>Service: {details.serviceMode} · Public config shape: {details.backendConfigurationShape}</Text>
      <Text style={styles.detail}>Backend: {details.backendHost}</Text>
      <Text style={styles.detail}>App: {version}{nativeBuild ? ` (${nativeBuild})` : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.brandLight,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: spacing.md,
    gap: 2,
  },
  heading: { color: colors.brandDark, fontSize: typography.sizes.micro, fontWeight: typography.weights.bold, letterSpacing: 0.7 },
  detail: { color: colors.inkMuted, fontSize: typography.sizes.micro, lineHeight: 15 },
});
