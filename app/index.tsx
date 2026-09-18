import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useAuthStore } from '@/src/stores/authStore';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { colors } from '@/src/constants/theme';

export default function Index() {
  const isCompleted = useOnboardingStore((s) => s.isCompleted);
  const authStatus = useAuthStore((s) => s.status);
  const remoteEnabled = isRemoteServiceEnabled();

  // In Mock Mode, auth gating is bypassed completely
  if (!remoteEnabled) {
    if (isCompleted) {
      return <Redirect href="/(tabs)" />;
    }
    return <Redirect href="/(onboarding)/1-welcome" />;
  }

  // In Remote Mode, gate behind session state
  if (authStatus === 'INITIALIZING') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.ink} />
      </View>
    );
  }

  if (authStatus === 'SIGNED_OUT') {
    return <Redirect href="/(auth)/login" />;
  }

  // authStatus === 'SIGNED_IN'
  if (isCompleted) {
    return <Redirect href="/(tabs)" />;
  }
  return <Redirect href="/(onboarding)/1-welcome" />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
