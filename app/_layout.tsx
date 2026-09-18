import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '@/src/constants/theme';
import { KeyboardDoneBar } from '@/src/components/ui/KeyboardDoneBar';
import { useAuthStore } from '@/src/stores/authStore';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { startAuthAutoRefresh, stopAuthAutoRefresh } from '@/src/services/supabase';
import { getCurrentSession, subscribeToAuth } from '@/src/services/authClient';
import { resolveAuthRoute } from '@/src/utils/authRouting';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const authStatus = useAuthStore((s) => s.status);
  const remoteEnabled = isRemoteServiceEnabled();

  // Handle AppState changes for Supabase token auto-refresh in remote mode
  useEffect(() => {
    if (!remoteEnabled) return;

    if (AppState.currentState === 'active') {
      startAuthAutoRefresh();
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startAuthAutoRefresh();
      } else {
        stopAuthAutoRefresh();
      }
    });

    return () => sub.remove();
  }, [remoteEnabled]);

  // Initialize session and subscribe to auth changes in remote mode
  useEffect(() => {
    if (!remoteEnabled) return;

    getCurrentSession();
    const { unsubscribe } = subscribeToAuth();
    return () => unsubscribe();
  }, [remoteEnabled]);

  // Route gating in remote mode
  useEffect(() => {
    if (!remoteEnabled) return;
    if (authStatus === 'INITIALIZING') return;

    const inAuthGroup = segments[0] === '(auth)';
    const destination = resolveAuthRoute({
      remoteEnabled,
      authStatus,
      isOnboardingCompleted: useOnboardingStore.getState().isCompleted,
    });

    if (destination.type === 'AUTH_LOGIN' && !inAuthGroup) {
      router.replace(destination.route!);
    } else if (destination.type === 'REMOTE_HOLDING' && inAuthGroup) {
      router.replace(destination.route!);
    }
  }, [remoteEnabled, authStatus, segments]);

  if (remoteEnabled && authStatus === 'INITIALIZING') {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.ink} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <KeyboardDoneBar />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="holding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen
          name="check-in/index"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="refill/index"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="founder/index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="founder/review-routine"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="founder/refills"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
