import { catalogReferenceKey } from '../../../presentation/p0b-personalization/storageAdapter';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Text, View, useWindowDimensions } from 'react-native';
import { Button } from '../../ui/Button';
import { ChoiceChip } from '../../ui/ChoiceChip';
import { QuestionGroup } from '../../ui/QuestionGroup';
import type { usePartThreeCheck } from './usePartThreeCheck';
import { spacing } from '../../../constants/theme';
export function PartThreeControls({ check, section = 'all' }: {
    check: ReturnType<typeof usePartThreeCheck>; section?: 'all' | 'save' | 'details';
}) {
    const [open, setOpen] = useState(false);
    const questionView = useRef<View>(null);
    const {height,width} = useWindowDimensions();
    const questionId = check.view.question?.id;
    const expose = useRef(check.exposeQuestion); expose.current=check.exposeQuestion;
    useEffect(() => {
        if (!questionId || !check.enabled) return;
        let active=true,done=false,announced=false;
        const inspect=()=> {
            if (!active || done || AppState.currentState !== 'active') return;
            questionView.current?.measureInWindow((x,y,w,h)=> {
                if (active && !done && w>0 && h>0 && x<width && x+w>0 && y>=0 && y+Math.min(h,44)<height) done=Boolean(expose.current(questionId));
            });
        };
        // Accessibility exposure is an actual announcement, independent of
        // whether a scrolled visual question is inside the current viewport.
        void AccessibilityInfo.isScreenReaderEnabled().then(enabled=> {
            if (active && enabled && !announced && AppState.currentState==='active') {
                announced=true; AccessibilityInfo.announceForAccessibility('Replace the selected item or add another? This changes whether you are replacing a step or adding one.'); done=Boolean(expose.current(questionId));
            }
        });
        inspect();const timer=setInterval(inspect,250);
        return()=>{active=false;clearInterval(timer);};
    },[questionId,check.enabled,height,width]);
    const { view, choices, context } = check;
    if (!check.enabled)
        return null;
    const current = context?.routine?.data.items.filter(i => i.state === 'current' || i.state === 'occasional') ?? [];
    const label = (item: typeof current[number], _index: number) => {
      if(item.reference.kind==='manual')return item.reference.name;
      const named=check.displayLabels?.[catalogReferenceKey(item.reference)];if(named)return named;
      const answer=(field:{answer:{state:string;value?:string}}|undefined)=>field?.answer.state==='known'?field.answer.value:null;
      const use=[answer(item.reportedPurpose),answer(item.applicationSite),answer(item.useForm)].filter(Boolean).map(v=>v!.replace(/_/g,' ')).join(' · ');
      return `Catalog item ${item.reference.productId} · ${use||'use not recorded'} · ${item.timing==='unknown'?'schedule not recorded':item.timing.toUpperCase()} (name unavailable)`;
    };
    const selectionLabel = (item: typeof current[number], index: number) =>
      `${label(item, index)}${item.state === 'occasional' ? ' · occasional' : ''}`;
    const labelCounts = new Map<string, number>();
    current.forEach((item, index) => {
      const text = selectionLabel(item, index);
      labelCounts.set(text, (labelCounts.get(text) ?? 0) + 1);
    });
    const ambiguous = (item: typeof current[number], index: number) =>
      (labelCounts.get(selectionLabel(item, index)) ?? 0) > 1;
    return <View style={{ gap: spacing.sm }}>
  {section !== 'save' && <>{view.question?.missingInput === 'intent' && <View ref={questionView} collapsable={false}><QuestionGroup label="Replace the selected item or add another?" support="This changes whether you are replacing a step or adding one. Your answer applies to this Check.">
   {([['replace', 'Replace this item'], ['add', 'Add another'], ['unsure', 'Not sure']] as const).map(([value, text]) => <Button key={value} label={text} variant="outline" onPress={() => check.questionAnswer(value)}/>)}
   <Button label="Skip this question for this check" variant="ghost" onPress={check.questionSkip}/>
  </QuestionGroup></View>}
  <Button label={open ? 'Close comparison choices' : 'Compare or describe this check'} variant="ghost" onPress={() => {check.interact();setOpen(!open);}}/>
  {open && <View style={{ gap: spacing.sm }}>
   <Text>These choices apply to this Check. They are not saved as routine use.</Text>
   <QuestionGroup label="What are you deciding?"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{([['add', 'Add to my routine'], ['replace', 'Replace one item'], ['check_current', 'Check a current item'], ['unsure', 'Not sure']] as const).map(([intent, text]) => <ChoiceChip key={intent} label={text} selectionType="single" selected={choices.intent === intent} onSelect={() => check.update({ ...choices, intent, candidateRoutineItemId:intent==='check_current'?choices.candidateRoutineItemId:null })}/>)}</View></QuestionGroup>
   {choices.intent === 'check_current' ? <QuestionGroup label="Which current item is this product?" support="Select the item explicitly. A matching name does not establish product or formula identity.">{current.map((item, index) => <ChoiceChip key={item.id} label={`This is ${selectionLabel(item, index)}`} selectionType="single" selected={choices.candidateRoutineItemId === item.id} disabled={ambiguous(item, index)} onSelect={() => { if (!ambiguous(item, index)) check.update({ ...choices, candidateRoutineItemId: item.id }); }}/>)}</QuestionGroup> : <QuestionGroup label="Compare with one current item" support="Occasional use remains distinct from everyday use.">{current.map((item, index) => <ChoiceChip key={item.id} label={selectionLabel(item, index)} selectionType="single" selected={choices.comparatorId === item.id} disabled={ambiguous(item, index)} onSelect={() => { if (!ambiguous(item, index)) check.update({ ...choices, comparatorId: item.id }); }}/>)}<Button label="No comparator" variant="ghost" onPress={() => check.update({ ...choices, comparatorId: null })}/></QuestionGroup>}
   {[...labelCounts.values()].some(count => count > 1) && <Text>Some saved items have identical display details. Selection is unavailable until they can be distinguished.</Text>}
   {!current.length && <Text>No current routine item has been recorded. Profile setup is optional.</Text>}
   {([['purpose', 'Purpose for this check', [['moisturizing', 'Moisturizing'], ['cleansing', 'Cleansing'], ['sun_protection', 'Sun protection'], ['other', 'Other']]], ['site', 'Application site', [['face', 'Face'], ['body', 'Body'], ['hands', 'Hands'], ['scalp', 'Scalp'], ['lips', 'Lips'], ['eye_area', 'Eye area'], ['other', 'Other']]], ['useForm', 'Use form', [['leave_on', 'Leave on'], ['rinse_off', 'Rinse off'], ['other', 'Other']]]] as const).map(([field, title, options]) => <QuestionGroup key={field} label={title}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{options.map(([value, text]) => <ChoiceChip key={value} label={text} selectionType="single" selected={choices.use[field] === value} onSelect={() => check.update({ ...choices, use: { ...choices.use, [field]: value } })}/>)}<ChoiceChip label={`Not sure: ${title.toLowerCase()}`} selectionType="single" selected={choices.use[field] === null} onSelect={() => check.update({ ...choices, use: { ...choices.use, [field]: null } })}/></View></QuestionGroup>)}
   {context?.experiences.filter(e => e.data.reference.kind === 'manual').map(e => <ChoiceChip key={e.data.id} label={`Use my selected report: ${e.data.reference.kind === 'manual' ? e.data.reference.name : ''}`} selectionType="multiple" selected={choices.selectedManualReportIds.includes(e.data.id)} disabled={!choices.selectedManualReportIds.includes(e.data.id) && choices.selectedManualReportIds.length >= 20} onSelect={() => check.update({ ...choices, selectedManualReportIds: choices.selectedManualReportIds.includes(e.data.id) ? choices.selectedManualReportIds.filter(id => id !== e.data.id) : [...choices.selectedManualReportIds, e.data.id] })}/>)}
  </View>}
  </>}
  {section !== 'details' && <PartThreeSaveControl check={check}/>}
  {section !== 'save' && view.error && !view.pendingSave && <Button label="Refresh personal assessment" variant="ghost" onPress={check.refresh}/>}
 </View>;
}

export function PartThreeSaveControl({check}:{check:ReturnType<typeof usePartThreeCheck>}) {
 const {view}=check;
 if(!check.enabled)return null;
 return (view.pendingSave ? <Button label="Retry Save confirmation" variant="outline" disabled={view.saving} onPress={() => void check.save()}/> : view.result?.summary && <Button label={view.savedAssessmentId ? 'Saved' : 'Save'} variant="brand" disabled={view.saving || Boolean(view.savedAssessmentId)} onPress={() => void check.save()}/>);
}
