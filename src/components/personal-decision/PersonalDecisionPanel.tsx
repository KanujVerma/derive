import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { colors, layout, radii, spacing, typography } from '@/src/constants/theme';
import type { DecisionBinding, DecisionNextStep } from '@/src/contracts/PersonalDecision';
import { decisionPage } from '@/src/presentation/personal-decision/disclosure';
import type { DecisionDetailGroup } from '@/src/presentation/personal-decision/disclosure';
import type { PersonalDecisionView } from '@/src/presentation/personal-decision/result';
import { describePersonalDecision } from '@/src/presentation/personal-decision/result';

export interface PersonalDecisionPanelProps {
  packet: unknown;
  /** Independently loaded by authenticated composition; never copied from packet. */
  expectedBinding: DecisionBinding;
  onNextStep?: (step: DecisionNextStep) => void;
  /** Shared result owns the surface and its supporting disclosure. Defaults preserve existing callers. */
  embedded?: boolean;
  expanded?: boolean;
}

/** Standalone evidence-bound surface; current Check integration remains separately owned. */
export function PersonalDecisionPanel({ packet, expectedBinding, onNextStep, embedded = false, expanded = true }: PersonalDecisionPanelProps) {
  const view = describePersonalDecision(packet, expectedBinding);
  if (view.kind === 'unavailable') {
    return <View style={embedded ? styles.embedded : styles.panel} accessibilityLiveRegion="polite">
      {embedded ? <SectionHeader title="Personal Fit" /> : <Text style={styles.eyebrow}>PERSONAL DECISION</Text>}
      <Text style={styles.title} accessibilityRole="header">{view.title}</Text>
      <Text style={styles.body}>{view.message}</Text>
    </View>;
  }
  return <ReadyDecisionPanel key={view.presentationKey} view={view} onNextStep={onNextStep} embedded={embedded} expanded={expanded} />;
}
function ReadyDecisionPanel({ view, onNextStep, embedded, expanded }: { view: Extract<PersonalDecisionView, { kind: 'ready' }>; onNextStep?: (step: DecisionNextStep) => void; embedded: boolean; expanded: boolean }) {
  const [showWhy, setShowWhy] = useState(false);
  const [groupPage, setGroupPage] = useState(0);
  const [evidencePages, setEvidencePages] = useState<Record<number, number | undefined>>({});
  const [reviewCautions, setReviewCautions] = useState(false);
  const [cautionPage, setCautionPage] = useState(0);
  const additionalCautions = embedded ? [] : view.secondaryCautions.slice(1);
  const cautions = decisionPage(additionalCautions, cautionPage, 3);
  // A specific unknown stated as the primary reason is already visible, including blockers.
  const additionalUnknowns = view.unknowns.filter((unknown) => unknown.text !== view.primaryReason);
  const criticalUnknowns = additionalUnknowns.filter((unknown) => unknown.critical);
  const otherUnknowns = additionalUnknowns.filter((unknown) => !unknown.critical);
  // Every blocker remains expanded. Additional non-critical detail uses the disclosure.
  const visibleUnknowns = [...criticalUnknowns, ...otherUnknowns.slice(0, 1)];
  return <View style={embedded ? styles.embedded : styles.panel} accessibilityLiveRegion="polite">
    {embedded ? <SectionHeader title="Personal Fit" /> : <Text style={styles.eyebrow}>PERSONAL DECISION</Text>}
    <Text style={styles.title} accessibilityRole="header">{view.title}</Text>
    <Text style={styles.reason}>{view.primaryReason}</Text>
    {view.criticalCautions.map((text, index) => <Text key={`critical-${index}`} style={styles.caution}>{text}</Text>)}
    {(embedded ? view.secondaryCautions : view.secondaryCautions.slice(0, 1)).map((text, index) => <Text key={`secondary-${index}`} style={styles.caution}>{text}</Text>)}
    {additionalCautions.length > 0 && <>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: reviewCautions }} style={styles.disclosure}
        onPress={() => setReviewCautions(!reviewCautions)}>
        <Text style={styles.disclosureText}>{reviewCautions ? 'Hide additional cautions' : `Review ${additionalCautions.length} additional cautions`}</Text>
      </Pressable>
      {reviewCautions && <View>
        {cautions.items.map((text, index) => <Text key={`extra-caution-${index}`} style={styles.caution}>{text}</Text>)}
        <PageNavigation page={cautions} label="cautions" onPage={setCautionPage} />
      </View>}
    </>}
    {expanded && view.routineImpacts.length > 0 && <View style={styles.section}>
      <Text style={styles.label}>In your routine</Text>
      {view.routineImpacts.map((text, index) => <Text key={`impact-${index}`} style={styles.body}>{text}</Text>)}
    </View>}
    {visibleUnknowns.length > 0 && <View style={styles.section}>
      <Text style={styles.label}>What is uncertain</Text>
      {visibleUnknowns.map((unknown, index) => <Text key={`unknown-${index}`} style={styles.body}>{unknown.text}</Text>)}
    </View>}
    {onNextStep && <Button label={view.nextStepLabel} variant="brand" size="large"
      onPress={() => onNextStep(view.nextStep)} style={styles.action} />}
    {expanded && <Pressable onPress={() => setShowWhy(!showWhy)} accessibilityRole="button"
      accessibilityLabel={showWhy ? 'Hide why Derive thinks this' : 'Why Derive thinks this'}
      accessibilityState={{ expanded: showWhy }} style={styles.disclosure}>
      <Text style={styles.disclosureText}>{showWhy ? 'Hide details' : 'Why Derive thinks this'}</Text>
    </Pressable>}
    {expanded && showWhy && <View style={styles.details}>
      <DecisionDisclosure groups={view.detailGroups} page={groupPage} evidencePages={evidencePages}
        onPage={page => { setGroupPage(page); setEvidencePages({}); }}
        onEvidencePage={(index, page) => setEvidencePages(current => ({ ...current, [index]: page }))} />
      {otherUnknowns.slice(1).map((unknown, index) => <Text key={`more-unknown-${index}`} style={styles.detailText}>{unknown.text}</Text>)}
      <Text style={styles.evidence}>Evaluation {view.versions.engine} · Policy {view.versions.policy}</Text>
    </View>}
  </View>;
}

/** Pure controlled disclosure: only one group page and one evidence page per opened group mount. */
export function DecisionDisclosure({ groups, page, evidencePages, onPage, onEvidencePage }: {
  groups: DecisionDetailGroup[]; page: number; evidencePages: Record<number, number | undefined>;
  onPage: (page: number) => void; onEvidencePage: (group: number, page: number | undefined) => void;
}) {
  const selected = decisionPage(groups, page);
  return <View>
    <PageNavigation page={selected} label="reasons" onPage={onPage} />
    {selected.items.map((group, localIndex) => {
      const index = selected.start - 1 + localIndex;
      const evidencePage = evidencePages[index], expanded = evidencePage !== undefined;
      const evidence = decisionPage(group.evidence, evidencePage ?? 0);
      return <View key={index} style={styles.detail} testID="decision-reason-group">
        <Text style={styles.detailText}>{group.reason}</Text>
        <Text style={styles.evidence}>{group.findingIds.length} linked findings</Text>
        {group.evidence.length > 0 && <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
          accessibilityLabel={`${expanded ? 'Hide' : 'Review'} evidence for reason ${index + 1}`} style={styles.disclosure}
          onPress={() => onEvidencePage(index, expanded ? undefined : 0)}>
          <Text style={styles.disclosureText}>{expanded ? 'Hide evidence' : `Review ${group.evidence.length} evidence records`}</Text>
        </Pressable>}
        {expanded && <View>
          {evidence.items.map((row, position) => <Text key={position} testID="decision-evidence-record" style={styles.evidence}>{row.label}</Text>)}
          <PageNavigation page={evidence} label="evidence records" onPage={page => onEvidencePage(index, page)} />
        </View>}
      </View>;
    })}
  </View>;
}
function PageNavigation({ page, label, onPage }: { page: ReturnType<typeof decisionPage>; label: string; onPage: (page: number) => void }) {
  return <View>
    <Text style={styles.evidence}>{page.start} to {page.end} of {page.total} {label}</Text>
    <View style={styles.navigation}>
      {page.previous && <Button label={`Previous ${label}`} size="medium" variant="outline" onPress={() => onPage(page.page - 1)} />}
      {page.next && <Button label={`Show more ${label}`} size="medium" variant="outline" onPress={() => onPage(page.page + 1)} />}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  embedded: {},
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg },
  eyebrow: { color: colors.brand, fontSize: typography.sizes.micro, fontWeight: typography.weights.bold, letterSpacing: 1 },
  title: { color: colors.ink, fontSize: typography.sizes.sectionTitle, lineHeight: typography.lineHeights.sectionTitle,
    fontWeight: typography.weights.semibold, marginTop: spacing.sm },
  reason: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, marginTop: spacing.xs },
  body: { color: colors.inkMuted, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, marginTop: spacing.xxs },
  caution: { color: colors.actionReview.text, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular, marginTop: spacing.sm },
  section: { marginTop: spacing.md },
  label: { color: colors.ink, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold },
  action: { marginTop: spacing.lg },
  disclosure: { minHeight: layout.minTouchTarget, justifyContent: 'center', alignSelf: 'stretch', marginTop: spacing.xs },
  disclosureText: { color: colors.brand, fontSize: typography.sizes.bodyRegular, fontWeight: typography.weights.medium },
  details: { borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm, gap: spacing.sm },
  detail: { gap: spacing.xxs, marginTop: spacing.sm },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  detailText: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  evidence: { color: colors.inkMuted, fontSize: typography.sizes.micro, lineHeight: typography.lineHeights.micro },
});
