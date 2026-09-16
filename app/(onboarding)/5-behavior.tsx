import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, typography, spacing } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { MiddayFeel } from '@/src/types/schema';
import { SelectionCard } from '@/src/components/ui/SelectionCard';
import { SelectionRow } from '@/src/components/ui/SelectionRow';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { StickyActionFooter } from '@/src/components/ui/StickyActionFooter';

const MIDDAY_OPTIONS: Array<{ value: MiddayFeel; label: string; desc: string }> = [
  { value: 'dry_tight', label: 'Dry or tight', desc: 'Needs hydration or tends to flake' },
  { value: 'comfortable', label: 'Comfortable', desc: 'Neither excessively dry nor shiny' },
  { value: 'combination', label: 'Combination', desc: 'Shiny forehead/nose, but normal or dry cheeks' },
  { value: 'oily_shiny', label: 'Oily or shiny all over', desc: 'Noticeable midday sheen across entire face' },
  { value: 'unsure', label: 'Not really sure', desc: 'Varies with seasons or hard to tell' },
];

export default function BehaviorScreen() {
  const router = useRouter();
  const { middayFeel, postCleanseTightness, setSkinBehavior } = useOnboardingStore();

  const [selectedMidday, setSelectedMidday] = useState<MiddayFeel | null>(middayFeel);
  const [tightness, setTightness] = useState<boolean | null>(postCleanseTightness);

  const handleContinue = () => {
    if (!selectedMidday) return;
    setSkinBehavior(selectedMidday, tightness ?? false);
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
          Tell us how your skin usually behaves throughout the day.
        </Text>

        {/* SECTION 1: MIDDAY FEEL */}
        <Text style={styles.sectionHeader}>By midday, your face usually feels...</Text>
        <View style={styles.optionsList}>
          {MIDDAY_OPTIONS.map((opt) => {
            const isSelected = selectedMidday === opt.value;
            return (
              <SelectionCard
                key={opt.value}
                title={opt.label}
                description={opt.desc}
                selected={isSelected}
                onPress={() => setSelectedMidday(opt.value)}
                style={styles.cardItem}
              />
            );
          })}
        </View>

        {/* SECTION 2: AFTER CLEANSING TIGHTNESS */}
        <Text style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          After washing your face, does your skin feel tight or squeaky?
        </Text>
        <GroupedSection>
          <SelectionRow
            title="Yes, often tight or stripped"
            subtitle="Indicates a fragile or recovering skin barrier"
            selected={tightness === true}
            onPress={() => setTightness(true)}
            type="radio"
          />
          <SelectionRow
            title="No, feels normal or comfortable"
            subtitle="Cleanser maintains natural barrier moisture"
            selected={tightness === false}
            onPress={() => setTightness(false)}
            type="radio"
          />
        </GroupedSection>
      </ScrollView>

      <StickyActionFooter
        ctaLabel="Continue"
        onPressCta={handleContinue}
        disabled={!selectedMidday || tightness === null}
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
  sectionHeader: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  optionsList: {
    gap: spacing.sm,
  },
  cardItem: {
    marginBottom: 0,
  },
});
