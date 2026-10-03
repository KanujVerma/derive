import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DecisionNextStep } from '../../../contracts/PersonalDecision';
import type { CustomerCheckFacts } from '../../../presentation/personal-decision/customerController';
import { describePersonalDecision } from '../../../presentation/personal-decision/result';
import { describeCheckResultContent, type CheckResultContentInput } from '../../../presentation/check/result-sheet/content';
import { describeCheckVerdict, type ResultFinding, type VerdictPresentation } from '../../../presentation/check/result-sheet/verdict';
import { colors, layout, radii, spacing, typography } from '../../../constants/theme';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';

export interface CheckResultContentProps {
  input: CheckResultContentInput; expanded?: boolean; continuous?: boolean; showIdentity?: boolean;
  section?: 'summary' | 'findings' | 'all'; onNextStep?: (step: DecisionNextStep) => void;
  onPersonalize?: () => void; onOpenSource?: (url: string) => void;
}
const tones = {
  good: { ...colors.actionKeep, icon: 'checkCircle' as IconName }, tradeoffs: { ...colors.actionReview, icon: 'warning' as IconName },
  poor: { ...colors.actionStop, icon: 'close' as IconName },
  unknown: { text: colors.inkMuted, bg: colors.surfaceMuted, border: colors.borderStrong, icon: 'info' as IconName },
};
function SourceDisclosure({ finding, onSource }: { finding: ResultFinding; onSource?: () => void }) {
  const [open, setOpen] = useState(false);
  if (finding.evidence.length === 0 && !onSource) return null;
  return <View>
    <Pressable onPress={() => setOpen(value => !value)} style={styles.sourceControl} accessibilityRole="button"
      accessibilityLabel={`${open ? 'Hide' : 'Show'} sources for ${finding.title}`} accessibilityState={{ expanded: open }}>
      <Text style={styles.link}>Source</Text><Icon name={open ? 'up' : 'down'} size={15} color={colors.brand} />
    </Pressable>
    {open && <View style={styles.evidence}>
      {finding.evidence.map((item, index) => <View key={index}><Text style={styles.evidenceLabel}>{item.label}</Text><Text style={styles.detail}>{item.detail}</Text></View>)}
      {onSource && <Pressable accessibilityRole="link" accessibilityLabel={`View product source for ${finding.title}`} onPress={onSource} style={styles.sourceControl}><Text style={styles.link}>Product source</Text></Pressable>}
    </View>}
  </View>;
}
function FindingCard({ finding, onSource }: { finding: ResultFinding; onSource?: () => void }) {
  return <View style={styles.finding}>
    <Text style={styles.findingTitle} accessibilityRole="header">{finding.title}</Text>
    <Text style={styles.body}>{finding.reason}</Text>
    {finding.limits.map((limit, index) => <Text key={index} style={styles.detail}>{limit}</Text>)}
    <SourceDisclosure finding={finding} onSource={onSource} />
  </View>;
}
function VerdictBlock({ verdict }: { verdict: VerdictPresentation }) {
  const tone = tones[verdict.state];
  return <View style={styles.fitBlock}><Text style={styles.eyebrow}>PERSONAL FIT</Text>
    <View style={[styles.verdict, { backgroundColor: tone.bg, borderColor: tone.border }]} accessibilityLiveRegion="polite">
      <View style={styles.verdictTitleRow}><Icon name={tone.icon} size={22} color={tone.text} />
        <Text style={[styles.verdictTitle, { color: tone.text }]} accessibilityRole="header">{verdict.label}</Text></View>
      <Text style={styles.reason}>{verdict.reason}</Text>
    </View>
  </View>;
}
/** Same rendering for bound live content and explicitly labeled development semantic examples. */
export function CheckResultView({ facts, verdict, section = 'all', showIdentity = true, identityImage, onOpenSource, children }: {
  facts: CustomerCheckFacts; verdict: VerdictPresentation; section?: 'summary' | 'findings' | 'all';
  showIdentity?: boolean; identityImage?: React.ReactNode; onOpenSource?: (url: string) => void; children?: React.ReactNode;
}) {
  const category = facts.categoryLabel === 'Product formula evidence' ? '' : facts.categoryLabel;
  const source = facts.formula?.provenanceType;
  const sourceLabel = source === 'manufacturer' ? 'Brand formula' : source === 'package_label' ? 'Package label'
    : source === 'regulator' ? 'Regulatory label' : source === 'founder_review' ? 'Reviewed product record' : 'Product listing';
  const productCard: ResultFinding | null = facts.formula || facts.source ? { id: 'product-facts', title: facts.formula ? 'Package formula' : 'Product details',
    reason: facts.formula ? 'The ingredient list has been verified for this package.' : category ? `Recorded category: ${category}.` : 'A product listing is available.',
    evidence: [{ label: sourceLabel, detail: facts.formula ? facts.formula.ingredients.join(', ') : 'A listing does not verify the ingredient list in your package.' }], limits: [] } : null;
  return <View style={styles.content}>
    {section !== 'findings' && <View style={styles.summary}>
      {showIdentity && <View style={styles.identityRow}>{identityImage ?? <View style={styles.placeholder}><Icon name="bottle" size={24} color={colors.brand} /></View>}
        <View style={styles.identity}>{facts.brand ? <Text style={styles.brand}>{facts.brand}</Text> : null}
          <Text style={styles.productName} accessibilityRole="header">{facts.name}</Text>{category ? <Text style={styles.brand}>{category}</Text> : null}</View>
      </View>}
      <VerdictBlock verdict={verdict} />
    </View>}
    {section !== 'summary' && <View style={styles.findings}>
      {verdict.findings.map(finding => <FindingCard key={finding.id} finding={finding} />)}
      {productCard && <FindingCard finding={productCard} onSource={facts.source && onOpenSource ? () => onOpenSource(facts.source!) : undefined} />}{children}
    </View>}
  </View>;
}
/** Snapshot/owner/revision checks precede the live render. The view does not establish truth. */
export function CheckResultContent({ input, section = 'all', showIdentity = true, onNextStep, onPersonalize, onOpenSource }: CheckResultContentProps) {
  const model = describeCheckResultContent(input);
  const view = model.fit.kind === 'canonical' ? describePersonalDecision(model.fit.packet, model.fit.expectedBinding) : null;
  return <CheckResultView facts={model.facts} verdict={describeCheckVerdict(input)} section={section} showIdentity={showIdentity} onOpenSource={onOpenSource}>
    {view?.kind === 'ready' && onNextStep && <Button label={view.nextStepLabel} variant="secondary" onPress={() => onNextStep(view.nextStep)} />}
    {!onNextStep && model.canPersonalize && onPersonalize && <Button label="Add relevant context" variant="secondary" onPress={onPersonalize} />}
    {input.fit.kind === 'preview_unavailable' && <Text style={styles.detail}>Development preview. No personal assessment is saved.</Text>}
  </CheckResultView>;
}
const styles = StyleSheet.create({
  content: { gap: spacing.lg }, summary: { gap: spacing.lg }, identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  placeholder: { width: 48, height: 54, borderRadius: radii.md, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, minWidth: 0, gap: spacing.xxs }, brand: { color: colors.inkMuted, fontSize: typography.sizes.caption },
  productName: { color: colors.ink, fontSize: typography.sizes.bodyLarge, lineHeight: typography.lineHeights.bodyLarge, fontWeight: typography.weights.semibold },
  fitBlock: { gap: spacing.xs }, eyebrow: { color: colors.inkMuted, fontSize: typography.sizes.micro, letterSpacing: 1.1, fontWeight: typography.weights.semibold },
  verdict: { borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm }, verdictTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  verdictTitle: { flex: 1, fontSize: typography.sizes.sectionTitle, lineHeight: typography.lineHeights.sectionTitle, fontWeight: typography.weights.semibold },
  reason: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular }, findings: { gap: spacing.md },
  finding: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.xs },
  findingTitle: { color: colors.ink, fontSize: typography.sizes.bodyLarge, lineHeight: typography.lineHeights.bodyLarge, fontWeight: typography.weights.semibold },
  body: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  sourceControl: { minHeight: layout.minTouchTarget, minWidth: layout.minTouchTarget, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  link: { color: colors.brand, fontSize: typography.sizes.caption, fontWeight: typography.weights.medium }, evidence: { gap: spacing.sm },
  evidenceLabel: { color: colors.ink, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold },
  detail: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
});
