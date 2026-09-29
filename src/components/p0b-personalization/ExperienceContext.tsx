import { referenceDisplayLabel } from '@/src/presentation/p0b-personalization/referenceDisplay';
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Screen } from '@/src/components/ui/Screen';
import { Button } from '@/src/components/ui/Button';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { QuestionGroup } from '@/src/components/ui/QuestionGroup';
import type { RoutineReference } from '@/src/presentation/p0b-personalization/draft';
import { createExperienceDraft, selectExperienceCatalogProduct, confirmExperiencePackage, unambiguousExperiencePackage, prepareExperienceEdit, unknownUseContext, validateExperienceDraft, type ExperienceDraft, type ExperienceEdit, type ExperienceKind } from '@/src/presentation/p0b-personalization/experience';
import { ReportedUseFields } from './ReportedUseFields';
import { styles } from './ContextFlow';
export interface ExperienceContextProps {
  /** New reports use the host UUID. Corrections retain the existing report ID and revision. */
  createRecordId: () => string; existing?: { draft: ExperienceDraft; revisionId: string };
  availableProducts?: readonly Extract<RoutineReference, { kind: 'catalog' }>[];
  onApply: (edit: ExperienceEdit) => void; onSkip: () => void; loading?: boolean; error?: string | null;
}
const kinds: readonly [ExperienceKind, string][] = [['reacted', 'I reacted to it'], ['tolerated', 'I tolerated it'], ['no_reaction_reported', 'No reaction to report'], ['liked', 'I liked it'], ['finished', 'I finished it'], ['ineffective', 'It did not help my goal']];
/** User reports remain reports. The host owns record revisions and persistence. */
export function ExperienceContext({ createRecordId, existing, availableProducts = [], onApply, onSkip, loading = false, error }: ExperienceContextProps) {
  const [edit, setEdit] = useState<ExperienceEdit>(() => existing ? prepareExperienceEdit(existing.draft, existing.revisionId) : { draft: createExperienceDraft(createRecordId()), supersedesRevisionId: null });
  const [symptomsText, setSymptomsText] = useState(() => existing?.draft.symptoms.join('\n') ?? '');
  const [validation, setValidation] = useState<string | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(() => Boolean(existing?.draft.occurred.start || existing?.draft.occurred.end || existing?.draft.symptoms.length || existing?.draft.note));
  const [useDetailsVisible, setUseDetailsVisible] = useState(() => Boolean(existing?.draft.useContext));
  const draft = edit.draft;
  const productChoices = [...new Map(availableProducts.map(product => [product.productId, product])).values()];
  const exactPackage = draft.reference.kind === 'catalog' ? unambiguousExperiencePackage(draft.reference.productId, availableProducts) : null;
  const update = (patch: Partial<ExperienceDraft>) => { setValidation(null); setEdit(current => ({ ...current, draft: { ...current.draft, ...patch } })); };
  return <Screen scrollable><View style={styles.flow}><View style={styles.intro}><Text style={styles.title}>{existing ? 'Correct your product experience' : 'Your product experience'}</Text>
    <Text style={styles.copy}>Optional. This records what you noticed. It does not establish which ingredient caused a reaction.</Text>
    </View>
    {existing && <Text style={styles.copy}>This correction updates your earlier report and preserves its history.</Text>}
    <QuestionGroup label="Product"><View style={styles.disclosure}>
      {availableProducts.length > 0 && <View style={styles.chips}>{productChoices.map(product => <ChoiceChip key={product.productId + ':' + product.variantId + ':' + product.formulaVersionId} label={product.label} selectionType="single" disabled={loading} selected={draft.reference.kind === 'catalog' && draft.reference.productId === product.productId} onSelect={() => { if (draft.reference.kind !== 'catalog' || draft.reference.productId !== product.productId) update({ reference: selectExperienceCatalogProduct(product) }); }} />)}</View>}
      <ChoiceChip label="Enter a product name" selectionType="single" selected={draft.reference.kind === 'manual'} disabled={loading} onSelect={() => update({ reference: { kind: 'manual', label: '', verification: 'unverified' } })} />
      {draft.reference.kind === 'manual' ? <><TextInput accessibilityLabel="Experience product name" style={styles.input} editable={!loading} maxLength={180} value={draft.reference.label} placeholder="Product name" onChangeText={label => { if (draft.reference.kind === 'manual') update({ reference: { ...draft.reference, label } }); }} /><Text style={styles.copy}>Manual name. Formula and ingredients remain unverified.</Text></> : <Text style={styles.copy}>{referenceDisplayLabel(draft.reference, availableProducts)}. {draft.reference.variantId && draft.reference.formulaVersionId ? 'You marked this as the same package and formula.' : 'Formula at the time of use is unconfirmed.'}</Text>}
      {draft.reference.kind === 'catalog' && exactPackage && <ChoiceChip label="Same package and formula" selectionType="single" disabled={loading} selected={draft.reference.variantId === exactPackage.variantId && draft.reference.formulaVersionId === exactPackage.formulaVersionId} onSelect={() => { if (draft.reference.kind === 'catalog') update({ reference: draft.reference.variantId === exactPackage.variantId && draft.reference.formulaVersionId === exactPackage.formulaVersionId ? selectExperienceCatalogProduct(draft.reference) : confirmExperiencePackage(draft.reference, availableProducts) }); }} />}
      {draft.reference.kind === 'catalog' && !exactPackage && !draft.reference.formulaVersionId && <Text style={styles.copy}>Keep the formula unconfirmed when the saved package references are missing or ambiguous.</Text>}
    </View></QuestionGroup>
    <QuestionGroup label="What did you notice?"><View style={styles.chips}>{kinds.map(([kind, label]) => <ChoiceChip key={kind} label={label} selectionType="single" selected={draft.kind === kind} disabled={loading} onSelect={() => update({ kind })} />)}</View></QuestionGroup>
    <Text style={styles.copy}>No reaction to report does not mean you confirmed tolerance.</Text>
    <Button label={detailsVisible ? 'Hide optional details' : 'Add optional details'} variant="ghost" disabled={loading} onPress={() => setDetailsVisible(!detailsVisible)} />
    {detailsVisible && <View style={styles.questions}><QuestionGroup label="When, if known" support="Leave dates blank when unknown. An approximate interval is kept as an interval."><View style={styles.disclosure}>{(['start', 'end'] as const).map(field => <TextInput key={field} accessibilityLabel={field === 'start' ? 'Experience date or interval start' : 'Experience interval end'} style={styles.input} editable={!loading} placeholder={field === 'start' ? 'Date or start YYYY-MM-DD' : 'Interval end YYYY-MM-DD, if known'} value={draft.occurred[field] ?? ''} onChangeText={text => update({ occurred: { ...draft.occurred, [field]: text.trim() || null } })} />)}</View></QuestionGroup>
    <QuestionGroup label="What else did you notice?"><View style={styles.disclosure}>
      <TextInput accessibilityLabel="Reported symptoms, one per line" style={styles.input} editable={!loading} multiline placeholder="Symptoms you noticed, one per line" value={symptomsText} onChangeText={text => { setSymptomsText(text); update({ symptoms: text.split('\n').map(value => value.trim()).filter(Boolean) }); }} />
      <TextInput accessibilityLabel="Experience note" style={styles.input} editable={!loading} maxLength={500} placeholder="Note, up to 500 characters" value={draft.note ?? ''} onChangeText={text => update({ note: text || null })} />
    </View></QuestionGroup></View>}
    <Button label={useDetailsVisible ? 'Hide use details' : 'Add use details'} variant="ghost" disabled={loading} onPress={() => { if (!draft.useContext) update({ useContext: unknownUseContext() }); setUseDetailsVisible(!useDetailsVisible); }} />
    {useDetailsVisible && draft.useContext && <View style={styles.disclosure}><ReportedUseFields value={draft.useContext} disabled={loading} onChange={useContext => update({ useContext })} /><Button label="Clear use details" variant="ghost" disabled={loading} onPress={() => { update({ useContext: null }); setUseDetailsVisible(false); }} /></View>}
    {(error || validation) && <Text accessibilityRole="alert" style={styles.error}>{error || validation}</Text>}
    <View style={styles.actions}><Button label={existing ? 'Use this correction' : 'Use this report'} loading={loading} onPress={() => { const message = validateExperienceDraft(draft); setValidation(message); if (!message) onApply({ draft: createExperienceDraft(draft.id, draft), supersedesRevisionId: edit.supersedesRevisionId }); }} />
    <Button label={existing ? 'Cancel correction' : 'Skip experience'} variant="ghost" disabled={loading} onPress={onSkip} /></View>
  </View></Screen>;
}
