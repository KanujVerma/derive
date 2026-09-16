import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii, shadows } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { Button } from '@/src/components/ui/Button';

export default function ClarificationScreen() {
  const router = useRouter();
  const { adaptiveFollowUps, setAdaptiveAnswer } = useOnboardingStore();

  const handleSelectQuickAnswer = (index: number, answer: string) => {
    Haptics.selectionAsync();
    setAdaptiveAnswer(index, answer);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.aiHeader}>
          <Text style={styles.aiBadge}>DERIVE INTELLIGENCE</Text>
          <Text style={styles.questionTitle}>A few targeted clarifications.</Text>
          <Text style={styles.questionSubtitle}>
            Based on your shelf products and goals, answering these helps us fine-tune your routine.
          </Text>
        </View>

        {adaptiveFollowUps.map((item, idx) => (
          <View key={idx} style={styles.questionCard}>
            <Text style={styles.qText}>{item.question}</Text>

            {/* Quick Answer Chips if applicable */}
            {idx === 0 && (
              <View style={styles.quickChipsRow}>
                {['1-2 nights', '3-4 nights', 'Every night', 'Not sure'].map((chip) => {
                  const isSelected = item.answer?.includes(chip);
                  return (
                    <TouchableOpacity
                      key={chip}
                      onPress={() => handleSelectQuickAnswer(idx, chip)}
                      style={[styles.quickChip, isSelected && styles.quickChipSelected]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.quickChipText,
                          isSelected && styles.quickChipTextSelected,
                        ]}
                      >
                        {chip}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Text input for custom answer */}
            <TextInput
              value={item.answer || ''}
              onChangeText={(text) => setAdaptiveAnswer(idx, text)}
              placeholder="Type your answer here..."
              placeholderTextColor={colors.inkMuted}
              style={styles.textInput}
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label="Review Profile Summary"
          variant="primary"
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
    fontSize: typography.sizes.screenTitle,
    fontWeight: typography.weights.bold,
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
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  qText: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    lineHeight: typography.lineHeights.bodyLarge,
    marginBottom: spacing.sm,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  quickChip: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickChipSelected: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  quickChipText: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
  },
  quickChipTextSelected: {
    color: colors.brand,
    fontWeight: typography.weights.bold,
  },
  textInput: {
    backgroundColor: colors.canvas,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.canvas,
  },
});
