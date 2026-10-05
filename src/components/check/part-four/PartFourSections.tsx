import React, { useState, useRef } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PartFourInsight, PartFourPacket } from '../../../contracts/PartFour';
import { colors, spacing } from '../../../constants/theme';
import { isOpenBeautyFactsSource, OBF_SOURCE_METHOD_URL } from '../../../presentation/part-one/sourceReuse';
import type { ResearchBriefSubject } from '../../../domain/part-four/researchBrief';
import { ResearchBriefSources } from './ResearchBrief';
import { RetainedEvidence, RetainedEvidenceSources } from './RetainedEvidence';
import { authorizedPartFourPacket, formulaEvidenceNotice, formulaLimitationsForDisplay, formulaScope, ingredientRow, ingredientSectionHeading,
  ingredientTargets, partFourDisclosureKey, partFourDisplayText, safePartFourSourceUrl, visiblePartFourInsights,
  type PartFourRenderFence } from '../../../presentation/part-four/sections';

export interface PartFourSectionsProps extends PartFourRenderFence {
  /** Already authorized by the result owner. This component never acquires data. */
  packet: PartFourPacket | null;
  loading?: boolean;
  expandedOccurrenceId?: string | null;
  sourcesExpanded?: boolean;
  onIngredientToggle?: (occurrenceId: string | null) => void;
  onSourcesToggle?: (expanded: boolean) => void;
  /** Owner may scroll its sheet to this exact row; expansion also works locally. */
  onIngredientJump?: (occurrenceId: string, measuredY?:number) => void;
  onIngredientLayout?: (occurrenceId: string, y: number) => void;
  /** Current canonical product truth, never taken from the brief itself. */
  researchSubject?: ResearchBriefSubject | null;
  researchWithdrawnDependencies?: readonly string[];
  allowLocalResearchFixture?: boolean;
}

/** v7 section hierarchy, with server copy in place of fictional design inputs.
 * Only opaque disclosure IDs survive renders; no packet, text or URL is cached. */
export function PartFourSections(props: PartFourSectionsProps) {
  const [open, setOpen] = useState<{ key: string; id: string } | null>(null);
  const [sources, setSources] = useState<string | null>(null);
  const layout = useRef({key:'',section:0,list:0,rows:new Map<string,number>()});
  const packet = authorizedPartFourPacket(props.packet, props);
  if (!packet) return <Text accessibilityLiveRegion="polite" style={styles.copy}>{props.loading && !props.withdrawn ? 'Preparing product details' : 'Product details unavailable'}</Text>;
  const key = partFourDisclosureKey(packet);
  if(layout.current.key!==key)layout.current={key,section:0,list:0,rows:new Map()};
  const openId = props.expandedOccurrenceId !== undefined ? props.expandedOccurrenceId : open?.key === key ? open.id : null;
  const sourcesOpen = props.sourcesExpanded ?? sources === key;
  const rows = packet.formula.ingredients.map(ingredientRow);
  const insights = visiblePartFourInsights(packet);
  const hasComparison = ['selected','self','ambiguous'].includes(packet.comparison.state);
  const comparisonInsights = hasComparison ? insights.comparison : insights.comparison.filter(insight => ['supported','limited','conflict'].includes(insight.state));
  const routineInsights = insights.routine.filter(insight => insight.ruleId !== 'F06' || hasComparison || ['supported','conflict'].includes(insight.state));
  const evidence = formulaEvidenceNotice(packet.formula);
  const limits = formulaLimitationsForDisplay(packet.formula);
  const briefProps = { brief: packet.reviews.evidenceKind === 'limited_research_brief' ? packet.reviews.brief : null,
    expectedSubject: props.researchSubject ?? null, state: packet.reviews.state, now: props.now,
    withdrawn: props.withdrawn, withdrawnDependencies: props.researchWithdrawnDependencies,
    allowLocalFixture: props.allowLocalResearchFixture };

  function toggleIngredient(id: string | null) {
    setOpen(id ? { key, id } : null);
    props.onIngredientToggle?.(id);
  }
  function toggleSources(expanded: boolean) {
    setSources(expanded ? key : null);
    props.onSourcesToggle?.(expanded);
  }
  function jump(id: string) {
    if (!ingredientTargets(packet!.formula, { occurrenceId: id }).length) return;
    toggleIngredient(id);
    const rowY=layout.current.rows.get(id);props.onIngredientJump?.(id,rowY===undefined?undefined:layout.current.section+layout.current.list+rowY);
  }
  function renderInsight(insight: PartFourInsight) {
    const targets = insight.occurrenceIds.flatMap(id => ingredientTargets(packet!.formula, { occurrenceId: id }));
    return <View key={insight.id} style={styles.insight}>
      <Text style={styles.insightTitle}>{partFourDisplayText(insight.title)}</Text>
      <Text style={styles.copy}>{partFourDisplayText(insight.explanation)}</Text>
      {insight.state === 'conflict' && <Text style={styles.caption}>Conflicting evidence</Text>}
      {insight.action && <Text style={styles.routineAction}>{partFourDisplayText(insight.action)}</Text>}
      {targets.length > 0 && <View style={styles.ingredientLinks}>{[...new Set(targets)].map(id => {
        const row = rows.find(candidate => candidate.occurrenceId === id)!;
        return <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Explore ingredient: ${row.name}, position ${rows.indexOf(row) + 1}`}
          onPress={() => jump(id)} style={styles.ingredientLink}><Text style={styles.link}>{row.name}</Text></Pressable>;
      })}</View>}
    </View>;
  }

  return <View style={styles.sections}>
    {(hasComparison||comparisonInsights.length>0) && <View style={styles.comparison}>
      <Text accessibilityRole="header" style={styles.heading}>{hasComparison?'Compared with your current routine':'Relevant to your profile'}</Text>
      {hasComparison && <Text style={styles.copy}>{partFourDisplayText(packet.comparison.explanation)}</Text>}
      {packet.comparison.state === 'ambiguous' && <Text style={styles.caption}>More than one current item could apply. A direct comparison is not established.</Text>}
      {packet.comparison.state === 'self' && <Text style={styles.caption}>This is already the selected current item.</Text>}
      {comparisonInsights.map(insight => renderInsight(insight))}
    </View>}

    {routineInsights.length > 0 && <View style={styles.routine}>
      <Text accessibilityRole="header" style={styles.heading}>In your routine</Text>
      {routineInsights.map(insight => renderInsight(insight))}
    </View>}

    <View style={styles.ingredients} onLayout={event=>{layout.current.section=event.nativeEvent.layout.y;}}>
      <View style={styles.sectionHead}>
        <Text accessibilityRole="header" style={styles.heading}>Ingredients</Text>
        <Text style={styles.caption}>{`${rows.length} listed`}</Text>
      </View>
      <Text style={styles.caption}>{formulaScope(packet.formula)}</Text>
      {evidence && <Text accessibilityRole={packet.formula.evidenceState === 'conflict' ? 'alert' : undefined} style={styles.caption}>{evidence}</Text>}
      <View style={styles.ingredientList} onLayout={event=>{layout.current.list=event.nativeEvent.layout.y;}}>
        {rows.map((row, index) => {
          const heading = ingredientSectionHeading(packet.formula, index);
          const expanded = openId === row.occurrenceId;
          return <View key={row.occurrenceId} nativeID={`part-four-ingredient-${row.occurrenceId}`} style={styles.ingredient}
            onLayout={event => {layout.current.rows.set(row.occurrenceId,event.nativeEvent.layout.y);props.onIngredientLayout?.(row.occurrenceId,event.nativeEvent.layout.y);}}>
            {heading && heading !== 'Ingredients' && <Text accessibilityRole="header" style={styles.sectionKind}>{heading}</Text>}
            <Pressable accessibilityRole="button"
              accessibilityLabel={[`Ingredient details: ${row.name}, position ${index + 1}`, row.short, row.label,
                ...row.qualifiers, ...row.amounts, ...row.quantityLimits].join(', ')}
              accessibilityState={{ expanded }} onPress={() => toggleIngredient(expanded ? null : row.occurrenceId)} style={styles.ingredientSummary}>
              <View accessible={false} style={[styles.ingredientSignal,{backgroundColor:insights.comparison.some(i=>i.ruleId==='F02'&&i.state==='supported'&&i.occurrenceIds.includes(row.occurrenceId))?colors.actionReview.text:row.card?.contributionKind!=='unknown'&&row.label==='Helps moisturize'?colors.actionKeep.text:colors.inkSubtle}]} />
              <View style={styles.ingredientName}>
                <Text selectable style={styles.name}>{row.name}</Text>
                <Text style={styles.short}>{row.short}</Text>
                <Text style={styles.label}>{row.label}</Text>
                {row.qualifiers.map(qualifier => <Text key={qualifier} style={styles.caption}>{qualifier}</Text>)}
                {row.amounts.filter(amount => amount !== 'Amount in this formula: not disclosed.').map(amount => <Text key={amount} style={styles.amount}>{amount}</Text>)}
                {row.amounts.some(amount => amount !== 'Amount in this formula: not disclosed.') && row.quantityLimits.map(limit => <Text key={limit} style={styles.caption}>{limit}</Text>)}
              </View>
              <Text accessible={false} style={styles.chevron}>{expanded ? '−' : '+'}</Text>
            </Pressable>
            {expanded && <View accessibilityLabel={`Ingredient explanation, position ${index + 1}`} style={styles.ingredientDetail}>
              <Text selectable style={styles.caption}>{`Listed as: ${row.literal}`}</Text>
              {row.amounts.map(amount => <Text key={amount} style={styles.amount}>{amount}</Text>)}
              {row.quantityLimits.map(limit => <Text key={limit} style={styles.caption}>{limit}</Text>)}
              {row.card && <>
                <Text style={styles.explanation}>{partFourDisplayText(row.card.body)}</Text>
                {row.card.detail && <Text style={styles.more}>{partFourDisplayText(row.card.detail)}</Text>}
                {row.card.evidence && <View style={styles.evidence}>
                  <Text style={styles.evidenceTitle}>What we know</Text>
                  <Text style={styles.caption}>{partFourDisplayText(row.card.evidence??'')}</Text>
                </View>}
                {row.card.editorial && <>
                  {row.card.editorial.amountAndUse && <View style={styles.insight}>
                    <Text accessibilityRole="header" style={styles.insightTitle}>Amount and use context</Text>
                    <Text selectable style={styles.more}>{partFourDisplayText(row.card.editorial.amountAndUse)}</Text>
                  </View>}
                  {!row.card.editorial.caution && <Text style={styles.caption}>No specific caution is available in this reference. This does not mean the ingredient or product is risk-free.</Text>}
                  {row.card.editorial.caution && <View style={styles.insight}>
                    <Text accessibilityRole="header" style={styles.insightTitle}>Cautions</Text>
                    <Text selectable style={styles.more}>{partFourDisplayText(row.card.editorial.caution)}</Text>
                  </View>}
                  {row.card.editorial.aliasNotes && ![row.card.body,row.card.detail,row.card.evidence].some(copy=>copy?.includes(row.card!.editorial!.aliasNotes!)) && <View style={styles.insight}>
                    <Text accessibilityRole="header" style={styles.insightTitle}>Names used in the reference</Text>
                    <Text selectable style={styles.more}>{partFourDisplayText(row.card.editorial.aliasNotes)}</Text>
                  </View>}
                  {row.card.editorial.distinctIngredients && <View style={styles.insight}>
                    <Text accessibilityRole="header" style={styles.insightTitle}>Different ingredients</Text>
                    <Text selectable style={styles.more}>{partFourDisplayText(row.card.editorial.distinctIngredients)}</Text>
                  </View>}
                  {row.card.editorial.qualifications.length > 0 && <View style={styles.insight}>
                    <Text accessibilityRole="header" style={styles.insightTitle}>Limits of this information</Text>
                    {row.card.editorial.qualifications.map((qualification, qualificationIndex) =>
                      <Text key={qualificationIndex} selectable style={styles.caption}>{partFourDisplayText(qualification)}</Text>)}
                  </View>}
                </>}
              </>}
              <Text style={styles.caption}>Ingredient information does not establish the finished product’s effect or your experience with it.</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`View sources for ${row.name}, position ${index + 1}`}
                onPress={() => toggleSources(true)} style={styles.sourceButton}><Text style={styles.link}>Sources below</Text></Pressable>
            </View>}
          </View>;
        })}
      </View>
      {!rows.length && <Text style={styles.copy}>No ingredient declaration available.</Text>}
    </View>

    <RetainedEvidence evidence={packet.retainedEvidence} now={props.now} withdrawnDependencies={props.researchWithdrawnDependencies}/>
    {packet.value.state === 'ready' && <View style={styles.optional}><Text accessibilityRole="header" style={styles.heading}>Price &amp; value</Text><Text style={styles.copy}>{partFourDisplayText(packet.value.explanation)}</Text></View>}

    <View style={styles.sources}>
      <Pressable accessibilityRole="button" accessibilityLabel="Part Four sources" accessibilityState={{ expanded: sourcesOpen }}
        onPress={() => toggleSources(!sourcesOpen)} style={styles.sourceSummary}>
        <Text style={styles.insightTitle}>Sources</Text><Text accessible={false} style={styles.chevron}>{sourcesOpen ? '−' : '+'}</Text>
      </Pressable>
      {sourcesOpen && <View style={styles.sourceContent}>
        <ResearchBriefSources {...briefProps} />
        <RetainedEvidenceSources evidence={packet.retainedEvidence} now={props.now} withdrawnDependencies={props.researchWithdrawnDependencies}/>
        {packet.scientificDecision?.sourceRefs.map(source=>{
          const url=safePartFourSourceUrl(source.url);
          return <View key={`science:${source.id}:${source.reviewedAt}:${source.validUntil}`} style={styles.sourceEntry}>
            <Text style={styles.caption}>{`Evidence source · Read ${source.retrievedAt.slice(0,10)} · Reviewed ${source.reviewedAt.slice(0,10)}`}</Text>
            <Text selectable style={styles.caption}>{partFourDisplayText(source.locator)}</Text>
            {url&&<Pressable accessibilityRole="link" accessibilityLabel="View scientific evidence source" onPress={()=>{void Linking.openURL(url).catch(()=>{});}} style={styles.sourceButton}><Text style={styles.link}>View evidence source</Text></Pressable>}
          </View>;
        })}
        {limits.length > 0 && <View style={styles.sourceEntry}>
          <Text style={styles.insightTitle}>Evidence limits</Text>
          {limits.map(limit => <Text key={limit} style={styles.caption}>{limit}</Text>)}
        </View>}
        {packet.formula.educationContext?.map((context, contextIndex) => <View key={`${context.documentId}:${contextIndex}`} style={styles.sourceEntry}>
          {context.sections.map((section, sectionIndex) => <View key={sectionIndex} style={styles.insight}>
            <Text accessibilityRole="header" style={styles.insightTitle}>{partFourDisplayText(section.heading)}</Text>
            {section.paragraphs.map((paragraph, paragraphIndex) => <View key={paragraphIndex} style={styles.insight}>
              <Text selectable style={styles.copy}>{partFourDisplayText(paragraph.text)}</Text>
              {paragraph.links.map((link, linkIndex) => {
                const url = safePartFourSourceUrl(link.url);
                return url ? <Pressable key={linkIndex} accessibilityRole="link" accessibilityLabel={`View reference: ${partFourDisplayText(link.label)}`}
                  onPress={() => { void Linking.openURL(url).catch(() => {}); }} style={styles.sourceButton}>
                  <Text style={styles.link}>{partFourDisplayText(link.label)}</Text>
                </Pressable> : <Text key={linkIndex} style={styles.caption}>{partFourDisplayText(link.label)}</Text>;
              })}
            </View>)}
          </View>)}
          {context.researchTable && <View style={styles.insight}>
            <Text accessibilityRole="header" style={styles.insightTitle}>Research context from the reference</Text>
            {context.researchTable.rows.map((cells, rowIndex) => <View key={rowIndex} style={styles.evidence}>
              {cells.map((cell, cellIndex) => <Text key={cellIndex} selectable style={styles.caption}>{partFourDisplayText(cell)}</Text>)}
            </View>)}
          </View>}
        </View>)}
        {packet.formula.sourceRefs.map(source => {
          const url = safePartFourSourceUrl(source.sourceUrl);
          return <View key={`${source.observationId}:${source.sourceRevision}`} style={styles.sourceEntry}>
            <Text style={styles.caption}>{`${partFourDisplayText(source.attribution ?? 'Ingredient declaration')} · Observed ${source.observedAt.slice(0, 10)}`}</Text>
            {url && <Pressable accessibilityRole="link" accessibilityLabel={`View formula source: ${partFourDisplayText(source.attribution ?? 'Ingredient declaration')}`}
              onPress={() => { void Linking.openURL(url).catch(() => {}); }} style={styles.sourceButton}><Text style={styles.link}>View formula source</Text></Pressable>}
          </View>;
        })}
        {packet.formula.sources.map(source => {
          const url = safePartFourSourceUrl(source.url);
          return <View key={source.id} style={styles.sourceEntry}>
            <Text style={styles.caption}>{source.editorial
              ? `${partFourDisplayText(source.title)} · Copy approved ${partFourDisplayText((source.editorial.copyApprovedAt?.slice(0,10)??'time not recorded'))} · remote source revision unverified`
              : `${partFourDisplayText(source.title)} · Reviewed ${(source.reviewedAt?.slice(0,10)??'date unverified')}`}</Text>
            {url && <Pressable accessibilityRole="link" accessibilityLabel={`View reference: ${partFourDisplayText(source.title)}`}
              onPress={() => { void Linking.openURL(url).catch(() => {}); }} style={styles.sourceButton}><Text style={styles.link}>View reference</Text></Pressable>}
          </View>;
        })}
        {packet.formula.sourceRefs.some(source => isOpenBeautyFactsSource(source.sourceUrl)) && <View>
          <Text style={styles.caption}>Open Beauty Facts contributors · Database ODbL · Contents DbCL.</Text>
          <Pressable accessibilityRole="link" accessibilityLabel="Open Beauty Facts data licence and reuse" onPress={() => { void Linking.openURL(OBF_SOURCE_METHOD_URL).catch(() => {}); }} style={styles.sourceButton}><Text style={styles.link}>Data licence and reuse</Text></Pressable>
        </View>}
        {packet.formula.sourceRefs.length === 0 && packet.formula.sources.length === 0 && <Text style={styles.caption}>Source references unavailable.</Text>}
      </View>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  sections: { backgroundColor: colors.surface },
  comparison: { marginTop: 27, gap: spacing.sm, paddingBottom: spacing.xl },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600', letterSpacing: -0.3, color: colors.ink },
  copy: { fontSize: 14, lineHeight: 23, color: colors.inkMuted, flexShrink: 1 },
  caption: { fontSize: 13, lineHeight: 21, color: colors.inkMuted, flexShrink: 1 },
  insight: { gap: 5 },
  insightTitle: { fontSize: 14, lineHeight: 22, fontWeight: '600', color: colors.ink },
  ingredientLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  ingredientLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 },
  link: { fontSize: 13, lineHeight: 21, color: colors.brand, textDecorationLine: 'underline' },
  routine: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 23, paddingBottom: 24, gap: 13 },
  routineAction: { fontSize: 13, lineHeight: 21, color: colors.brand, fontWeight: '500', backgroundColor: colors.canvas, padding: 11, borderRadius: 9 },
  ingredients: { paddingTop: 23, gap: spacing.xs },
  sectionHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.xs, marginBottom: 5 },
  ingredientList: { borderTopWidth: 1, borderColor: colors.border, marginTop: 5 },
  ingredient: { borderBottomWidth: 1, borderColor: colors.border },
  sectionKind: { fontSize: 13, fontWeight: '600', color: colors.inkMuted, paddingTop: spacing.sm },
  ingredientSummary: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 12, minHeight: 44 },
  ingredientSignal: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.inkSubtle, marginTop: 8 },
  ingredientName: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontSize: 14, lineHeight: 22, fontWeight: '500', color: colors.ink, flexShrink: 1 },
  short: { fontSize: 13, lineHeight: 20, color: colors.inkMuted, flexShrink: 1 },
  label: { fontSize: 11, lineHeight: 18, fontWeight: '600', color: colors.inkMuted },
  amount: { fontSize: 11, lineHeight: 18, color: colors.inkMuted },
  chevron: { fontSize: 22, lineHeight: 25, fontWeight: '400', color: colors.inkMuted, width: 18, textAlign: 'center' },
  ingredientDetail: { paddingLeft: 16, paddingBottom: 18, gap: spacing.sm },
  explanation: { fontSize: 15, lineHeight: 25, color: colors.ink },
  more: { fontSize: 14, lineHeight: 23, color: colors.inkMuted },
  evidence: { padding: 12, borderRadius: 8, backgroundColor: colors.canvas, gap: 4 },
  evidenceTitle: { fontSize: 13, lineHeight: 21, fontWeight: '600', color: colors.brand },
  optional: { marginTop: spacing.xl, gap: spacing.sm },
  sources: { marginTop: 18, borderTopWidth: 1, borderColor: colors.border },
  sourceSummary: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sourceContent: { paddingBottom: spacing.lg, gap: spacing.md },
  sourceEntry: { gap: 4 },
  sourceButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
