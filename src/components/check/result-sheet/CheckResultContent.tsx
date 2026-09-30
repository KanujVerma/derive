import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DecisionNextStep } from '../../../contracts/PersonalDecision';
import { colors, layout, spacing, typography } from '../../../constants/theme';
import { describeCheckResultContent, type CheckResultContentInput } from '../../../presentation/check/result-sheet/content';
import { PersonalDecisionPanel } from '../../personal-decision/PersonalDecisionPanel';
import { PersonalFitSection } from '../../personalization/PersonalFitSection';
import { SectionHeader } from '../../ui/SectionHeader';
import { Icon } from '../../ui/Icon';

export interface CheckResultContentProps {
  input: CheckResultContentInput;
  expanded?: boolean;
  continuous?: boolean;
  /** The sheet already renders identity in its summary. Full-detail consumers keep this enabled. */
  showIdentity?: boolean;
  onNextStep?: (step: DecisionNextStep) => void;
  onPersonalize?: () => void;
  onOpenSource?: (url: string) => void;
}

/** Shared content only: the host owns dismiss, return, authenticated binding and navigation. */
export function CheckResultContent({ input, expanded = true, continuous = false, showIdentity = true,
  onNextStep, onPersonalize, onOpenSource }: CheckResultContentProps) {
  const model = describeCheckResultContent(input);
  const { facts, fit } = model;
  const previewFormulaGap = continuous && model.outcome.kind === 'preview_unavailable'
    && !facts.formula && facts.name !== 'Product not confirmed';
  return <View style={styles.content}>
    {showIdentity && <View style={styles.identityRow}>
      <View style={styles.placeholder} accessible accessibilityLabel="No verified product image available"><Icon name="bottle" size={28} color={colors.brand} /></View>
      <View style={styles.identity}>
      {facts.brand ? <Text style={styles.brand}>{facts.brand}</Text> : null}
      <Text style={styles.productName} accessibilityRole="header">{facts.name}</Text>
      </View>
    </View>}
    {fit.kind === 'canonical' ? <PersonalDecisionPanel packet={fit.packet} expectedBinding={fit.expectedBinding}
      onNextStep={onNextStep ?? (model.canPersonalize && onPersonalize ? () => onPersonalize() : undefined)} embedded expanded={expanded} continuous={continuous} />
      : fit.kind === 'legacy' ? <PersonalFitSection state={fit.state} embedded expanded={expanded}
        onPersonalize={model.canPersonalize ? onPersonalize : undefined} />
        : <View accessibilityLiveRegion="polite">
          <SectionHeader title="Personal Fit" />
          {model.outcome.kind === 'loading' && <ActivityIndicator style={styles.loading} color={colors.brand} />}
          <Text style={styles.title} accessibilityRole="header">{previewFormulaGap ? 'Exact formula not verified' : model.outcome.title}</Text>
          <Text style={styles.reason}>{previewFormulaGap ? 'The ingredient list for your exact package has not been verified. Personal Fit cannot be assessed from this product listing.' : model.outcome.reason}</Text>
        </View>}
    {expanded && <View style={styles.formula}>
      <SectionHeader title="Formula details" />
      {facts.categoryLabel ? <Text style={styles.body}>{facts.categoryLabel}</Text> : null}
      {facts.formula ? <>
        <Text style={styles.body}>Verified ingredients for this exact package</Text>
        <Text style={styles.body}>{facts.formula.ingredients.join(', ')}</Text>
        <Text style={styles.body}>Source type: {facts.formula.provenanceType.replaceAll('_', ' ')}</Text>
      </> : <Text style={styles.body}>Exact package formula not verified.</Text>}
      {facts.source && onOpenSource && <Pressable onPress={() => onOpenSource(facts.source!)}
        accessibilityRole="link" accessibilityLabel="View product source" style={styles.source}>
        <Text style={styles.sourceText}>View product source</Text>
      </Pressable>}
    </View>}
    {previewFormulaGap && <Text style={styles.body}>{model.outcome.reason}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  placeholder: { width: 60, height: 72, borderRadius: 12, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, minWidth: 0, gap: spacing.xs },
  brand: { color: colors.inkMuted, fontSize: typography.sizes.caption },
  productName: { color: colors.ink, fontSize: typography.sizes.sectionTitle, lineHeight: typography.lineHeights.sectionTitle,
    fontWeight: typography.weights.semibold },
  title: { color: colors.ink, fontSize: typography.sizes.sectionTitle, lineHeight: typography.lineHeights.sectionTitle,
    fontWeight: typography.weights.semibold, marginTop: spacing.xs },
  reason: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, marginTop: spacing.xs },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  formula: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  loading: { alignSelf: 'flex-start', marginTop: spacing.xs },
  source: { minHeight: layout.minTouchTarget, justifyContent: 'center' },
  sourceText: { color: colors.brand, fontSize: typography.sizes.bodyRegular },
});
