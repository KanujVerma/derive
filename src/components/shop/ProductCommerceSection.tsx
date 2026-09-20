/** Member product acquisition. Merchant pages are external, never Derive orders. */
import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { resolveActionCommerceSemantics } from '../../commerce/types';
import { openExternalPurchase, type PurchaseOptionPresentation } from '../../commerce/merchantListings';
import { analytics } from '../../services/analytics';
import type { Routine, RoutineAction } from '../../types/schema';

interface Props {
  action?: RoutineAction;
  routineStatus: Routine['status'] | null;
  onRefill: () => void;
  productId: string;
  options: PurchaseOptionPresentation[];
  /** C1.5C may supply a real checkout handler; absent means no Derive CTA. */
  onDeriveCheckout?: (option: PurchaseOptionPresentation) => void;
}

export function ProductCommerceSection({ action, routineStatus, onRefill, productId, options, onDeriveCheckout }: Props) {
  const [failedListingId, setFailedListingId] = React.useState<string | null>(null);
  if (!action) return null;

  const activeOptions = options.filter((option) => option.merchant.kind === 'external' || !!onDeriveCheckout);
  const semantics = resolveActionCommerceSemantics(action, routineStatus);
  const published = routineStatus === 'published';
  const title = action === 'ADD'
    ? semantics.acquisitionEligible ? 'Where to Buy' : 'Recommendation under review'
    : action === 'KEEP' ? 'In your plan'
    : action === 'PAUSE' ? 'Product paused'
    : action === 'STOP' ? 'Discontinued product'
    : 'Replacement recommended';
  const body = action === 'ADD'
    ? published
      ? activeOptions.length ? 'External links open retailer product pages. Check the size, ingredients and current price there.' : "We don't have a verified purchase option for this product yet."
      : 'Your plan is still being finalized. There is no product to order here yet.'
    : action === 'KEEP'
    ? published
      ? 'You already have this product in your routine. Request a managed refill if needed.'
      : 'Managed refills become available after your routine is published.'
    : action === 'PAUSE'
    ? 'This product is on hold for now. No purchase is needed.'
    : action === 'STOP'
    ? 'Derive recommends discontinuing this product. No purchase is needed.'
    : 'Do not purchase more of this formula. Check your Plan for the recommended next step.';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon
          name={action === 'ADD' ? 'bottle' : action === 'KEEP' ? 'checkCircle' : action === 'STOP' ? 'close' : 'info'}
          size={18}
          color={action === 'STOP' ? colors.actionStop.text : action === 'PAUSE' ? colors.actionPause.text : colors.brand}
        />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
      {action === 'ADD' && semantics.acquisitionEligible && activeOptions.map((option) => (
        <View key={option.listing.id} style={styles.option}>
          <TouchableOpacity
            accessibilityRole={option.merchant.kind === 'derive' ? 'button' : 'link'}
            accessibilityLabel={option.merchant.kind === 'derive' ? 'Buy with Derive' : `View at ${option.merchant.displayName}, opens retailer site`}
            style={styles.optionButton}
            onPress={async () => {
              if (option.merchant.kind === 'derive') {
                onDeriveCheckout?.(option);
                return;
              }
              setFailedListingId(null);
              const opened = await openExternalPurchase(option, productId, Linking.openURL, analytics.track.bind(analytics));
              if (!opened) setFailedListingId(option.listing.id ?? option.merchant.id);
            }}
          >
            <View style={styles.optionLabel}>
              <Text style={styles.merchantName}>{option.merchant.displayName}</Text>
              {option.listing.variant && <Text style={styles.variant}>{option.listing.variant}</Text>}
              {option.offer && <>
                <Text style={styles.offerPrice}>{option.offer.price}</Text>
                <Text style={styles.offerProvenance}>{option.offer.provenance}</Text>
              </>}
            </View>
            <Text style={styles.externalCue}>{option.merchant.kind === 'derive' ? 'Buy with Derive' : 'View ↗'}</Text>
          </TouchableOpacity>
          {failedListingId === (option.listing.id ?? option.merchant.id) && (
            <Text style={styles.linkError} accessibilityRole="alert">Could not open this retailer. Tap to try again.</Text>
          )}
        </View>
      ))}
      {action === 'KEEP' && published && (
        <Button
          label="Request Refill"
          variant="secondary"
          size="small"
          onPress={onRefill}
          style={styles.refill}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.brandLight,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  body: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  refill: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  option: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionLabel: { flex: 1, gap: 2 },
  merchantName: { fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold, color: colors.ink },
  variant: { fontSize: typography.sizes.caption, color: colors.inkMuted },
  offerPrice: { fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold, color: colors.brandDark },
  offerProvenance: { fontSize: typography.sizes.micro, color: colors.inkMuted, lineHeight: 15 },
  externalCue: { fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold, color: colors.brand },
  linkError: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, fontSize: typography.sizes.caption, color: colors.actionStop.text },
});
