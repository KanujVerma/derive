import React, {useState} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PartThreeView } from '../../../presentation/part-three/controller';
import type { PersonalResultV2 } from '../../../contracts/PersonalResultV2';
import { decisionCopy, findingCopy, gapCopy } from '../../../presentation/part-three/copy';
import { colors, spacing, typography } from '../../../constants/theme';
import { VerdictBlock } from '../result-sheet/CheckResultContent';

function AssessmentCard({ result, heading, identityName, savedAt, disclosure, setDisclosure }: {
    result: PersonalResultV2; heading: string; identityName?: string; savedAt?: string; disclosure: string | null; setDisclosure(value:string|null):void;
}) {
    const disclosureKey=heading+':'+result.resultId;
    const detailsOpen=disclosure===disclosureKey;
    const copy = decisionCopy(result), judgment = result.summary?.judgment;
    const state = result.partFour && result.partFour.decisionState !== 'supported' ? 'unknown' : judgment === 'worth_considering' ? 'good' : judgment === 'check_first' ? 'tradeoffs' : judgment === 'skip' ? 'poor' : 'unknown';
    return <VerdictBlock heading={heading} verdict={{ state, label: copy.label, reason: copy.reason, findings: [] }}
      beforeTitle={<>{savedAt && <Text style={styles.detail}>{savedAt.slice(0, 10)}</Text>}{copy.name !== identityName && <Text style={styles.name}>{copy.name}</Text>}</>}>
      {copy.action && <Text style={styles.body}>{copy.action}</Text>}
      {copy.scope && <Text style={styles.detail}>{copy.scope}</Text>}
      {result.findings.filter(f => f.mandatoryVisibility && f.id !== result.summary?.primaryFindingId).map(f => <Text style={styles.body} key={f.id}>{findingCopy(f)}</Text>)}
      {result.materialGaps.length>0 && <Pressable accessibilityRole="button" accessibilityLabel="Why this Check is limited" accessibilityState={{expanded:detailsOpen}} onPress={()=>setDisclosure(detailsOpen?null:disclosureKey)}><Text style={styles.detail}>Why this Check is limited</Text></Pressable>}
      {detailsOpen && result.materialGaps.filter(g => gapCopy(g) !== copy.reason).map(g => <Text style={styles.body} key={g.id}>{gapCopy(g)}</Text>)}
    </VerdictBlock>;
}
export function PartThreeSummary({ view, identityName, fallback }: {
    view: PartThreeView;
    identityName?: string;
    fallback?: React.ReactNode;
}) {
    const [disclosure,setDisclosure]=useState<string|null>(null);
    const r = view.result;
    return <View style={{ gap: spacing.xs }}>
  {view.historical && <View style={{ gap: spacing.xs }}>{view.historical.assessmentWhenSaved ? <AssessmentCard disclosure={disclosure} setDisclosure={setDisclosure} result={view.historical.assessmentWhenSaved} heading="Assessment when saved" identityName={identityName} savedAt={view.historical.savedAt} /> : <><Text accessibilityRole="header" style={styles.name}>Assessment when saved</Text><Text style={styles.detail}>{view.historical.savedAt.slice(0, 10)}</Text><Text style={styles.body}>The earlier personal assessment is no longer available.</Text></>}<Text style={styles.detail}>This records the earlier assessment. Current reassessment is separate.</Text></View>}
  {r?.state === 'ready' && r.summary ? <AssessmentCard disclosure={disclosure} setDisclosure={setDisclosure} result={r} heading={view.historical ? 'Current assessment' : r.partFour ? 'Your Check' : 'Personal Fit'} identityName={identityName} />
    : fallback ?? <VerdictBlock heading={view.historical ? 'Current assessment' : 'Personal Fit'} verdict={{ state: 'unknown', label: view.error ?? (view.loading ? 'Preparing your personal Check' : 'Personal assessment unavailable'), reason: '', findings: [] }} />}
  {view.savedAssessmentId && !view.historical && <Text style={styles.detail}>Assessment saved separately from your product.</Text>}
 </View>;
}

const styles = StyleSheet.create({
  name: { color: colors.ink, fontSize: typography.sizes.bodyLarge, lineHeight: typography.lineHeights.bodyLarge, fontWeight: typography.weights.semibold },
  body: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  detail: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
});
