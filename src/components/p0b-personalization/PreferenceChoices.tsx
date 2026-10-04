import type {DictionaryRelease} from '../../domain/part-two/dictionary';
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button } from '../ui/Button';
import { ChoiceChip } from '../ui/ChoiceChip';
import { QuestionGroup } from '../ui/QuestionGroup';
import type { ConfirmedPreference, PreferenceTarget } from '../../contracts/PersonalContextV2';
import { confirmedPreference, ingredientChoicesForRelease, preferenceIngredientChoices, type PreferenceProductChoice } from '../../presentation/p0b-personalization/preferences';
import { spacing, colors } from '../../constants/theme';
function label(p: ConfirmedPreference, choices=preferenceIngredientChoices): string {
    if (p.kind === 'no_extra_step')
        return 'No extra skincare step';
    const t = p.target;
    if (t.kind === 'ingredient') {
        if (t.identity.kind === 'unresolved')
            return `${t.identity.originalTerm} · unresolved ingredient term`;
        const id = t.identity.ingredientId;
        return choices.find(i => i.id === id)?.label ?? 'Recorded ingredient identity';
    }
    return t.kind === 'product' ? (t.reference.kind === 'manual' ? `${t.reference.name} · manual, unverified` : 'Selected catalog product reference') : 'Confirmed preference';
}
export function PreferenceChoices({ preferences, products = [], createId, onChange, onRemove, loading = false, now = () => new Date().toISOString(), dictionaryRelease }: {
    preferences: ConfirmedPreference[];
    products?: PreferenceProductChoice[];
    createId: () => string;
    onChange: (p: ConfirmedPreference[]) => void;
    onRemove?: (id: string) => void;
    loading?: boolean;
    now?: () => string;
    dictionaryRelease?:DictionaryRelease;
}) {
    const choices=ingredientChoicesForRelease(dictionaryRelease);
    const [editing, setEditing] = useState<ConfirmedPreference | null>(null), [open, setOpen] = useState(false);
    const [kind, setKind] = useState<ConfirmedPreference['kind']>('avoid_ingredient'), [target, setTarget] = useState<PreferenceTarget | null>(null), [strength, setStrength] = useState<ConfirmedPreference['strength']>('prefer');
    const [term, setTerm] = useState(''), [confirmed, setConfirmed] = useState(false), [independent, setIndependent] = useState(false), [error, setError] = useState<string | null>(null), [deleting, setDeleting] = useState<string | null>(null);
    const start = (p: ConfirmedPreference | null) => { setEditing(p); setKind(p?.kind ?? 'avoid_ingredient'); setTarget(p?.target ?? null); setStrength(p?.strength ?? 'prefer'); setTerm(p?.target.kind === 'ingredient' && p.target.identity.kind === 'unresolved' ? p.target.identity.originalTerm : ''); setConfirmed(false); setIndependent(false); setError(null); setOpen(true); };
    const clearForm = () => { setOpen(false); setEditing(null); setTarget(null); setTerm(''); setConfirmed(false); setIndependent(false); setError(null); };
    const choose = (next: PreferenceTarget) => { setTarget(next); setConfirmed(false); setError(null); };
    return <View style={{ gap: spacing.sm }}>
  <Text accessibilityRole="header">Confirmed preferences</Text><Text>These are choices you explicitly confirm. Sensitivity and reaction reports remain separate. A preference does not establish ingredient causation or product safety.</Text>
  {preferences.map(p => <View key={p.id} style={{ gap: spacing.xs }}><Text>{label(p,choices)} · {p.strength === 'decisive' ? 'Firm constraint' : 'Preference'}</Text><Button label={`Edit preference: ${label(p,choices)}`} variant="ghost" disabled={loading} onPress={() => start(p)}/><Button label={`Remove preference: ${label(p,choices)}`} variant="ghost" disabled={loading} onPress={() => setDeleting(p.id)}/>{deleting === p.id && <><Text>Remove this confirmed preference{onRemove ? ' and erase its stored history' : ''}?</Text><Button label="Confirm preference removal" variant="outline" disabled={loading} onPress={() => { if (onRemove)
        onRemove(p.id);
    else
        onChange(preferences.filter(v => v.id !== p.id)); setDeleting(null); if (!editing || editing.id === p.id) clearForm(); }}/><Button label="Keep this preference" variant="ghost" disabled={loading} onPress={() => setDeleting(null)}/></>}</View>)}
  {!open && <Button label="Add a confirmed preference" variant="outline" disabled={loading || preferences.length >= 20} onPress={() => start(null)}/>}
  {preferences.length >= 20 && <Text>Up to 20 confirmed preferences. Edit or remove an existing entry to add another.</Text>}
  {open && <View style={{ gap: spacing.sm }}>
   <QuestionGroup label="What would you like to avoid?"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{([['avoid_ingredient', 'An ingredient'], ['avoid_product', 'A recorded product'], ['no_extra_step', 'An extra skincare step']] as const).map(([value, text]) => <ChoiceChip key={value} label={text} selectionType="single" selected={kind === value} disabled={loading} onSelect={() => { setKind(value); setTarget(value === 'no_extra_step' ? { kind: 'routine' } : null); setConfirmed(false); }}/>)}</View></QuestionGroup>
   {kind === 'avoid_ingredient' && <QuestionGroup label="Exact ingredient or unresolved term" support="Selecting a reviewed identity is explicit. Similar names and ingredient families are not matched."><TextInput accessibilityLabel="Avoid ingredient term" editable={!loading} value={term} onChangeText={text => { setTerm(text); setTarget(null); setConfirmed(false); }} placeholder="Ingredient name or original term" style={{ borderWidth: 1, borderColor: colors.border, padding: 12 }}/>{choices.filter(i => !term || i.label.toLowerCase().includes(term.toLowerCase())).map(i => <ChoiceChip key={i.id} label={`Choose exact ingredient: ${i.label}`} selectionType="single" selected={target?.kind === 'ingredient' && target.identity.kind === 'resolved' && target.identity.ingredientId === i.id} disabled={loading} onSelect={() => choose({ kind: 'ingredient', identity: { kind: 'resolved', ingredientId: i.id } })}/>)}<Button label="Keep my term unresolved" variant="outline" disabled={loading || !term.trim()} onPress={() => choose({ kind: 'ingredient', identity: { kind: 'unresolved', originalTerm: term } })}/>{target?.kind === 'ingredient' && target.identity.kind === 'unresolved' && <Text>Unresolved original term: {target.identity.originalTerm}. No ingredient identity has been assigned.</Text>}</QuestionGroup>}
   {kind === 'avoid_product' && <QuestionGroup label="Select one of your recorded product references" support="Manual names remain manual. Selecting a product does not confirm its ingredients or formula.">{products.map(p => <ChoiceChip key={p.key} label={`Avoid recorded product: ${p.label}`} selectionType="single" selected={target?.kind === 'product' && JSON.stringify(target.reference) === JSON.stringify(p.reference)} disabled={loading || p.selectable === false} onSelect={() => choose({ kind: 'product', reference: p.reference })}/>)}{products.some(p => p.selectable === false) && <Text>Product names are unavailable for some recorded references. Those choices cannot be newly selected until their names can be read.</Text>}{!products.length && <Text>Add a product to your routine or experience records first. No product is selected by a matching name.</Text>}</QuestionGroup>}
   <QuestionGroup label="How strong is this choice?"><ChoiceChip label="Firm constraint" selectionType="single" selected={strength === 'decisive'} disabled={loading} onSelect={() => { setStrength('decisive'); setConfirmed(false); }}/><ChoiceChip label="Preference, with possible tradeoffs" selectionType="single" selected={strength === 'prefer'} disabled={loading} onSelect={() => { setStrength('prefer'); setConfirmed(false); }}/></QuestionGroup>
   {editing?.source.kind === 'note' && <><Text>This existing preference depends on its original private note unless you adopt it independently.</Text><ChoiceChip label="Adopt independently of the original note" selectionType="single" selected={independent} disabled={loading} onSelect={() => { setIndependent(!independent); setConfirmed(false); }}/></>}
   <ChoiceChip label="I confirm this choice and its strength" selectionType="single" selected={confirmed} disabled={loading} onSelect={() => setConfirmed(!confirmed)}/>
   {error && <Text accessibilityRole="alert">{error}</Text>}
   <Button label={editing ? 'Use confirmed preference edit' : 'Use confirmed preference'} disabled={loading} onPress={() => { try {
            if (!editing && preferences.length >= 20)
                throw Error('Up to 20 confirmed preferences.');
            const value = confirmedPreference({ id: editing?.id ?? createId(), existing: editing ?? undefined, kind, target, strength, confirmed, confirmedAt: now(), independent, dictionaryRelease });
            onChange(editing ? preferences.map(p => p.id === editing.id ? value : p) : [...preferences, value]);
            clearForm();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Review this preference.');
        } }}/>
   <Button label="Cancel preference entry" variant="ghost" disabled={loading} onPress={clearForm}/>
  </View>}
 </View>;
}
