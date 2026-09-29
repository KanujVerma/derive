import { editSensitivityInput } from '@/src/presentation/p0b-personalization/sensitivityInput';
import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Screen } from '@/src/components/ui/Screen';
import { Button } from '@/src/components/ui/Button';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { QuestionGroup } from '@/src/components/ui/QuestionGroup';
import { colors, layout, radii, spacing, typography } from '@/src/constants/theme';
import { createContextDraft, relevantQuestions, validateContextDraft, GOALS, type Treatment, type Answer, type ContextDraft, type SafetyRelevance } from '@/src/presentation/p0b-personalization/draft';

import { toggleProfileGoal } from '@/src/presentation/p0b-personalization/goalSelection';

const goals = GOALS.map(([value, label]) => [value, value === 'dryness' ? 'Dryness' : label] as const);
export interface ContextFlowProps {
  initialDraft?: ContextDraft; relevance?: SafetyRelevance;
  /** Context questions are shown only when the caller establishes relevance. */
  contextQuestions?: readonly ('treatments' | 'sensitivities')[];
  /** Decision intent belongs to a Check when the caller supplies it there. */
  collectIntent?: boolean;
  /** The host names the completion action, including temporary previews. */
  completionLabel?: string;
  onApply: (draft: ContextDraft) => void; onSkip: () => void;
  loading?: boolean; error?: string | null;
}
function AnswerChoices<T extends string>({ label, support, answer, choices, onChange, disabled, allowWithheld = true, basic = false }: {
  label: string; support?: string; answer: Answer<T>; choices: readonly (readonly [T, string])[];
  onChange: (answer: Answer<T>) => void; disabled: boolean; allowWithheld?: boolean; basic?: boolean;
}) {
  return <QuestionGroup label={label} support={support}><View style={styles.chips}>
    {choices.map(([value, text]) => <ChoiceChip key={value} label={text} selectionType="single" selected={answer.state === 'answered' && answer.value === value} onSelect={() => onChange(basic && answer.state === 'answered' && answer.value === value ? { state: 'unanswered' } : { state: 'answered', value })} disabled={disabled} />)}
    {!basic && <ChoiceChip label="Leave unanswered" selectionType="single" selected={answer.state === 'unanswered'} onSelect={() => onChange({ state: 'unanswered' })} disabled={disabled} />}
    {!basic && allowWithheld && <ChoiceChip label="Prefer not to say" selectionType="single" selected={answer.state === 'withheld'} onSelect={() => onChange({ state: 'withheld' })} disabled={disabled} />}
  </View></QuestionGroup>;
}
/** Local optional collection. The host acknowledges saving and refreshes the originating Check. */
export function ContextFlow({ initialDraft, relevance, contextQuestions = [], collectIntent = true, completionLabel = 'Save skin profile', onApply, onSkip, loading = false, error }: ContextFlowProps) {
  const [draft, setDraft] = useState(() => createContextDraft(initialDraft));
  const [sensitivityText, setSensitivityText] = useState(() => initialDraft?.sensitivities.state === 'answered' ? initialDraft.sensitivities.value.join('\n') : '');
  const [step, setStep] = useState(0);
  const [validation, setValidation] = useState<string | null>(null);
  const fields = relevantQuestions(relevance);
  const hasContext = contextQuestions.length > 0 || fields.length > 0;
  const last = hasContext ? 2 : 1;
  const editing = Boolean(initialDraft);
  const askSkinFeel = (draft.primaryGoal.state === 'answered' && draft.primaryGoal.value === 'dryness') || draft.secondaryGoals.includes('dryness') || draft.behavior.state !== 'unanswered';
  const update = <K extends keyof ContextDraft>(key: K, value: ContextDraft[K]) => { setValidation(null); setDraft(current => ({ ...current, [key]: value })); };
  const continueOrApply = () => { const message = validateContextDraft(draft); setValidation(message); if (message) return; if (editing || step === last) onApply(createContextDraft(draft)); else setStep(step + 1); };
  return <Screen scrollable><View style={styles.flow}>
    <View style={styles.intro}>
      <Text style={styles.title}>Your skin profile</Text>
      <Text style={styles.copy}>Optional. You can skip and still see product facts.</Text>
      {!editing && <Text style={styles.copy}>Step {step + 1} of {last + 1}</Text>}
    </View>
    {(editing || step === 0) && <View style={styles.questions}>
      <QuestionGroup label="What would you like to improve?" support="Optional. Choose up to three. Your first choice is Main."><View style={styles.chips}>
        {goals.map(([value, label]) => {
          const main = draft.primaryGoal.state === 'answered' && draft.primaryGoal.value === value;
          const also = draft.secondaryGoals.includes(value);
          const role = main ? 'Main' : also ? 'Also' : null;
          const selected = main || also;
          const count = (draft.primaryGoal.state === 'answered' ? 1 : 0) + draft.secondaryGoals.length;
          const disabled = loading || (!selected && count >= 3);
          return <TouchableOpacity key={value} activeOpacity={0.75} accessibilityRole="checkbox" accessibilityLabel={role ? `${label}, ${role}` : label} accessibilityState={{ checked: selected, disabled }} disabled={disabled} style={[styles.goal, main ? styles.mainGoal : also ? styles.alsoGoal : styles.unselectedGoal, disabled && styles.disabledGoal]} onPress={() => { if (disabled) return; setValidation(null); setDraft(current => toggleProfileGoal(current, value)); }}>
            <Text style={[styles.goalLabel, main && styles.mainGoalLabel]}>{label}</Text>
            {role && <Text style={[styles.goalRole, main && styles.mainGoalLabel]}>{role}</Text>}
          </TouchableOpacity>;
        })}
      </View></QuestionGroup>
      {collectIntent && <AnswerChoices label="What are you deciding?" support="This choice is saved with your profile and reused for future Checks. You can change it." answer={draft.intent} disabled={loading} choices={[['add', 'Add to my routine'], ['replace', 'Replace something'], ['check_current', 'Check what I use']]} onChange={value => update('intent', value)} />}
    </View>}
    {(editing || step === 1) && <View style={styles.questions}>
      {askSkinFeel && <AnswerChoices label="How does your skin usually feel?" support="Combination: oily in some areas, dry in others." answer={draft.behavior} basic disabled={loading} choices={[['dry_tight', 'Dry / tight'], ['balanced', 'Balanced'], ['combination', 'Combination'], ['oily', 'Oily']]} onChange={value => update('behavior', value)} />}
      <AnswerChoices label="Do skincare products tend to irritate your skin?" answer={draft.reactivity} basic disabled={loading} choices={[['reacts_easily', 'My skin gets irritated easily'], ['generally_tolerates', 'I generally tolerate products']]} onChange={value => update('reactivity', value)} />
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
      <Button label={editing || step === last ? completionLabel : 'Continue'} loading={loading} onPress={continueOrApply} />
      {!editing && step > 0 && <Button label="Back" variant="ghost" disabled={loading} onPress={() => setStep(step - 1)} />}
      <Button label={editing ? 'Cancel profile edit' : 'Skip'} variant="ghost" disabled={loading} onPress={() => { if (editing) onSkip(); else if (step === last) continueOrApply(); else setStep(step + 1); }} />
    </View>
  </View></Screen>;
}
export const styles = StyleSheet.create({
  flow: { gap: layout.sectionGap }, intro: { gap: layout.titleGap }, questions: { gap: layout.sectionGap }, disclosure: { gap: spacing.sm }, actions: { gap: spacing.xs },
  title: { fontSize: typography.sizes.screenTitle, lineHeight: typography.lineHeights.screenTitle, fontWeight: typography.weights.semibold, color: colors.ink },
  copy: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  error: { color: colors.actionStop.text, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  group: { padding: layout.cardPadding, gap: spacing.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  goal: { minHeight: layout.minTouchTarget, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  mainGoal: { backgroundColor: colors.brand, borderColor: colors.brand }, alsoGoal: { backgroundColor: colors.brandLight, borderColor: colors.brand }, unselectedGoal: { backgroundColor: colors.surface, borderColor: colors.border }, disabledGoal: { opacity: 0.45 },
  goalLabel: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, fontWeight: typography.weights.medium },
  mainGoalLabel: { color: colors.inkInverse }, goalRole: { color: colors.brandDark, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold },
  input: { minHeight: layout.minTouchTarget, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: spacing.sm, fontSize: typography.sizes.bodyRegular, color: colors.ink, backgroundColor: colors.surface },
});
