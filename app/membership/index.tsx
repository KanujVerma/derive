import React from 'react';
import { AppState, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/src/components/ui/Button';
import { BuildDiagnostics } from '@/src/components/ui/BuildDiagnostics';
import { colors, radii, spacing, typography } from '@/src/constants/theme';
import { config } from '@/src/constants/config';
import { publicEnvironment } from '@/src/config/environment';
import { useAuthStore } from '@/src/stores/authStore';
import { useBootstrapStore } from '@/src/stores/bootstrapStore';
import { createMembershipCheckoutSession, createMembershipPortalSession, refreshCustomerBootstrap } from '@/src/services/deriveClient';
import { pollForActiveMembership } from '@/src/services/membershipActivation';
import { signOutSession } from '@/src/services/authClient';
import { usesConciergeMembershipAccess } from '@/src/utils/membershipPresentation';
import { confirmAndDeleteAccount } from '@/src/components/account/confirmAccountDeletion';
import { PublicLegalLinks } from '@/src/components/account/PublicLegalLinks';

const paidValuePoints = [
  'A personalized routine with ongoing adjustments',
  'Weekly check-ins and Progress history',
  'Personalized product Scan and Ask',
  'Product-fit guidance and founder quality review during beta',
];
const freeBetaValuePoints = [
  'A personalized routine with ongoing adjustments',
  'Weekly check-ins and Progress history',
  'Product-fit guidance and founder quality review during beta',
];

export default function MembershipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.sessionUserId);
  const membershipStatus = useBootstrapStore((state) => state.bootstrapState?.membershipStatus ?? 'none');
  const refreshError = useBootstrapStore((state) => state.errorMessage);
  const conciergeAccess = usesConciergeMembershipAccess(publicEnvironment.buildFlavor);
  const [busy, setBusy] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [activationPending, setActivationPending] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const mounted = React.useRef(true);
  const pending = React.useRef(false);
  const polling = React.useRef(false);

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refreshAccess = React.useCallback(async () => {
    if (!userId) return;
    if (mounted.current) { setChecking(true); setNotice(null); }
    try {
      await refreshCustomerBootstrap(userId);
    } catch {
      if (mounted.current) {
        setNotice("We couldn't refresh your access right now. Please try again.");
      }
    } finally {
      if (mounted.current) setChecking(false);
    }
  }, [userId]);

  const checkActivation = React.useCallback(async () => {
    if (!userId || polling.current || conciergeAccess) return;
    polling.current = true;
    if (mounted.current) { setChecking(true); setNotice(null); }
    try {
      const outcome = await pollForActiveMembership({
        attempts: 5,
        delaysMs: [1000, 2000, 4000, 8000],
        read: () => refreshCustomerBootstrap(userId),
        wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        isCurrent: () => mounted.current && useAuthStore.getState().sessionUserId === userId,
      });
      if (mounted.current && outcome === 'pending') {
        setNotice("If you completed payment, we're still confirming your membership. Try Again shortly.");
      }
    } finally {
      polling.current = false;
      if (mounted.current) setChecking(false);
    }
  }, [userId, conciergeAccess]);

  React.useEffect(() => {
    if (conciergeAccess) return;
    let previousState = AppState.currentState;
    const onReturn = () => { if (pending.current) void checkActivation(); };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && previousState !== 'active') onReturn();
      previousState = state;
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') onReturn();
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', onReturn);
      document.addEventListener('visibilitychange', onVisible);
    }
    return () => {
      sub.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', onReturn);
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, [checkActivation, conciergeAccess]);

  const openHostedSession = async (kind: 'checkout' | 'portal') => {
    if (busy || conciergeAccess) return;
    setBusy(true);
    setNotice(null);
    try {
      const session = kind === 'checkout'
        ? await createMembershipCheckoutSession()
        : await createMembershipPortalSession();
      await Linking.openURL(session.url);
      pending.current = true;
      if (mounted.current) setActivationPending(true);
      void checkActivation();
    } catch {
      if (mounted.current) {
        setNotice(kind === 'checkout'
          ? 'Checkout could not be opened. Please try again.'
          : 'Billing settings could not be opened. Please try again.');
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const handleRetry = () => {
    if (activationPending) {
      void checkActivation();
    } else if (userId) {
      void refreshCustomerBootstrap(userId);
    }
  };

  const handleDeleteAccount = async () => {
    if (busy || checking) return;
    setBusy(true);
    const deleted = await confirmAndDeleteAccount();
    if (deleted) {
      router.replace('/(auth)/login');
      return;
    }
    if (mounted.current) setBusy(false);
  };

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);
    const result = await signOutSession();
    if (result.success) {
      router.replace('/(auth)/login');
    } else if (mounted.current) {
      setNotice(result.error || 'Sign out could not be completed. Please try again.');
      setBusy(false);
    }
  };

  const statusMessage = conciergeAccess
    ? "We couldn't finish opening your beta access automatically."
    : membershipStatus === 'paused'
      ? 'Managed skincare access is paused. Open billing settings to review your subscription.'
      : membershipStatus === 'cancelled'
        ? 'Your membership has ended. You can start a new Checkout when you are ready.'
        : 'Your skincare, handled.';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.overline}>{conciergeAccess ? 'DERIVE BETA ACCESS' : 'DERIVE MEMBERSHIP'}</Text>
        <Text style={styles.title}>Founding Beta</Text>
        {conciergeAccess ? null : <Text style={styles.price}>${config.betaPriceMonthly}/month</Text>}
        <Text style={styles.body}>{statusMessage}</Text>
        {conciergeAccess ? (
          <Text style={styles.body}>Please try again. Beta access does not require payment or founder approval.</Text>
        ) : null}

        <View style={styles.card}>
          {(conciergeAccess ? freeBetaValuePoints : paidValuePoints).map((point) => <Text key={point} style={styles.point}>• {point}</Text>)}
          <Text style={styles.separation}>Products are purchased separately.</Text>
        </View>

        {conciergeAccess ? (
          <Button
            label={checking ? 'Checking access…' : 'Try Again'}
            variant="brand"
            onPress={() => void refreshAccess()}
            loading={checking}
            disabled={checking || busy || !userId}
            style={styles.action}
          />
        ) : activationPending ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>{checking ? 'Activating your membership…' : 'Membership confirmation pending'}</Text>
            <Text style={styles.body}>Access opens only after Derive confirms your membership from the billing service.</Text>
            <Button label="Try Again" variant="secondary" size="medium" onPress={handleRetry} disabled={checking || busy} style={styles.action} />
            {!checking && <Button label="Open Checkout Again" variant="outline" size="medium" onPress={() => void openHostedSession('checkout')} disabled={busy} style={styles.action} />}
          </View>
        ) : membershipStatus === 'none' ? (
          <Button label="Start Founding Beta" variant="brand" onPress={() => void openHostedSession('checkout')} loading={busy} style={styles.action} />
        ) : membershipStatus === 'paused' ? (
          <>
            <Button label="Manage Billing" variant="brand" onPress={() => void openHostedSession('portal')} loading={busy} style={styles.action} />
            <Button label="Start a new Checkout" variant="secondary" onPress={() => void openHostedSession('checkout')} disabled={busy} style={styles.action} />
          </>
        ) : membershipStatus === 'cancelled' ? (
          <>
            <Button label="Restart Membership" variant="brand" onPress={() => void openHostedSession('checkout')} loading={busy} style={styles.action} />
            <Button label="Manage Billing" variant="secondary" onPress={() => void openHostedSession('portal')} disabled={busy} style={styles.action} />
          </>
        ) : null}

        {notice || refreshError ? <Text style={styles.notice}>{notice || refreshError}</Text> : null}
        {!conciergeAccess && !activationPending ? <Button label="Refresh Membership" variant="ghost" onPress={handleRetry} disabled={busy} style={styles.action} /> : null}
        <Button label="Sign Out" variant="ghost" onPress={() => void handleSignOut()} disabled={busy} style={styles.signOut} />
        <Button label="Delete Account" variant="ghost" onPress={() => void handleDeleteAccount()} disabled={busy || checking} style={styles.signOut} />
        <PublicLegalLinks />
        <BuildDiagnostics />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  overline: { color: colors.brand, fontSize: typography.sizes.caption, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: colors.ink, fontFamily: typography.fontFamilies.serif, fontSize: 38, marginTop: spacing.md },
  price: { color: colors.brand, fontSize: typography.sizes.sectionTitle, fontWeight: '700', marginTop: spacing.sm },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: 23, marginTop: spacing.md },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg, marginTop: spacing.xl },
  point: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: 25, marginBottom: spacing.sm },
  separation: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, marginTop: spacing.sm },
  statusCard: { backgroundColor: colors.brandLight, borderRadius: radii.md, padding: spacing.lg, marginTop: spacing.xl },
  statusTitle: { color: colors.brandDark, fontSize: typography.sizes.bodyRegular, fontWeight: '700' },
  action: { marginTop: spacing.md },
  notice: { color: colors.actionPause.text, fontSize: typography.sizes.bodyRegular, marginTop: spacing.md },
  signOut: { marginTop: spacing.xl },
});
