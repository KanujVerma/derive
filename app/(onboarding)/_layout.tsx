import React from 'react';
import { Stack, useRouter, usePathname } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii } from '@/src/constants/theme';
import { Icon } from '@/src/components/ui/Icon';

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

  const isWelcome = pathname.includes('1-welcome');

  // Find active stage
  const matchedStage = STAGES.find((stage) =>
    stage.patterns.some((pat) => pathname.includes(pat))
  ) || STAGES[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
            onPress={() => router.replace('/(tabs)')}
            style={styles.closeButton}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Exit onboarding"
          >
            <Text style={styles.closeText}>Exit</Text>
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
