import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { Goal, GoalLabels } from '@/src/types/schema';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';

const GOALS_LIST = Object.keys(GoalLabels) as Goal[];

export default function GoalsScreen() {
  const router = useRouter();
  const {
    primaryGoal,
    secondaryGoals,
    setPrimaryGoal,
  } = useOnboardingStore();

  const [selectedGoals, setSelectedGoals] = useState<Goal[]>(
    primaryGoal ? [primaryGoal, ...secondaryGoals] : ['breakouts']
  );

  const [currentPrimary, setCurrentPrimary] = useState<Goal>(
    primaryGoal || 'breakouts'
  );

  const handleToggleGoal = (goal: Goal) => {
    Haptics.selectionAsync();
    let updated: Goal[];

    if (selectedGoals.includes(goal)) {
      if (selectedGoals.length === 1) return; // Keep at least one
      updated = selectedGoals.filter((g) => g !== goal);
      setSelectedGoals(updated);
      if (currentPrimary === goal) {
        setCurrentPrimary(updated[0]);
      }
    } else {
      updated = [...selectedGoals, goal];
      setSelectedGoals(updated);
    }
  };

  const handleSelectPrimary = (goal: Goal) => {
    Haptics.selectionAsync();
    setCurrentPrimary(goal);
  };

  const handleContinue = () => {
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
              <TouchableOpacity
                key={goal}
                onPress={() => handleToggleGoal(goal)}
                activeOpacity={0.7}
                style={[styles.card, isSelected && styles.cardSelected]}
                accessible={true}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                    {meta.label}
                  </Text>
                  <Text style={styles.cardDesc}>{meta.description}</Text>
                </View>

                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Icon name="check" size={14} color={colors.inkInverse} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Priority Selector when multiple goals selected */}
        {selectedGoals.length > 1 && (
          <View style={styles.prioritySection}>
            <Text style={styles.priorityHeading}>Which matters most right now?</Text>
            <Text style={styles.prioritySub}>
              We will balance your routine around this as the main focus.
            </Text>

            <View style={styles.priorityPillContainer}>
              {selectedGoals.map((goal) => {
                const isPrimary = currentPrimary === goal;
                const meta = GoalLabels[goal];

                return (
                  <TouchableOpacity
                    key={goal}
                    onPress={() => handleSelectPrimary(goal)}
                    style={[
                      styles.priorityChoiceChip,
                      isPrimary && styles.priorityChoiceChipActive,
                    ]}
                    accessible={true}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isPrimary }}
                  >
                    <Text
                      style={[
                        styles.priorityChoiceText,
                        isPrimary && styles.priorityChoiceTextActive,
                      ]}
                    >
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label="Continue"
          variant="primary"
          size="large"
          onPress={handleContinue}
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
    paddingBottom: spacing.xxl + 80,
  },
  questionTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  questionSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    marginBottom: spacing.lg,
  },
  optionsList: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    ...shadows.subtle,
  },
  cardSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.surfaceElevated,
  },
  cardTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: 2,
  },
  cardTitleSelected: {
    color: colors.brand,
  },
  cardDesc: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.xs,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  checkboxSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  prioritySection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  priorityHeading: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: 2,
  },
  prioritySub: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginBottom: spacing.md,
  },
  priorityPillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  priorityChoiceChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.full,
  },
  priorityChoiceChipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  priorityChoiceText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.inkMuted,
  },
  priorityChoiceTextActive: {
    color: colors.brand,
    fontWeight: typography.weights.semibold,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});
