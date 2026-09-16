import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { SelectionRow } from '@/src/components/ui/SelectionRow';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { TextField } from '@/src/components/ui/TextField';
import { VoiceTextArea } from '@/src/components/ui/VoiceTextArea';
import { StickyActionFooter } from '@/src/components/ui/StickyActionFooter';

const PRESCRIPTION_OPTIONS = [
  { id: 'tretinoin', label: 'Tretinoin / Retin-A' },
  { id: 'spironolactone', label: 'Oral Spironolactone' },
  { id: 'accutane', label: 'Isotretinoin (Accutane)' },
  { id: 'hydroquinone', label: 'Hydroquinone' },
];

export default function SafetyScreen() {
  const router = useRouter();
  const {
    activePrescriptions,
    knownSensitivities,
    sensitivitiesStatus,
    isPregnantOrNursing,
    pregnancyStatus,
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

  // Sensitivities state
  const [selectedSensitivities, setSelectedSensitivities] = useState<string[]>(
    knownSensitivities.filter((s) => s !== 'No known allergies')
  );
  const [hasNoSensitivities, setHasNoSensitivities] = useState<boolean>(
    sensitivitiesStatus === 'none_known' || (knownSensitivities.length === 0 && sensitivitiesStatus !== 'reported')
  );
  const [customSensInput, setCustomSensInput] = useState('');

  // Prescriptions state
  const [selectedPrescriptions, setSelectedPrescriptions] = useState<string[]>(
    activePrescriptions.filter((rx) => !rx.toLowerCase().includes('differin') && rx !== 'None of these')
  );

  // Pregnancy / Nursing tri-state
  const [pregnancyState, setPregnancyState] = useState<'yes' | 'no' | 'prefer_not_to_say' | 'unanswered'>(
    pregnancyStatus !== 'unanswered' ? pregnancyStatus : isPregnantOrNursing ? 'yes' : 'no'
  );

  const [notes, setNotes] = useState<string>(additionalSafetyNotes);

  const handleAddCustomSensitivity = () => {
    const trimmed = customSensInput.trim();
    if (!trimmed) return;
    Haptics.selectionAsync();
    if (!selectedSensitivities.includes(trimmed)) {
      setSelectedSensitivities([...selectedSensitivities, trimmed]);
      setHasNoSensitivities(false);
    }
    setCustomSensInput('');
  };

  const handleToggleNoSensitivities = () => {
    setHasNoSensitivities(true);
    setSelectedSensitivities([]);
  };

  const togglePrescription = (label: string) => {
    if (selectedPrescriptions.includes(label)) {
      setSelectedPrescriptions(selectedPrescriptions.filter((p) => p !== label));
    } else {
      setSelectedPrescriptions([...selectedPrescriptions, label]);
    }
  };

  const handleContinue = () => {
    const finalPrescriptions: string[] = [];
    if (hasDifferinOnShelf && isUsingDifferin) {
      finalPrescriptions.push('Differin / Adapalene');
    }
    finalPrescriptions.push(...selectedPrescriptions);
    if (finalPrescriptions.length === 0) {
      finalPrescriptions.push('None of these');
    }

    const sensStatus = hasNoSensitivities
      ? 'none_known'
      : selectedSensitivities.length > 0
      ? 'reported'
      : 'unanswered';

    setSafetyContext({
      sensitivities: hasNoSensitivities ? [] : selectedSensitivities,
      sensitivitiesStatus: sensStatus,
      prescriptions: finalPrescriptions,
      pregnancy: pregnancyState === 'yes',
      pregnancyStatus: pregnancyState,
      notes: notes.trim() || undefined,
    });

    router.push('/(onboarding)/7-skin-photos');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.questionTitle}>A few safety questions</Text>
        <Text style={styles.questionSubtitle}>
          We check active treatments, ingredient intolerances, and contraindications before assembling your plan.
        </Text>

        {/* SECTION 1: SHELF-DETECTED PRESCRIPTION (DIFFERIN) */}
        {hasDifferinOnShelf && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeader}>We found Differin on your shelf</Text>
            <GroupedSection
              footer="We identified Differin on your counter. We will incorporate it with barrier buffers."
            >
              <SelectionRow
                title="Yes, I am actively using Differin"
                subtitle="Incorporate into evening treatment schedule"
                selected={isUsingDifferin === true}
                onPress={() => setIsUsingDifferin(true)}
                type="radio"
              />
              <SelectionRow
                title="No, paused or not using it"
                subtitle="Do not schedule Differin in current routine"
                selected={isUsingDifferin === false}
                onPress={() => setIsUsingDifferin(false)}
                type="radio"
              />
            </GroupedSection>
          </View>
        )}

        {/* SECTION 2: OTHER ACTIVE PRESCRIPTIONS */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>Other Active Prescriptions</Text>
          <GroupedSection footer="Select any active medications or prescription treatments you are currently using.">
            {PRESCRIPTION_OPTIONS.map((rx) => {
              const isSelected = selectedPrescriptions.includes(rx.label);
              return (
                <SelectionRow
                  key={rx.id}
                  title={rx.label}
                  selected={isSelected}
                  onPress={() => togglePrescription(rx.label)}
                  type="checkbox"
                />
              );
            })}
          </GroupedSection>
        </View>

        {/* SECTION 3: INGREDIENT ALLERGIES / SENSITIVITIES */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>Known Allergies & Sensitivities</Text>
          <GroupedSection>
            <SelectionRow
              title="No known ingredient allergies"
              subtitle="No medical or severe contact allergies to skincare ingredients"
              selected={hasNoSensitivities}
              onPress={handleToggleNoSensitivities}
              type="radio"
            />
          </GroupedSection>

          <TextField
            placeholder="Add specific ingredient allergy or intolerance..."
            value={customSensInput}
            onChangeText={setCustomSensInput}
            rightElement={
              customSensInput.trim().length > 0 ? (
                <ChoiceChip
                  label="Add"
                  selected={true}
                  size="small"
                  onSelect={handleAddCustomSensitivity}
                />
              ) : null
            }
          />
        </View>

        {/* SECTION 4: PREGNANCY & NURSING (TRI-STATE) */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>Pregnancy or Nursing</Text>
          <GroupedSection
            footer="Certain ingredients like high-strength retinoids and salicylic acid require pregnancy-safe alternatives."
          >
            <SelectionRow
              title="Yes, currently pregnant or nursing"
              subtitle="Exclude high-potency retinoids, hydroquinone, and high-dose acids"
              selected={pregnancyState === 'yes'}
              onPress={() => setPregnancyState('yes')}
              type="radio"
            />
            <SelectionRow
              title="No"
              selected={pregnancyState === 'no'}
              onPress={() => setPregnancyState('no')}
              type="radio"
            />
            <SelectionRow
              title="Prefer not to say"
              selected={pregnancyState === 'prefer_not_to_say'}
              onPress={() => setPregnancyState('prefer_not_to_say')}
              type="radio"
            />
          </GroupedSection>
        </View>

        {/* SECTION 5: OPTIONAL SAFETY NOTES */}
        <VoiceTextArea
          label="Any other medical or safety context? (Optional)"
          placeholder="e.g. History of eczema around mouth in winter, dermatologist advised gentle wash..."
          value={notes}
          onChangeText={setNotes}
          context="reaction_note"
          minHeight={70}
        />
      </ScrollView>

      <StickyActionFooter
        ctaLabel="Continue"
        onPressCta={handleContinue}
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
    paddingBottom: spacing.xxl + 100,
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
  sectionBlock: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  subHeading: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
});
