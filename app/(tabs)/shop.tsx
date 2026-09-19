/**
 * app/(tabs)/shop.tsx — Derive Shop Tab (C1)
 *
 * PURPOSE: Member-personalized Shop home + Scan entry point.
 *
 * ARCHITECTURE (see docs/COMMERCE.md for full spec):
 * - Member: personalized sections (Needed for Your Plan, Your Routine, Scan, Orders & Refills)
 * - Non-member / guest: public presentation fallback (no fake personalized claims)
 * - Scan lives at app/shop/scan.tsx — ONE canonical scanner implementation.
 *
 * WHAT IS NOT BUILT HERE (deferred to C1.5 / S5):
 * - Physical product checkout (Stripe/Shopify/external)
 * - Real ProductOffer DB records
 * - Real member pricing or coupons (none invented)
 * - Public browseable product catalog (no real backend catalog API exists yet)
 * - Guest route activation (auth gating remains unchanged from S1)
 *
 * NON-MEMBER ROUTING:
 * Current Remote auth gating prevents non-members from reaching member tabs.
 * This component architects the non-member fallback UI for future public routing
 * (C1.5 activation) without weakening S1 auth gating.
 *
 * SCAN: Tapping "Scan a Product" navigates to app/shop/scan.tsx.
 *
 * NAVIGATION TARGET (C1 approved):
 *   Today · Plan · Shop · Ask · Progress
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { useBootstrapStore } from '@/src/stores/bootstrapStore';
import { useAuthStore } from '@/src/stores/authStore';
import { Icon } from '@/src/components/ui/Icon';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { analytics } from '@/src/services/analytics';
import { config } from '@/src/constants/config';
import { membershipDisplayLabel } from '@/src/domain/types';
import { resolveActionCommerceSemantics, type ShopAudience } from '@/src/commerce/types';

// =============================================
// AUDIENCE RESOLUTION
// Derives shop context from canonical membership truth.
// Does NOT create a separate membership source of truth.
// =============================================

function resolveShopAudience(
  sessionUserId: string | null,
  membershipStatus: 'active' | 'paused' | 'cancelled' | 'none' | undefined
): ShopAudience {
  if (!sessionUserId) return 'guest';
  if (membershipStatus === 'active') return 'member';
  return 'non_member';
}

export default function ShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    routine,
    userProducts,
    isPlanUnderReview,
    isRoutineBeingPrepared,
    refillRequests,
  } = useRoutineStore();

  const bootstrapStore = useBootstrapStore();
  const sessionUserId = useAuthStore((s) => s.sessionUserId);
  const membershipStatus = bootstrapStore.bootstrapState?.membershipStatus;

  const audience = resolveShopAudience(sessionUserId, membershipStatus);
  const isMember = audience === 'member';
  const isPublished = routine?.status === 'published';

  // Products that need acquisition (ADD + not yet confirmed + routine is published)
  const neededProducts = isMember && isPublished
    ? userProducts.filter(
        (up) => up.action === 'ADD' && !up.isConfirmedByUser
      )
    : [];

  // Current routine products (KEEP + published)
  const routineProducts = isMember && isPublished
    ? userProducts.filter((up) => up.action === 'KEEP')
    : [];

  const activeOrShippedRefills = refillRequests.filter(
    (r) => r.status === 'shipped' || r.status === 'ordered' || r.status === 'requested'
  );

  // =============================================
  // HANDLERS
  // =============================================

  const handleScanPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    analytics.track('shop_scan_opened', { source: 'shop_home' });
    router.push('/shop/scan');
  };

  const handleOrdersPress = () => {
    Haptics.selectionAsync().catch(() => {});
    analytics.track('orders_opened', { source: 'shop_home' });
    router.push('/orders');
  };

  const handlePlanPress = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(tabs)/plan');
  };

  const handleProductPress = (productId: string, productName: string) => {
    Haptics.selectionAsync().catch(() => {});
    analytics.track('shop_product_viewed', { productId, productName, source: 'shop_home' });
    router.push(`/shop/${productId}` as any);
  };

  // =============================================
  // MEMBERSHIP UPSELL (non-member / guest fallback)
  // =============================================

  const membershipPresentation = {
    priceDisplay: `$${config.betaPriceMonthly}/month`,
    tierLabel: membershipDisplayLabel('founding_beta'),
    valuePoints: [
      'Personalized canonical routine',
      'Weekly check-ins and ongoing adjustments',
      'Personalized product-fit guidance',
      'Personalized Scan and Ask',
      'Founder quality review during beta',
    ],
  };

  // =============================================
  // RENDER: MEMBER SHOP
  // =============================================

  if (isMember) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Shop</Text>
          <Text style={styles.screenSubtitle}>
            {isRoutineBeingPrepared
              ? 'Your routine is being prepared.'
              : isPlanUnderReview
              ? 'Your product recommendations are being finalized.'
              : isPublished
              ? 'What does Derive think you actually need?'
              : 'Your personalized shop.'}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 110 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── NEEDED FOR YOUR PLAN ── */}
          {isPublished && neededProducts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>NEEDED FOR YOUR PLAN</Text>
              </View>
              <Text style={styles.sectionSubtext}>
                Derive recommends adding these to complete your routine.
              </Text>
              {neededProducts.map((up) => {
                const semantics = resolveActionCommerceSemantics('ADD', routine?.status ?? null);
                return (
                  <TouchableOpacity
                    key={up.id}
                    style={styles.productCard}
                    activeOpacity={0.85}
                    onPress={() => handleProductPress(up.productId, up.product.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`${up.product.name} by ${up.product.brand} — needed for your plan`}
                  >
                    <View style={styles.productCardRow}>
                      <View style={styles.productInfo}>
                        <Badge action="ADD" />
                        <Text style={styles.productBrand}>{up.product.brand}</Text>
                        <Text style={styles.productName}>{up.product.name}</Text>
                        {up.actionReason ? (
                          <Text style={styles.productReason}>{up.actionReason}</Text>
                        ) : null}
                      </View>
                      <Icon name="forward" size={16} color={colors.inkMuted} />
                    </View>
                    {/* C1 truthful commerce presentation */}
                    <View style={styles.deferredCTA}>
                      <Icon name="bottle" size={14} color={colors.brand} />
                      <Text style={styles.deferredCTAText}>
                        {semantics.acquisitionEligible
                          ? 'Purchase through Derive coming soon'
                          : 'Finalizing your plan first'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── ROUTINE UNDER REVIEW STATE ── */}
          {(isRoutineBeingPrepared || isPlanUnderReview) && (
            <View style={styles.calmCard}>
              <Icon name="sparkle" size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.calmTitle}>
                  {isRoutineBeingPrepared
                    ? 'Your routine is being prepared'
                    : 'Your product recommendations are being finalized'}
                </Text>
                <Text style={styles.calmText}>
                  {isRoutineBeingPrepared
                    ? 'Product recommendations will appear once your routine is ready. You can scan and ask in the meantime.'
                    : 'We\'ll show you exactly what to get once your plan is confirmed. You can scan and ask in the meantime.'}
                </Text>
              </View>
            </View>
          )}

          {/* ── NO PRODUCTS NEEDED — PLAN IS COVERED ── */}
          {isMember && isPublished && neededProducts.length === 0 && !isRoutineBeingPrepared && !isPlanUnderReview && (
            <View style={styles.calmCard}>
              <Icon name="checkCircle" size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.calmTitle}>Your current plan is covered</Text>
                <Text style={styles.calmText}>
                  All recommended products are accounted for. Derive will let you know if anything needs to change.
                </Text>
              </View>
            </View>
          )}

          {/* ── YOUR ROUTINE (KEEP products) ── */}
          {routineProducts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>YOUR ROUTINE</Text>
                <TouchableOpacity onPress={handlePlanPress}>
                  <Text style={styles.sectionAction}>See plan</Text>
                </TouchableOpacity>
              </View>
              {routineProducts.slice(0, 3).map((up) => (
                <TouchableOpacity
                  key={up.id}
                  style={styles.routineProductRow}
                  activeOpacity={0.85}
                  onPress={() => handleProductPress(up.productId, up.product.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`${up.product.name} — in your routine`}
                >
                  <View style={styles.routineProductInfo}>
                    <Text style={styles.routineProductName}>{up.product.name}</Text>
                    <Text style={styles.routineProductBrand}>{up.product.brand}</Text>
                  </View>
                  <View style={styles.routineProductRight}>
                    <Badge action="KEEP" />
                    <Icon name="forward" size={14} color={colors.inkMuted} />
                  </View>
                </TouchableOpacity>
              ))}
              {routineProducts.length > 3 && (
                <TouchableOpacity style={styles.seeAllRow} onPress={handlePlanPress}>
                  <Text style={styles.seeAllText}>
                    +{routineProducts.length - 3} more in your plan
                  </Text>
                  <Icon name="forward" size={12} color={colors.brand} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── SCAN A PRODUCT ── */}
          <TouchableOpacity
            style={styles.scanCard}
            activeOpacity={0.85}
            onPress={handleScanPress}
            accessibilityRole="button"
            accessibilityLabel="Scan a product with camera or search by name"
          >
            <View style={styles.scanCardLeft}>
              <View style={styles.scanIconCircle}>
                <Icon name="scan" size={22} color={colors.brand} />
              </View>
              <View>
                <Text style={styles.scanCardTitle}>Scan a Product</Text>
                <Text style={styles.scanCardSub}>
                  Camera · Search by name · Personalized fit
                </Text>
              </View>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>

          {/* ── ORDERS & REFILLS ── */}
          <TouchableOpacity
            style={styles.ordersCard}
            activeOpacity={0.85}
            onPress={handleOrdersPress}
            accessibilityRole="button"
            accessibilityLabel="Orders and refill requests"
          >
            <View style={styles.ordersCardLeft}>
              <Icon name="shipping" size={18} color={colors.inkMuted} />
              <View>
                <Text style={styles.ordersCardTitle}>Orders & Refills</Text>
                {activeOrShippedRefills.length > 0 ? (
                  <Text style={styles.ordersCardSub}>
                    {activeOrShippedRefills.length} active{' '}
                    {activeOrShippedRefills.length === 1 ? 'order' : 'orders'}
                  </Text>
                ) : (
                  <Text style={styles.ordersCardSub}>Request a refill or track orders</Text>
                )}
              </View>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // =============================================
  // RENDER: NON-MEMBER / GUEST FALLBACK
  //
  // NOTE: Current S1 auth gating prevents non-members from reaching member
  // tabs in Remote production mode. This UI exists for:
  // 1. Mock/dev state testing of the non-member presentation
  // 2. Future C1.5 public route activation (without weakening S1 gating)
  //
  // No fake personalized products. No fake plan context.
  // =============================================

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Shop</Text>
        <Text style={styles.screenSubtitle}>
          {audience === 'guest' ? 'Explore skincare.' : 'Explore skincare.'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── SHOP SKINCARE — general, no fake personalization ── */}
        <View style={styles.publicBanner}>
          <Text style={styles.publicBannerTitle}>Shop Skincare</Text>
          <Text style={styles.publicBannerText}>
            {/*
              C1.5: Real public catalog API needed here.
              Current backend does not expose a general browseable product catalog.
              Displaying an honest limited state rather than fabricated products.
            */}
            A curated product catalog is coming soon. In the meantime, scan any product
            for formula information and trusted category context.
          </Text>
        </View>

        {/* ── SCAN ENTRY (available to all) ── */}
        <TouchableOpacity
          style={styles.scanCard}
          activeOpacity={0.85}
          onPress={handleScanPress}
          accessibilityRole="button"
          accessibilityLabel="Scan a product with camera or search by name"
        >
          <View style={styles.scanCardLeft}>
            <View style={styles.scanIconCircle}>
              <Icon name="scan" size={22} color={colors.brand} />
            </View>
            <View>
              <Text style={styles.scanCardTitle}>Scan a Product</Text>
              <Text style={styles.scanCardSub}>Camera · Search by name</Text>
            </View>
          </View>
          <Icon name="forward" size={16} color={colors.inkMuted} />
        </TouchableOpacity>

        {/* ── MEMBERSHIP UPSELL ── */}
        <View style={styles.membershipCard}>
          <View style={styles.membershipHeader}>
            <Icon name="sparkle" size={16} color={colors.brand} />
            <Text style={styles.membershipOverline}>DERIVE MEMBERSHIP</Text>
          </View>
          <Text style={styles.membershipTitle}>
            Want to know how this fits your skin and routine?
          </Text>
          <Text style={styles.membershipBody}>
            Derive members get personalized product-fit guidance, a managed routine,
            weekly check-ins, and ongoing adjustments.
          </Text>
          <View style={styles.membershipBullets}>
            {membershipPresentation.valuePoints.map((point) => (
              <View key={point} style={styles.membershipBulletRow}>
                <Icon name="check" size={14} color={colors.brand} />
                <Text style={styles.membershipBulletText}>{point}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.membershipPrice}>
            {membershipPresentation.priceDisplay} · {membershipPresentation.tierLabel}
          </Text>
          {/* C1.5: Membership CTA connects to S5 createMembershipCheckout */}
          <View style={styles.membershipCTAPlaceholder}>
            <Text style={styles.membershipCTAText}>
              Membership enrollment available soon.
            </Text>
          </View>
        </View>
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
  screenTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
    marginBottom: 2,
  },
  screenSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: 22,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.inkMuted,
  },
  sectionSubtext: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 18,
  },
  sectionAction: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  // Product cards — Needed for Your Plan
  productCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadows.subtle,
  },
  productCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productBrand: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },
  productName: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  productReason: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 18,
    marginTop: 2,
  },
  deferredCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginTop: spacing.xs,
  },
  deferredCTAText: {
    fontSize: typography.sizes.caption,
    color: colors.brand,
    fontWeight: typography.weights.medium,
  },
  // Calm state cards
  calmCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.brandLight,
    padding: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.sm,
  },
  calmTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    color: colors.brandDark,
    marginBottom: 2,
  },
  calmText: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
    lineHeight: 18,
  },
  // Routine product rows
  routineProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  routineProductInfo: {
    flex: 1,
  },
  routineProductName: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  routineProductBrand: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  routineProductRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: spacing.xs,
  },
  seeAllText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  // Scan card
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    ...shadows.subtle,
  },
  scanCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  scanIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCardTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  scanCardSub: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 1,
  },
  // Orders card
  ordersCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  ordersCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  ordersCardTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  ordersCardSub: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 1,
  },
  // Public / non-member
  publicBanner: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  publicBannerTitle: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  publicBannerText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: 22,
  },
  // Membership upsell
  membershipCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  membershipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  membershipOverline: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.brand,
  },
  membershipTitle: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    lineHeight: 26,
  },
  membershipBody: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: 22,
  },
  membershipBullets: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  membershipBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  membershipBulletText: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
    flex: 1,
    lineHeight: 18,
  },
  membershipPrice: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
    paddingTop: spacing.xs,
  },
  membershipCTAPlaceholder: {
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  membershipCTAText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
});
