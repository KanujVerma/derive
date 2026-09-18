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
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { analytics } from '@/src/services/analytics';
import { requestProductRefill } from '@/src/services/deriveClient';

export default function RefillModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { routine, refillRequests } = useRoutineStore();

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deduplicate products across AM and PM steps
  const steps = [...(routine?.amSteps || []), ...(routine?.pmSteps || [])];
  const uniqueProducts = Array.from(
    new Map(steps.map((s) => [s.productId, s])).values()
  );

  const handleRequest = async () => {
    if (!selectedProductId) return;
    const target = uniqueProducts.find((p) => p.productId === selectedProductId);
    if (!target) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await requestProductRefill({
        productId: target.productId,
        productName: target.productName,
        brand: target.brand,
      });

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      analytics.track('refill_requested', { productCategory: target.category });
      setSubmitted(true);
    } catch (err: any) {
      console.warn('Refill request failed:', err);
      setError(err?.message || 'Refill request failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.successContent}>
          <View style={styles.successIconCircle}>
            <Icon name="check" size={28} color={colors.brand} />
          </View>
          <Text style={styles.successHeadline}>Refill Requested</Text>
          <Text style={styles.successMessage}>
            We received your request and will notify you as soon as it ships.
          </Text>
          <Button
            label="Done"
            variant="primary"
            size="large"
            onPress={() => router.back()}
            style={{ width: '100%', marginTop: spacing.xl }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.screenTitle}>Running Low?</Text>
          <Text style={styles.screenSubtitle}>
            Select the product you need replenished.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Close refill modal"
        >
          <Icon name="close" size={20} color={colors.inkMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeader}>Your Routine Products</Text>

        {uniqueProducts.length > 0 ? (
          <View style={styles.productsList}>
            {uniqueProducts.map((p) => {
              const isSelected = selectedProductId === p.productId;
              return (
                <TouchableOpacity
                  key={p.productId}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedProductId(p.productId);
                  }}
                  style={[styles.productCard, isSelected && styles.productCardSelected]}
                  activeOpacity={0.7}
                  accessible={true}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                >
                  <View style={styles.radioDot}>
                    {isSelected && <View style={styles.radioDotInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productBrand}>{p.brand}</Text>
                    <Text style={[styles.productName, isSelected && styles.productNameSelected]}>
                      {p.productName}
                    </Text>
                    <Text style={styles.productCategory}>{p.category.toUpperCase()} • {p.amount}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Icon name="sparkle" size={24} color={colors.inkMuted} />
            <Text style={styles.emptyCardTitle}>No routine products yet</Text>
            <Text style={styles.emptyCardText}>
              Once your personalized routine is activated, your scheduled products will appear here for 1-tap managed replenishment.
            </Text>
          </View>
        )}

        {/* Existing Requests */}
        {refillRequests.length > 0 && (
          <View style={styles.existingSection}>
            <Text style={styles.sectionHeader}>Active Requests</Text>
            {refillRequests.map((req) => (
              <View key={req.id} style={styles.requestRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestProductName}>{req.brand} {req.productName}</Text>
                  <Text style={styles.requestStatusText}>Status: {req.status.toUpperCase()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Icon name="warning" size={16} color={colors.actionStop.text} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {uniqueProducts.length > 0 && (
          <Button
            label={isSubmitting ? 'Submitting...' : 'Request Refill'}
            variant="primary"
            size="large"
            loading={isSubmitting}
            disabled={!selectedProductId || isSubmitting}
            onPress={handleRequest}
            style={{ marginTop: error ? spacing.md : spacing.xl }}
          />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
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
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionHeader: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  productsList: {
    gap: spacing.xs,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    ...shadows.subtle,
  },
  productCardSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.surfaceElevated,
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  productBrand: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.brand,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  productName: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  productNameSelected: {
    color: colors.brand,
  },
  productCategory: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  existingSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  requestRow: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  requestProductName: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  requestStatusText: {
    fontSize: typography.sizes.caption,
    color: colors.brand,
    marginTop: 2,
    fontWeight: typography.weights.medium,
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: radii.full,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successHeadline: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  successMessage: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  emptyCardTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyCardText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.actionStop.bg,
    borderColor: colors.actionStop.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.caption,
    color: colors.actionStop.text,
    fontWeight: typography.weights.medium,
  },
});
