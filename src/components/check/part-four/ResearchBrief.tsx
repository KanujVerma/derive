import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../../constants/theme';
import { admitResearchBrief, researchBriefSourceKind, type ResearchBriefSubject } from '../../../domain/part-four/researchBrief';
import { partFourDisplayText } from '../../../presentation/part-four/sections';

export interface ResearchBriefProps {
  brief: unknown;
  expectedSubject: ResearchBriefSubject | null;
  state?: 'pending' | 'unavailable' | 'ready' | 'conflict';
  now?: number;
  withdrawn?: boolean;
  withdrawnDependencies?: readonly string[];
  allowLocalFixture?: boolean;
  onViewSources?: () => void;
}

function currentBrief(props: ResearchBriefProps) {
  const now = props.now ?? Date.now();
  if (props.withdrawn || !props.expectedSubject || props.state !== undefined && props.state !== 'ready' ||
    !Number.isFinite(now) || Math.abs(now) > 8.64e15) return null;
  return admitResearchBrief(props.brief, { now: new Date(now).toISOString(), expectedSubject: props.expectedSubject,
    withdrawnDependencies: props.withdrawnDependencies, allowLocalFixture: props.allowLocalFixture });
}

/** The human-approved observation is rendered verbatim as inert text. This view
 * neither acquires sources nor generates a summary, recommendation or counts. */
export function ResearchBrief(props: ResearchBriefProps) {
  const brief = currentBrief(props);
  if (!brief) return <Text accessibilityLiveRegion="polite" style={styles.caption}>{
    props.state === 'pending' && !props.withdrawn ? 'Selected-source reports are being checked.'
      : props.state === 'conflict' && !props.withdrawn ? 'Selected sources disagree; a checked brief is unavailable.'
        : 'Selected-source reports are unavailable.'
  }</Text>;
  return <View style={styles.brief}>
    <Text accessibilityRole="header" style={styles.heading}>What people report</Text>
    {brief.reviewDecision === 'approved_local_fixture' && <Text style={styles.caption}>Synthetic validation example · Not market evidence.</Text>}
    {brief.observations.map(observation => <View key={observation.id} style={styles.observation}>
      {observation.kind === 'editorial_observation' && <Text style={styles.sourceLabel}>Editorial observation</Text>}
      <Text selectable style={styles.copy}>{partFourDisplayText(observation.text)}</Text>
    </View>)}
    {brief.sources.length === 1 && <Text style={styles.caption}>One selected source · Broader source coverage is unavailable.</Text>}
    <Text style={styles.caption}>{partFourDisplayText(brief.coverageLimit)}</Text>
    <View style={styles.footer}>
      <Text style={styles.caption}>Based on selected sources</Text>
      {props.onViewSources && <Pressable accessibilityRole="button" accessibilityLabel="View research brief sources"
        onPress={props.onViewSources} style={styles.sourceButton}><Text style={styles.link}>View sources</Text></Pressable>}
    </View>
  </View>;
}

/** Shares the containing sheet's one Sources disclosure. No separate cached
 * source list or expansion state can outlive the current admitted artifact. */
export function ResearchBriefSources(props: ResearchBriefProps) {
  const brief = currentBrief(props);
  if (!brief) return null;
  return <View style={styles.sourceList}>
    <Text style={styles.sourceHeading}>Selected report sources</Text>
    <Text style={styles.caption}>{`Reviewed ${brief.reviewedAt.slice(0, 10)} · Valid through ${brief.validUntil.slice(0, 10)}`}</Text>
    <Text style={styles.caption}>{partFourDisplayText(brief.coverageLimit)}</Text>
    {brief.sources.map((source, index) => <View key={source.id} style={styles.sourceEntry}>
      <Text style={styles.sourceLabel}>{researchBriefSourceKind(source)}</Text>
      <Text selectable style={styles.caption}>{partFourDisplayText(source.url)}</Text>
      <Text style={styles.caption}>{`Retrieved ${source.retrievedAt.slice(0, 10)}${source.publishedAt ? ` · Published ${source.publishedAt.slice(0, 10)}` : ' · Publication date unavailable'}`}</Text>
      <Text style={styles.caption}>{source.matching === 'exact_formula' ? 'Matched product, variant and formula' : 'Matched product and variant · Formula applicability is not established'}</Text>
      <Text style={styles.caption}>{partFourDisplayText(source.coverageLimit)}</Text>
      <Pressable accessibilityRole="link" accessibilityLabel={`Open research brief source ${index + 1}`} onPress={() => {
        void Linking.openURL(source.url).catch(() => {});
      }} style={styles.sourceButton}><Text style={styles.link}>Open source</Text></Pressable>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  brief: { marginTop: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600', letterSpacing: -0.3, color: colors.ink },
  copy: { fontSize: 14, lineHeight: 23, color: colors.ink, flexShrink: 1 },
  caption: { fontSize: 13, lineHeight: 21, color: colors.inkMuted, flexShrink: 1 },
  observation: { gap: 4 },
  sourceLabel: { fontSize: 12, lineHeight: 20, fontWeight: '600', color: colors.inkMuted },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  sourceButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontSize: 13, lineHeight: 21, color: colors.brand, textDecorationLine: 'underline' },
  sourceList: { gap: spacing.sm },
  sourceEntry: { gap: 4, paddingBottom: spacing.sm },
  sourceHeading: { fontSize: 14, lineHeight: 22, fontWeight: '600', color: colors.ink },
});
