import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { DecisionNextStep } from '../../../contracts/PersonalDecision';
import { describeCheckResultContent, type CheckResultContentInput } from '../../../presentation/check/result-sheet/content';
import { describePersonalDecision } from '../../../presentation/personal-decision/result';
import { colors, spacing, typography } from '../../../constants/theme';
import { CheckResultContent } from './CheckResultContent';
import { ResultSheetSurface } from './ResultSheetSurface';

interface Props {
  visible: boolean;
  input: CheckResultContentInput | null;
  presentationKey: string;
  loading?: boolean;
  error?: string | null;
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
export function CheckResultPresentation({ visible, input, presentationKey, loading = false, error,
  inline = false, onClose, dismissLabel = 'Close result', onNextStep, onPersonalize, onOpenSource, children }: Props) {
  const { fontScale } = useWindowDimensions();
  const model = input ? describeCheckResultContent(input) : null;
  const decision = model?.fit.kind === 'canonical' ? describePersonalDecision(model.fit.packet, model.fit.expectedBinding) : null;
  const needsRoom = fontScale > 1.15 || Boolean(model?.outcome.criticalUnknowns.length)
    || decision?.kind === 'ready' && (decision.criticalCautions.length > 0 || decision.secondaryCautions.length > 0);
  return <ResultSheetSurface visible={visible} inline={inline} presentationKey={presentationKey} onClose={onClose}
    dismissLabel={dismissLabel} initialDetent={needsRoom ? 1 : 0}>
    {loading && <View accessibilityLiveRegion="polite" style={styles.status}>
      <ActivityIndicator color={colors.brand} /><Text style={styles.body}>Checking product identity...</Text>
    </View>}
    {error && <Text accessibilityRole="alert" style={styles.body}>{error}</Text>}
    {input && <CheckResultContent input={input} expanded continuous onNextStep={onNextStep}
      onPersonalize={onPersonalize} onOpenSource={onOpenSource} />}
    {children}
  </ResultSheetSurface>;
}
const styles = StyleSheet.create({
  status: { gap: spacing.sm },
  body: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
});
