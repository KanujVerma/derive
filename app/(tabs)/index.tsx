import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { useUserStore } from '@/src/stores/userStore';
import { useShopAudience } from '@/src/commerce/useShopAudience';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { Badge } from '@/src/components/ui/Badge';
import { InfoBanner } from '@/src/components/ui/InfoBanner';
import { analytics } from '@/src/services/analytics';
import {
  ensureInitialRoutineProposal,
  hydrateResearchInsights,
  hydrateOrders,
} from '@/src/services/deriveClient';

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    routine,
    userProducts,
    todayDominantStatus,
    isWeeklyCheckInDue,
    researchInsights,
    refillRequests,
    isPlanUnderReview,
    isRoutineBeingPrepared,
    planHydrationStatus,
    planHydrationError,
  } = useRoutineStore();
  const { fullName } = useUserStore();
  const firstName = fullName?.trim()?.split(' ')[0] || 'there';

  const isShopMember = useShopAudience() === 'member';
  const isPublished = routine?.status === 'published';
  const neededProducts = isShopMember && isPublished
    ? userProducts.filter((up) => up.action === 'ADD' && !up.isConfirmedByUser)
    : [];

  React.useEffect(() => {
    ensureInitialRoutineProposal().catch((e) => console.warn('Failed to ensure routine proposal:', e));
    if (researchInsights.length === 0) {
      hydrateResearchInsights().catch((e) => console.warn('Failed to hydrate research:', e));
    }
    if (refillRequests.length === 0) {
      hydrateOrders().catch((e) => console.warn('Failed to hydrate orders:', e));
    }
  }, []);

  const handleViewRoutine = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    analytics.track('routine_viewed', { source: 'today_cta' });
    router.push('/(tabs)/plan');
  };

  const handleCheckIn = () => {
    router.push('/check-in');
  };

  const pmSteps = routine?.pmSteps || [];
  const treatmentStep = pmSteps.find((s) => s.category === 'treatment');
  const tonightTitle = treatmentStep
    ? `${pmSteps.length} steps · ${treatmentStep.productName.split(' ')[0]} night`
    : pmSteps.length > 0
    ? `${pmSteps.length} evening steps`
    : 'No steps scheduled tonight';
  const tonightBadgeLabel = treatmentStep?.scheduleText
    ? treatmentStep.scheduleText.toUpperCase()
    : pmSteps.length > 0
    ? 'ACTIVE SCHEDULE'
    : 'STANDBY';

  const activeRefill = refillRequests.find(
    (r) => r.status === 'shipped' || r.status === 'ordered'
  );
  // Research surfaces on Today strictly when directly actionable (explaining a routine change or adaptation)
  // Non-actionable literature ('no_change') is omitted from Today to protect the 2-second glance
  const actionableResearch = researchInsights.find(
    (r) => r.recommendation === 'action' || (r.recommendation !== 'no_change' && !!r.recommendationReason)
  );

  const handleViewOrders = () => {
    router.push('/orders');
  };

  const handleViewInsight = (insightId: string) => {
    router.push(`/insights/${insightId}`);
  };

  const handleProfile = () => {
    router.push('/profile');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Clean Consumer Header with Profile Access */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.brandRow}>
            <Image
              source={require('@/assets/logo.png')}
              style={styles.logoMark}
              resizeMode="contain"
            />
            <Text style={styles.brandWordmark}>DERIVE</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={handleProfile}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Account and Settings"
          >
            <Icon name="person" size={18} color={colors.inkMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.greeting}>Good evening, {firstName}.</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* PREPARATION STATE WHILE ROUTINE IS BEING ASSEMBLED */}
        {isRoutineBeingPrepared ? (
          <View style={styles.reviewPendingContainer}>
            <View style={styles.statusSection}>
              <Text style={styles.statusHeadline}>
                Your routine is being prepared.
              </Text>
              <Text style={styles.statusSubtext}>
                We are calibrating your morning and evening steps to your skin profile and shelf products.
              </Text>
            </View>

            <View style={styles.draftTonightCard}>
              <View style={styles.tonightHeaderRow}>
                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                  <Badge label="PREPARING" variant="pause" size="small" />
                  <Text style={styles.draftTonightTitle}>
                    Initial Routine Setup
                  </Text>
                </View>
                <Icon name="sparkle" size={18} color={colors.brand} />
              </View>

              <Text style={styles.draftTonightExplanation}>
                {planHydrationStatus === 'error'
                  ? planHydrationError || "We couldn't refresh your routine right now. Please try again."
                  : "We're assembling your morning and evening steps. You'll be able to preview your draft routine as soon as it's ready."}
              </Text>

              {planHydrationStatus === 'error' && (
                <Button
                  label="Try Again"
                  variant="secondary"
                  size="small"
                  onPress={() => ensureInitialRoutineProposal().catch((e) => console.warn('Retry proposal error:', e))}
                  style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
                />
              )}
            </View>

            {/* WHAT YOU CAN DO WHILE PREPARING */}
            <View style={styles.reviewExplainerCard}>
              <Icon name="sparkle" size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewExplainerTitle}>
                  {isShopMember ? 'Everything else is ready' : 'Personalized Scan needs membership'}
                </Text>
                <Text style={styles.reviewExplainerText}>
                  {isShopMember
                    ? 'While we finish preparing your routine, you can scan bottles with camera recognition or ask Derive any skincare question.'
                    : 'Personalized Scan is available with an active Derive membership.'}
                </Text>
              </View>
            </View>
          </View>
        ) : isPlanUnderReview ? (
          <View style={styles.reviewPendingContainer}>
            {/* DOMINANT STATUS FOR REVIEW */}
            <View style={styles.statusSection}>
              <Text style={styles.statusHeadline}>
                Final review: Your first routine gets one final quality check before it goes live.
              </Text>
              <Text style={styles.statusSubtext}>
                We'll let you know as soon as it's ready. You can explore your draft routine below.
              </Text>
            </View>

            {/* PREVIEW DRAFT ROUTINE (Clearly Labeled DRAFT · NOT ACTIVE) */}
            <TouchableOpacity
              style={styles.draftTonightCard}
              activeOpacity={0.85}
              onPress={handleViewRoutine}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Draft routine preview, tap to view full proposed plan"
            >
              <View style={styles.tonightHeaderRow}>
                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                  <Badge label="DRAFT · NOT ACTIVE" variant="pause" size="small" />
                  <Text style={styles.draftTonightTitle}>
                    {routine?.summarySentence || 'Proposed routine schedule'}
                  </Text>
                </View>
                <Icon name="forward" size={16} color={colors.inkMuted} />
              </View>

              <Text style={styles.draftTonightExplanation}>
                {pmSteps.length} evening steps and {routine?.amSteps.length || 0} morning steps configured based on your shelf and skin goals.
              </Text>

              <View style={styles.cardFooterHint}>
                <Text style={styles.cardFooterText}>Preview draft routine</Text>
                <Icon name="forward" size={12} color={colors.brand} />
              </View>
            </TouchableOpacity>

            {/* WHAT YOU CAN DO WHILE IN REVIEW */}
            <View style={styles.reviewExplainerCard}>
              <Icon name="sparkle" size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewExplainerTitle}>
                  {isShopMember ? 'Everything else is ready' : 'Personalized Scan needs membership'}
                </Text>
                <Text style={styles.reviewExplainerText}>
                  {isShopMember
                    ? 'While we finish review, you can scan bottles with camera recognition or ask Derive any skincare question.'
                    : 'Personalized Scan is available with an active Derive membership.'}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            {/* DOMINANT STATUS (2-Second Grandma Test) */}
            <View style={styles.statusSection}>
              <Text style={styles.statusHeadline}>{todayDominantStatus}</Text>
              <Text style={styles.statusSubtext}>
                Your plan is calibrated to your skin. We'll let you know if anything needs attention.
              </Text>
            </View>

            {/* TONIGHT'S ROUTINE OR EMPTY SETUP CARD */}
            {!routine ? (
              <View style={styles.emptyPlanCard}>
                <View style={styles.emptyPlanIconCircle}>
                  <Icon name="sparkle" size={24} color={colors.brand} />
                </View>
                <Text style={styles.emptyPlanTitle}>No active routine yet</Text>
                <Text style={styles.emptyPlanText}>
                  Complete your skin profile and shelf audit to assemble your personalized morning and evening routine.
                </Text>
                <Button
                  label="Start Routine Setup"
                  variant="brand"
                  size="medium"
                  onPress={() => router.push('/(onboarding)/1-welcome')}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.tonightCard}
                activeOpacity={0.85}
                onPress={handleViewRoutine}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Tonight's routine, tap to view full plan"
              >
                <View style={styles.tonightHeaderRow}>
                  <View style={{ flex: 1, paddingRight: spacing.sm }}>
                    <Text style={styles.tonightOverline}>TONIGHT</Text>
                    <Text style={styles.tonightTitle}>
                      {tonightTitle}
                    </Text>
                  </View>
                  <View style={styles.badgeChevronRow}>
                    <Badge label={tonightBadgeLabel} variant="keep" size="small" />
                    <Icon name="forward" size={14} color={colors.inkMuted} style={{ marginLeft: 6 }} />
                  </View>
                </View>

                {/* Simple step sequence */}
                <View style={styles.stepSequence}>
                  {pmSteps.map((step, idx) => (
                    <React.Fragment key={step.id}>
                      <View style={styles.stepNode}>
                        <Text style={styles.stepNodeName}>{step.productName}</Text>
                        <Text style={styles.stepNodeBrand}>{step.brand}</Text>
                      </View>
                      {idx < pmSteps.length - 1 && (
                        <View style={styles.sequenceArrow}>
                          <Icon name="forward" size={14} color={colors.inkSubtle} />
                        </View>
                      )}
                    </React.Fragment>
                  ))}
                </View>

                <View style={styles.cardFooterHint}>
                  <Text style={styles.cardFooterText}>View routine details</Text>
                  <Icon name="forward" size={12} color={colors.brand} />
                </View>
              </TouchableOpacity>
            )}

            {/* CONTEXTUAL MODULE 1: WEEKLY CHECK-IN DUE */}
            {isWeeklyCheckInDue && (
              <View style={styles.contextCard}>
                <View style={styles.contextCardContent}>
                  <Text style={styles.contextTitle}>Weekly Check-in Due</Text>
                  <Text style={styles.contextSub}>
                    Takes about 30 seconds. Checks on your barrier comfort and plan adherence.
                  </Text>
                </View>
                <Button
                  label="Check In"
                  variant="brand"
                  size="medium"
                  onPress={handleCheckIn}
                />
              </View>
            )}

            {/* CONTEXTUAL MODULE 2: REFILL / SHIPMENT TRACKING */}
            {activeRefill && (
              <View style={styles.refillBanner}>
                <View style={styles.refillIconCircle}>
                  <Icon name="shipping" size={18} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.refillTitle}>
                    {activeRefill.status === 'shipped' ? 'YOUR REFILL SHIPPED' : 'REFILL ORDERED'}
                  </Text>
                  <Text style={styles.refillProductName}>
                    {activeRefill.brand} {activeRefill.productName}
                  </Text>
                  <Text style={styles.refillEta}>
                    {activeRefill.estimatedDelivery ? `Arrives ${activeRefill.estimatedDelivery}` : 'Processing order'}
                  </Text>
                </View>
                <Button
                  label="Track"
                  variant="secondary"
                  size="small"
                  onPress={handleViewOrders}
                />
              </View>
            )}

            {/* CONTEXTUAL MODULE: NEEDED PRODUCTS IN PLAN */}
            {neededProducts.length === 1 && (
              <View style={styles.shopNeededBanner}>
                <View style={styles.shopNeededIconCircle}>
                  <Icon name="bottle" size={18} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shopNeededOverline}>YOUR PLAN NEEDS ONE PRODUCT</Text>
                  <Text style={styles.shopNeededTitle} numberOfLines={1}>
                    {neededProducts[0].product.name}
                  </Text>
                  <Text style={styles.shopNeededSub}>Recommended addition</Text>
                </View>
                <Button
                  label="Review product"
                  variant="secondary"
                  size="small"
                  onPress={() => router.push(`/shop/${neededProducts[0].productId}` as any)}
                />
              </View>
            )}

            {neededProducts.length > 1 && (
              <View style={styles.shopNeededBanner}>
                <View style={styles.shopNeededIconCircle}>
                  <Icon name="shop" size={18} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shopNeededOverline}>
                    YOUR PLAN NEEDS {neededProducts.length} PRODUCTS
                  </Text>
                  <Text style={styles.shopNeededSub}>Recommended additions for your active routine</Text>
                </View>
                <Button
                  label="Review in Shop"
                  variant="secondary"
                  size="small"
                  onPress={() => router.push('/(tabs)/shop')}
                />
              </View>
            )}

            {/* CONTEXTUAL MODULE 3: ACTIONABLE RESEARCH CARD (Surfaces only on active change) */}
            {actionableResearch && (
              <View style={styles.researchCard}>
                <View style={styles.researchHeader}>
                  <View style={styles.researchBadge}>
                    <Icon name="sparkle" size={12} color={colors.brand} />
                    <Text style={styles.researchBadgeText}>ROUTINE INSIGHT</Text>
                  </View>
                  <Badge label="ACTION RECOMMENDED" variant="pause" size="small" />
                </View>

                <Text style={styles.researchTitle}>
                  {actionableResearch.title}
                </Text>
                <Text style={styles.researchSummary}>
                  {actionableResearch.summary}
                </Text>

                <TouchableOpacity
                  style={styles.seeWhyRow}
                  onPress={() => handleViewInsight(actionableResearch.id)}
                >
                  <Text style={styles.seeWhyText}>See why</Text>
                  <Icon name="forward" size={14} color={colors.brand} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  logoMark: {
    width: 16,
    height: 16,
  },
  brandWordmark: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    letterSpacing: 2,
    color: colors.brand,
  },
  greeting: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  statusSection: {
    paddingVertical: spacing.xs,
  },
  statusHeadline: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: 4,
  },
  statusSubtext: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: 22,
  },
  emptyPlanCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    textAlign: 'center',
    ...shadows.subtle,
  },
  emptyPlanIconCircle: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyPlanTitle: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyPlanText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  tonightCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.subtle,
  },
  tonightHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  tonightOverline: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
    color: colors.inkMuted,
    marginBottom: 2,
  },
  tonightTitle: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  stepSequence: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  stepNode: {
    paddingVertical: 2,
  },
  stepNodeName: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  stepNodeBrand: {
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
  },
  sequenceArrow: {
    paddingHorizontal: 2,
  },
  badgeChevronRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardFooterHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: spacing.xs,
  },
  cardFooterText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandLight,
    padding: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.sm,
  },
  contextCardContent: {
    flex: 1,
  },
  contextTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: 2,
  },
  contextSub: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 18,
  },
  refillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.subtle,
  },
  refillIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refillTitle: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.brand,
    marginBottom: 2,
  },
  refillProductName: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  refillEta: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  shopNeededBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.subtle,
  },
  shopNeededIconCircle: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopNeededOverline: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.brand,
    marginBottom: 2,
  },
  shopNeededTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  shopNeededSub: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  researchCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.subtle,
  },
  researchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  researchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  researchBadgeText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.brand,
  },
  researchTitle: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: 4,
  },
  researchSummary: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  seeWhyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  seeWhyText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  reviewPendingContainer: {
    gap: spacing.md,
  },
  draftTonightCard: {
    backgroundColor: colors.surface,
    borderColor: colors.actionPause.border,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.subtle,
  },
  draftTonightTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
    marginTop: spacing.xs,
  },
  draftTonightExplanation: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  reviewExplainerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.brandLight,
    padding: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.sm,
  },
  reviewExplainerTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    color: colors.brandDark,
    marginBottom: 2,
  },
  reviewExplainerText: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
    lineHeight: 18,
  },
});
