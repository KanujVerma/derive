import React, {useState} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PartThreeView } from '../../../presentation/part-three/controller';
import type { PersonalResultV2 } from '../../../contracts/PersonalResultV2';
import { decisionCopy, findingCopy } from '../../../presentation/part-three/copy';
import { colors, spacing, typography } from '../../../constants/theme';
import { VerdictBlock } from '../result-sheet/CheckResultContent';

function AssessmentCard({ result, heading, identityName, savedAt }: {
    result: PersonalResultV2; heading: string; identityName?: string; savedAt?: string;
}) {
    const copy = decisionCopy(result), judgment = result.summary?.judgment;
    const state = result.partFour && result.partFour.decisionState !== 'supported' ? 'unknown' : judgment === 'worth_considering' ? 'good' : judgment === 'check_first' ? 'tradeoffs' : judgment === 'skip' ? 'poor' : 'unknown';
    return <VerdictBlock heading={heading} verdict={{ state, label: copy.label, reason: copy.reason, findings: [] }}
      beforeTitle={<>{savedAt && <Text style={styles.detail}>{savedAt.slice(0, 10)}</Text>}{copy.name !== identityName && <Text style={styles.name}>{copy.name}</Text>}</>}>
      {<Text style={styles.action}>{copy.action ?? 'Review the listed ingredients and confirm the product on your label before trying it.'}</Text>}
      {copy.scope && <Text style={styles.detail}>{copy.scope}</Text>}
      {result.findings.filter(f => f.mandatoryVisibility && f.id !== result.summary?.primaryFindingId).map(f => <Text style={styles.body} key={f.id}>{findingCopy(f)}</Text>)}
    </VerdictBlock>;
}
export function PartThreeSummary({ view, identityName, assessmentView = 'current', onAssessmentViewChange }: {
    view: PartThreeView; identityName?: string; fallback?: React.ReactNode;
    assessmentView?: 'current' | 'saved'; onAssessmentViewChange?: (value: 'current' | 'saved') => void;
}) {
    const [selected,setSelected]=useState<'current'|'saved'>(assessmentView);
    const mode = onAssessmentViewChange ? assessmentView : selected;
    const r = mode === 'saved' && view.historical ? view.historical.assessmentWhenSaved : view.result;
    const ready = r?.state === 'ready' && r.summary;
    return <View style={{ gap: spacing.sm }}>
      {view.historical && <View style={styles.tabs}>{(['current','saved'] as const).map(value =>
        <Pressable key={value} accessibilityRole="button" accessibilityState={{selected:mode===value}}
          accessibilityLabel={value==='current'?'Current Check':'When saved'} onPress={()=>{setSelected(value);onAssessmentViewChange?.(value);}}
          style={[styles.tab, mode===value && styles.selectedTab]}><Text style={{color:mode===value?colors.inkInverse:colors.brand,fontSize:13}}>{value==='current'?'Current Check':'When saved'}</Text></Pressable>)}</View>}
      {ready ? <AssessmentCard result={r} heading="Personal Fit" identityName={identityName} savedAt={mode==='saved'?view.historical?.savedAt:undefined}/>
        : <VerdictBlock heading="Personal Fit" verdict={{state:'unknown',label:view.loading?'Checking Personal Fit':'Check the label first',reason:view.loading?'Your current assessment is loading.':mode==='saved'?'The earlier assessment is unavailable.':'A supported personal decision is unavailable.',findings:[]}}>
          {!view.loading && <Text style={styles.action}>Review the listed ingredients and confirm the product on your label before trying it.</Text>}
        </VerdictBlock>}
      {view.historical && <Text style={styles.detail}>{mode==='saved'?'Assessment when saved · '+view.historical.savedAt.slice(0,10):'Uses your current profile. The saved assessment is unchanged.'}</Text>}
    </View>;
}

const styles = StyleSheet.create({
  tabs: {flexDirection:'row',gap:4,padding:3,borderWidth:1,borderColor:colors.border,borderRadius:9},
  tab: {flex:1,minHeight:38,alignItems:'center',justifyContent:'center',borderRadius:6}, selectedTab: {backgroundColor:colors.brand},
  action: {color:colors.brand,fontSize:13,lineHeight:20,fontWeight:'600',borderTopWidth:1,borderTopColor:colors.border,paddingTop:12},
  name: { color: colors.ink, fontSize: typography.sizes.bodyLarge, lineHeight: typography.lineHeights.bodyLarge, fontWeight: typography.weights.semibold },
  body: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  detail: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
});
