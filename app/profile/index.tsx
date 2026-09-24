import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useUserStore } from '@/src/stores/userStore';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useRoutineStore } from '@/src/stores/routineStore';
import { Icon } from '@/src/components/ui/Icon';
import { BuildDiagnostics } from '@/src/components/ui/BuildDiagnostics';
import { Badge } from '@/src/components/ui/Badge';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { config } from '@/src/constants/config';
import { publicEnvironment, publicLegalLinks } from '@/src/config/environment';
import { PublicLegalLinks } from '@/src/components/account/PublicLegalLinks';
import { shouldOfferStripeMembershipManagement, usesFreeExternalBetaPresentation } from '@/src/utils/membershipPresentation';
import { deleteCurrentAccount } from '@/src/services/accountDeletion';
import { createMembershipPortalSession, hydrateCustomerProfile, refreshCustomerBootstrap } from '@/src/services/deriveClient';
import { signOutSession } from '@/src/services/authClient';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { getCustomerErrorMessage } from '@/src/utils/customerErrors';
import { useAuthStore } from '@/src/stores/authStore';
import { PreviewAccountShell } from '@/src/components/account/PreviewAccountShell';
import { resolveShellPresentation } from '@/src/utils/shellPresentation';
import { FreeAccountShell } from '@/src/components/account/FreeAccountShell';
import { useFreeAccessStore } from '@/src/stores/freeAccessStore';

export default function ProfileScreen() {
  const shell = resolveShellPresentation({
    buildFlavor: publicEnvironment.buildFlavor,
    remoteEnabled: isRemoteServiceEnabled(),
    supabaseUrl: publicEnvironment.supabaseUrl,
  });
  const access = useFreeAccessStore((s) => s.status === 'READY' ? s.access : null);
  if (shell === 'scanner_first_preview') return <PreviewAccountShell />;
  if (shell === 'local_free_integration' && !access) return null;
  if (shell === 'local_free_integration' && access && !access.managedAccess) return <FreeAccountShell identityKind={access.identityKind} />;
  return <LegacyProfileScreen />;
}

function LegacyProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fullName, email, loadArthurDemoUser, resetToDefault } = useUserStore();
  const { productReactions, loadArthurDemoState, resetOnboarding } = useOnboardingStore();
  const { loadArthurDemoRoutine, resetRoutine } = useRoutineStore();
  const [billingBusy, setBillingBusy] = React.useState(false);
  const [billingError, setBillingError] = React.useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = React.useState(false);
  const offerStripeMembership = shouldOfferStripeMembershipManagement(
    publicEnvironment.buildFlavor,
    isRemoteServiceEnabled(),
  );
  const freeBeta = usesFreeExternalBetaPresentation(publicEnvironment.buildFlavor);

  React.useEffect(() => {
    hydrateCustomerProfile().catch((err) => {
      console.warn('Failed to hydrate customer profile:', err);
    });
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleRowPress = (destination: string) => {
    Haptics.selectionAsync();
    router.push(destination as any);
  };

  const handleContactSupport = () => {
    Haptics.selectionAsync();
    if (freeBeta) {
      if (publicLegalLinks.supportUrl) void Linking.openURL(publicLegalLinks.supportUrl);
      else Alert.alert('Support', 'Support is not available right now. Please try again.');
      return;
    }
    if (!config.founderSupportEmail) {
      router.push('/(tabs)/ask');
      return;
    }
    Alert.alert(
      'Derive Member Support',
      `For routine questions or adjustments, ask directly in the Ask tab or email ${config.founderSupportEmail}.`,
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
      'Loaded Arthur Pendelton demo fixture (Differin schedule, 4 products, 1 check-in).',
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

  const completeSignOut = async () => {
    const res = await signOutSession();
    if (res.success) {
      if (isRemoteServiceEnabled()) {
        router.replace('/(auth)/login');
      } else {
        router.replace('/(onboarding)/1-welcome');
      }
    } else if (Platform.OS === 'web') {
      window.alert(res.error || getCustomerErrorMessage('auth_signout'));
    } else {
      Alert.alert('Sign Out', res.error || getCustomerErrorMessage('auth_signout'), [{ text: 'OK' }]);
    }
  };

  const handleSignOut = () => {
    const message = 'Are you sure you want to sign out? Your stored routine and session data on this device will be cleared.';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) void completeSignOut();
      return;
    }
    Alert.alert(
      'Sign Out',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => void completeSignOut(),
        },
      ]
    );
  };

  const completeAccountDeletion = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    setBillingError(null);
    const result = await deleteCurrentAccount();
    if (result.success) {
      router.replace('/(auth)/login');
      return;
    }
    setDeletingAccount(false);
    const message = result.error || getCustomerErrorMessage('auth_delete_account');
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Delete Account', message, [{ text: 'OK' }]);
    }
  };

  const handleDeleteAccount = () => {
    if (deletingAccount) return;
    const message = "This permanently deletes your Derive account, onboarding information, stored photos, routine history, and other account data. This can't be undone.";
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete your account?\n\n${message}`)) void completeAccountDeletion();
      return;
    }
    Alert.alert(
      'Delete your account?',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => void completeAccountDeletion(),
        },
      ],
    );
  };

  const handleManageMembership = async () => {
    if (billingBusy) return;
    setBillingBusy(true);
    setBillingError(null);
    try {
      const session = await createMembershipPortalSession();
      await Linking.openURL(session.url);
      const id = useAuthStore.getState().sessionUserId;
      if (id && isRemoteServiceEnabled()) void refreshCustomerBootstrap(id);
    } catch {
      setBillingError('Billing settings could not be opened. Please try again.');
    } finally {
      setBillingBusy(false);
    }
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
          <Text style={styles.subtitle}>{freeBeta ? 'Founding Beta Access' : 'Founding Beta Membership'}</Text>
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
            {email ? <Text style={styles.memberEmail}>{email}</Text> : null}
            <View style={styles.badgeRow}>
              <Badge label="FOUNDING BETA" variant="keep" size="small" />
              {!freeBeta ? <Text style={styles.memberPrice}>${config.betaPriceMonthly}/mo</Text> : null}
            </View>
            <Text style={styles.memberClarification}>
              Membership covers Derive's ongoing skincare management. Products are purchased separately.
            </Text>
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

        {/* Section 2: Working in-app help; human contact appears only when configured. */}
        <GroupedSection header="Help">
          <TouchableOpacity
            style={styles.groupedRow}
            onPress={handleContactSupport}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={freeBeta ? 'Support' : config.founderSupportEmail ? 'Member Support' : 'Ask Derive'}
          >
            <Icon name="person" size={18} color={colors.brand} />
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>{freeBeta ? 'Support' : config.founderSupportEmail ? 'Member Support' : 'Ask Derive'}</Text>
              <Text style={styles.rowSubtitle}>{freeBeta ? 'Contact Derive support' : config.founderSupportEmail ? 'Contact the Founding Beta team' : 'Questions about your routine and products'}</Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>

        </GroupedSection>

        {/* Section 3: Account & Session */}
        <GroupedSection header="Account">
          {offerStripeMembership && (
            <TouchableOpacity
              style={styles.groupedRow}
              onPress={() => void handleManageMembership()}
              disabled={billingBusy || deletingAccount}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Manage Membership"
            >
              <Icon name="shield" size={18} color={colors.brand} />
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Manage Membership</Text>
                <Text style={styles.rowSubtitle}>{billingBusy ? 'Opening billing settings…' : 'Open secure billing settings'}</Text>
              </View>
              <Icon name="forward" size={16} color={colors.inkMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.groupedRow}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Delete Account"
          >
            <Icon name="warning" size={18} color={colors.actionPause.text} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.actionPause.text }]}>
                {deletingAccount ? 'Deleting account…' : 'Delete Account'}
              </Text>
              <Text style={styles.rowSubtitle}>Permanently delete your Derive account and stored data</Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.groupedRow}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Icon name="back" size={18} color={colors.actionPause.text} />
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: colors.actionPause.text }]}>Sign Out</Text>
              <Text style={styles.rowSubtitle}>End session on this device</Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </TouchableOpacity>
        </GroupedSection>
        {billingError ? <Text style={{ color: colors.actionPause.text, marginTop: spacing.sm }}>{billingError}</Text> : null}

        {/* Section 4: Demo & Development Controls (dev only) */}
        {__DEV__ && (
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
        )}

        {/* Footer Note */}
        <PublicLegalLinks />
        <BuildDiagnostics />
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
  memberClarification: {
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.caption,
    marginTop: 8,
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
