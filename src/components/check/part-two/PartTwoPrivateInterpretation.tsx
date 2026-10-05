import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ScanResult } from '../../../contracts/PartOne';
import type { NormalizationRequest } from '../../../contracts/PartTwo';
import type { PartTwoTarget, PartTwoView } from '../../../presentation/part-two/controller';
import { normalizationReplayContent } from '../../../domain/part-two/index';
import { createCatalogRequestId } from '../../../services/productCatalog';
import { PART_TWO_ENABLED, invokePartTwo } from '../../../services/partTwo';
import { createPartTwoTransport, readPartTwoCapturedDetails, savePartTwoCaptureInterpretation, savePartTwoInterpretation, type PartTwoInvoke } from '../../../services/partTwoClient';
import { PartTwoIngredients } from './PartTwoIngredients';
import { Button } from '../../ui/Button';

/** The historical evidence revision comes from an authorized immutable pin,
 * separately from the current private reading. No device storage is used. */
export function PartTwoCapturedIngredients({ target, refreshKey = 0, enabled = PART_TWO_ENABLED, invoke = invokePartTwo }: { target: PartTwoTarget; refreshKey?: number; enabled?: boolean; invoke?: PartTwoInvoke }) {
  const key = JSON.stringify(target), current = useRef(key); current.current = key;
  const [pin, setPin] = useState<{ key: string; id: string; target: PartTwoTarget } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    let alive = true; setPin(null); setStatus(null);
    if (!enabled || !target.captureSessionId) return;
    const requestId = createCatalogRequestId();
    void readPartTwoCapturedDetails(target.captureSessionId, null, requestId, invoke).then(value => {
      if (!alive || current.current !== key) return;
      const r = value.result;
      if (value.withdrawn) { setStatus('Saved ingredient evidence unavailable'); return; }
      if (!r || !value.interpretationId) return;
      if (r.requestId !== requestId || r.authenticatedOwnerId !== target.ownerId || r.scanId !== target.scanId || r.captureSessionId !== target.captureSessionId || r.generation !== target.generation || Date.parse(r.expiresAt) <= Date.now()) throw Error('Historical binding changed');
      setPin({ key, id: value.interpretationId, target: { ...target, evidenceRevision: r.evidenceRevision } });
    }).catch(() => { if (alive && current.current === key) { setPin(null); setStatus('Saved ingredient evidence unavailable'); } });
    return () => { alive = false; };
  }, [key, refreshKey, enabled, invoke]);
  const transport = useMemo(() => {
    let previous: { revision: number; content: string } | null = null;
    return { async normalize(request: NormalizationRequest) {
      if (!pin || !target.captureSessionId) throw Error('Saved ingredient evidence unavailable');
      const value = await readPartTwoCapturedDetails(target.captureSessionId, pin.id, request.requestId, invoke);
      if (value.withdrawn || value.interpretationId !== pin.id || !value.result) throw Error('Saved ingredient evidence unavailable');
      const r = value.result, content = normalizationReplayContent(r);
      if (previous && (r.resultRevision < previous.revision || r.resultRevision === previous.revision && content !== previous.content)) throw Error('Saved interpretation changed');
      previous = { revision: r.resultRevision, content }; return r;
    } };
  }, [pin, target.captureSessionId, invoke]);
  if (!enabled) return null;
  return <View>{status && <Text accessibilityLiveRegion="polite">{status}</Text>}{pin?.key === key && <><Pressable accessibilityRole="button" accessibilityLabel="Saved ingredient interpretation" accessibilityState={{ expanded: expanded === key }} onPress={() => setExpanded(expanded === key ? null : key)} style={{ paddingVertical: 12 }}><Text>Saved ingredient interpretation</Text></Pressable>{expanded === key && <><Text>This keeps the interpretation you explicitly saved. The current label reading may differ.</Text><PartTwoIngredients key={pin.id} enabled target={pin.target} transport={transport} /></>}</>}</View>;
}

export function PartTwoPrivateInterpretation({ target, result, fallback, onView, enabled = PART_TWO_ENABLED, invoke = invokePartTwo }: { target: PartTwoTarget; result: ScanResult; fallback?: React.ReactNode; onView?: (view: PartTwoView) => void; enabled?: boolean; invoke?: PartTwoInvoke }) {
  const [details, setDetails] = useState<PartTwoView | null>(null), [status, setStatus] = useState<string | null>(null), [saving, setSaving] = useState(false), [refreshKey, refresh] = useState(0);
  const key = JSON.stringify(target), current = useRef(key), epoch = useRef(0), busy = useRef(false);
  if (current.current !== key) { current.current = key; epoch.current++; busy.current = false; }
  useEffect(() => () => { epoch.current++; busy.current = false; }, []);
  const transport = useMemo(() => createPartTwoTransport({ enabled: () => enabled, invoke }), [enabled, invoke]);
  const receiveView = useMemo(() => (value: PartTwoView) => { setDetails(value); onView?.(value); }, [onView]);
  useEffect(() => { setDetails(null); setStatus(null); setSaving(false); }, [key]);
  const d = details?.result, t = details?.target;
  const ready = d?.state === 'ready' && t && JSON.stringify(t) === key && Date.parse(d.expiresAt) > Date.now();
  async function save() {
    if (!ready || d?.state !== 'ready' || !target.captureSessionId || busy.current) return;
    const operationKey = key, operationEpoch = epoch.current, guard = { bindingKey: d.bindingKey, expectedPartTwoRevision: d.resultRevision };
    busy.current = true;
    setSaving(true); setStatus(null);
    try {
      // Bound product saves retain both the Part 1 projection and exact Part 2 pin.
      if (d.output.kind === 'bound' && result.snapshotId && result.declarationId) await savePartTwoInterpretation({ idempotencyKey: `private-details:${target.captureSessionId}:${d.resultRevision}`, scanId: result.scanId, expectedGeneration: result.generation, expectedResultRevision: result.resultRevision, selectedSnapshotId: result.snapshotId, selectedDeclarationId: result.declarationId }, guard, invoke);
      await savePartTwoCaptureInterpretation(target.captureSessionId, guard, invoke);
      if (current.current === operationKey && epoch.current === operationEpoch) { setStatus('Ingredient interpretation saved'); refresh(value => value + 1); }
    } catch { if (current.current === operationKey && epoch.current === operationEpoch) setStatus('Details changed or the interpretation could not be saved. Review and save again.'); }
    finally { if (current.current === operationKey && epoch.current === operationEpoch) { busy.current = false; setSaving(false); } }
  }
  if (!enabled) return <>{fallback}</>;
  return <View><PartTwoIngredients target={target} enabled transport={transport} onView={receiveView} fallback={fallback} />
    <Button label={saving ? 'Saving ingredient interpretation' : 'Save ingredient interpretation'} disabled={!ready || saving} variant="outline" onPress={() => void save()} />
    {status && <Text accessibilityLiveRegion="polite">{status}</Text>}
    <PartTwoCapturedIngredients target={target} enabled refreshKey={refreshKey} invoke={invoke} />
  </View>;
}
