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
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { Badge } from '@/src/components/ui/Badge';
import { analytics } from '@/src/services/analytics';

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    routine,
    todayDominantStatus,
    isWeeklyCheckInDue,
    researchInsights,
    refillRequests,
  } = useRoutineStore();
  const { fullName } = useUserStore();
  const firstName = fullName?.trim()?.split(' ')[0] || 'there';

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
  const activeRefill = refillRequests.find(
    (r) => r.status === 'shipped' || r.status === 'ordered'
  );
  const topResearch = researchInsights[0];

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
        {/* DOMINANT STATUS (2-Second Grandma Test) */}
        <View style={styles.statusSection}>
          <Text style={styles.statusHeadline}>{todayDominantStatus}</Text>
          <Text style={styles.statusSubtext}>
            Your plan is calibrated to your skin. We'll let you know if anything needs attention.
          </Text>
        </View>

        {/* TONIGHT'S ROUTINE SUMMARY CARD */}
        <View style={styles.tonightCard}>
          <View style={styles.tonightHeaderRow}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text style={styles.tonightOverline}>TONIGHT</Text>
              <Text style={styles.tonightTitle}>
                {pmSteps.length} steps · Differin night
              </Text>
            </View>
            <Badge label="MON / WED / FRI" variant="keep" size="small" />
          </View>

          {/* Simple step sequence: Cleanser → Differin → Moisturizer */}
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

          <Button
            label="View Routine"
            variant="primary"
            size="medium"
            onPress={handleViewRoutine}
            style={styles.viewRoutineButton}
          />
        </View>

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

        {/* CONTEXTUAL MODULE 3: COMPACT RESEARCH CARD ("NEW FOR YOU") */}
        {topResearch && (
          <View style={styles.researchCard}>
            <View style={styles.researchHeader}>
              <View style={styles.researchBadge}>
                <Icon name="sparkle" size={12} color={colors.brand} />
                <Text style={styles.researchBadgeText}>NEW FOR YOU</Text>
              </View>
              <Badge label="NO CHANGES NEEDED" variant="keep" size="small" />
            </View>

            <Text style={styles.researchTitle}>
              New research supports your current routine.
            </Text>
            <Text style={styles.researchSummary}>
              Relevant to your Differin + niacinamide combination.
            </Text>

            <TouchableOpacity
              style={styles.seeWhyRow}
              onPress={() => handleViewInsight(topResearch.id)}
            >
              <Text style={styles.seeWhyText}>See why</Text>
              <Icon name="forward" size={14} color={colors.brand} />
            </TouchableOpacity>
          </View>
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
    width: 32,
    height: 32,
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
  viewRoutineButton: {
    width: '100%',
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
});
