/**
 * app/shop/[productId].tsx — Canonical Reusable Product Detail Screen (C1)
 *
 * PURPOSE: Single destination for product details across all entry points:
 * Shop, Plan, Today, Scan, and Ask.
 *
 * DATA SOURCE RULES (Strict Invariant):
 * - Resolves product detail strictly from already-hydrated canonical client state:
 *   useRoutineStore.userProducts, routine.amSteps, routine.pmSteps.
 * - productId is used ONLY as an identifier for lookup.
 * - Route query parameters are NEVER trusted as product truth.
 * - If productId cannot be resolved from canonical state, fails closed with a
 *   truthful unavailable state. Does NOT fabricate products.
 *
 * COMMERCE RULES (Strict Invariant):
 * - Published ADD may offer verified external merchant pages for trusted products.
 * - No Derive product checkout or live offer/availability feed exists here.
 * - KEEP displays in-plan status with optional refill link; no repurchase pressure.
 * - PAUSE and STOP have no purchase CTA.
 * - REPLACE never sells the old product.
 * - Draft / awaiting_review routines cannot drive active purchase CTAs.
 * - Approximate price displayed truthfully only when present; never fabricated.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { Icon } from '@/src/components/ui/Icon';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { analytics } from '@/src/services/analytics';
import { resolveShopProductContext } from '@/src/commerce/types';
import { resolvePurchaseOptions } from '@/src/commerce/merchantListings';
import { useShopAudience } from '@/src/commerce/useShopAudience';
import { hydratePlanState } from '@/src/services/deriveClient';
import { ProductCommerceSection } from '@/src/components/shop/ProductCommerceSection';

export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ productId: string }>();
  const productId = params.productId;

  const { routine, userProducts, planHydrationStatus, planHydrationError } = useRoutineStore();
  const audience = useShopAudience();
  const isMember = audience === 'member';
  const memberRoutine = isMember ? routine : null;

  // Strict lookup from canonical client state only — never synthesize from params
  const context = resolveShopProductContext(audience, productId, memberRoutine, userProducts);
  const userProduct = context?.userProduct;
  const matchingStep = context?.matchingStep;

  const product = userProduct?.product || (matchingStep ? {
    id: matchingStep.productId,
    name: matchingStep.productName,
    brand: matchingStep.brand,
    category: matchingStep.category,
    keyActives: [] as string[],
  } : null);

  const action = userProduct?.action;
  const actionReason = userProduct?.actionReason || matchingStep?.whyChosen;
  const purchaseOptions = product ? resolvePurchaseOptions({
    product,
    action,
    routineStatus: memberRoutine?.status ?? null,
    currentRoutineProductIds: [
      ...(memberRoutine?.amSteps ?? []),
      ...(memberRoutine?.pmSteps ?? []),
    ].map((step) => step.productId),
  }) : [];

  React.useEffect(() => {
    if (isMember && (planHydrationStatus === 'idle' || planHydrationStatus === 'loading')) {
      void hydratePlanState().catch(() => {});
    }
  }, [isMember, planHydrationStatus]);

  React.useEffect(() => {
    if (product) {
      analytics.track('shop_product_viewed', {
        productId: product.id,
        productName: product.name,
        source: 'shop_home',
      });
    }
  }, [product?.id]);

  const handleBack = () => {
    Haptics.selectionAsync().catch(() => {});
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/shop');
    }
  };

  const handleRefill = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/refill');
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <Icon name="back" size={20} color={colors.ink} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Product Details</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (isMember && planHydrationStatus !== 'ready') {
    const failed = planHydrationStatus === 'error';
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.unavailableContainer}>
          <Icon name={failed ? 'info' : 'sparkle'} size={32} color={colors.brand} />
          <Text style={styles.unavailableTitle}>
            {failed ? 'Product details could not be loaded' : 'Loading product details'}
          </Text>
          <Text style={styles.unavailableText}>
            {failed ? planHydrationError || 'Please try again in a moment.' : 'Checking your current routine.'}
          </Text>
          {failed && <Button label="Try Again" variant="secondary" size="medium" onPress={() => {
            void hydratePlanState().catch(() => {});
          }} />}
        </View>
      </View>
    );
  }

  // Truthful unavailable state when productId cannot be resolved from canonical state
  if (!product) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {header}

        <View style={styles.unavailableContainer}>
          <Icon name="info" size={32} color={colors.inkMuted} />
          <Text style={styles.unavailableTitle}>Product details unavailable</Text>
          <Text style={styles.unavailableText}>
            {isMember
              ? 'This product could not be resolved from your current routine or shelf plan.'
              : 'Personalized product details are available with an active Derive membership.'}
          </Text>
          <Button
            label="Return to Shop"
            variant="secondary"
            size="medium"
            onPress={() => router.replace('/(tabs)/shop')}
            style={{ marginTop: spacing.md }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {header}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. PRODUCT IDENTITY */}
        <View style={styles.identityCard}>
          <Text style={styles.productBrand}>{product.brand}</Text>
          <Text style={styles.productName}>{product.name}</Text>
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {product.category.toUpperCase()}
              </Text>
            </View>
            {product.retailPriceApprox != null && (
              <Text style={styles.priceText}>
                Approx. retail ${product.retailPriceApprox}
              </Text>
            )}
          </View>
        </View>

        {/* 2. DERIVE'S TAKE / ACTION BADGE (Member Only) */}
        {isMember && action && (
          <View style={styles.takeCard}>
            <View style={styles.takeHeader}>
              <Text style={styles.takeOverline}>DERIVE'S TAKE</Text>
              <Badge action={action} />
            </View>
            <Text style={styles.takeReason}>
              {action === 'ADD' ? 'Needed for your plan' : action === 'KEEP' ? 'In your plan' : action === 'PAUSE' ? 'Paused for now' : action === 'STOP' ? 'Discontinued' : 'A change is recommended'}
            </Text>
          </View>
        )}

        {/* 3. One reason, without repeating it in the action badge. */}
        {isMember && actionReason && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionLabel}>WHY DERIVE SAYS THIS</Text>
            <Text style={styles.sectionBody}>{actionReason}</Text>
          </View>
        )}

        {/* 4. HOW IT FITS YOUR ROUTINE (When matching routine step exists) */}
        {isMember && matchingStep && (
          <View style={styles.routineFitCard}>
            <Text style={styles.sectionLabel}>HOW IT FITS YOUR ROUTINE</Text>
            <View style={styles.routineFitGrid}>
              <View style={styles.gridItem}>
                <Text style={styles.gridItemLabel}>TIMING</Text>
                <Text style={styles.gridItemValue}>
                  {matchingStep.timing === 'am' ? 'Morning' : 'Evening'}
                </Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridItemLabel}>AMOUNT</Text>
                <Text style={styles.gridItemValue}>{matchingStep.amount}</Text>
              </View>
              <View style={styles.gridItemFull}>
                <Text style={styles.gridItemLabel}>APPLICATION ZONE</Text>
                <Text style={styles.gridItemValue}>{matchingStep.area}</Text>
              </View>
              {matchingStep.scheduleText ? (
                <View style={styles.gridItemFull}>
                  <Text style={styles.gridItemLabel}>SCHEDULE</Text>
                  <Text style={styles.gridItemValue}>{matchingStep.scheduleText}</Text>
                </View>
              ) : null}
              {matchingStep.purpose ? (
                <View style={styles.gridItemFull}>
                  <Text style={styles.gridItemLabel}>PURPOSE</Text>
                  <Text style={styles.gridItemValue}>{matchingStep.purpose}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* 5. FORMULA & DETAILS (Trusted canonical fields only) */}
        {product.keyActives && product.keyActives.length > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionLabel}>KEY ACTIVE INGREDIENTS</Text>
            <View style={styles.activesRow}>
              {product.keyActives.map((active, idx) => (
                <View key={idx} style={styles.activePill}>
                  <Text style={styles.activePillText}>{active}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {product.cautions && product.cautions.length > 0 && (
          <View style={styles.cautionsCard}>
            <View style={styles.cautionHeader}>
              <Icon name="warning" size={14} color={colors.actionPause.text} />
              <Text style={styles.cautionLabel}>ESTABLISHED CAUTIONS</Text>
            </View>
            {product.cautions.map((caution, idx) => (
              <Text key={idx} style={styles.cautionText}>• {caution}</Text>
            ))}
          </View>
        )}

        {/* External acquisition is downstream of canonical product and published action. */}
        <ProductCommerceSection
          action={action}
          routineStatus={memberRoutine?.status ?? null}
          onRefill={handleRefill}
          productId={product.id}
          options={purchaseOptions}
        />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  identityCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: 4,
    ...shadows.subtle,
  },
  productBrand: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    lineHeight: 28,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  categoryBadge: {
    backgroundColor: colors.brandLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  categoryBadgeText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.brandDark,
    letterSpacing: 0.5,
  },
  priceText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
  takeCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  takeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  takeOverline: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.inkMuted,
  },
  takeReason: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    lineHeight: 22,
  },
  detailSection: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.inkMuted,
  },
  sectionBody: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    lineHeight: 22,
  },
  routineFitCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  routineFitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.canvas,
    padding: spacing.sm,
    borderRadius: radii.md,
    gap: 2,
  },
  gridItemFull: {
    width: '100%',
    backgroundColor: colors.canvas,
    padding: spacing.sm,
    borderRadius: radii.md,
    gap: 2,
  },
  gridItemLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 0.5,
  },
  gridItemValue: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  activesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  activePill: {
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
  },
  activePillText: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
  },
  cautionsCard: {
    backgroundColor: colors.actionPause.bg,
    borderColor: colors.actionPause.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cautionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cautionLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.actionPause.text,
  },
  cautionText: {
    fontSize: typography.sizes.caption,
    color: colors.actionPause.text,
    lineHeight: 18,
  },
  unavailableContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  unavailableTitle: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    textAlign: 'center',
  },
  unavailableText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
