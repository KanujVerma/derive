import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';

const DIFFERIN_FREQUENCY_OPTIONS = [
  '1–2 nights',
  '3–4 nights',
  '5–6 nights',
  'Every night',
  'Not sure',
];

const PIH_TENDENCY_OPTIONS: Array<'Rarely' | 'Sometimes' | 'Often' | 'Not sure'> = [
  'Rarely',
  'Sometimes',
  'Often',
  'Not sure',
];

export default function ClarificationScreen() {
  const router = useRouter();
  const {
    primaryGoal,
    secondaryGoals,
    adaptiveFollowUps,
    setAdaptiveAnswer,
    pihTendencyAnswer,
    setPihTendencyAnswer,
  } = useOnboardingStore();

  const handleSelectQuickAnswer = (index: number, answer: string) => {
    Haptics.selectionAsync();
    setAdaptiveAnswer(index, answer);
  };

  const allGoals = [primaryGoal, ...secondaryGoals].filter(Boolean);
  const showPihQuestion = allGoals.includes('breakouts') || allGoals.includes('dark_spots');
  const hasFollowUps = adaptiveFollowUps.length > 0 || showPihQuestion;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.aiHeader}>
          <Text style={styles.aiBadge}>DERIVE INTELLIGENCE</Text>
          <Text style={styles.questionTitle}>
            {hasFollowUps ? 'A few targeted clarifications.' : 'All clear.'}
          </Text>
          <Text style={styles.questionSubtitle}>
            {hasFollowUps
              ? 'Based on your shelf products and goals, selecting your current usage helps us calibrate your routine safely.'
              : 'We have all the context we need from your shelf audit, safety checks, and goals.'}
          </Text>
        </View>

        {adaptiveFollowUps.map((item, idx) => (
          <View key={idx} style={styles.questionCard}>
            <Text style={styles.qText}>{item.question}</Text>

            {/* Structured Frequency Choices */}
            <View style={styles.structuredOptionsContainer}>
              {DIFFERIN_FREQUENCY_OPTIONS.map((choice) => {
                const isSelected = item.answer === choice || item.answer?.includes(choice);
                return (
                  <TouchableOpacity
                    key={choice}
                    onPress={() => handleSelectQuickAnswer(idx, choice)}
                    style={[
                      styles.choiceRow,
                      isSelected && styles.choiceRowSelected,
                    ]}
                    activeOpacity={0.7}
                    accessible={true}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        isSelected && styles.choiceTextSelected,
                      ]}
                    >
                      {choice}
                    </Text>
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleSelected,
                      ]}
                    >
                      {isSelected ? <View style={styles.radioDot} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {showPihQuestion && (
          <View style={styles.questionCard}>
            <Text style={styles.qCategory}>POST-INFLAMMATORY RESPONSE</Text>
            <Text style={styles.qText}>
              Do breakouts or irritation usually leave dark marks that stick around?
            </Text>
            <Text style={styles.qHint}>
              Helps calibrate active exfoliation pacing and photoprotection without risking irritation.
            </Text>

            <View style={styles.structuredOptionsContainer}>
              {PIH_TENDENCY_OPTIONS.map((choice) => {
                const isSelected = pihTendencyAnswer === choice;
                return (
                  <TouchableOpacity
                    key={choice}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPihTendencyAnswer(choice);
                    }}
                    style={[
                      styles.choiceRow,
                      isSelected && styles.choiceRowSelected,
                    ]}
                    activeOpacity={0.7}
                    accessible={true}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        isSelected && styles.choiceTextSelected,
                      ]}
                    >
                      {choice}
                    </Text>
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleSelected,
                      ]}
                    >
                      {isSelected ? <View style={styles.radioDot} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {!hasFollowUps && (
          <View style={styles.emptyCard}>
            <Icon name="check" size={24} color={colors.brand} />
            <Text style={styles.emptyTitle}>Ready to Assemble Your Routine</Text>
            <Text style={styles.emptySub}>
              Tap below to review your answers and generate your personalized plan.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label="Review Profile Summary"
          variant="brand"
          size="large"
          onPress={() => router.push('/(onboarding)/10-summary')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  aiHeader: {
    marginBottom: spacing.lg,
  },
  aiBadge: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 1.2,
    color: colors.brand,
    marginBottom: spacing.xxs,
  },
  questionTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  questionSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.bodyRegular,
  },
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  qCategory: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.brand,
    marginBottom: spacing.xxs,
  },
  qText: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    lineHeight: typography.lineHeights.bodyLarge,
    marginBottom: spacing.xs,
  },
  qHint: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.caption,
    marginBottom: spacing.md,
  },
  structuredOptionsContainer: {
    gap: spacing.xs,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceRowSelected: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  choiceText: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  choiceTextSelected: {
    color: colors.brandDark,
    fontWeight: typography.weights.semibold,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  radioCircleSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.sizes.sectionTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.canvas,
  },
});
