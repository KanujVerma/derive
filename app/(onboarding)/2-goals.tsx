import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { Goal, GoalLabels } from '@/src/types/schema';
import { SelectionCard } from '@/src/components/ui/SelectionCard';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { StickyActionFooter } from '@/src/components/ui/StickyActionFooter';

const GOALS_LIST = Object.keys(GoalLabels) as Goal[];

export default function GoalsScreen() {
  const router = useRouter();
  const {
    primaryGoal,
    secondaryGoals,
    setPrimaryGoal,
  } = useOnboardingStore();

  const [selectedGoals, setSelectedGoals] = useState<Goal[]>(
    primaryGoal ? [primaryGoal, ...secondaryGoals] : []
  );

  const [currentPrimary, setCurrentPrimary] = useState<Goal | null>(
    primaryGoal || null
  );

  const handleToggleGoal = (goal: Goal) => {
    let updated: Goal[];
    if (selectedGoals.includes(goal)) {
      updated = selectedGoals.filter((g) => g !== goal);
      setSelectedGoals(updated);
      if (currentPrimary === goal) {
        setCurrentPrimary(updated.length > 0 ? updated[0] : null);
      }
    } else {
      updated = [...selectedGoals, goal];
      setSelectedGoals(updated);
      if (!currentPrimary) {
        setCurrentPrimary(goal);
      }
    }
  };

  const handleSelectPrimary = (goal: Goal) => {
    setCurrentPrimary(goal);
  };

  const handleContinue = () => {
    if (!currentPrimary) return;
    setPrimaryGoal(currentPrimary);
    const secondaries = selectedGoals.filter((g) => g !== currentPrimary);
    useOnboardingStore.setState({ secondaryGoals: secondaries });
    router.push('/(onboarding)/3-complexity');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.questionTitle}>What would you like to improve?</Text>
        <Text style={styles.questionSubtitle}>
          Select everything that applies to your skin.
        </Text>

        <View style={styles.optionsList}>
          {GOALS_LIST.map((goal) => {
            const isSelected = selectedGoals.includes(goal);
            const meta = GoalLabels[goal];

            return (
              <SelectionCard
                key={goal}
                title={meta.label}
                description={meta.description}
                selected={isSelected}
                selectionType="checkbox"
                onPress={() => handleToggleGoal(goal)}
                style={styles.cardItem}
              />
            );
          })}
        </View>

        {/* Priority Selector when multiple goals selected */}
        {selectedGoals.length > 1 && (
          <View style={styles.prioritySection}>
            <Text style={styles.priorityHeading}>Which matters most right now?</Text>
            <Text style={styles.prioritySub}>
              We will balance your routine around this as the primary focus.
            </Text>

            <View style={styles.priorityPillContainer}>
              {selectedGoals.map((goal) => {
                const isPrimary = currentPrimary === goal;
                const meta = GoalLabels[goal];

                return (
                  <ChoiceChip
                    key={goal}
                    label={meta.label}
                    selected={isPrimary}
                    onSelect={() => handleSelectPrimary(goal)}
                    style={styles.choiceChip}
                  />
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <StickyActionFooter
        ctaLabel="Continue"
        onPressCta={handleContinue}
        disabled={selectedGoals.length === 0 || !currentPrimary}
      />
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
    paddingBottom: spacing.xxl + 100,
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
    marginBottom: spacing.lg,
  },
  optionsList: {
    gap: spacing.sm,
  },
  cardItem: {
    marginBottom: 0,
  },
  prioritySection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  priorityHeading: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: 2,
  },
  prioritySub: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.caption,
    marginBottom: spacing.md,
  },
  priorityPillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  choiceChip: {
    marginBottom: spacing.xxs,
  },
});
