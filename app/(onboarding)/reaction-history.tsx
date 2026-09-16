import React, { useState } from 'react';
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
import {
  BodyArea,
  ReactionSeverity,
  ReactionSymptom,
  ReactionSymptomLabels,
} from '@/src/types/schema';
import { Button } from '@/src/components/ui/Button';
import { VoiceInputButton } from '@/src/components/ui/VoiceInputButton';

const BODY_AREAS: Array<{ value: BodyArea; label: string }> = [
  { value: 'underarms', label: 'Underarms' },
  { value: 'cheeks', label: 'Cheeks' },
  { value: 'around_eyes', label: 'Around eyes' },
  { value: 'face', label: 'Face (general)' },
  { value: 'forehead', label: 'Forehead' },
  { value: 'jawline', label: 'Jawline / Chin' },
  { value: 'neck', label: 'Neck' },
  { value: 'scalp', label: 'Scalp' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'body', label: 'Body' },
  { value: 'other', label: 'Other' },
];

const SYMPTOMS_LIST: Array<{ value: ReactionSymptom; label: string }> = [
  { value: 'burning_stinging', label: 'Burning or stinging' },
  { value: 'redness_rash', label: 'Redness or rash' },
  { value: 'itching', label: 'Itching' },
  { value: 'breakouts', label: 'Breakouts' },
  { value: 'dryness_peeling', label: 'Dryness or peeling' },
  { value: 'swelling', label: 'Swelling' },
  { value: 'other', label: 'Something else' },
];

const SEVERITY_LEVELS: Array<{ value: ReactionSeverity; label: string; desc: string }> = [
  { value: 'mild', label: 'Mild', desc: 'Slight irritation that resolved quickly' },
  { value: 'moderate', label: 'Moderate', desc: 'Noticeable discomfort or prolonged flare' },
  { value: 'severe', label: 'Severe', desc: 'Intense reaction, severe burning, or swelling' },
];

export default function ReactionHistoryScreen() {
  const router = useRouter();
  const { addProductReaction } = useOnboardingStore();

  const [productName, setProductName] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<ReactionSymptom[]>(['burning_stinging']);
  const [selectedArea, setSelectedArea] = useState<BodyArea>('face');
  const [severity, setSeverity] = useState<ReactionSeverity>('moderate');
  const [notes, setNotes] = useState('');

  const toggleSymptom = (symptom: ReactionSymptom) => {
    Haptics.selectionAsync();
    if (selectedSymptoms.includes(symptom)) {
      if (selectedSymptoms.length === 1) return;
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== symptom));
    } else {
      setSelectedSymptoms([...selectedSymptoms, symptom]);
    }
  };

  const handleSave = () => {
    const trimmedName = productName.trim() || 'Unspecified past product';
    addProductReaction({
      productName: trimmedName,
      symptoms: selectedSymptoms,
      bodyArea: selectedArea,
      severity,
      notes: notes.trim() || undefined,
    });

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    router.back();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Past Product Reaction</Text>
        <Text style={styles.screenSubtitle}>
          Tell us what product caused an issue and how your skin reacted. Derive will inspect the formulation in the background.
        </Text>

        {/* 1. PRODUCT NAME */}
        <Text style={styles.sectionLabel}>Which product caused the reaction?</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. Old Spice gel deodorant, glycolic toner..."
          placeholderTextColor={colors.inkSubtle}
          value={productName}
          onChangeText={setProductName}
          autoFocus={false}
        />

        {/* 2. SYMPTOMS */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
          What happened?
        </Text>
        <View style={styles.chipRow}>
          {SYMPTOMS_LIST.map((item) => {
            const isSelected = selectedSymptoms.includes(item.value);
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => toggleSymptom(item.value)}
                style={[styles.chip, isSelected && styles.chipActive]}
                accessible={true}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 3. BODY AREA */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
          Where did it happen?
        </Text>
        <View style={styles.chipRow}>
          {BODY_AREAS.map((item) => {
            const isSelected = selectedArea === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedArea(item.value);
                }}
                style={[styles.chip, isSelected && styles.chipActive]}
                accessible={true}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 4. SEVERITY */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>
          How severe was it?
        </Text>
        <View style={styles.severityColumn}>
          {SEVERITY_LEVELS.map((item) => {
            const isSelected = severity === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSeverity(item.value);
                }}
                style={[styles.severityCard, isSelected && styles.severityCardActive]}
                accessible={true}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
              >
                <View style={styles.radioDot}>
                  {isSelected && <View style={styles.radioDotInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.severityTitle, isSelected && styles.severityTitleActive]}>
                    {item.label}
                  </Text>
                  <Text style={styles.severityDesc}>{item.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 5. OPTIONAL NOTES */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg }}>
          <Text style={styles.sectionLabel}>
            Anything else we should know? (Optional)
          </Text>
          <VoiceInputButton
            context="reaction_note"
            size={32}
            onTranscript={(transcribed) => {
              setNotes(notes ? `${notes} ${transcribed}` : transcribed);
            }}
          />
        </View>
        <TextInput
          style={[styles.textInput, styles.multilineInput]}
          placeholder="e.g. Cleared up after 3 days of skipping it..."
          placeholderTextColor={colors.inkSubtle}
          value={notes}
          onChangeText={setNotes}
          multiline={true}
        />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label="Save Reaction"
          variant="primary"
          size="large"
          onPress={handleSave}
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
  screenTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  screenSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  chipText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
  chipTextActive: {
    color: colors.brand,
    fontWeight: typography.weights.semibold,
  },
  severityColumn: {
    gap: spacing.xs,
  },
  severityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    ...shadows.subtle,
  },
  severityCardActive: {
    borderColor: colors.brand,
    backgroundColor: colors.surfaceElevated,
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
  },
  severityTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: 2,
  },
  severityTitleActive: {
    color: colors.brand,
  },
  severityDesc: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
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
