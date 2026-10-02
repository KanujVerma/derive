import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Text, View } from 'react-native';
import { ResultSheetSurface } from '../result-sheet/ResultSheetSurface';
import { Button } from '../../ui/Button';
import { colors, spacing, typography } from '../../../constants/theme';
import type { PartOneView } from '../../../presentation/part-one/resultController';

export function partOneStatus(view: PartOneView, now = Date.now()): string {
  const r = view.result;
  if (view.loading || !r) return view.error ?? 'Looking up product';
  if (r.declarationState === 'conflict') return 'Ingredient sources conflict. Ingredients are not verified.';
  if (r.declarationState === 'accepted' && (r.freshness.state !== 'fresh' || !r.freshness.expiresAt || Date.parse(r.freshness.expiresAt) <= now)) return 'Ingredient evidence expired. Check the current source before relying on it.';
  if (r.declarationState === 'accepted') return r.scope === 'private_package' ? 'Ingredients from this package' : 'Published ingredient declaration. Your package is unconfirmed.';
  if (r.declarationState === 'partial') return 'Partial ingredients. Missing sections remain unverified.';
  if (r.declarationState === 'uncertain') return 'Ingredient text needs review.';
  if (r.identity === 'unresolved') return 'Product identity is unresolved.';
  return 'Ingredients not verified yet';
}

/** Uses the existing sheet. Revision updates keep its mounted scroll and detent. */
export function PartOneResultSheet({ view, onClose, onRefresh, onSelect, onSave, onCapture, onSearch, onFullChange, onScroll, inline = true }: {
  view: PartOneView; onClose: () => void; onRefresh: () => void;
  onSelect: (id: string) => void; onSave: () => void; onCapture?: () => void;
  onSearch: () => void; onFullChange: (full: boolean) => void;
  onScroll?: (offset: number) => void;
  inline?: boolean;
}) {
  const r = view.result; const identity = r?.display.selectedIdentity;
  const [now, setNow] = useState(Date.now);
  const expiresAt = r?.freshness.expiresAt;
  useEffect(() => {
    if (!expiresAt || Date.parse(expiresAt) <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(60000, Math.max(1, Date.parse(expiresAt) - now)));
    return () => clearTimeout(timer);
  }, [expiresAt, now]);
  const expired = r?.declarationState === 'accepted' && (r.freshness.state !== 'fresh' || !expiresAt || Date.parse(expiresAt) <= now);
  const status = partOneStatus(view, now);
  return <ResultSheetSurface inline={inline} presentationKey={`part-one:${r?.scanId ?? 'pending'}`}
    onClose={onClose} onExpandedChange={onFullChange} onScrollOffset={onScroll} summary={<View style={{ gap: spacing.sm }}>
      {view.loading && <ActivityIndicator color={colors.brand} />}
      {identity?.image && <Image accessibilityLabel={`${identity.name} package`} source={{ uri: identity.image.url }} style={{ width: 64, height: 80 }} resizeMode="contain" />}
      {identity && <><Text>{identity.brand}</Text><Text accessibilityRole="header" style={{ fontSize: typography.sizes.sectionTitle, color: colors.ink }}>{identity.name}</Text><Text>{identity.variantText}</Text></>}
      <Text accessibilityLiveRegion="polite" style={{ color: colors.ink }}>{status}</Text>
      {r?.work === 'deferred_budget' && <Text>Lookup is deferred. Existing product facts remain available.</Text>}
      {r?.work === 'retry_wait' && <Text>The source is temporarily unavailable. Lookup will retry when eligible.</Text>}
      {r && ['queued', 'running'].includes(r.work) && <Text>Lookup is pending. You can close and reopen this result.</Text>}
      {view.error && <Text accessibilityRole="alert">{view.error}</Text>}
    </View>} compactActions={<View style={{ gap: spacing.sm }}>
      {r?.allowedActions.includes('choose_candidate') && r.display.candidates.map(candidate => <View key={candidate.id} style={{ gap: spacing.xs }}>
        <Text>Is this the product?</Text><Text>{candidate.brand} {candidate.name} {candidate.variantText}</Text>
        <Button label="Yes, this product" accessibilityHint={`Select ${candidate.name}. This confirms identity only.`} variant="outline" onPress={() => onSelect(candidate.id)} />
      </View>)}
      {!expired && r?.snapshotId && r.allowedActions.some(action => action === 'save' || action === 'save_partial') && <Button
        label={view.saved ? 'Saved' : r.declarationState === 'accepted' ? 'Save product and evidence' : 'Save product without verified ingredients'}
        disabled={view.saved} variant="outline" onPress={onSave} />}
      {onCapture && r && (expired || r.declarationState !== 'accepted') && <Button label="Scan ingredients" variant="outline" onPress={onCapture} />}
      {r?.allowedActions.includes('retry') && <Button label="Check lookup status" variant="ghost" onPress={onRefresh} />}
      {r?.allowedActions.includes('rescan') && <Button label="Rescan" variant="ghost" onPress={onClose} />}
      {r && r.identity !== 'exact' && <Button label="Search by name" variant="ghost" onPress={onSearch} />}
    </View>}>
    {!expired && r?.display.sections.map(section => <View key={section.sectionId} style={{ gap: spacing.xs }}>
      <Text accessibilityRole="header">{section.kind === 'may_contain' ? 'May contain' : section.kind}</Text><Text selectable>{section.text}</Text>
    </View>)}
    {!expired && r?.display.sources.map(source => <View key={source.observationId} style={{ gap: spacing.xs }}>
      <Text>{source.label} · Observed {source.observedAt.slice(0, 10)}</Text>
      {source.url && <Button label={`View source: ${source.label}`} variant="ghost" onPress={() => {
        const url = source.url; if (url && new URL(url).protocol === 'https:') void Linking.openURL(url).catch(() => {});
      }} />}
    </View>)}
    {r?.display.limitations.map((limitation, i) => <Text key={i}>{limitation}</Text>)}
  </ResultSheetSurface>;
}
