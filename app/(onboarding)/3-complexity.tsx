import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { RoutineComplexity } from '@/src/types/schema';
import { Button } from '@/src/components/ui/Button';

const COMPLEXITY_OPTIONS: Array<{
  value: RoutineComplexity;
  title: string;
  desc: string;
  stepsHint: string;
}> = [
  {
    value: 'simple',
    title: 'Simple',
    desc: 'Clean essentials only: cleanse, moisturize, protect, and at most one core treatment.',
    stepsHint: '3–4 steps',
  },
  {
    value: 'balanced',
    title: 'Balanced',
    desc: 'A solid core routine with targeted steps added when there is a clear reason for your skin.',
    stepsHint: '4–5 steps',
  },
  {
    value: 'maximize',
    title: 'More Involved',
    desc: 'Willing to use extra hydrating layers and dedicated treatments when justified.',
    stepsHint: 'Comprehensive',
  },
];


export default function ComplexityScreen() {
  const router = useRouter();
  const { routineComplexity, setRoutineComplexity } = useOnboardingStore();

  const handleSelect = (val: RoutineComplexity) => {
    Haptics.selectionAsync();
    setRoutineComplexity(val);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.questionTitle}>
          How much skincare do you actually want to do?
        </Text>
        <Text style={styles.questionSubtitle}>
          We will never give you busywork. Simple routines are often the most effective.
        </Text>

        <View style={styles.optionsList}>
          {COMPLEXITY_OPTIONS.map((opt) => {
            const isSelected = routineComplexity === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => handleSelect(opt.value)}
                activeOpacity={0.7}
                style={[styles.card, isSelected && styles.cardSelected]}
                accessible={true}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                    {opt.title}
                  </Text>
                  <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                    <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                      {opt.stepsHint}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardDesc}>{opt.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label="Continue"
          variant="primary"
          size="large"
          onPress={() => router.push('/(onboarding)/4-budget')}
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
  questionTitle: {
    fontSize: typography.sizes.screenTitle,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  questionSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.bodyRegular,
    marginBottom: spacing.xl,
  },
  optionsList: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.card,
  },
  cardSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  cardTitleSelected: {
    color: colors.brand,
  },
  badge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  badgeSelected: {
    backgroundColor: colors.brand,
  },
  badgeText: {
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
  badgeTextSelected: {
    color: colors.inkInverse,
    fontWeight: typography.weights.bold,
  },
  cardDesc: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: typography.lineHeights.bodyRegular,
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.canvas,
  },
});
