import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PartThreeView } from '../../../presentation/part-three/controller';
import type { PersonalResultV2 } from '../../../contracts/PersonalResultV2';
import { decisionCopy, findingCopy } from '../../../presentation/part-three/copy';
import { colors, spacing, typography } from '../../../constants/theme';
import { VerdictBlock } from '../result-sheet/CheckResultContent';

function AssessmentCard({ result, heading, identityName }: {
    result: PersonalResultV2; heading: string; identityName?: string;
}) {
    const copy = decisionCopy(result), judgment = result.summary?.judgment;
    const state = result.partFour && result.partFour.decisionState !== 'supported' ? 'unknown' : judgment === 'worth_considering' ? 'good' : judgment === 'check_first' ? 'tradeoffs' : judgment === 'skip' ? 'poor' : 'unknown';
    return <VerdictBlock heading={heading} verdict={{ state, label: copy.label, reason: copy.reason, findings: [] }}
      beforeTitle={copy.name !== identityName ? <Text style={styles.name}>{copy.name}</Text> : undefined}>
      {<Text style={styles.action}>{copy.action ?? 'Review the listed ingredients and confirm the product on your label before trying it.'}</Text>}
      {copy.scope && <Text style={styles.detail}>{copy.scope}</Text>}
      {result.findings.filter(f => f.mandatoryVisibility && f.id !== result.summary?.primaryFindingId).map(f => <Text style={styles.body} key={f.id}>{findingCopy(f)}</Text>)}
    </VerdictBlock>;
}
export function PartThreeSummary({ view, identityName }: {
    view: PartThreeView; identityName?: string; fallback?: React.ReactNode;
}) {
    const r = view.historical ? view.historical.assessmentWhenSaved : view.result;
    const ready = r?.state === 'ready' && r.summary;
    return <View style={{ gap: spacing.sm }}>
      {ready ? <AssessmentCard result={r} heading="Personal Fit" identityName={identityName}/>
        : <VerdictBlock heading="Personal Fit" verdict={{state:'unknown',label:view.loading?'Checking Personal Fit':'Check the label first',reason:view.loading?'Your assessment is loading.':view.historical?'The saved assessment is unavailable.':'A supported personal decision is unavailable.',findings:[]}}>
          {!view.loading && <Text style={styles.action}>Review the listed ingredients and confirm the product on your label before trying it.</Text>}
        </VerdictBlock>}
    </View>;
}

const styles = StyleSheet.create({
  action: {color:colors.brand,fontSize:13,lineHeight:20,fontWeight:'600',borderTopWidth:1,borderTopColor:colors.border,paddingTop:12},
  name: { color: colors.ink, fontSize: typography.sizes.bodyLarge, lineHeight: typography.lineHeights.bodyLarge, fontWeight: typography.weights.semibold },
  body: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  detail: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
});
