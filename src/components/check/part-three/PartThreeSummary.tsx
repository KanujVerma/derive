import React from 'react';
import { Text, View } from 'react-native';
import type { PartThreeView } from '../../../presentation/part-three/controller';
import { decisionCopy, findingCopy, gapCopy } from '../../../presentation/part-three/copy';
import { colors, spacing, typography } from '../../../constants/theme';
export function PartThreeSummary({ view, identityName }: {
    view: PartThreeView;
    identityName?: string;
}) {
    const r = view.result, copy = r ? decisionCopy(r) : null;
    return <View style={{ gap: spacing.xs }}>
  {view.historical && <View style={{ gap: spacing.xs }}><Text accessibilityRole="header">Assessment when saved</Text><Text>{view.historical.savedAt.slice(0, 10)}</Text>{view.historical.assessmentWhenSaved ? <><Text>{decisionCopy(view.historical.assessmentWhenSaved).name}</Text><Text>{decisionCopy(view.historical.assessmentWhenSaved).label}</Text><Text>{decisionCopy(view.historical.assessmentWhenSaved).reason}</Text><Text>{decisionCopy(view.historical.assessmentWhenSaved).scope}</Text>{view.historical.assessmentWhenSaved.findings.filter(f => f.mandatoryVisibility && f.id !== view.historical!.assessmentWhenSaved!.summary?.primaryFindingId).map(f => <Text key={f.id}>{findingCopy(f)}</Text>)}{view.historical.assessmentWhenSaved.materialGaps.map(g => <Text key={g.id}>{gapCopy(g)}</Text>)}</> : <Text>The earlier personal assessment is no longer available.</Text>}<Text>This records the earlier assessment. Current reassessment is separate.</Text></View>}
  <Text accessibilityRole="header">{view.historical ? 'Current assessment' : 'Personal Fit'}</Text>
  {copy && r?.state === 'ready' && r.summary ? <>{copy.name !== identityName && <Text>{copy.name}</Text>}<Text accessibilityRole="header" style={{ fontSize: typography.sizes.sectionTitle, color: colors.ink }}>{copy.label}</Text><Text>{copy.reason}</Text>{copy.scope && <Text>{copy.scope}</Text>}
    {r.findings.filter(f => f.mandatoryVisibility && f.id !== r.summary!.primaryFindingId).map(f => <Text key={f.id}>{findingCopy(f)}</Text>)}{r.materialGaps.map(g => <Text key={g.id}>{gapCopy(g)}</Text>)}
  </> : <Text>{view.error ?? (view.loading ? 'Preparing your personal Check' : 'Personal assessment unavailable')}</Text>}
  {view.savedAssessmentId && !view.historical && <Text>Assessment saved separately from your product.</Text>}
 </View>;
}
