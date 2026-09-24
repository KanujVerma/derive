import React, { useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { publicLegalLinks } from '../../config/environment';
import { colors, spacing, typography } from '../../constants/theme';
import { deleteCurrentAccount } from '../../services/accountDeletion';
import { signOutSession } from '../../services/authClient';
import type { FreeAccessState } from '../../contracts/FreeAccess';
import { getFreeAccountPresentation } from './freeAccountPresentation';
import { Icon } from '../ui/Icon';

/** Truthful settings for a locally integrated anonymous identity. */
export function FreeAccountShell({ identityKind }: { identityKind: FreeAccessState['identityKind'] }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);
  const presentation = getFreeAccountPresentation(identityKind);

  const signOut = async () => {
    const result = await signOutSession();
    if (result.success) {
      router.replace('/(tabs)/check');
      return;
    }
    const message = result.error || 'Sign out is unavailable. Please try again.';
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert('Sign Out', message);
  };

  const deleteData = async () => {
    if (deleting) return;
    setDeleting(true);
    const result = await deleteCurrentAccount();
    if (result.success) {
      router.replace('/(tabs)/check');
      return;
    }
    setDeleting(false);
    const message = result.error || 'Your data could not be deleted. Please try again.';
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert('Delete Derive data', message);
  };

  const confirmDeletion = () => {
    const message = 'Delete the data associated with this Derive session? This cannot be undone.';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) void deleteData();
    } else {
      Alert.alert('Delete Derive data', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void deleteData() },
      ]);
    }
  };

  return <View style={[styles.container, { paddingTop: insets.top }]}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
        <Icon name="back" size={20} color={colors.ink} />
      </Pressable>
      <Text style={styles.title}>Account & Settings</Text>
    </View>
    <View style={styles.content}>
      <Text style={styles.body}>{presentation.intro}</Text>
      <Pressable style={styles.row} accessibilityRole="link" onPress={() => void Linking.openURL(publicLegalLinks.privacyUrl)}>
        <Text style={styles.link}>Privacy</Text>
      </Pressable>
      <Pressable style={styles.row} accessibilityRole="link" onPress={() => void Linking.openURL(publicLegalLinks.supportUrl)}>
        <Text style={styles.link}>Support</Text>
      </Pressable>
      <Pressable style={styles.row} accessibilityRole="button" accessibilityState={{ disabled: deleting }} disabled={deleting} onPress={confirmDeletion}>
        <Text style={styles.delete}>{deleting ? 'Deleting…' : 'Delete Derive data'}</Text>
      </Pressable>
      {presentation.showSignOut && <Pressable style={styles.row} accessibilityRole="button" onPress={() => void signOut()}>
        <Text style={styles.link}>Sign Out</Text>
      </Pressable>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm },
  back: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { color: colors.ink, fontSize: typography.sizes.sectionTitle, fontWeight: typography.weights.semibold },
  content: { padding: spacing.lg },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: 23, marginBottom: spacing.lg },
  row: { minHeight: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  link: { color: colors.ink, fontSize: typography.sizes.bodyRegular },
  delete: { color: colors.actionStop.text, fontSize: typography.sizes.bodyRegular },
});
