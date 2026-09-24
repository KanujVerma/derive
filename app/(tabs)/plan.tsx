import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { RoutineCard } from '@/src/components/routine/RoutineCard';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { InfoBanner } from '@/src/components/ui/InfoBanner';
import { analytics } from '@/src/services/analytics';
import { ensureInitialRoutineProposal } from '@/src/services/deriveClient';
import { useShopAudience } from '@/src/commerce/useShopAudience';
import { PreviewPlanShell } from '@/src/components/plan/PreviewPlanShell';
import { publicEnvironment } from '@/src/config/environment';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { resolveShellPresentation } from '@/src/utils/shellPresentation';
import { useFreeAccessStore } from '@/src/stores/freeAccessStore';
import { useBootstrapStore } from '@/src/stores/bootstrapStore';
import { useAuthStore } from '@/src/stores/authStore';
import { ManagedPlanPresentation } from '@/src/components/plan/managed/ManagedPlanPresentation';
import { RootShellHeader } from '@/src/components/shell/RootShellHeader';
import { resolvePlanPresentation } from '@/src/presentation/managed-plan/planComposition';

export default function PlanScreen() {
  const { managedPlanFixture } = useLocalSearchParams<{ managedPlanFixture?: string }>();
  const sessionUserId = useAuthStore((s) => s.sessionUserId);
  const shell = resolveShellPresentation({
    buildFlavor: publicEnvironment.buildFlavor,
    remoteEnabled: isRemoteServiceEnabled(),
    supabaseUrl: publicEnvironment.supabaseUrl,
  });
  const managedAccess = useFreeAccessStore((s) => s.status === 'READY'
    && s.userId === sessionUserId && s.access?.userId === sessionUserId
    && s.access?.managedAccess === true);
  const presentation = resolvePlanPresentation({
    shell, managedAccess,
    fixtureStatus: typeof managedPlanFixture === 'string' ? managedPlanFixture : undefined,
  });
  if (shell === 'scanner_first_preview') {
    if (presentation.kind === 'fixture') return <IllustrativeManagedPlan snapshot={presentation.snapshot} />;
    return <PreviewPlanShell />;
  }
  if (presentation.kind === 'free') return <PreviewPlanShell />;
  if (presentation.kind === 'fixture') return <IllustrativeManagedPlan snapshot={presentation.snapshot} />;
  return <LegacyManagedPlanScreen />;
}

function IllustrativeManagedPlan({ snapshot }: { snapshot: React.ComponentProps<typeof ManagedPlanPresentation>['snapshot'] }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.container, { paddingTop: insets.top }]}>
    <RootShellHeader title="Plan" />
    <ManagedPlanPresentation snapshot={snapshot} />
  </View>;
}

function LegacyManagedPlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bootstrapReady = useBootstrapStore((s) => s.status === 'READY');
  const {
    routine,
    userProducts,
    completedStepIdsToday,
    toggleStepCompletion,
    isPlanUnderReview,
    isRoutineBeingPrepared,
    planHydrationStatus,
    planHydrationError,
  } = useRoutineStore();
  const [activeTab, setActiveTab] = useState<'routine' | 'products'>('routine');
  const isShopMember = useShopAudience() === 'member';

  React.useEffect(() => {
    if (isRemoteServiceEnabled() && !bootstrapReady) return;
    ensureInitialRoutineProposal().catch((e) => console.warn('Failed to ensure routine proposal:', e));
  }, [bootstrapReady]);

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
        <View style={styles.headerTopRow}>
          <Text style={styles.screenTitle}>Plan</Text>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/profile')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Account and Settings"
            accessibilityRole="button"
          >
            <Icon name="person" size={18} color={colors.inkMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.screenSubtitle}>
          {isRoutineBeingPrepared
            ? 'Preparing your routine · Setup complete'
            : isPlanUnderReview
            ? 'Draft routine schedule · Under final quality review'
            : routine?.summarySentence || 'Active managed skincare routine.'}
        </Text>

        {/* Semantic Segmented Control */}
        <SegmentedControl
          options={[
            { value: 'routine', label: 'ROUTINE' },
            { value: 'products', label: 'PRODUCTS', badge: userProducts.length },
          ]}
          value={activeTab}
          onChange={handleTabSwitch}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!isRoutineBeingPrepared && isPlanUnderReview && (
          <View style={styles.draftNoticeBanner}>
            <View style={styles.draftNoticeHeader}>
              <Badge label="DRAFT · NOT ACTIVE" variant="pause" size="small" />
              <Text style={styles.draftNoticeTitle}>Final Review</Text>
            </View>
            <Text style={styles.draftNoticeMessage}>
              Your first routine gets one final quality check before it goes live. You can review the scheduled steps below.
            </Text>
          </View>
        )}

        {activeTab === 'routine' ? (
          isRoutineBeingPrepared ? (
            <View style={styles.emptyPlanCard}>
              <View style={styles.emptyPlanIconCircle}>
                <Icon name="sparkle" size={24} color={colors.brand} />
              </View>
              <Text style={styles.emptyPlanTitle}>Preparing your routine</Text>
              <Text style={styles.emptyPlanText}>
                {planHydrationStatus === 'error'
                  ? planHydrationError || "We couldn't refresh your routine right now. Please try again."
                  : "Your setup is complete. We are generating your custom morning and evening steps."}
              </Text>
              {planHydrationStatus === 'error' && (
                <Button
                  label="Try Again"
                  variant="secondary"
                  size="medium"
                  onPress={() => ensureInitialRoutineProposal().catch((e) => console.warn('Retry proposal error:', e))}
                  style={{ marginTop: spacing.md }}
                />
              )}
            </View>
          ) : amSteps.length === 0 && pmSteps.length === 0 ? (
            <View style={styles.emptyPlanCard}>
              <View style={styles.emptyPlanIconCircle}>
                <Icon name="sparkle" size={24} color={colors.brand} />
              </View>
              <Text style={styles.emptyPlanTitle}>No routine scheduled yet</Text>
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
            <>
              {/* AM ROUTINE */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Morning</Text>
                <Text style={styles.sectionSub}>
                  {amSteps.length} step{amSteps.length === 1 ? '' : 's'} · Cleanse, hydrate & protect
                </Text>
              </View>

              {amSteps.map((step) => (
                <RoutineCard
                  key={step.id}
                  step={step}
                  onRequestRefill={isPlanUnderReview ? undefined : () => router.push('/refill')}
                />
              ))}

              {/* PM ROUTINE */}
              <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
                <Text style={styles.sectionTitle}>Evening</Text>
                <Text style={styles.sectionSub}>
                  {pmSteps.length} step{pmSteps.length === 1 ? '' : 's'} · Cleanse, treat & moisturize
                </Text>
              </View>

              {pmSteps.map((step) => (
                <RoutineCard
                  key={step.id}
                  step={step}
                  onRequestRefill={isPlanUnderReview ? undefined : () => router.push('/refill')}
                />
              ))}

              {/* Consolidated Refills & Tracking Pathway (Only active when routine is active) */}
              {!isPlanUnderReview && (
                <View style={styles.replenishCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.replenishTitle}>Managed Refills</Text>
                    <Text style={styles.replenishSub}>
                      Running low on any bottle? Tell us in one tap and we'll handle the rest.
                    </Text>
                  </View>
                  <View style={styles.replenishActions}>
                    <Button
                      label="Request Refill"
                      variant="brand"
                      size="medium"
                      onPress={() => router.push('/refill')}
                    />
                    <TouchableOpacity
                      onPress={() => router.push('/orders')}
                      style={styles.ordersLink}
                      activeOpacity={0.7}
                    >
                      <Icon name="shipping" size={15} color={colors.brand} />
                      <Text style={styles.ordersLinkText}>Orders & Tracking</Text>
                      <Icon name="forward" size={13} color={colors.brand} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )
        ) : (
          <>
            {/* PRODUCTS LIST */}
            <View style={styles.shelfIntro}>
              <View style={styles.shelfIntroHeaderRow}>
                <Text style={styles.shelfIntroTitle}>We reviewed what you're using now.</Text>
                {isShopMember && routine?.status === 'published' && (
                  <TouchableOpacity
                    style={styles.shopPlanLink}
                    onPress={() => router.push('/(tabs)/shop')}
                    accessibilityRole="button"
                    accessibilityLabel="Shop your plan"
                  >
                    <Icon name="shop" size={13} color={colors.brand} />
                    <Text style={styles.shopPlanLinkText}>Shop your plan</Text>
                    <Icon name="forward" size={11} color={colors.brand} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.shelfIntroText}>
                We prioritize products you already tolerate well, pause redundancies, and only add essentials when needed.
              </Text>
            </View>

            {userProducts.length === 0 ? (
              <View style={styles.emptyPlanCard}>
                <Text style={styles.emptyPlanTitle}>
                  {isRoutineBeingPrepared
                    ? 'Product decisions in progress'
                    : 'No shelf products yet'}
                </Text>
                <Text style={styles.emptyPlanText}>
                  {isRoutineBeingPrepared
                    ? 'Product decisions will appear with your proposed routine.'
                    : 'Products identified during onboarding or counter scans will appear here with KEEP, PAUSE, or REPLACE recommendations.'}
                </Text>
              </View>
            ) : (
              userProducts.map((up) => {
                const matchingStep = [...amSteps, ...pmSteps].find(
                  (s) => s.productId === up.productId
                );
                const scheduleText = matchingStep?.scheduleText || (matchingStep ? (matchingStep.timing === 'am' ? 'Every morning' : 'Every evening') : undefined);
                const isPublished = routine?.status === 'published';

                return (
                  <View key={up.id} style={styles.productAuditCard}>
                    <View style={styles.productAuditHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.productAuditBrand}>{up.product.brand}</Text>
                        <Text style={styles.productAuditName}>{up.product.name}</Text>
                      </View>
                      <Badge action={up.action} />
                    </View>

                    {up.actionReason ? (
                      <View style={styles.auditReasonBox}>
                        <Text style={styles.auditReasonText}>{up.actionReason}</Text>
                      </View>
                    ) : null}

                    {scheduleText && up.action === 'KEEP' && (
                      <Text style={styles.frequencyText}>
                        Scheduled: {scheduleText}
                      </Text>
                    )}

                    {/* Plan -> Shop Integration: Restrained Product Detail Access */}
                    {up.action === 'ADD' && isShopMember && isPublished && !isPlanUnderReview ? (
                      <TouchableOpacity
                        style={styles.auditActionRow}
                        onPress={() => router.push(`/shop/${up.productId}` as any)}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${up.product.name} in Shop`}
                      >
                        <Text style={styles.auditActionText}>View product</Text>
                        <Icon name="forward" size={12} color={colors.brand} />
                      </TouchableOpacity>
                    ) : up.action === 'KEEP' && isShopMember ? (
                      <TouchableOpacity
                        style={styles.auditActionRow}
                        onPress={() => router.push(`/shop/${up.productId}` as any)}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${up.product.name} details`}
                      >
                        <Text style={styles.auditActionMutedText}>View product</Text>
                        <Icon name="forward" size={12} color={colors.inkMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
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
  shelfIntroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  shelfIntroTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    flex: 1,
  },
  shopPlanLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  shopPlanLinkText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
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
  auditActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  auditActionText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  auditActionMutedText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
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
  replenishActions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  ordersLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  ordersLinkText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  draftNoticeBanner: {
    backgroundColor: colors.actionReview.bg,
    borderColor: colors.actionReview.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  draftNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  draftNoticeTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    color: colors.actionReview.text,
  },
  draftNoticeMessage: {
    fontSize: typography.sizes.caption,
    color: colors.actionReview.text,
    lineHeight: typography.lineHeights.caption,
  },
  emptyPlanCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    textAlign: 'center',
    marginTop: spacing.md,
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
});
