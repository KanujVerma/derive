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
 * WHAT IS NOT BUILT HERE (deferred to C1.5):
 * - Physical product checkout (Stripe/Shopify/external)
 * - Real ProductOffer DB records
 * - Real member pricing or coupons (none invented)
 * - Public browseable product catalog (no real backend catalog API exists yet)
 * - Guest route activation (E1 keeps inactive accounts on Membership)
 *
 * NON-MEMBER ROUTING:
 * E1 routes inactive Remote accounts to Membership before they can mount this tab.
 * The limited non-member presentation remains a C1 foundation for future public
 * routing, with its own audience guard if that route is activated in C1.5.
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
import { Icon } from '@/src/components/ui/Icon';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { analytics } from '@/src/services/analytics';
import { config } from '@/src/constants/config';
import { publicEnvironment } from '@/src/config/environment';
import { showsProviderBetaFeatures, usesFreeExternalBetaPresentation } from '@/src/utils/membershipPresentation';
import { membershipDisplayLabel } from '@/src/domain/types';
import { useShopAudience } from '@/src/commerce/useShopAudience';
import { resolveShopHomeState } from '@/src/commerce/shopState';
import { hydratePlanState } from '@/src/services/deriveClient';

export default function ShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    routine,
    userProducts,
    isPlanUnderReview,
    isRoutineBeingPrepared,
    refillRequests,
    planHydrationStatus,
    planHydrationError,
  } = useRoutineStore();

  const audience = useShopAudience();
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
  const shopState = resolveShopHomeState({
    hydrationStatus: planHydrationStatus,
    routineStatus: routine?.status ?? null,
    isRoutineBeingPrepared,
    isPlanUnderReview,
    neededCount: neededProducts.length,
  });

  React.useEffect(() => {
    // Deduplicates an in-flight read and recovers a stale loading projection
    // after entitlement refresh remounts Shop.
    if (isMember && (planHydrationStatus === 'idle' || planHydrationStatus === 'loading')) {
      void hydratePlanState().catch(() => {});
    }
  }, [isMember, planHydrationStatus]);

  const stateNotice = shopState === 'loading'
    ? { title: 'Loading your plan', body: 'Your product guidance is on its way.', icon: 'sparkle' as const }
    : shopState === 'error'
    ? { title: 'Your plan could not be loaded', body: planHydrationError || 'Please try again in a moment.', icon: 'info' as const }
    : shopState === 'preparing'
    ? { title: 'Your routine is being prepared', body: 'Product guidance will appear as soon as your plan is ready.', icon: 'sparkle' as const }
    : shopState === 'review'
    ? { title: 'Your plan is in review', body: 'We will show what you need once the routine is published.', icon: 'sparkle' as const }
    : shopState === 'covered'
    ? { title: 'Your current plan is covered', body: 'All recommended products are accounted for.', icon: 'checkCircle' as const }
    : shopState === 'empty'
    ? { title: 'Your Shop is taking shape', body: 'Products will appear here after your routine is ready.', icon: 'sparkle' as const }
    : null;

  // =============================================
  // HANDLERS
  // =============================================

  const handleScanPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    analytics.track('shop_scan_opened', { source: 'shop_home' });
    router.push('/shop/scan');
  };

  const handleRetryPlan = () => {
    void hydratePlanState().catch(() => {});
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

  const showProviderFeatures = showsProviderBetaFeatures(publicEnvironment.buildFlavor);
  const freeBeta = usesFreeExternalBetaPresentation(publicEnvironment.buildFlavor);
  const membershipPresentation = {
    priceDisplay: `$${config.betaPriceMonthly}/month`,
    tierLabel: membershipDisplayLabel('founding_beta'),
    valuePoints: [
      'Personalized canonical routine',
      'Weekly check-ins and ongoing adjustments',
      'Product identity and formula information',
      ...(showProviderFeatures ? ['Check a Product'] : []),
      'Founder quality review during beta',
    ],
  };

  // =============================================
  // RENDER: MEMBER SHOP
  // =============================================

  if (isMember) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header: the primary Scan accelerator stays above the scroll area. */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.screenTitle}>Shop</Text>
            {showProviderFeatures ? (
            <TouchableOpacity
              style={styles.headerScanAction}
              onPress={handleScanPress}
              accessibilityRole="button"
              accessibilityLabel="Check a product"
              activeOpacity={0.8}
            >
              <Icon name="scan" size={18} color={colors.brand} />
              <Text style={styles.headerScanText}>Check</Text>
            </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.screenSubtitle}>Product guidance for your routine.</Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 110 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── NEEDED FOR YOUR PLAN ── */}
          {shopState === 'needs_products' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>NEEDED FOR YOUR PLAN</Text>
              </View>
              <Text style={styles.sectionSubtext}>
                Derive recommends adding these to complete your routine.
              </Text>
              {neededProducts.map((up) => {
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
                    {/* Product detail owns the truthful future-ordering explanation. */}
                    <View style={styles.deferredCTA}>
                      <Text style={styles.deferredCTAText}>View product</Text>
                      <Icon name="forward" size={14} color={colors.brand} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* One truthful state at a time. A loading plan is never covered. */}
          {stateNotice && (
            <View style={styles.calmCard}>
              <Icon name={stateNotice.icon} size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.calmTitle}>{stateNotice.title}</Text>
                <Text style={styles.calmText}>{stateNotice.body}</Text>
                {shopState === 'error' && (
                  <Button label="Try Again" variant="ghost" size="small" onPress={handleRetryPlan} />
                )}
              </View>
            </View>
          )}

          {/* ── YOUR ROUTINE (KEEP products) ── */}
          {(shopState === 'needs_products' || shopState === 'covered') && routineProducts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>YOUR ROUTINE</Text>
                <TouchableOpacity onPress={handlePlanPress} accessibilityRole="button" accessibilityLabel="See your full plan">
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
                <TouchableOpacity
                  style={styles.seeAllRow}
                  onPress={handlePlanPress}
                  accessibilityRole="button"
                  accessibilityLabel={`See ${routineProducts.length - 3} more products in your plan`}
                >
                  <Text style={styles.seeAllText}>
                    +{routineProducts.length - 3} more in your plan
                  </Text>
                  <Icon name="forward" size={12} color={colors.brand} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Optional explanation; the persistent header action is the shortcut. */}
          {showProviderFeatures ? (
          <TouchableOpacity
            style={styles.scanCard}
            activeOpacity={0.85}
            onPress={handleScanPress}
            accessibilityRole="button"
            accessibilityLabel="Check a product by name or barcode"
          >
            <View style={styles.scanCardLeft}>
              <View style={styles.scanIconCircle}>
                <Icon name="scan" size={22} color={colors.brand} />
              </View>
              <View style={styles.scanCardCopy}>
                <Text style={styles.scanCardTitle}>Considering something else?</Text>
                <Text style={styles.scanCardSub}>
                  {shopState === 'needs_products' || shopState === 'covered'
                    ? 'Look up its identity and known formula facts.'
                    : 'Check a name or barcode. Personal fit comes later.'}
                </Text>
              </View>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>
          ) : null}

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
              <View style={styles.ordersCardCopy}>
                <Text style={styles.ordersCardTitle}>Orders & Refills</Text>
                {activeOrShippedRefills.length > 0 ? (
                  <Text style={styles.ordersCardSub}>
                    {activeOrShippedRefills.length} active{' '}
                    {activeOrShippedRefills.length === 1 ? 'order' : 'orders'}
                  </Text>
                ) : (
                  <Text style={styles.ordersCardSub}>
                    {shopState === 'needs_products' || shopState === 'covered'
                      ? 'Manage refills and tracking'
                      : 'Refills open after your plan is published'}
                  </Text>
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
  // E1 routes inactive Remote accounts to /membership before this tab mounts.
  // This fallback is dormant presentation groundwork for future C1.5 routing.
  //
  // No fake personalized products. No fake plan context.
  // =============================================

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Shop</Text>
        <Text style={styles.screenSubtitle}>
          Explore skincare.
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
              The catalog is searchable in supported member releases but there
              is not yet a general Shop browsing experience.
            */}
            A sourced product catalog is growing. Product checking is available to members in supported releases.
          </Text>
        </View>

        {/* No general Scan service exists for guests or inactive members. */}
        <View style={styles.scanCard}>
          <View style={styles.scanCardLeft}>
            <View style={styles.scanIconCircle}>
              <Icon name="scan" size={22} color={colors.brand} />
            </View>
            <View>
              <Text style={styles.scanCardTitle}>Check a Product</Text>
              <Text style={styles.scanCardSub}>Available with membership when enabled</Text>
            </View>
          </View>
        </View>

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
          {!freeBeta ? (
          <Text style={styles.membershipPrice}>
            {membershipPresentation.priceDisplay} · {membershipPresentation.tierLabel}
          </Text>
          ) : null}
          {!freeBeta ? (
          <View style={styles.membershipCTAPlaceholder}>
            <Text style={styles.membershipCTAText}>
              Membership enrollment available soon.
            </Text>
          </View>
          ) : null}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerScanAction: {
    minHeight: 44,
    minWidth: 82,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.full,
  },
  headerScanText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
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
    minWidth: 0,
  },
  scanCardCopy: {
    flex: 1,
    minWidth: 0,
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
    lineHeight: 21,
  },
  scanCardSub: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 1,
    lineHeight: 18,
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
    minWidth: 0,
  },
  ordersCardCopy: {
    flex: 1,
    minWidth: 0,
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
