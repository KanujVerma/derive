import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DecisionNextStep } from '../../../contracts/PersonalDecision';
import type { CheckResultContentInput } from '../../../presentation/check/result-sheet/content';
import { colors, layout, radii, spacing, typography } from '../../../constants/theme';
import { Icon } from '../../ui/Icon';
import { CheckResultContent } from './CheckResultContent';

interface Props {
  visible: boolean;
  input: CheckResultContentInput | null;
  presentationKey: string;
  loading?: boolean;
  error?: string | null;
  full: boolean;
  /** Camera uses its existing companion slot, replacing the sheet rather than stacking a native modal. */
  inline?: boolean;
  onFullChange: (full: boolean) => void;
  onClose: () => void;
  dismissLabel?: string;
  onNextStep?: (step: DecisionNextStep) => void;
  onPersonalize?: () => void;
  onOpenSource?: (url: string) => void;
  children?: React.ReactNode;
}

/** Accessible bounded presentation; facts/decision authority and retained origin belong to Check. */
export function CheckResultPresentation({ visible, input, presentationKey, loading = false, error,
  full, inline = false, onFullChange, onClose, dismissLabel = 'Close result', onNextStep, onPersonalize, onOpenSource, children }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const heading = useRef<Text>(null);
  useEffect(() => { setExpanded(false); }, [presentationKey]);
  const focusHeading = () => {
    if (Platform.OS === 'web') return;
    const node = findNodeHandle(heading.current);
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  };
  const back = () => full ? onFullChange(false) : onClose();
  const content = <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    style={[styles.overlay, { paddingTop: insets.top + spacing.sm, paddingBottom: Math.max(insets.bottom, spacing.md) }]}
    accessibilityViewIsModal onAccessibilityEscape={back}>
    <View style={[styles.surface, full && styles.full,
      { maxHeight: Math.max(layout.minTouchTarget * 3, height - insets.top - insets.bottom - spacing.lg) }]}>
      <View style={styles.header}>
        {full && <Pressable style={styles.control} onPress={back} accessibilityRole="button"
          accessibilityLabel="Back to contextual result"><Icon name="back" size={20} color={colors.ink} /></Pressable>}
        <Text ref={heading} accessibilityRole="header" style={styles.heading}>{full ? 'Product result' : 'Check result'}</Text>
        <Pressable style={styles.control} onPress={onClose} accessibilityRole="button" accessibilityLabel={dismissLabel}>
          <Icon name="close" size={20} color={colors.inkMuted} />
        </Pressable>
      </View>
      <ScrollView key={presentationKey} style={[styles.scroll, !full && { maxHeight: height * 0.7 }]}
        contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        accessibilityLabel={full || expanded ? 'Result and supporting details' : 'Personal Fit and essential result'}>
        {loading && <View accessibilityLiveRegion="polite" style={styles.status}>
          <ActivityIndicator color={colors.brand} /><Text style={styles.body}>Checking product identity...</Text>
        </View>}
        {error && <Text accessibilityRole="alert" style={styles.body}>{error}</Text>}
        {input && <CheckResultContent input={input} expanded={full || expanded}
          onNextStep={onNextStep} onPersonalize={onPersonalize} onOpenSource={onOpenSource} />}
        {children}
        {dismissLabel !== 'Close result' && <Pressable style={styles.action} onPress={onClose} accessibilityRole="button" accessibilityLabel={dismissLabel}>
          <Text style={styles.actionText}>{dismissLabel}</Text>
        </Pressable>}
        {input && !full && <>
          <Pressable style={styles.action} onPress={() => setExpanded(value => !value)} accessibilityRole="button"
            accessibilityLabel={expanded ? 'Collapse result details' : 'Expand result details'} accessibilityState={{ expanded }}>
            <Text style={styles.actionText}>{expanded ? 'Hide formula details' : 'Formula details'}</Text>
            <Icon name={expanded ? 'up' : 'down'} size={18} color={colors.brand} />
          </Pressable>
          <Pressable style={styles.action} onPress={() => onFullChange(true)} accessibilityRole="button"
            accessibilityLabel="View full result"><Text style={styles.actionText}>View full result</Text></Pressable>
        </>}
      </ScrollView>
    </View>
  </KeyboardAvoidingView>;
  if (!visible) return null;
  if (inline) return <View style={styles.inline}>{content}</View>;
  return <Modal visible transparent animationType="none" onRequestClose={back} onShow={focusHeading}>{content}</Modal>;
}

const styles = StyleSheet.create({
  inline: { ...StyleSheet.absoluteFill, zIndex: 30 },
  overlay: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.md, backgroundColor: 'rgba(23,26,24,0.38)' },
  surface: { backgroundColor: colors.surface, borderRadius: radii.xl, overflow: 'hidden' },
  full: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  heading: { flex: 1, color: colors.ink, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold },
  control: { minWidth: layout.minTouchTarget, minHeight: layout.minTouchTarget, justifyContent: 'center', alignItems: 'center' },
  scroll: { flexShrink: 1 },
  content: { padding: spacing.md, gap: spacing.lg },
  status: { gap: spacing.sm },
  body: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  action: { minHeight: layout.minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionText: { color: colors.brand, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold },
});
