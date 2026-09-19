import React from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { Alert, Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii } from '@/src/constants/theme';
import { Icon } from '@/src/components/ui/Icon';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { signOutSession } from '@/src/services/authClient';

const STAGES = [
  { index: 1, name: 'Goals', patterns: ['2-goals'] },
  { index: 2, name: 'Preferences', patterns: ['3-complexity', '4-budget'] },
  { index: 3, name: 'Your Skin', patterns: ['5-behavior'] },
  { index: 4, name: 'Products & Safety', patterns: ['6-shelf', 'reaction-history', '8-safety'] },
  { index: 5, name: 'Photos', patterns: ['7-skin-photos'] },
  { index: 6, name: 'Review', patterns: ['9-clarification', '10-summary'] },
];

export default function OnboardingLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const remoteEnabled = isRemoteServiceEnabled();

  const isWelcome = pathname.includes('1-welcome');

  const handleExit = async () => {
    if (!remoteEnabled) {
      router.replace('/(tabs)');
      return;
    }
    const result = await signOutSession();
    if (result.success) {
      router.replace('/(auth)/login');
    } else if (Platform.OS === 'web') {
      window.alert(result.error || 'Sign out could not be completed.');
    } else {
      Alert.alert('Sign Out', result.error || 'Sign out could not be completed.');
    }
  };

  // Find active stage
  const matchedStage = STAGES.find((stage) =>
    stage.patterns.some((pat) => pathname.includes(pat))
  ) || STAGES[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {isWelcome && remoteEnabled && (
        <TouchableOpacity
          onPress={() => void handleExit()}
          style={styles.welcomeSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.closeText}>Sign Out</Text>
        </TouchableOpacity>
      )}
      {/* Top Header with 6 Perceived Stages (hidden on clean welcome screen) */}
      {!isWelcome && (
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon name="back" size={20} color={colors.ink} />
          </TouchableOpacity>

          <View style={styles.progressContainer}>
            {/* 6 Stage Segment Bars */}
            <View style={styles.segmentTrack}>
              {STAGES.map((s) => {
                const isPassed = s.index < matchedStage.index;
                const isCurrent = s.index === matchedStage.index;
                return (
                  <View
                    key={s.index}
                    style={[
                      styles.segmentBar,
                      isPassed && styles.segmentBarFilled,
                      isCurrent && styles.segmentBarActive,
                    ]}
                  />
                );
              })}
            </View>
            <Text style={styles.stageLabel}>
              {matchedStage.index} of 6 • {matchedStage.name}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => void handleExit()}
            style={styles.closeButton}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={remoteEnabled ? 'Sign out' : 'Exit onboarding'}
          >
            <Text style={styles.closeText}>{remoteEnabled ? 'Sign Out' : 'Exit'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Screens */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'slide_from_right',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  welcomeSignOut: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    zIndex: 1,
    padding: spacing.sm,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  progressContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  segmentTrack: {
    flexDirection: 'row',
    width: '100%',
    gap: 4,
    marginBottom: 6,
  },
  segmentBar: {
    flex: 1,
    height: 3,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.full,
  },
  segmentBarFilled: {
    backgroundColor: colors.brand,
  },
  segmentBarActive: {
    backgroundColor: colors.brand,
    opacity: 0.85,
  },
  stageLabel: {
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
    letterSpacing: 0.3,
  },
  closeButton: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  closeText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
});
