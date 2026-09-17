import React, { useRef, useState } from 'react';
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
import { SelectionCard } from '@/src/components/ui/SelectionCard';
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
  const scrollRef = useRef<ScrollView>(null);

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
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.questionTitle}>A few safety questions</Text>
        <Text style={styles.questionSubtitle}>
          We check active treatments, ingredient intolerances, and contraindications before assembling your plan.
        </Text>

        {/* SECTION 1: SHELF-DETECTED PRESCRIPTION (DIFFERIN) */}
        {hasDifferinOnShelf && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeader}>We found Differin on your shelf</Text>
            <View style={styles.optionsList}>
              <SelectionCard
                title="Yes, I am actively using Differin"
                description="Incorporate into evening treatment schedule"
                selected={isUsingDifferin === true}
                onPress={() => setIsUsingDifferin(true)}
              />
              <SelectionCard
                title="No, paused or not using it"
                description="Do not schedule Differin in current routine"
                selected={isUsingDifferin === false}
                onPress={() => setIsUsingDifferin(false)}
              />
            </View>
            <Text style={styles.helperText}>
              We identified Differin on your counter. We will incorporate it with barrier buffers.
            </Text>
          </View>
        )}

        {/* SECTION 2: OTHER ACTIVE PRESCRIPTIONS */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>Other Active Prescriptions</Text>
          <View style={styles.optionsList}>
            {PRESCRIPTION_OPTIONS.map((rx) => {
              const isSelected = selectedPrescriptions.includes(rx.label);
              return (
                <SelectionCard
                  key={rx.id}
                  title={rx.label}
                  selected={isSelected}
                  onPress={() => togglePrescription(rx.label)}
                  selectionType="checkbox"
                />
              );
            })}
          </View>
          <Text style={styles.helperText}>
            Select any active medications or prescription treatments you are currently using.
          </Text>
        </View>

        {/* SECTION 3: INGREDIENT ALLERGIES / SENSITIVITIES */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>Known Allergies & Sensitivities</Text>
          <View style={styles.optionsList}>
            <SelectionCard
              title="No known ingredient allergies"
              description="No known severe contact allergies to skincare ingredients"
              selected={hasNoSensitivities}
              onPress={handleToggleNoSensitivities}
            />
          </View>

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
          <View style={styles.optionsList}>
            <SelectionCard
              title="Yes, currently pregnant or nursing"
              description="Exclude high-potency retinoids, hydroquinone, and high-dose acids"
              selected={pregnancyState === 'yes'}
              onPress={() => setPregnancyState('yes')}
            />
            <SelectionCard
              title="No"
              selected={pregnancyState === 'no'}
              onPress={() => setPregnancyState('no')}
            />
            <SelectionCard
              title="Prefer not to say"
              selected={pregnancyState === 'prefer_not_to_say'}
              onPress={() => setPregnancyState('prefer_not_to_say')}
            />
          </View>
          <Text style={styles.helperText}>
            Certain ingredients like high-strength retinoids and salicylic acid require pregnancy-safe alternatives.
          </Text>
        </View>

        {/* SECTION 5: OPTIONAL SAFETY NOTES */}
        <VoiceTextArea
          label="Any other skin sensitivity or safety context? (Optional)"
          placeholder="e.g. Tendency toward redness around nose in winter, prefer fragrance-free..."
          value={notes}
          onChangeText={setNotes}
          context="reaction_note"
          minHeight={70}
          onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
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
  optionsList: {
    gap: spacing.sm,
  },
  helperText: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.inkSubtle,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
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
