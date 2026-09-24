import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radii, spacing, typography } from '../../constants/theme';
import { GroupedSection } from '../ui/GroupedSection';
import { StatusBadge } from '../ui/StatusBadge';
import {
  baselineAngles, deriveManagedUpgradeView, managedFieldLabels, showsDraftManagedIntake,
  type BaselineAngle, type ManagedContextField, type ManagedUpgradeInput,
} from '../../presentation/managed-upgrade/managedUpgrade';

interface Props {
  input: ManagedUpgradeInput;
  onCreatePermanentIdentity?: () => void;
  onCompleteField?: (field: ManagedContextField) => void;
  onReviewSafety?: () => void;
  onCaptureBaseline?: (angle: BaselineAngle) => void;
  onSubmit?: () => void;
}

/** Customer transition surface. Actions are supplied by the future integration owner. */
export function ManagedUpgradePresentation({
  input, onCreatePermanentIdentity, onCompleteField, onReviewSafety, onCaptureBaseline, onSubmit,
}: Props) {
  const view = deriveManagedUpgradeView(input);
  const isDraft = showsDraftManagedIntake(view.stage);
  const button = (label: string, onPress?: () => void, accessibilityLabel?: string) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} accessibilityState={{ disabled: !onPress }} disabled={!onPress} onPress={onPress} style={[styles.action, !onPress && styles.disabled]}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>MANAGED SKINCARE</Text>
    {(isDraft || view.stage === 'identity_required') && <>
      <Text style={styles.title}>A routine that evolves with you.</Text>
      <Text style={styles.body}>A full routine with clear keep, add, remove, and change decisions, adjusted from check-ins and progress over time.</Text>
      <View style={styles.priceRow}><Text style={styles.price}>$25/month</Text><StatusBadge label="Products purchased separately" variant="info" /></View>
      <Text style={styles.note}>Founder and expert review is planned for the beta. Managed care is cosmetic guidance, not medical care.</Text>
    </>}

    {view.stage === 'submitted_preparing' && <GroupedSection header="Intake submitted">
      <View style={styles.cardInner}><Text style={styles.body}>Your managed intake was submitted. Your plan is being prepared and will appear in Plan when it is ready.</Text></View>
    </GroupedSection>}
    {view.stage === 'active_managed' && <GroupedSection header="Managed plan active">
      <View style={styles.cardInner}><Text style={styles.body}>Your current published routine and check-ins are available in Plan.</Text></View>
    </GroupedSection>}

    {view.stage === 'identity_required' && <GroupedSection header="Save your account" footer="Your existing free context can carry into Managed Skincare once your account is permanent.">
      <View style={styles.cardInner}><Text style={styles.body}>Create or link a permanent account to continue.</Text>{button('Save my account', onCreatePermanentIdentity)}</View>
    </GroupedSection>}

    {showsDraftManagedIntake(view.stage) && <>
      <GroupedSection header="What we already know" footer="You can review this information before submitting. We only ask for missing details.">
        <View style={styles.cardInner}><Text style={styles.body}>{view.reusedFields.length ? view.reusedFields.map((field) => managedFieldLabels[field]).join(' · ') : 'Your free profile has no saved answers yet.'}</Text></View>
      </GroupedSection>
      {view.missingFields.length > 0 && <GroupedSection header="Complete your managed details">
        {view.missingFields.map((field) => <View key={field} style={styles.row}>
          <Text style={styles.rowText}>{managedFieldLabels[field]}</Text>{button('Add', onCompleteField ? () => onCompleteField(field) : undefined, `Add ${managedFieldLabels[field]}`)}
        </View>)}
      </GroupedSection>}
      {!input.safetyReviewed && <GroupedSection header="Safety review">
        <View style={styles.cardInner}><Text style={styles.body}>Confirm current treatments, prescriptions, sensitivities, and any pregnancy or nursing answer before your plan is prepared.</Text>{button('Review safety details', onReviewSafety)}</View>
      </GroupedSection>}
      <GroupedSection header="Baseline photos" footer="Front, left, and right captures are required for managed intake. These photos are private.">
        {baselineAngles.map((angle) => <View key={angle} style={styles.row}>
          <Text style={styles.rowText}>{angle[0].toUpperCase() + angle.slice(1)}</Text>
          {view.missingBaselineAngles.includes(angle) ? button('Capture', onCaptureBaseline ? () => onCaptureBaseline(angle) : undefined, `Capture ${angle} baseline photo`) : <StatusBadge label="Captured" variant="active" />}
        </View>)}
      </GroupedSection>
      {view.stage === 'ready_to_submit' && <GroupedSection header="Ready for review"><View style={styles.cardInner}>
        <Text style={styles.body}>Review your saved context and photos, then submit your managed intake.</Text>{button('Submit managed intake', onSubmit)}
      </View></GroupedSection>}
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: layout.gutter, paddingBottom: spacing.xxxl, gap: spacing.sm },
  eyebrow: { color: colors.brand, fontSize: typography.sizes.micro, fontWeight: typography.weights.bold, letterSpacing: 1 },
  title: { color: colors.ink, fontSize: typography.sizes.screenTitle, lineHeight: typography.lineHeights.screenTitle, fontWeight: typography.weights.semibold },
  body: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  note: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption, marginBottom: spacing.md },
  priceRow: { gap: spacing.xs, alignItems: 'flex-start', marginVertical: spacing.sm },
  price: { color: colors.brand, fontSize: typography.sizes.sectionTitle, fontWeight: typography.weights.bold },
  cardInner: { padding: spacing.lg, gap: spacing.md },
  row: { minHeight: 62, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowText: { flex: 1, color: colors.ink, fontSize: typography.sizes.bodyRegular },
  action: { minHeight: layout.minTouchTarget, backgroundColor: colors.brand, borderRadius: radii.sm, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  actionText: { color: colors.inkInverse, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold },
});
