import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useAuthStore } from '@/src/stores/authStore';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { resolveAuthRoute } from '@/src/utils/authRouting';
import { colors } from '@/src/constants/theme';

export default function Index() {
  const isCompleted = useOnboardingStore((s) => s.isCompleted);
  const authStatus = useAuthStore((s) => s.status);
  const remoteEnabled = isRemoteServiceEnabled();

  const destination = resolveAuthRoute({
    remoteEnabled,
    authStatus,
    isOnboardingCompleted: isCompleted,
  });

  if (destination.type === 'AUTH_LOADING') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.ink} />
      </View>
    );
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
