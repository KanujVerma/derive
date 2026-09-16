import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { Button } from '@/src/components/ui/Button';

export default function FounderRefillsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refillRequests, updateRefillStatus } = useRoutineStore();
  const [trackingNumber, setTrackingNumber] = useState('USPS-9400100020003000400050');

  const handleStatusUpdate = async (id: string, status: 'ordered' | 'shipped' | 'delivered') => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    updateRefillStatus(id, status, status === 'shipped' ? trackingNumber : undefined);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessible={true}
          accessibilityLabel="Back to operations queue"
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Refill Fulfillment</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.infoText}>
          Standard third-party products are fulfilled manually during V1 Founding Beta.
        </Text>

        {refillRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No refill requests pending.</Text>
          </View>
        ) : (
          refillRequests.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.productName}>{r.productName}</Text>
                  <Text style={styles.brand}>{r.brand} • Customer: Arthur Pendelton</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{r.status.toUpperCase()}</Text>
                </View>
              </View>

              {r.status === 'ordered' && (
                <View style={styles.trackingInputBox}>
                  <Text style={styles.inputLabel}>Tracking Number</Text>
                  <TextInput
                    value={trackingNumber}
                    onChangeText={setTrackingNumber}
                    style={styles.trackingInput}
                  />
                </View>
              )}

              {/* ACTION BUTTONS BASED ON CURRENT STATUS */}
              <View style={styles.actionsRow}>
                {r.status === 'requested' && (
                  <Button
                    label="Mark as Ordered"
                    variant="primary"
                    size="medium"
                    onPress={() => handleStatusUpdate(r.id, 'ordered')}
                    style={{ flex: 1 }}
                  />
                )}
                {r.status === 'ordered' && (
                  <Button
                    label="Mark Shipped"
                    variant="brand"
                    size="medium"
                    onPress={() => handleStatusUpdate(r.id, 'shipped')}
                    style={{ flex: 1 }}
                  />
                )}
                {r.status === 'shipped' && (
                  <Button
                    label="Mark Delivered"
                    variant="secondary"
                    size="medium"
                    onPress={() => handleStatusUpdate(r.id, 'delivered')}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </View>
          ))
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
    paddingVertical: spacing.xs,
  },
  backText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.brand,
    fontWeight: typography.weights.semibold,
  },
  screenTitle: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  infoText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  productName: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  brand: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  badge: {
    backgroundColor: colors.brandLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  badgeText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.brand,
  },
  trackingInputBox: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginBottom: spacing.xxs,
  },
  trackingInput: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xs,
    padding: spacing.sm,
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  emptyCard: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.xl,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  emptyText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
  },
});
