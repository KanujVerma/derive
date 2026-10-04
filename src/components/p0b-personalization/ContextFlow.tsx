import type {DictionaryRelease} from '../../domain/part-two/dictionary';
import { parseSpendingAmount } from '../../presentation/p0b-personalization/spendingInput';
import { editSensitivityInput } from '@/src/presentation/p0b-personalization/sensitivityInput';
import React, { useState } from 'react';
import { Keyboard, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Screen } from '@/src/components/ui/Screen';
import { Button } from '@/src/components/ui/Button';
import { ChoiceChip } from '@/src/components/ui/ChoiceChip';
import { QuestionGroup } from '@/src/components/ui/QuestionGroup';
import { colors, layout, radii, spacing, typography } from '@/src/constants/theme';
import { createContextDraft, relevantQuestions, validateContextDraft, GOALS, type Treatment, type Answer, type ContextDraft, type RoutineReference, type SafetyRelevance } from '@/src/presentation/p0b-personalization/draft';

import { toggleProfileGoal } from '@/src/presentation/p0b-personalization/goalSelection';
import { addCurrentProduct, addPastOutcome, currentProductFeedback, currentFeedbackChoices, currentFeedbackLabels, toggleCurrentFeedback, clearCurrentFeedback, setSetupAnswer, removePastOutcome, productOutcomeLabels, catalogFamilyReference, createSetupBundle, currentUseItem, manualUnverifiedReference, removeSetupProduct, type SetupBundle, type ProductOutcome } from '@/src/presentation/p0b-personalization/setup';
import { CatalogProductSearch } from '@/src/components/catalog/CatalogProductSearch';
import { PreferenceChoices } from './PreferenceChoices';
import { StructuredPreferenceFields, type SpendingInput } from './StructuredPreferenceFields';
import { referenceToStorage } from '@/src/presentation/p0b-personalization/storageAdapter';
import type { CatalogProductSummary } from '@/src/contracts/ProductCatalog';

const goals = GOALS.map(([value, label]) => [value, value === 'dryness' ? 'Dryness' : label] as const);
const notices = [['stung', 'Stung'], ['broke_out', 'Broke out'], ['too_drying', 'Too drying'], ['too_heavy', 'Too heavy'], ['not_helping', 'Not helping']] as const;
export interface ContextFlowProps {
  initialDraft?: ContextDraft; relevance?: SafetyRelevance;
  /** Context questions are shown only when the caller establishes relevance. */
  contextQuestions?: readonly ('treatments' | 'sensitivities')[];
  /** Decision intent belongs to a Check when the caller supplies it there. */
  collectIntent?: boolean;
  /** The host names the completion action, including temporary previews. */
  completionLabel?: string;
  /** Fresh setup may also record current products, product experiences, and confirmed preferences. Profile editing does not replay those stages. */
  setup?: boolean;
  ownerId?: string | null;
  createId?: () => string;
  /** Fixture hosts inject local product examples; live editors keep the catalog service. */
  catalogSearch?: (query: string) => Promise<CatalogProductSummary[]>;
  onSetup?: (bundle: SetupBundle, draft: ContextDraft) => void;
  /** A live host acknowledges atomic storage; fixture collection remains disclosed. */
  durableSetup?: boolean;
  dictionaryRelease?:DictionaryRelease;
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
export function ContextFlow({ initialDraft, relevance, contextQuestions = [], collectIntent = true, completionLabel = 'Save skin profile', setup = false, ownerId = null, createId, catalogSearch, onSetup, durableSetup = false, dictionaryRelease, onApply, onSkip, loading = false, error }: ContextFlowProps) {
  const [draft, setDraft] = useState(() => createContextDraft(initialDraft));
  const [sensitivityText, setSensitivityText] = useState(() => initialDraft?.sensitivities.state === 'answered' ? initialDraft.sensitivities.value.join('\n') : '');
  const [step, setStep] = useState(0);
  const [validation, setValidation] = useState<string | null>(null);
  const [bundle, setBundle] = useState(() => createSetupBundle(ownerId));
  const [manualName, setManualName] = useState('');
  const [outcomeOpen, setOutcomeOpen] = useState<string | null>(null);
  const [spendingInput, setSpendingInput] = useState<SpendingInput>(()=>{const v=initialDraft?.spendingPreference?.state==='answered'?initialDraft.spendingPreference.value:null;return {amount:v?(v.amountMinor/100).toFixed(2):'',currency:v?.currency??'USD',scope:v?.scope??'per_product',period:v?.period??'purchase'};});
  const [pending, setPending] = useState<RoutineReference | null>(null);
  const fields = relevantQuestions(relevance);
  const hasContext = contextQuestions.length > 0 || fields.length > 0;
  const editing = Boolean(initialDraft);
  const extended = setup && !editing && !hasContext;
  const last = hasContext ? 2 : extended ? 4 : 1;
  const currentBundle = bundle.ownerId === ownerId ? bundle : createSetupBundle(ownerId);
  if (currentBundle !== bundle) { setBundle(currentBundle); setOutcomeOpen(null); setPending(null); setManualName(''); }
  const update = <K extends keyof ContextDraft>(key: K, value: ContextDraft[K]) => { setValidation(null); setDraft(current => ({ ...current, [key]: value })); };
  const finish = () => { const message = spendingInput.amount.trim() && parseSpendingAmount(spendingInput.amount) === null ? 'Enter a spending amount with up to two decimal places, or leave it unanswered.' : validateContextDraft(draft); setValidation(message); if (message) return; if (extended && onSetup) { onSetup(currentBundle, createContextDraft(draft)); return; } onApply(createContextDraft(draft)); };
  const continueOrApply = () => { if (editing || step === last) finish(); else setStep(step + 1); };
  const addNamedProduct = (reference: ReturnType<typeof manualUnverifiedReference> | ReturnType<typeof catalogFamilyReference>, catalog?: CatalogProductSummary) => {
    if(durableSetup && currentBundle.products.length >= 20) { setValidation('Save up to 20 current products.'); return; }
    const id = createId?.();
    if (!id) return;
    setBundle(addCurrentProduct(currentBundle, currentUseItem(id, reference), catalog));
    setManualName('');
    Keyboard.dismiss();
  };
  const addNoticedProduct = (reference: ReturnType<typeof manualUnverifiedReference> | ReturnType<typeof catalogFamilyReference>, notice: ProductOutcome) => {
    if(durableSetup && currentBundle.previewOnly.pastReports.length >= 20) { setValidation('Save up to 20 past product entries.'); return; }
    const id = createId?.();
    if (!id) return;
    setBundle(addPastOutcome(currentBundle, id, reference, notice));
    setManualName('');
    Keyboard.dismiss();
  };
  return <Screen scrollable><View style={styles.flow}>
    <View style={styles.intro}>
      <Text style={styles.title}>Your skin profile</Text>
      {!editing && <Text style={styles.copy}>Step {step + 1} of {last + 1}</Text>}
    </View>
    {(editing || step === 0) && <View style={styles.questions}>
      <QuestionGroup label="What would you like to improve?" support="Choose your main goal first. Add up to two more."><View style={styles.chips}>
        {goals.map(([value, label]) => {
          const main = draft.primaryGoal.state === 'answered' && draft.primaryGoal.value === value;
          const also = draft.secondaryGoals.includes(value);
          const selected = main || also;
          const count = (draft.primaryGoal.state === 'answered' ? 1 : 0) + draft.secondaryGoals.length;
          const disabled = loading || (!selected && count >= 3);
          return <TouchableOpacity key={value} activeOpacity={0.75} accessibilityRole="checkbox" accessibilityLabel={selected ? `${label}, ${main ? 'primary goal' : 'additional goal'}, selected` : label} accessibilityState={{ checked: selected, disabled }} disabled={disabled} style={[styles.goal, main ? styles.mainGoal : also ? styles.alsoGoal : styles.unselectedGoal, disabled && styles.disabledGoal]} onPress={() => { if (disabled) return; setValidation(null); setDraft(current => toggleProfileGoal(current, value)); }}>
            <Text style={[styles.goalLabel, main && styles.mainGoalLabel, !main && also && styles.alsoGoalLabel]}>{main ? `${label} · Main` : label}</Text>
          </TouchableOpacity>;
        })}
      </View>{extended && durableSetup && <View style={styles.chips}>{([['unsure','Not sure of my goal'],['withheld','Prefer not to share my goal'],['unanswered','Leave my goal unanswered']] as const).map(([state,label])=><ChoiceChip key={state} label={label} selectionType="single" selected={draft.primaryGoal.state===state} disabled={loading} onSelect={()=>setDraft(current=>({...current,primaryGoal:{state},secondaryGoals:[]}))} />)}</View>}</QuestionGroup>
      {collectIntent && <AnswerChoices label="What are you deciding?" support="Saved with your profile for reference. A new Check needs its own choice." answer={draft.intent} disabled={loading} choices={[['add', 'Add to my routine'], ['replace', 'Replace something'], ['check_current', 'Check what I use']]} onChange={value => update('intent', value)} />}
    </View>}
    {(editing || step === 1) && <View style={styles.questions}>
      <AnswerChoices label="How does your skin usually feel?" answer={draft.behavior} basic disabled={loading} choices={[['dry_tight', 'Dry or tight'], ['balanced', 'Neither dry nor oily'], ['combination', 'Oily in some areas, dry in others'], ['oily', 'Oily'], ['unsure', 'Not sure']]} onChange={value => update('behavior', value)} />
      <AnswerChoices label="When you try a new skincare product, does your skin get irritated easily?" support="Think stinging, burning, redness, or peeling." answer={draft.reactivity} basic disabled={loading} choices={[['reacts_easily', 'Yes, often'], ['generally_tolerates', 'Usually not'], ['unsure', 'Not sure']]} onChange={value => update('reactivity', value)} />
    </View>}
    {(editing || step === 1) && <StructuredPreferenceFields input={spendingInput} onInput={patch=>setSpendingInput(current=>({...current,...patch}))} draft={draft} disabled={loading} onChange={patch=>setDraft(current=>({...current,...patch}))}/>}
    {extended && step === 2 && <View style={styles.questions}>
      <QuestionGroup label="What are you using now?" support="Add the skincare products you use regularly.">
        <CatalogProductSearch embedded label="Search products" search={catalogSearch} selectedIds={currentBundle.products.flatMap(product => product.reference.kind === 'catalog' ? [product.reference.productId] : [])} onQueryChange={setManualName} onSelect={(product: CatalogProductSummary) => addNamedProduct(catalogFamilyReference(product), product)} />
        <Button label="Add this name" variant="secondary" disabled={loading || !manualName.trim()} onPress={() => addNamedProduct(manualUnverifiedReference(manualName))} />
        {currentBundle.products.map(product => <View key={product.id} style={styles.disclosure}>
          <Text>{product.reference.label}</Text>
          <Text style={styles.copy}>Using now</Text>
          {durableSetup && <View style={styles.disclosure}>
            <Text style={styles.copy}>Optional reported use. This describes your use, not the label’s directions.</Text>
            {([['reportedPurpose', 'Purpose', [['moisturizing','Moisturizing'],['cleansing','Cleansing'],['sun_protection','Sun protection'],['other','Other']]], ['applicationSite','Where you use it', [['face','Face'],['body','Body'],['hands','Hands'],['scalp','Scalp'],['lips','Lips'],['eye_area','Eye area'],['other','Other']]], ['useForm','How you use it', [['leave_on','Leave on'],['rinse_off','Rinse off'],['other','Other']]]] as const).map(([field,label,choices]) => <QuestionGroup key={field} label={label}><View style={styles.chips}>
              {choices.map(([value,text])=><ChoiceChip key={value} label={text} selectionType="single" selected={currentBundle.reportedUse?.[product.id]?.[field]?.answer.state === 'known' && (currentBundle.reportedUse[product.id][field]!.answer as {value?:string}).value === value} disabled={loading} onSelect={()=>setBundle({...currentBundle,reportedUse:{...currentBundle.reportedUse,[product.id]:{...currentBundle.reportedUse?.[product.id],[field]:{answer:{state:'known',value},provenance:'self_report'}}}})} />)}
              {(['unsure','withheld'] as const).map(state=><ChoiceChip key={state} label={state==='unsure'?'Not sure':'Prefer not to say'} selectionType="single" selected={currentBundle.reportedUse?.[product.id]?.[field]?.answer.state===state} disabled={loading} onSelect={()=>setBundle({...currentBundle,reportedUse:{...currentBundle.reportedUse,[product.id]:{...currentBundle.reportedUse?.[product.id],[field]:{answer:{state},provenance:'self_report'}}}})} />)}
            </View></QuestionGroup>)}
          </View>}
          <Button label="How’s it working for you?" variant="ghost" onPress={() => setOutcomeOpen(outcomeOpen === product.id ? null : product.id)} />
          {currentProductFeedback(currentBundle, product.id).length > 0 && <Text style={styles.copy}>{currentProductFeedback(currentBundle, product.id).map(value => currentFeedbackLabels[value]).join(' · ')}</Text>}
          {outcomeOpen === product.id && <View style={styles.disclosure}>
            <Text style={styles.copy}>Optional. Choose all that apply to this product.</Text>
            <View style={styles.chips}>{currentFeedbackChoices(currentBundle.previewOnly.catalogCategories?.[product.id]).map(([outcome, label]) => <ChoiceChip key={outcome} label={label} selectionType="multiple" selected={currentProductFeedback(currentBundle, product.id).includes(outcome)} disabled={loading} onSelect={() => setBundle(toggleCurrentFeedback(currentBundle, product.id, outcome))} />)}</View>
            <Button label="Clear feedback" variant="ghost" disabled={loading} onPress={() => setBundle(clearCurrentFeedback(currentBundle, product.id))} />
          </View>}
          <Button label={`Remove ${product.reference.label}`} variant="ghost" onPress={() => setBundle(removeSetupProduct(currentBundle, product.id))} />
        </View>)}
        {!currentBundle.products.length && <View style={styles.chips}>{([['none', 'No skincare products'], ['unknown', 'Not sure']] as const).map(([value, label]) => <ChoiceChip key={value} label={label} selectionType="single" selected={currentBundle.previewOnly.currentProducts === value} disabled={loading} onSelect={() => setBundle(setSetupAnswer(currentBundle, 'currentProducts', value))} />)}</View>}
        <Text style={styles.copy}>{durableSetup ? 'Products and your feedback will be saved together when you finish.' : 'Preview only. Products and outcomes aren’t saved.'}</Text>
      </QuestionGroup>
    </View>}
    {extended && step === 3 && <View style={styles.questions}>
      <QuestionGroup label="Any skincare products that didn't agree with your skin?">
        <CatalogProductSearch embedded label="Search products" search={catalogSearch} onQueryChange={value => setPending(value.trim() ? manualUnverifiedReference(value) : null)} onSelect={(product: CatalogProductSummary) => setPending(catalogFamilyReference(product))} />
        {notices.map(([notice, label]) => <Button key={notice} label={label} variant="secondary" disabled={loading || !pending?.label.trim()} onPress={() => { if (pending) addNoticedProduct(pending, notice); setPending(null); }} />)}
        {currentBundle.previewOnly.pastReports.map(experience => <View key={experience.id} style={styles.chips}>
          <Text>{experience.reference.label}</Text>
          <Text>{productOutcomeLabels[experience.outcome]}</Text>
          <Button label={`Remove ${experience.reference.label}`} variant="ghost" onPress={() => setBundle(removePastOutcome(currentBundle, experience.id))} />
        </View>)}
        {!currentBundle.previewOnly.pastReports.length && <View style={styles.chips}>{([['none', 'None that I remember'], ['unknown', 'Not sure']] as const).map(([value, label]) => <ChoiceChip key={value} label={label} selectionType="single" selected={currentBundle.previewOnly.pastProducts === value} disabled={loading} onSelect={() => setBundle(setSetupAnswer(currentBundle, 'pastProducts', value))} />)}</View>}
        <Text style={styles.copy}>{durableSetup ? 'Your reports will be saved when you finish. They do not identify an ingredient cause.' : 'Your report doesn’t identify an ingredient cause. Preview reports aren’t saved.'}</Text>
      </QuestionGroup>
    </View>}
    {extended && step === 4 && <View style={styles.questions}>
      {durableSetup && createId && <PreferenceChoices dictionaryRelease={dictionaryRelease} key={'preferences:' + ownerId} preferences={currentBundle.preferences ?? []} products={[...currentBundle.products.map(p=>({key:p.id,label:p.reference.label,reference:referenceToStorage(p.reference)})),...currentBundle.previewOnly.pastReports.map(p=>({key:p.id,label:p.reference.label,reference:referenceToStorage(p.reference)}))]} createId={createId} loading={loading} onChange={preferences=>setBundle({...currentBundle,preferences})}/>}
      {durableSetup && <Text style={styles.copy}>Save your profile, current products, feedback, past experiences and confirmed preferences together. If saving fails, your entries remain here for retry. Up to 20 current products and 20 experiences.</Text>}
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
      <Button label={editing ? 'Cancel profile edit' : 'Skip'} variant="ghost" disabled={loading} onPress={() => { if (editing) onSkip(); else if (step === last) finish(); else setStep(step + 1); }} />
    </View>
  </View></Screen>;
}
export const styles = StyleSheet.create({
  flow: { gap: layout.sectionGap }, intro: { gap: layout.titleGap }, questions: { gap: layout.sectionGap }, disclosure: { gap: spacing.sm }, actions: { gap: spacing.xs },
  title: { fontSize: typography.sizes.screenTitle, lineHeight: typography.lineHeights.screenTitle, fontWeight: typography.weights.semibold, color: colors.ink },
  copy: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  error: { color: colors.actionStop.text, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  group: { padding: layout.cardPadding, gap: spacing.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  goal: { minHeight: layout.minTouchTarget, borderWidth: 1, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  mainGoal: { backgroundColor: colors.brand, borderColor: colors.brand }, alsoGoal: { backgroundColor: colors.brandLight, borderColor: colors.brand }, unselectedGoal: { backgroundColor: colors.surface, borderColor: colors.border }, disabledGoal: { opacity: 0.45 },
  goalLabel: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, fontWeight: typography.weights.medium },
  alsoGoalLabel: { color: colors.ink },
  mainGoalLabel: { color: colors.inkInverse },
  input: { minHeight: layout.minTouchTarget, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: spacing.sm, fontSize: typography.sizes.bodyRegular, color: colors.ink, backgroundColor: colors.surface },
});
