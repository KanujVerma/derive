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
import { Icon } from '@/src/components/ui/Icon';
import { mapCanonicalExperiences } from '@/src/presentation/my-stuff/myStuffPresentation';
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
import { PART_ONE_ENABLED } from '@/src/services/partOne';
import { PartOneSavedProducts } from '@/src/components/my-stuff/PartOneSavedProducts';

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
    const actionEpoch = myStuffStore.getState().ownerEpoch;
    setBusyId(id);
    setActionError(null);
    void action().catch(() => {
      if (myStuffStore.getState().ownerId === actionOwner && myStuffStore.getState().ownerEpoch === actionEpoch && useAuthStore.getState().sessionUserId === actionOwner) {
        setActionError('That change could not be saved. Try again.');
      }
    }).finally(() => {
      if (myStuffStore.getState().ownerId === actionOwner && myStuffStore.getState().ownerEpoch === actionEpoch) setBusyId(null);
    });
  };
  const live = Boolean(liveOwner && ownerId === liveOwner);
  const canonical = describeCanonicalMyStuff(customerState, liveOwner);
  const context = liveOwner && customerState.ownerId === liveOwner && customerState.context?.ownerId === liveOwner
    ? customerState.context : null;
  const openEditor = (mode: string, extra: Record<string, string> = {}) => router.push({
    pathname: '/personalize', params: { p0b: '1', mode, source: 'my-stuff', ...extra },
  });
  const canonicalProfile = liveOwner ? <GroupedSection header="Skin profile">
    {canonical.kind === 'ready' ? <Pressable accessibilityRole="button"
      accessibilityLabel={canonical.hasProfile ? 'Edit skin profile' : 'Set up skin profile'}
      onPress={() => openEditor('profile')} style={styles.profileRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.profileTitle}>{canonical.hasProfile
          ? canonical.primaryGoal ? `Main priority: ${canonical.primaryGoal}` : 'Skin profile saved'
          : 'Set up skin profile'}</Text>
        {canonical.secondaryGoals.length > 0 && <Text style={styles.support}>{canonical.secondaryGoals.join(' · ')}</Text>}
      </View>
      <Icon name="forward" size={18} color={colors.inkMuted} />
    </Pressable> : <View style={styles.profileRow}>
      <Text style={styles.support}>{canonical.kind === 'loading' ? 'Loading your skin profile...' : 'Your skin profile could not be loaded.'}</Text>
      {canonical.kind !== 'loading' && <Button label="Try again" variant="ghost" onPress={() => void customerController.load()} />}
    </View>}
  </GroupedSection> : undefined;
  const memoryStatus = liveOwner ? !live || status === 'idle' || status === 'loading' ? 'loading'
    : status === 'error' ? 'error' : 'ready' : 'ready';
  const experienceStatus = liveOwner ? customerState.status === 'loading' || !context && !customerState.error ? 'loading'
    : customerState.error || memoryStatus === 'error' ? 'error' : 'ready' : 'ready';
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <RootShellHeader title="My Stuff" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        {PART_ONE_ENABLED && liveOwner && <PartOneSavedProducts key={`part-one-saved:${liveOwner}`} ownerId={liveOwner} />}
        {liveOwner && (error || actionError) ? <View>
          <Text accessibilityRole="alert" style={styles.message}>{error || actionError}</Text>
          {status === 'error' ? <Button label="Try again" variant="ghost" onPress={() => void myStuffStore.getState().load()} /> : null}
        </View> : null}
        <MyStuffContent key={`my-stuff:${liveOwner ?? 'preview'}`} model={live ? model : anonymousEmptyMyStuff}
          liveFree={isFreeIntegrationShell(shell)} memoryStatus={memoryStatus}
          profileContent={canonicalProfile}
          canonicalExperiences={liveOwner ? context ? mapCanonicalExperiences(context, customerState.displayLabels) : [] : undefined}
          experienceStatus={experienceStatus}
          experienceError={customerState.error ?? (memoryStatus === 'error' ? 'Some saved reports could not be loaded.' : null)}
          onRetryExperiences={() => { void customerController.load(); void myStuffStore.getState().load(); }}
          hasMoreCanonicalExperiences={Boolean(context?.historyTruncated)}
          onLoadMoreCanonicalExperiences={() => void customerController.loadMoreHistory()}
          onAddProduct={targetShell ? () => router.push({ pathname: '/personalize', params: { mode: 'product', source: 'my-stuff' } }) : undefined}
          onAddExperience={targetShell ? () => openEditor('history', { entry: 'new' }) : undefined}
          onCorrectExperience={liveOwner ? experienceId => openEditor('history', { experienceId }) : undefined}
          onAddProductExperience={live ? product => openEditor('history', { entry: 'new', productRecordId: product.id }) : undefined}
          onEditRoutine={liveOwner ? () => openEditor('routine') : undefined}
          onEditProfile={targetShell ? () => liveOwner ? openEditor('profile') : shell === 'scanner_first_preview' ? router.push({ pathname: '/personalize/fixture', params: { mode: 'profile', fresh: '1', focused: '1' } }) : router.push('/personalize') : undefined}
          onChangeProductState={live ? (id: string, state: ProductState) => runAction(id,
            () => myStuffStore.getState().changeProductState(id, state)) : undefined}
          onRemoveProduct={live ? (id: string) => runAction(id,
            () => myStuffStore.getState().removeProduct(id)) : undefined}
          onRemoveEntry={live ? (section, id) => runAction(id,
            () => myStuffStore.getState().removeEntry(section, id)) : undefined}
          onLoadMore={live ? section => void myStuffStore.getState().loadMore(section) : undefined}
          hasMore={live ? { products: Boolean(cursors.products), checks: Boolean(cursors.checks), experiences: Boolean(cursors.experiences) } : undefined}
          loadingMore={live ? loadingMore : undefined} busyId={busyId} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.lg },
  message: { color: colors.inkMuted, marginBottom: spacing.md },
  retry: { color: colors.brand, marginBottom: spacing.md },
  profileRow: { minHeight: layout.minTouchTarget, padding: layout.cardPadding, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  profileTitle: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  support: { color: colors.inkMuted, fontSize: 13, lineHeight: 18 },
});
