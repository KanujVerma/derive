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
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { Button } from '@/src/components/ui/Button';

export default function FounderDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refillRequests, routine } = useRoutineStore();

  const betaCustomers = [
    {
      id: 'c1',
      name: 'Arthur Pendelton',
      email: 'arthur@derive.skin',
      goal: 'Breakouts',
      status: 'Routine Approved',
      onboarding: 'Complete',
      routineVersion: 1,
    },
    {
      id: 'c2',
      name: 'Eleanor Vance',
      email: 'eleanor@vance.com',
      goal: 'Barrier Repair & Dryness',
      status: 'Awaiting Routine Approval',
      onboarding: 'Complete',
      routineVersion: 1,
      needsAttention: true,
    },
    {
      id: 'c3',
      name: 'Marcus Chen',
      email: 'marcus@chen.design',
      goal: 'Texture & Oiliness',
      status: 'Assisted Setup Requested',
      onboarding: 'Step 6 (Shelf)',
      routineVersion: 0,
      needsAttention: true,
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.badge}>FOUNDER CONCIERGE</Text>
          <Text style={styles.screenTitle}>Operations Queue</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)')}
          style={styles.exitButton}
          accessible={true}
          accessibilityLabel="Switch back to customer view"
        >
          <Text style={styles.exitButtonText}>Customer View →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* SUMMARY METRICS (For 10 Beta Customers) */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>3 / 10</Text>
            <Text style={styles.metricLabel}>Beta Customers</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricNumber, { color: colors.actionStop.text }]}>1</Text>
            <Text style={styles.metricLabel}>Pending Approval</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricNumber, { color: colors.brand }]}>
              {refillRequests.length}
            </Text>
            <Text style={styles.metricLabel}>Refill Requests</Text>
          </View>
        </View>

        {/* PENDING ROUTINE REVIEW QUEUE */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pending Routine Approvals</Text>
          <Text style={styles.sectionSub}>AI proposed • Founder approved</Text>
        </View>

        <View style={styles.queueCard}>
          <View style={styles.queueCardHeader}>
            <View>
              <Text style={styles.customerName}>Eleanor Vance</Text>
              <Text style={styles.customerDetail}>Goal: Barrier Repair • 4 Shelf Products</Text>
            </View>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>NEEDS REVIEW</Text>
            </View>
          </View>
          <Text style={styles.queueNotes}>
            AI proposed: Differin 2x/week buffered with Toleriane Double Repair.
          </Text>
          <Button
            label="Review & Approve Routine"
            variant="brand"
            size="medium"
            onPress={() => router.push('/founder/review-routine')}
            style={{ marginTop: spacing.sm }}
          />
        </View>

        {/* CUSTOMER ROSTER */}
        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Beta Customer Roster</Text>
        </View>

        {betaCustomers.map((c) => (
          <View key={c.id} style={styles.customerCard}>
            <View style={styles.customerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cName}>{c.name}</Text>
                <Text style={styles.cEmail}>{c.email}</Text>
              </View>
              <View
                style={[
                  styles.statusTag,
                  c.needsAttention ? styles.statusTagAttention : styles.statusTagOk,
                ]}
              >
                <Text
                  style={[
                    styles.statusTagText,
                    c.needsAttention ? styles.statusTextAttention : styles.statusTextOk,
                  ]}
                >
                  {c.status}
                </Text>
              </View>
            </View>
            <Text style={styles.cMeta}>Onboarding: {c.onboarding} • Goal: {c.goal}</Text>
          </View>
        ))}

        {/* REFILL FULFILLMENT QUEUE */}
        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Refill Fulfillment Queue</Text>
        </View>

        {refillRequests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No pending refill requests right now.</Text>
          </View>
        ) : (
          refillRequests.map((r) => (
            <View key={r.id} style={styles.refillCard}>
              <View>
                <Text style={styles.refillProduct}>{r.productName}</Text>
                <Text style={styles.refillBrand}>{r.brand} • Customer: Arthur Pendelton</Text>
              </View>
              <Button
                label="Fulfill"
                variant="outline"
                size="medium"
                onPress={() => router.push('/founder/refills')}
              />
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
  badge: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.5,
    color: colors.brand,
  },
  screenTitle: {
    fontSize: typography.sizes.screenTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  exitButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exitButtonText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.subtle,
  },
  metricNumber: {
    fontSize: 22,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
    textAlign: 'center',
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
  },
  queueCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  queueCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  customerName: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  customerDetail: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  pendingBadge: {
    backgroundColor: colors.actionStop.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  pendingBadgeText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    color: colors.actionStop.text,
  },
  queueNotes: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    lineHeight: typography.lineHeights.bodyRegular,
    marginBottom: spacing.xs,
  },
  customerCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xxs,
  },
  cName: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  cEmail: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  statusTag: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  statusTagOk: {
    backgroundColor: colors.actionKeep.bg,
  },
  statusTagAttention: {
    backgroundColor: colors.actionStop.bg,
  },
  statusTagText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
  },
  statusTextOk: {
    color: colors.actionKeep.text,
  },
  statusTextAttention: {
    color: colors.actionStop.text,
  },
  cMeta: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
  emptyCard: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
  },
  refillCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  refillProduct: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  refillBrand: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
  },
});
