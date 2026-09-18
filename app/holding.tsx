import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii } from '@/src/constants/theme';
import { signOutSession } from '@/src/services/authClient';
import { useAuthStore } from '@/src/stores/authStore';
import { useBootstrapStore } from '@/src/stores/bootstrapStore';
import { resolveCustomerBootstrap } from '@/src/services/deriveClient';
import { getCustomerErrorMessage } from '@/src/utils/customerErrors';

export default function HoldingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const sessionUserId = useAuthStore((s) => s.sessionUserId);
  const status = useBootstrapStore((s) => s.status);
  const errorMessage = useBootstrapStore((s) => s.errorMessage);

  const isError = status === 'ERROR';

  const handleRetry = async () => {
    if (retrying || !sessionUserId) return;
    setRetrying(true);
    await resolveCustomerBootstrap(sessionUserId);
    setRetrying(false);
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const result = await signOutSession();
    setSigningOut(false);

    if (result.success) {
      router.replace('/(auth)/login');
    } else {
      Alert.alert(
        'Sign Out',
        result.error || getCustomerErrorMessage('auth_signout'),
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.xxl,
          paddingBottom: Math.max(insets.bottom, spacing.xl),
        },
      ]}
    >
      <View style={styles.centerContent}>
        <Image
          source={require('@/assets/logo.png')}
          style={styles.logoMark}
          resizeMode="contain"
        />

        <Text style={styles.title}>
          {isError ? "We couldn't finish loading your account" : 'Finishing your setup…'}
        </Text>
        <Text style={styles.subtitle}>
          {isError
            ? errorMessage || getCustomerErrorMessage('bootstrap')
            : 'Preparing your profile and personal routine workspace.'}
        </Text>

        {!isError && (
          <View style={styles.spinnerContainer}>
            <ActivityIndicator size="small" color={colors.ink} />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {isError && (
          <TouchableOpacity
            onPress={handleRetry}
            disabled={retrying}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            {retrying ? (
              <ActivityIndicator size="small" color={colors.canvas} />
            ) : (
              <Text style={styles.retryButtonText}>Try Again</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleSignOut}
          disabled={signingOut}
          style={styles.signOutButton}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: {
    width: 48,
    height: 48,
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 280,
  },
  spinnerContainer: {
    marginTop: spacing.xxl,
  },
  footer: {
    alignItems: 'center',
  },
  signOutButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  signOutText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },
  retryButton: {
    minHeight: 44,
    minWidth: 140,
    backgroundColor: colors.ink,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  retryButtonText: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.medium,
    color: colors.canvas,
  },
});
