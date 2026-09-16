import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { RoutineCard } from '@/src/components/routine/RoutineCard';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { analytics } from '@/src/services/analytics';

export default function PlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    routine,
    userProducts,
    completedStepIdsToday,
    toggleStepCompletion,
  } = useRoutineStore();
  const [activeTab, setActiveTab] = useState<'routine' | 'products'>('routine');

  const handleTabSwitch = (tab: 'routine' | 'products') => {
    setActiveTab(tab);
    analytics.track('plan_tab_switched', { activeTab: tab });
  };

  const amSteps = routine?.amSteps || [];
  const pmSteps = routine?.pmSteps || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Plan</Text>
        <Text style={styles.screenSubtitle}>
          {routine?.summarySentence || 'Active managed skincare routine.'}
        </Text>

        {/* View Switcher: ROUTINE vs PRODUCTS */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'routine' && styles.segmentActive]}
            onPress={() => handleTabSwitch('routine')}
            activeOpacity={0.8}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'routine' }}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'routine' && styles.segmentTextActive,
              ]}
            >
              ROUTINE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segment, activeTab === 'products' && styles.segmentActive]}
            onPress={() => handleTabSwitch('products')}
            activeOpacity={0.8}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'products' }}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'products' && styles.segmentTextActive,
              ]}
            >
              PRODUCTS ({userProducts.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'routine' ? (
          <>
            {/* AM ROUTINE */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Morning</Text>
              <Text style={styles.sectionSub}>3 steps · Cleanse, hydrate & protect</Text>
            </View>

            {amSteps.map((step) => (
              <RoutineCard
                key={step.id}
                step={step}
                onRequestRefill={() => router.push('/refill')}
              />
            ))}

            {/* PM ROUTINE */}
            <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
              <Text style={styles.sectionTitle}>Evening</Text>
              <Text style={styles.sectionSub}>3 steps · Cleanse, treat & moisturize</Text>
            </View>

            {pmSteps.map((step) => (
              <RoutineCard
                key={step.id}
                step={step}
                onRequestRefill={() => router.push('/refill')}
              />
            ))}

            {/* Replenishment CTA */}
            <View style={styles.replenishCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.replenishTitle}>Product Replenishment</Text>
                <Text style={styles.replenishSub}>
                  Running low on any bottle? Request a refill with one tap.
                </Text>
              </View>
              <Button
                label="Running Low?"
                variant="brand"
                size="medium"
                onPress={() => router.push('/refill')}
              />
            </View>
          </>
        ) : (
          <>
            {/* PRODUCTS LIST */}
            <View style={styles.shelfIntro}>
              <Text style={styles.shelfIntroTitle}>We reviewed what you're using now.</Text>
              <Text style={styles.shelfIntroText}>
                We prioritize products you already tolerate well, pause redundancies, and only add essentials when needed.
              </Text>
            </View>

            {userProducts.map((up) => {
              const matchingStep = [...amSteps, ...pmSteps].find(
                (s) => s.productId === up.productId
              );
              const scheduleText = matchingStep?.scheduleText || (matchingStep ? (matchingStep.timing === 'am' ? 'Every morning' : 'Every evening') : undefined);

              return (
                <View key={up.id} style={styles.productAuditCard}>
                  <View style={styles.productAuditHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productAuditBrand}>{up.product.brand}</Text>
                      <Text style={styles.productAuditName}>{up.product.name}</Text>
                    </View>
                    <Badge action={up.action} />
                  </View>

                  <View style={styles.auditReasonBox}>
                    <Text style={styles.auditReasonText}>{up.actionReason}</Text>
                  </View>

                  {scheduleText && up.action === 'KEEP' && (
                    <Text style={styles.frequencyText}>
                      Scheduled: {scheduleText}
                    </Text>
                  )}
                </View>
              );
            })}

            {/* Orders & Refills History Link */}
            <TouchableOpacity
              onPress={() => router.push('/orders')}
              style={styles.ordersHistoryLink}
              activeOpacity={0.7}
            >
              <Icon name="shipping" size={16} color={colors.brand} />
              <Text style={styles.ordersHistoryText}>View Orders & Refills History</Text>
              <Icon name="forward" size={14} color={colors.brand} />
            </TouchableOpacity>

            {/* Running Low floating link at bottom of products */}
            <TouchableOpacity
              onPress={() => router.push('/refill')}
              style={styles.bottomRefillRow}
              activeOpacity={0.7}
            >
              <Icon name="bottle" size={18} color={colors.brand} />
              <Text style={styles.bottomRefillText}>Running low on a product? Tap to request a refill</Text>
            </TouchableOpacity>
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
    backgroundColor: colors.canvas,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  screenTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
  },
  screenSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    padding: 3,
    borderRadius: radii.md,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderRadius: radii.sm,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  segmentText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
    letterSpacing: 0.5,
  },
  segmentTextActive: {
    color: colors.ink,
    fontWeight: typography.weights.bold,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionHeader: {
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  sectionSub: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  replenishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    marginTop: spacing.md,
    gap: spacing.md,
    ...shadows.subtle,
  },
  replenishTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: 2,
  },
  replenishSub: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  shelfIntro: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  shelfIntroTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: 4,
  },
  shelfIntroText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 18,
  },
  productAuditCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.subtle,
  },
  productAuditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  productAuditBrand: {
    fontSize: typography.sizes.micro,
    color: colors.brand,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  productAuditName: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  auditReasonBox: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  auditReasonText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 18,
  },
  frequencyText: {
    fontSize: typography.sizes.micro,
    color: colors.brand,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.xs,
  },
  ordersHistoryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  ordersHistoryText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  bottomRefillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  bottomRefillText: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
});
