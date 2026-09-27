import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Screen } from '@/src/components/ui/Screen';
import { Button } from '@/src/components/ui/Button';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { createRoutineDraft, manualRoutineItem, type RoutineDraft, type RoutineItemDraft } from '@/src/presentation/p0b-personalization/draft';
import { styles } from './ContextFlow';
export interface RoutineContextProps { initialDraft?: RoutineDraft; onApply: (draft: RoutineDraft) => void; onSkip: () => void; loading?: boolean; error?: string | null }
export function RoutineContext({ initialDraft, onApply, onSkip, loading = false, error }: RoutineContextProps) {
  const [draft, setDraft] = useState(() => createRoutineDraft(initialDraft));
  const [name, setName] = useState('');
  const [validation, setValidation] = useState<string | null>(null);
  const update = (id: string, patch: Partial<RoutineItemDraft>) => { if (patch.frequency) setValidation(null); setDraft(current => ({ ...current, items: current.items.map(item => item.id === id ? { ...item, ...patch } : item) })); };
  return <Screen scrollable><Text style={styles.title}>Your routine, a little at a time</Text>
    <Text style={styles.copy}>Add what matters for this Check. Names you enter stay unverified until matched to product evidence.</Text>
    <GroupedSection header="Add a product"><View style={styles.group}>
      <TextInput style={styles.input} editable={!loading} accessibilityLabel="Routine product name" placeholder="Product name" value={name} onChangeText={setName} />
      <Button label="Add product" disabled={loading || !name.trim()} onPress={() => { let suffix = 1; while (draft.items.some(item => item.id === `manual-${suffix}`)) suffix++; setDraft(current => ({ ...current, items: [...current.items, manualRoutineItem(`manual-${suffix}`, name)] })); setName(''); }} />
    </View></GroupedSection>
    {draft.items.map(item => <GroupedSection key={item.id} header={item.reference.label} footer="Manual name. Formula and ingredients are unverified."><View style={styles.group}>
      <TextInput style={styles.input} accessibilityLabel={`Edit product name ${item.reference.label}`} editable={!loading} value={item.reference.label} onChangeText={label => update(item.id, { reference: { ...item.reference, label } })} />
      <Text style={styles.copy}>Use status</Text><View style={styles.chips}>{(['current', 'paused', 'stopped', 'occasional'] as const).map(value => <ChoiceChip key={value} label={value[0].toUpperCase() + value.slice(1)} disabled={loading} selected={item.status === value} onSelect={() => update(item.id, { status: value })} />)}</View>
      <Text style={styles.copy}>When</Text><View style={styles.chips}>{([['am', 'Morning'], ['pm', 'Evening'], ['both', 'Both'], ['unknown', 'Not sure']] as const).map(([value, label]) => <ChoiceChip key={value} label={label} disabled={loading} selected={item.timing === value} onSelect={() => update(item.id, { timing: value })} />)}</View>
      <Text style={styles.copy}>How often</Text><View style={styles.chips}>{([['daily', 'Daily'], ['few_times_weekly', 'A few times a week'], ['occasionally', 'Occasionally']] as const).map(([value, label]) => <ChoiceChip key={value} label={label} disabled={loading} selected={item.frequency.kind === 'qualitative' && item.frequency.value === value} onSelect={() => update(item.id, { frequency: { kind: 'qualitative', value } })} />)}<ChoiceChip label="Not sure" selected={item.frequency.kind === 'unknown'} disabled={loading} onSelect={() => update(item.id, { frequency: { kind: 'unknown' } })} /></View>
      <TextInput style={styles.input} accessibilityLabel={`Exact uses per week for ${item.reference.label}`} editable={!loading} keyboardType="numeric" placeholder="Exact uses per week, if known" value={item.frequency.kind === 'exact' ? String(item.frequency.timesPerWeek) : ''} onChangeText={text => { if (!text.trim()) { update(item.id, { frequency: { kind: 'unknown' } }); return; } const count = Number(text); if (!/^\d+$/.test(text) || !Number.isSafeInteger(count) || count < 1) { setValidation('Enter a positive whole number of uses per week.'); return; } setValidation(null); update(item.id, { frequency: { kind: 'exact', timesPerWeek: count } }); }} />
      <Button label="Remove product" variant="ghost" disabled={loading} onPress={() => setDraft(current => ({ ...current, items: current.items.filter(value => value.id !== item.id) }))} />
    </View></GroupedSection>)}
    <GroupedSection header="How much of your routine is here?" footer="A partial routine cannot establish that you use no other products."><View style={[styles.group, styles.chips]}>{([['partial', 'Some of my routine'], ['complete', 'My whole routine'], ['unknown', 'Not sure']] as const).map(([value, label]) => <ChoiceChip key={value} label={label} disabled={loading} selected={draft.completeness === value} onSelect={() => setDraft(current => ({ ...current, completeness: value }))} />)}</View></GroupedSection>
    {(error || validation) && <Text accessibilityRole="alert" style={styles.copy}>{error || validation}</Text>}
    <Button label="Use this routine context" loading={loading} disabled={!!validation || draft.items.some(item => !item.reference.label.trim())} onPress={() => onApply(createRoutineDraft(draft))} />
    <Button label="Skip routine context" variant="ghost" disabled={loading} onPress={onSkip} />
  </Screen>;
}
