import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useRoutineStore } from '@/src/stores/routineStore';
import { RoutineCard } from '@/src/components/routine/RoutineCard';
import { Button } from '@/src/components/ui/Button';

export default function ReviewRoutineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { routine, updateRoutineByFounder } = useRoutineStore();

  const [founderNotes, setFounderNotes] = useState(
    'Reviewed patient skin sensitivity. Started Differin 2 nights a week (Mon/Thu) with moisturizer applied before and after.'
  );
  const [approved, setApproved] = useState(false);

  const handleApprove = async () => {
    if (!routine) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const updated = {
      ...routine,
      status: 'published' as const,
      founderNotes,
      summarySentence: 'Barrier-first routine approved by founder concierge.',
      publishedAt: new Date().toISOString(),
    };

    updateRoutineByFounder(updated);
    setApproved(true);
  };

  if (approved) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60, paddingHorizontal: spacing.xl }]}>
        <View style={styles.successBox}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>Routine Approved & Published</Text>
          <Text style={styles.successMsg}>
            The updated routine is now live on the customer's Today and Plan screens.
          </Text>
          <Button
            label="Return to Operations Queue"
            variant="primary"
            size="large"
            onPress={() => router.replace('/founder')}
            style={{ width: '100%', marginTop: spacing.xl }}
          />
        </View>
      </View>
    );
  }

  const amSteps = routine?.amSteps || [];
  const pmSteps = routine?.pmSteps || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessible={true}
          accessibilityLabel="Back to operations queue"
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Routine Review</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.customerContextBox}>
          <Text style={styles.contextCustomer}>Customer: Eleanor Vance</Text>
          <Text style={styles.contextGoal}>Goal: Barrier Repair & Breakouts</Text>
          <Text style={styles.contextAlert}>
            AI Note: User indicated dryness after cleansing. Keep Differin frequency conservative.
          </Text>
        </View>

        {/* PROPOSED STEPS */}
        <Text style={styles.sectionTitle}>Proposed AM Steps</Text>
        {amSteps.map((step) => (
          <RoutineCard
            key={step.id}
            step={step}
          />
        ))}

        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
          Proposed PM Steps
        </Text>
        {pmSteps.map((step) => (
          <RoutineCard
            key={step.id}
            step={step}
          />
        ))}

        {/* FOUNDER CLINICAL NOTES */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
          Founder Clinical Notes
        </Text>
        <TextInput
          value={founderNotes}
          onChangeText={setFounderNotes}
          multiline={true}
          style={styles.notesInput}
        />

        {/* ACTION BUTTONS */}
        <Button
          label="Approve & Publish to Customer"
          variant="brand"
          size="large"
          onPress={handleApprove}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
    paddingVertical: spacing.xs,
  },
  backText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.brand,
    fontWeight: typography.weights.semibold,
  },
  screenTitle: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  customerContextBox: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadows.subtle,
  },
  contextCustomer: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  contextGoal: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  contextAlert: {
    fontSize: typography.sizes.caption,
    color: colors.actionKeep.text,
    backgroundColor: colors.actionKeep.bg,
    padding: spacing.xs,
    borderRadius: radii.xs,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  successBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand,
    color: colors.inkInverse,
    fontSize: 32,
    textAlign: 'center',
    lineHeight: 64,
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: typography.sizes.screenTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  successMsg: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: typography.lineHeights.bodyRegular,
  },
});
