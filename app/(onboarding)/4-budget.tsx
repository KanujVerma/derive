import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { ProductCostPreference } from '@/src/types/schema';
import { SelectionCard } from '@/src/components/ui/SelectionCard';
import { StickyActionFooter } from '@/src/components/ui/StickyActionFooter';

const BUDGET_OPTIONS: Array<{
  value: ProductCostPreference;
  title: string;
  desc: string;
  priceHint: string;
}> = [
  {
    value: 'value',
    title: 'Value',
    desc: 'Keep it accessible. Focus on proven pharmacy staples with dependable performance.',
    priceHint: 'Accessible',
  },
  {
    value: 'balanced',
    title: 'Balanced',
    desc: 'Spend where it actually matters. Save on basic cleansers and invest in targeted treatments.',
    priceHint: 'Most common',
  },
  {
    value: 'premium',
    title: 'Premium When Worth It',
    desc: 'Comfortable investing more when a specialized formulation delivers superior texture or comfort.',
    priceHint: 'Higher investment',
  },
];

export default function BudgetScreen() {
  const router = useRouter();
  const { costPreference, setCostPreference } = useOnboardingStore();

  const handleSelect = (val: ProductCostPreference) => {
    setCostPreference(val);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.questionTitle}>
          What kind of product budget feels right?
        </Text>
        <Text style={styles.questionSubtitle}>
          We recommend products across brands based on fit for your skin. Expensive does not automatically mean better.
        </Text>

        <View style={styles.optionsList}>
          {BUDGET_OPTIONS.map((opt) => {
            const isSelected = costPreference === opt.value;
            return (
              <SelectionCard
                key={opt.value}
                title={opt.title}
                description={opt.desc}
                tags={[opt.priceHint]}
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
        onPressCta={() => router.push('/(onboarding)/5-behavior')}
        disabled={!costPreference}
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
