import { editSensitivityInput } from '@/src/presentation/p0b-personalization/sensitivityInput';
import React, { useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { Screen } from '@/src/components/ui/Screen';
import { Button } from '@/src/components/ui/Button';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { QuestionGroup } from '@/src/components/ui/QuestionGroup';
import { colors, layout, spacing, typography } from '@/src/constants/theme';
import { createContextDraft, relevantQuestions, toggleSecondaryGoal, validateContextDraft, GOALS, type Treatment, type Answer, type ContextDraft, type SafetyRelevance } from '@/src/presentation/p0b-personalization/draft';

const goals = GOALS.map(([value, label]) => [value, value === 'dryness' ? 'Dryness' : label] as const);
export interface ContextFlowProps {
  initialDraft?: ContextDraft; relevance?: SafetyRelevance;
  /** Context questions are shown only when the caller establishes relevance. */
  contextQuestions?: readonly ('treatments' | 'sensitivities')[];
  onApply: (draft: ContextDraft) => void; onSkip: () => void;
  loading?: boolean; error?: string | null;
}
function AnswerChoices<T extends string>({ label, support, answer, choices, onChange, disabled, allowWithheld = true }: {
  label: string; support?: string; answer: Answer<T>; choices: readonly (readonly [T, string])[];
  onChange: (answer: Answer<T>) => void; disabled: boolean; allowWithheld?: boolean;
}) {
  return <QuestionGroup label={label} support={support}><View style={styles.chips}>
    {choices.map(([value, text]) => <ChoiceChip key={value} label={text} selectionType="single" selected={answer.state === 'answered' && answer.value === value} onSelect={() => onChange({ state: 'answered', value })} disabled={disabled} />)}
    <ChoiceChip label="Leave unanswered" selectionType="single" selected={answer.state === 'unanswered'} onSelect={() => onChange({ state: 'unanswered' })} disabled={disabled} />
    {allowWithheld && <ChoiceChip label="Prefer not to say" selectionType="single" selected={answer.state === 'withheld'} onSelect={() => onChange({ state: 'withheld' })} disabled={disabled} />}
  </View></QuestionGroup>;
}
/** Local optional collection. The host acknowledges saving and refreshes the originating Check. */
export function ContextFlow({ initialDraft, relevance, contextQuestions = [], onApply, onSkip, loading = false, error }: ContextFlowProps) {
  const [draft, setDraft] = useState(() => createContextDraft(initialDraft));
  const [sensitivityText, setSensitivityText] = useState(() => initialDraft?.sensitivities.state === 'answered' ? initialDraft.sensitivities.value.join('\n') : '');
  const [step, setStep] = useState(0);
  const [otherGoalsVisible, setOtherGoalsVisible] = useState(() => Boolean(initialDraft?.secondaryGoals.length));
  const [validation, setValidation] = useState<string | null>(null);
  const fields = relevantQuestions(relevance);
  const hasContext = contextQuestions.length > 0 || fields.length > 0;
  const last = hasContext ? 2 : 1;
  const editing = Boolean(initialDraft);
  const update = <K extends keyof ContextDraft>(key: K, value: ContextDraft[K]) => { setValidation(null); setDraft(current => ({ ...current, [key]: value })); };
  return <Screen scrollable><View style={styles.flow}>
    <View style={styles.intro}>
      <Text style={styles.title}>Your skin profile</Text>
      <Text style={styles.copy}>Optional. You can skip and still see product facts.</Text>
      {!editing && <Text style={styles.copy}>Step {step + 1} of {last + 1}</Text>}
    </View>
    {(editing || step === 0) && <View style={styles.questions}>
      <AnswerChoices label="What would you most like to improve?" support="Choose one optional main priority." answer={draft.primaryGoal} allowWithheld={false} disabled={loading} choices={goals} onChange={value => { setValidation(null); setDraft(current => ({ ...current, primaryGoal: value, secondaryGoals: value.state === 'answered' ? current.secondaryGoals.filter(goal => goal !== value.value) : current.secondaryGoals })); }} />
      <View style={styles.disclosure}>
        <Button label={otherGoalsVisible ? 'Hide additional goals' : draft.secondaryGoals.length ? 'Review other goals' : 'Add other goals'} variant="ghost" disabled={loading} onPress={() => setOtherGoalsVisible(!otherGoalsVisible)} />
        {otherGoalsVisible && <QuestionGroup label="Other goals" support="Optional. Choose up to two."><View style={styles.chips}>{goals.map(([value, label]) => <ChoiceChip key={value} label={label} selectionType="multiple" selected={draft.secondaryGoals.includes(value)} disabled={loading || (draft.primaryGoal.state === 'answered' && draft.primaryGoal.value === value) || (!draft.secondaryGoals.includes(value) && draft.secondaryGoals.length >= 2)} onSelect={() => { setValidation(null); setDraft(current => toggleSecondaryGoal(current, value)); }} />)}</View></QuestionGroup>}
      </View>
      <AnswerChoices label="What are you deciding?" support="This choice is saved with your profile and reused for future Checks. You can change it." answer={draft.intent} disabled={loading} choices={[['add', 'Add to my routine'], ['replace', 'Replace something'], ['check_current', 'Check what I use']]} onChange={value => update('intent', value)} />
    </View>}
    {(editing || step === 1) && <View style={styles.questions}>
      <AnswerChoices label="How does your skin usually feel?" answer={draft.behavior} disabled={loading} choices={[['dry_tight', 'Dry or tight'], ['balanced', 'Neither dry nor oily'], ['combination', 'Oily in some areas, dry in others'], ['oily', 'Oily'], ['unsure', 'Not sure']]} onChange={value => update('behavior', value)} />
      <AnswerChoices label="Do skincare products tend to irritate your skin?" answer={draft.reactivity} disabled={loading} choices={[['reacts_easily', 'My skin gets irritated easily'], ['generally_tolerates', 'I generally tolerate products'], ['unsure', 'Not sure']]} onChange={value => update('reactivity', value)} />
    </View>}
    {hasContext && (editing || step === 2) && <View style={styles.questions}>
      {contextQuestions.includes('treatments') && <QuestionGroup label="Treatments you use" support="Choose treatments you know you use."><View style={styles.chips}>
        {([['topical_retinoid', 'Topical retinoid'], ['benzoyl_peroxide', 'Benzoyl peroxide'], ['exfoliating_acid', 'Exfoliating acid'], ['other_prescription', 'Other prescription treatment']] as const).map(([value, label]) => <ChoiceChip key={value} label={label} selectionType="multiple" disabled={loading} selected={draft.treatments.state === 'answered' && draft.treatments.value.includes(value)} onSelect={() => { const selected: Treatment[] = draft.treatments.state === 'answered' ? draft.treatments.value : []; const next = selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]; update('treatments', next.length ? { state: 'answered', value: next } : { state: 'unanswered' }); }} />)}
        {([['None', 'answered'], ['Not sure', 'unsure'], ['Leave unanswered', 'unanswered'], ['Prefer not to say', 'withheld']] as const).map(([label, state]) => <ChoiceChip key={state} label={label} selectionType="single" disabled={loading} selected={draft.treatments.state === state && (state !== 'answered' || (draft.treatments.state === 'answered' && draft.treatments.value.length === 0))} onSelect={() => update('treatments', state === 'answered' ? { state, value: [] } : { state })} />)}
      </View></QuestionGroup>}
      {contextQuestions.filter((field): field is 'sensitivities' => field === 'sensitivities').map(field => <QuestionGroup key={field} label="Known sensitivities" support="Use ingredient names you already know. You can record a product experience without knowing the cause."><View style={styles.disclosure}>
        <TextInput style={styles.input} accessibilityLabel="Sensitivity names, one per line" editable={!loading} multiline placeholder="One ingredient name per line" value={sensitivityText} onChangeText={text => { const editing = editSensitivityInput(text); setSensitivityText(editing.text); update(field, editing.answer); }} />
        <View style={styles.chips}>{([['None known', 'answered'], ['Not sure', 'unsure'], ['Leave unanswered', 'unanswered'], ['Prefer not to say', 'withheld']] as const).map(([label, state]) => <ChoiceChip key={state} label={label} selectionType="single" disabled={loading} selected={draft[field].state === state && (state !== 'answered' || (draft[field].state === 'answered' && draft[field].value.length === 0))} onSelect={() => { setSensitivityText(''); update(field, state === 'answered' ? { state, value: [] } : { state }); }} />)}</View>
      </View></QuestionGroup>)}
      {fields.length > 0 && <Text style={styles.copy}>{relevance?.evidenceReason}</Text>}
      {fields.map(field => <AnswerChoices key={field} label={field === 'pregnancy' ? 'Are you pregnant?' : field === 'trying' ? 'Are you trying to conceive?' : 'Are you breastfeeding or nursing?'} answer={draft[field]} disabled={loading} choices={[['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']]} onChange={value => update(field, value)} />)}
    </View>}
    {(error || validation) && <Text accessibilityRole="alert" style={styles.error}>{error || validation}</Text>}
    <View style={styles.actions}>
      <Button label={editing || step === last ? 'Save skin profile' : 'Continue'} loading={loading} onPress={() => { const message = validateContextDraft(draft); setValidation(message); if (message) return; if (editing || step === last) onApply(createContextDraft(draft)); else setStep(step + 1); }} />
      {!editing && step > 0 && <Button label="Back" variant="ghost" disabled={loading} onPress={() => setStep(step - 1)} />}
      <Button label={editing ? 'Cancel profile edit' : 'Skip personalization'} variant="ghost" disabled={loading} onPress={onSkip} />
    </View>
  </View></Screen>;
}
export const styles = StyleSheet.create({
  flow: { gap: layout.sectionGap }, intro: { gap: layout.titleGap }, questions: { gap: layout.sectionGap }, disclosure: { gap: spacing.sm }, actions: { gap: spacing.xs },
  title: { fontSize: typography.sizes.screenTitle, lineHeight: typography.lineHeights.screenTitle, fontWeight: typography.weights.semibold, color: colors.ink },
  copy: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  error: { color: colors.actionStop.text, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  group: { padding: layout.cardPadding, gap: spacing.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  input: { minHeight: layout.minTouchTarget, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: spacing.sm, fontSize: typography.sizes.bodyRegular, color: colors.ink, backgroundColor: colors.surface },
});
