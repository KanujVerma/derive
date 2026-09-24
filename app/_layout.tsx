import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, Platform, View, ActivityIndicator, StyleSheet, Text, Pressable } from 'react-native';
import { colors } from '@/src/constants/theme';
import { KeyboardDoneBar } from '@/src/components/ui/KeyboardDoneBar';
import { useAuthStore } from '@/src/stores/authStore';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useBootstrapStore } from '@/src/stores/bootstrapStore';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { startAuthAutoRefresh, stopAuthAutoRefresh } from '@/src/services/supabase';
import { ensureLocalAnonymousSession, getCurrentSession, subscribeToAuth } from '@/src/services/authClient';
import { getFreeAccessState } from '@/src/services/remote/freeAccess';
import { useFreeAccessStore } from '@/src/stores/freeAccessStore';
import { publicEnvironment } from '@/src/config/environment';
import { resolveShellPresentation } from '@/src/utils/shellPresentation';
import { resolveLocalAccessRoute } from '@/src/utils/localAccessRouting';
import { refreshCustomerBootstrap, resolveCustomerBootstrap } from '@/src/services/deriveClient';
import { resolveAuthRoute, getAuthRedirectRoute } from '@/src/utils/authRouting';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const authStatus = useAuthStore((s) => s.status);
  const sessionUserId = useAuthStore((s) => s.sessionUserId);
  const isOnboardingCompleted = useOnboardingStore((s) => s.isCompleted);
  const profileResolution = useBootstrapStore((s) => s.status);
  const resolvedUserId = useBootstrapStore((s) => s.resolvedUserId);
  const bootstrapState = useBootstrapStore((s) => s.bootstrapState);
  const bootstrapRefreshing = useBootstrapStore((s) => s.isRefreshing);
  const remoteEnabled = isRemoteServiceEnabled();
  const shell = resolveShellPresentation({ buildFlavor: publicEnvironment.buildFlavor, remoteEnabled, supabaseUrl: publicEnvironment.supabaseUrl });
  const localFreeIntegration = shell === 'local_free_integration';
  const accessStatus = useFreeAccessStore((s) => s.status);
  const accessUserId = useFreeAccessStore((s) => s.userId);
  const access = useFreeAccessStore((s) => s.access);
  const [authError, setAuthError] = useState(false);
  const localReady = localFreeIntegration && accessStatus === 'READY' && accessUserId === sessionUserId && access?.userId === sessionUserId;
  const managedAccess = localReady && access?.managedAccess === true;
  const destination = resolveAuthRoute({
    remoteEnabled,
    authStatus,
    isOnboardingCompleted,
    profileResolution,
    sessionUserId,
    resolvedUserId,
    bootstrapState,
    bootstrapRefreshing,
  });
  const redirectRoute = getAuthRedirectRoute(segments, destination);

  // Handle AppState changes for Supabase token auto-refresh in remote mode
  useEffect(() => {
    if (!remoteEnabled) return;

    let previousAppState = AppState.currentState;
    let lastForegroundRefreshAt = 0;
    const refreshEstablishedMembership = () => {
      if (localFreeIntegration) {
        const auth = useAuthStore.getState();
        const projection = useFreeAccessStore.getState();
        if (auth.status === 'SIGNED_IN' && projection.status === 'READY' && projection.userId === auth.sessionUserId) {
          projection.reset();
        }
        return;
      }
      const auth = useAuthStore.getState();
      const bootstrap = useBootstrapStore.getState();
      if (
        auth.status !== 'SIGNED_IN' || !auth.sessionUserId ||
        bootstrap.resolvedUserId !== auth.sessionUserId || !bootstrap.bootstrapState ||
        (bootstrap.status !== 'READY' && bootstrap.status !== 'NEEDS_ONBOARDING')
      ) return;
      const now = Date.now();
      if (now - lastForegroundRefreshAt < 1500) return;
      lastForegroundRefreshAt = now;
      void refreshCustomerBootstrap(auth.sessionUserId);
    };

    if (AppState.currentState === 'active') {
      startAuthAutoRefresh();
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startAuthAutoRefresh();
        if (previousAppState !== 'active') refreshEstablishedMembership();
      } else {
        stopAuthAutoRefresh();
      }
      previousAppState = state;
    });

    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshEstablishedMembership();
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', refreshEstablishedMembership);
      document.addEventListener('visibilitychange', onVisible);
    }

    return () => {
      sub.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', refreshEstablishedMembership);
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, [remoteEnabled, localFreeIntegration, managedAccess]);

  // Initialize session and subscribe to auth changes in remote mode
  useEffect(() => {
    if (!remoteEnabled) return;

    if (!localFreeIntegration) void getCurrentSession();
    const { unsubscribe } = subscribeToAuth();
    return () => unsubscribe();
  }, [remoteEnabled, localFreeIntegration]);

  // Only the local development integration may silently create a guest session.
  useEffect(() => {
    if (!localFreeIntegration || authError || accessStatus === 'ERROR') return;
    if (authStatus !== 'INITIALIZING' && authStatus !== 'SIGNED_OUT') return;
    void ensureLocalAnonymousSession().then(() => setAuthError(false)).catch(() => setAuthError(true));
  }, [localFreeIntegration, authStatus, accessStatus, authError]);

  useEffect(() => {
    if (!localFreeIntegration || authStatus !== 'SIGNED_IN' || !sessionUserId) return;
    if (accessUserId === sessionUserId && (accessStatus === 'RESOLVING' || accessStatus === 'READY' || accessStatus === 'ERROR')) return;
    const attempt = useFreeAccessStore.getState().start(sessionUserId);
    void getFreeAccessState().then((state) => {
      if (state.userId !== sessionUserId) throw new Error('Access state belongs to another session');
      useFreeAccessStore.getState().ready(state, attempt);
    }).catch(() => useFreeAccessStore.getState().fail(sessionUserId, attempt));
  }, [localFreeIntegration, authStatus, sessionUserId, accessStatus, accessUserId]);

  // Trigger remote bootstrap resolution when signed in
  useEffect(() => {
    if (!remoteEnabled || (localFreeIntegration && !managedAccess)) return;
    if (authStatus !== 'SIGNED_IN' || !sessionUserId) return;

    // Trigger resolution when unresolved or on identity transition
    if (profileResolution === 'UNRESOLVED' || resolvedUserId !== sessionUserId) {
      resolveCustomerBootstrap(sessionUserId);
    }
  }, [remoteEnabled, localFreeIntegration, managedAccess, authStatus, sessionUserId, profileResolution, resolvedUserId]);

  // Route gating in remote mode
  useEffect(() => {
    if (!remoteEnabled) return;
    if (localFreeIntegration) {
      if (!localReady || !access) return;
      const route = resolveLocalAccessRoute(segments, access);
      if (route) router.replace(route);
      return;
    }
    if (authStatus !== 'INITIALIZING' && redirectRoute) router.replace(redirectRoute as any);
  }, [remoteEnabled, localFreeIntegration, localReady, access, segments, authStatus, redirectRoute]);

  if (localFreeIntegration && (authError || accessStatus === 'ERROR')) {
    return <SafeAreaProvider><View style={styles.loadingContainer}>
      <Text style={styles.errorText}>Derive could not connect. Please try again.</Text>
      <Pressable accessibilityRole="button" onPress={() => { setAuthError(false); useFreeAccessStore.getState().reset(); }}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View></SafeAreaProvider>;
  }

  if ((localFreeIntegration && !localReady) || (remoteEnabled && authStatus === 'INITIALIZING')) {
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
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Protected guard={!localFreeIntegration && (!remoteEnabled || destination.type === 'AUTH_LOGIN')}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!localFreeIntegration && remoteEnabled && destination.type === 'REMOTE_HOLDING'}>
          <Stack.Screen name="holding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!localFreeIntegration && remoteEnabled && destination.type === 'REMOTE_MEMBERSHIP'}>
          <Stack.Screen name="membership/index" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={localFreeIntegration ? managedAccess : (!remoteEnabled || destination.type === 'REMOTE_ONBOARDING')}>
          <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={localFreeIntegration ? localReady : (!remoteEnabled || destination.type === 'REMOTE_TABS')}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="profile/index" options={{ headerShown: false }} />
          <Stack.Screen name="shop/scan" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={localFreeIntegration ? managedAccess : (!remoteEnabled || destination.type === 'REMOTE_TABS')}>
          <Stack.Screen name="orders/index" options={{ headerShown: false }} />
          <Stack.Screen name="insights/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="shop/[productId]" options={{ headerShown: false }} />
          <Stack.Screen name="check-in/index" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="refill/index" options={{ presentation: 'modal', headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!remoteEnabled}>
          <Stack.Screen name="founder/index" options={{ headerShown: false }} />
          <Stack.Screen name="founder/review-routine" options={{ headerShown: false }} />
          <Stack.Screen name="founder/refills" options={{ headerShown: false }} />
        </Stack.Protected>
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
  errorText: { color: colors.ink, marginBottom: 16 },
  retryText: { color: colors.brand, fontWeight: '600' },
});
