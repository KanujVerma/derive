import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { ProductCostPreference } from '@/src/types/schema';
import { Button } from '@/src/components/ui/Button';

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
    Haptics.selectionAsync();
    setCostPreference(val);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.questionTitle}>
          How should we think about product cost?
        </Text>
        <Text style={styles.questionSubtitle}>
          We recommend products across brands based on fit for your skin.
        </Text>


        <View style={styles.optionsList}>
          {BUDGET_OPTIONS.map((opt) => {
            const isSelected = costPreference === opt.value;
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
                      {opt.priceHint}
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
          onPress={() => router.push('/(onboarding)/5-behavior')}
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
