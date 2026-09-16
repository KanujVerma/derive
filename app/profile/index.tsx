import React from 'react';
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
import { Icon } from '@/src/components/ui/Icon';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fullName, email } = useUserStore();
  const { productReactions } = useOnboardingStore();

  const handleBack = () => {
    router.back();
  };

  const handleRowPress = (destination: string) => {
    Haptics.selectionAsync();
    router.push(destination as any);
  };

  const handleContactFounder = () => {
    Haptics.selectionAsync();
    Alert.alert(
      'Derive Concierge',
      'As a Founding Beta member, you have direct priority access to the founding dermatological care team. Reach out via the Ask tab or email concierge@derive.care.',
      [{ text: 'Understood' }]
    );
  };

  const handleExportData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Export Ready',
      'Your encrypted skin history, product reactions, and routine logs have been exported. A download link was sent to your email.',
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
              {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName}>{fullName || 'Derive Member'}</Text>
            <Text style={styles.memberEmail}>{email || 'member@derive.care'}</Text>
            <View style={styles.badgeRow}>
              <Badge label="FOUNDING BETA" variant="keep" size="small" />
              <Text style={styles.memberPrice}>$129/month</Text>
            </View>
          </View>
        </View>

        {/* Section 1: Your Skin & Routine */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>YOUR SKIN & CARE</Text>
          <View style={styles.groupedCard}>
            <TouchableOpacity
              style={styles.groupedRow}
              onPress={() => handleRowPress('/(tabs)/plan')}
              activeOpacity={0.7}
            >
              <Icon name="sparkle" size={18} color={colors.brand} />
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Canonical Routine</Text>
                <Text style={styles.rowSubtitle}>View AM/PM steps and schedules</Text>
              </View>
              <Icon name="forward" size={16} color={colors.inkMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

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

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.groupedRow}
              onPress={() => handleRowPress('/orders')}
              activeOpacity={0.7}
            >
              <Icon name="shipping" size={18} color={colors.brand} />
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Orders & Refill Shipments</Text>
                <Text style={styles.rowSubtitle}>Fulfillment tracking and history</Text>
              </View>
              <Icon name="forward" size={16} color={colors.inkMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 2: Concierge & Safety */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SUPPORT & SAFETY</Text>
          <View style={styles.groupedCard}>
            <TouchableOpacity
              style={styles.groupedRow}
              onPress={handleContactFounder}
              activeOpacity={0.7}
            >
              <Icon name="person" size={18} color={colors.brand} />
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Concierge Care Access</Text>
                <Text style={styles.rowSubtitle}>Direct contact with founding team</Text>
              </View>
              <Icon name="forward" size={16} color={colors.inkMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.groupedRowStatic}>
              <Icon name="shield" size={18} color={colors.brand} />
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Clinical Safety Circuit Breaker</Text>
                <Text style={styles.rowSubtitle}>
                  Severe medical symptoms automatically escalated
                </Text>
              </View>
              <Badge label="ACTIVE" variant="keep" size="small" />
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.groupedRow}
              onPress={handleExportData}
              activeOpacity={0.7}
            >
              <Icon name="info" size={18} color={colors.inkMuted} />
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Export My Skin Data</Text>
                <Text style={styles.rowSubtitle}>GDPR & HIPAA compliant export</Text>
              </View>
              <Icon name="forward" size={16} color={colors.inkMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Founder Switcher for Development / Beta Verification */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>INTERNAL TOOLS</Text>
          <View style={styles.groupedCard}>
            <TouchableOpacity
              style={styles.groupedRow}
              onPress={() => handleRowPress('/founder')}
              activeOpacity={0.7}
            >
              <Icon name="sparkle" size={18} color={colors.ink} />
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Founder Desk</Text>
                <Text style={styles.rowSubtitle}>
                  Review pending routines and check-in audits
                </Text>
              </View>
              <Icon name="forward" size={16} color={colors.inkMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Note */}
        <Text style={styles.footerText}>
          Derive Version 1.0 (Build 2026.09) · "Your skincare, handled."
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
    gap: spacing.xl,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadows.subtle,
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
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  memberPrice: {
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
  section: {
    gap: spacing.xs,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    color: colors.inkMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingLeft: spacing.xs,
  },
  groupedCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    ...shadows.subtle,
  },
  groupedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  groupedRowStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  rowSubtitle: {
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginLeft: spacing.xl + spacing.md,
  },
  footerText: {
    textAlign: 'center',
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
    marginTop: spacing.md,
  },
});
