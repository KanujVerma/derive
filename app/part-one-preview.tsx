import React, { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Button } from '@/src/components/ui/Button';
import { PartOneLocalDraftSummary } from '@/src/components/check/part-one/PartOneLocalDraftSummary';
import { PartOneResultSheet } from '@/src/components/check/part-one/PartOneResultSheet';
import { PartOneLabelCapture, PART_ONE_LOCAL_CAPTURE_AVAILABLE, purgeLocalCaptureFile } from '@/src/components/check/part-one/PartOneLabelCapture';
import { MemoryLabelDraft, type CaptureBinding } from '@/src/presentation/part-one/capture';
import { ScanResultSchema, type ScanResult } from '@/src/contracts/PartOne';
import { colors, spacing } from '@/src/constants/theme';

const uuid = (n: number) => `ff000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function fixture(): ScanResult {
  return ScanResultSchema.parse({ schemaVersion: 1, requestId: uuid(1), scanId: uuid(2), generation: 0, resultRevision: 1,
    identity: 'exact', itemId: uuid(3), candidateIds: [], snapshotId: uuid(4), declarationId: null, declarationState: 'none', scope: 'public', packageConfirmation: 'unconfirmed',
    work: 'deferred_budget', jobId: uuid(5), subscriptionId: null, nextCheckAfter: null,
    display: { resultRevision: 1, selectedIdentity: { id: uuid(3), name: 'Synthetic Lotion', brand: 'Fixture', variantText: 'Unscented · 100 ml · single package', expiresAt: '2099-01-01T00:00:00Z', image: null }, candidates: [], sections: [], sources: [], limitations: ['Synthetic fixture for local UI verification. No provider lookup or durable save.'] },
    reasonCodes: ['source_blocked'], conflictIds: [], evidenceIds: [], allowedActions: ['save_partial', 'retry', 'rescan'], freshness: { observedAt: null, expiresAt: null, state: 'unknown' } });
}

/** Explicit local fixture, never a production fallback or catalog authority. */
export default function PartOnePreview() {
  const router = useRouter();
  const [result, setResult] = useState(fixture);
  const [owner, setOwner] = useState(uuid(20));
  const [saved, setSaved] = useState(false);
  const [visible, setVisible] = useState(true);
  const [capture, setCapture] = useState(false);
  const clockOffset = useRef(0);
  const [draft] = useState(() => new MemoryLabelDraft(() => Date.now() + clockOffset.current, purgeLocalCaptureFile));
  const [, rerender] = useState(0);
  useEffect(() => draft.subscribe(() => rerender(n => n + 1)), [draft]);
  useEffect(() => () => draft.endSheet(), [draft]);
  if (!__DEV__ || process.env.EXPO_PUBLIC_PART_ONE_FIXTURE_UI !== 'true') return <Redirect href="/(tabs)/check" />;
  const binding: CaptureBinding = { ownerId: owner, sheetSessionId: result.scanId, scanId: result.scanId, generation: result.generation,
    captureSessionId: uuid(result.generation + 30), packageObservationId: uuid(result.generation + 40), itemId: result.itemId, candidateId: null, deletionEpoch: 0 };
  const revise = (patch: Partial<ScanResult>) => setResult(r => ScanResultSchema.parse({ ...r, ...patch, resultRevision: r.resultRevision + 1, display: { ...r.display, ...patch.display, resultRevision: r.resultRevision + 1 } }));
  return <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: 70, paddingHorizontal: spacing.lg, gap: spacing.sm }}>
    <Text accessibilityRole="header">Part 1 synthetic fixtures</Text>
    <Text>Local UI and OCR evaluation only</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
    <Button size="small" style={{ width: '48%' }} label="Back to Check" variant="ghost" onPress={() => { draft.endSheet(); router.replace('/(tabs)/check'); }} />
    <Button size="small" style={{ width: '48%' }} label="Reopen fixture result" variant="ghost" onPress={() => setVisible(true)} />
    <Button size="small" style={{ width: '48%' }} label="Simulate late conflict" variant="ghost" onPress={() => revise({ declarationState: 'conflict', conflictIds: [uuid(80)] })} />
    <Button size="small" style={{ width: '48%' }} label="Expire fixture draft" variant="ghost" onPress={() => { clockOffset.current += 30 * 60 * 1000; draft.read(binding); rerender(n => n + 1); }} />
    <Button size="small" style={{ width: '48%' }} label="Select product B" variant="ghost" onPress={() => { draft.endSheet(); setCapture(false); revise({ generation: result.generation + 1, itemId: uuid(90), declarationState: 'none', conflictIds: [], display: { ...result.display, selectedIdentity: { id: uuid(90), name: 'Synthetic Product B', brand: 'Fixture', variantText: '50 ml', expiresAt: '2099-01-01T00:00:00Z', image: null } } }); }} />
    <Button size="small" style={{ width: '48%' }} label="Switch fixture account" variant="ghost" onPress={() => { draft.accountChanged(); setOwner(uuid(21)); setVisible(false); setCapture(false); setSaved(false); }} />
    <Button size="small" style={{ width: '48%' }} label="Show expiring evidence" variant="ghost" onPress={() => {
      const observedAt = new Date().toISOString(), expiresAt = new Date(Date.now() + 3000).toISOString();
      revise({ declarationState: 'partial', conflictIds: [], display: { ...result.display,
        sections: [{ sectionId: uuid(71), kind: 'ingredients', text: 'TEMPORARY SOURCE TEXT', evidenceIds: [uuid(72)], policyId: uuid(73), observedAt, expiresAt }],
        sources: [{ observationId: uuid(72), policyId: uuid(73), label: 'Expiring synthetic source', url: null, observedAt, sourceUpdatedAt: null, expiresAt }] } });
    }} />
    </View>
    {visible && <PartOneResultSheet inline localDraft={<PartOneLocalDraftSummary draft={draft} binding={binding} onReview={() => setCapture(true)} onRemove={() => { draft.remove(); setCapture(false); }} />} view={{ owner, result, saved, loading: false, error: null, scrollOffset: 0 }}
      onClose={() => { draft.endSheet(); setVisible(false); }} onSave={() => setSaved(true)} onSelect={() => {}} onSearch={() => setVisible(false)} onFullChange={() => {}}
      onRefresh={() => revise({ work: 'complete' })} onCapture={PART_ONE_LOCAL_CAPTURE_AVAILABLE ? () => { draft.begin(binding, 0); setCapture(true); } : undefined} />}
    {capture && <PartOneLabelCapture draft={draft} binding={binding} productLabel={`${result.display.selectedIdentity?.name} ${result.display.selectedIdentity?.variantText}`}
      onClose={() => setCapture(false)} onChange={() => rerender(n => n + 1)} />}
  </View>;
}
