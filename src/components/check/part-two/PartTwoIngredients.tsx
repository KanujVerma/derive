import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Pressable, Text, View } from 'react-native';
import { createPartTwoController, type PartTwoTarget, type PartTwoTransport, type PartTwoView } from '../../../presentation/part-two/controller';
import { PART_TWO_ENABLED, partTwoTransport, partTwoSavedTransport } from '../../../services/partTwo';
import { createCatalogRequestId } from '../../../services/productCatalog';
import type { PartTwoOccurrence } from '../../../contracts/PartTwo';
import { colors, spacing } from '../../../constants/theme';

/** Rendering controls are visible inert text, never a chemical correction. */
export function ingredientDisplayText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, char => `[U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}]`);
}
const modalityText = (occurrence: PartTwoOccurrence) => occurrence.modality === 'may_contain' ? 'May contain' : occurrence.modality === 'alternative' ? 'Alternative entry' : occurrence.modality === 'unresolved' ? 'Entry qualifier unclear' : null;
const sectionLabel = (kind: PartTwoOccurrence['sectionKind']) => ({ ingredients: 'Ingredients', active: 'Active ingredients', inactive: 'Inactive ingredients', may_contain: 'May contain' })[kind];
export function PartTwoInlineView({ view, now = Date.now() }: { view: PartTwoView; now?: number }) {
  const key = JSON.stringify(view.target);
  const [open, setOpen] = useState<{ key: string; id: string } | null>(null);
  const [disclosure, setDisclosure] = useState<{ key: string; id: string } | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  // Only opaque row IDs and numeric layout survive withdrawal. Private text,
  // source URLs and derived facts are read from the current authorized result.
  const layout = useRef<{ key: string; introHeight: number; rows: { id: string; height: number }[]; detailHeight: number; detailOffset: number }>({ key, introHeight: 0, rows: [], detailHeight: 0, detailOffset: 0 });
  if (layout.current.key !== key) layout.current = { key, introHeight: 0, rows: [], detailHeight: 0, detailOffset: 0 };
  const openId = open?.key === key ? open.id : null;
  const result = view.result && Date.parse(view.result.expiresAt) > now ? view.result : null;
  const reading = result?.state === 'ready' ? result.output.reading : null;
  if (reading) layout.current.rows = reading.occurrences.map(o => ({ id: o.occurrenceId, height: layout.current.rows.find(row => row.id === o.occurrenceId)?.height ?? 0 }));
  const status = !result ? view.error ?? (view.loading ? 'Preparing ingredient details' : 'Ingredient evidence unavailable') :
    result.state === 'pending' ? 'Preparing ingredient details' : result.state === 'no_declaration' ? 'No ingredient declaration available' :
    result.state === 'expired' || result.state === 'blocked' ? 'Ingredient evidence unavailable' : result.state !== 'ready' ? 'Ingredient details unavailable' : null;
  const scope = reading?.binding.kind === 'capture' ? 'Photo reading · Package not confirmed' :
    reading?.evidenceBasis === 'public_source' ? `Published list${reading.packageConfirmation === 'unconfirmed' ? ' · Package not confirmed' : ''}` : 'Your label';
  const evidence = reading?.evidenceState === 'uncertain' ? 'Some text is uncertain. Check the original wording.' : reading?.evidenceState === 'conflict' ? 'These readings disagree. Review the original text.' :
    reading?.claimLimits.declarationCompleteness !== 'accepted' ? 'Partial list · Missing text remains unknown. May be incomplete.' : null;
  function detail(opened?: PartTwoOccurrence) {
    const facts = reading?.facts.filter(f => f.occurrenceId === openId && f.kind === 'reference_function') ?? [];
    const sources = reading?.dependencyManifest.sourceRefs.filter(source => opened?.spans.some(span => span.observationId === source.observationId)) ?? [];
    const expanded = disclosure?.key === key && disclosure.id === openId;
    return <View accessibilityLabel="Inline ingredient explanation" style={{ gap: spacing.xs, minHeight: layout.current.detailHeight || undefined }}
      onLayout={event => { if (opened) { layout.current.detailHeight = Math.max(layout.current.detailHeight, event.nativeEvent.layout.height); layout.current.detailOffset = event.nativeEvent.layout.y; } }}>
      <Text accessibilityRole="header">Ingredient detail</Text>
      {!opened ? <Text accessibilityLiveRegion="polite">Ingredient evidence unavailable</Text> : <>
        {opened.mapping.state === 'resolved' ? <>
          {opened.mapping.preferredName && opened.mapping.preferredName !== opened.observedName && <Text>{ingredientDisplayText(opened.mapping.preferredName)}</Text>}
          <Text>{`Listed as: ${ingredientDisplayText(opened.observedName)}`}</Text>
        </> : opened.mapping.state === 'ambiguous' ? <Text>Ingredient identity is ambiguous.</Text> : <Text>Details unavailable for this name</Text>}
        {opened.quantities.map((quantity, index) => <View key={index} style={{ gap: spacing.xs }}>
          <Text>Printed amount: {ingredientDisplayText(quantity.span.raw)}</Text>
          {!['parsed', 'validated'].includes(quantity.status) ? <Text>Printed amount needs review; no concentration is established.</Text> : <>
            {quantity.basis === 'unknown' && <Text>The label does not specify whether this amount is by weight or volume.</Text>}
            {quantity.subject === 'group' && <Text>This amount applies to the listed group. Individual amounts are unknown.</Text>}
            {quantity.subject === 'blend' && <Text>This amount applies to the named blend. Constituent amounts are unknown.</Text>}
            {quantity.convertedPercentWw !== null && <Text>Equivalent to {quantity.convertedPercentWw}% by weight.</Text>}
          </>}
        </View>)}
        {opened.modality === 'alternative' && <Text>An alternative entry; definite presence is not established.</Text>}
        {opened.modality === 'may_contain' && <Text>May contain; definite presence is not established.</Text>}
        {opened.transcription !== 'clear' && <Text>Text unclear · Check text</Text>}
        {facts.map(fact => fact.kind === 'reference_function' && <View key={fact.factId} style={{ gap: spacing.xs }}>
          <Text>{ingredientDisplayText(fact.value.sentence)}</Text>
          <Text>Reference role only. Product effect and suitability are unknown.</Text>
        </View>)}
        <Pressable accessibilityRole="button" accessibilityLabel="Ingredient source and reference" accessibilityState={{ expanded }} onPress={() => setDisclosure(expanded ? null : { key, id: openId! })} style={{ paddingVertical: spacing.sm }}><Text>Source and reference</Text></Pressable>
        {expanded && <>
          {sources.map(source => <View key={source.observationId} style={{ gap: spacing.xs }}>
            <Text>{ingredientDisplayText(source.attribution ?? 'Source reading')} · Observed {source.observedAt.slice(0, 10)}</Text>
            {source.sourceUrl && new URL(source.sourceUrl).protocol === 'https:' && <Pressable accessibilityRole="link" accessibilityLabel="View ingredient source" onPress={() => { void Linking.openURL(source.sourceUrl!).catch(() => {}); }} style={{ paddingVertical: spacing.sm }}><Text>View source</Text></Pressable>}
          </View>)}
          {facts.map(fact => fact.kind === 'reference_function' && <View key={fact.factId} style={{ gap: spacing.xs }}>
            <Text>{ingredientDisplayText(fact.value.sourceAttribution)} · Reviewed {fact.value.reviewDate.slice(0, 10)}</Text>
            {[['View role reference',fact.value.sourceUrl],['View role definition',fact.value.roleDefinitionUrl],['View reference license',fact.value.licenseUrl]].map(([label,url]) => new URL(url).protocol === 'https:' && <Pressable key={label} accessibilityRole="link" accessibilityLabel={label} onPress={() => { void Linking.openURL(url).catch(() => {}); }} style={{ paddingVertical: spacing.sm }}><Text>{label}</Text></Pressable>)}
          </View>)}
        </>}
      </>}
      <Pressable accessibilityRole="button" accessibilityLabel="Close ingredient detail" onPress={() => { setOpen(null); setDisclosure(null); layout.current.detailHeight = 0; layout.current.detailOffset = 0; }} style={{ paddingVertical: spacing.sm, marginTop: 'auto' }}><Text>Close ingredient detail</Text></Pressable>
    </View>;
  }
  const assertions = result?.state === 'ready' && result.output.kind === 'bound' ? result.output.productFacts.facts.filter(f => f.kind === 'product_label_assertion') : [];
  return <View style={{ gap: spacing.sm }}>
    <View style={{ gap: spacing.xs, minHeight: !reading && openId ? layout.current.introHeight : undefined }} onLayout={event => { if (reading) layout.current.introHeight = event.nativeEvent.layout.height; }}>
      {status && <Text accessibilityLiveRegion="polite" style={{ color: colors.ink }}>{status}</Text>}
      {reading && <><Text accessibilityRole="header">Ingredient details</Text><Text>{scope}</Text>{evidence && <Text accessibilityRole={reading.evidenceState === 'conflict' ? 'alert' : undefined}>{evidence}</Text>}</>}
    </View>
    {reading ? reading.occurrences.map((occurrence, index) => <View key={occurrence.occurrenceId} style={{ gap: spacing.xs }} onLayout={event => { const row = layout.current.rows.find(r => r.id === occurrence.occurrenceId); if (row) row.height = openId === row.id ? Math.max(row.height, event.nativeEvent.layout.height) : event.nativeEvent.layout.height; }}>
      {(index === 0 || reading.occurrences[index - 1].sectionId !== occurrence.sectionId || reading.occurrences[index - 1].sectionKind !== occurrence.sectionKind) && <Text accessibilityRole="header">{sectionLabel(occurrence.sectionKind)}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Ingredient details: ${ingredientDisplayText(occurrence.observedName || occurrence.rawToken)}`}
        accessibilityState={{ expanded: openId === occurrence.occurrenceId }} onPress={() => { layout.current.detailHeight = 0; layout.current.detailOffset = 0; setOpen(openId === occurrence.occurrenceId ? null : { key, id: occurrence.occurrenceId }); setDisclosure(null); }} style={{ paddingVertical: spacing.sm }}>
        <Text selectable>{ingredientDisplayText(occurrence.rawToken)}</Text>
        {modalityText(occurrence) && <Text>{modalityText(occurrence)}</Text>}
        {occurrence.transcription !== 'clear' && <Text>Text unclear · Check text</Text>}
      </Pressable>
      {openId === occurrence.occurrenceId && detail(occurrence)}
    </View>) : openId && layout.current.rows.map(row => <View key={row.id} style={{ minHeight: row.height, paddingTop: row.id === openId ? layout.current.detailOffset : undefined }}>{row.id === openId && detail()}</View>)}
    {reading && <>
      <Pressable accessibilityRole="button" accessibilityLabel="Original ingredient wording" accessibilityState={{ expanded: original === key }} onPress={() => setOriginal(original === key ? null : key)} style={{ paddingVertical: spacing.sm }}><Text>Original wording</Text></Pressable>
      {original === key && reading.literalSections.map(section => <View key={section.sectionId}><Text accessibilityRole="header">{sectionLabel(section.kind)}</Text><Text selectable>{ingredientDisplayText(section.rawText)}</Text></View>)}
      {assertions.length > 0 && <View style={{ gap: spacing.xs }}><Text accessibilityRole="header">Reported on the label</Text>
        {assertions.map(fact => fact.kind === 'product_label_assertion' && <View key={fact.factId}><Text>Label says: {ingredientDisplayText(fact.value.text)}</Text><Text>Reported claim; not independently verified.</Text>
          {reading.dependencyManifest.sourceRefs.filter(source=>fact.spans.some(span=>span.observationId===source.observationId)).map(source=><Text key={source.observationId}>{ingredientDisplayText(source.attribution ?? 'Label source')} · Observed {source.observedAt.slice(0,10)}</Text>)}
        </View>)}
      </View>}
    </>}
  </View>;
}

/** Acquisition belongs to the mounted result owner, independent of disclosure. */
export function usePartTwoView(target: PartTwoTarget | null, enabled = PART_TWO_ENABLED, transport = partTwoTransport): PartTwoView {
  const [view, setView] = useState<PartTwoView>({ target: null, result: null, loading: false, error: null });
  const controller = useMemo(() => createPartTwoController(transport, createCatalogRequestId, setView), [transport]);
  const [clockTick, clock] = useState(0);
  const key = JSON.stringify(target);
  useEffect(() => {
    if (!enabled || !target) { controller.close(); return; }
    controller.bind(target); void controller.refresh();
    const timer = setInterval(() => { controller.expire(); void controller.refresh(); }, 15000);
    const listener = AppState.addEventListener('change', state => {
      controller.invalidate(); if (state === 'active') void controller.refresh();
    });
    return () => { clearInterval(timer); listener.remove(); controller.close(); };
  }, [key, enabled, controller]);
  const expiry = view.result?.expiresAt;
  useEffect(() => {
    if (!expiry) return;
    const timer = setTimeout(() => { controller.expire(); clock(value => value + 1); }, Math.max(1, Math.min(60000, Date.parse(expiry) - Date.now())));
    return () => clearTimeout(timer);
  }, [expiry, view.result, controller, clockTick]);
  return target && view.target && JSON.stringify(view.target) === key ? view : { target, result: null, loading: Boolean(enabled && target), error: null };
}
export function PartTwoIngredientsView({ target, view, enabled = PART_TWO_ENABLED, fallback }: { target: PartTwoTarget; view: PartTwoView; enabled?: boolean; fallback?: React.ReactNode }) {
  const key = JSON.stringify(target);
  const originalAccess = useRef({ key, denied: false });
  if (originalAccess.current.key !== key) originalAccess.current = { key, denied: false };
  if (!enabled) return <>{fallback}</>;
  // Prop binding fences the render before effects handle owner/selection changes.
  const current = view.target && JSON.stringify(view.target) === key ? view : { target, result: null, loading: true, error: null };
  // Never restore an older original-text copy after a current-authority refusal.
  // Initial/pending content retains Part 1's independently authorized wording;
  // a parse limit retains only explicitly permitted literal evidence.
  const result = current.result;
  if (current.error || result && !['ready', 'pending', 'parse_limit'].includes(result.state)) originalAccess.current.denied = true;
  const permitted = result && result.state !== 'ready' && result.permittedText && Date.parse(result.permittedText.expiresAt) > Date.now() ? result.permittedText : null;
  const originalAllowed = !originalAccess.current.denied && (result?.state === 'pending' || !result && current.loading && !current.error);
  return <>{permitted ? permitted.sections.map(section => <View key={section.sectionId}><Text accessibilityRole="header">{sectionLabel(section.kind)}</Text><Text selectable>{ingredientDisplayText(section.text)}</Text></View>) : originalAllowed && fallback}<PartTwoInlineView view={current} /></>;
}
/** Standalone owners (private evidence and saved screens) retain the same lifecycle. */
export function PartTwoIngredients({ target, enabled = PART_TWO_ENABLED, transport = partTwoTransport, onView, fallback }: { target: PartTwoTarget; enabled?: boolean; transport?: PartTwoTransport; onView?: (view: PartTwoView) => void; fallback?: React.ReactNode }) {
  const view = usePartTwoView(target, enabled, transport);
  useEffect(() => { onView?.(view); }, [view, onView]);
  return <PartTwoIngredientsView target={target} view={view} enabled={enabled} fallback={fallback} />;
}
export function PartTwoSavedIngredients({ saveId, target, fallback, onView, enabled, transport: provided }: { saveId: string; target: PartTwoTarget; fallback?: React.ReactNode; onView?: (view: PartTwoView) => void; enabled?: boolean; transport?: PartTwoTransport }) {
  const transport = useMemo(() => provided ?? partTwoSavedTransport(saveId), [saveId, provided]);
  return <PartTwoIngredients key={saveId} target={target} transport={transport} fallback={fallback} onView={onView} enabled={enabled} />;
}
