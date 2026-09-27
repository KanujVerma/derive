import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { colors, layout, radii, spacing, typography } from '@/src/constants/theme';
import type { DecisionBinding, DecisionNextStep } from '@/src/contracts/PersonalDecision';
import { describePersonalDecision } from '@/src/presentation/personal-decision/result';

export interface PersonalDecisionPanelProps {
  packet: unknown;
  /** Independently loaded by authenticated composition; never copied from packet. */
  expectedBinding: DecisionBinding;
  onNextStep: (step: DecisionNextStep) => void;
}

/** Standalone evidence-bound surface; current Check integration remains separately owned. */
export function PersonalDecisionPanel({ packet, expectedBinding, onNextStep }: PersonalDecisionPanelProps) {
  const [showWhy, setShowWhy] = useState(false);
  const view = describePersonalDecision(packet, expectedBinding);
  if (view.kind === 'unavailable') {
    return <View style={styles.panel} accessibilityLiveRegion="polite">
      <Text style={styles.eyebrow}>PERSONAL DECISION</Text>
      <Text style={styles.title} accessibilityRole="header">{view.title}</Text>
      <Text style={styles.body}>{view.message}</Text>
    </View>;
  }
  // A specific unknown stated as the primary reason is already visible, including blockers.
  const additionalUnknowns = view.unknowns.filter((unknown) => unknown.text !== view.primaryReason);
  const criticalUnknowns = additionalUnknowns.filter((unknown) => unknown.critical);
  const otherUnknowns = additionalUnknowns.filter((unknown) => !unknown.critical);
  // Every blocker remains expanded. Additional non-critical detail uses the disclosure.
  const visibleUnknowns = [...criticalUnknowns, ...otherUnknowns.slice(0, 1)];
  return <View style={styles.panel} accessibilityLiveRegion="polite">
    <Text style={styles.eyebrow}>PERSONAL DECISION</Text>
    <Text style={styles.title} accessibilityRole="header">{view.title}</Text>
    <Text style={styles.reason}>{view.primaryReason}</Text>
    {view.secondaryCautions.map((text, index) => <Text key={`caution-${index}`} style={styles.caution}>{text}</Text>)}
    {view.routineImpacts.length > 0 && <View style={styles.section}>
      <Text style={styles.label}>In your routine</Text>
      {view.routineImpacts.map((text, index) => <Text key={`impact-${index}`} style={styles.body}>{text}</Text>)}
    </View>}
    {visibleUnknowns.length > 0 && <View style={styles.section}>
      <Text style={styles.label}>What is uncertain</Text>
      {visibleUnknowns.map((unknown, index) => <Text key={`unknown-${index}`} style={styles.body}>{unknown.text}</Text>)}
    </View>}
    <Button label={view.nextStepLabel} variant="brand" size="large"
      onPress={() => onNextStep(view.nextStep)} style={styles.action} />
    <Pressable onPress={() => setShowWhy(!showWhy)} accessibilityRole="button"
      accessibilityLabel={showWhy ? 'Hide why Derive thinks this' : 'Why Derive thinks this'}
      accessibilityState={{ expanded: showWhy }} style={styles.disclosure}>
      <Text style={styles.disclosureText}>{showWhy ? 'Hide details' : 'Why Derive thinks this'}</Text>
    </Pressable>
    {showWhy && <View style={styles.details}>
      {view.details.map((detail, index) => <View key={`finding-${index}`} style={styles.detail}>
        <Text style={styles.detailText}>{detail.reason}</Text>
        {detail.evidence.map((evidence) => <Text key={evidence} style={styles.evidence}>{evidence}</Text>)}
      </View>)}
      {otherUnknowns.slice(1).map((unknown, index) => <Text key={`more-unknown-${index}`} style={styles.detailText}>{unknown.text}</Text>)}
      <Text style={styles.evidence}>Evaluation {view.versions.engine} · Policy {view.versions.policy}</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg },
  eyebrow: { color: colors.brand, fontSize: typography.sizes.micro, fontWeight: typography.weights.bold, letterSpacing: 1 },
  title: { color: colors.ink, fontSize: typography.sizes.sectionTitle, lineHeight: typography.lineHeights.sectionTitle,
    fontWeight: typography.weights.semibold, marginTop: spacing.sm },
  reason: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, marginTop: spacing.xs },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, marginTop: spacing.xxs },
  caution: { color: colors.actionReview.text, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, marginTop: spacing.sm },
  section: { marginTop: spacing.md },
  label: { color: colors.ink, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold },
  action: { marginTop: spacing.lg },
  disclosure: { minHeight: layout.minTouchTarget, justifyContent: 'center', alignSelf: 'stretch', marginTop: spacing.xs },
  disclosureText: { color: colors.brand, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.medium },
  details: { borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm, gap: spacing.sm },
  detail: { gap: spacing.xxs },
  detailText: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  evidence: { color: colors.inkMuted, fontSize: typography.sizes.micro, lineHeight: typography.lineHeights.micro },
});
