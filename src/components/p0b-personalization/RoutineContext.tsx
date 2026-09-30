import { referenceDisplayLabel } from '@/src/presentation/p0b-personalization/referenceDisplay';
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Screen } from '@/src/components/ui/Screen';
import { Button } from '@/src/components/ui/Button';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { GroupedSection } from '@/src/components/ui/GroupedSection';
import { QuestionGroup } from '@/src/components/ui/QuestionGroup';
import { createRoutineDraft, manualRoutineItem, validateRoutineDraft, type RoutineDraft, type RoutineItemDraft, type RoutineReference } from '@/src/presentation/p0b-personalization/draft';
import { validateReportedUse } from '@/src/presentation/p0b-personalization/experience';
import { ReportedUseFields } from './ReportedUseFields';
import { styles } from './ContextFlow';
export interface RoutineContextProps { initialDraft?: RoutineDraft; createItemId: () => string; availableProducts?: readonly Extract<RoutineReference, { kind: 'catalog' }>[]; onApply: (draft: RoutineDraft) => void; onSkip: () => void; loading?: boolean; error?: string | null }
export function RoutineContext({ initialDraft, createItemId, availableProducts = [], onApply, onSkip, loading = false, error }: RoutineContextProps) {
  const [draft, setDraft] = useState(() => createRoutineDraft(initialDraft));
  const [name, setName] = useState('');
  const [validation, setValidation] = useState<string | null>(null);
  const [detailsVisible, setDetailsVisible] = useState<Record<string, boolean>>(() => Object.fromEntries((initialDraft?.items ?? []).map(item => [item.id, item.timing !== 'unknown' || item.frequency.kind !== 'unknown' || Boolean(item.startedOn || item.stoppedOn || item.duration)])));
  const update = (id: string, patch: Partial<RoutineItemDraft>) => { setValidation(null); setDraft(current => ({ ...current, items: current.items.map(item => item.id === id ? { ...item, ...patch } : item) })); };
  const add = (reference?: Extract<RoutineReference, { kind: 'catalog' }>) => {
    const id = createItemId();
    if (draft.items.some(item => item.id === id)) { setValidation('This item already exists. Please try again.'); return; }
    setValidation(null);
    setDraft(current => ({ ...current, items: [...current.items, { ...manualRoutineItem(id, reference?.label ?? name), ...(reference ? { reference: { ...reference } } : {}) }] }));
    if (!reference) setName('');
  };
  return <Screen scrollable><View style={styles.flow}>
    <View style={styles.intro}><Text style={styles.title}>Your routine</Text><Text style={styles.copy}>Names you enter stay unverified until matched to product evidence. Adding a product here does not establish its formula.</Text></View>
    <QuestionGroup label="Add a product"><View style={styles.disclosure}>
      <TextInput style={styles.input} editable={!loading} accessibilityLabel="Routine product name" placeholder="Product name" maxLength={180} value={name} onChangeText={setName} />
      <Button label="Add product" disabled={loading || !name.trim() || draft.items.length >= 50} onPress={() => add()} />
    </View></QuestionGroup>
    {availableProducts.length > 0 && <QuestionGroup label="Products already recorded"><View style={styles.disclosure}>{availableProducts.map(product => <Button key={product.productId + ':' + product.variantId + ':' + product.formulaVersionId} label={`Add ${product.label}`} variant="outline" disabled={loading || draft.items.length >= 50} onPress={() => add(product)} />)}</View></QuestionGroup>}
    {draft.items.length > 0 && <View style={styles.questions}>{draft.items.map(item => <GroupedSection key={item.id} header={referenceDisplayLabel(item.reference, availableProducts)} footer={item.reference.kind === 'manual' ? 'Manual name. Formula and ingredients are unverified.' : 'Reported product reference. Missing formula context stays unknown.'} style={{ marginBottom: 0 }}><View style={styles.group}>
      {item.reference.kind === 'manual' && <TextInput style={styles.input} accessibilityLabel={`Edit product name ${referenceDisplayLabel(item.reference, availableProducts)}`} editable={!loading} maxLength={180} value={item.reference.label} onChangeText={label => update(item.id, { reference: { ...item.reference, label } })} />}
      <QuestionGroup label="How do you use this product?" support={item.status === null ? 'Choose a use status before saving.' : undefined}><View style={styles.chips}>{([['current', 'In use'], ['paused', 'Paused'], ['stopped', 'Stopped'], ['occasional', 'Occasional']] as const).map(([value, label]) => <ChoiceChip key={value} label={label} selectionType="single" disabled={loading} selected={item.status === value} onSelect={() => update(item.id, { status: value })} />)}</View></QuestionGroup>
      {(item.status !== null || detailsVisible[item.id]) && <Button label={detailsVisible[item.id] ? 'Hide use details' : 'Add use details'} variant="ghost" disabled={loading} onPress={() => setDetailsVisible(current => ({ ...current, [item.id]: !current[item.id] }))} />}
      {detailsVisible[item.id] && <ReportedUseFields value={{ timing: item.timing, frequency: item.frequency, startedOn: item.startedOn ?? null, stoppedOn: item.stoppedOn ?? null, duration: item.duration ?? null }} disabled={loading} onChange={use => update(item.id, use)} />}
      <Button label="Remove product" variant="ghost" disabled={loading} onPress={() => { setValidation(null); setDraft(current => ({ ...current, items: current.items.filter(value => value.id !== item.id) })); }} />
    </View></GroupedSection>)}</View>}
    <QuestionGroup label="How much of your routine is here?" support="A partial routine cannot establish that you use no other products."><View style={styles.chips}>{([['partial', 'Some of my routine'], ['complete', 'My whole routine'], ['unknown', 'Not sure']] as const).map(([value, label]) => <ChoiceChip key={value} label={label} selectionType="single" disabled={loading} selected={draft.completeness === value} onSelect={() => { setValidation(null); setDraft(current => ({ ...current, completeness: value })); }} />)}</View></QuestionGroup>
    {(error || validation) && <Text accessibilityRole="alert" style={styles.error}>{error || validation}</Text>}
    <View style={styles.actions}>
      <Button label="Use this routine context" loading={loading} onPress={() => {
        const message = validateRoutineDraft(draft) ?? draft.items.map(item => validateReportedUse({ timing: item.timing, frequency: item.frequency, startedOn: item.startedOn ?? null, stoppedOn: item.stoppedOn ?? null, duration: item.duration ?? null })).find(Boolean) ?? null;
        setValidation(message); if (!message) onApply(createRoutineDraft(draft));
      }} />
      <Button label="Skip routine context" variant="ghost" disabled={loading} onPress={onSkip} />
    </View>
  </View></Screen>;
}
