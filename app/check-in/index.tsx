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
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { submitWeeklyCheckIn } from '@/src/services/deriveClient';
import { SkinState, IrritationLevel, AdherenceLevel } from '@/src/types/schema';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { analytics } from '@/src/services/analytics';
import { getCustomerErrorMessage } from '@/src/utils/customerErrors';

const CHANGE_REASONS = [
  'Tried a new product',
  'Used an active more often',
  'Missed several days',
  'Travel or weather shift',
  'Nothing I can think of',
];

export default function CheckInModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { primaryGoal } = useOnboardingStore();

  const [skinState, setSkinState] = useState<SkinState>('better');
  const [adherence, setAdherence] = useState<AdherenceLevel>('yes');
  const [irritation, setIrritation] = useState<IrritationLevel>('none');
  const [selectedChange, setSelectedChange] = useState<string>('Nothing I can think of');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isFollowUpNeeded = skinState === 'worse' || irritation !== 'none';

  // Goal-specific questions
  const getGoalQuestion = () => {
    if (primaryGoal === 'breakouts') {
      return {
        title: 'How were your breakouts this week?',
        options: [
          { value: 'better', label: 'Fewer', desc: 'Noticeably fewer bumps or active blemishes' },
          { value: 'same', label: 'About the same', desc: 'Stable, no major new breakouts' },
          { value: 'worse', label: 'More', desc: 'More active flare-ups or congestion' },
        ],
      };
    }
    if (primaryGoal === 'dryness') {
      return {
        title: 'How has dryness felt this week?',
        options: [
          { value: 'better', label: 'Better', desc: 'More hydrated, less tightness' },
          { value: 'same', label: 'About the same', desc: 'Normal, no major flaking' },
          { value: 'worse', label: 'Worse', desc: 'Tighter, dry patches, or flaking' },
        ],
      };
    }
    return {
      title: 'How has your skin felt this week?',
      options: [
        { value: 'better', label: 'Better', desc: 'Calm, comfortable, and improving' },
        { value: 'same', label: 'About the same', desc: 'Stable, no major changes' },
        { value: 'worse', label: 'Worse', desc: 'Increased sensitivity or flare' },
      ],
    };
  };

  const goalQ = getGoalQuestion();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitWeeklyCheckIn({
        primaryGoal: primaryGoal || 'breakouts',
        skinState,
        irritation,
        adherence,
        notes: notes.trim() || undefined,
      });

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      analytics.track('checkin_completed', {
        outcome: skinState,
        irritationReported: irritation !== 'none',
        adherenceReported: true,
      });

      setSubmitted(true);
    } catch (err: any) {
      console.warn('Check-in submission failed:', err);
      setSubmitError(getCustomerErrorMessage('checkin'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    router.back();
  };

  if (submitted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.successContent}>
          <View style={styles.successIconCircle}>
            <Icon name="check" size={28} color={colors.brand} />
          </View>
          <Text style={styles.successHeadline}>Check-in Complete</Text>
          <Text style={styles.successMessage}>
            {irritation === 'lot'
              ? 'We noted your irritation. Skip active treatments tonight, and your team is reviewing your schedule.'
              : 'Recorded. Everything looks on track with your routine.'}
          </Text>
          <Button
            label="Back to Today"
            variant="primary"
            size="large"
            onPress={handleDone}
            style={{ width: '100%', marginTop: spacing.xl }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      {/* Modal Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.screenTitle}>Weekly Check-in</Text>
          <Text style={styles.screenSubtitle}>Takes about 30 seconds.</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Close check-in modal"
        >
          <Icon name="close" size={20} color={colors.inkMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* QUESTION 1: GOAL-SPECIFIC OUTCOME */}
        <Text style={styles.questionLabel}>{goalQ.title}</Text>
        <View style={styles.optionsColumn}>
          {goalQ.options.map((item) => {
            const isSelected = skinState === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSkinState(item.value as SkinState);
                }}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <View style={styles.radioDot}>
                  {isSelected && <View style={styles.radioDotInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                    {item.label}
                  </Text>
                  <Text style={styles.optionDesc}>{item.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* QUESTION 2: ROUTINE ADHERENCE */}
        <Text style={[styles.questionLabel, { marginTop: spacing.xl }]}>
          Were you able to follow your plan most days?
        </Text>
        <View style={styles.optionsRow}>
          {(
            [
              { value: 'yes', label: 'Yes' },
              { value: 'mostly', label: 'Mostly' },
              { value: 'not_really', label: 'Not really' },
            ] as const
          ).map((item) => {
            const isSelected = adherence === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setAdherence(item.value);
                }}
                style={[styles.chipButton, isSelected && styles.chipButtonSelected]}
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* QUESTION 3: IRRITATION */}
        <Text style={[styles.questionLabel, { marginTop: spacing.xl }]}>
          Any irritation or stinging?
        </Text>
        <View style={styles.optionsRow}>
          {(
            [
              { value: 'none', label: 'None' },
              { value: 'little', label: 'A little' },
              { value: 'lot', label: 'A lot' },
            ] as const
          ).map((item) => {
            const isSelected = irritation === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setIrritation(item.value);
                }}
                style={[styles.chipButton, isSelected && styles.chipButtonSelected]}
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CONDITIONAL FOLLOW-UP (Only if worsening or irritation reported) */}
        {isFollowUpNeeded && (
          <View style={styles.followUpSection}>
            <Text style={styles.questionLabel}>Did anything change this week?</Text>
            <View style={styles.chipsWrap}>
              {CHANGE_REASONS.map((reason) => {
                const isSelected = selectedChange === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedChange(reason);
                    }}
                    style={[styles.followUpChip, isSelected && styles.followUpChipSelected]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.followUpText, isSelected && styles.followUpTextSelected]}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* OPTIONAL NOTES */}
        <Text style={[styles.questionLabel, { marginTop: spacing.xl }]}>
          Anything else we should know? (Optional)
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g., Weather got dry, skipped sunscreen once..."
          placeholderTextColor={colors.inkSubtle}
          multiline={true}
          style={styles.notesInput}
        />

        {/* ERROR BANNER */}
        {submitError && (
          <View style={styles.errorBanner}>
            <Icon name="warning" size={16} color={colors.actionStop.text} />
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        )}

        {/* SUBMIT BUTTON */}
        <Button
          label={isSubmitting ? 'Submitting...' : 'Submit Check-in'}
          variant="primary"
          size="large"
          loading={isSubmitting}
          disabled={isSubmitting}
          onPress={handleSubmit}
          style={{ marginTop: submitError ? spacing.md : spacing.xxl }}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  screenTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
  },
  screenSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  questionLabel: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  optionsColumn: {
    gap: spacing.xs,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    ...shadows.subtle,
  },
  optionCardSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.surfaceElevated,
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  optionTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  optionTitleSelected: {
    color: colors.brand,
  },
  optionDesc: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chipButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  chipButtonSelected: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  chipText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
  chipTextSelected: {
    color: colors.brand,
    fontWeight: typography.weights.bold,
  },
  followUpSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  followUpChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  followUpChipSelected: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  followUpText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
  followUpTextSelected: {
    color: colors.brand,
    fontWeight: typography.weights.semibold,
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.actionStop.bg,
    borderColor: colors.actionStop.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.caption,
    color: colors.actionStop.text,
    fontWeight: typography.weights.medium,
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: radii.full,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successHeadline: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  successMessage: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
