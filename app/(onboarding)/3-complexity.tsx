import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { RoutineComplexity } from '@/src/types/schema';
import { SelectionCard } from '@/src/components/ui/SelectionCard';
import { StickyActionFooter } from '@/src/components/ui/StickyActionFooter';

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
              <SelectionCard
                key={opt.value}
                title={opt.title}
                description={opt.desc}
                tags={[opt.stepsHint]}
                selected={isSelected}
                onPress={() => handleSelect(opt.value)}
                style={styles.cardItem}
              />
            );
          })}
        </View>
      </ScrollView>

      <StickyActionFooter
        ctaLabel="Continue"
        onPressCta={() => router.push('/(onboarding)/4-budget')}
        disabled={!routineComplexity}
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
    paddingBottom: spacing.xxl + 80,
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
});
