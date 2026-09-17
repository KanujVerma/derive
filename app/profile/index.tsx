import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useUserStore } from '@/src/stores/userStore';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useRoutineStore } from '@/src/stores/routineStore';
import { calculateMonthlyPlanPrice, formatCentsToDollars } from '@/src/pricing';
import { Icon } from '@/src/components/ui/Icon';
import { Badge } from '@/src/components/ui/Badge';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { config } from '@/src/constants/config';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fullName, email, loadArthurDemoUser, resetToDefault } = useUserStore();
  const { detectedProducts, productReactions, loadArthurDemoState, resetOnboarding } = useOnboardingStore();
  const { routine, isPlanUnderReview, loadArthurDemoRoutine, resetRoutine } = useRoutineStore();

  const activeProducts = useMemo(() => {
    if (routine) {
      const allSteps = [...routine.amSteps, ...routine.pmSteps];
      return allSteps.map((s) => ({
        id: s.productId,
        name: s.productName,
        brand: s.brand,
      }));
    }
    return detectedProducts;
  }, [routine, detectedProducts]);

  const pricingEstimate = useMemo(() => {
    return calculateMonthlyPlanPrice(activeProducts);
  }, [activeProducts]);

  const handleBack = () => {
    router.back();
  };

  const handleRowPress = (destination: string) => {
    Haptics.selectionAsync();
    router.push(destination as any);
  };

  const handleContactSupport = () => {
    Haptics.selectionAsync();
    Alert.alert(
      'Derive Member Support',
      `For routine questions or adjustments, ask directly in the Ask tab or email ${config.founderSupportEmail}.`,
      [{ text: 'OK' }]
    );
  };

  const handleExportData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Export Requested',
      'Export request received. Your care concierge will compile your skin observations and routine history archive.',
      [{ text: 'OK' }]
    );
  };

  const handleLoadDemo = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadArthurDemoUser();
    loadArthurDemoRoutine();
    loadArthurDemoState();
    Alert.alert(
      'Demo Routine Loaded',
      'Loaded Arthur Pendelton demo fixture ($96/mo illustrative plan, Differin schedule, 4 products, 1 check-in).',
      [{ text: 'OK' }]
    );
  };

  const handleResetToClean = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    resetToDefault();
    resetRoutine();
    resetOnboarding();
    Alert.alert(
      'State Reset',
      'Reset to clean customer state (no active routine, no check-ins, uninitialized plan).',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
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
          <Text style={styles.title}>Account</Text>
          <Text style={styles.subtitle}>Founding Beta Membership</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Member Card */}
        <View style={styles.memberCard}>
          <View style={styles.memberAvatar}>
            <Text style={styles.avatarInitial}>
              {fullName ? fullName.charAt(0).toUpperCase() : 'M'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName}>{fullName || 'Derive Member'}</Text>
            <Text style={styles.memberEmail}>{email || 'member@derive.skin'}</Text>
            <View style={styles.badgeRow}>
              <Badge label="FOUNDING BETA" variant="keep" size="small" />
              <Text style={styles.memberPrice}>${config.betaPriceMonthly}/mo</Text>
            </View>
          </View>
        </View>

        {/* Section 1: Routine & Care */}
        <GroupedSection header="Your Care & History">
          <TouchableOpacity
            style={styles.groupedRow}
            onPress={() => handleRowPress('/(tabs)/plan')}
            activeOpacity={0.7}
          >
            <Icon name="sparkle" size={18} color={colors.brand} />
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Active Routine</Text>
              <Text style={styles.rowSubtitle}>View AM/PM steps and active schedules</Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.groupedRow}
            onPress={() => handleRowPress('/reaction-history')}
            activeOpacity={0.7}
          >
            <Icon name="warning" size={18} color={colors.inkMuted} />
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Product Reaction History</Text>
              <Text style={styles.rowSubtitle}>
                {productReactions?.length || 0} audited reaction{productReactions?.length === 1 ? '' : 's'}
              </Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.groupedRow}
            onPress={() => handleRowPress('/orders')}
            activeOpacity={0.7}
          >
            <Icon name="shipping" size={18} color={colors.brand} />
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Orders & Managed Refills</Text>
              <Text style={styles.rowSubtitle}>Fulfillment tracking and order history</Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>
        </GroupedSection>

        {/* Section 2: Support & Privacy */}
        <GroupedSection header="Support & Privacy">
          <TouchableOpacity
            style={styles.groupedRow}
            onPress={handleContactSupport}
            activeOpacity={0.7}
          >
            <Icon name="person" size={18} color={colors.brand} />
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Member Support</Text>
              <Text style={styles.rowSubtitle}>Assistance with products and routine timing</Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.groupedRow}
            onPress={handleExportData}
            activeOpacity={0.7}
          >
            <Icon name="info" size={18} color={colors.inkMuted} />
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Export Personal Data</Text>
              <Text style={styles.rowSubtitle}>Download your skin logs and routine record</Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>
        </GroupedSection>

        {/* Section 3: Demo & Development Controls */}
        <GroupedSection header="Demo & Development Controls">
          <TouchableOpacity
            style={styles.groupedRow}
            onPress={handleLoadDemo}
            activeOpacity={0.7}
          >
            <Icon name="sparkle" size={18} color={colors.brand} />
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Load Arthur Demo Fixture</Text>
              <Text style={styles.rowSubtitle}>Load 4-product routine, check-in, and Differin schedule</Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.groupedRow}
            onPress={handleResetToClean}
            activeOpacity={0.7}
          >
            <Icon name="progress" size={18} color={colors.actionPause.text} />
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Reset to Clean Member State</Text>
              <Text style={styles.rowSubtitle}>Clear active routine, check-ins, and pending plans</Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.groupedRow}
            onPress={() => handleRowPress('/founder')}
            activeOpacity={0.7}
          >
            <Icon name="person" size={18} color={colors.inkMuted} />
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>Founder Review Queue</Text>
              <Text style={styles.rowSubtitle}>Internal concierge plan approval console</Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>
        </GroupedSection>

        {/* Footer Note */}
        <Text style={styles.footerText}>
          Derive Version 1.0 · "Your skincare, handled."
        </Text>
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
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.sectionTitle,
    lineHeight: typography.lineHeights.sectionTitle,
    color: colors.ink,
  },
  subtitle: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
    marginBottom: spacing.xs,
  },
  memberAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarInitial: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    color: colors.brand,
  },
  memberName: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  memberEmail: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 6,
  },
  memberPrice: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
  groupedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  rowContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  rowTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  rowSubtitle: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 1,
  },
  footerText: {
    textAlign: 'center',
    fontSize: typography.sizes.micro,
    color: colors.inkSubtle,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
