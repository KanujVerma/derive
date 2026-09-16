import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { MiddayFeel } from '@/src/types/schema';
import { Button } from '@/src/components/ui/Button';

const MIDDAY_OPTIONS: Array<{ value: MiddayFeel; label: string; desc: string }> = [
  { value: 'dry_tight', label: 'Dry or tight', desc: 'Needs hydration or flakes' },
  { value: 'comfortable', label: 'Comfortable', desc: 'Neither excessively dry nor shiny' },
  { value: 'combination', label: 'Combination', desc: 'Shiny forehead/nose, but normal or dry cheeks' },
  { value: 'oily_shiny', label: 'Oily or shiny all over', desc: 'Noticeable midday sheen across face' },
  { value: 'unsure', label: 'I am not really sure', desc: 'Varies with seasons or hard to tell' },
];

export default function BehaviorScreen() {
  const router = useRouter();
  const { middayFeel, postCleanseTightness, setSkinBehavior } = useOnboardingStore();

  const [selectedMidday, setSelectedMidday] = useState<MiddayFeel>(middayFeel);
  const [tightness, setTightness] = useState<boolean>(postCleanseTightness);

  const handleSelectMidday = (val: MiddayFeel) => {
    Haptics.selectionAsync();
    setSelectedMidday(val);
  };

  const handleToggleTightness = (val: boolean) => {
    Haptics.selectionAsync();
    setTightness(val);
  };

  const handleContinue = () => {
    setSkinBehavior(selectedMidday, tightness);
    router.push('/(onboarding)/6-shelf');
  };


  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.questionTitle}>Your Skin</Text>
        <Text style={styles.questionSubtitle}>
          Tell us how your skin usually feels during the day.
        </Text>


        {/* SECTION 1: MIDDAY FEEL */}
        <Text style={styles.sectionLabel}>By midday, your face usually feels...</Text>
        <View style={styles.optionsList}>
          {MIDDAY_OPTIONS.map((opt) => {
            const isSelected = selectedMidday === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => handleSelectMidday(opt.value)}
                activeOpacity={0.7}
                style={[styles.card, isSelected && styles.cardSelected]}
                accessible={true}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <View style={styles.radioDot}>
                  {isSelected && <View style={styles.radioDotInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.cardDesc}>{opt.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* SECTION 2: AFTER CLEANSING TIGHTNESS */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>
          After washing your face, does your skin feel tight or squeaky?
        </Text>
        <View style={styles.binaryRow}>
          <TouchableOpacity
            onPress={() => handleToggleTightness(true)}
            style={[styles.binaryButton, tightness && styles.binaryButtonSelected]}
            activeOpacity={0.7}
          >
            <Text style={[styles.binaryText, tightness && styles.binaryTextSelected]}>
              Yes, often tight
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleToggleTightness(false)}
            style={[styles.binaryButton, !tightness && styles.binaryButtonSelected]}
            activeOpacity={0.7}
          >
            <Text style={[styles.binaryText, !tightness && styles.binaryTextSelected]}>
              No, comfortable
            </Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  optionsList: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadows.card,
  },
  cardSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brand,
  },
  cardTitle: {
    fontSize: typography.sizes.bodyLarge,
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
  },
  binaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  binaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  binaryButtonSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  binaryText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    fontWeight: typography.weights.medium,
  },
  binaryTextSelected: {
    color: colors.brand,
    fontWeight: typography.weights.bold,
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.canvas,
  },
});
