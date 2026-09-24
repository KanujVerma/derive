import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PersonalizationFlow } from '@/src/components/personalization/PersonalizationFlow';
import { Button } from '@/src/components/ui/Button';
import { colors, layout, spacing, typography } from '@/src/constants/theme';
import type { PersonalizationDraft } from '@/src/presentation/personalization/draft';

/** Standalone entry for the future Check and My Stuff composition. No profile is saved here. */
export default function PersonalizeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [completed, setCompleted] = useState<PersonalizationDraft | null>(null);
  const [editing, setEditing] = useState(false);

  if (!completed || editing) return <PersonalizationFlow initialDraft={completed ?? undefined}
    onComplete={(answers) => { setCompleted(answers); setEditing(false); }}
    onSkip={() => router.back()} />;

  return <View style={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.lg }]}>
    <Text style={styles.eyebrow}>PERSONALIZATION</Text>
    <Text style={styles.title}>Answers ready</Text>
    <Text style={styles.body}>Your answers are ready on this screen. They are not saved yet. Personal Fit appears only when enough product evidence is available.</Text>
    <View style={styles.actions}>
      <Button label="Edit answers" variant="outline" onPress={() => setEditing(true)} />
      <Button label="Return to check" variant="brand" onPress={() => router.back()} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: layout.gutter },
  eyebrow: { color: colors.brand, fontSize: typography.sizes.micro, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: typography.sizes.display, fontWeight: typography.weights.semibold, marginTop: spacing.md },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, marginTop: spacing.md },
  actions: { gap: spacing.sm, marginTop: 'auto' },
});
