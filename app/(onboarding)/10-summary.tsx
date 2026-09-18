import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useRoutineStore } from '@/src/stores/routineStore';
import { GoalLabels } from '@/src/types/schema';
import { submitOnboarding } from '@/src/services/deriveClient';
import { useUserStore } from '@/src/stores/userStore';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { Icon } from '@/src/components/ui/Icon';
import { Badge } from '@/src/components/ui/Badge';
import { InfoBanner } from '@/src/components/ui/InfoBanner';
import { StickyActionFooter } from '@/src/components/ui/StickyActionFooter';
import { analytics } from '@/src/services/analytics';
import { calculateMonthlyPlanPrice, formatCentsToDollars } from '@/src/pricing';
import { config } from '@/src/constants/config';
import { getCustomerErrorMessage } from '@/src/utils/customerErrors';
import type { OnboardingPayload } from '@/src/domain/types';

export default function SummaryScreen() {
  const router = useRouter();
  const onboarding = useOnboardingStore();
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goalName = onboarding.primaryGoal
    ? GoalLabels[onboarding.primaryGoal].label
    : 'Breakouts';

  // Provisional monthly pricing estimate based on detected products + care fee
  const pricingEstimate = useMemo(() => {
    return calculateMonthlyPlanPrice(onboarding.detectedProducts);
  }, [onboarding.detectedProducts]);

  const handleBuildPlan = async () => {
    setIsBuilding(true);
    setError(null);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      const payload: OnboardingPayload = {
        userId: useUserStore.getState().userId || 'usr_beta_member',
        primaryGoal: onboarding.primaryGoal || 'breakouts',
        secondaryGoals: onboarding.secondaryGoals || [],
        routineComplexity: onboarding.routineComplexity || 'simple',
        costPreference: onboarding.costPreference || 'balanced',
        middayFeel: onboarding.middayFeel || 'combination',
        postCleanseTightness: onboarding.postCleanseTightness ?? false,
        confirmedProducts: onboarding.detectedProducts,
        productReactions: onboarding.productReactions,
        skinPhotos: {
          frontUri: onboarding.frontPhotoUri || undefined,
          leftUri: onboarding.leftPhotoUri || undefined,
          rightUri: onboarding.rightPhotoUri || undefined,
          contextNote: onboarding.photoContextNote || undefined,
        },
        safetyContext: {
          knownSensitivities: onboarding.knownSensitivities,
          activePrescriptions: onboarding.activePrescriptions,
          isPregnantOrNursing: onboarding.isPregnantOrNursing,
          additionalNotes: onboarding.additionalSafetyNotes || undefined,
        },
      };

      await submitOnboarding(payload);

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
    } catch (e: any) {
      console.warn('Plan generation error:', e);
      setError(getCustomerErrorMessage('onboarding'));
    } finally {
      setIsBuilding(false);
    }
  };

  const renderAuditRow = (
    label: string,
    value: string,
    editRoute: string
  ) => (
    <View style={styles.auditRow}>
      <View style={styles.auditInfo}>
        <Text style={styles.auditLabel}>{label}</Text>
        <Text style={styles.auditValue}>{value}</Text>
      </View>
      <TouchableOpacity
        onPress={() => router.push(editRoute as any)}
        style={styles.editButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={`Edit ${label}`}
        accessibilityRole="button"
      >
        <Text style={styles.editText}>Edit</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.questionTitle}>Review & Final Details</Text>
        <Text style={styles.questionSubtitle}>
          Review your inputs. You can tap Edit to adjust any section before we assemble your plan.
        </Text>

        {/* FOUNDING BETA MEMBERSHIP CARD */}
        <View style={styles.pricingCard}>
          <View style={styles.pricingHeaderRow}>
            <View>
              <Text style={styles.pricingBadge}>FOUNDING BETA MEMBERSHIP</Text>
              <View style={styles.priceRow}>
                <Text style={styles.pricingAmount}>
                  ${config.betaPriceMonthly}
                </Text>
                <Text style={styles.pricingCadence}>/month</Text>
              </View>
            </View>
            <Badge label="FIRST 10 MEMBERS" variant="keep" size="small" />
          </View>
          <Text style={styles.pricingSubtext}>
            Covers Derive care management plus all standard OTC products in your approved routine.
          </Text>

          <View style={styles.pricingDivider} />

          <View style={styles.includesBlock}>
            <Text style={styles.includesHeading}>Includes:</Text>
            <Text style={styles.includesItem}>• Weekly check-ins, ongoing routine management & adjustments when needed</Text>
            <Text style={styles.includesItem}>• Standard OTC routine products included</Text>
            <Text style={styles.includesItem}>• Managed replenishment as you run low</Text>
          </View>
        </View>

        {/* AUDIT GROUPED SECTIONS WITH DIRECT EDIT LINKS */}
        <GroupedSection header="Preferences & Goals">
          {renderAuditRow('Primary Goal', goalName, '/(onboarding)/2-goals')}
          {renderAuditRow(
            'Routine Scale',
            onboarding.routineComplexity === 'simple'
              ? 'Simple (3–4 steps)'
              : onboarding.routineComplexity === 'balanced'
              ? 'Balanced (4–5 steps)'
              : onboarding.routineComplexity === 'maximize'
              ? 'More Involved'
              : 'Simple (3–4 steps)',
            '/(onboarding)/3-complexity'
          )}
          {renderAuditRow(
            'Cost Preference',
            onboarding.costPreference
              ? onboarding.costPreference.charAt(0).toUpperCase() + onboarding.costPreference.slice(1)
              : 'Balanced',
            '/(onboarding)/4-budget'
          )}
        </GroupedSection>

        <GroupedSection header="Skin Observations">
          {renderAuditRow(
            'Midday Feel',
            onboarding.middayFeel === 'combination'
              ? 'Combination (oily T-zone, dry cheeks)'
              : onboarding.middayFeel === 'dry_tight'
              ? 'Dry or tight'
              : onboarding.middayFeel === 'comfortable'
              ? 'Comfortable'
              : onboarding.middayFeel === 'oily_shiny'
              ? 'Oily all over'
              : 'Normal / combination',
            '/(onboarding)/5-behavior'
          )}
          {renderAuditRow(
            'Post-Wash Feel',
            onboarding.postCleanseTightness ? 'Often tight or squeaky' : 'Normal / comfortable',
            '/(onboarding)/5-behavior'
          )}
          {onboarding.pihTendencyAnswer && (
            renderAuditRow(
              'Dark Mark Response',
              `${onboarding.pihTendencyAnswer} leaves persistent dark marks`,
              '/(onboarding)/9-clarification'
            )
          )}
        </GroupedSection>

        <GroupedSection header="Counter Products & Reactions">
          {renderAuditRow(
            'Current Shelf',
            `${onboarding.detectedProducts.length} product${onboarding.detectedProducts.length === 1 ? '' : 's'} reviewed`,
            '/(onboarding)/6-shelf'
          )}
          {renderAuditRow(
            'Past Reactions',
            onboarding.productReactions.length > 0
              ? `${onboarding.productReactions.length} reaction${onboarding.productReactions.length === 1 ? '' : 's'} logged`
              : 'None reported',
            '/(onboarding)/reaction-history'
          )}
        </GroupedSection>

        <GroupedSection header="Safety & Prescriptions">
          {renderAuditRow(
            'Active Prescriptions',
            onboarding.activePrescriptions.join(', ') || 'None',
            '/(onboarding)/8-safety'
          )}
          {renderAuditRow(
            'Pregnancy / Nursing',
            onboarding.pregnancyStatus === 'yes'
              ? 'Yes'
              : onboarding.pregnancyStatus === 'prefer_not_to_say'
              ? 'Prefer not to say'
              : 'No',
            '/(onboarding)/8-safety'
          )}
        </GroupedSection>

        {error && (
          <View style={styles.errorNoticeBox}>
            <Icon name="warning" size={20} color={colors.actionStop.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorNoticeTitle}>Unable to build routine</Text>
              <Text style={styles.errorNoticeText}>{error}</Text>
            </View>
          </View>
        )}

        {/* FINAL QUALITY REVIEW NOTICE */}
        <View style={styles.reviewNoticeBox}>
          <Icon name="check" size={20} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.reviewNoticeTitle}>Final Review</Text>
            <Text style={styles.reviewNoticeText}>
              Your first routine gets one final quality check before it goes live. You can explore your plan, Ask questions, and use Scan while we prepare your routine.
            </Text>
          </View>
        </View>
      </ScrollView>

      <StickyActionFooter
        ctaLabel={isBuilding ? 'Building Your Plan...' : 'Build My Plan'}
        onPressCta={handleBuildPlan}
        loading={isBuilding}
      />
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
    paddingBottom: spacing.xxl + 100,
  },
  questionTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  questionSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.bodyRegular,
    marginBottom: spacing.md,
  },
  pricingCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  pricingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  pricingBadge: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.brand,
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  pricingAmount: {
    fontSize: typography.sizes.screenTitle,
    fontFamily: typography.fontFamilies.serif,
    color: colors.ink,
  },
  pricingCadence: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    marginLeft: 2,
  },
  pricingSubtext: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.caption,
    marginTop: spacing.xxs,
  },
  pricingDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.sm,
  },
  includesBlock: {
    paddingVertical: 2,
    gap: 4,
  },
  includesHeading: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: 2,
  },
  includesItem: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.caption,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  auditInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  auditLabel: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginBottom: 2,
  },
  auditValue: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  editText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  errorNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.actionStop.bg,
    borderColor: colors.actionStop.border,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  errorNoticeTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    color: colors.actionStop.text,
    marginBottom: 2,
  },
  errorNoticeText: {
    fontSize: typography.sizes.micro,
    color: colors.actionStop.text,
    lineHeight: typography.lineHeights.caption,
  },
  reviewNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.brandLight,
    padding: spacing.md,
    borderRadius: radii.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  reviewNoticeTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    color: colors.brand,
    marginBottom: 2,
  },
  reviewNoticeText: {
    fontSize: typography.sizes.micro,
    color: colors.ink,
    lineHeight: typography.lineHeights.caption,
  },
});
