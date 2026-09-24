import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/src/components/ui/Button';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { colors, layout, spacing, typography } from '@/src/constants/theme';
import {
  GOALS, completePersonalization, createPersonalizationDraft, nextPersonalizationStep,
  toggleGoal, toggleTreatment,
  type PersonalizationDraft, type PersonalizationStep, type Reactivity,
  type SkinBehavior, type Treatment,
} from '@/src/presentation/personalization/draft';

const behaviorChoices: { value: SkinBehavior; label: string }[] = [
  { value: 'dry_tight', label: 'Dry or tight' }, { value: 'balanced', label: 'Balanced' },
  { value: 'combination', label: 'Combination' }, { value: 'oily', label: 'Oily' },
  { value: 'unsure', label: 'Not sure' },
];
const reactivityChoices: { value: Reactivity; label: string }[] = [
  { value: 'reacts_easily', label: 'Reacts easily' },
  { value: 'generally_tolerates', label: 'Generally tolerates products' },
  { value: 'unsure', label: 'Not sure' },
];
const treatmentChoices: { value: Treatment; label: string }[] = [
  { value: 'retinoids', label: 'Retinoids' }, { value: 'benzoyl_peroxide', label: 'Benzoyl peroxide' },
  { value: 'acids', label: 'Exfoliating acids' }, { value: 'other_prescription', label: 'Other prescription treatment' },
];

export interface PersonalizationFlowProps {
  /** Pass the existing profile to launch editing from My Stuff. */
  initialDraft?: PersonalizationDraft;
  onComplete: (answers: PersonalizationDraft) => void;
  onSkip: () => void;
  /** Host decides whether and how to offer this again; this component sets no reminder. */
  onRemindLater?: () => void;
}

/** Optional local collection UI. The host owns saving and refreshing the same result. */
export function PersonalizationFlow({ initialDraft, onComplete, onSkip, onRemindLater }: PersonalizationFlowProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(() => createPersonalizationDraft(initialDraft));
  const [step, setStep] = useState<PersonalizationStep>('goals');
  const stepNumber = step === 'goals' ? 1 : step === 'behavior' ? 2 : 3;

  const advance = () => {
    const next = nextPersonalizationStep(step);
    if (next === 'complete') onComplete(completePersonalization(draft));
    else setStep(next);
  };
  const back = () => {
    if (step === 'goals') onSkip();
    else setStep(step === 'context' ? 'behavior' : 'goals');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.topAction}>
          <Text style={styles.topActionText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.progress}>Step {stepNumber} of 3</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Skip personalization" onPress={onSkip} style={styles.topAction}>
          <Text style={styles.topActionText}>Skip</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${stepNumber * 100 / 3}%` }]} /></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 'goals' && <>
          <Text style={styles.eyebrow}>YOUR GOALS</Text>
          <Text style={styles.title}>What would you like to focus on?</Text>
          <Text style={styles.description}>Choose up to three. You can change these later.</Text>
          <View style={styles.chips}>
            {GOALS.map(([value, label]) => <ChoiceChip key={value} label={label}
              selected={draft.goals.includes(value)}
              disabled={!draft.goals.includes(value) && draft.goals.length >= 3}
              onSelect={() => setDraft((current) => toggleGoal(current, value))} />)}
          </View>
        </>}
        {step === 'behavior' && <>
          <Text style={styles.eyebrow}>YOUR SKIN</Text>
          <Text style={styles.title}>How does your skin usually behave?</Text>
          <Text style={styles.description}>Choose what feels closest. Not sure is fine.</Text>
          <Text style={styles.groupTitle}>Most days</Text>
          <View style={styles.chips}>
            {behaviorChoices.map(({ value, label }) => <ChoiceChip key={value} label={label}
              selected={draft.skinBehavior === value}
              onSelect={() => setDraft((current) => ({ ...current, skinBehavior: value }))} />)}
          </View>
          <Text style={styles.groupTitle}>With new products</Text>
          <View style={styles.chips}>
            {reactivityChoices.map(({ value, label }) => <ChoiceChip key={value} label={label}
              selected={draft.reactivity === value}
              onSelect={() => setDraft((current) => ({ ...current, reactivity: value }))} />)}
          </View>
        </>}
        {step === 'context' && <>
          <Text style={styles.eyebrow}>USEFUL CONTEXT</Text>
          <Text style={styles.title}>Anything we should keep in mind?</Text>
          <Text style={styles.description}>Only select what is relevant. You can leave any answer blank.</Text>
          <Text style={styles.groupTitle}>Treatments you use</Text>
          <View style={styles.chips}>
            {treatmentChoices.map(({ value, label }) => <ChoiceChip key={value} label={label}
              selected={draft.treatments.includes(value)}
              onSelect={() => setDraft((current) => toggleTreatment(current, value))} />)}
          </View>
          <Text style={styles.groupTitle}>Known sensitivity or allergy</Text>
          <View style={styles.chips}>
            {(['yes', 'no', 'unsure'] as const).map((value) => <ChoiceChip key={value}
              label={value === 'unsure' ? 'Not sure' : value === 'yes' ? 'Yes' : 'No'}
              selected={draft.sensitivityOrAllergy === value}
              onSelect={() => setDraft((current) => ({ ...current, sensitivityOrAllergy: value }))} />)}
          </View>
          <Text style={styles.groupTitle}>Pregnant or trying to conceive?</Text>
          <View style={styles.chips}>
            {(['yes', 'no', 'prefer_not_to_say'] as const).map((value) => <ChoiceChip key={value}
              label={value === 'prefer_not_to_say' ? 'Prefer not to say' : value === 'yes' ? 'Yes' : 'No'}
              selected={draft.pregnancy === value}
              onSelect={() => setDraft((current) => ({ ...current, pregnancy: value }))} />)}
          </View>
        </>}
      </ScrollView>
      <View style={styles.footer}>
        <Button variant="brand" label={step === 'context' ? 'Complete' : 'Continue'} onPress={advance} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Skip this step" onPress={advance} style={styles.skipStep}>
          <Text style={styles.skipText}>Skip this step</Text>
        </TouchableOpacity>
        {onRemindLater && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remind me later" onPress={onRemindLater} style={styles.skipStep}>
          <Text style={styles.skipText}>Remind me later</Text>
        </TouchableOpacity>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: layout.gutter, height: 56 },
  topAction: { minWidth: 52, minHeight: 44, justifyContent: 'center' },
  topActionText: { fontSize: typography.sizes.bodyRegular, color: colors.brand, fontWeight: typography.weights.semibold },
  progress: { color: colors.inkMuted, fontSize: typography.sizes.caption },
  progressTrack: { height: 3, backgroundColor: colors.borderSubtle },
  progressFill: { height: 3, backgroundColor: colors.brand },
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  eyebrow: { color: colors.brand, fontSize: typography.sizes.micro, fontWeight: typography.weights.bold, letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: typography.sizes.display, lineHeight: typography.lineHeights.display, fontWeight: typography.weights.semibold, marginTop: spacing.sm },
  description: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, marginTop: spacing.sm },
  groupTitle: { color: colors.ink, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.semibold, marginTop: spacing.xxl, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xl },
  footer: { paddingHorizontal: layout.gutter, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.hairline },
  skipStep: { minHeight: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  skipText: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular },
});
