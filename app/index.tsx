import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useAuthStore } from '@/src/stores/authStore';
import { useBootstrapStore } from '@/src/stores/bootstrapStore';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { resolveAuthRoute } from '@/src/utils/authRouting';
import { colors } from '@/src/constants/theme';
import { publicEnvironment } from '@/src/config/environment';
import { resolveShellLanding, resolveShellPresentation } from '@/src/utils/shellPresentation';

export default function Index() {
  const isCompleted = useOnboardingStore((s) => s.isCompleted);
  const authStatus = useAuthStore((s) => s.status);
  const profileResolution = useBootstrapStore((s) => s.status);
  const resolvedUserId = useBootstrapStore((s) => s.resolvedUserId);
  const bootstrapState = useBootstrapStore((s) => s.bootstrapState);
  const bootstrapRefreshing = useBootstrapStore((s) => s.isRefreshing);
  const sessionUserId = useAuthStore((s) => s.sessionUserId);
  const remoteEnabled = isRemoteServiceEnabled();
  const shell = resolveShellPresentation({ buildFlavor: publicEnvironment.buildFlavor, remoteEnabled });

  const destination = resolveAuthRoute({
    remoteEnabled,
    authStatus,
    isOnboardingCompleted: isCompleted,
    profileResolution,
    sessionUserId,
    resolvedUserId,
    bootstrapState,
    bootstrapRefreshing,
  });

  if (destination.type === 'AUTH_LOADING') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.ink} />
      </View>
    );
  }

  if (shell === 'scanner_first_preview') {
    return <Redirect href={resolveShellLanding(shell, 'free')} />;
  }

  return <Redirect href={destination.route!} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
