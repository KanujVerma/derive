import React from 'react';
import { View, Text, TextInput } from 'react-native';
import type { ContextDraft } from '../../presentation/p0b-personalization/draft';
import { parseSpendingAmount } from '../../presentation/p0b-personalization/spendingInput';
import { ChoiceChip } from '../ui/ChoiceChip';
import { QuestionGroup } from '../ui/QuestionGroup';
import { colors, spacing } from '../../constants/theme';
export interface SpendingInput { amount:string;currency:string;scope:'per_product'|'routine';period:'purchase'|'month' }
export function StructuredPreferenceFields({draft,onChange,disabled,input,onInput}:{draft:ContextDraft;onChange:(patch:Partial<ContextDraft>)=>void;disabled:boolean;input:SpendingInput;onInput:(patch:Partial<SpendingInput>)=>void}){
 const {amount,currency,scope,period}=input;
 const setAmount=(amount:string)=>onInput({amount});
 const setCurrency=(currency:string)=>onInput({currency});
 const setScope=(scope:'per_product'|'routine')=>onInput({scope});
 const setPeriod=(period:'purchase'|'month')=>onInput({period});
 const saveBudget=(raw:string,nextCurrency=currency,nextScope=scope,nextPeriod=period)=>{const value=parseSpendingAmount(raw);onChange({spendingPreference:value===null?{state:'unanswered'}:{state:'answered',value:{amountMinor:value,currency:nextCurrency,scope:nextScope,period:nextPeriod}}});};
 const choices={gap:spacing.xs,flexDirection:'row' as const,flexWrap:'wrap' as const};
 return <View style={{gap:spacing.md}}>
  <QuestionGroup label="What feel do you prefer?" support="A preference, not a prediction of how a product will feel."><View style={choices}>
   {([['lightweight','Lightweight'],['rich','Rich'],['no_preference','No preference']] as const).map(([value,label])=><ChoiceChip key={value} label={label} selectionType="single" disabled={disabled} selected={draft.texturePreference?.state==='answered'&&draft.texturePreference.value===value} onSelect={()=>onChange({texturePreference:{state:'answered',value}})}/>)}
   {(['unsure','unanswered','withheld'] as const).map(state=><ChoiceChip key={state} label={state==='unsure'?'Not sure about feel':state==='withheld'?'Keep feel preference private':'Leave feel unanswered'} selectionType="single" disabled={disabled} selected={(draft.texturePreference?.state??'unanswered')===state} onSelect={()=>onChange({texturePreference:{state}})}/>)}
  </View></QuestionGroup>
  <QuestionGroup label="Spending limit (optional)" support="Price can break a close tie. A lower price does not erase a meaningful supported benefit.">
   <View style={choices}>{(['USD','EUR','GBP'] as const).map(value=><ChoiceChip key={value} label={value} selectionType="single" disabled={disabled} selected={currency===value} onSelect={()=>{setCurrency(value);saveBudget(amount,value);}}/>)}</View>
   <TextInput accessibilityLabel="Spending amount" keyboardType="decimal-pad" editable={!disabled} value={amount} placeholder="Amount, such as 25.00" onChangeText={value=>{if(disabled)return;setAmount(value);saveBudget(value);}} style={{color:colors.ink,padding:spacing.sm}}/>
   {amount.trim()&&parseSpendingAmount(amount)===null?<Text accessibilityRole="alert">Use a non-negative amount with up to two decimal places.</Text>:null}
   <View style={choices}>{([['per_product','Per product'],['routine','Whole routine']] as const).map(([value,label])=><ChoiceChip key={value} label={label} selectionType="single" disabled={disabled} selected={scope===value} onSelect={()=>{setScope(value);saveBudget(amount,currency,value);}}/>)}</View>
   <View style={choices}>{([['purchase','Per purchase'],['month','Per month']] as const).map(([value,label])=><ChoiceChip key={value} label={label} selectionType="single" disabled={disabled} selected={period===value} onSelect={()=>{setPeriod(value);saveBudget(amount,currency,scope,value);}}/>)}</View>
   <View style={choices}>{(['unsure','unanswered','withheld'] as const).map(state=><ChoiceChip key={state} label={state==='unsure'?'Not sure of spending limit':state==='withheld'?'Keep spending limit private':'Leave spending unanswered'} selectionType="single" disabled={disabled} selected={(draft.spendingPreference?.state??'unanswered')===state} onSelect={()=>{setAmount('');onChange({spendingPreference:{state}});}}/>)}</View>
  </QuestionGroup>
 </View>;
}
