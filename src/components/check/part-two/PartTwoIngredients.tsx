import React, { useEffect, useMemo, useState } from 'react';
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
export function PartTwoInlineView({ view, now = Date.now() }: { view: PartTwoView; now?: number }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const result = view.result && Date.parse(view.result.expiresAt) > now ? view.result : null;
  const reading = result?.state === 'ready' ? result.output.reading : null;
  const opened = reading?.occurrences.find(o => o.occurrenceId === openId);
  const status = !result ? view.error ?? (view.loading ? 'Preparing ingredient details' : 'Ingredient evidence unavailable') :
    result.state === 'pending' ? 'Preparing ingredient details' : result.state === 'no_declaration' ? 'No ingredient declaration available' :
    result.state === 'expired' || result.state === 'blocked' ? 'Ingredient evidence unavailable' : result.state !== 'ready' ? 'Ingredient details unavailable' : null;
  const scope = reading?.binding.kind === 'capture' ? 'Photo reading · Package not confirmed · May be incomplete' :
    reading?.evidenceBasis === 'public_source' ? `Published list${reading.packageConfirmation === 'unconfirmed' ? ' · Package not confirmed' : ''}` : 'Your label · May be incomplete';
  const detailFacts = reading?.facts.filter(f => f.occurrenceId === openId && f.kind === 'reference_function') ?? [];
  return <View style={{ gap: spacing.sm }}>
    {status && <Text accessibilityLiveRegion="polite" style={{ color: colors.ink }}>{status}</Text>}
    {reading && <>
      <Text accessibilityRole="header">Ingredient details</Text>
      <Text>{scope}</Text>
      {reading.evidenceState === 'conflict' && <Text accessibilityRole="alert">These readings disagree. Review the original text.</Text>}
      {reading.occurrences.map(occurrence => <View key={occurrence.occurrenceId} style={{ gap: spacing.xs }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Ingredient details: ${ingredientDisplayText(occurrence.observedName || occurrence.rawToken)}`}
          accessibilityState={{ expanded: openId === occurrence.occurrenceId }} onPress={() => setOpenId(openId === occurrence.occurrenceId ? null : occurrence.occurrenceId)} style={{ paddingVertical: spacing.sm }}>
          <Text selectable>{ingredientDisplayText(occurrence.rawToken)}</Text>
          {modalityText(occurrence) && <Text>{modalityText(occurrence)}</Text>}
          {occurrence.transcription !== 'clear' && <Text>Text unclear · Check text</Text>}
        </Pressable>
      </View>)}
    </>}
    {openId && <View style={{ gap: spacing.xs }}>
      <Text accessibilityRole="header">Ingredient detail</Text>
      {!opened ? <Text accessibilityLiveRegion="polite">Ingredient evidence unavailable</Text> : <>
        <Text selectable>{ingredientDisplayText(opened.observedName)}</Text>
        {opened.mapping.state === 'resolved' ? <Text>This observed name maps to a reviewed ingredient identity.</Text> : opened.mapping.state === 'ambiguous' ? <Text>Ingredient identity is ambiguous.</Text> : <Text>Details unavailable for this name</Text>}
        {opened.quantities.map((quantity, index) => <Text key={index}>Printed amount: {ingredientDisplayText(quantity.span.raw)} · {quantity.subject} · {quantity.basis === 'unknown' ? 'Basis unknown' : quantity.basis} · {quantity.status}{quantity.convertedPercentWw !== null ? ` · ${quantity.convertedPercentWw}% w/w (exact conversion)` : ''}</Text>)}
        {modalityText(opened) && <Text>{modalityText(opened)}{opened.qualifier ? `: ${ingredientDisplayText(opened.qualifier)}` : ''}</Text>}
        {detailFacts.map(fact => fact.kind === 'reference_function' && <View key={fact.factId} style={{ gap: spacing.xs }}>
          <Text>{ingredientDisplayText(fact.value.sentence)}</Text>
          <Text>Reference role only; no product efficacy or suitability claim. Reviewed {fact.value.reviewDate.slice(0, 10)}</Text>
          <Text>{ingredientDisplayText(fact.value.sourceAttribution)}</Text>
          {[['View role reference',fact.value.sourceUrl],['View role definition',fact.value.roleDefinitionUrl],['View reference license',fact.value.licenseUrl]].map(([label,url]) => new URL(url).protocol === 'https:' && <Pressable key={label} accessibilityRole="link" accessibilityLabel={label} onPress={() => { void Linking.openURL(url).catch(() => {}); }} style={{ paddingVertical: spacing.sm }}><Text>{label}</Text></Pressable>)}
        </View>)}
        {opened.limitations.map((limit, index) => <Text key={index}>{ingredientDisplayText(limit)}</Text>)}
        {reading?.dependencyManifest.sourceRefs.filter(source => opened.spans.some(span => span.observationId === source.observationId)).map(source => <View key={source.observationId}>
          <Text>{ingredientDisplayText(source.attribution ?? 'Source reading')} · Observed {source.observedAt.slice(0, 10)}</Text>
          {source.sourceUrl && new URL(source.sourceUrl).protocol === 'https:' && <Pressable accessibilityRole="link" accessibilityLabel="View ingredient source" onPress={() => { void Linking.openURL(source.sourceUrl!).catch(() => {}); }} style={{ paddingVertical: spacing.sm }}><Text>View source</Text></Pressable>}
        </View>)}
      </>}
      <Pressable accessibilityRole="button" accessibilityLabel="Close ingredient detail" onPress={() => setOpenId(null)} style={{ paddingVertical: spacing.sm }}><Text>Close ingredient detail</Text></Pressable>
    </View>}
  </View>;
}

/** Shared by actual Check and private saved evidence. No new screen or device cache. */
export function PartTwoIngredients({ target, enabled = PART_TWO_ENABLED, transport = partTwoTransport, onView }: { target: PartTwoTarget; enabled?: boolean; transport?: PartTwoTransport; onView?: (view: PartTwoView) => void }) {
  const [view, setView] = useState<PartTwoView>({ target: null, result: null, loading: false, error: null });
  const [controller] = useState(() => createPartTwoController(transport, createCatalogRequestId, setView));
  const [clockTick, clock] = useState(0);
  const key = JSON.stringify(target);
  useEffect(() => { onView?.(view); }, [view, onView]);
  useEffect(() => {
    if (!enabled) { controller.close(); return; }
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
  if (!enabled) return null;
  // Prop binding fences the render before effects handle owner/selection changes.
  const current = view.target && JSON.stringify(view.target) === key ? view : { target, result: null, loading: true, error: null };
  return <PartTwoInlineView view={current} />;
}
export function PartTwoSavedIngredients({ saveId, target }: { saveId: string; target: PartTwoTarget }) {
  const transport = useMemo(() => partTwoSavedTransport(saveId), [saveId]);
  return <PartTwoIngredients key={saveId} target={target} transport={transport} />;
}
