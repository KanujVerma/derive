import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { DecisionNextStep } from '../../../contracts/PersonalDecision';
import type { CheckResultContentInput } from '../../../presentation/check/result-sheet/content';
import { colors, spacing, typography } from '../../../constants/theme';
import { CheckResultContent, CheckResultView } from './CheckResultContent';
import { ResultSheetSurface } from './ResultSheetSurface';

interface Props {
  visible: boolean;
  input: CheckResultContentInput | null;
  presentationKey: string;
  loading?: boolean;
  error?: string | null;
  unresolvedMessage?: string;
  /** Compatibility only: details now live in the same swipe sheet. */
  full?: boolean;
  inline?: boolean;
  onFullChange?: (full: boolean) => void;
  onClose: () => void;
  dismissLabel?: string;
  onNextStep?: (step: DecisionNextStep) => void;
  onPersonalize?: () => void;
  onOpenSource?: (url: string) => void;
  children?: React.ReactNode;
}

/** Presentation only. Check retains bindings, close authority, and the originating camera/search. */
export function CheckResultPresentation({ visible, input, presentationKey, loading = false, error, unresolvedMessage,
  inline = false, onClose, dismissLabel = 'Close result', onNextStep, onPersonalize, onOpenSource, children }: Props) {
  const summary = <View>
    {loading && <View accessibilityLiveRegion="polite" style={styles.status}><ActivityIndicator color={colors.brand} /><Text style={styles.body}>Checking product details...</Text></View>}
    {error && <Text accessibilityRole="alert" style={styles.body}>{error}</Text>}
    {input && <CheckResultContent input={input} section="summary" />}
    {!loading && !error && !input && <CheckResultView section="summary"
      facts={{ brand: '', name: 'Product not confirmed', categoryLabel: '', formula: null, source: null }}
      verdict={{ state: 'unknown', label: 'Not enough information', reason: unresolvedMessage ?? 'Product identity is not confirmed. Swipe up for ways to check the exact product or package.', findings: [] }} />}
  </View>;
  return <ResultSheetSurface visible={visible} inline={inline} presentationKey={presentationKey} onClose={onClose}
    dismissLabel={dismissLabel} summary={summary}>
    {input && <CheckResultContent input={input} section="findings" onNextStep={onNextStep}
      onPersonalize={onPersonalize} onOpenSource={onOpenSource} />}
    {children}
  </ResultSheetSurface>;
}
const styles = StyleSheet.create({
  status: { gap: spacing.sm },
  body: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
});
