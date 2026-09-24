import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from 'zustand';
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
import { resolveShellPresentation } from '@/src/utils/shellPresentation';

/** MyStuffContent composes the shared GroupedSection rows; this route owns live free context. */
export default function MyStuffScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sessionUserId = useAuthStore((state) => state.sessionUserId);
  const authStatus = useAuthStore((state) => state.status);
  const accessReady = useFreeAccessStore((state) => state.status === 'READY'
    && state.userId === sessionUserId && state.access?.userId === sessionUserId);
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
  const liveOwner = shell === 'local_free_integration' && authStatus === 'SIGNED_IN' && accessReady
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
  const live = Boolean(liveOwner && ownerId === liveOwner);
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
        {!hideEmptyUntilResolved ? <MyStuffContent key={liveOwner ?? 'preview'} model={live ? model : anonymousEmptyMyStuff}
          onEditProfile={targetShell ? () => router.push('/personalize') : undefined}
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
