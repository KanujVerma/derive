import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { z } from 'zod';
import { PartOneResultSheet } from '@/src/components/check/part-one/PartOneResultSheet';
import { PartTwoIngredients } from '@/src/components/check/part-two/PartTwoIngredients';
import { PartTwoPrivateInterpretation } from '@/src/components/check/part-two/PartTwoPrivateInterpretation';
import { PartOneIdSchema, ScanResultSchema } from '@/src/contracts/PartOne';
import { createPartTwoTransport, createPartTwoSavedTransport, savePartTwoInterpretation } from '@/src/services/partTwoClient';
import type { PartTwoView } from '@/src/presentation/part-two/controller';
import { Button } from '@/src/components/ui/Button';
const ORIGIN = 'http://127.0.0.1:8138';
const Bootstrap = z.strictObject({ ownerId: PartOneIdSchema, token: z.string(), apiKey: z.string(), apiOrigin: z.literal('http://127.0.0.1:59421'), result: ScanResultSchema, captureSessionId: PartOneIdSchema.nullable() });
type Fixture = z.infer<typeof Bootstrap>;
/** Explicit synthetic loopback harness; actual authorized Edge/SQL and production sheet/details. */
export default function PartTwoPreview() {
  const [fixture, setFixture] = useState<Fixture | null>(null), [details, setDetails] = useState<PartTwoView | null>(null);
  const [saved, setSaved] = useState(false), [status, setStatus] = useState('Fixture not loaded'), [visible, setVisible] = useState(true), [tick, setTick] = useState(0);
  const [saveId, setSaveId] = useState<string | null>(null);
  const owner = useRef<string | null>(null);
  const epoch = useRef(0);
  const enabled = __DEV__ && process.env.EXPO_PUBLIC_PART_TWO_FIXTURE_UI === 'true';
  async function load() { if (!enabled) return; const ticket = ++epoch.current; const response = await fetch(`${ORIGIN}/bootstrap`); if (ticket !== epoch.current) return; if (!response.ok) { setStatus('Local fixture unavailable'); return; } const data = Bootstrap.parse(await response.json()); if (ticket !== epoch.current) return; owner.current = data.ownerId; setFixture(data); setDetails(null); setSaved(false); setSaveId(null); setVisible(true); setStatus('Actual local Edge fixture loaded'); }
  if (!enabled) return <Redirect href="/(tabs)/check" />;
  const invoke = async (path: string, body: string) => {
    if (!fixture || owner.current !== fixture.ownerId) throw Error('Fixture account changed');
    const response = await fetch(`${fixture.apiOrigin}/functions/v1/${path}`, { method: 'POST', body, headers: { 'Content-Type': 'application/json', apikey: fixture.apiKey, Authorization: `Bearer ${fixture.token}` } });
    return { data: await response.json(), error: response.ok ? null : Error('Local operation unavailable') };
  };
  const result = fixture?.result;
  return <View style={{ flex: 1, paddingTop: 60, paddingHorizontal: 20, backgroundColor: '#FAFAF7' }}>
    <Text accessibilityRole="header">Part 2 local runtime verification</Text>
    <Text accessibilityLiveRegion="polite">{status}</Text>
    <Button label="Load Part 2 local fixture" onPress={() => void load()} />
    <Button label="Reopen Part 2 local fixture" onPress={() => { setVisible(true); setTick(n => n + 1); }} />
    <Button label="Withdraw Part 2 fixture source" onPress={() => void fetch(`${ORIGIN}/withdraw`, { method: 'POST' }).then(() => { setStatus('Fixture source withdrawn'); })} />
    <Button label="Switch Part 2 fixture account" onPress={() => { epoch.current++; owner.current = null; setFixture(null); setDetails(null); setSaveId(null); setStatus('Fixture account changed'); }} />
    {fixture && result && visible && <PartOneResultSheet interpretationCaptureSessionId={fixture.captureSessionId} view={{ owner: fixture.ownerId, result, loading: false, error: null, saved, scrollOffset: 0 }}
      localDraft={fixture.captureSessionId ? <PartTwoPrivateInterpretation key={`${fixture.ownerId}:${tick}`} enabled result={result} target={{ ownerId: fixture.ownerId, scanId: result.scanId, captureSessionId: fixture.captureSessionId, generation: result.generation, evidenceRevision: result.resultRevision }} invoke={invoke} /> : <PartTwoIngredients key={`${fixture.ownerId}:${tick}:${saveId}`} enabled target={{ ownerId: fixture.ownerId, scanId: result.scanId, captureSessionId: null, generation: result.generation, evidenceRevision: result.resultRevision }} transport={saveId ? createPartTwoSavedTransport(saveId, { enabled: () => enabled, invoke }) : createPartTwoTransport({ enabled: () => enabled, invoke })} onView={setDetails} />}
      onClose={() => setVisible(false)} onSelect={() => {}} onSearch={() => setVisible(false)} onFullChange={() => {}}
      onRefresh={() => setTick(n => n + 1)} onSave={() => { const d = details?.result; if (!result.snapshotId || d?.state !== 'ready') { setStatus('Ingredient details not ready; product evidence remains available'); return; }
        const intendedOwner = fixture.ownerId;
        const intendedEpoch = epoch.current;
        void savePartTwoInterpretation({ idempotencyKey: `native:${result.scanId}:${d.resultRevision}`, scanId: result.scanId, expectedGeneration: result.generation, expectedResultRevision: result.resultRevision, selectedSnapshotId: result.snapshotId, selectedDeclarationId: result.declarationId }, { bindingKey: d.bindingKey, expectedPartTwoRevision: d.resultRevision }, invoke).then(value => { if (owner.current === intendedOwner && epoch.current === intendedEpoch) { setSaved(true); setSaveId(value.saveId); setStatus('Exact local ingredient interpretation saved'); } }).catch(() => { if (owner.current === intendedOwner && epoch.current === intendedEpoch) setStatus('Details changed. Review and save again.'); });
      }} />}
  </View>;
}
