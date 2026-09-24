import React from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MyStuffContent } from '@/src/components/my-stuff/MyStuffContent';
import { RootShellHeader } from '@/src/components/shell/RootShellHeader';
import { colors, layout, spacing } from '@/src/constants/theme';
import { anonymousEmptyMyStuff } from '@/src/fixtures/my-stuff/myStuffFixtures';
import { publicEnvironment } from '@/src/config/environment';
import { isRemoteServiceEnabled } from '@/src/services/DeriveService';
import { resolveShellPresentation } from '@/src/utils/shellPresentation';

/** Owner-bound free context will be supplied here after S-FREE-3. MyStuffContent composes the shared GroupedSection rows. */
export default function MyStuffScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const shell = resolveShellPresentation({
    buildFlavor: publicEnvironment.buildFlavor,
    remoteEnabled: isRemoteServiceEnabled(),
    supabaseUrl: publicEnvironment.supabaseUrl,
  });
  const targetShell = shell !== 'legacy';
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <RootShellHeader title="My Stuff" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        <MyStuffContent model={anonymousEmptyMyStuff} onEditProfile={targetShell ? () => router.push('/personalize') : undefined} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.lg },
});
