import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/src/components/ui/Button';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { QuestionGroup } from '@/src/components/ui/QuestionGroup';
import { colors, layout, spacing, typography } from '@/src/constants/theme';
import {
  GOALS, completePersonalization, createPersonalizationDraft, nextPersonalizationStep,
  toggleGoal, toggleTreatment,
  type PersonalizationDraft, type PersonalizationStep, type Reactivity,
  type SkinBehavior, type Treatment,
} from '@/src/presentation/personalization/draft';
import { validatePersonalizationDraft } from '@/src/presentation/personalization/mapping';

const behaviorChoices: { value: SkinBehavior; label: string }[] = [
  { value: 'dry_tight', label: 'Dry or tight' }, { value: 'balanced', label: 'Neither dry nor oily' },
  { value: 'combination', label: 'Oily in some areas, dry in others' }, { value: 'oily', label: 'Oily' },
  { value: 'unsure', label: 'Not sure' },
];
const reactivityChoices: { value: Reactivity; label: string }[] = [
  { value: 'reacts_easily', label: 'My skin gets irritated easily' },
  { value: 'generally_tolerates', label: 'I generally tolerate products' },
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
  /** Hosts that cannot acknowledge profile persistence must set false. */
  available?: boolean;
  loading?: boolean;
  error?: string | null;
  /** Host decides whether and how to offer this again; this component sets no reminder. */
  onRemindLater?: () => void;
}

/** Legacy profile vocabulary remains isolated; the host owns saving and result refresh. */
export function PersonalizationFlow({ initialDraft, onComplete, onSkip, onRemindLater, available = true, loading = false, error: saveError }: PersonalizationFlowProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(() => createPersonalizationDraft(initialDraft));
  const [step, setStep] = useState<PersonalizationStep>('goals');
  const [sensitivityText, setSensitivityText] = useState(() => initialDraft?.knownSensitivities.join('\n') ?? '');
  const [error, setError] = useState<string | null>(null);
  const stepNumber = step === 'goals' ? 1 : step === 'behavior' ? 2 : 3;
  const advance = () => {
    if (loading || !available) return;
    const next = nextPersonalizationStep(step);
    if (next === 'complete') {
      const answers = completePersonalization({ ...draft, knownSensitivities: sensitivityText.split(/\r?\n/).map(name => name.trim()).filter(Boolean) });
      const message = validatePersonalizationDraft(answers);
      if (message) { setError(message); return; }
      onComplete(answers);
    } else setStep(next);
  };
  const back = () => { if (step === 'goals') onSkip(); else setStep(step === 'context' ? 'behavior' : 'goals'); };
  if (!available) return <View style={[styles.screen, styles.unavailable, { paddingTop: insets.top + layout.gutter, paddingBottom: insets.bottom + layout.gutter }]}>
    <Text style={styles.title}>Skin profile unavailable</Text>
    <Text style={styles.description}>Saving a skin profile is not available in this preview. You can return to Check and view product facts.</Text>
    <Button label="Back to Check" variant="outline" onPress={onSkip} />
  </View>;
  return <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <View style={styles.topBar}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" disabled={loading} onPress={back} style={styles.topAction}><Text style={styles.topActionText}>Back</Text></TouchableOpacity>
      <Text style={styles.progress}>Step {stepNumber} of 3</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
      {step === 'goals' && <>
        <Text style={styles.title}>What would you like to improve?</Text>
        <QuestionGroup label="Your goals" support="Optional. Choose up to three. You can change these later."><View style={styles.chips}>
          {GOALS.map(([value, label]) => <ChoiceChip key={value} label={value === 'dryness_barrier' ? 'Dryness' : label} selectionType="multiple" selected={draft.goals.includes(value)} disabled={loading || (!draft.goals.includes(value) && draft.goals.length >= 3)} onSelect={() => setDraft(current => toggleGoal(current, value))} />)}
        </View></QuestionGroup>
      </>}
      {step === 'behavior' && <>
        <Text style={styles.title}>Your skin</Text>
        <QuestionGroup label="How does your skin usually feel?" support="Choose what feels closest. Not sure is fine."><View style={styles.chips}>
          {behaviorChoices.map(({ value, label }) => <ChoiceChip key={value} label={label} selectionType="single" selected={draft.skinBehavior === value} disabled={loading} onSelect={() => setDraft(current => ({ ...current, skinBehavior: value }))} />)}
        </View></QuestionGroup>
        <QuestionGroup label="Do skincare products tend to irritate your skin?"><View style={styles.chips}>
          {reactivityChoices.map(({ value, label }) => <ChoiceChip key={value} label={label} selectionType="single" selected={draft.reactivity === value} disabled={loading} onSelect={() => setDraft(current => ({ ...current, reactivity: value }))} />)}
        </View></QuestionGroup>
      </>}
      {step === 'context' && <>
        <Text style={styles.title}>Anything to keep in mind?</Text>
        <Text style={styles.description}>Optional. You can leave any answer blank.</Text>
        <QuestionGroup label="Treatments you use"><View style={styles.chips}>
          {treatmentChoices.map(({ value, label }) => <ChoiceChip key={value} label={label} selectionType="multiple" selected={draft.treatments.includes(value)} disabled={loading} onSelect={() => setDraft(current => toggleTreatment(current, value))} />)}
          <ChoiceChip label="None" selectionType="single" selected={draft.treatmentStatus === 'none'} disabled={loading} onSelect={() => setDraft(current => ({ ...current, treatments: [], treatmentStatus: 'none' }))} />
          <ChoiceChip label="Leave unanswered" selectionType="single" selected={draft.treatmentStatus === 'unanswered'} disabled={loading} onSelect={() => setDraft(current => ({ ...current, treatments: [], treatmentStatus: 'unanswered' }))} />
        </View></QuestionGroup>
        <QuestionGroup label="Known ingredient reactions"><View style={styles.chips}>
          {(['yes', 'no'] as const).map(value => <ChoiceChip key={value} label={value === 'yes' ? 'Yes' : 'None known'} selectionType="single" selected={draft.sensitivityOrAllergy === value} disabled={loading} onSelect={() => setDraft(current => ({ ...current, sensitivityOrAllergy: value }))} />)}
          <ChoiceChip label="Leave unanswered" selectionType="single" selected={draft.sensitivityOrAllergy === null || draft.sensitivityOrAllergy === 'unsure'} disabled={loading} onSelect={() => setDraft(current => ({ ...current, sensitivityOrAllergy: null }))} />
        </View></QuestionGroup>
        {draft.sensitivityOrAllergy === 'yes' && <QuestionGroup label="Which ingredients?" support="Enter only names you already know, one per line.">
          <TextInput value={sensitivityText} onChangeText={value => { setSensitivityText(value); setError(null); }} multiline editable={!loading} accessibilityLabel="Known ingredient sensitivities" placeholder="Ingredient name" style={styles.ingredientInput} />
        </QuestionGroup>}
        <QuestionGroup label="Pregnant or nursing?"><View style={styles.chips}>
          {(['yes', 'no', 'prefer_not_to_say'] as const).map(value => <ChoiceChip key={value} label={value === 'prefer_not_to_say' ? 'Prefer not to say' : value === 'yes' ? 'Yes' : 'No'} selectionType="single" selected={draft.pregnancy === value} disabled={loading} onSelect={() => setDraft(current => ({ ...current, pregnancy: value }))} />)}
          <ChoiceChip label="Leave unanswered" selectionType="single" selected={draft.pregnancy === null} disabled={loading} onSelect={() => setDraft(current => ({ ...current, pregnancy: null }))} />
        </View></QuestionGroup>
      </>}
      {(saveError || error) && <Text accessibilityRole="alert" style={styles.error}>{saveError || error}</Text>}
    </ScrollView>
    <View style={styles.footer}>
      <Button variant="brand" label={step === 'context' ? 'Save skin profile' : 'Continue'} loading={loading} onPress={advance} />
      <Button label="Skip personalization" variant="ghost" disabled={loading} onPress={onSkip} />
      {onRemindLater && <Button label="Remind me later" variant="ghost" disabled={loading} onPress={onRemindLater} />}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas }, unavailable: { paddingHorizontal: layout.gutter, gap: layout.sectionGap, justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: layout.gutter, minHeight: 56 },
  topAction: { minWidth: 52, minHeight: layout.minTouchTarget, justifyContent: 'center' },
  topActionText: { fontSize: typography.sizes.bodyRegular, color: colors.brand, fontWeight: typography.weights.semibold },
  progress: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  content: { paddingHorizontal: layout.gutter, paddingVertical: spacing.xl, gap: layout.sectionGap },
  title: { color: colors.ink, fontSize: typography.sizes.screenTitle, lineHeight: typography.lineHeights.screenTitle, fontWeight: typography.weights.semibold },
  description: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  ingredientInput: { minHeight: 64, padding: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, fontSize: typography.sizes.bodyRegular, color: colors.ink, backgroundColor: colors.surface, textAlignVertical: 'top' },
  error: { color: colors.actionStop.text, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  footer: { paddingHorizontal: layout.gutter, paddingTop: spacing.sm, gap: spacing.xs },
});
