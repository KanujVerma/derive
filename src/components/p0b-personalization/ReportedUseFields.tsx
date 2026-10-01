import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { QuestionGroup } from '@/src/components/ui/QuestionGroup';
import type { ReportedUseDraft } from '@/src/presentation/p0b-personalization/experience';
import { styles } from './ContextFlow';
export function ReportedUseFields({ value, onChange, disabled = false }: { value: ReportedUseDraft; onChange: (value: ReportedUseDraft) => void; disabled?: boolean }) {
  const [precisionVisible, setPrecisionVisible] = useState(() => value.frequency.kind === 'exact' || Boolean(value.startedOn || value.stoppedOn || value.duration));
  return <View style={styles.questions}>
    <QuestionGroup label="When, if known"><View style={styles.chips}>{([['am', 'Morning'], ['pm', 'Evening'], ['both', 'Both'], ['unknown', 'Not sure']] as const).map(([timing, label]) => <ChoiceChip key={timing} label={label} selectionType="single" selected={value.timing === timing} disabled={disabled} onSelect={() => onChange({ ...value, timing })} />)}</View></QuestionGroup>
    <QuestionGroup label="How often, if known"><View style={styles.chips}>{([['daily', 'Daily'], ['most_days', 'Most days'], ['few_times_week', 'A few times a week'], ['weekly', 'Weekly'], ['less_often', 'Less often'], ['as_needed', 'As needed']] as const).map(([frequency, label]) => <ChoiceChip key={frequency} label={label} selectionType="single" selected={value.frequency.kind === 'qualitative' && value.frequency.value === frequency} disabled={disabled} onSelect={() => onChange({ ...value, frequency: { kind: 'qualitative', value: frequency } })} />)}<ChoiceChip label="Frequency unknown" selectionType="single" selected={value.frequency.kind === 'unknown'} disabled={disabled} onSelect={() => onChange({ ...value, frequency: { kind: 'unknown' } })} /></View></QuestionGroup>
    <Button label={precisionVisible ? 'Hide dates and exact frequency' : 'Add dates or exact frequency'} variant="ghost" disabled={disabled} onPress={() => setPrecisionVisible(!precisionVisible)} />
    {precisionVisible && <View style={styles.questions}>
      <QuestionGroup label="Exact frequency, if known"><View style={styles.disclosure}>
        <TextInput accessibilityLabel="Reported exact use count" style={styles.input} editable={!disabled} keyboardType="numeric" placeholder="Exact use count, if known" value={value.frequency.kind === 'exact' ? String(value.frequency.count) : ''} onChangeText={text => onChange({ ...value, frequency: text.trim() ? { kind: 'exact', count: Number(text), unit: value.frequency.kind === 'exact' ? value.frequency.unit : 'week' } : { kind: 'unknown' } })} />
        {value.frequency.kind === 'exact' && <View style={styles.chips}>{(['day', 'week', 'month'] as const).map(unit => <ChoiceChip key={unit} label={`Per ${unit}`} selectionType="single" selected={value.frequency.kind === 'exact' && value.frequency.unit === unit} disabled={disabled} onSelect={() => { if (value.frequency.kind === 'exact') onChange({ ...value, frequency: { ...value.frequency, unit } }); }} />)}</View>}
      </View></QuestionGroup>
      <QuestionGroup label="Dates, if known" support="Leave dates blank when you do not know them."><View style={styles.disclosure}>{(['startedOn', 'stoppedOn'] as const).map(field => <TextInput key={field} accessibilityLabel={field === 'startedOn' ? 'Use started date' : 'Use stopped date'} style={styles.input} editable={!disabled} placeholder={field === 'startedOn' ? 'Started YYYY-MM-DD, if known' : 'Stopped YYYY-MM-DD, if known'} value={value[field] ?? ''} onChangeText={text => onChange({ ...value, [field]: text.trim() || null })} />)}</View></QuestionGroup>
      <QuestionGroup label="Duration, if known"><View style={styles.disclosure}>
        <TextInput accessibilityLabel="Reported duration count" style={styles.input} editable={!disabled} keyboardType="numeric" placeholder="Duration count, if known" value={value.duration ? String(value.duration.count) : ''} onChangeText={text => onChange({ ...value, duration: text.trim() ? { count: Number(text), unit: value.duration?.unit ?? 'weeks' } : null })} />
        {value.duration && <View style={styles.chips}>{(['days', 'weeks', 'months', 'years'] as const).map(unit => <ChoiceChip key={unit} label={unit} selectionType="single" selected={value.duration?.unit === unit} disabled={disabled} onSelect={() => { if (value.duration) onChange({ ...value, duration: { ...value.duration, unit } }); }} />)}</View>}
      </View></QuestionGroup>
    </View>}
  </View>;
}
