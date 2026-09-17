import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii } from '@/src/constants/theme';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import {
  BodyArea,
  ReactionSeverity,
  ReactionSymptom,
} from '@/src/types/schema';
import { SelectionCard } from '@/src/components/ui/SelectionCard';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { TextField } from '@/src/components/ui/TextField';
import { VoiceTextArea } from '@/src/components/ui/VoiceTextArea';
import { StickyActionFooter } from '@/src/components/ui/StickyActionFooter';

const BODY_AREAS: Array<{ value: BodyArea; label: string }> = [
  { value: 'face', label: 'Face' },
  { value: 'cheeks', label: 'Cheeks' },
  { value: 'around_eyes', label: 'Around eyes' },
  { value: 'forehead', label: 'Forehead' },
  { value: 'jawline', label: 'Jawline / Chin' },
  { value: 'neck', label: 'Neck' },
  { value: 'underarms', label: 'Underarms' },
  { value: 'scalp', label: 'Scalp' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'other', label: 'Other area' },
];

const SYMPTOMS_LIST: Array<{ value: ReactionSymptom; label: string }> = [
  { value: 'burning_stinging', label: 'Burning / stinging' },
  { value: 'redness_rash', label: 'Redness / rash' },
  { value: 'itching', label: 'Itching' },
  { value: 'breakouts', label: 'Blemish flare' },
  { value: 'dryness_peeling', label: 'Dryness / peeling' },
  { value: 'swelling', label: 'Swelling' },
  { value: 'other', label: 'Other symptom' },
];

const SEVERITY_LEVELS: Array<{ value: ReactionSeverity; label: string; desc: string }> = [
  { value: 'mild', label: 'Mild', desc: 'Temporary tingling or minor dryness that resolved quickly' },
  { value: 'moderate', label: 'Moderate', desc: 'Noticeable discomfort, flaking, or rash lasting multiple days' },
  { value: 'severe', label: 'Severe', desc: 'Intense reaction, severe burning, swelling, or required medical care' },
];

export default function ReactionHistoryScreen() {
  const router = useRouter();
  const { addProductReaction, setHasBadReactions, hasBadReactions } = useOnboardingStore();

  const [hasReaction, setHasReaction] = useState<boolean | null>(
    hasBadReactions ?? true
  );
  const [productName, setProductName] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<ReactionSymptom[]>(['burning_stinging']);
  const [selectedArea, setSelectedArea] = useState<BodyArea>('face');
  const [severity, setSeverity] = useState<ReactionSeverity>('moderate');
  const [notes, setNotes] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const toggleSymptom = (symptom: ReactionSymptom) => {
    if (selectedSymptoms.includes(symptom)) {
      if (selectedSymptoms.length === 1) return;
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== symptom));
    } else {
      setSelectedSymptoms([...selectedSymptoms, symptom]);
    }
  };

  const handleSave = () => {
    if (hasReaction === false) {
      setHasBadReactions(false);
      router.back();
      return;
    }

    setHasBadReactions(true);
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
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.questionTitle}>Past Product Reactions</Text>
        <Text style={styles.questionSubtitle}>
          Derive looks up formulations in the background to separate true sensitivities from normal active acclimation.
        </Text>

        {/* PROGRESSIVE GATE: Has a product ever caused an adverse reaction? */}
        <Text style={styles.sectionHeader}>
          Has any skincare, hair, deodorant, or body product irritated your skin or caused a bad reaction?
        </Text>
        <View style={styles.optionsList}>
          <SelectionCard
            title="Yes, I have had a reaction"
            description="I want Derive to check ingredients and avoid similar formulations"
            selected={hasReaction === true}
            onPress={() => {
              setHasReaction(true);
              setHasBadReactions(true);
            }}
          />
          <SelectionCard
            title="No, not that I recall"
            description="I tolerate most standard products without notable irritation"
            selected={hasReaction === false}
            onPress={() => {
              setHasReaction(false);
              setHasBadReactions(false);
            }}
          />
        </View>

        {/* PROGRESSIVELY DISCLOSED DETAILS (Only if user taps Yes) */}
        {hasReaction === true && (
          <View style={styles.detailsContainer}>
            {/* 1. PRODUCT NAME */}
            <TextField
              label="Which product caused the reaction?"
              placeholder="e.g. Old Spice gel deodorant, glycolic acid toner..."
              value={productName}
              onChangeText={setProductName}
              helper="We will cross-reference its formulation against your active routine."
            />

            {/* 2. SYMPTOMS */}
            <Text style={styles.subSectionHeader}>What happened?</Text>
            <View style={styles.chipsWrap}>
              {SYMPTOMS_LIST.map((item) => {
                const isSelected = selectedSymptoms.includes(item.value);
                return (
                  <ChoiceChip
                    key={item.value}
                    label={item.label}
                    selected={isSelected}
                    onSelect={() => toggleSymptom(item.value)}
                  />
                );
              })}
            </View>

            {/* 3. BODY AREA */}
            <Text style={[styles.subSectionHeader, { marginTop: spacing.md }]}>
              Where did the reaction occur?
            </Text>
            <View style={styles.chipsWrap}>
              {BODY_AREAS.map((item) => {
                const isSelected = selectedArea === item.value;
                return (
                  <ChoiceChip
                    key={item.value}
                    label={item.label}
                    selected={isSelected}
                    onSelect={() => setSelectedArea(item.value)}
                  />
                );
              })}
            </View>

            {/* 4. SEVERITY */}
            <Text style={[styles.subSectionHeader, { marginTop: spacing.md }]}>
              How severe was the reaction?
            </Text>
            <View style={styles.severityCards}>
              {SEVERITY_LEVELS.map((item) => {
                const isSelected = severity === item.value;
                return (
                  <SelectionCard
                    key={item.value}
                    title={item.label}
                    description={item.desc}
                    selected={isSelected}
                    onPress={() => setSeverity(item.value)}
                  />
                );
              })}
            </View>

            {/* 5. NOTES WITH VOICE */}
            <VoiceTextArea
              label="Anything else we should know? (Optional)"
              placeholder="e.g. Happened after 2 days of daily use, resolved after applying vaseline..."
              value={notes}
              onChangeText={setNotes}
              context="reaction_note"
              minHeight={70}
              onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
            />
          </View>
        )}
      </ScrollView>

      <StickyActionFooter
        ctaLabel={hasReaction === false ? 'No Reactions — Continue' : 'Save Reaction'}
        onPressCta={handleSave}
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
  sectionHeader: {
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  optionsList: {
    gap: spacing.sm,
  },
  detailsContainer: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  subSectionHeader: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  severityCards: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
});
