import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { Icon } from '@/src/components/ui/Icon';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { RefillRequest, RefillStatus } from '@/src/types/schema';
import { hydrateOrders } from '@/src/services/deriveClient';

const STAGES: { key: RefillStatus; label: string }[] = [
  { key: 'requested', label: 'Requested' },
  { key: 'ordered', label: 'Ordered' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

function getStageIndex(status: RefillStatus): number {
  switch (status) {
    case 'requested':
      return 0;
    case 'ordered':
      return 1;
    case 'shipped':
      return 2;
    case 'delivered':
      return 3;
    default:
      return 0;
  }
}

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refillRequests } = useRoutineStore();

  React.useEffect(() => {
    hydrateOrders().catch((err) => {
      console.warn('Failed to hydrate orders:', err);
    });
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleRequestRefill = () => {
    router.push('/refill');
  };

  const handleOpenTracking = (url?: string) => {
    if (!url) return;
    Haptics.selectionAsync();
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.title}>Orders & Refills</Text>
          <Text style={styles.subtitle}>
            Track replenishments for your canonical routine.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Active & Past Refills */}
        {refillRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Icon name="shipping" size={28} color={colors.inkMuted} />
            </View>
            <Text style={styles.emptyTitle}>No active orders</Text>
            <Text style={styles.emptyText}>
              When you request a refill for any product in your routine, you can track fulfillment and delivery progress here.
            </Text>
            <Button
              label="Request a Refill"
              variant="secondary"
              size="medium"
              onPress={handleRequestRefill}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <View style={styles.ordersList}>
            {refillRequests.map((order) => {
              const currentStageIdx = getStageIndex(order.status);
              const isShipped = order.status === 'shipped';
              const isDelivered = order.status === 'delivered';

              return (
                <View key={order.id} style={styles.orderCard}>
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.brandName}>{order.brand.toUpperCase()}</Text>
                      <Text style={styles.productName}>{order.productName}</Text>
                    </View>
                    <Badge
                      label={order.status.toUpperCase()}
                      variant={
                        isDelivered
                          ? 'keep'
                          : isShipped
                          ? 'pause'
                          : 'neutral'
                      }
                      size="small"
                    />
                  </View>

                  {/* Visual Progress Steps */}
                  <View style={styles.progressTracker}>
                    {STAGES.map((stage, idx) => {
                      const isCompleted = idx <= currentStageIdx;
                      const isCurrent = idx === currentStageIdx;

                      return (
                        <React.Fragment key={stage.key}>
                          <View style={styles.stageNode}>
                            <View
                              style={[
                                styles.stageDot,
                                isCompleted && styles.stageDotActive,
                                isCurrent && styles.stageDotCurrent,
                              ]}
                            >
                              {isCompleted && (
                                <Icon
                                  name="check"
                                  size={10}
                                  color={colors.inkInverse}
                                />
                              )}
                            </View>
                            <Text
                              style={[
                                styles.stageLabel,
                                isCompleted && styles.stageLabelActive,
                              ]}
                            >
                              {stage.label}
                            </Text>
                          </View>
                          {idx < STAGES.length - 1 && (
                            <View
                              style={[
                                styles.stageLine,
                                idx < currentStageIdx && styles.stageLineActive,
                              ]}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </View>

                  {/* Fulfillment Details */}
                  <View style={styles.detailsBox}>
                    {order.estimatedDelivery && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Estimated Delivery</Text>
                        <Text style={styles.detailValueBold}>
                          {order.estimatedDelivery}
                        </Text>
                      </View>
                    )}

                    {order.carrier && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Carrier</Text>
                        <Text style={styles.detailValue}>{order.carrier}</Text>
                      </View>
                    )}

                    {order.trackingNumber && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Tracking Number</Text>
                        <Text style={styles.detailValueMono}>
                          {order.trackingNumber}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Requested Date</Text>
                      <Text style={styles.detailValue}>
                        {new Date(order.requestedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>

                  {/* External Tracking Link */}
                  {order.trackingUrl && (
                    <TouchableOpacity
                      style={styles.trackLinkRow}
                      onPress={() => handleOpenTracking(order.trackingUrl)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.trackLinkText}>View Carrier Tracking</Text>
                      <Icon name="forward" size={14} color={colors.brand} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Refill Policy Note */}
        <View style={styles.policyCard}>
          <Icon name="shipping" size={18} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.policyTitle}>Managed Refills</Text>
            <Text style={styles.policyText}>
              Product purchases and refills are separate from your Derive membership. First-10 Founding Beta replenishment is founder-assisted — tell us in one tap and we will coordinate the rest.
            </Text>
          </View>
        </View>

        {/* Action Button */}
        <Button
          label="Request a refill"
          variant="outline"
          size="medium"
          onPress={handleRequestRefill}
          style={{ marginTop: spacing.md }}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  ordersList: {
    gap: spacing.lg,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    ...shadows.subtle,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  brandName: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.semibold,
    color: colors.inkMuted,
    letterSpacing: 0.8,
  },
  productName: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginTop: 2,
  },
  progressTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  stageNode: {
    alignItems: 'center',
    zIndex: 1,
  },
  stageDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stageDotActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  stageDotCurrent: {
    transform: [{ scale: 1.15 }],
  },
  stageLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 4,
    marginBottom: 16,
  },
  stageLineActive: {
    backgroundColor: colors.brand,
  },
  stageLabel: {
    fontSize: 11,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
  stageLabelActive: {
    color: colors.ink,
    fontWeight: typography.weights.semibold,
  },
  detailsBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  detailValue: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
    fontWeight: typography.weights.medium,
  },
  detailValueBold: {
    fontSize: typography.sizes.caption,
    color: colors.brand,
    fontWeight: typography.weights.bold,
  },
  detailValueMono: {
    fontSize: typography.sizes.caption,
    fontFamily: 'monospace',
    color: colors.ink,
  },
  trackLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  trackLinkText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  policyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.brandLight,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  policyTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    color: colors.brand,
    marginBottom: 2,
  },
  policyText: {
    fontSize: typography.sizes.micro,
    color: colors.ink,
    lineHeight: 16,
  },
});
