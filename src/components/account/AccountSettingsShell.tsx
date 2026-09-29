import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { colors, layout, spacing, typography } from '../../constants/theme';
import { Icon } from '../ui/Icon';
import { GroupedSection } from '../ui/GroupedSection';
import { deriveVersionLabel, type AccountSettingsPresentation } from './accountSettingsPresentation';

export function AccountSettingsShell({
  presentation,
  onOpenPrivacy,
  onOpenPrivacyChoices,
  onOpenHelp,
  onSignOut,
  onDelete,
  privacyError,
  helpError,
  deleting,
}: {
  presentation: AccountSettingsPresentation;
  onOpenPrivacy(): void;
  onOpenPrivacyChoices(): void;
  onOpenHelp(): void;
  onSignOut?: () => void;
  onDelete?: () => void;
  privacyError?: string | null;
  helpError?: string | null;
  deleting?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="back" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Account & Settings</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        <GroupedSection header="Account" footer={presentation.accountFooter ?? undefined} style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{presentation.accountTitle}</Text>
            {presentation.accountSubtitle ? <Text style={styles.rowBody}>{presentation.accountSubtitle}</Text> : null}
          </View>
          {presentation.showSignOut ? (
            <Pressable style={styles.row} accessibilityRole="button" onPress={onSignOut}>
              <Text style={styles.rowTitle}>Sign Out</Text>
            </Pressable>
          ) : null}
        </GroupedSection>

        <GroupedSection header="Privacy & Data" style={styles.section}>
          <Pressable style={styles.row} accessibilityRole="link" onPress={onOpenPrivacy}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Privacy Policy</Text>
              <Text style={styles.rowBody}>How Derive handles your information</Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </Pressable>
          <Pressable style={styles.row} accessibilityRole="link" onPress={onOpenPrivacyChoices}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Privacy Choices</Text>
              <Text style={styles.rowBody}>Review your privacy options</Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </Pressable>
          {presentation.showDelete && presentation.deleteLabel ? (
            <Pressable
              style={styles.row}
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(deleting) }}
              disabled={deleting}
              onPress={onDelete}
            >
              <Text style={styles.destructive}>{deleting ? 'Deleting…' : presentation.deleteLabel}</Text>
              {presentation.deleteSubtitle ? <Text style={styles.rowBody}>{presentation.deleteSubtitle}</Text> : null}
            </Pressable>
          ) : null}
        </GroupedSection>
        {privacyError ? <Text accessibilityRole="alert" style={styles.error}>{privacyError}</Text> : null}

        <GroupedSection header="Help" style={styles.section}>
          <Pressable style={styles.row} accessibilityRole="link" onPress={onOpenHelp}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Help & feedback</Text>
              <Text style={styles.rowBody}>Support, account issues, or feedback</Text>
            </View>
            <Icon name="forward" size={16} color={colors.inkMuted} />
          </Pressable>
        </GroupedSection>
        {helpError ? <Text accessibilityRole="alert" style={styles.error}>{helpError}</Text> : null}

        <Text style={styles.version}>{deriveVersionLabel(Constants.expoConfig?.version)}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm },
  back: { width: layout.minTouchTarget, height: layout.minTouchTarget, justifyContent: 'center', alignItems: 'center' },
  title: { color: colors.ink, fontSize: typography.sizes.sectionTitle, fontWeight: typography.weights.semibold },
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.lg },
  section: { marginBottom: spacing.xl },
  row: { minHeight: 54, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, fontWeight: typography.weights.semibold },
  rowBody: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption, marginTop: spacing.xxs },
  destructive: { color: colors.actionStop.text, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, fontWeight: typography.weights.semibold },
  error: { color: colors.actionPause.text, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption, marginTop: -spacing.sm, marginBottom: spacing.md },
  version: { color: colors.inkSubtle, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption, textAlign: 'center', marginTop: spacing.sm },
});
