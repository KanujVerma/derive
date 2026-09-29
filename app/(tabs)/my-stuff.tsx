import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { describeCanonicalMyStuff } from '@/src/presentation/personal-decision/customerController';
import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';
import { Button } from '@/src/components/ui/Button';
import { customerController, currentCustomerOwner } from '@/src/presentation/personal-decision/customerGateway';
import { MyStuffContent } from '@/src/components/my-stuff/MyStuffContent';
import { RootShellHeader } from '@/src/components/shell/RootShellHeader';
import { colors, layout, spacing } from '@/src/constants/theme';
import { anonymousEmptyMyStuff } from '@/src/fixtures/my-stuff/myStuffFixtures';
import { publicEnvironment } from '@/src/config/environment';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { myStuffStore } from '@/src/presentation/my-stuff/myStuffRemote';
import type { ProductState } from '@/src/presentation/my-stuff/myStuffPresentation';
import { useAuthStore } from '@/src/stores/authStore';
import { useFreeAccessStore } from '@/src/stores/freeAccessStore';
import { isFreeIntegrationShell, resolveShellPresentation } from '@/src/utils/shellPresentation';

/** MyStuffContent composes the shared GroupedSection rows; this route owns live free context. */
export default function MyStuffScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sessionUserId = useAuthStore((state) => state.sessionUserId);
  const authStatus = useAuthStore((state) => state.status);
  const accessReady = useFreeAccessStore((state) => state.status === 'READY'
    && state.userId === sessionUserId && state.access?.userId === sessionUserId);
  const customerState = useSyncExternalStore(customerController.subscribe, customerController.getState);
  const ownerId = useStore(myStuffStore, (state) => state.ownerId);
  const model = useStore(myStuffStore, (state) => state.model);
  const status = useStore(myStuffStore, (state) => state.status);
  const error = useStore(myStuffStore, (state) => state.error);
  const cursors = useStore(myStuffStore, (state) => state.cursors);
  const loadingMore = useStore(myStuffStore, (state) => state.loadingMore);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const shell = resolveShellPresentation({
    buildFlavor: publicEnvironment.buildFlavor,
    remoteEnabled: isRemoteServiceEnabled(),
    supabaseUrl: publicEnvironment.supabaseUrl,
  });
  const targetShell = shell !== 'legacy';
  const liveOwner = isFreeIntegrationShell(shell) && authStatus === 'SIGNED_IN' && accessReady
    ? sessionUserId : null;

  useEffect(() => {
    myStuffStore.getState().setOwner(liveOwner);
    setActionError(null);
    setBusyId(null);
  }, [liveOwner]);
  useFocusEffect(useCallback(() => {
    if (liveOwner) {
      myStuffStore.getState().setOwner(liveOwner);
      void myStuffStore.getState().load();
      customerController.setOwner(currentCustomerOwner());
      if (currentCustomerOwner() === liveOwner) void customerController.load();
    }
  }, [liveOwner]));

  const runAction = (id: string, action: () => Promise<void>) => {
    if (!liveOwner || ownerId !== liveOwner || busyId) return;
    const actionOwner = liveOwner;
    setBusyId(id);
    setActionError(null);
    void action().catch(() => {
      if (myStuffStore.getState().ownerId === actionOwner && useAuthStore.getState().sessionUserId === actionOwner) {
        setActionError('That change could not be saved. Try again.');
      }
    }).finally(() => {
      if (myStuffStore.getState().ownerId === actionOwner) setBusyId(null);
    });
  };
  const live = Boolean(liveOwner && ownerId === liveOwner && customerState.ownerId === liveOwner);
  const canonical = describeCanonicalMyStuff(customerState, liveOwner);
  const openEditor = (mode: string) => router.push({ pathname: '/personalize', params: { p0b: '1', mode } });
  const canonicalProfile = liveOwner ? <GroupedSection header="Skin and goals"><View style={{ padding: spacing.md }}>
    {canonical.kind === 'ready' ? <><Text style={styles.message}>{canonical.hasProfile ? `Main goal: ${canonical.primaryGoal ?? 'Not selected'}` : 'Choose a main goal for personalized checks.'}</Text>{canonical.secondaryGoals.length > 0 && <Text style={styles.message}>Other goals: {canonical.secondaryGoals.join(', ')}</Text>}</> : <Text style={styles.message}>{canonical.kind === 'loading' ? 'Loading your skin and goals...' : 'Your current skin and goals are unavailable.'}</Text>}
    <Button label="Skin and goals" variant="outline" onPress={() => openEditor('profile')} />
  </View></GroupedSection> : undefined;
  const hideEmptyUntilResolved = live && status !== 'ready' && !model.profile
    && !model.products.length && !model.checks.length && !model.experiences.length;
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <RootShellHeader title="My Stuff" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        {hideEmptyUntilResolved && status === 'loading'
          ? <Text style={styles.message}>Loading your saved context…</Text> : null}
        {live && (error || actionError) ? <View>
          <Text style={styles.message}>{error || actionError}</Text>
          {status === 'error' ? <Pressable accessibilityRole="button" onPress={() => void myStuffStore.getState().load()}>
            <Text style={styles.retry}>Try again</Text>
          </Pressable> : null}
        </View> : null}
        {canonicalProfile}
        {liveOwner && currentCustomerOwner() === liveOwner && <>
          <GroupedSection header="Product experiences"><View style={{ padding: spacing.md }}><Text style={styles.message}>{canonical.kind === 'ready' ? canonical.experienceSummary : canonical.kind === 'loading' ? 'Loading your product experiences...' : 'Your current product experiences are unavailable.'}</Text><Button label="View or record an experience" variant="outline" onPress={() => openEditor('history')} /></View></GroupedSection>
          <Button label="Edit routine" variant="ghost" onPress={() => openEditor('routine')} />
        </>}
        {!hideEmptyUntilResolved ? <MyStuffContent key={liveOwner ?? 'preview'} model={live ? model : anonymousEmptyMyStuff}
          liveFree={isFreeIntegrationShell(shell)}
          profileContent={liveOwner ? <></> : undefined}
          experienceHeader={liveOwner ? 'Other saved reports' : undefined}
          experienceEmptyText={liveOwner ? 'No other saved reports' : undefined}
          onEditProfile={targetShell ? () => liveOwner ? router.push({ pathname: '/personalize', params: { p0b: '1', mode: 'profile' } }) : router.push('/personalize') : undefined}
          onChangeProductState={live ? (id: string, state: ProductState) => runAction(id,
            () => myStuffStore.getState().changeProductState(id, state)) : undefined}
          onRemoveProduct={live ? (id: string) => runAction(id,
            () => myStuffStore.getState().removeProduct(id)) : undefined}
          onRemoveEntry={live ? (section, id) => runAction(id,
            () => myStuffStore.getState().removeEntry(section, id)) : undefined}
          onLoadMore={live ? (section) => void myStuffStore.getState().loadMore(section) : undefined}
          hasMore={live ? { products: Boolean(cursors.products), checks: Boolean(cursors.checks),
            experiences: Boolean(cursors.experiences) } : undefined}
          loadingMore={live ? loadingMore : undefined} busyId={busyId} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.lg },
  message: { color: colors.inkMuted, marginBottom: spacing.md },
  retry: { color: colors.brand, marginBottom: spacing.md },
});
