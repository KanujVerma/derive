import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { colors, radii, spacing, typography } from '@/src/constants/theme';
import { describePersonalFitRefresh, type PersonalFitRefreshInput } from '@/src/presentation/personalization/result';

export interface PersonalFitSectionProps {
  state: PersonalFitRefreshInput;
  onPersonalize?: () => void;
}

/** Mount beside the existing FORMULA DETAILS on the same product result. */
export function PersonalFitSection({ state, onPersonalize }: PersonalFitSectionProps) {
  const view = describePersonalFitRefresh(state);
  return <View style={styles.card}>
    <Text style={styles.eyebrow}>PERSONAL FIT</Text>
    {view.kind === 'loading' && <ActivityIndicator color={colors.brand} style={styles.spinner} />}
    <Text style={styles.title}>{view.title}</Text>
    <Text style={styles.message}>{view.message}</Text>
    {view.fit?.evidenceUsed.length ? <>
      <Text style={styles.evidenceHeading}>Based on</Text>
      {view.fit.evidenceUsed.map((item) => <Text key={item} style={styles.evidence}>• {item}</Text>)}
    </> : null}
    {view.fit?.uncertainty ? <Text style={styles.uncertainty}>{view.fit.uncertainty}</Text> : null}
    {view.kind === 'factual_only' && onPersonalize ? <Button label="Personalize" variant="brand" onPress={onPersonalize} style={styles.action} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.lg },
  eyebrow: { color: colors.brand, fontSize: typography.sizes.micro, fontWeight: typography.weights.bold, letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: typography.sizes.sectionTitle, fontWeight: typography.weights.semibold, marginTop: spacing.sm },
  message: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, marginTop: spacing.xs },
  evidenceHeading: { color: colors.ink, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold, marginTop: spacing.md },
  evidence: { color: colors.inkMuted, fontSize: typography.sizes.caption, marginTop: spacing.xxs },
  uncertainty: { color: colors.inkMuted, fontSize: typography.sizes.caption, marginTop: spacing.md },
  spinner: { alignSelf: 'flex-start', marginTop: spacing.sm },
  action: { marginTop: spacing.lg },
});
