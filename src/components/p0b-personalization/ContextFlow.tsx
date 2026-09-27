import React, { useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { Screen } from '@/src/components/ui/Screen';
import { Button } from '@/src/components/ui/Button';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { Icon } from '@/src/components/ui/Icon';
import { colors, spacing, typography } from '@/src/constants/theme';
import { createContextDraft, relevantQuestions, toggleSecondaryGoal, validateContextDraft, type Answer, type ContextDraft, type Goal, type SafetyRelevance } from '@/src/presentation/p0b-personalization/draft';

const goals: readonly [Goal, string][] = [['hydration', 'Hydration'], ['blemishes', 'Blemishes'], ['texture', 'Texture'], ['tone', 'Uneven tone'], ['comfort', 'Comfort']];
export interface ContextFlowProps {
  initialDraft?: ContextDraft; relevance?: SafetyRelevance;
  /** Context questions are shown only when the caller establishes relevance. */
  contextQuestions?: readonly ('treatments' | 'sensitivities')[];
  onApply: (draft: ContextDraft) => void; onSkip: () => void;
  loading?: boolean; error?: string | null;
}
function AnswerChoices<T extends string>({ label, answer, choices, onChange, disabled }: { label: string; answer: Answer<T>; choices: readonly [T, string][]; onChange: (answer: Answer<T>) => void; disabled: boolean }) {
  return <GroupedSection header={label}><View style={styles.group}><View style={styles.chips}>
    {choices.map(([value, text]) => <ChoiceChip key={value} label={text} selected={answer.state === 'answered' && answer.value === value} onSelect={() => onChange({ state: 'answered', value })} disabled={disabled} />)}
    <ChoiceChip label="Leave unanswered" selected={answer.state === 'unanswered'} onSelect={() => onChange({ state: 'unanswered' })} disabled={disabled} />
    <ChoiceChip label="Prefer not to say" selected={answer.state === 'withheld'} onSelect={() => onChange({ state: 'withheld' })} disabled={disabled} />
  </View></View></GroupedSection>;
}
/** Local optional collection. Applying answers asks the host to refresh; it makes no persistence claim. */
export function ContextFlow({ initialDraft, relevance, contextQuestions = [], onApply, onSkip, loading = false, error }: ContextFlowProps) {
  const [draft, setDraft] = useState(() => createContextDraft(initialDraft));
  const [step, setStep] = useState(0);
  const [validation, setValidation] = useState<string | null>(null);
  const fields = relevantQuestions(relevance);
  const hasContext = contextQuestions.length > 0 || fields.length > 0;
  const last = hasContext ? 2 : 1;
  const update = <K extends keyof ContextDraft>(key: K, value: ContextDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  return <Screen scrollable><Text style={styles.title}>Make this Check more personal</Text>
    <Text style={styles.copy}>Optional context can help with this decision. You can skip and still see product facts.</Text>
    <Text style={styles.copy}>Step {step + 1} of {last + 1}</Text>
    {step === 0 && <>
      <AnswerChoices label="What are you deciding?" answer={draft.intent} disabled={loading} choices={[['add', 'Add to my routine'], ['replace', 'Replace something'], ['check_current', 'Check what I use']]} onChange={value => update('intent', value)} />
      <AnswerChoices label="Main goal" answer={draft.primaryGoal} disabled={loading} choices={goals} onChange={value => { setDraft(current => ({ ...current, primaryGoal: value, secondaryGoals: value.state === 'answered' ? current.secondaryGoals.filter(goal => goal !== value.value) : current.secondaryGoals })); }} />
      <GroupedSection header="Other goals" footer="Optional. Choose up to two."><View style={[styles.group, styles.chips]}>{goals.map(([value, label]) => <ChoiceChip key={value} label={label} selected={draft.secondaryGoals.includes(value)} disabled={loading || (draft.primaryGoal.state === 'answered' && draft.primaryGoal.value === value) || (!draft.secondaryGoals.includes(value) && draft.secondaryGoals.length >= 2)} onSelect={() => setDraft(current => toggleSecondaryGoal(current, value))} />)}</View></GroupedSection>
    </>}
    {step === 1 && <>
      <AnswerChoices label="Skin most days" answer={draft.behavior} disabled={loading} choices={[['dry_tight', 'Dry or tight'], ['balanced', 'Balanced'], ['combination', 'Combination'], ['oily', 'Oily'], ['unsure', 'Not sure']]} onChange={value => update('behavior', value)} />
      <AnswerChoices label="Response to products" answer={draft.reactivity} disabled={loading} choices={[['reacts_easily', 'Reacts easily'], ['generally_tolerates', 'Generally tolerates products'], ['unsure', 'Not sure']]} onChange={value => update('reactivity', value)} />
    </>}
    {step === 2 && <>
      {contextQuestions.map(field => <GroupedSection key={field} header={field === 'treatments' ? 'Relevant treatments' : 'Known sensitivities'} footer="Use names you know. A reaction does not establish ingredient causation."><View style={styles.group}>
        <TextInput style={styles.input} accessibilityLabel={field === 'treatments' ? 'Treatment names, one per line' : 'Sensitivity names, one per line'} editable={!loading} multiline placeholder="One name per line" value={draft[field].state === 'answered' ? draft[field].value.join('\n') : ''} onChangeText={text => update(field, text.trim() ? { state: 'answered', value: text.split('\n').map(value => value.trim()).filter(Boolean) } : { state: 'unanswered' })} />
        <View style={styles.chips}>{([['None known', 'answered'], ['Leave unanswered', 'unanswered'], ['Prefer not to say', 'withheld']] as const).map(([label, state]) => <ChoiceChip key={state} label={label} disabled={loading} selected={draft[field].state === state && (state !== 'answered' || (draft[field].state === 'answered' && draft[field].value.length === 0))} onSelect={() => update(field, state === 'answered' ? { state, value: [] } : { state })} />)}</View>
      </View></GroupedSection>)}
      {fields.length > 0 && <Text style={styles.copy}>{relevance?.evidenceReason}</Text>}
      {fields.map(field => <AnswerChoices key={field} label={field === 'pregnancy' ? 'Are you pregnant?' : field === 'trying' ? 'Are you trying to conceive?' : 'Are you breastfeeding or nursing?'} answer={draft[field]} disabled={loading} choices={[['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']]} onChange={value => update(field, value)} />)}
    </>}
    {(error || validation) && <Text accessibilityRole="alert" style={styles.copy}>{error || validation}</Text>}
    <Button label={step === last ? 'Use this context' : 'Continue'} loading={loading} icon={<Icon name="forward" />} onPress={() => { const message = validateContextDraft(draft); setValidation(message); if (message) return; if (step === last) onApply(createContextDraft(draft)); else setStep(step + 1); }} />
    {step > 0 && <Button label="Back" variant="ghost" disabled={loading} onPress={() => setStep(step - 1)} />}
    <Button label="Skip personalization" variant="ghost" disabled={loading} onPress={onSkip} />
  </Screen>;
}
export const styles = StyleSheet.create({ title: { fontSize: typography.sizes.screenTitle, color: colors.ink, marginBottom: spacing.md }, copy: { color: colors.inkMuted, marginBottom: spacing.md, fontSize: typography.sizes.bodyRegular }, group: { padding: spacing.md, gap: spacing.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, color: colors.ink } });
