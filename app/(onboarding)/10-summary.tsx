import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useRoutineStore } from '@/src/stores/routineStore';
import { GoalLabels } from '@/src/types/schema';
import { generateRoutineProposal } from '@/src/services/ai-workflows/routine-generator';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { analytics } from '@/src/services/analytics';

export default function SummaryScreen() {
  const router = useRouter();
  const onboarding = useOnboardingStore();
  const { routine, userProducts } = useRoutineStore();
  const [isBuilding, setIsBuilding] = useState(false);

  const goalName = onboarding.primaryGoal
    ? GoalLabels[onboarding.primaryGoal].label
    : 'Breakouts';

  const handleBuildPlan = async () => {
    setIsBuilding(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Generate customized routine with KEEP/PAUSE/REPLACE/ADD
      const proposal = generateRoutineProposal(
        {
          primaryGoal: onboarding.primaryGoal || 'breakouts',
          routineComplexity: onboarding.routineComplexity,
          costPreference: onboarding.costPreference,
          middayFeel: onboarding.middayFeel,
        },
        onboarding.detectedProducts
      );

      // Save into routine store
      useRoutineStore.setState({
        routine: proposal.routine,
        userProducts: proposal.userProducts,
        todayDominantStatus: 'Everything looks on track. No changes today.',
      });

      onboarding.completeOnboarding();

      analytics.track('onboarding_completed', {
        productCount: onboarding.detectedProducts.length,
        hasReactionHistory: onboarding.productReactions.length > 0,
        hasPhotos: !!onboarding.frontPhotoUri,
      });

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      // Navigate to main application
      router.replace('/(tabs)');
    } catch (e) {
      console.warn('Plan generation error:', e);
    } finally {
      setIsBuilding(false);
    }
  };


  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.questionTitle}>Check that we got this right</Text>
        <Text style={styles.questionSubtitle}>
          Take a quick look before we build your plan.
        </Text>

        {/* SUMMARY CARD */}
        <View style={styles.summaryCard}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Primary Goal</Text>
            <Text style={styles.rowValue}>{goalName}</Text>
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Routine Preference</Text>
            <Text style={styles.rowValue}>
              {onboarding.routineComplexity.toUpperCase()} (3-4 steps)
            </Text>
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Product Cost</Text>
            <Text style={styles.rowValue}>
              {onboarding.costPreference.toUpperCase()}
            </Text>
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Skin Behavior</Text>
            <Text style={styles.rowValue}>
              {onboarding.middayFeel === 'combination'
                ? 'Combination (oily T-zone, dry cheeks)'
                : onboarding.middayFeel}
            </Text>
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Current Products</Text>
            <Text style={styles.rowValue}>
              {onboarding.detectedProducts.length} product{onboarding.detectedProducts.length === 1 ? '' : 's'} reviewed
            </Text>
          </View>

          {onboarding.productReactions.length > 0 && (
            <>
              <View style={styles.rowDivider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Past Reactions</Text>
                <Text style={styles.rowValue}>
                  {onboarding.productReactions.length} reaction{onboarding.productReactions.length === 1 ? '' : 's'} logged
                </Text>
              </View>
            </>
          )}

          <View style={styles.rowDivider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Current treatment</Text>
            <Text style={styles.rowValue}>
              {onboarding.activePrescriptions.join(', ') || 'None'}
            </Text>
          </View>
        </View>

        {/* HUMAN REVIEW NOTICE */}
        <View style={styles.founderBox}>
          <Icon name="person" size={20} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.founderTitle}>Human Verification</Text>
            <Text style={styles.founderText}>
              Your routine is human-checked before your first plan is activated.
            </Text>
          </View>
        </View>
      </ScrollView>


      <View style={styles.bottomBar}>
        <Button
          label={isBuilding ? 'Building Your Plan...' : 'Build My Plan'}
          variant="primary"
          size="large"
          loading={isBuilding}
          onPress={handleBuildPlan}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  questionTitle: {
    fontSize: typography.sizes.screenTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  questionSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.bodyRegular,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  rowLabel: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
    width: 110,
  },
  rowValue: {
    flex: 1,
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    textAlign: 'right',
  },

  rowDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.xxs,
  },
  founderBox: {
    flexDirection: 'row',
    backgroundColor: colors.brandLight,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand,
    gap: spacing.sm,
  },
  founderIcon: {
    fontSize: 20,
    color: colors.brand,
    marginTop: 2,
  },
  founderTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.bold,
    color: colors.brand,
    marginBottom: 2,
  },
  founderText: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
    lineHeight: typography.lineHeights.caption,
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.canvas,
  },
});
