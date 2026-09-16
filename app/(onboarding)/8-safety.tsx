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
import { Button } from '@/src/components/ui/Button';

const PRESCRIPTIONS_LIST = [
  'Differin / Adapalene',
  'Tretinoin / Retin-A',
  'Oral Spironolactone',
  'Isotretinoin (Accutane)',
  'None of these',
];

const SENSITIVITIES_LIST = [
  'Synthetic Fragrance',
  'Essential Oils',
  'High % Niacinamide',
  'Strong Benzoyl Peroxide',
  'No known allergies',
];

export default function SafetyScreen() {
  const router = useRouter();
  const {
    activePrescriptions,
    knownSensitivities,
    isPregnantOrNursing,
    additionalSafetyNotes,
    detectedProducts,
    setSafetyContext,
  } = useOnboardingStore();

  // Check if Differin or retinoid was detected on shelf
  const hasDifferinOnShelf = detectedProducts.some(
    (p) =>
      p.brand.toLowerCase().includes('differin') ||
      p.name.toLowerCase().includes('differin') ||
      p.name.toLowerCase().includes('adapalene')
  );

  const [isUsingDifferin, setIsUsingDifferin] = useState<boolean | null>(
    hasDifferinOnShelf ? true : null
  );

  const [allergies, setAllergies] = useState<string[]>(
    knownSensitivities.filter((s) => s !== 'No known allergies' && s !== 'Synthetic Fragrance' && s !== 'Essential Oils')
  );
  const [allergyInput, setAllergyInput] = useState('');
  const [hasNoAllergies, setHasNoAllergies] = useState(
    knownSensitivities.includes('No known allergies') || allergies.length === 0
  );

  const [additionalRx, setAdditionalRx] = useState<string[]>(
    activePrescriptions.filter((rx) => !rx.includes('Differin') && rx !== 'None of these')
  );
  const [hasNoAdditionalRx, setHasNoAdditionalRx] = useState(
    activePrescriptions.includes('None of these') || (hasDifferinOnShelf && activePrescriptions.length <= 1)
  );
  const [customRxInput, setCustomRxInput] = useState('');

  const [pregnancyChoice, setPregnancyChoice] = useState<'yes' | 'no' | 'prefer_not_to_say'>(
    isPregnantOrNursing ? 'yes' : 'no'
  );
  const [notes, setNotes] = useState<string>(additionalSafetyNotes);

  const handleAddAllergy = () => {
    const trimmed = allergyInput.trim();
    if (!trimmed) return;
    Haptics.selectionAsync();
    if (!allergies.includes(trimmed)) {
      setAllergies([...allergies, trimmed]);
      setHasNoAllergies(false);
    }
    setAllergyInput('');
  };

  const handleRemoveAllergy = (item: string) => {
    Haptics.selectionAsync();
    const updated = allergies.filter((a) => a !== item);
    setAllergies(updated);
    if (updated.length === 0) {
      setHasNoAllergies(true);
    }
  };

  const handleToggleNoAllergies = () => {
    Haptics.selectionAsync();
    setHasNoAllergies(true);
    setAllergies([]);
  };

  const toggleAdditionalRx = (rx: string) => {
    Haptics.selectionAsync();
    if (additionalRx.includes(rx)) {
      setAdditionalRx(additionalRx.filter((r) => r !== rx));
    } else {
      setAdditionalRx([...additionalRx, rx]);
      setHasNoAdditionalRx(false);
    }
  };

  const handleAddCustomRx = () => {
    const trimmed = customRxInput.trim();
    if (!trimmed) return;
    Haptics.selectionAsync();
    if (!additionalRx.includes(trimmed)) {
      setAdditionalRx([...additionalRx, trimmed]);
      setHasNoAdditionalRx(false);
    }
    setCustomRxInput('');
  };

  const handleToggleNoAdditionalRx = () => {
    Haptics.selectionAsync();
    setHasNoAdditionalRx(true);
    setAdditionalRx([]);
  };

  const handleContinue = () => {
    const finalRx: string[] = [];
    if (hasDifferinOnShelf && isUsingDifferin) {
      finalRx.push('Differin / Adapalene');
    }
    finalRx.push(...additionalRx);
    if (finalRx.length === 0) {
      finalRx.push('None of these');
    }

    const finalSens = hasNoAllergies || allergies.length === 0
      ? ['No known allergies']
      : allergies;

    const notesWithPregnancy =
      pregnancyChoice === 'prefer_not_to_say'
        ? notes ? `${notes} (Pregnancy status: Prefer not to say)` : 'Pregnancy status: Prefer not to say'
        : notes;

    setSafetyContext({
      sensitivities: finalSens,
      prescriptions: finalRx,
      pregnancy: pregnancyChoice === 'yes',
      notes: notesWithPregnancy,
    });

    router.push('/(onboarding)/7-skin-photos');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.questionTitle}>Safety Context</Text>
        <Text style={styles.questionSubtitle}>
          A few quick details so we never introduce a product that conflicts with your skin.
        </Text>

        {/* 1. ALLERGIES */}
        <Text style={styles.sectionHeader}>Any allergies you already know about?</Text>
        <Text style={styles.sectionHint}>
          Prescription drugs, topical ingredients, or contact allergens.
        </Text>

        <TouchableOpacity
          onPress={handleToggleNoAllergies}
          style={[styles.nonePill, hasNoAllergies && styles.nonePillActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.nonePillText, hasNoAllergies && styles.nonePillTextActive]}>
            None that I know of
          </Text>
        </TouchableOpacity>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.searchInput}
            value={allergyInput}
            onChangeText={setAllergyInput}
            placeholder="Search or type an allergy..."
            placeholderTextColor={colors.inkMuted}
            onSubmitEditing={handleAddAllergy}
            returnKeyType="done"
          />
          {allergyInput.trim().length > 0 && (
            <TouchableOpacity
              onPress={handleAddAllergy}
              style={styles.inlineAddBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.inlineAddBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {allergies.length > 0 && (
          <View style={styles.chipsWrap}>
            {allergies.map((allergy) => (
              <View key={allergy} style={styles.activeAllergyChip}>
                <Text style={styles.activeAllergyText}>{allergy}</Text>
                <TouchableOpacity
                  onPress={() => handleRemoveAllergy(allergy)}
                  style={styles.chipRemove}
                  accessibilityLabel={`Remove ${allergy}`}
                >
                  <Text style={styles.chipRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* 2. PRESCRIPTIONS & STRONG TREATMENTS */}
        <Text style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          Prescription & strong treatment products
        </Text>

        {hasDifferinOnShelf && (
          <View style={styles.detectedDifferinCard}>
            <Text style={styles.detectedDifferinTitle}>
              We found Differin Gel 0.1% on your shelf.
            </Text>
            <Text style={styles.detectedDifferinPrompt}>
              Are you currently using it?
            </Text>
            <View style={styles.binaryRow}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setIsUsingDifferin(true);
                }}
                style={[
                  styles.binaryBtn,
                  isUsingDifferin === true && styles.binaryBtnSelected,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.binaryText,
                    isUsingDifferin === true && styles.binaryTextSelected,
                  ]}
                >
                  Yes, currently using it
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setIsUsingDifferin(false);
                }}
                style={[
                  styles.binaryBtn,
                  isUsingDifferin === false && styles.binaryBtnSelected,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.binaryText,
                    isUsingDifferin === false && styles.binaryTextSelected,
                  ]}
                >
                  No, stopped or haven't started
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={[styles.subSectionHeader, { marginTop: spacing.md }]}>
          Are you using any prescription or strong treatment products we didn't find?
        </Text>

        <TouchableOpacity
          onPress={handleToggleNoAdditionalRx}
          style={[styles.nonePill, hasNoAdditionalRx && styles.nonePillActive]}
          activeOpacity={0.7}
        >
          <Text style={[styles.nonePillText, hasNoAdditionalRx && styles.nonePillTextActive]}>
            None that I know of
          </Text>
        </TouchableOpacity>

        <View style={styles.chipsWrap}>
          {['Tretinoin / Retin-A', 'Oral Spironolactone', 'Accutane / Isotretinoin'].map((rx) => {
            const isSelected = additionalRx.includes(rx);
            return (
              <TouchableOpacity
                key={rx}
                onPress={() => toggleAdditionalRx(rx)}
                style={[styles.chip, isSelected && styles.chipSelected]}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {rx}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.inputRow, { marginTop: spacing.xs }]}>
          <TextInput
            style={styles.searchInput}
            value={customRxInput}
            onChangeText={setCustomRxInput}
            placeholder="Other prescription (e.g. Clindamycin)..."
            placeholderTextColor={colors.inkMuted}
            onSubmitEditing={handleAddCustomRx}
            returnKeyType="done"
          />
          {customRxInput.trim().length > 0 && (
            <TouchableOpacity
              onPress={handleAddCustomRx}
              style={styles.inlineAddBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.inlineAddBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 3. PREGNANCY & NURSING */}
        <Text style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          Are you currently pregnant or nursing?
        </Text>
        <Text style={styles.sectionHint}>
          Some skincare ingredients may need to be changed.
        </Text>
        <View style={styles.tripletRow}>
          {[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'prefer_not_to_say', label: 'Prefer not to say' },
          ].map((item) => {
            const isSelected = pregnancyChoice === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPregnancyChoice(item.value as any);
                }}
                style={[styles.tripletBtn, isSelected && styles.tripletBtnSelected]}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.tripletText, isSelected && styles.tripletTextSelected]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 4. OPTIONAL SAFETY NOTES */}
        <Text style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          Anything else we should know? (Optional)
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. History of eczema, seasonal allergies, sensitive eyes..."
          placeholderTextColor={colors.inkMuted}
          style={styles.notesInput}
          multiline={true}
        />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          label="Continue to Skin Photos"
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
    paddingBottom: spacing.xxl + 40,
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
  sectionHeader: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  subSectionHeader: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.xxs,
  },
  sectionHint: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginBottom: spacing.sm,
  },
  nonePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  nonePillActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  nonePillText: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
    fontWeight: typography.weights.medium,
  },
  nonePillTextActive: {
    color: colors.brand,
    fontWeight: typography.weights.bold,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
  },
  inlineAddBtn: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineAddBtnText: {
    color: colors.inkInverse,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  chipText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
  },
  chipTextSelected: {
    color: colors.brand,
    fontWeight: typography.weights.bold,
  },
  activeAllergyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
    borderWidth: 1,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.full,
    gap: 6,
  },
  activeAllergyText: {
    fontSize: typography.sizes.caption,
    color: colors.brand,
    fontWeight: typography.weights.semibold,
  },
  chipRemove: {
    padding: 2,
  },
  chipRemoveText: {
    fontSize: 16,
    color: colors.brand,
    lineHeight: 16,
    fontWeight: typography.weights.bold,
  },
  detectedDifferinCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.brand,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    ...shadows.subtle,
  },
  detectedDifferinTitle: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: 2,
  },
  detectedDifferinPrompt: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    marginBottom: spacing.md,
  },
  binaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  binaryBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  binaryBtnSelected: {
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
  tripletRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tripletBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tripletBtnSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandLight,
  },
  tripletText: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  tripletTextSelected: {
    color: colors.brand,
    fontWeight: typography.weights.bold,
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.canvas,
  },
});
